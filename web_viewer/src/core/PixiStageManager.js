/**
 * PixiStageManager — manages the PixiJS canvas/renderer and stage graph.
 *
 * Spine loading strategy (SideM-specific):
 *   DO NOT use PIXI.Assets / @pixi-spine/loader-3.8 for Spine loading.
 *   The loader doesn't handle SideM's Unity-exported Spine 3.8 assets correctly.
 *
 *   Instead, manually load everything like the SSR_Portraits project:
 *   1. Fetch .atlas → text (skip Unity binary header)
 *   2. Fetch .skel → ArrayBuffer
 *   3. Load .png → PIXI.Texture with ALPHA_MODES.PMA forced
 *   4. Construct TextureAtlas with a callback that maps texture filenames
 *   5. AtlasAttachmentLoader + SkeletonBinary → SkeletonData
 *   6. new Spine(skeletonData)
 *
 * Debug features:
 *   - Drag any spine to reposition visually (for calibration)
 *   - Red origin marker at each spine (0,0) so you can find it even
 *     when scale/position sends the texture off-screen
 *   - Scale +/- via changeSpineScale()
 */

import * as PIXI from 'pixi.js'
import { Spine, SkeletonBinary, AtlasAttachmentLoader } from '@pixi-spine/runtime-3.8'
import { TextureAtlas } from '@pixi-spine/base'
import { getBgUrl, getSpineAtlasUrl, getSpineSkelUrl } from '../utils/AssetResolver.js'

export class PixiStageManager {
  constructor(containerEl, options = {}) {
    this.container = containerEl
    this.width = options.width || containerEl.clientWidth || 1280
    this.height = options.height || containerEl.clientHeight || 720

    this.app = null
    this.bgSprite = null
    this.currentBgId = null
    this.spineInstances = {}   // { idolId: { spine: Spine, modelId: string, marker: Graphics } }
    this._debugMode = false

    this._init()
    this._observeResize()
  }

  _init() {
    this.app = new PIXI.Application({
      width: this.width,
      height: this.height,
      backgroundColor: 0x000000,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })
    this.container.appendChild(this.app.view)

    // Layer structure: bgContainer (bottom) → spineContainer (top)
    this.bgContainer = new PIXI.Container()
    this.spineContainer = new PIXI.Container()
    this.app.stage.addChild(this.bgContainer)
    this.app.stage.addChild(this.spineContainer)
  }

  _observeResize() {
    this._resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          this.width = width
          this.height = height
          this.app.renderer.resize(width, height)
          if (this.bgSprite) {
            this._applyBgCover(this.bgSprite)
          }
          // Spines stay at their current positions on resize (user may have dragged them)
        }
      }
    })
    this._resizeObserver.observe(this.container)
  }

  // ── Debug mode ──

  setDebugMode(enabled) {
    this._debugMode = enabled
    for (const entry of Object.values(this.spineInstances)) {
      if (entry.marker) entry.marker.visible = enabled
    }
  }

  getSpineStates() {
    const states = {}
    for (const [id, entry] of Object.entries(this.spineInstances)) {
      states[id] = {
        x: Math.round(entry.spine.x),
        y: Math.round(entry.spine.y),
        scale: entry.spine.scale.x,
        modelId: entry.modelId,
      }
    }
    return states
  }

  changeSpineScale(idolId, delta) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const s = entry.spine.scale.x
    const newScale = Math.max(0.001, Math.min(100, s + delta))
    entry.spine.scale.set(newScale)
    this._emitSpineState(idolId)
  }

  // ── Background ──

  /**
   * cover 模式布局：等比缩放填满容器，多余裁切，然后居中。
   */
  _applyBgCover(sprite) {
    if (!sprite?.texture) return
    // 高度撑满容器，宽度等比跟随，横向居中裁切
    sprite.height = this.height
    sprite.scale.x = sprite.scale.y
    sprite.anchor.set(0, 0)
    sprite.x = (this.width - sprite.width) / 2
    sprite.y = 0
  }

  async setBackground(bgId) {
    if (bgId === this.currentBgId) return
    this.currentBgId = bgId

    const oldSprite = this.bgSprite
    try {
      const url = getBgUrl(bgId)
      const texture = await PIXI.Assets.load(url)
      const newSprite = new PIXI.Sprite(texture)
      this._applyBgCover(newSprite)
      newSprite.alpha = 0
      this.bgContainer.addChild(newSprite)
      this.bgSprite = newSprite

      const duration = 30
      let frame = 0
      const tickerFn = () => {
        frame++
        const t = Math.min(frame / duration, 1)
        if (oldSprite) oldSprite.alpha = 1 - t
        newSprite.alpha = t
        if (t >= 1) {
          this.app.ticker.remove(tickerFn)
          if (oldSprite) {
            this.bgContainer.removeChild(oldSprite)
            oldSprite.destroy({ texture: true })
          }
        }
      }
      this.app.ticker.add(tickerFn)
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to load bg "${bgId}":`, err.message)
    }
  }

  clearBackground() {
    this.currentBgId = null
    if (this.bgSprite) {
      this.bgContainer.removeChild(this.bgSprite)
      this.bgSprite.destroy({ texture: true })
      this.bgSprite = null
    }
  }

  // ── Spine loading ──

  async spawnSpine(idolId, modelId) {
    this.removeSpine(idolId)

    const step = (name, fn) => {
      try { return fn() }
      catch (e) { console.error(`[spawnSpine] STEP "${name}" failed for ${modelId}:`, e); throw e }
    }

    try {
      const atlasUrl = getSpineAtlasUrl(modelId)
      const skelUrl = getSpineSkelUrl(modelId)

      const [atlasBuf, skelBuffer] = await Promise.all([
        fetch(atlasUrl).then(r => {
          if (!r.ok) throw new Error(`Atlas ${r.status}`)
          return r.arrayBuffer()
        }),
        fetch(skelUrl).then(r => {
          if (!r.ok) throw new Error(`Skel ${r.status}`)
          return r.arrayBuffer()
        }),
      ])
      const atlasText = step('decodeAtlas', () => this._decodeAtlasText(atlasBuf))

      const textureFile = step('extractTextureFilename', () => this._extractTextureFilename(atlasText))
      const textureUrl = this._getTextureUrl(modelId, textureFile)
      const texture = await step('loadTexture', () => this._loadTextureFromUrl(textureUrl))

      const textureMap = {}
      textureMap[textureFile] = texture

      const atlas = await step('TextureAtlas', () => new Promise((resolve, reject) => {
        try {
          new TextureAtlas(atlasText,
            (path, loaderCb) => {
              const fileName = path.split('/').pop()
              const tex = textureMap[fileName]
              if (tex && tex.baseTexture) {
                loaderCb(tex.baseTexture)
              } else {
                loaderCb(this._getFallbackTexture())
              }
            },
            (result) => {
              if (result) resolve(result)
              else reject(new Error('TextureAtlas loading failed'))
            }
          )
        } catch (err) {
          reject(err)
        }
      }))

      for (const page of atlas.pages) {
        page.pma = true
      }

      const attachmentLoader = step('AtlasAttachmentLoader', () => new AtlasAttachmentLoader(atlas))
      const skeletonBinary = step('SkeletonBinary', () => new SkeletonBinary(attachmentLoader))
      const cleanSkel = step('decodeSkel', () => this._decodeSkelBuffer(skelBuffer))

      let skeletonData
      try {
        skeletonData = skeletonBinary.readSkeletonData(new Uint8Array(cleanSkel))
      } catch (readErr) {
        console.error(`[PixiStageManager] readSkeletonData CRASHED for "${modelId}":`, readErr.message || readErr, readErr.stack ? readErr.stack.split('\n').slice(0,3).join('\n') : '')
        throw readErr
      }

      // Debug: validate skeleton has real data
      console.log(`[DEBUG] height=${skeletonData.height} width=${skeletonData.width}`)
      console.log(`[DEBUG] bones: ${skeletonData.bones.length}`, skeletonData.bones ? skeletonData.bones.map(b => b ? b.name + '(' + b.length + ')' : '?').join(', ') : 'N/A')
      console.log(`[DEBUG] slots: ${skeletonData.slots.length}`, skeletonData.slots ? skeletonData.slots.map(s => s && s.data ? s.data.name : '?').join(', ') : 'N/A')
      console.log(`[DEBUG] skins: ${skeletonData.skins.length}`, skeletonData.skins ? skeletonData.skins.map(s => s ? s.name : '?').join(', ') : 'N/A')
      console.log(`[DEBUG] animations:`, skeletonData.animations ? skeletonData.animations.map(a => a ? a.name : '?').join(', ') : 'N/A')

      // Check if skeleton has any visible geometry
      let hasMeshOrRegion = false
      if (skeletonData.skins) {
        for (const skin of skeletonData.skins) {
          if (!skin || !skin.attachments) continue
          for (const [slotIdx, attachmentMap] of Object.entries(skin.attachments)) {
            if (Object.keys(attachmentMap).length > 0) { hasMeshOrRegion = true; break }
          }
          if (hasMeshOrRegion) break
        }
      }
      console.log(`[DEBUG] hasMeshOrRegion: ${hasMeshOrRegion}`)

      const spine = step('new Spine(skeletonData)', () => new Spine(skeletonData))

      // ── 丝滑过渡：所有动作切换默认 0.12 秒淡入淡出 ──
      spine.stateData.defaultMix = 0.12

      // ── 物理学分轨缓动 ──
      // Track 0 (Body): Smoothstep × 0.5 + Linear × 0.5 — 轻微重量感，不拖沓
      // Track 1 (Face): Back-Out (c1=3.0) — 冲过头 ~20% 再弹回，明显 Q 弹
      const origStateUpdate = spine.state.update.bind(spine.state)
      spine.state.update = (dt) => {
        origStateUpdate(dt)
        for (let i = 0; i <= 1; i++) {
          const track = spine.state.tracks[i]
          if (!track || track.alpha <= 0 || track.alpha >= 1 || track.mixDuration <= 0) continue
          const t = track.alpha
          if (i === 0) {
            const smoothstep = t * t * (3 - 2 * t)
            track.alpha = t * 0.5 + smoothstep * 0.5     // 50% smoothstep → 轻柔重量
          } else {
            const c1 = 5.0, c3 = c1 + 1
            track.alpha = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)  // back-out 弹性
          }
        }
      }

      // ── 眨眼掩护 + 特效插槽检测 ──
      spine._blinkCfg = this._detectBlinkSlots(spine)
      spine._effectCfg = this._detectEffectSlots(spine)
      const origApply = spine.state.apply.bind(spine.state)
      spine.state.apply = (skeleton) => {
        origApply(skeleton)

        // ── Blink cover override ──
        const blinkCfg = spine._blinkCfg
        if (blinkCfg) {
          const now = performance.now()
          const blinking = spine._blinkCoverEndTime && now < spine._blinkCoverEndTime
          if (blinking) {
            if (!spine._savedEyeAtts) {
              spine._savedEyeAtts = {}
              for (const name of blinkCfg.hide) {
                const slot = skeleton.findSlot(name)
                if (slot) spine._savedEyeAtts[name] = slot.attachment?.name || null
              }
            }
            for (const name of blinkCfg.hide) {
              try { skeleton.setAttachment(name, null) } catch (_) {}
            }
            for (const item of blinkCfg.show) {
              try { skeleton.setAttachment(item.slot, item.att) } catch (_) {}
            }
          } else if (spine._savedEyeAtts) {
            for (const [slotName, attName] of Object.entries(spine._savedEyeAtts)) {
              if (attName) {
                try { skeleton.setAttachment(slotName, attName) } catch (_) {}
              }
            }
            for (const item of blinkCfg.show) {
              try { skeleton.setAttachment(item.slot, null) } catch (_) {}
            }
            spine._savedEyeAtts = null
            spine._blinkCoverEndTime = undefined
          } else {
            spine._blinkCoverEndTime = undefined
          }
        }

        // ── 特效插槽覆盖：根据 flag 强制隐藏脸红/汗滴 ──
        const effectCfg = spine._effectCfg
        const eFlags = spine._faceFlags || {}
        if (effectCfg && effectCfg.blush.length > 0 && eFlags.blush_flag !== 'チーク') {
          for (const name of effectCfg.blush) {
            const slot = skeleton.findSlot(name)
            if (slot) slot.color.a = 0
          }
        }
        if (effectCfg && effectCfg.sweat.length > 0 && eFlags.sweat_flag !== '汗') {
          for (const name of effectCfg.sweat) {
            const slot = skeleton.findSlot(name)
            if (slot) slot.color.a = 0
          }
        }
      }

      this._applyDefaultPosition(spine)

      // ── Debug: red origin marker ──
      const marker = new PIXI.Graphics()
      marker.beginFill(0xff0000)
      marker.drawCircle(0, 0, 8)
      marker.endFill()
      marker.beginFill(0xffffff)
      marker.drawCircle(0, 0, 3)
      marker.endFill()
      marker.visible = this._debugMode
      spine.addChild(marker)

      // ── Draggable interaction (PIXI v7 globalpointermove pattern) ──
      spine.eventMode = 'dynamic'
      spine.cursor = 'grab'

      spine.on('pointerdown', (event) => {
        this._dragSpineId = idolId
        spine.cursor = 'grabbing'
        spine.alpha = 0.8
        const pos = event.data.getLocalPosition(spine.parent)
        this._dragOffset = { x: spine.x - pos.x, y: spine.y - pos.y }
      })

      const onDragEnd = () => {
        if (this._dragSpineId !== idolId) return
        this._dragSpineId = null
        this._dragOffset = null
        spine.cursor = 'grab'
        spine.alpha = 1
        this._emitSpineState(idolId)
      }

      spine.on('pointerup', onDragEnd)
      spine.on('pointerupoutside', onDragEnd)

      // One shared globalpointermove handler on stage (never loses tracking)
      if (!this._globalMoveHandler) {
        this._globalMoveHandler = (e) => {
          const dragId = this._dragSpineId
          if (!dragId || !this._dragOffset) return
          const entry = this.spineInstances[dragId]
          if (!entry) return
          const pos = e.data.getLocalPosition(entry.spine.parent)
          entry.spine.x = pos.x + this._dragOffset.x
          entry.spine.y = pos.y + this._dragOffset.y
          this._emitSpineState(dragId)
        }
        this.app.stage.on('globalpointermove', this._globalMoveHandler)
      }

      const animNames = skeletonData.animations.map(a => a.name)
      console.log(`[PixiStageManager] Spine "${modelId}" loaded. Anims:`, animNames.join(', '))

      // ── 全局暴露 Spine 实例，方便控制台调试 ──
      if (!window.__spines) window.__spines = {}
      window.__spines[idolId] = spine
      window.__dumpSpine = (id) => {
        const s = id ? window.__spines[id] : Object.values(window.__spines)[0]
        if (!s) return console.log('No spine instance found')
        const sd = s.skeleton.data
        console.log('=== Slots ===')
        sd.slots.forEach((sl, i) => console.log(`  [${i}] ${sl.name} (bone: ${sl.bone.name}, defAtt: ${sl.attachmentName || '-'})`))
        console.log('=== Default Skin Attachments ===')
        if (sd.defaultSkin) {
          sd.defaultSkin.getAttachments().forEach(a => {
            const slotName = sd.slots[a.slotIndex]?.name || '?'
            console.log(`  slot=${slotName} attName='${a.name}' path='${a.attachmentName}'`)
          })
        }
        const cfg = s._blinkCfg
        console.log('=== BlinkCfg ===', cfg ? JSON.stringify(cfg, null, 2) : 'null')
      }

      // 用外层 Container 做淡入淡出，避免 Spine 子元素各自渐变露出破绽
      const fadeWrapper = new PIXI.Container()
      fadeWrapper.addChild(spine)
      this.spineContainer.addChild(fadeWrapper)
      this.spineInstances[idolId] = { spine, modelId, marker, wrapper: fadeWrapper }

      // Set default animations on both tracks
      if (animNames.length > 0) {
        // Track 0: default body animation (usually first = wait_loop)
        this.playSpineAnim(idolId, animNames[0])
        // Track 1: default face animation if available (e.g. "face_default")
        if (animNames.includes('face_default')) {
          spine.state.setAnimation(1, 'face_default', true)
        } else if (animNames.some(n => n.startsWith('face_'))) {
          const firstFace = animNames.find(n => n.startsWith('face_'))
          spine.state.setAnimation(1, firstFace, true)
        }
      }

      // ── 淡入 (Fade In) ──
      this._fadeIn(spine)

      return spine
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to load spine "${modelId}" for "${idolId}":`, err.message)
      return null
    }
  }

  _emitSpineState(idolId) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    window.dispatchEvent(new CustomEvent('spine-dragged', {
      detail: {
        id: idolId,
        x: Math.round(entry.spine.x),
        y: Math.round(entry.spine.y),
        scale: entry.spine.scale.x,
      }
    }))
  }

  _applyDefaultPosition(spine) {
    // ── 智能自适应缩放 ──
    // 用校准法归一化：以 scale 0.26 为基准，按骨骼框高度等比缩放
    // 避免直接按屏幕百分比硬套（骨骼框含大量空白，硬套会让角色偏小）
    const originalHeight = spine.skeleton.data.height
    if (originalHeight > 0) {
      const REF_HEIGHT = 3060  // 基准骨骼高度(px)，对应 scale 0.26 视觉大小
      spine.scale.set(0.26 * (REF_HEIGHT / originalHeight))
    } else {
      spine.scale.set(0.26)
    }
    spine.y = this.app.screen.height + 20
    spine.x = this.app.screen.width * 0.5
  }

  setSpinePosition(idolId, positionIdx) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry
    const POSITION_X_RATIOS = { 0: 0.25, 1: 0.5, 2: 0.75 }
    if (positionIdx != null && POSITION_X_RATIOS[positionIdx] !== undefined) {
      spine.x = this.width * POSITION_X_RATIOS[positionIdx]
    } else {
      spine.x = this.width * 0.5
    }
    spine.y = this.height + 20
  }

  _decodeSkelBuffer(buf) {
    const view = new DataView(buf)
    const nameLen = view.getUint32(0, true)
    // Unity binary header: uint32 filenameLength + filename + padding + uint32 metadata
    if (nameLen > 0 && nameLen < 100) {
      let printable = true
      for (let i = 0; i < nameLen; i++) {
        const b = view.getUint8(4 + i)
        if (b < 0x20 || b > 0x7e) { printable = false; break }
      }
      if (printable) {
        // Name section: 4 (length) + nameLen + padding to uint32 boundary
        const nameSection = 4 + nameLen + ((4 - (4 + nameLen) % 4) % 4)
        // Unity metadata uint32 follows name section (file size or block type)
        const headerSize = nameSection + 4
        console.log(`[PixiStageManager] Stripped ${headerSize}-byte Unity header from .skel`)
        return buf.slice(headerSize)
      }
    }
    return buf
  }

  // ── Atlas / texture helpers ──

  _decodeAtlasText(buf) {
    const text = new TextDecoder('utf-8').decode(buf)
    const sizeIdx = text.indexOf('\nsize:')
    if (sizeIdx < 0) return text
    const lineStart = text.lastIndexOf('\n', sizeIdx - 1)
    if (lineStart < 0) return text
    const atlasText = text.substring(lineStart + 1)
    const firstLine = atlasText.split('\n')[0].trim()
    if (!firstLine || firstLine.includes(':')) return text
    return atlasText
  }

  _extractTextureFilename(atlasText) {
    const lines = atlasText.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.includes(':') && !trimmed.startsWith('//')) {
        return trimmed.split('/').pop()
      }
    }
    return 'comu.png'
  }

  /**
   * 模型自适应的眨眼槽检测：遍历 skeleton slot 名称，
   * 自动找出闭眼时需要隐藏/显示的槽位，不限模型。
   */
  _detectBlinkSlots(spine) {
    const hide = []
    const show = []
    const skin = spine.skeleton.data.defaultSkin
    const slotNames = spine.skeleton.data.slots.map(s => s.name)
    for (const name of slotNames) {
      const low = name.toLowerCase()
      const idx = spine.skeleton.data.findSlotIndex(name)
      if (idx < 0) continue
      // ── 闭眼槽：匹配 eyelash_close_L / eyelash_L_close / eye_close_shadow 等 ──
      if (/_close/.test(low)) {
        let attName = name
        if (skin?.attachments?.[idx]) {
          const keys = Object.keys(skin.attachments[idx])
          // 优先选 attachment 名含 "close" 的（多个变体时避免选到 smile）
          const closeKey = keys.find(k => /close/i.test(k))
          attName = closeKey ?? keys[0] ?? ''
        }
        try {
          const testAtt = skin?.getAttachment?.(idx, attName) || spine.skeleton.getAttachment(idx, attName)
          if (testAtt) show.push({ slot: name, att: attName })
        } catch (_) {}
      // ── 笑眼槽 ──
      } else if (/_smile/.test(low)) {
        hide.push(name)
      // ── 开眼零件（闭眼时要隐藏）─放在 close/smile 之后，避免误抓 ──
      } else if (/^(eyelash|eyewhite|eyelight|eyeline|eye_pupil|eyeball)/.test(low)) {
        hide.push(name)
      } else if (/eyeball.*skin/.test(low)) {
        hide.push(name)
      }
    }
    if (hide.length === 0 && show.length === 0) return null
    console.log('[BlinkCfg]', { slotCount: slotNames.length, hide, show })
    return { hide, show }
  }

  /**
   * 特效插槽动态检测：找出脸红（cheek_dye）和汗滴（swet）插槽。
   * 原版 .skel 动画会硬编码这些插槽 alpha=1，我们根据 flag 强制覆盖。
   */
  _detectEffectSlots(spine) {
    const blush = []
    const sweat = []
    const slotNames = spine.skeleton.data.slots.map(s => s.name)
    for (const name of slotNames) {
      const low = name.toLowerCase()
      // 脸红：cheek_dye_L, cheek_dye_R 等
      if (/cheek/.test(low)) {
        blush.push(name)
      }
      // 汗滴：swet, swet_shadow, swet_2, sweat_* 等
      if (/^swet\b/.test(low) || /^sweat\b/.test(low)) {
        sweat.push(name)
      }
    }
    const result = { blush, sweat }
    if (blush.length > 0 || sweat.length > 0) {
      console.log('[EffectCfg]', result)
    }
    return result
  }

  _getTextureUrl(modelId, textureFile) {
    const atlasUrl = getSpineAtlasUrl(modelId)
    const base = atlasUrl.substring(0, atlasUrl.lastIndexOf('/'))
    return `${base}/${textureFile}`
  }

  _loadTextureFromUrl(url) {
    return new Promise(resolve => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = url
      img.onload = () => {
        const bt = PIXI.BaseTexture.from(img)
        bt.alphaMode = PIXI.ALPHA_MODES.PMA
        const onReady = () => resolve(PIXI.Texture.from(bt))
        if (bt.valid) {
          onReady()
        } else {
          bt.once('update', onReady)
          setTimeout(() => {
            if (!bt.valid) {
              console.warn(`[PixiStageManager] Texture timeout: ${url}`)
              resolve(PIXI.Texture.from(bt))
            }
          }, 10000)
        }
      }
      img.onerror = () => {
        console.warn(`[PixiStageManager] Failed to load texture: ${url}`)
        resolve(this._getFallbackTexture())
      }
    })
  }

  _getFallbackTexture() {
    const canvas = document.createElement('canvas')
    canvas.width = 64; canvas.height = 64
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ff00ff'
    ctx.fillRect(0, 0, 64, 64)
    const bt = PIXI.BaseTexture.from(canvas)
    bt.alphaMode = PIXI.ALPHA_MODES.PMA
    return PIXI.Texture.from(bt)
  }

  // ── Talking / 程序化骨骼唇形同步 (Procedural Lip-Sync) ──

  /**
   * 程序化唇形同步引擎 (Procedural Lip-Sync Engine).
   *
   * 原理：SideM Spine 模型没有预制的说话动画(talk/mouth clip),
   * 而是内建了精细的面部骨骼 (chin_control, mouth, chin)。
   *
   * 为什么不能用 PIXI.Ticker 驱动骨骼？
   *   Spine 渲染管线: state.apply(skeleton) → updateWorldTransform() → 渲染
   *   Ticker 修改骨骼的时机可能在 apply 之前或之后，大概率被 apply 覆盖。
   *
   * 解法：劫持 skeleton.updateWorldTransform()，在 apply 写入动画关键帧之后、
   *   顶点坐标计算之前注入骨骼偏移，绝对无法被覆盖。
   *
   * 同时驱动两个骨骼:
   *   - chin_control / chin: Y 轴位移 (下巴下拉)
   *   - mouth: scaleY 缩放 (嘴唇开合)
   */
  setSpineTalking(idolId, isTalking, volumeCallback = null) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry

    spine.customIsTalking = isTalking
    if (isTalking && volumeCallback) {
      spine.getVoiceVolume = volumeCallback
    } else if (!isTalking) {
      delete spine.getVoiceVolume
    }

    if (!spine._lipSyncHooked) {
      // ── 探测所有口腔相关插槽 ──
      const mouthSlot = spine.skeleton.slots.find(s => /^mouth$/i.test(s.data.name))
      const mouthClipSlot = spine.skeleton.slots.find(s => /^mouth_clip$/i.test(s.data.name))
      const tongueSlot = spine.skeleton.slots.find(s => /^tongue$/i.test(s.data.name))
      const toothTopSlot = spine.skeleton.slots.find(s => /^tooth_top$/i.test(s.data.name))
      const toothBotSlot = spine.skeleton.slots.find(s => /^tooth_bottom$/i.test(s.data.name))

      if (!mouthSlot) return

      // ── 口腔相关骨骼 ──
      const mouthBone = spine.skeleton.findBone('mouth')
      const mouthDataScaleX = mouthBone ? mouthBone.data.scaleX : 1
      const mouthDataScaleY = mouthBone ? mouthBone.data.scaleY : 1
      const mouthCloseBone = spine.skeleton.findBone('mouth_close')
      const mouthCloseDataScaleX = mouthCloseBone ? mouthCloseBone.data.scaleX : 1
      const mouthCloseDataScaleY = mouthCloseBone ? mouthCloseBone.data.scaleY : 1
      const toothBone = spine.skeleton.findBone('tooth')
      const toothDataScaleX = toothBone ? toothBone.data.scaleX : 1
      const toothDataScaleY = toothBone ? toothBone.data.scaleY : 1
      const tongueBone = spine.skeleton.findBone('tongue')
      const tongueDataScaleX = tongueBone ? tongueBone.data.scaleX : 1
      const tongueDataScaleY = tongueBone ? tongueBone.data.scaleY : 1
      const chinControlBone = spine.skeleton.findBone('chin_control')
      const chinControlBaseY = chinControlBone ? chinControlBone.data.y : 0

      // ── 检测绑骨类型：mouth slot 绑在哪个骨骼上？──
      // 成人: mouth slot → mouth bone（tooth/tongue 父= head）
      // 幼年: mouth slot → mouth_close bone（tooth/tongue 父= mouth_close）
      const mouthSlotBone = mouthSlot.bone?.data?.name || 'mouth'
      const isChildRig = mouthSlotBone === 'mouth_close'
      console.log(`[PixiStageManager] Lip-sync for "${idolId}": mouthSlot→${mouthSlotBone} mouth=${!!mouthBone} mouthClose=${!!mouthCloseBone} tooth=${!!toothBone} tongue=${!!tongueBone} chinControl=${!!chinControlBone} [${isChildRig?'CHILD':'ADULT'} rig]`)

      // 预计算口腔附件的 fallback 映射
      const defaultSkin = spine.skeleton.data.defaultSkin
      const mouthClipAtts = mouthClipSlot ? defaultSkin?.attachments?.[spine.skeleton.data.findSlotIndex(mouthClipSlot.data.name)] : null
      const tongueAtts = tongueSlot ? defaultSkin?.attachments?.[spine.skeleton.data.findSlotIndex(tongueSlot.data.name)] : null
      const toothTopAtts = toothTopSlot ? defaultSkin?.attachments?.[spine.skeleton.data.findSlotIndex(toothTopSlot.data.name)] : null
      const toothBotAtts = toothBotSlot ? defaultSkin?.attachments?.[spine.skeleton.data.findSlotIndex(toothBotSlot.data.name)] : null

      spine.smoothVol = 0
      const origUpdateWT = spine.skeleton.updateWorldTransform

      // ── 防御：try-catch 包裹整个 hook，任何模型特定的错误都不会卡崩渲染循环 ──
      spine.skeleton.updateWorldTransform = function () {
        try {
          const currentAtt = mouthSlot.attachment
          if (!currentAtt?.name) return

          const match = currentAtt.name.match(/^(mouth_(.+?))(\d)$/i)
          if (!match) return

          const exp = match[2]

          const rawVol = (spine.customIsTalking && spine.getVoiceVolume) ? spine.getVoiceVolume() : 0
          spine.smoothVol = spine.smoothVol * 0.55 + rawVol * 0.45

          const isOpen = spine.smoothVol > 0.08

          if (isOpen) {
            const openName = `mouth_${exp}2`
            if (currentAtt.name !== openName) {
              spine.skeleton.setAttachment('mouth', openName)
            }

            const openRatio = Math.min(1, Math.max(0, (spine.smoothVol - 0.08) / 0.92))
            const dynScaleY = 1.0 + openRatio * 3.7

            if (mouthBone) {
              mouthBone.scaleX = mouthDataScaleX * dynScaleY
              mouthBone.scaleY = mouthDataScaleY
            }
            if (isChildRig) {
              if (mouthCloseBone) {
                mouthCloseBone.scaleX = mouthCloseDataScaleX
                mouthCloseBone.scaleY = mouthCloseDataScaleY
              }
            } else {
              if (toothBone) {
                toothBone.scaleX = toothDataScaleX * dynScaleY
                toothBone.scaleY = toothDataScaleY
              }
              if (tongueBone) {
                tongueBone.scaleX = tongueDataScaleX * dynScaleY
                tongueBone.scaleY = tongueDataScaleY
              }
            }

            if (tongueSlot) {
              const tName = `tongue_${exp}`
              spine.skeleton.setAttachment('tongue',
                tongueAtts?.[tName] ? tName : tongueSlot.attachment || 'tongue_default')
            }
            if (toothTopSlot) {
              const tName = `tooth_${exp}`
              spine.skeleton.setAttachment('tooth_top',
                toothTopAtts?.[tName] ? tName : toothTopSlot.attachment || 'tooth_default')
            }
            if (toothBotSlot) {
              const tName = `tooth_bottom_${exp}`
              spine.skeleton.setAttachment('tooth_bottom',
                toothBotAtts?.[tName] ? tName : null)
            }
            if (mouthClipSlot) {
              const cName = `mouth_clip_${exp}`
              spine.skeleton.setAttachment('mouth_clip',
                mouthClipAtts?.[cName] ? cName : null)
            }

            if (!spine._lipSyncDumpFired) {
              if (spine._lipSyncDumpCounter === undefined) spine._lipSyncDumpCounter = 0
              spine._lipSyncDumpCounter++
              if (spine._lipSyncDumpCounter >= 5) {
                spine._lipSyncDumpFired = true
                console.log(`%c═══ POST-SWAP DIAGNOSTIC for "${idolId}" ═══`, 'font-weight:bold;color:#ffaa00')
                console.log(`Expression: ${exp}, smoothVol: ${spine.smoothVol.toFixed(3)}`)
                ;['mouth','mouth_clip','tongue','tooth_top','tooth_bottom'].forEach(name => {
                  const s = spine.skeleton.slots.find(sl => sl.data.name === name)
                  if (s) console.log(`  ${s.data.name.padEnd(20,' ')} → ${s.attachment?.name || '(null)'}`)
                })
                console.log(`%cSLOT → BONE MAPPING (face area):`, 'font-weight:bold')
                spine.skeleton.slots.forEach(s => {
                  if (!s.bone) return
                  const b = s.bone
                  if (/mouth|head|face|clip|kuchi|lip|cheek|tooth|tongue|chin|jaw|nose|eyelash|eyeball|eyebrow|eye_|swet/i.test(s.data.name)) {
                    console.log(`  ${s.data.name.padEnd(22,' ')} bone=${b.data.name.padEnd(22,' ')} y=${b.y.toFixed(1)} sY=${b.scaleY.toFixed(3)}`)
                  }
                })
                console.log(`%cBONE TREE (face area):`, 'font-weight:bold')
                const faceBoneNames = ['head','mouth','mouth_close','chin','chin_control','face_control','face_control_reverse','tooth','tongue','eyelash_control','eye_blink','eyebrow','eye_control']
                spine.skeleton.bones.forEach(b => {
                  if (faceBoneNames.includes(b.data.name)) {
                    const parentName = b.parent ? b.parent.data.name : '(root)'
                    console.log(`  ${b.data.name.padEnd(22,' ')} parent=${parentName.padEnd(22,' ')} y=${b.y.toFixed(1)} scaleX=${b.scaleX.toFixed(3)} scaleY=${b.scaleY.toFixed(3)}`)
                  }
                })
                console.log(`%cALL SLOT ATTACHMENTS:`, 'font-weight:bold')
                spine.skeleton.slots.forEach((s, i) => {
                  const a = s.attachment?.name || '(null)'
                  if (!a.startsWith('axis_') && !a.startsWith('_bg')) {
                    console.log(`  [${String(i).padStart(3,'0')}] ${s.data.name.padEnd(20,' ')} → ${a}`)
                  }
                })
                console.log(`%cMULTI-ATTACHMENT SLOTS (candidates for missing parts):`, 'font-weight:bold')
                spine.skeleton.slots.forEach(s => {
                  const idx = spine.skeleton.data.findSlotIndex(s.data.name)
                  const atts = defaultSkin?.attachments?.[idx]
                  if (atts && Object.keys(atts).length > 1) {
                    const current = s.attachment?.name || '(null)'
                    console.log(`  ${s.data.name.padEnd(22,' ')} → ${current.padEnd(22,' ')} variants=[${Object.keys(atts).join(', ')}]`)
                  }
                })
                console.log(`%cALL BONES:`, 'font-weight:bold')
                spine.skeleton.bones.forEach(b => {
                  const dn = b.data.name
                  if (!dn.startsWith('axis_') && !dn.startsWith('_bg') && dn !== 'root') {
                    console.log(`  ${dn.padEnd(22,' ')} x=${b.x.toFixed(1).padStart(7,' ')} y=${b.y.toFixed(1).padStart(7,' ')} sX=${b.scaleX.toFixed(3)} sY=${b.scaleY.toFixed(3)} r=${b.rotation.toFixed(1)}`)
                  }
                })
                console.log(`%c═══════════════════════════════════════`, 'font-weight:bold;color:#ffaa00')
              }
            }
          } else {
            const closeName = `mouth_${exp}1`
            if (currentAtt.name !== closeName) {
              spine.skeleton.setAttachment('mouth', closeName)
            }
            if (mouthBone) { mouthBone.scaleX = mouthDataScaleX; mouthBone.scaleY = mouthDataScaleY }
            if (isChildRig) {
              // 幼年：tooth/tongue 继承 mouth_close，由其统一复位
            } else {
              if (toothBone) { toothBone.scaleX = toothDataScaleX; toothBone.scaleY = toothDataScaleY }
              if (tongueBone) { tongueBone.scaleX = tongueDataScaleX; tongueBone.scaleY = tongueDataScaleY }
            }
            if (chinControlBone) chinControlBone.y = chinControlBaseY
            if (mouthCloseBone) mouthCloseBone.scaleY = mouthCloseDataScaleY
            if (tongueSlot) spine.skeleton.setAttachment('tongue', null)
            if (toothTopSlot) spine.skeleton.setAttachment('tooth_top', null)
            if (toothBotSlot) spine.skeleton.setAttachment('tooth_bottom', null)
            if (mouthClipSlot) spine.skeleton.setAttachment('mouth_clip', null)
          }
        } catch (e) {
          console.warn(`[LipSync] updateWorldTransform error for "${idolId}":`, e)
        }
        origUpdateWT.call(this)
      }

      spine._lipSyncHooked = true
      // ── 调试：暴露到全局，在控制台直接敲 _s('040ren') 即可探查 ──
      if (!window._s) window._s = {}
      window._s[idolId] = spine
      // ── 交互式骨骼探查器 ──
      if (!window._probe) window._probe = {}
      window._probe[idolId] = () => {
        const s = spine.skeleton
        console.log(`%c═══ PROBE: ${idolId} ═══`, 'font-weight:bold;color:#00ff88')
        // 1) 口腔插槽→骨骼映射
        console.log('%cSLOT→BONE (oral area)', 'font-weight:bold')
        const faceKeys = ['mouth','clip','tongue','tooth','lip','jaw','kuchi']
        s.slots.forEach(sl => {
          if (faceKeys.some(k => sl.data.name.includes(k)))
            console.log(`  ${sl.data.name.padEnd(22)} bone=${(sl.bone?.data?.name||'?').padEnd(18)} attach=${sl.attachment?.name||'(null)'}`)
        })
        // 2) 候选骨骼详细状态
        console.log('%cCANDIDATE BONES (with constraints)', 'font-weight:bold')
        ;['mouth','mouth_close','chin','chin_control','face_control','jaw','kuchi','head'].forEach(n => {
          const b = s.findBone(n)
          if (b) console.log(`  ${n.padEnd(22)} parent=${(b.parent?.data?.name||'root').padEnd(16)} x=${b.x.toFixed(1)} y=${b.y.toFixed(1)} sX=${b.scaleX.toFixed(3)} sY=${b.scaleY.toFixed(3)} r=${b.rotation.toFixed(2)}`)
        })
        // 3) 约束列表
        if (s.data.constraints?.length) {
          console.log('%cCONSTRAINTS', 'font-weight:bold')
          s.data.constraints.forEach(c => console.log(`  ${c.type.padEnd(20)} target=${c.target?.data?.name || '?'} owner=${(c.bone || c.slot)?.data?.name || '?'}`))
        }
        // 4) 单个骨骼测试函数
        window._probeTest = (boneName, prop, val) => {
          const b = s.findBone(boneName)
          if (!b) { console.warn(`"${boneName}" not found`); return }
          b[prop] = val
          s.updateWorldTransform()
          console.log(`→ ${boneName}.${prop} = ${val}`)
        }
        console.log('Manual: _probeTest("chin_control","y",200)')
        // 6) mesh 顶点权重探查
        window._probeWeight = () => {
          const mouthSlot = s.slots.find(sl => /^mouth$/i.test(sl.data.name))
          if (!mouthSlot || !mouthSlot.attachment) { console.warn('No mouth attachment'); return }
          const att = mouthSlot.attachment
          console.log(`%cMESH WEIGHT: "${att.name}" type=${att.type}`, 'font-weight:bold;color:#ffaa00')
          // @pixi-spine MeshAttachment stores bone weights
          if (att.bones && att.vertices) {
            console.log(`  Bones array (length=${att.bones.length}): bone indices →`, Array.from(att.bones))
            // Map bone indices to names
            const boneNames = Array.from(att.bones).map(idx => {
              const b = s.bones[idx]
              return b ? b.data.name : `?${idx}`
            })
            console.log(`  Bone names:`, boneNames)
            // Count unique bones used
            const uniqueBones = [...new Set(boneNames)]
            console.log(`  Unique bones controlling mesh:`, uniqueBones)
          } else {
            console.log(`  Not a weighted mesh (type=${att.type})`)
            console.log(`  Available bone prop:`, att.bones ? 'bones[]=' + att.bones.length : 'none')
            console.log(`  Attachment keys:`, Object.getOwnPropertyNames(att).join(', '))
          }
        }
        console.log('Mesh weight inspect: _probeWeight()')
        // 7) 自动轮询
        window._probeAll = () => {
          const tests = [
            'mouth sX=3 sY=3', 'chin_control y=200', 'mouth_close sY=3',
            'chin y=100', 'jaw y=100', 'kuchi sY=3',
          ].filter(t => s.findBone(t.split(' ')[0]))
          let i = 0
          const next = () => {
            if (i >= tests.length) { console.log('%c=== DONE, reload to reset ===','font-weight:bold'); return }
            const [name, ...rest] = tests[i].split(' ')
            rest.forEach(part => {
              const [prop, val] = part.split('=')
              const b = s.findBone(name)
              if (b) b[prop] = parseFloat(val)
            })
            s.updateWorldTransform()
            console.log(`[${i+1}/${tests.length}] ${tests[i]}`)
            i++
            // Revert after 2.5s then next
            setTimeout(() => { s.findBone(tests[i-1].split(' ')[0]).y = 0; s.updateWorldTransform() }, 2500)
            setTimeout(next, 2800)
          }
          next()
        }
        console.log('Auto: _probeAll()')
      }
      window._probe[idolId]()
      console.log(`[PixiStageManager] Installed for "${idolId}" — _probe['${idolId}']()`)
    }
  }

  // ── Fade transitions ──

  /**
   * Fade a spine model in (alpha 0 → 1) over ~300ms.
   * Fades the wrapper so the entire model blends as one layer.
   */
  _fadeIn(spine) {
    const entry = Object.values(this.spineInstances).find(e => e.spine === spine)
    const target = entry?.wrapper || spine
    target.alpha = 0
    // 快速渐变，减少分层穿透的可见时间
    const STEP = 0.085
    const ticker = () => {
      target.alpha = Math.min(1, target.alpha + STEP)
      if (target.alpha >= 1) {
        this.app.ticker.remove(ticker)
      }
    }
    this.app.ticker.add(ticker)
  }

  /**
   * 多通道渲染淡出 — 使用 AlphaFilter 强制 Spine 先渲染为整张位图再统一淡出，
   * 彻底解决"X光透视"穿帮（身体配件在半透明时互相可见的问题）。
   */
  _fadeOutWrapper(wrapper) {
    if (!wrapper || wrapper.destroyed) return

    // 挂载 AlphaFilter，强制整个 Spine 先渲染到一张隐形画布再调透明度
    const alphaFilter = new PIXI.AlphaFilter(wrapper.alpha || 1.0)
    wrapper.filters = [alphaFilter]

    const STEP = 0.12  // 加快淡出 (~8帧)
    const ticker = () => {
      // 安全检测：淡出过程中如果 wrapper 被外部销毁，立刻终止 Ticker
      if (wrapper.destroyed) {
        this.app.ticker.remove(ticker)
        return
      }

      alphaFilter.alpha -= STEP

      if (alphaFilter.alpha <= 0) {
        this.app.ticker.remove(ticker)
        const parent = wrapper.parent
        if (parent) parent.removeChild(wrapper)
        wrapper.destroy({ children: true, textures: true })
      }
    }
    this.app.ticker.add(ticker)
  }

  /**
   * 按 idolId 查找 wrapper 并执行 AlphaFilter 淡出。
   * 先从管理器中移除记录，再淡出，防止快速切换时同 idolId 的新旧模型冲突。
   */
  _fadeOutAndDestroy(idolId) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const { spine, wrapper } = entry

    spine.customIsTalking = false
    delete this.spineInstances[idolId]

    this._fadeOutWrapper(wrapper || spine)
  }

  /**
   * Set facial expression via Track 1 animation, with original game engine flag control.
   *
   * SideM spine data includes `face_xxx` animations (e.g. `face_happy`, `face_angry`).
   *
   * @param {string} idolId
   * @param {string} faceName - e.g. "happy", "angry", "face_happy"
   * @param {object|boolean} [faceFlags] - Flags from original data, or boolean shouldBlink for backward compat.
   *   { anim_flag: '目'|'off', blush_flag: 'チーク'|'off', sweat_flag: '汗'|'off' }
   *
   * 原版调度模式：
   *   anim_flag='目'  → blink cover 150ms（句子开头自然过渡，原版有 0.1s 延迟对）
   *   anim_flag='off' → 瞬切，不做眨眼（句中情绪突变）
   *   blush_flag='チーク' → 保留脸红，否则强制隐藏 cheek_dye 插槽
   *   sweat_flag='汗'     → 保留汗滴，否则强制隐藏 swet 插槽
   */
  updateSpineFace(idolId, faceName, faceFlags) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry
    try {
      // Normalize: ensure faceName starts with "face_"
      const animName = faceName.startsWith('face_') ? faceName : `face_${faceName}`
      const allAnims = spine.state.data.skeletonData.animations.map(a => a.name)

      // ── 保存特效 flag 供每帧覆盖 ──
      if (faceFlags && typeof faceFlags === 'object') {
        spine._faceFlags = {
          anim_flag: faceFlags.anim_flag || '',
          blush_flag: faceFlags.blush_flag || '',
          sweat_flag: faceFlags.sweat_flag || '',
        }
      }

      if (allAnims.includes(animName)) {
        const trackEntry = spine.state.setAnimation(1, animName, true)
        if (trackEntry) {
          trackEntry.mixAttachmentThreshold = 0.0

          // ── 智能眨眼控制 ──
          // 目 → blink cover 150ms (句子开头自然过渡，闭眼掩盖切换痕迹)
          // off → 瞬切，不做眨眼 (句中情绪突变，不能等闭眼)
          // 无/未知 flag → 保守默认，做眨眼掩护
          if (faceFlags && typeof faceFlags === 'object' && faceFlags.anim_flag === 'off') {
            // anim_flag === 'off': 瞬时切换，不做眨眼
            spine._blinkCoverEndTime = 0
            trackEntry.mixDuration = 0.05
          } else if (faceFlags && typeof faceFlags === 'object' && faceFlags.anim_flag === '目') {
            // anim_flag === '目': 眨眼掩护 150ms
            spine._blinkCoverEndTime = performance.now() + 150
            trackEntry.mixDuration = 0
          } else {
            // 无 flags 或未知值: 安全默认，做眨眼掩护
            spine._blinkCoverEndTime = performance.now() + 150
            trackEntry.mixDuration = 0
          }
        }
      } else {
        // Fallback: clear Track 1 to show the default skeleton face
        console.warn(`[PixiStageManager] Face anim "${animName}" not found on "${entry.modelId}", clearing track`)
        spine.state.clearTrack(1)
      }
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to set face "${faceName}" on "${idolId}":`, err.message)
    }
  }

  /**
   * Animate spine.x to a target over ~300ms using requestAnimationFrame.
   * Cancels any previous tween on this spine. Designed for slot-layout transitions.
   */
  _tweenX(entry, targetX) {
    if (entry._tweenRaf) cancelAnimationFrame(entry._tweenRaf)
    const startX = entry.spine.x
    const dx = targetX - startX
    const duration = 280
    const t0 = performance.now()
    const tick = () => {
      const t = Math.min((performance.now() - t0) / duration, 1)
      // easeOutCubic
      const ease = 1 - Math.pow(1 - t, 3)
      entry.spine.x = startX + dx * ease
      if (t < 1) entry._tweenRaf = requestAnimationFrame(tick)
      else entry._tweenRaf = null
    }
    entry._tweenRaf = requestAnimationFrame(tick)
  }

  setSpineAlpha(idolId, alpha) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    entry.spine.alpha = alpha
  }

  bringSpineToTop(idolId) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry
    const parent = spine.parent
    if (parent) parent.setChildIndex(spine, parent.children.length - 1)
  }

  /**
   * Play an animation on Track 0 (body) with automatic loop chaining.
   *
   * Convention (from SideM spine data):
   *   - Animations with a `_loop` suffix are looping (e.g. `wait_loop`, `angry_loop`).
   *   - Most emotional actions have a paired loop: `angry` → `angry_loop`.
   *   - Single-shot animations (e.g. `neck_yes`, `neck_no`) have no `_loop` variant
   *     and should fall back to `wait_loop`.
   */
  playSpineAnim(idolId, animName, skipChain = false) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry
    try {
      const allAnims = spine.state.data.skeletonData.animations.map(a => a.name)

      if (animName.endsWith('_loop')) {
        // Already a loop animation — play directly
        spine.state.setAnimation(0, animName, true)
      } else if (skipChain) {
        // Single-shot, no auto-chain — used when step has timeline
        spine.state.setAnimation(0, animName, false)
      } else {
        // Single-shot animation: play once, then chain the _loop variant or wait_loop
        const loopVariant = animName + '_loop'
        const hasLoop = allAnims.includes(loopVariant)
        const fallback = hasLoop ? loopVariant : 'wait_loop'

        spine.state.setAnimation(0, animName, false)
        if (allAnims.includes(fallback)) {
          spine.state.addAnimation(0, fallback, true, 0)
        }
      }
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to play anim "${animName}" on "${idolId}":`, err.message)
    }
  }

  /**
   * Instant body animation switch — no crossfade morph (for timeline events).
   * The animation starts from frame 0 at native speed, avoiding the "sliding"
   * caused by linear interpolation between two different poses.
   */
  switchSpineAnim(idolId, animName) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry
    try {
      const allAnims = spine.state.data.skeletonData.animations.map(a => a.name)
      if (!allAnims.includes(animName)) {
        console.warn(`[PixiStageManager] Anim "${animName}" not found on "${entry.modelId}"`)
        return
      }
      const isLoop = animName.endsWith('_loop')
      const savedMix = spine.stateData.defaultMix
      spine.stateData.defaultMix = 0.3  // 300ms — smooth timeline anim transitions
      spine.state.setAnimation(0, animName, isLoop)
      spine.stateData.defaultMix = savedMix
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to switch anim "${animName}" on "${idolId}":`, err.message)
    }
  }

  /**
   * Remove a spine model with a fade-out transition.
   * The model fades out over ~12 frames then destroys itself.
   */
  removeSpine(idolId) {
    this._fadeOutAndDestroy(idolId)
  }

  clearAllSpines() {
    // 先遍历收集所有 wrapper，从 Map 中删除记录，再逐一开始淡出。
    // 防止快速跳过时：同名 idolId 的新模型已加载，旧模型的 Ticker 仍在运行，
    // 导致旧 wrapper 意外毁掉新 spine 或者变成无法销毁的"孤儿子节点"。
    const wrappers = []
    for (const idolId of Object.keys(this.spineInstances)) {
      const entry = this.spineInstances[idolId]
      delete this.spineInstances[idolId]
      if (entry) {
        if (entry.spine) entry.spine.customIsTalking = false
        wrappers.push(entry.wrapper || entry.spine)
      }
    }
    for (const wrapper of wrappers) {
      if (wrapper) this._fadeOutWrapper(wrapper)
    }
  }

  destroy() {
    this._dragSpineId = null
    if (this._globalMoveHandler && this.app) {
      this.app.stage.off('globalpointermove', this._globalMoveHandler)
      this._globalMoveHandler = null
    }
    this._resizeObserver?.disconnect()
    this._resizeObserver = null
    this.clearAllSpines()
    this.clearBackground()
    if (this.app) {
      this.app.destroy(true)
      this.app = null
    }
  }
}
