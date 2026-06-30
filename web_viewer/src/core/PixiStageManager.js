/**
 * PixiStageManager 闂?manages the PixiJS canvas/renderer and stage graph.
 *
 * Spine loading strategy (SideM-specific):
 *   DO NOT use PIXI.Assets / @pixi-spine/loader-3.8 for Spine loading.
 *   The loader doesn't handle SideM's Unity-exported Spine 3.8 assets correctly.
 *
 *   Instead, manually load everything like the SSR_Portraits project:
 *   1. Fetch .atlas 闂?text (skip Unity binary header)
 *   2. Fetch .skel 闂?ArrayBuffer
 *   3. Load .png 闂?PIXI.Texture with ALPHA_MODES.PMA forced
 *   4. Construct TextureAtlas with a callback that maps texture filenames
 *   5. AtlasAttachmentLoader + SkeletonBinary 闂?SkeletonData
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
import { getBgUrl, getMouthSettingUrl, getSpineAtlasUrl, getSpineSkelUrl } from '../utils/AssetResolver.js'
import { easeOutCubic, runRafTween } from './rafTween.js'
import { tweenOverlayFade, tweenOverlayPunch, tweenOverlaySlide } from './transitionTweens.js'
import { loadAndCreateSpine } from './spineSpawnPipeline.js'
import { finalizeSpawnedSpine } from './spineSpawnFinalize.js'

const ORIGINAL_LIP_OPEN_THRESHOLD = 0.04
const ORIGINAL_LIP_SCALE_MIN = 1.0
const FALLBACK_LIP_OPEN_SCALE = 3.0
const ADULT_BASE_SCALE = 0.26
const SUB_BASE_SCALE = 0.235

// Per-character default scale calibration.
// Do not infer this directly from idol_zoom counts: many scenarios apply
// idol_zoom as scene direction, and it must not be multiplied a second time.
const CHARACTER_BASE_SCALE_MULTIPLIER = {
  '037jir': 1.3,
}

// livecharacter bodyType is a broad body class, not an ADV portrait scale.
// Keep this subtle; native rig art and idolothersetting carry most of the
// visible height/position differences.
const BODY_TYPE_SCALE_MULTIPLIER = {
  1: 1.00,
  2: 1.025,
  3: 0.975,
  4: 0.94,
  5: 0.90,
}

// Model-level visual calibration is only for proven outliers. Keep empty by
// default; original bodyType + otherSetting should do the general work.
const MODEL_BASE_SCALE_MULTIPLIER = {}
const DEFAULT_ADULT_SCALE = ADULT_BASE_SCALE
const DEFAULT_SUB_SCALE = SUB_BASE_SCALE

export class PixiStageManager {
  constructor(containerEl, options = {}) {
    this.container = containerEl
    this.width = options.width || containerEl.clientWidth || 1280
    this.height = options.height || containerEl.clientHeight || 720

    this.app = null
    this.bgSprite = null
    this.currentBgId = null
    this.spineInstances = {}   // { idolId: { spine: Spine, modelId: string, marker: Graphics } }
    this._spawnTokens = {}
    this._pendingTalking = {}
    this._debugMode = false

    // Camera zoom/pan state
    this._cameraZoom = null      // {zoom, offsetX, offsetY, duration} from step state
    this._cameraTweenRaf = null  // rAF handle for zoom animation
  // Screen fade overlay
    this._fadeOverlay = null     // PIXI.Sprite for screen transitions
    this._screenFadeToken = 0
    this._slideOverlay = null
    this._screenSlideToken = 0
    this._effectOverlay = null
    this._screenEffectToken = 0

    // Visual filters
    this._grayFilter = null     // PIXI.ColorMatrixFilter for grayscale
    this._blurFilter = null     // PIXI.BlurFilter for bg DOF
    this._bgOverlaySprite = null  // color overlay sprite for bg_color
    this._bgBlurAmount = 0
    this._bgBlurTweenRaf = null
    this._bgColorTweenRaf = null
    this._bgOverlayColor = 0xFFFFFF
    this._spineColorTweens = {}
    this._bgEffectEntries = {}
    this._cameraflareTextures = null

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

    // Layer structure: bgContainer (bottom) 闂?spineContainer 闂?fadeOverlay (top)
    this.bgContainer = new PIXI.Container()
    this.bgEffectContainer = new PIXI.Container()
    this.spineContainer = new PIXI.Container()
    this.app.stage.addChild(this.bgContainer)
    this.app.stage.addChild(this.bgEffectContainer)
    this.app.stage.addChild(this.spineContainer)
    this._debugOverlay = new PIXI.Container()
    this._debugOverlay.eventMode = 'none'
    this.app.stage.addChild(this._debugOverlay)

    // Setup screen fade overlay (fullscreen, invisible by default)
    this._fadeOverlay = new PIXI.Sprite(PIXI.Texture.WHITE)
    this._fadeOverlay.width = this.width
    this._fadeOverlay.height = this.height
    this._fadeOverlay.alpha = 0
    this._fadeOverlay.visible = false
    this._fadeOverlay.eventMode = 'none'
    this.app.stage.addChild(this._fadeOverlay)
    this._slideOverlay = new PIXI.Sprite(PIXI.Texture.WHITE)
    this._slideOverlay.width = this.width
    this._slideOverlay.height = this.height
    this._slideOverlay.alpha = 1
    this._slideOverlay.visible = false
    this._slideOverlay.eventMode = 'none'
    this.app.stage.addChild(this._slideOverlay)
    this._effectOverlay = new PIXI.Sprite(PIXI.Texture.WHITE)
    this._effectOverlay.width = this.width
    this._effectOverlay.height = this.height
    this._effectOverlay.alpha = 0
    this._effectOverlay.visible = false
    this._effectOverlay.eventMode = 'none'
    this.app.stage.addChild(this._effectOverlay)
    this._debugMarkerUpdater = () => {
      for (const entry of Object.values(this.spineInstances)) {
        const marker = entry?.marker
        if (!marker || marker.destroyed) continue
        marker.visible = this._debugMode
        const global = entry.spine?.toGlobal
          ? entry.spine.toGlobal(new PIXI.Point(0, 0))
          : { x: entry.spine?.x || 0, y: entry.spine?.y || 0 }
        marker.x = global.x
        marker.y = global.y
      }
    }
    this.app.ticker.add(this._debugMarkerUpdater)
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
          if (this._fadeOverlay) {
            this._fadeOverlay.width = width
            this._fadeOverlay.height = height
          }
          if (this._slideOverlay) {
            this._slideOverlay.width = width
            this._slideOverlay.height = height
          }
          if (this._effectOverlay) {
            this._effectOverlay.width = width
            this._effectOverlay.height = height
          }
          this._resizeBgEffects()
          // Spines stay at their current positions on resize (user may have dragged them)
        }
      }
    })
    this._resizeObserver.observe(this.container)
  }
  // Debug mode

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

  getSpineRuntimeSnapshot(idolId) {
    const entry = this.spineInstances[idolId]
    if (!entry?.spine) return null
    const spine = entry.spine
    let bounds = null
    try {
      bounds = spine.getBounds()
    } catch (_) {
      bounds = null
    }
    let localBounds = null
    try {
      localBounds = spine.getLocalBounds()
    } catch (_) {
      localBounds = null
    }
    const skeletonLocalBounds = this.getSkeletonLocalBounds(spine)
    const stageScaleX = this.spineContainer?.scale?.x || 1
    const stageScaleY = this.spineContainer?.scale?.y || 1
    const stageX = this.spineContainer?.x || 0
    const stageY = this.spineContainer?.y || 0
    const prefabMeta = entry.prefabMeta || null
    const tracks = Array.isArray(spine.state?.tracks)
      ? spine.state.tracks.map((track, index) => track ? {
        index,
        animation: track.animation?.name || null,
        trackTime: track.trackTime ?? null,
        animationLast: track.animationLast ?? null,
        mixTime: track.mixTime ?? null,
        mixDuration: track.mixDuration ?? null,
        loop: !!track.loop,
        alpha: track.alpha ?? null,
      } : null)
      : null
    const positioning = entry.positioning || {}
    const targetY = positioning.targetY ?? entry.targetVisualBottom ?? null
    const baselineBottomOffset = positioning.baselineBottomOffset ?? ((entry.baselineSkeletonLocalBounds || localBounds) ? ((entry.baselineSkeletonLocalBounds || localBounds).bottom * spine.scale.x) : null)
    const currentBottomOffset = positioning.currentBottomOffset ?? ((skeletonLocalBounds || localBounds) ? ((skeletonLocalBounds || localBounds).bottom * spine.scale.x) : null)
    const rootOffset = positioning.rootOffset ?? baselineBottomOffset
    const finalRootY = positioning.finalRootY ?? spine.y
    const offsetStrengthUsed = positioning.offsetStrengthUsed ?? null
    const pivotY = positioning.pivotY ?? prefabMeta?.pivotY ?? prefabMeta?.derived?.pivotY ?? null
    const isPivotOutlier = !!positioning.isPivotOutlier
    const baselineBottomError = targetY != null && baselineBottomOffset != null && finalRootY != null
      ? ((finalRootY + baselineBottomOffset) - targetY)
      : null
    const currentBottomError = targetY != null && currentBottomOffset != null && finalRootY != null
      ? ((finalRootY + currentBottomOffset) - targetY)
      : null
    return {
      idolId,
      modelId: entry.modelId,
      root: {
        x: spine.x,
        y: spine.y,
        scaleX: spine.scale.x,
        scaleY: spine.scale.y,
      },
      scale: {
        base: spine._baseScale || null,
        current: spine.scale.x,
        bodyTypeScale: entry.scaleConfig?.bodyTypeScale ?? null,
        charaScale: entry.scaleConfig?.charaScale ?? null,
        modelScale: entry.scaleConfig?.modelScale ?? null,
        visualHeightReference: entry.scaleConfig?.visualHeightReference ?? null,
        visualHeightStrength: entry.scaleConfig?.visualHeightStrength ?? null,
        visualHeightScale: entry.scaleConfig?.visualHeightScale ?? null,
        bodyScaleEnabled: !!entry.scaleConfig?.bodyScaleEnabled,
        fitMode: entry.scaleConfig?.fitMode || 'current',
      },
      stage: {
        x: stageX,
        y: stageY,
        scaleX: stageScaleX,
        scaleY: stageScaleY,
      },
      bounds: bounds ? {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        top: bounds.y,
        bottom: bounds.y + bounds.height,
        left: bounds.x,
        right: bounds.x + bounds.width,
        centerY: bounds.y + bounds.height / 2,
        rootToTop: bounds.y - spine.y,
        rootToBottom: bounds.y + bounds.height - spine.y,
      } : null,
      displayLocalBounds: localBounds ? {
        x: localBounds.x,
        y: localBounds.y,
        width: localBounds.width,
        height: localBounds.height,
        top: localBounds.y,
        bottom: localBounds.y + localBounds.height,
        centerY: localBounds.y + localBounds.height / 2,
      } : null,
      localBounds: localBounds ? {
        x: localBounds.x,
        y: localBounds.y,
        width: localBounds.width,
        height: localBounds.height,
        top: localBounds.y,
        bottom: localBounds.y + localBounds.height,
        centerY: localBounds.y + localBounds.height / 2,
      } : null,
      skeletonLocalBounds: skeletonLocalBounds ? {
        x: skeletonLocalBounds.x,
        y: skeletonLocalBounds.y,
        width: skeletonLocalBounds.width,
        height: skeletonLocalBounds.height,
        top: skeletonLocalBounds.top,
        bottom: skeletonLocalBounds.bottom,
        centerY: skeletonLocalBounds.centerY,
      } : null,
      baselineSkeletonLocalBounds: entry.baselineSkeletonLocalBounds ? {
        x: entry.baselineSkeletonLocalBounds.x,
        y: entry.baselineSkeletonLocalBounds.y,
        width: entry.baselineSkeletonLocalBounds.width,
        height: entry.baselineSkeletonLocalBounds.height,
        top: entry.baselineSkeletonLocalBounds.top,
        bottom: entry.baselineSkeletonLocalBounds.bottom,
        centerY: entry.baselineSkeletonLocalBounds.centerY,
      } : null,
      baseline: {
        capturedAt: entry.baselineCapturedAt || null,
        captureReason: entry.baselineCaptureReason || null,
        bodyAnim: entry.baselineBodyAnim || null,
        faceAnim: entry.baselineFaceAnim || null,
        tracks: entry.baselineTracks || null,
      },
      skeleton: {
        width: spine.skeleton?.data?.width || null,
        height: spine.skeleton?.data?.height || null,
      },
      prefabMeta: prefabMeta ? {
        prefabPositionY: prefabMeta?.derived?.prefabPositionY ?? null,
        estimatedRectBottomY: prefabMeta?.derived?.estimatedRectBottomY ?? null,
        pivotY: prefabMeta?.derived?.pivotY ?? null,
        sizeDeltaY: prefabMeta?.derived?.sizeDeltaY ?? null,
        rectFit: spine._prefabRectFit || null,
      } : null,
      positioning: {
        positionMode: entry.positionMode || null,
        targetY,
        targetVisualBottom: targetY,
        baselineBottomOffset,
        currentBottomOffset,
        rootOffset,
        offsetStrengthUsed,
        pivotY,
        isPivotOutlier,
        finalRootY,
        baselineBottomError,
        currentBottomError,
      },
      prefabMetrics: entry.prefabMetrics || null,
      tracks,
    }
  }

  getSkeletonLocalBounds(spine) {
    const skeleton = spine?.skeleton
    if (!skeleton) return null
    try {
      skeleton.updateWorldTransform?.()
    } catch (_) {}
    const offset = { x: 0, y: 0 }
    const size = { x: 0, y: 0 }
    try {
      const result = typeof skeleton.getBounds === 'function'
        ? skeleton.getBounds(offset, size, [])
        : null
      if (result && Number.isFinite(result.x) && Number.isFinite(result.width) && Number.isFinite(result.height)) {
        return {
          x: result.x,
          y: result.y,
          width: result.width,
          height: result.height,
          top: result.y,
          bottom: result.y + result.height,
          centerY: result.y + result.height / 2,
        }
      }
      if (Number.isFinite(offset.x) && Number.isFinite(offset.y) && Number.isFinite(size.x) && Number.isFinite(size.y)) {
        return {
          x: offset.x,
          y: offset.y,
          width: size.x,
          height: size.y,
          top: offset.y,
          bottom: offset.y + size.y,
          centerY: offset.y + size.y / 2,
        }
      }
    } catch (_) {}
    try {
      const local = typeof spine?.getLocalBounds === 'function' ? spine.getLocalBounds() : null
      if (local && Number.isFinite(local.x) && Number.isFinite(local.width) && Number.isFinite(local.height)) {
        return {
          x: local.x,
          y: local.y,
          width: local.width,
          height: local.height,
          top: local.y,
          bottom: local.y + local.height,
          centerY: local.y + local.height / 2,
        }
      }
    } catch (_) {}
    try {
      const bounds = typeof spine?.getBounds === 'function' ? spine.getBounds() : null
      if (bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.width) && Number.isFinite(bounds.height)) {
        return {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          top: bounds.y,
          bottom: bounds.y + bounds.height,
          centerY: bounds.y + bounds.height / 2,
        }
      }
    } catch (_) {}
    return null
  }

  changeSpineScale(idolId, delta) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const s = entry.spine.scale.x
    const newScale = Math.max(0.001, Math.min(100, s + delta))
    entry.spine.scale.set(newScale)
    this._emitSpineState(idolId)
  }
  // Background

  /**
   * cover 婵犵數濮烽弫鍛婃叏閻戝鈧倿鎸婃竟鈺嬬秮瀹曘劑寮堕幋婵堚偓顓烆渻閵堝懐绠伴柣妤€妫濋幃鐐哄垂椤愮姳绨婚梺鐟版惈濡绂嶉崜褏纾奸柛鎾楀棙顎楅梺鍛娚戦崕鎶藉煡婢舵劖鍋ㄧ紒瀣硶閸旓箑顪冮妶鍡楃瑨閻庢凹鍙冮幃锟犳偄閸忚偐鍘棅顐㈡搐閿曘儱鈻嶉崨瀛樼厽闊洦娲栭埢鍫ユ煛鐏炲墽娲撮柟顔哄€栭幏鍛存⒐閹邦剚鐎抽梻鍌欐祰椤曟牠宕归弶妫垫椽顢橀～顑藉亾娴ｈ倽鏃堝川椤撶媭妲规俊鐐€栫敮濠囨倿閿曞倹鍋熸い鎰剁悼缁♀偓濠电偛鐗嗛悘婵嬪几閻旀悶浜滄い鎾跺仧婢ф稓绱掗崒姘毙фい銏☆殜瀹曠喖顢曢妶搴℃櫍闂傚倷鑳堕…鍫㈡崲閹版澘瑙﹂悗锝庡枛閻鐓崶銊р姇闁绘挶鍎茬换婵嬫濞戞瑯妫″銈冨劤閸嬨倝寮诲澶嬬叆閻庯綆浜為鍌滅磽娴ｄ粙鍝洪柟鐟版搐閻ｇ兘骞掗幋顓熷兊闂佺绻愰惃鐑藉几閸涘瓨鐓熼幖娣焺閸熷繘鏌涢悩铏磳鐎规洘绻堥獮瀣晜閹呫偊闂備胶纭堕崜婵嬪礄閻熼偊鐎舵い蹇撴绾句粙鏌涚仦鐐殤閺嶏繝姊虹紒姗嗘畷妞ゃ劌鐗撻獮鎴﹀閻橆偅鏂€闂佹悶鍎弲婵嬵敊閺囥垺鈷掑ù锝堫嚃閸庛儵鏌涢妸褍顣肩紒鍌氱У閵堬綁宕橀埡鍐ㄥ箥濠碘槅鍋婇。锕傛嚄閸泙鍥晝閸屾稓鍘搁梺鍛婄矊閸熸壆绮旈鑺ュ弿濠电姴鍟妵婵囦繆椤愩垹鏆ｉ柛鈺嬬節瀹曟﹢顢撻銈囩М婵﹨娅ｇ槐鎺懳熺拠鑼暡婵＄偑鍊х粻鎴濈暦椤掆偓瀹撳嫰姊鸿ぐ鎺戜喊闁稿繑锕㈠銊︾鐎ｎ偆鍘遍梺闈涱槹閸ㄧ敻骞婇幇鐗堝仒妞ゆ梻鏅弧鈧┑鐐茬墕閻忔繈寮搁悢鍏肩叆闁哄洦顨嗗▍濠勨偓瑙勬礃閸ㄥ灝鐣烽崡鐐╂瀻闁瑰濮烽崢顖炴⒒娴ｈ鍋犻柛搴㈡そ瀹曟粌顫濈捄铏癸紱闂佺偨鍎寸粔顔裤亹閹烘挻娅滄繝銏ｅ煐钃辨い銉︾墪椤啴濡惰箛姘煎悈缂備胶濮甸幑鍥ь嚕鐠囨祴妲堥柕蹇曞閳哄懏鐓忓璇″灠閹峰宕€ｎ喗鈷掑ù锝堝Г閵嗗啰绱掗埀顒佹媴閾忓湱鐓嬮梺鍦檸閸犳宕戦埡鍌滅瘈闂傚牊渚楅崕蹇涙煟閹烘垹浠涢柕鍥у楠炴帡骞嬪┑鎰偅缂傚倷璁查崑鎾愁熆鐠虹儤婀伴柛鐘冲姍閺岋繝宕掑┑鍥┿€婇梺鍝勬４缁犳捇寮婚弴鐔风窞婵炴垯鍨洪宥夋⒑缁嬫寧鎹ｉ柛鐘崇墵瀵濡搁妷銏☆潔濠碘槅鍨拃锔界妤ｅ啯鈷戠紓浣诡焽閹冲嫭銇勯妸銉︻棤闁瑰箍鍨归埥澶愬閻樻鍚呴梻浣虹帛閸旀洟鎮洪妸鈺佺？閹兼番鍔嶉埛鎴︽煕濞戞ǚ濮囨い蹇撴缁€濠傗攽閻樺弶鎼愰柡鍕╁劦閺?   */
  _applyBgCover(sprite) {
    if (!sprite?.texture) return
    // 濠电姷鏁告慨鎾儉婢舵劕绾ч幖瀛樻尭娴滈箖鏌￠崶銉ョ仼缁炬儳婀遍幉鎼佹偋閸繄鐟查梺鍝勬媼娴滎亜顫忛搹瑙勫珰闁告瑥顦弨顓烆渻閵堝骸浜滄い锔藉閹广垹鈽夊▎鎴犵槇闂佹悶鍎弲娑氱矈閿曗偓閳规垿顢欐慨鎰捕闂佺顑嗛幐濠氥€冮妷鈺傚€风€瑰壊鍠栭崜鍫曟⒑鐠団€虫灍闁荤啿鏅犻悰顕€骞樼拠鑼唹濡炪倖鍔х徊浠嬪传濞差亝鐓涚€光偓鐎ｎ剛蓱闂佽鍨卞Λ鍐春閸曨垰绀冩い鎾跺閺€銊╂⒒閸屾瑨鍏屾い銏狅工閳诲秹寮撮姀鐘殿唶闂佸綊妫跨粈渚€鎮″┑鍫氬亾楠炲灝鍔氭い锔诲灣缁鎼归锛勭畾闂侀潧鐗嗙€氼噣宕濆鍡欑闁告侗鍠氭晶鐢告煛瀹€瀣К缂佺姵鐩鎾倷閻楀牆鐓曢梻鍌欒兌閸庣敻宕滃┑鍠盯宕橀妸褎娈惧銈嗙墬閸戝綊宕ョ€ｎ亶鐔嗛悹铏瑰皑閸旂喐銇勯弮鈧崝娆撳蓟閳╁啫绶炲┑鐘插椤も偓闂備胶顭堢€涒晜绻涙繝鍥ラ柛娑欐儗閺佸棝鏌涢弴銊ュ闁告ü绮欏娲棘閵夛附鐝旈梺鍝ュ櫏閸嬪﹪骞冨鈧俊鐤槼闁稿鐗楃换娑㈠幢濡闉嶉梺缁樻尰閻╊垶寮诲☉銏犵疀闁宠桨绀侀‖澶愭倵閻熺増鍟炵紒璇插暣婵＄敻宕熼浣稿妳濠碘槅鍨靛銊︾珶閺囥垺鈷掗柛灞捐壘閳ь剚鎮傚畷鎰板箹娴ｅ摜锛欓梺褰掓？缁€浣虹不閻樿绠规繛锝庡墮閻掔儤绻涢崼婊呯煓闁绘搩鍋婂畷鍫曞Ω閿旂虎妲版俊鐐€ら崑鍛哄Ο鍏煎床婵犻潧顑嗛ˉ鍫熺箾閹寸偟鎳呴柛鏃€鎮傚铏圭磼濡儵鎷婚梺鍐插槻閻楁挸顕ｉ锕€纾奸柣鎰嚟閸橀亶姊洪崫鍕偍闁告柨鏈弲鍫曨敋閳ь剟寮诲鍫闂佸憡鎸婚悷鈺呭灳閿曞倹鍊婚柦妯侯槺閻ｅ搫鈹戦濮愪粶闁稿鎹囬弻鐔碱敊閻ｅ本鍣伴悗瑙勬穿缁叉儳顕ラ崟顒傜瘈闁告劕褰為幋鐑芥⒒閸屾艾鈧兘鎳楅崼鏇炲偍鐟滄棃骞冨Ο渚僵閻犲搫鎼悗顓㈡偡濠婂懎顣奸悽顖涘笧缁鎮㈤梹鎰畾闂侀潧鐗嗙€氼噣宕濆鍛斀妞ゆ牗鍑归崵鐔虹磼鏉堛劌绗ч柍褜鍓ㄧ紞鍡涘储閻ｅ本鍏滈柛顐ｆ礃閻?
    sprite.height = this.height
    sprite.scale.x = sprite.scale.y
    // 闂傚倸鍊搁崐鎼佸磹瀹勬噴褰掑炊椤掆偓杩濋梺閫炲苯澧撮柡灞剧〒閳ь剨缍嗛崑鍛暦瀹€鍕厸鐎光偓閳ь剟宕伴弽顓溾偓浣糕槈閵忕姴鑰块梺鍝勬川閸ｃ儱螣閸屾埃鏀?2% 闂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ磸閳ь兛鐒︾换婵嬪磼濡や胶浜欐繝鐢靛仦閸垶宕瑰ú顏勭柧婵犻潧顑嗛悡蹇擃熆鐠虹儤顥炴繛鍛噽缁辨帡鎮埀顒勫闯閿濆钃熼柡鍥ュ灩闁卞洦绻濋崹顐㈠閺佸牓姊绘担鐟扳枙闁衡偓闁秴绀夐柡宥庡亝瀹曞弶绻濋棃娑欏窛缂佲檧鍋撻梻浣侯焾閺堫剚绗熷Δ鈧灋闁靛牆顦伴埛鎴犵磽娴ｈ鐒界紒鐘虫尭椤儻顦叉繛鏉戝槻鍗遍柟鐗堟緲缁犲鎮归崶顏勭毢闁挎稒绮岄埞鎴︽倷閺夋垹浼囨繛瀛樼矤閸撶喎鐣峰┑瀣€婚柤鎭掑劗閹疯櫣绱掔紒銏犲箹闁瑰啿娴峰Σ鎰版晝閸屾稓鍘卞┑掳鍊撶粈渚€鍩㈤弴鐕佹闁绘劖褰冮弳锝団偓瑙勬礈椤牐鐏冮梺閫炲苯澧寸€规洖缍婂畷鎺戔槈閺嶏妇鐩庨梻浣筋潐婢瑰寮插☉銏″€堕梺顒€绉甸悡鏇熸叏濮楀棗澧柍褜鍓欓悘婵嬶綖韫囨拋娲敂閸曨偆鐛╁┑鐘垫暩婵挳宕愮紒妯碱浄闁圭虎鍠楅埛鎴︽煕閿旇骞愰柟鍑ょ節閺屾稓鈧綆浜烽煬顒侇殽閻愬弶顥㈢€规洖銈告俊鐑藉Ψ閵夈劉鍋撻崹顔规斀闁绘劖娼欓悘锕傛煠閻熸澘鈷旂紒顔硷躬閺佸啴宕掑☉鎺撳闂備礁鎲＄换鍌溾偓姘煎幖椤斿繐鈹戠€ｎ偆鍘遍柟鍏肩暘閸ㄨ鎱ㄩ崶顒佹嚉?
    sprite.scale.x *= 1.02
    sprite.scale.y *= 1.02
    sprite.anchor.set(0, 0)
    // 闂傚倸鍊峰ù鍥敋瑜忛埀顒佺▓閺呯娀銆佸▎鎾冲唨妞ゆ挾鍋熼悰銉╂⒑閸濆嫮鈻夐柛妯垮亹缁崵鎲撮崟鈺€绨婚梺瑙勬緲婢у酣鎮鹃柆宥嗙厸闁告洍鏅涢崝婊兦庨崶褝韬┑鈥崇埣瀹曘劑顢欓崗纰变哗闂傚倷绀侀幖顐︻敄閸曨厽顐芥慨妯挎硾缁犳牗淇婇妶鍌氫壕闂佸疇妫勯ˇ顖炲煝瀹ュ鎯炴い鎰╁灮娴犳挳姊哄畷鍥╁笡闁圭懓娲ら悾閿嬬附缁嬪灝宓嗛梺缁樻煥閹碱偊鐛崼銉︾厽閹艰揪绱曢悾顓㈡煕鎼淬劋鎲炬鐐诧躬楠炲洭顢欓崣銉х憹闁诲氦顫夊ú鏍洪妸褍顥氬┑鍌氭啞閻撳啰鎲稿鍫濈婵炲棙鎸婚崑鈺傜節闂堟侗鍎忕紒鈧€ｎ偁浜滈柟鏉跨埣濡绢噣鏌￠崱妤佸殗婵﹦绮幏鍛村传閵夘灝銊╂⒑缁嬫鍎忛柨鏇ㄤ簻閻ｇ兘濮€鎺抽崑鍛存煕閹扳晛濡奸柣搴幗缁绘繈妫冨☉妯峰亾閹间礁绠熼柨鐔哄У閸嬪倿鏌曟径娑橆洭缂佺娀绠栭弻鐔衡偓鐢殿焾閸撻亶鏌ｉ幒宥囩煓闁哄矉缍侀獮鎺楀箣閻愬弶娈樺┑鐑囩到濞层倝鏁冮鍫濈疇闁绘顒茬槐锝嗙節闂堟稒顥炴い鏂垮娣囧﹪鎮欓鍕ㄥ亾閵堝纾诲〒姘ｅ亾鐎规洖缍婇幊鐐哄Ψ閿曗偓瀵潡姊洪柅鐐茶嫰婢ф挳鏌＄仦鐣屝ч柛鈹惧墲閹峰懘宕ㄦ繝鍐惧敳闂佽崵鍋炵喊宥夋晝閵忕媭娼栧┑鐘宠壘绾惧吋鎱ㄥ鍡楀幋闁稿鎹囬幃鐣岀矙鐠侯煉绱遍梻浣筋潐閸庢娊顢氶鐘插К闁逞屽墯缁绘繈鎮介棃娴躲垽鏌涙繝鍌滅Ш鐎规洖鍟跨叅妞ゅ繐鎳愰崢浠嬫⒑閹稿海绠撴い锔诲櫍楠炲銈ｉ崘鈺冨幐闁诲繒鍋涙晶浠嬪煡婢舵劖鎳氶柡宥庡幗閻撳啰鎲稿鍫濈闁绘梻鍘ч弸渚€鏌涢幇闈涙灈閸ュ瓨绻濋姀锝嗙【闁挎洩绠撻弫宥夋偄鐏忎焦鏂€濡炪倖姊婚悺鏃堟倿閹屾富閻庢稒蓱閸婃劙鏌ㄥ┑鍫濅槐鐎殿喗鎸虫慨鈧柨娑樺楠炴绻濈喊妯活潑闁搞劋鍗抽幃妯衡攽閸噥娼熼梺鎸庢礀閸婂綊鎮￠悢鍏肩厵闁绘垶锚閻撯偓闂佸憡姊婚崰鎾舵?    sprite.x = Math.round((this.width - sprite.width) / 2)
    sprite.y = 0
  }

  async setBackground(bgId, transition = null) {
    if (bgId === this.currentBgId) return
    this.currentBgId = bgId

    const oldSprite = this.bgSprite
    try {
      const url = getBgUrl(bgId)
      const texture = await this._loadTextureFromUrl(url)
      const newSprite = new PIXI.Sprite(texture)
      this._applyBgCover(newSprite)
      newSprite.alpha = 0
      this.bgContainer.addChild(newSprite)
      this.bgSprite = newSprite

      const delayMs = Math.max(0, Number(transition?.delay || 0)) * 1000
      const durationMs = Math.max(0.01, Number(transition?.duration || 0.5)) * 1000
      const start = performance.now()
      const tickerFn = () => {
        const elapsed = performance.now() - start
        if (elapsed < delayMs) return
        const t = Math.min((elapsed - delayMs) / durationMs, 1)
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
  // Visual Filters

  /**
   * Apply camera color filter to the entire stage.
   * @param {string|null} filter - 'gray', 'sepia_light', or null to clear.
   */
  setCameraFilter(filter) {
    if (filter === 'gray') {
      if (!this._grayFilter) {
        this._grayFilter = new PIXI.ColorMatrixFilter()
        this._grayFilter.padding = 0
      }
      this._grayFilter.matrix = [
        0.58, 0.26, 0.08, 0, 0,
        0.12, 0.76, 0.08, 0, 0,
        0.08, 0.20, 0.58, 0, 0,
        0,    0,    0,    1, 0,
      ]
      this.app.stage.filters = [this._grayFilter]
    } else if (filter === 'sepia_light') {
      if (!this._grayFilter) {
        this._grayFilter = new PIXI.ColorMatrixFilter()
        this._grayFilter.padding = 0
      }
      // Light warm archive tone: keep enough saturation that costume colors remain readable.
      this._grayFilter.matrix = [
        0.90, 0.12, 0.02, 0, 0,
        0.06, 0.94, 0.02, 0, 0,
        0.03, 0.08, 0.78, 0, 0,
        0,    0,    0,    1, 0,
      ]
      this.app.stage.filters = [this._grayFilter]
    } else {
      this.app.stage.filters = null
    }
  }

  /**
   * Apply blur to the background sprite (image_bg_dof).
   */
  setBgBlur(amount, duration = 0, delay = 0) {
    const target = Math.max(0, Number(amount || 0))
    const durationMs = Math.max(0, Number(duration || 0)) * 1000
    const delayMs = Math.max(0, Number(delay || 0)) * 1000
    this._bgBlurTween?.cancel?.()
    const apply = (value) => {
      this._bgBlurAmount = value
      if (value > 0.01) {
        this._ensureBgBlurFilter()
        this._blurFilter.blur = value
      } else {
        this._bgBlurAmount = 0
        this.clearBgBlur()
      }
    }
    if (durationMs > 0 || delayMs > 0) {
      this._bgBlurTween = runRafTween({
        durationMs,
        delayMs,
        startValue: this._bgBlurAmount || 0,
        endValue: target,
        ease: easeOutCubic,
        onUpdate: apply,
      })
    } else {
      apply(target)
    }
  }

  _ensureBgBlurFilter() {
    if (!this._blurFilter) {
      this._blurFilter = new PIXI.BlurFilter()
      this._blurFilter.quality = 4
      this._blurFilter.resolution = this.app.renderer.resolution
      this._blurFilter.padding = 0
    }
    if (this.bgSprite) {
      this.bgSprite.filters = this.bgSprite.filters || []
      if (!this.bgSprite.filters.includes(this._blurFilter)) {
        this.bgSprite.filters.push(this._blurFilter)
      }
    }
  }

  setBgBlurInstant(amount) {
    const value = Math.max(0, Number(amount || 0))
    if (value > 0) {
      if (!this._blurFilter) {
        this._blurFilter = new PIXI.BlurFilter()
        this._blurFilter.quality = 4
        this._blurFilter.resolution = this.app.renderer.resolution
        this._blurFilter.padding = 0
      }
      this._blurFilter.blur = value
      this._bgBlurAmount = value
      if (this.bgSprite) {
        this.bgSprite.filters = this.bgSprite.filters || []
        if (!this.bgSprite.filters.includes(this._blurFilter)) {
          this.bgSprite.filters.push(this._blurFilter)
        }
      }
    } else {
      this.clearBgBlur()
    }
  }

  clearBgBlur() {
    this._bgBlurAmount = 0
    if (this._blurFilter && this.bgSprite?.filters) {
      this.bgSprite.filters = this.bgSprite.filters.filter(f => f !== this._blurFilter)
      if (this.bgSprite.filters.length === 0) this.bgSprite.filters = null
    }
  }

  /**
   * Apply a color overlay to the background (image_bg_color).
   * Places a semi-transparent colored sprite on top of the background.
   */
  setBgColorOverlay(hexColor, duration = 0, delay = 0) {
    this._bgColorTween?.cancel?.()

    // null / undefined / '#FFFFFF' means no overlay 闂?clear or fade out
    if (!hexColor || (typeof hexColor === 'string' && hexColor.toUpperCase() === '#FFFFFF')) {
      if (duration > 0 && this._bgOverlaySprite && this._bgOverlaySprite.parent) {
        const durationMs = Math.max(0, Number(duration)) * 1000
        const delayMs = Math.max(0, Number(delay)) * 1000
        const startAlpha = this._bgOverlaySprite.alpha
        this._bgColorTween = runRafTween({
          durationMs,
          delayMs,
          startValue: startAlpha,
          endValue: 0,
          ease: t => 1 - Math.pow(1 - t, 3),
          onUpdate: (alpha) => {
            if (this._bgOverlaySprite) this._bgOverlaySprite.alpha = Math.max(0, alpha)
          },
          onComplete: () => this.clearBgColorOverlay(),
        })
      } else {
        this.clearBgColorOverlay()
      }
      return
    }

    const targetColor = parseInt(hexColor.replace('#', ''), 16)
    const durationMs = Math.max(0, Number(duration || 0)) * 1000
    const delayMs = Math.max(0, Number(delay || 0)) * 1000
    if (!this._bgOverlaySprite) {
      this._bgOverlaySprite = new PIXI.Sprite(PIXI.Texture.WHITE)
      this._bgOverlaySprite.blendMode = PIXI.BLEND_MODES.MULTIPLY
    }
    if (!this._bgOverlaySprite.parent) {
      this.bgContainer.addChild(this._bgOverlaySprite)
      // Re-added after clear 闂?reset stale tint from previous cycle.
      // Without this, one frame renders the old tint before the tween's
      // first rAF tick, causing a visible flash.
      this._bgOverlaySprite.tint = 0xFFFFFF
      this._bgOverlayColor = 0xFFFFFF
    }
    this._bgOverlaySprite.alpha = 0.85
    this._bgOverlaySprite.width = this.width
    this._bgOverlaySprite.height = this.height
    const startColor = this._bgOverlayColor ?? 0xFFFFFF
    const startRgb = this._hexToRgb(startColor)
    const targetRgb = this._hexToRgb(targetColor)
    const apply = (rgb) => {
      const color = this._rgbToHex(rgb)
      this._bgOverlayColor = color
      this._bgOverlaySprite.tint = color
    }
    if (durationMs > 0 || delayMs > 0) {
      this._bgColorTween = runRafTween({
        durationMs,
        delayMs,
        startValue: 0,
        endValue: 1,
        ease: easeOutCubic,
        onUpdate: (t) => {
          apply({
            r: startRgb.r + (targetRgb.r - startRgb.r) * t,
            g: startRgb.g + (targetRgb.g - startRgb.g) * t,
            b: startRgb.b + (targetRgb.b - startRgb.b) * t,
          })
        },
      })
    } else {
      apply(targetRgb)
    }
  }

  clearBgColorOverlay() {
    this._bgOverlayColor = 0xFFFFFF
    if (this._bgOverlaySprite && this._bgOverlaySprite.parent) {
      this.bgContainer.removeChild(this._bgOverlaySprite)
    }
  }

  _hexToRgb(color) {
    return { r: (color >> 16) & 255, g: (color >> 8) & 255, b: color & 255 }
  }

  _rgbToHex({ r, g, b }) {
    return ((Math.round(r) & 255) << 16) | ((Math.round(g) & 255) << 8) | (Math.round(b) & 255)
  }
  // Camera zoom / pan

  /**
   * Apply camera zoom and offset to the visual stage.
   * Camera at (offsetX, offsetY) with zoom factor. Background and characters
   * share the transform so authored bg closeups do not become character-only
   * pulls.
   */
  setCameraZoom(zoomData) {
    const resetDuration = Number(zoomData?.duration || 0)
    if (!zoomData || (zoomData.zoom === 1.0 && zoomData.offset_x === 0 && zoomData.offset_y === 0 && resetDuration <= 0)) {
      this.resetCameraZoom()
      return
    }
    this._cameraZoom = zoomData
    const { zoom, offset_x, offset_y, duration } = zoomData
    const animDuration = (duration > 0) ? duration * 1000 : 0
    const coordScale = this.width / 1280
    const centerX = this.width / 2

    // Calculate target transform
    const targetScale = zoom
    const targetX = centerX * (1 - zoom) - offset_x * coordScale * zoom
    const targetY = this.height / 2 * (1 - zoom) - offset_y * coordScale * zoom

    // Cancel any in-progress tween
    this._cameraTween?.cancel?.()

    const applyCameraTransform = (scale, x, y) => {
      const bgScale = Math.max(1, scale)
      this.bgContainer.scale.set(bgScale)
      this.bgContainer.x = bgScale === scale ? x : 0
      this.bgContainer.y = bgScale === scale ? y : 0
      this.spineContainer.scale.set(scale)
      this.spineContainer.x = x
      this.spineContainer.y = y
    }

    if (animDuration > 0 && this.spineContainer.scale.x > 0) {
      // Animated transition
      const startScale = this.spineContainer.scale.x
      const startX = this.spineContainer.x
      const startY = this.spineContainer.y
      this._cameraTween = runRafTween({
        durationMs: animDuration,
        startValue: 0,
        endValue: 1,
        ease: easeOutCubic,
        onUpdate: (t) => {
          applyCameraTransform(
            startScale + (targetScale - startScale) * t,
            startX + (targetX - startX) * t,
            startY + (targetY - startY) * t,
          )
        },
      })
    } else {
      // Instant
      applyCameraTransform(targetScale, targetX, targetY)
    }
  }

  resetCameraZoom() {
    this._cameraTween?.cancel?.()
    this._cameraZoom = null
    this.bgContainer.scale.set(1)
    this.bgContainer.x = 0
    this.bgContainer.y = 0
    this.spineContainer.scale.set(1)
    this.spineContainer.x = 0
    this.spineContainer.y = 0
  }
  // Screen fade overlay

  /**
   * Animate the screen fade overlay.
   * @param {string} type - "in" (fade from color to clear) or "out" (fade to color)
   * @param {string} color - hex color e.g. "#000000" or "#FFFFFF"
   * @param {number} duration - animation duration in seconds
   * @returns {Promise} resolves when animation completes
   */
  setScreenFade(type, color, duration, delay = 0, maxAlpha = 1) {
    const token = ++this._screenFadeToken
    return new Promise(resolve => {
      if (!this._fadeOverlay || this._fadeOverlay.destroyed) {
        resolve()
        return
      }
      const hex = parseInt(color.replace('#', ''), 16)
      this._fadeOverlay.tint = hex
      this._fadeOverlay.visible = true

      const alpha = Math.max(0, Math.min(1, Number(maxAlpha ?? 1)))
      const startAlpha = type === 'in' ? alpha : 0
      const endAlpha = type === 'in' ? 0 : alpha
      this._fadeOverlay.alpha = startAlpha

      const dur = Math.max(duration, 0) * 1000
      const delayMs = Math.max(0, Number(delay || 0)) * 1000
      if (dur <= 0) {
        if (token !== this._screenFadeToken) { resolve(); return }
        this._fadeOverlay.alpha = endAlpha
        if (type === 'in') this._fadeOverlay.visible = false
        resolve()
        return
      }
      tweenOverlayFade({
        overlay: this._fadeOverlay,
        token,
        isCurrent: t => t === this._screenFadeToken,
        durationMs: dur,
        delayMs,
        startAlpha,
        endAlpha,
        onFinish: () => {
          if (type === 'in' && this._fadeOverlay && !this._fadeOverlay.destroyed) {
            this._fadeOverlay.visible = false
          }
          resolve()
        },
      })
    })
  }

  clearScreenFade() {
    this._screenFadeToken++
    if (!this._fadeOverlay || this._fadeOverlay.destroyed) return
    this._fadeOverlay.alpha = 0
    this._fadeOverlay.visible = false
  }

  playScreenEffects(effects = []) {
    if (!Array.isArray(effects) || effects.length === 0 || !this._effectOverlay) return
    const token = ++this._screenEffectToken
    for (const effect of effects) {
      const delayMs = Math.max(0, Number(effect?.delay || 0)) * 1000
      setTimeout(() => {
        if (token !== this._screenEffectToken) return
        if (effect?.type === 'single') this._playSingleScreenEffect(effect)
        else this._playFadeScreenEffect(effect)
      }, delayMs)
    }
  }

  _playFadeScreenEffect(effect) {
    const overlay = this._effectOverlay
    if (!overlay || overlay.destroyed) return
    const type = effect?.type || 'fadeout'
    const color = String(effect?.color || '#FFFFFF')
    overlay.tint = parseInt(color.replace('#', ''), 16)
    overlay.width = this.width
    overlay.height = this.height
    overlay.visible = true
    const maxAlpha = Math.max(0, Math.min(1, Number(effect?.alpha ?? 1)))
    const startAlpha = type === 'fadein' ? 0 : maxAlpha
    const endAlpha = type === 'fadein' ? maxAlpha : 0
    overlay.alpha = startAlpha
    const durationMs = Math.max(0, Number(effect?.duration || 0)) * 1000
    tweenOverlayFade({
      overlay,
      token: this._screenEffectToken,
      isCurrent: token => token === this._screenEffectToken,
      durationMs,
      startAlpha,
      endAlpha,
      onFinish: () => {
        if (endAlpha <= 0 && overlay && !overlay.destroyed) overlay.visible = false
      },
    })
  }

  _playSingleScreenEffect(effect) {
    const id = effect?.id || ''
    if (id === 'fx_adv_punch') {
      this._playPunchEffect(effect)
    } else if (id === 'fx_adv_kamifubuki') {
      this._playFadeScreenEffect({ type: 'fadein', color: '#FFFFFF', alpha: 0.25, duration: 0.12 })
      this._playFadeScreenEffect({ type: 'fadeout', color: '#FFFFFF', alpha: 0.25, duration: 0.35 })
    }
  }

  _playPunchEffect(effect) {
    const overlay = this._effectOverlay
    if (!overlay || overlay.destroyed) return
    overlay.tint = 0xffffff
    overlay.width = this.width
    overlay.height = this.height
    overlay.alpha = 0.55
    overlay.visible = true
    const dir = Math.sign(Number(effect?.x || 0))
    const durationMs = Math.max(120, Number(effect?.duration || 0.35) * 1000)
    tweenOverlayPunch({
      overlay,
      spineContainer: this.spineContainer,
      durationMs,
      dir: dir || 1,
    })
  }

  setScreenSlide(type, color = '#000000', duration = 0.5, delay = 0, direction = '6') {
    const token = ++this._screenSlideToken
    if (!this._slideOverlay || this._slideOverlay.destroyed) return
    const overlay = this._slideOverlay
    overlay.tint = parseInt(String(color || '#000000').replace('#', ''), 16)
    overlay.width = this.width
    overlay.height = this.height
    overlay.alpha = 1
    overlay.visible = true

    const offscreen = this._slideOffset(direction)
    const start = type === 'out' ? { x: 0, y: 0 } : offscreen
    const end = type === 'out' ? offscreen : { x: 0, y: 0 }
    overlay.x = start.x
    overlay.y = start.y

    const delayMs = Math.max(0, Number(delay || 0)) * 1000
    const durationMs = Math.max(0, Number(duration || 0)) * 1000
    tweenOverlaySlide({
      overlay,
      token,
      isCurrent: t => t === this._screenSlideToken,
      durationMs,
      delayMs,
      start,
      end,
      onFinish: () => {
        overlay.x = end.x
        overlay.y = end.y
        if (type === 'out') overlay.visible = false
      },
    })
  }

  _slideOffset(direction) {
    const dir = String(direction || '6')
    if (dir === '4') return { x: -this.width, y: 0 }
    if (dir === '8') return { x: 0, y: -this.height }
    if (dir === '2') return { x: 0, y: this.height }
    return { x: this.width, y: 0 }
  }

  clearScreenSlide() {
    this._screenSlideToken++
    if (!this._slideOverlay || this._slideOverlay.destroyed) return
    this._slideOverlay.visible = false
    this._slideOverlay.x = 0
    this._slideOverlay.y = 0
  }

  applyBgEffects(effects = []) {
    const desired = new Set()
    for (const effect of effects || []) {
      const id = effect?.id
      if (!id) continue
      desired.add(id)
      let entry = this._bgEffectEntries[id]
      if (!entry) {
        entry = this._createBgEffect(id)
        this._bgEffectEntries[id] = entry
        if (entry.container) this.bgEffectContainer.addChild(entry.container)
      }
      const ending = effect.action === 'end' || effect.visible === false
      const targetAlpha = ending ? 0 : this._bgEffectTargetAlpha(id)
      entry.container.visible = true
      this._animateBgEffectAlpha(entry, targetAlpha, effect.duration, effect.delay, () => {
        if (ending) this._removeBgEffect(id)
      })
    }

    for (const id of Object.keys(this._bgEffectEntries)) {
      if (!desired.has(id)) this._removeBgEffect(id)
    }
  }

  _createBgEffect(id) {
    const container = new PIXI.Container()
    container.eventMode = 'none'
    container.alpha = 0
    const entry = { id, container, ticker: null, graphics: [] }

    if (id === 'cameraflare') {
      // DISABLED 闂?2212christmas is snow/glow, not a cameraflare effect
      console.warn('[PixiStageManager] cameraflare disabled')
    } else if (id.startsWith('fx_adv_rain')) {
      const rain = new PIXI.Graphics()
      this._drawRain(rain, id)
      container.addChild(rain)
      entry.graphics.push(rain)
      const speed = id.includes('heavy') ? 9 : 5
      entry.ticker = () => {
        rain.y += speed
        if (rain.y > 28) rain.y = 0
      }
      this.app.ticker.add(entry.ticker)
    }

    return entry
  }

  _drawRain(graphics, id) {
    graphics.clear()
    const heavy = id.includes('heavy')
    const count = heavy ? 150 : 80
    graphics.lineStyle(heavy ? 2 : 1, 0xcfe9ff, heavy ? 0.36 : 0.28)
    for (let i = 0; i < count; i++) {
      const x = (i * 97) % Math.max(1, this.width + 80) - 40
      const y = (i * 53) % Math.max(1, this.height + 60) - 60
      graphics.moveTo(x, y)
      graphics.lineTo(x - 18, y + (heavy ? 42 : 32))
    }
  }

  _resizeBgEffects() {
    for (const entry of Object.values(this._bgEffectEntries)) {
      if (!entry?.graphics?.length) continue
      if (entry.id === 'cameraflare') {
        // no-op 闂?cameraflare is code-generated, handled in _createBgEffect
      } else if (entry.id.startsWith('fx_adv_rain')) {
        this._drawRain(entry.graphics[0], entry.id)
      }
    }
  }

  _bgEffectTargetAlpha(id) {
    if (id === 'cameraflare') return 0.85
    if (id.startsWith('fx_adv_rain')) return 0.85
    return 0
  }

  _loadCameraflareTextures() {
    if (this._cameraflareTextures) return this._cameraflareTextures
    const urls = [0, 1, 2, 3].map(i => `/data/fx_extracted/shine_frame_${i}.png`)
    this._cameraflareTextures = Promise.all(urls.map(url => this._loadTextureFromUrl(url)))
      .catch(e => {
        this._cameraflareTextures = null
        throw e
      })
    return this._cameraflareTextures
  }

  _animateBgEffectAlpha(entry, targetAlpha, duration = 0, delay = 0, onDone = null) {
    if (!entry?.container) return
    const token = (entry.token || 0) + 1
    entry.token = token
    const startAlpha = entry.container.alpha
    const delayMs = Math.max(0, Number(delay || 0)) * 1000
    const durationMs = Math.max(0, Number(duration || 0)) * 1000
    const t0 = performance.now()
    const tick = () => {
      if (entry.token !== token || !entry.container || entry.container.destroyed) return
      const elapsed = performance.now() - t0
      if (elapsed < delayMs) {
        requestAnimationFrame(tick)
        return
      }
      const t = durationMs <= 0 ? 1 : Math.min((elapsed - delayMs) / durationMs, 1)
      entry.container.alpha = startAlpha + (targetAlpha - startAlpha) * t
      if (t >= 1) {
        entry.container.visible = targetAlpha > 0
        if (onDone) onDone()
      } else {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
  }

  _removeBgEffect(id) {
    const entry = this._bgEffectEntries[id]
    if (!entry) return
    entry.token = (entry.token || 0) + 1
    if (entry.ticker) this.app.ticker.remove(entry.ticker)
    if (entry.container?.parent) entry.container.parent.removeChild(entry.container)
    entry.container?.destroy({ children: true })
    delete this._bgEffectEntries[id]
  }

  cancelAllSpineTweens() {
    for (const entry of Object.values(this.spineInstances)) {
      if (entry?._slideTweenRaf) {
        cancelAnimationFrame(entry._slideTweenRaf)
        entry._slideTweenRaf = null
      }
    }
  }
  // Spine position animation (slide)

  /**
   * Animate a spine from its current position to target position.
   * @param {string} idolId
   * @param {number} targetX - target screen X
   * @param {number} targetY - target screen Y
   * @param {number} duration - animation duration in seconds
   */
  animateSpinePosition(idolId, targetX, targetY, duration) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry

    // Cancel previous tween on this spine
    if (entry._slideTweenRaf) {
      cancelAnimationFrame(entry._slideTweenRaf)
      entry._slideTweenRaf = null
    }

    const startX = spine.x
    const startY = spine.y
    const dx = targetX - startX
    const dy = targetY - startY
    const durMs = duration * 1000

    if (durMs <= 0 || (dx === 0 && dy === 0)) {
      spine.x = targetX
      spine.y = targetY
      return
    }

    const t0 = performance.now()
    const tick = () => {
      const elapsed = performance.now() - t0
      const t = Math.min(elapsed / durMs, 1)
      const ease = 1 - Math.pow(1 - t, 3)  // easeOutCubic
      spine.x = startX + dx * ease
      spine.y = startY + dy * ease
      if (t < 1) {
        entry._slideTweenRaf = requestAnimationFrame(tick)
      } else {
        entry._slideTweenRaf = null
      }
    }
    entry._slideTweenRaf = requestAnimationFrame(tick)
  }
  // Spine color tinting

  /**
   * Apply color tint to a spine model.
   * @param {string} idolId
   * @param {string|null} hexColor - "#FFFFFF" (normal), "#AAAAAA" (dim), null (reset)
   */
  setSpineColor(idolId, hexColor, duration = 0, delay = 0) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const target = hexColor ? parseInt(hexColor.replace('#', ''), 16) : 0xFFFFFF
    const durationMs = Math.max(0, Number(duration || 0)) * 1000
    const delayMs = Math.max(0, Number(delay || 0)) * 1000
    this._spineColorTweens[idolId]?.cancel?.()
    const start = entry.spine.tint ?? 0xFFFFFF
    const startRgb = this._hexToRgb(start)
    const targetRgb = this._hexToRgb(target)
    if (durationMs > 0 || delayMs > 0) {
      this._spineColorTweens[idolId] = runRafTween({
        durationMs,
        delayMs,
        startValue: 0,
        endValue: 1,
        ease: easeOutCubic,
        onUpdate: (t) => {
          entry.spine.tint = this._rgbToHex({
            r: startRgb.r + (targetRgb.r - startRgb.r) * t,
            g: startRgb.g + (targetRgb.g - startRgb.g) * t,
            b: startRgb.b + (targetRgb.b - startRgb.b) * t,
          })
        },
        onComplete: () => {
          delete this._spineColorTweens[idolId]
        },
      })
    } else {
      entry.spine.tint = target
    }
  }
  // Character zoom (idol_zoom multiplier)

  /**
   * Apply character-specific zoom multiplier to base scale.
   * Stores the base scale (calculated from model type) and applies zoom factor.
   */
  setSpineZoom(idolId, zoomMultiplier) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const baseScale = entry.spine._baseScale || entry.spine.scale.x
    if (zoomMultiplier != null && zoomMultiplier > 0) {
      entry.spine.scale.set(baseScale * zoomMultiplier)
    } else {
      entry.spine.scale.set(baseScale)
    }
  }

  setSpineScale(idolId, scale) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    if (!Number.isFinite(scale) || scale <= 0) return
    entry.spine.scale.set(scale)
    this._emitSpineState(idolId)
  }

  flushSpinePose(idolId, dt = 0) {
    const entry = this.spineInstances[idolId]
    const spine = entry?.spine
    if (!spine) return null
    try {
      spine.state.update(dt)
      spine.state.apply(spine.skeleton)
      spine.skeleton.updateWorldTransform()
      return true
    } catch (err) {
      console.warn(`[PixiStageManager] flushSpinePose failed for ${idolId}:`, err?.message || err)
      return false
    }
  }

  getPrefabRectMetrics(spine, prefabMeta) {
    const rect = prefabMeta?.rect
    if (!spine || !rect) return null
    const local = (() => {
      try { return spine.getLocalBounds() } catch (_) { return null }
    })()
    if (!local || !Number.isFinite(local.height) || local.height <= 0) return null
    const pivot = {
      x: prefabMeta?.derived?.pivotX ?? rect.pivot?.x ?? 0,
      y: prefabMeta?.derived?.pivotY ?? rect.pivot?.y ?? 0,
    }
    const size = rect.sizeDelta || {}
    const anchored = rect.anchoredPosition || rect.localPosition || {}
    const localTop = local.y
    const localBottom = local.y + local.height
    const localCenterY = local.y + local.height / 2
    const rawRectToLocal = Number.isFinite(size.y) && size.y > 0 ? size.y / local.height : null
    return {
      prefabY: prefabMeta?.derived?.prefabPositionY ?? anchored.y ?? null,
      pivotY: pivot.y,
      sizeDeltaY: size.y ?? null,
      rectTopY: null,
      rectBottomY: null,
      rectHeight: size.y ?? null,
      rectCenterY: null,
      localTop,
      localBottom,
      localCenterY,
      localHeight: local.height,
      rawRectToLocal,
    }
  }

  fitSpineToPrefabRect(spine, prefabMeta, options = {}) {
    const rect = prefabMeta?.rect
    if (!spine || !rect) return null

    const hasPivot = !!rect.pivot || prefabMeta?.derived?.pivotY != null
    const pivot = hasPivot
      ? { x: prefabMeta?.derived?.pivotX ?? rect.pivot?.x ?? 0, y: prefabMeta?.derived?.pivotY ?? rect.pivot?.y ?? 0 }
      : null
    const size = rect.sizeDelta || null
    const anchored = rect.anchoredPosition || rect.localPosition || null
    if (!pivot || !size || !anchored) return null

    const local = spine.getLocalBounds()
    if (!local || !Number.isFinite(local.height) || local.height <= 0) return null

    const uiScale = this.height / 720
    const centerY = this.height * 0.5
    const rectTopY = centerY - (anchored.y + (1 - pivot.y) * size.y) * uiScale
    const rectBottomY = centerY - (anchored.y - pivot.y * size.y) * uiScale
    const rectCenterY = (rectTopY + rectBottomY) / 2
    const targetHeight = rectBottomY - rectTopY
    if (!Number.isFinite(targetHeight) || targetHeight <= 0) return null

    const targetScale = targetHeight / local.height
    const localTop = local.y
    const localBottom = local.y + local.height
    const localCenterY = local.y + local.height / 2
    const anchorMode = (options.anchorMode || 'bottom').toLowerCase()
    let rootY = rectBottomY - localBottom * targetScale
    if (anchorMode === 'top') {
      rootY = rectTopY - localTop * targetScale
    } else if (anchorMode === 'center') {
      rootY = rectCenterY - localCenterY * targetScale
    } else if (anchorMode === 'bottom') {
      rootY = rectBottomY - localBottom * targetScale
    }

    spine.scale.set(targetScale)
    spine.y = rootY
    spine._baseScale = targetScale
    spine._prefabRectFit = {
      rectTopY,
      rectBottomY,
      rectCenterY,
      targetHeight,
      localHeight: local.height,
      localTop,
      localBottom,
      localCenterY,
      rootY,
      scale: targetScale,
      anchorMode,
    }
    return spine._prefabRectFit
  }
  // Spine loading

  async spawnSpine(idolId, modelId, options = {}) {
    this.removeSpine(idolId)
    const spawnToken = (this._spawnTokens[idolId] || 0) + 1
    this._spawnTokens[idolId] = spawnToken

    const step = (name, fn) => {
      try {
        return fn()
      } catch (e) {
        console.error(`[spawnSpine] STEP "${name}" failed for ${modelId}:`, e)
        throw e
      }
    }

    try {
      const atlasUrl = getSpineAtlasUrl(modelId)
      const skelUrl = getSpineSkelUrl(modelId)
      const { skeletonData, spine, animNames, hasMeshOrRegion } = await step('loadAndCreateSpine', () => loadAndCreateSpine({
        modelId,
        atlasUrl,
        skelUrl,
        decodeAtlasText: buf => this._decodeAtlasText(buf),
        extractTextureFilename: atlasText => this._extractTextureFilename(atlasText),
        resolveTextureUrl: (mid, file) => this._resolveTextureUrl(mid, file),
        loadTextureFromUrl: url => this._loadTextureFromUrl(url),
        getFallbackTexture: () => this._getFallbackTexture(),
        decodeSkelBuffer: buf => this._decodeSkelBuffer(buf),
        Spine,
        SkeletonBinary,
        AtlasAttachmentLoader,
        TextureAtlas,
      }))

      console.log(`[DEBUG] hasMeshOrRegion: ${hasMeshOrRegion}`)

      spine.stateData.defaultMix = 0.12

      const origStateUpdate = spine.state.update.bind(spine.state)
      spine.state.update = (dt) => {
        origStateUpdate(dt)
        for (let i = 0; i <= 1; i++) {
          const track = spine.state.tracks[i]
          if (!track || track.alpha <= 0 || track.alpha >= 1 || track.mixDuration <= 0) continue
          const t = track.alpha
          if (i === 0) {
            const smoothstep = t * t * (3 - 2 * t)
            track.alpha = t * 0.5 + smoothstep * 0.5
          } else {
            const c1 = 5.0
            const c3 = c1 + 1
            track.alpha = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
          }
        }
      }

      spine._blinkCfg = this._detectBlinkSlots(spine)
      spine._effectCfg = this._detectEffectSlots(spine)
      spine._optionalPartsSlots = this._detectOptionalPartsSlots(spine, idolId, modelId)

      const origApply = spine.state.apply.bind(spine.state)
      spine.state.apply = (skeleton) => {
        origApply(skeleton)

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

        const effectCfg = spine._effectCfg
        const eFlags = spine._faceFlags || {}
        if (effectCfg && effectCfg.blush.length > 0 && eFlags.blush_flag !== '闂傚倸鍊搁崐鎼佸磹妞嬪孩顐芥慨姗嗗墻閻掔晫鎲搁弮鍥棨婵＄偑鍊栧ú宥夊磻閹惧瓨鍙忓┑鐘叉噺椤ュ銇勯幘鍐叉倯鐎垫澘瀚换婵嬪礋閸倣婵嗏攽閻樿尙妫勯柡澶婄氨閸嬫捇寮撮姀鐘电枃闁硅偐琛ラ崜婵堢棯?') {
          for (const name of effectCfg.blush) {
            const slot = skeleton.findSlot(name)
            if (slot) slot.color.a = 0
          }
        }
        if (effectCfg && effectCfg.sweat.length > 0 && eFlags.sweat_flag !== '婵?') {
          for (const name of effectCfg.sweat) {
            const slot = skeleton.findSlot(name)
            if (slot) slot.color.a = 0
          }
        }
        this._applyOptionalPartsSlots(spine)
      }

      if (this._spawnTokens[idolId] !== spawnToken) {
        spine.destroy({ children: true, texture: false, baseTexture: false })
        return null
      }

      this._applyDefaultPosition(spine, modelId, idolId, options)
      console.warn('[SPAWN_DONE]', idolId, modelId, {
        x: spine.x,
        y: spine.y,
        baseScale: spine._baseScale || spine.scale.x,
      })

      if (!spine._baseScale) {
        spine._baseScale = spine.scale.x
      }

      const marker = new PIXI.Graphics()
      marker.beginFill(0xff0000)
      marker.drawCircle(0, 0, 8)
      marker.endFill()
      marker.beginFill(0xffffff)
      marker.drawCircle(0, 0, 3)
      marker.endFill()
      marker.visible = this._debugMode
      this._debugOverlay?.addChild(marker)

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

      console.log(`[PixiStageManager] Spine "${modelId}" loaded. Anims:`, animNames.join(', '))

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

      finalizeSpawnedSpine({
        manager: this,
        spine,
        modelId,
        idolId,
        animNames,
        options,
        spawnToken,
        spineContainer: this.spineContainer,
        debugMode: this._debugMode,
        pendingTalking: this._pendingTalking,
        getDefaultBodyAnim: animNamesArg => this.getDefaultBodyAnim(animNamesArg),
        captureBaselineBounds: spawnedId => this.captureBaselineBounds(spawnedId),
        fadeIn: (spineObj, duration) => this._fadeIn(spineObj, duration),
        setSpineTalking: (spawnId, isTalking, volumeCallback) => this.setSpineTalking(spawnId, isTalking, volumeCallback),
      })
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
        modelId: entry.modelId,
      }
    }))
  }

  getDefaultBodyAnim(animNames = []) {
    if (!Array.isArray(animNames) || animNames.length === 0) return null
    if (animNames.includes('wait_loop')) return 'wait_loop'

    const loop = animNames.find(n =>
      typeof n === 'string' &&
      n.endsWith('_loop') &&
      !n.startsWith('face_') &&
      n !== 'angry_loop' &&
      n !== 'sad_loop' &&
      n !== 'joy_loop' &&
      n !== 'surprise_loop'
    )
    if (loop) return loop

    const nonFace = animNames.find(n => typeof n === 'string' && !n.startsWith('face_'))
    return nonFace || animNames[0] || null
  }

  captureBaselineBounds(idolId) {
    const entry = this.spineInstances[idolId]
    if (!entry?.spine) return null
    const spine = entry.spine
    const animNames = spine.state?.data?.skeletonData?.animations?.map(a => a.name) || []
    const defaultBody = this.getDefaultBodyAnim(animNames)
    if (!defaultBody) return null
    try {
      spine.state.setAnimation(0, defaultBody, true)
      spine._currentBodyAnim = defaultBody
      const defaultFace = animNames.includes('face_default')
        ? 'face_default'
        : (animNames.find(n => typeof n === 'string' && n.startsWith('face_')) || null)
      if (defaultFace) {
        spine.state.setAnimation(1, defaultFace, true)
        spine._currentFaceAnim = defaultFace
        spine._currentFaceKey = null
      }
      spine.state.update(0)
      spine.state.apply(spine.skeleton)
      this.flushSpinePose(idolId, 0)
      const baseline = this.getSkeletonLocalBounds(spine)
      entry.baselineSkeletonLocalBounds = baseline
      entry.baselineCapturedAt = new Date().toISOString()
      entry.baselineCaptureReason = 'spawn-default'
      entry.baselineBodyAnim = defaultBody
      entry.baselineFaceAnim = defaultFace
      entry.baselineTracks = Array.isArray(spine.state?.tracks)
        ? spine.state.tracks.map((track, index) => track ? {
          index,
          animation: track.animation?.name || null,
          loop: !!track.loop,
          trackTime: track.trackTime ?? null,
          mixTime: track.mixTime ?? null,
          mixDuration: track.mixDuration ?? null,
        } : null)
        : null
      return baseline
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to capture baseline bounds for "${idolId}":`, err?.message || err)
      return null
    }
  }

  _applyDefaultPosition(spine, modelId = '', idolId = '', options = {}) {
    // Keep character height differences from the original rigs.  Normalizing by
    // skeleton.data.height made taller idols look artificially smaller because
    // some rigs include different whitespace/bounds.
    const isSubModel = /^\d{3}sub_/.test(modelId)
    const fitMode = (options.fitMode || 'current').toLowerCase()
    const bodyScaleEnabled = !!options.bodyScaleEnabled
    const baseScale = isSubModel ? DEFAULT_SUB_SCALE : DEFAULT_ADULT_SCALE
    const charaScale = CHARACTER_BASE_SCALE_MULTIPLIER[idolId] || 1
    const bodyTypeScale = bodyScaleEnabled ? (BODY_TYPE_SCALE_MULTIPLIER[options.bodyType] || 1) : 1
    const modelScale = MODEL_BASE_SCALE_MULTIPLIER[modelId] || 1
    const visualHeightReference = Number.isFinite(options.visualHeightReference) ? options.visualHeightReference : null
    const visualHeightStrength = Number.isFinite(options.visualHeightStrength) ? options.visualHeightStrength : 1
    let visualHeightScale = 1
    let finalScale = baseScale

    if (fitMode === 'visualheight' && visualHeightReference && visualHeightReference > 0) {
      try {
        const local = spine.getLocalBounds()
        if (local && Number.isFinite(local.height) && local.height > 0) {
          visualHeightScale = Math.pow(visualHeightReference / local.height, visualHeightStrength)
        }
      } catch (_) {
        visualHeightScale = 1
      }
    }

    if (fitMode === 'current') {
      finalScale = baseScale * charaScale * bodyTypeScale * modelScale
      spine.scale.set(finalScale)
      spine.y = this.app.screen.height + 20
    } else if (fitMode === 'fixedscale') {
      finalScale = baseScale * bodyTypeScale
      spine.scale.set(finalScale)
      spine.y = this.app.screen.height + 20
    } else if (fitMode === 'visualheight') {
      finalScale = baseScale * visualHeightScale * bodyTypeScale
      spine.scale.set(finalScale)
      spine.y = this.app.screen.height + 20
    } else if (fitMode === 'prefabrect') {
      const fit = this.fitSpineToPrefabRect(spine, options.prefabMeta)
      if (fit) {
        finalScale = fit.scale
      } else {
        finalScale = baseScale * bodyTypeScale
        spine.scale.set(finalScale)
      }
      spine.y = Number.isFinite(spine.y) ? spine.y : this.app.screen.height + 20
    } else {
      finalScale = baseScale * charaScale * bodyTypeScale * modelScale
      spine.scale.set(finalScale)
      spine.y = this.app.screen.height + 20
    }
    spine.x = this.app.screen.width * 0.5
    spine._scaleConfig = {
      fitMode,
      bodyScaleEnabled,
      baseScale,
      charaScale,
      bodyTypeScale,
      modelScale,
      visualHeightReference,
      visualHeightStrength,
      visualHeightScale,
      finalScale,
    }
    return spine._scaleConfig
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

  /**
   * Position a spine using native game coordinates (-200, 0, 200, etc.).
   * The game's native canvas is ~1280闂?20; maps offsets to current screen size.
   * @param {string} idolId
   * @param {number} posX - native x offset (e.g. -200 = left position)
   * @param {number} [posY=0] - native y offset
   * @param {number} [baseY] - base Y in virtual coords (use getCharaY result)
   */
  setSpinePositionByGameCoord(idolId, posX, posY = 0, baseY = null) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    if (entry._slideTweenRaf) {
      cancelAnimationFrame(entry._slideTweenRaf)
      entry._slideTweenRaf = null
    }
    const centerX = this.width / 2
    const yBase = baseY != null ? baseY : this.height + 20
    // Scale native coords (1280-wide canvas) to current screen width
    const coordScale = this.width / 1280
    entry.spine.x = centerX + posX * coordScale
    // Negate posY: game uses Unity convention (Y+ = up), web/PixiJS has Y+ = down
    entry.spine.y = yBase - posY * coordScale
  }

  /** Bring a spine to the front (top z-order). */
  bringToFront(idolId) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    this.spineContainer.setChildIndex(entry.wrapper, this.spineContainer.children.length - 1)
  }

  /** Apply an explicit back-to-front character order. */
  applySpineOrder(idolIds = []) {
    const orderedEntries = []
    for (const idolId of idolIds) {
      const entry = this.spineInstances[idolId]
      if (entry?.wrapper?.parent === this.spineContainer) {
        orderedEntries.push(entry)
      }
    }
    orderedEntries.forEach((entry, index) => {
      this.spineContainer.setChildIndex(entry.wrapper, index)
    })
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
  // Atlas / texture helpers

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
  /**
   * Detect blink-related slots from skeleton slot names.
   */
  _detectBlinkSlots(spine) {
    const hide = []
    const show = []
    const skin = spine?.skeleton?.data?.defaultSkin
    const slotNames = spine?.skeleton?.data?.slots?.map(s => s.name) || []
    for (const name of slotNames) {
      const low = String(name).toLowerCase()
      const idx = spine?.skeleton?.data?.findSlotIndex?.(name) ?? -1
      if (idx < 0) continue
      if (/_close/.test(low)) {
        let attName = name
        if (skin?.attachments?.[idx]) {
          const keys = Object.keys(skin.attachments[idx])
          const closeKey = keys.find(k => /close/i.test(k))
          attName = closeKey ?? keys[0] ?? ""
        }
        try {
          const testAtt = skin?.getAttachment?.(idx, attName) || spine.skeleton.getAttachment(idx, attName)
          if (testAtt) show.push({ slot: name, att: attName })
        } catch (_) {}
      } else if (/_smile/.test(low) || /^(eyelash|eyewhite|eyelight|eyeline|eye_pupil|eyeball)/.test(low) || /eyeball.*skin/.test(low)) {
        hide.push(name)
      }
    }
    if (hide.length === 0 && show.length === 0) return null
    console.log("[BlinkCfg]", { slotCount: slotNames.length, hide, show })
    return { hide, show }
  }

  /**
   * Detect effect slots (blush/sweat) from slot names.
   */
  _detectEffectSlots(spine) {
    const blush = []
    const sweat = []
    const slotNames = spine?.skeleton?.data?.slots?.map(s => s.name) || []
    for (const name of slotNames) {
      const low = String(name).toLowerCase()
      if (/cheek/.test(low)) blush.push(name)
      if (/^swet\b/.test(low) || /^sweat\b/.test(low)) sweat.push(name)
    }
    const result = { blush, sweat }
    if (blush.length > 0 || sweat.length > 0) console.log("[EffectCfg]", result)
    return result
  }

  _getTextureUrl(modelId, textureFile) {
    const atlasUrl = getSpineAtlasUrl(modelId)
    const base = atlasUrl.substring(0, atlasUrl.lastIndexOf('/'))
    return `${base}/${textureFile}`
  }

  async _resolveTextureUrl(modelId, textureFile) {
    const primaryUrl = this._getTextureUrl(modelId, textureFile)
    if (await this._isImageUrl(primaryUrl)) return primaryUrl

    if (textureFile !== 'comu.png') {
      const fallbackUrl = this._getTextureUrl(modelId, 'comu.png')
      if (await this._isImageUrl(fallbackUrl)) {
        console.warn(`[PixiStageManager] Texture "${textureFile}" missing for "${modelId}", using comu.png`)
        return fallbackUrl
      }
    }

    return primaryUrl
  }

  async _isImageUrl(url) {
    try {
      const r = await fetch(url, { method: 'HEAD', cache: 'no-store' })
      if (!r.ok) return false
      const contentType = r.headers.get('content-type') || ''
      return contentType.startsWith('image/')
    } catch (_) {
      return false
    }
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
  // Talking / Procedural Lip-Sync

  /**
   * 缂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕濡炪們鍨洪悧鐘茬暦閵娾晛绠规い鎾跺枑濞呭牓姊绘担鍛婂暈濞撴碍顨婂畷褰掑垂椤愶絽寮块梺鎯ф禋閸嬩焦绂嶅鍫熺厵闁诡垎鍐煘闂佽绻嗛弲婵堟閹烘鐒垫い鎺嗗亾闁伙絾绻堝畷鐔碱敆閸屾艾绠伴梺璇叉唉椤骞栭埡鍛獥闁哄稁鍋€閸嬫挸顫濋悡搴＄睄閻庢鍠楁繛濠囩嵁濡偐纾兼俊顖濇〃閻㈢粯绻濋悽闈浶㈤柨鏇樺€曡灋婵°倕鎳忛崐鍨归悩宸剱闁绘挻娲熼弻鏇熺箾閸喖濮㈢紓浣割槺閸庛倝銆冮妷鈺傚€烽柟缁樺笚濞堣螖閻橀潧浠﹂柨鏇樺灲閻涱噣宕堕妸锕€顎撻柣鐔哥懃鐎氥劑鍩€椤掆偓閸熸潙顫忕紒妯肩懝闁逞屽墮椤洩顦归挊婵囥亜閹惧崬鐏╃痪鎹愭硶閳ь剝顫夊ú鏍洪妸鈺傚剹婵鍩栭悡鏇犳喐鎼淬劊鈧啴宕卞☉娆忎簵?(Procedural Lip-Sync Engine).
   *
   * 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸弫鎾绘偐椤愮喎浜鹃柨鏇炲€搁悙濠冦亜閹哄棗浜剧紓浣瑰姈椤ㄥ﹪寮婚悢鐓庣闁逛即娼у▓顓犵磽娴ｅ搫校闁绘娲熼崺鐐哄箣閿旇棄浜归梺鍛婄懃椤︻垶藝閳哄懏鈷戦柛婵嗗婵ジ鏌涢幘鏉戝摵妤犵偛鐗撴俊鎼佸Ψ閵忊剝鏉搁梻浣虹《閸撴繈鎮烽妷锔藉劅濠靛倻顭玀 Spine 婵犵數濮烽弫鍛婃叏閻戝鈧倿鎸婃竟鈺嬬秮瀹曘劑寮堕幋婵堚偓顓烆渻閵堝懐绠伴柣妤€妫濋幃鐐哄垂椤愮姳绨婚梺鐟版惈濡绂嶉崜褏纾奸柛鎾楀棙顎楅梺鍛婄懃閸熸潙鐣峰ú顏勭劦妞ゆ帊闄嶆禍婊堟煙閸濆嫭顥滃ù婊堢畺濮婃椽骞栭悙鑼痪闂佺粯鎼换婵嗙暦濞差亜顫呴柨娑樺濞村嫰鏌ｆ惔顖滅У濞存粎鍋ゅ畷婵嬪箻椤旇В鎷洪梺鍛婄☉閿曘倖鎱ㄩ埀顒勬⒑閸濆嫭鍣虹紒璇茬墦楠炲啯銈ｉ崘鈺傚劒濡炪倖鍔х槐鏇犵不濮橆剦娓婚柕鍫濇婵呯磼閹绘帒鈷旀繛鍡愬灲瀵濡烽敃鈧埀顒€鐏氶幈銊ノ熼悡搴′粯婵犫拃鍐惧殶闁逞屽墲椤煤閺嶎厼绠规い鎰╁劤娴滄瑩姊绘担鍛婂暈濞撴碍顨婂畷浼村冀椤撶偟顦銈嗘尪閸ㄦ椽鍩涢幋锔界厱婵炴垶锕弨璇差熆鐠哄搫顏柡灞剧洴閺佹劖鎯旈埄鍐綆闁诲氦顫夊ú鐔奉焽瑜旈崺銉﹀緞閹邦剦娼婇梺鐐藉劚閸樻牠宕犻弽顓熲拻濞达綀顫夐崑鐘绘煕鎼搭喖鐏︾€规洘绻冮幆鏃堟晲閸ワ妇鐟濋梻浣告贡閸嬫捇寮告總绋跨哗闁兼亽鍎禍婊堟煛閸愩劍绁╂繛鍏煎姈缁绘盯宕ㄩ銊ㄥ惈闂?talk/mouth clip),
   * 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾鐎规洏鍎抽埀顒婄秵娴滃爼鎮㈤崱妯诲弿婵＄偠顕ф禍楣冩倵濞堝灝鏋ら柡浣割煼閵嗕礁螖閸涱厾鍔﹀銈嗗坊閸嬫挾鈧鎸哥€氭澘顫忔ウ瑁や汗闁圭儤鎼槐鐢电磽娴ｆ彃浜炬繛杈剧秬濞咃綁鎯岄崱娑欑厱闁逛即娼ч弸鐔兼煟閹惧瓨绀冪紒缁樼洴楠炲鈹戦崱姘厴婵°倗濮烽崑鐐衡€﹂崶鈺傤潟闁圭儤顨呯粻鐔兼倵閿濆骸澧伴柡鍡欏█濮婂宕惰濡插湱绱掔紒妯肩畺缂佺粯绻堝畷鎺戭潩椤撶噥鍞瑰┑锛勫亼閸婃垿宕曢搹顐ｅ弿濡炲瀛╅～鏇㈡煙閻戞﹩娈旈幆鐔兼⒑闂堟侗鐓┑鈥虫喘婵″瓨绻濋崟顓狅紳婵炶揪绲肩划娆撳传濞差亝鍋ㄦい鏍ㄣ仜閸嬫挸鐣烽崶銊︻啎闂備礁鎲￠〃鍫ュ磻閹版澘鍑犻幖娣妽閻撴瑩姊洪銊х暠闁哄鍠愮换娑㈠醇閻旂鈧劖鎱ㄦ繝鍌ょ吋鐎规洘甯掗～婵嬵敄閽樺澹曢梺褰掓？閻掞箓宕戠€ｎ喗鐓曢柡鍥ュ妼閻忕娀鏌涢妸銉モ偓鎼佹箒闂佺粯锚濡﹪宕曡箛鏇犳／闁诡垎鍕淮闂佽鍠楅〃鍛村煡婢跺ň鏋庢繛鍡楁捣鏉╂梹绻濋悽闈涗粶闁绘鎳愰崚鎺戔枎閹惧疇鎽曢梺鍝勬川閸犳挾绮绘ィ鍐╃厽闁逛即娼ф晶顖炴煟濠垫挾鐣垫慨?(chin_control, mouth, chin)闂?   *
   * 濠电姷鏁告慨鐑藉极閹间礁纾婚柣鎰惈閸ㄥ倿鏌涢锝嗙缂佺姵褰冮湁闁挎繂鎳庨ˉ蹇旂箾鐎涙澧甸柡灞炬礃缁绘稖顦查柛鐕佸亰閹ɑ绻濋崶銊㈡嫼闂佸憡鎸昏ぐ鍐╃閻愮儤鐓曢柣妯挎珪瀹曞矂鏌涢埞鍨伈鐎殿喗鎸虫慨鈧柨娑樺楠炲牊淇婇悙顏勨偓鏍礉瑜忓濠囧锤濡や礁鍓归悗鍏夊亾闁告洦鍓涢崢浠嬫⒑缂佹ɑ鐓ラ柟鑺ョ矌缁鎮欓悜妯煎幐闁诲繒鍋犻褔鍩€椤掍焦绀嬮柟顕€绠栭幃婊堟寠婢跺苯鈧偤姊洪棃娑辩叚濠碘€虫穿閵囨劘顦规慨?PIXI.Ticker 濠电姷鏁告慨鐑姐€傞鐐潟闁哄洢鍨圭壕濠氭煟閺冨倸甯剁紒鐘靛█閺岀喖骞嗚閿涘秹鏌￠崱顓㈡闁靛洤瀚伴獮鎺戭吋閸パ冾瀴闂備礁鎲￠悷銉ф崲濮椻偓瀵顓兼径濠佺炊闂佸憡娲﹂崑鍌滆姳閽樺鏀介柣鎰皺婢ф梻绱掗鐣屾噰鐎殿喖顭峰鎾偄閾忚鍟庨梻浣虹帛閸旓箓宕滃鑸靛仧闁挎洖鍊归埛鎴︽⒑椤愩倕浠滈柤娲诲灡閺呭爼顢涢悙瀵稿幗闂佸啿鎼敃銈夋倶閿旈敮鍋?   *   Spine 婵犵數濮烽弫鍛婃叏閻戣棄鏋侀柟闂寸绾惧鏌ｉ幇顒佹儓缂佺姵澹嗙槐鎺斺偓锝庡亽閸庛儵鏌涢妶鍡樼闁哄本鐩、鏇㈡晲閸℃瑯妲伴梻浣侯焾椤戝懘宕愰崸妤€绠栨俊銈呮噺閺呮煡骞栫划鍏夊亾閹颁焦楠勬繝鐢靛仦閸ㄥ爼骞愰崫銉х煋鐟滅増甯掗拑鐔兼煏婵炲灝鍔楁俊鎻掔墛娣囧﹪顢涘▎鎺濆妳婵炲濮烽崢褔鍩? state.apply(skeleton) 闂?updateWorldTransform() 闂?婵犵數濮烽弫鍛婃叏閻戣棄鏋侀柟闂寸绾惧鏌ｉ幇顒佹儓缂佺姵澹嗙槐鎺斺偓锝庡亽閸庛儵鏌涢妶鍡樼闁哄本鐩、鏇㈡晲閸℃瑯妲伴梻?
   *   Ticker 濠电姷鏁告慨鐑藉极閹间礁纾块柟瀵稿Т缁躲倝鏌﹀Ο渚＆鐟滅増甯掔壕濂告煟閹邦垰鐨洪柣娑栧劚閳规垶骞婇柛濠冩礋楠炲﹥鎯旈妸銉ュ殤婵炴挻鍩冮崑鎾绘煛鐏炲墽顬肩紒鐘崇洴瀵潙螖娴ｅ摜褰靛┑鐘垫暩閸嬫盯鎮ч崨顖氬灊婵炲棙鎸搁拑鐔兼煛閸モ晛鏋旂紒鐘荤畺閺岋綁骞囬棃娑橆潽闂佺粯绻愮粻鎾愁潖濞差亝鐒婚柣鎰蔼鐎氭澘顭胯閸ㄥ爼寮婚敐澶婄厸濠电姴鍊绘禒绋课旈悩闈涗粶婵☆偅绻傞悾宄邦潨閳ь剟銆佸▎鎾村殐闁冲搫锕ユ晥婵犵绱曢崑鎴﹀磹閺嶎偅鏆滃┑鐘插椤愪粙鏌嶉妷锔剧獮闁挎繂顦介弫宥夋煟閹邦喛藟闁归攱妞藉娲川婵犲嫮鐣甸柣搴㈠嚬閸犳寮查崼鏇炲嵆闁靛骏绱曢崢鐢电磼閻愵剚绶茬€规洦鍓氱粋宥夘敍閻愬鍘梺鎼炲劘閸斿本鎱ㄥ鍥ｅ亾濞堝灝鏋涙い顓㈡敱娣囧﹪鎮滈懞銉︽珖闂侀€炲苯澧柍缁樻崌楠炲鏁傜憴锝嗗闂備礁鍚嬫禍浠嬪磿瀹ュ鏁傞柛鈺勬硾濞诧妇鈧絻鍋愰埀顒傛暩椤牐銇?apply 濠电姷鏁告慨鐑藉极閹间礁纾婚柣鎰惈閸ㄥ倿鏌涢锝嗙闁藉啰鍠栭弻鏇熺箾閻愵剚鐝﹂梺杞扮鐎氫即寮诲☉妯锋闁告鍋為悘宥呪攽閻愬弶鍣藉┑鐐╁亾闂佸搫鐭夌徊鍊熺亽濠电偛妫欓崕鍐测枔椤撶姷纾藉ù锝呮惈椤庢挾绱撳鍕獢鐎殿喖顭烽崹楣冨箛娴ｅ憡鍊梻濠庡亜濞诧箓骞栭埡浼辨椽顢橀悜鍡樺瘜闂侀潧鐗嗗Λ娆戜焊閻楀牅绻嗛柣鎰閻瑧鈧鍠涢褔鍩ユ径濠庢建闁糕剝锚閸忓﹥淇婇悙顏勨偓鏍ь啅婵犳艾纾婚柟鍓х帛閻撴洟鏌曢崼婵堝闁告凹鍋嗙槐鎺撴綇閵娿儳鐟插┑鐐靛帶缁绘ɑ淇婂宀婃Ь闂佷紮绲惧浠嬪箖濡ゅ懎鍨傛い鎰剁悼閸戯繝鏌ｆ惔銏犲毈闁搞劍鍎煎Λ鐔兼⒑閹勭闁稿鐒︾粋宥咁煥閸喓鍘撻柣鐘叉礌閳ь剙鍟跨粻鐟扳攽閻愰鍤嬬紒鐘虫尭閻ｇ兘骞嬪┑鍐╂杸闁诲函缍嗛崑鍡涘储闁秵鈷戦梻鍫熶緱濡牓鏌涢悩铏妤犵偛顦甸幃娆擃敆閸屾粠鍟?apply 闂傚倸鍊搁崐宄懊归崶褏鏆﹂柣銏㈩焾缁愭鏌熼柇锕€鍔掓繛宸簻閸愨偓濡炪値鍓﹂崜姘辩矙閹达箑鐓″璺好￠悢鑽ょ杸闁哄洨鍋涙俊铏圭磽娴ｈ櫣甯涚紒璇茬墕閻ｇ兘宕奸弴妞诲亾?   *
   * 闂傚倸鍊搁崐宄懊归崶褏鏆﹂柣銏㈩焾缁愭鏌熼幍顔碱暭闁稿绻濆鍫曞醇濮橆厽鐝旂紓浣界堪閸婃繈寮诲☉銏犵婵°倐鍋撻悗姘煎墴瀹曘垼銇愰幒鎾嫼闂佸憡鎸昏ぐ鍐╃濠靛洨绠鹃柛娆忣檧閼拌法鈧鍠楅悡锟犮€佸Δ浣瑰闁荤喐婢樻导搴㈢節濞堝灝鏋熸い銊ユ噹铻炴俊銈勭劍濞呯姵銇勯弮鍌氫壕闁稿鐗犻弻鏇熷緞閸℃ɑ鐝曢梺?skeleton.updateWorldTransform()闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏃堟暜閸嬫挾绮☉妯诲櫧闁活厽鐟╅弻鐔告綇妤ｅ啯顎嶉梺鎼炲€栭崝鏍Φ閸曨垰鍐€闁靛ě鍐╂闂?apply 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸弫鎾绘偐閼碱剦妲烽梻浣告惈缁嬩線宕㈡禒瀣；闁跨喓濮甸悡蹇擃熆鐠虹儤顥炴繛鍛嚇閺岋綁顢橀悤浣圭杹闂佸搫鏈惄顖炲春閸曨垰绀冩い蹇庣劍椤秶绱撻崒娆掝唹闁稿鎸搁…鍧楁嚋闂堟稑顫嶉梺缁樻尭缁绘劙鍩為幋锔藉€烽柟瀛樼箓閺嗘瑦銇勮箛锝勭凹闁逛究鍔戦弫鎰板川閺夋垵鍙婃繝娈垮枛閿曘劌鈻嶉敐鍥у灊婵炲棙鍨跺畷澶愭煏婵炑冭嫰閺佸吋绻濋悽闈浶ラ柡浣规倐瀹曟垵鈽夐姀鈩冩珖濡炪倕绻愮€氱兘宕甸弴鐔翠簻闁规媽娉涢惁婊堟煛娴ｅ憡鍠橀柡宀嬬到铻ｉ柟绋挎捣瑜把冣攽閻愯尙澧旈柛妤佸▕楠炲啫鐣￠柇锔惧弳闂佸憡鍔︽禍鐐村閸モ晝纾藉〒姘搐閺嬫稒銇勯鐘插幋鐎殿噮鍋婇獮鍥敇閻愮數鐛┑鐘垫暩婵挳骞夊☉銏犲嵆闁靛骏绱曢崢鐢告⒑缂佹ɑ灏繛瀵稿厴楠炴鎮╅悽鐢碉紲闁诲函缍嗘禍鐐存櫠閿旈敮鍋?   *   濠电姷鏁告慨鐑姐€傞鐐潟闁哄洢鍨圭壕濠氭煙鏉堝墽鐣辩痪鎯х秺閺岋繝宕堕埡浣圭€惧┑鐐叉噽婵炩偓妤犵偞鐗曡彁妞ゆ巻鍋撳┑陇鍋愰惀顏堝箚瑜滈悡濂告煛鐏炶濡奸柍瑙勫灴瀹曢亶鍩￠崒鍌︾畵濮婄粯鎷呴弬銈夌崪闂佺锕ョ换鍫濐嚕婵犳碍鍋勯柛蹇氬亹閸旂兘姊洪幐搴㈢５闁稿鎸婚〃銉╂倷鏉堟崘鈧潡鏌＄仦鍓ф创濠碘剝鎮傛俊鐑芥晲閸涱剙鍨濋梻鍌欐祰椤曟牠宕板☉顫稏濠㈣泛鐬肩粻鏃堟煟閺傛寧鎲哥紒鈾€鍋撻梻浣告啞濞诧箓宕ｈ箛鏇燁潟闁汇垹鎲￠埛鎺懨归敐澶樻濞戞捁灏欑槐鎺楁嚑閼哥數銆婇梺鍛婂笚鐢繝銆佸☉姗嗙叆闁告侗鍨抽崢顖氣攽閻樺灚鏆╁┑顔碱嚟閳ь剚鐨滈崶褏锛涢梺鐟板⒔缁垶寮查弻銉ョ閻庢稒顭囩粻姗€鏌ｉ埡渚€顎楁い顏勫暣婵″爼宕橀妸銏犱壕闁哄洢鍨圭粻鐘荤叓閸ャ劍绀冪€规洖寮剁换娑㈠箣閻愬灚鍣х紓浣稿閸嬨倝寮诲☉銏╂晝闁挎繂娲ㄩ悾闈涱渻閵堝骸澧柣妤佹尭椤繐煤椤忓嫬绐涙繝鐢靛Т鐎氼參宕宠閳规垿鍩ラ崱妞剧凹闂佽崵鍟块弲鐘充繆閹绢喖绀冩い鏂挎閵娾晜鐓冮弶鐐村鐎靛ジ鏌嶉崫鍕櫤闁绘挸鍟撮弻娑樷攽閸℃鈧秹鏌涢鐘插姎缁炬儳顭烽弻鐔兼倷椤掍胶浼囧┑鈩冨絻閻楁捇寮婚弴锛勭杸闁哄洨鍊妷鈺傜叆婵炴垶鐟уú瀛樹繆椤愩垺鍤囨い銏℃礋婵偓闁炽儲鍓氬Σ杈ㄧ節閻㈤潧浠滄い锔诲弮瀹曟劕鈹戠€ｎ亝妲梺璺ㄥ枔婵潙顔忓┑鍥ヤ簻闁哄啫娲よ闂佺粯绻嶉崑濠囧蓟閿濆棙鍎熼柍銉ュ暱鏉堝懘姊虹粙娆惧剱闁圭懓娲璇差吋閸偅顎囬梻浣告啞閹稿鎯勯姘辨殾婵娉涚粻鎶芥煙閸喖鏆為弫鍫ユ⒑閸︻厼甯堕柣掳鍔戦弫瀣箾鐎涙鐭嬮柛搴㈠▕濠€渚€姊洪幐搴ｇ畵闁瑰啿閰ｅ鎼佸Χ閸℃瑧顔曢梺绋跨箳閸樠勬叏閸劲搴ㄥ炊瑜濋煬顒併亜閵忊剝绀嬮柟顔规櫅闇夐悗锝庝簷婢规洟姊洪崫鍕偍闁搞劌缍婇幃鈥斥攽鐎ｎ偆鍘搁梺鍛婂姂閸斿孩鏅堕弴銏＄厱婵°倓绀侀埢鏇㈡煛鐏炵晫效闁圭锕ュ鍕偓锝呯仛閿涗線姊绘担钘壭撻柛銊ф暬钘濋柣銏㈩焾閽冪喖鏌ㄥ┑鍡╂Ч闁稿瀚伴弻娑樷槈濮楀牆濮涘銈忚礋閸庨亶鍩為幋锕€鐓￠柛鈩冦仦缁ㄨ偐绱撴担鍓插剱闁搞劌缍婂畷锝夊川椤斿墽鐦堥梺姹囧灲濞佳冪摥婵犵數鍋涢惇浼村磹濞戞碍宕?   *
   * 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸弫鎾绘偐閸愬弶鐤勫┑掳鍊х徊浠嬪疮椤愩倐鍋撳顒夋Ч闁靛洤瀚伴獮鎺楀幢濡炴儳顥氬┑锛勫亼閸娿倖绂嶅鍫濈柈闁哄鍨归弳锕傛煙閻戞ê鐏嶆俊鎻掔墦閺屸€愁吋韫囨搩娲┑鐐差槸閿曨亜顫忕紒妯诲闁告稑锕ら弳鍫濐渻閵堝啫濡奸柣妤佹尭閻ｇ兘骞嬪┑鍐╊潔濠电姴锕ょ€涒晛顭块弽褉鏀介柣妯虹仛閺嗏晠鏌涚€ｎ剙浠辩€规洖缍婂畷濂稿即閻愭鍞堕梻浣稿閸嬪懎煤閺嶎偄顥氱憸鐗堝笚閻撴瑩鏌涢幘妤€鎳庣粭锟犳⒑缂佹ɑ灏柛濠傛贡閹广垹鈹戦崶鈺冪槇闂佺鏈崙瑙勫鐏炶В鏀介柣鎰皺婢ф梻绱掗鐣屾噰鐎殿喖顭峰鎾偄閾忚鍟庨梻浣虹帛閸旓箓宕滃鑸靛仧闁挎洖鍊归埛?
   *   - chin_control / chin: Y 闂傚倸鍊搁崐椋庣矆娓氣偓楠炴牠顢曚綅閸ヮ剚鐒肩€广儱鎳愰敍娑㈡⒑缂佹ɑ鈷掗柛搴涘€曢悾鐑藉矗婢跺瞼鐦堥梻鍌氱墛缁嬫挻鏅堕姀銏㈢＜闁逞屽墯缁绘繈宕堕妸褍骞堟繝鐢靛仦閸ㄩ潧鐣烽鍕€堕柨婵嗩槹閻?(濠电姷鏁告慨鐑藉极閹间礁纾婚柣鎰惈閸ㄥ倿鏌涢锝嗙缂佺姳鍗抽弻鐔兼⒒鐎垫瓕绐楅梺杞扮鐎氫即寮诲☉妯锋婵炲棙鍔楃粙鍥⒑濞茶骞楁い銊ョ墦閸┾偓妞ゆ巻鍋撶紒鐘茬Ч瀹曟洟宕￠悙宥嗙☉閳藉濮€閻橀潧骞掗梻浣告惈閸燁偊鎮ф繝鍥х９闁汇垹鎲￠悡銉︾節闂堟稒顥㈡い搴㈩殔闇夋繝濠傚閻鏌?
   *   - mouth: scaleY 缂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮缁炬儳缍婇弻锝夊閵忊晝鍔搁梺姹囧€楅崑鎾舵崲濠靛洨绡€闁稿本绮岄。鍝勨攽?(闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏇炲€哥粻鏍煕椤愶絾绀€闁搞劌鍊块弻娑樷攽閸℃浼岄梺缁樺笩婵倗鎹㈠☉銏犲耿婵☆垵顕х喊宥囩磽閸屾瑨顔夐柡鍛矒婵＄敻宕熼鍓ф澑闂佸湱鍋撻崜姘瀹€鍕拺闁硅偐鍋涢埀顒佺墪鐓ら柣鏃傚帶閽冪喓鈧箍鍎遍悧婊冾瀶閵娾晜鈷戦柛娑橈攻鐏忕敻鏌涢悩鏌ュ弰闁?
   */
  setSpineTalking(idolId, isTalking, volumeCallback = null) {
    const entry = this.spineInstances[idolId]
    if (!entry) {
      if (isTalking && volumeCallback) {
        this._pendingTalking[idolId] = { volumeCallback }
        console.log(`[PixiStageManager] Queued lip-sync for "${idolId}" until spine load`)
      } else {
        delete this._pendingTalking[idolId]
      }
      return
    }
    const { spine } = entry

    spine.customIsTalking = isTalking
    if (isTalking && volumeCallback) {
      spine.getVoiceVolume = volumeCallback
    } else if (!isTalking) {
      delete this._pendingTalking[idolId]
      delete spine.getVoiceVolume
    }

    if (!spine._lipSyncHooked) {
      // 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾鐎规洦鍨跺畷绋课旈埀顒勫磼閵婏妇绡€濠电姴鍊绘晶鏇犵棯閹岀吋闁哄瞼鍠栧畷婊嗩槾閻㈩垱鐩弻锝夊箻閸愬弶娈婚梺鍝勬湰缁嬫牜绮诲☉銏犵闁告劏鏁╅敂鐣岀?闂傚倸鍊搁崐鎼佸磹瀹勬噴褰掑炊椤掑﹦绋忔繝銏ｆ硾椤戝洭銆呴幓鎹楀綊鎮╁顔煎壈闂佹悶鍔岄崐鍧楀蓟瑜戠粻娑㈠箻绾惧顢呴梻浣规た閸樺ジ鎮ч幘璇茶摕闁绘棁娅ｇ壕濂告煏韫囨洖校闁诲繐鐗忕槐鎾存媴閸濆嫅鐐烘煕鎼达絾鏆€殿喛顕ч濂稿醇椤愶綆鈧洭姊绘担鍛婂暈闁规悂绠栧畷鐗堟償椤垶鏅梺鎸庣箓椤︻垶宕归崒娑栦簻闁规壋鏅涢悘顔剧磼閹邦喖浠︾紒缁樼箞閹粙妫冨ù韬插灲閺屾稒绻濋崨顓炴優缂備緡鍠楅悷锕€顕ラ崟顖氱疀妞ゆ挻绋掔€氬ジ姊绘担铏瑰笡闁瑰摜顭堥湁闂佸灝顑囬々閿嬬箾閹寸偟鎳勯柛娆忕箰閳规垿鎮╅崣澶婎€涢梺鎼炲€栭悷鈺佄涙担鐟扮窞濠电姴娴烽崬鐢告⒑閸忓吋鍊愭繛浣冲嫭鍙忛柛銉㈡櫇绾惧ジ鏌嶈閸撶喎鐣烽幒妤佸€烽悗鐢殿焾瀵即姊绘繝搴′簻婵炴潙瀚濠囨嚍閵壯屾锤濠电姴锕ら幊鎰婵傚憡鐓犵痪鏉垮船婢т即鎮介娑氣槈閼?闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾鐎规洦鍨跺畷绋课旈埀顒勫磼閵婏妇绡€濠电姴鍊绘晶鏇犵棯閹岀吋闁哄瞼鍠栧畷婊嗩槾閻㈩垱鐩弻锝夊箻閸愬弶娈婚梺鍝勬湰缁嬫牜绮诲☉銏犵闁告劏鏁╅敂鐣岀?
      const mouthSlot = spine.skeleton.slots.find(s => /^mouth$/i.test(s.data.name))
      const mouthClipSlot = spine.skeleton.slots.find(s => /^mouth_clip$/i.test(s.data.name))
      const tongueSlot = spine.skeleton.slots.find(s => /^tongue$/i.test(s.data.name))
      const toothTopSlot = spine.skeleton.slots.find(s => /^tooth_top$/i.test(s.data.name))
      const toothBotSlot = spine.skeleton.slots.find(s => /^tooth_bottom$/i.test(s.data.name))

      if (!mouthSlot) return

      // 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾鐎规洦鍨跺畷绋课旈埀顒勫磼閵婏妇绡€濠电姴鍊绘晶鏇犵棯閹岀吋闁哄瞼鍠栧畷婊嗩槾閻㈩垱鐩弻锝夊箻閸愬弶娈婚梺鍝勬湰缁嬫牜绮诲☉銏犵闁告劏鏁╅敂鐣岀?闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸弫鎾绘偐閸愯弓鐢婚梺鍝勵槸閻楀啴寮插┑鍫㈢焼濠电姴娲﹂悡鍐喐濠婂牆绀堥柣鏃傚帶閽冪喐绻涢幋鐑嗙劯闁绘柨鍚嬮崑锟犳煛婢跺孩纭堕柕鍫櫍濮婄粯鎷呯粵瀣異闂佹悶鍔嶆竟鍡涘焵椤掍礁鍤柛鐘冲哺瀹曟岸骞掗幋鏃€鐎婚梺瑙勫劤閸熷潡鎮楅鐑嗘富闁靛牆妫欓ˉ鍡涙煕鐎ｎ偄濮夌紒顔界懇楠炲鈹戦崘鈺傛澑闂佸湱鍎ゆ繛濠傜暦閹邦儵鏃€鎷呴悷鏉夸紟濠电偞娼欓崥瀣焽濞嗘垹鐭嗗鑸靛姈閻撴瑩寮堕崼鐔峰姢闁伙附绮撻弻?闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾鐎规洦鍨跺畷绋课旈埀顒勫磼閵婏妇绡€濠电姴鍊绘晶鏇犵棯閹岀吋闁哄瞼鍠栧畷婊嗩槾閻㈩垱鐩弻锝夊箻閸愬弶娈婚梺鍝勬湰缁嬫牜绮诲☉銏犵闁告劏鏁╅敂鐣岀?
      const mouthBone = spine.skeleton.findBone('mouth')
      const mouthDataScaleX = mouthBone ? mouthBone.data.scaleX : 1
      const mouthDataScaleY = mouthBone ? mouthBone.data.scaleY : 1
      const mouthCloseBone = spine.skeleton.findBone('mouth_close')
      const mouthCloseDataScaleX = mouthCloseBone ? mouthCloseBone.data.scaleX : 1
      const mouthCloseDataScaleY = mouthCloseBone ? mouthCloseBone.data.scaleY : 1
      const toothBone = spine.skeleton.findBone('tooth')
      const tongueBone = spine.skeleton.findBone('tongue')
      const chinControlBone = spine.skeleton.findBone('chin_control')
      const chinControlBaseY = chinControlBone ? chinControlBone.data.y : 0
      const mouthSlotBone = mouthSlot.bone?.data?.name || 'mouth'
      const isChildRig = mouthSlotBone === 'mouth_close'

      // 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾鐎规洦鍨跺畷绋课旈埀顒勫磼閵婏妇绡€濠电姴鍊绘晶鏇犵棯閹岀吋闁哄瞼鍠栧畷婊嗩槾閻㈩垱鐩弻锝夊箻閸愬弶娈婚梺鍝勬湰缁嬫牜绮诲☉銏犵闁告劏鏁╅敂鐣岀?婵犵數濮烽弫鍛婃叏閻戝鈧倿鎸婃竟鈺嬬秮瀹曘劑寮堕幋鐙呯幢闂備線鈧偛鑻晶鎾煛鐏炲墽銆掗柍褜鍓ㄧ紞鍡涘磻閸涱垯鐒婇柟娈垮枤绾捐偐绱撴担璇＄劷婵炴彃顕埀顒侇問閸犳牠鎮ユ總鍝ュ祦閻庯綆鍣弫鍥煟閹邦厼绲绘い銉﹀姉缁辨捇宕掑顑藉亾妞嬪孩顐介柨鐔哄Т闂傤垱銇勯弽顐沪闁抽攱妫冮弻娑㈠即閵娿儳浠滈梺閫炲苯澧柛鐔风摠娣囧﹪鎮滈挊澶屽幐婵炶揪绲界€氀囧疾濠靛绠熼柟闂寸缁狅綁鏌ㄩ弮鍥т汗缂佸绻樺娲箰鎼淬垻顦ラ梺绋匡工缂嶅﹪骞冮敓鐘插嵆闁靛骏绱曢崢顏呯節閻㈤潧浠滈柣蹇旂箞瀹曟繈骞橀鐣屽幈闁瑰吋鐣崹濠氭儗瀹€鈧槐鎺撴綇閵娿儳鐟插┑鐐靛帶缁绘﹢宕洪敓鐘茬＜闁靛牆瀚、姒th slot 缂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌ｉ幋锝呅撻柛濠傛健閺屻劑寮撮悙娴嬪亾閹间礁鍨傞柛宀€鍋為埛鎺楁煕椤愩倕鏋庨柛鐘虫礋閺屻倝鎮ч崼婵愬殝闂侀潧娲ょ€氼垳绮诲☉銏犵閻犺桨璀﹂弳顐⑩攽閻愭妫庨柛瀣姈閹便劑鎮界粙璇撅箓鏌涢弴銊ユ灓闁汇倐鍋撻梻浣筋潐瀹曟ê鈻嶉弴鐐╂灁濠电姵纰嶉埛鎴︽煙閼测晛浠滈柍褜鍓氬ú鐔笺€侀弽顓炲窛闁规鍠曠花鐑芥⒒閸屾瑨鍏岀紒顕呭灦閺佸啴鍩￠崨顓犵崶闂佸搫绉查崝宥夊矗韫囨稒鐓曢悘鐐插⒔閳笺倕霉濠婂嫮鐭掓鐐寸墪鑿愭い鎺嗗亾闁诲浚鍣ｉ弻宥夘敍濞戞瑧顦紓浣介哺鐢偤鍩€椤掑﹦绉靛ù婊嗘硾鍗遍柛锔诲幘绾捐偐绱撴担璇＄劷缂佺姵姘ㄧ槐鎺楁偐瀹曞洦鍒涢悗娈垮枟閹告娊骞冨▎鎾崇骇闁瑰瓨绻傞～鍫ユ⒒閸屾艾鈧悂宕愭搴ｇ焼濞撴埃鍋撶€规洦鍨跺畷绋课旈埀顒勫磼閵婏妇绡€濠电姴鍊绘晶鏇犵棯閹岀吋闁哄瞼鍠栧畷婊嗩槾閻㈩垱鐩弻锝夊箻閸愬弶娈婚梺鍝勬湰缁嬫牜绮诲☉銏犵闁告劏鏁╅敂鐣岀?
      // Determine whether this model uses the regular mouth rig or the child rig.
      // mouth_close is the child-specific base bone; regular rigs use mouth.
      const origUpdateWT = spine.skeleton.updateWorldTransform

      // 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾鐎规洦鍨跺畷绋课旈埀顒勫磼閵婏妇绡€濠电姴鍊绘晶鏇犵棯閹岀吋闁哄瞼鍠栧畷婊嗩槾閻㈩垱鐩弻锝夊箻閸愬弶娈婚梺鍝勬湰缁嬫牜绮诲☉銏犵闁告劏鏁╅敂鐣岀?闂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮闁汇値鍠楅妵鍕冀閵娧呯窗婵炲瓨绮岀紞濠囧蓟濞戙垹绠涢柛蹇撴憸閼虫椽姊虹紒妯虹瑨闁挎洏鍊濆﹢渚€姊虹紒妯忣亜螣婵犲洤纾块柟鎵閻撴盯鏌涘鈧粈浣规櫠椤栫偞鐓欏〒姘仢婵″ジ鏌嶇憴鍕伌鐎规洖銈搁、鏇㈡晲鎼粹剝鍊爕-catch 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸弫鎾绘偐閸愯弓缃曢梻浣告惈濞层垽宕归崷顓犱笉闁绘绮悡娆撴煕閹炬鎳庣粭锟犳⒑閸濆嫭濯奸柛鎾存皑閹广垹鈽夐姀鐘茶€垮┑鈽嗗灥椤曆呭枈瀹ュ鈷戦柛婵嗗閸庡酣鏌ら崘鎻掝暢婵″弶鍔欓獮妯兼嫚閺屻儱鏁归梻渚€娼х换鎺撴叏椤撱垹鍑犻柛娑樼摠閳?hook闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏃堟暜閸嬫挾绮☉妯诲櫧闁活厽鐟╅弻鐔衡偓鐢殿焾娴犙囨⒒閸曨偄顏柡宀嬬節瀹曟﹢濡歌椤ｈ櫣绱撴担鍝勑ｉ柣鎿勭節瀵寮撮敍鍕澑婵犵數濮撮崐鎼佸煕婢跺绡€婵炲牆鐏濋悘锟犳煙閸涘﹤鈻曠€殿喖顭烽弫鎾绘偐閼碱剙鈧偤姊虹€圭姵銆冮柣鎺炵畵瀵爼宕ㄦ繝鍕啎闂佸湱鍋撳娆撴倿瑜版帗鐓曢悗锝庡亝鐏忕敻鏌嶈閸撴繈锝炴径濞掓椽寮借閼板潡姊洪鈧粔鎾倿閸偁浜滈柟鐑樺煀閸旂喓绱掓径灞炬毈闁哄本鐩獮妯尖偓闈涙啞閸ｄ即鏌﹀Ο鐓庢瀾濞ｅ洤锕俊鍫曞川椤斿吋顏￠梻浣侯焾閿曪箓寮繝姘畺鐎瑰嫭澹嬮弸搴ㄧ叓閸ャ劍鎯勫ù鐘荤畺濮婂搫效閸パ冾瀴闂佹悶鍔屾晶搴ㄥ箲閵忕姭妲堥柕蹇曞█閸炲爼姊虹紒妯活棃妞ゃ儲鎸荤€电厧鐣濋崟顑芥嫼闂佸憡绻傜€氼垶锝為敃鍌涚厱闁哄倽娉曢悞鎼佹煕閳瑰灝鐏柟顖涙婵℃悂濡疯閸炵儤绻濋悽闈涒枅婵炰匠鍏炬稑鈻庨幙鍐╂櫓闂侀€炲苯澧存慨濠傤煼瀹曟帒顫濋钘変壕濡炲瀛╅浠嬫煥閻斿搫孝缂佹劖顨嗘穱濠囧Χ閸涱喖娅ｉ梺鎼炲妼閸婂湱鎹㈠┑瀣棃婵炴垶鑹鹃埅杈╃磽娴ｅ搫校闁哄被鍔戦垾锔炬崉閵婏箑纾繛鎾村嚬閸ㄤ即宕滈弶娆炬富闁靛牆妫欑粈澶婎渻鐎涙ɑ鍊愭鐐茬墦婵℃悂濡烽钘夌紦闂備胶纭堕崜婵嬨€冮崨杈剧稏闁宠桨绲奸弮鍫熷亹闂傚牊绋愰弶顓㈡⒑閹肩偛濡兼い顓犲厴瀹曟椽鍩€椤掍降浜滈柟鐑樺灥閺嬨倖绻涢崗鐓庡缂佺粯鐩獮鎾诲箳閺傛经鍛亾濞堝灝鏋熺憸鏉垮暣閳ワ箓濡搁埡浣哥獩濡炪倖鏌ㄩ崥瀣掗崶顒佲拻濞达綀娅ｉ妴濠囨煕閹惧绠樼紒顔界懇楠炲鏁傞挊澶屽絽闂備胶绮弻銊╁触鐎ｎ喗鍋傛繛鍡樻尰閻撴瑩鎮峰▎蹇擃仼濠殿喖鐗撻弻锝呪攽閹邦亪鍋楅梺鍝勬湰缁嬫帡骞嗛弮鍫濐潊闁挎稑瀚峰Σ褰掓⒒?闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾鐎规洦鍨跺畷绋课旈埀顒勫磼閵婏妇绡€濠电姴鍊绘晶鏇犵棯閹岀吋闁哄瞼鍠栧畷婊嗩槾閻㈩垱鐩弻锝夊箻閸愬弶娈婚梺鍝勬湰缁嬫牜绮诲☉銏犵闁告劏鏁╅敂鐣岀?
      spine.skeleton.updateWorldTransform = function () {
        try {
          const currentAtt = mouthSlot.attachment
          if (!currentAtt?.name) return

          const match = currentAtt.name.match(/^(mouth_(.+?))(\d)$/i)
          if (!match) return

          const exp = match[2]

          const lipValue = (spine.customIsTalking && spine.getVoiceVolume) ? Math.min(1, Math.max(0, spine.getVoiceVolume())) : 0
          const isOpen = lipValue > ORIGINAL_LIP_OPEN_THRESHOLD

          if (isOpen) {
            const mouthEntry = spine._mouthData?.mouthes?.find(m => m.animationName === `face_${exp}`)
            const openName = mouthEntry?.openMouthAttachmentName || `mouth_${exp}2`
            if (currentAtt.name !== openName) {
              spine.skeleton.setAttachment('mouth', openName)
            }

            const openRatio = lipValue
            const mouthOpenScale = mouthEntry?.openMouthScale ?? FALLBACK_LIP_OPEN_SCALE
            const dynScaleY = ORIGINAL_LIP_SCALE_MIN + openRatio * (mouthOpenScale - ORIGINAL_LIP_SCALE_MIN)

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
              // Regular rigs keep the mouth/head scaling behavior here.
              // Child rigs use a separate close-mouth bone path below.
            }
            if (tongueSlot && mouthEntry?.tongueAttachmentName) {
              spine.skeleton.setAttachment('tongue', mouthEntry.tongueAttachmentName)
            }
            if (toothTopSlot && mouthEntry?.upperTeethAttachmentName) {
              spine.skeleton.setAttachment('tooth_top', mouthEntry.upperTeethAttachmentName)
            }
            if (toothBotSlot && mouthEntry?.lowerTeethAttachmentName) {
              spine.skeleton.setAttachment('tooth_bottom', mouthEntry.lowerTeethAttachmentName)
            }
            if (mouthClipSlot && mouthEntry?.openMouthClipAttachmentName) {
              spine.skeleton.setAttachment('mouth_clip', mouthEntry.openMouthClipAttachmentName)
            }
            if (Array.isArray(mouthEntry?.attachmentsWhenOpenMouth)) {
              for (const attachment of mouthEntry.attachmentsWhenOpenMouth) {
                const slotName = attachment?.slotName || attachment?.slot || attachment?.name
                const attachmentName = attachment?.attachmentName || attachment?.attachment
                if (slotName && attachmentName) {
                  spine.skeleton.setAttachment(slotName, attachmentName)
                }
              }
            }

            if (!spine._lipSyncDumpFired) {
              if (spine._lipSyncDumpCounter === undefined) spine._lipSyncDumpCounter = 0
              spine._lipSyncDumpCounter++
              if (spine._lipSyncDumpCounter >= 5) {
                spine._lipSyncDumpFired = true
                console.log(`[LipSync] ${idolId} exp=${exp} mode=original value=${lipValue.toFixed(3)}`)
              }
            }
          } else {
            const closeName = `mouth_${exp}1`
            if (currentAtt.name !== closeName) {
              spine.skeleton.setAttachment('mouth', closeName)
            }
            if (mouthBone) { mouthBone.scaleX = mouthDataScaleX; mouthBone.scaleY = mouthDataScaleY }
            // 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偞鐗犻、鏇㈡晝閳ь剟鎮块鈧弻锝呂旈埀顒勬偋婵犲洤鐭楅煫鍥ㄦ嫻閺冨牊鏅查柛娑卞幗閻忔捇姊?adult/child rig 闂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ穿缂嶆牠鎮楅敐搴℃灈缂佲偓閸愵喗鐓冮柛婵嗗閺嗙喖鏌涘鍡楀缂佽鲸鎹囧畷鎺戔枎閹存繂顬夋俊鐐€戦崝宀勫箠濡寧顥ら梻浣告惈椤︿即顢栧▎鎾冲惞婵°倕鎳忛悡鏇㈡煛閸ャ儱濡煎ù婊€绮欓弻娑橆潩椤掑鍓堕梺鍝勬湰閻╊垰顕ｉ幘顔嘉╅柕澶堝劤椤旀帡鏌?tooth/tongue闂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ礀绾惧鏌曟繛鐐珔缁炬儳娼￠弻锛勪沪鐠囨彃濮庨梺钘夊暟閸犳牠寮婚妸鈺傚亜闁告繂瀚呴姀銈嗙厽闁圭儤鍨规禒娑㈡煏閸パ冾伃妤犵偞甯掗濂稿炊瑜嶉‖澶愭⒒娴ｇ懓鈻曢柡鈧柆宥呯婵炲棙鎸搁拑鐔哥箾閹存瑥鐏╅幆鐔兼⒑閹稿孩鐓ュ褌绮欓幃鈩冩媴閾忓湱锛濇繛杈剧悼椤牓鍩€椤掆偓濠€閬嶅极椤曗偓閺佹捇鎮╅鐟颁壕濞撴埃鍋撶€殿喕绮欓、鏇㈡晲閸涱垽绱￠梻鍌欑窔濞佳嗗櫣闂佸憡娲﹂崑鍛存倶閳ь剛绱撻崒姘偓鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮缁炬儳缍婇弻锝夊閵忊晝鍔搁梺姹囧€楅崑鎾舵崲濠靛洨绡€闁稿本绮岄。鍝勨攽閳藉棗浜濋柨姘舵婢舵劖鐓ユ繝闈涙婢ф垿鏌嶈閸忔﹢宕戦幘缁樷拺缂佸顑欓崕鎰版煙閻熺増鍠樻鐐插暣閹粓鎸婃径宀勭崜闂備礁婀遍…鍫⑩偓娑掓櫊椤㈡﹢骞愭惔锝囩槇?
            if (chinControlBone) chinControlBone.y = chinControlBaseY
            if (mouthCloseBone) mouthCloseBone.scaleY = mouthCloseDataScaleY
            if (mouthEntry?.closeMouthAttachmentName && currentAtt.name !== mouthEntry.closeMouthAttachmentName) {
              spine.skeleton.setAttachment('mouth', mouthEntry.closeMouthAttachmentName)
            }
            if (tongueSlot && mouthEntry?.tongueAttachmentName) {
              spine.skeleton.setAttachment('tongue', mouthEntry.tongueAttachmentName)
            }
            if (toothTopSlot && mouthEntry?.upperTeethAttachmentName) {
              spine.skeleton.setAttachment('tooth_top', mouthEntry.upperTeethAttachmentName)
            }
            if (toothBotSlot && mouthEntry?.lowerTeethAttachmentName) {
              spine.skeleton.setAttachment('tooth_bottom', mouthEntry.lowerTeethAttachmentName)
            }
            if (mouthClipSlot && mouthEntry?.openMouthClipAttachmentName) {
              spine.skeleton.setAttachment('mouth_clip', mouthEntry.openMouthClipAttachmentName)
            }
            if (Array.isArray(mouthEntry?.attachmentsWhenCloseMouth)) {
              for (const attachment of mouthEntry.attachmentsWhenCloseMouth) {
                const slotName = attachment?.slotName || attachment?.slot || attachment?.name
                const attachmentName = attachment?.attachmentName || attachment?.attachment
                if (slotName && attachmentName) {
                  spine.skeleton.setAttachment(slotName, attachmentName)
                }
              }
            }
          }
        } catch (e) {
          console.warn(`[LipSync] updateWorldTransform error for "${idolId}":`, e)
        }
        origUpdateWT.call(this)
      }

      spine._lipSyncHooked = true
      // 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾鐎规洦鍨跺畷绋课旈埀顒勫磼閵婏妇绡€濠电姴鍊绘晶鏇犵棯閹岀吋闁哄瞼鍠栧畷婊嗩槾閻㈩垱鐩弻锝夊箻閸愬弶娈婚梺鍝勬湰缁嬫牜绮诲☉銏犵闁告劏鏁╅敂鐣岀?闂傚倸鍊搁崐宄懊归崶褏鏆﹂柛顭戝亝閸欏繘鏌熺紒銏犳珮闁轰礁瀚伴弻娑樷槈濞嗘劗绋囬梺姹囧€ら崳锝夊蓟閻旂厧绠氶柡澶婃櫇閹剧粯鐓曢幖绮规閺€濠氭煏閸パ冾伃鐎殿喕绮欓、鏇綖椤撶喎濯伴梻鍌欑閹碱偊骞忕€ｎ喖绀堟慨妯挎硾缁犵偤鏌曟繛鍨姶婵炵鍔戦弻娑㈠焺閸愮偓鐣剁紓浣哄У濡炶棄顫忛悜妯侯嚤婵炲棙鍨归弳鐘电磽閸屾氨孝闁挎洏鍊濋敐鐐剁疀閺冨倻鐦堝┑顔斤供閸撴盯宕愰悙鐑樷拺闂傚牊渚楅悞楣冩煕鎼达紕锛嶇紒顔硷躬閹粓鎳為妷銏″缂傚倷绶￠崹鍗灻哄Ο琛℃瀺闁告稑鐡ㄩ悡鐔搞亜閹捐泛浠滈柍褜鍓氶幃鍌炲箖閹呮殝闁归攱姊瑰Λ鍐ㄧ暦閵娾晩鏁囬柛銉稻濞呭﹪鏌＄仦鐐缂佹梻鍠栭、娑橆潩椤掑鐥梺璇插绾板秵绻涙繝鍌ゆ綎缂備焦蓱婵挳鏌ｉ悢鐓庝喊闁搞倕顑囩槐鎾存媴閸撴彃鍓遍梺鎼炲妼濞硷繝鐛繝鍥ㄥ亜缁炬媽椴搁弲顒€鈹戦缂存垵鐣峰鈧崺鈧い鎺嶇椤曟粓鏌曢崶褍顏紒鐘崇洴楠炴鎹勬笟顖涙瘒缂傚倸鍊烽懗鑸垫叏鐎电顥氭い鎾卞灩缁犵喓绱掔€ｎ偒鍎ラ柛姘儏椤法鎹勯悮瀛樻暰濠碘€虫▕閸撴瑩鍩為幋鐐茬疇闂佺锕ュú鐔肩嵁婵犲啯鍎熼柕濠忕畱閸撶懓鈹戞幊閸婃洟骞婅箛娑欏亗婵炲棙鍔楃粻楣冩煕椤愶絿绠樺ù鐘灲閺岋紕鈧綆鍓欓弸鏃傜磼鏉堛劌绗х紒杈ㄥ浮婵偓闁绘ê鍚€濡楁捇姊绘担鍛婃儓闁活剙銈稿畷浼村冀椤撶姴绁︽繛鎾村焹閸嬫挻顨ラ悙鏉戞诞妤犵偛顑呴埞鎴﹀幢閳哄倹绗庨梻?_s('040ren') 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸弫鎾绘偐椤旂懓浜鹃柛鎰靛枛瀹告繈鏌℃径瀣仼闁哄苯鐗撳娲礂閻撳骸顫梺鍓茬厛閸撴氨绮嬪鍫涗汗闁圭儤鎸鹃崢鎼佹煟韫囨洖浠╂い鏇嗗洤绀夋慨妯夸含绾惧ジ鏌ｅΟ鍝勬毐闁崇粯娲熼弻锛勪沪閻愵剛顦紓浣哄У閻╊垱淇婇悿顖ｆЬ闂佹寧绋撻崰鏍ь潖濞差亜宸濆┑鐘插閸犳盯姊?闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾鐎规洦鍨跺畷绋课旈埀顒勫磼閵婏妇绡€濠电姴鍊绘晶鏇犵棯閹岀吋闁哄瞼鍠栧畷婊嗩槾閻㈩垱鐩弻锝夊箻閸愬弶娈婚梺鍝勬湰缁嬫牜绮诲☉銏犵闁告劏鏁╅敂鐣岀?
      if (!window._s) window._s = {}
      window._s[idolId] = spine
      // 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾鐎规洦鍨跺畷绋课旈埀顒勫磼閵婏妇绡€濠电姴鍊绘晶鏇犵棯閹岀吋闁哄瞼鍠栧畷婊嗩槾閻㈩垱鐩弻锝夊箻閸愬弶娈婚梺鍝勬湰缁嬫牜绮诲☉銏犵闁告劏鏁╅敂鐣岀?濠电姷鏁告慨鐑藉极閹间礁纾块柟瀵稿Т缁躲倝鏌﹀Ο渚＆婵炲樊浜濋弲婊堟煟閹伴潧澧幖鏉戯躬濮婃椽宕ㄦ繝鍐槱闂佹悶鍔嶅妯绘櫏闂佸搫琚崕鏌ユ偂閸愵亝鍠愭繝濠傜墕缁€鍫ユ煟閺冨倸甯堕柦鍐枛閺岋綁寮崒姘闁诲繐绻戠敮鎺椻€︾捄銊﹀磯闁绘碍娼欐导鎰版⒑閸濆嫭顥為柣鐔叉櫊瀵鏁愭径濠勵啋闂佸搫顦伴崹瑙勫瀹€鍕拺闁告繂瀚﹢鎵磼鐎ｎ偄鐏撮柛鈹垮灪閹棃濡搁妷褜鍚呮繝鐢靛Т閻忔岸宕濋弽顬帗寰勯幇顓涙嫼濠殿喚鎳撳ú銈夋倿濞差亝鐓曟い顓熷灥閻忥妇鈧娲╃换婵嗙暦濡警鍟呮い鏂垮悑椤撳灝鈹戦悩鍨毄濠殿喚鏁婚幊婵嬪箚瑜庨弳婊堟⒒閸屾瑧绐旀繛浣冲泚鍥敇閵忕姷锛熼梺鍛婎殘閸婎偉顦圭€殿喖顭锋俊鐑芥晜鐟欏嫬顏?闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾鐎规洦鍨跺畷绋课旈埀顒勫磼閵婏妇绡€濠电姴鍊绘晶鏇犵棯閹岀吋闁哄瞼鍠栧畷婊嗩槾閻㈩垱鐩弻锝夊箻閸愬弶娈婚梺鍝勬湰缁嬫牜绮诲☉銏犵闁告劏鏁╅敂鐣岀?
      if (!window._probe) window._probe = {}
      window._probe[idolId] = () => {
        console.log(`[Probe] ${idolId} available via window._s['${idolId}']`)
      }
    }

    // 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾鐎规洦鍨跺畷绋课旈埀顒勫磼閵婏妇绡€濠电姴鍊绘晶鏇犵棯閹岀吋闁哄瞼鍠栧畷婊嗩槾閻㈩垱鐩弻锝夊箻閸愬弶娈婚梺鍝勬湰缁嬫牜绮诲☉銏犵闁告劏鏁╅敂鐣岀?闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸崹楣冨箛娴ｅ湱绋佺紓鍌氬€烽悞锕佹懌闂佸憡鐟ョ换姗€寮婚悢纰辨晬闁挎繂娲ｅЧ妤呮偡濠婂懎顣奸悽顖涘浮閹瑦绻濋崶銊у帗闂佸憡绻傜€氼剟鍩€椤掍焦鍊愮€殿喗鎮傚畷鎺楁倷缁瀚奸梻渚€娼荤€靛矂宕㈡總绋跨閻庯綆鍋嗙粻楣冩煕濞嗗浚妲哄褏鏁婚幐濠囨偄閼测晛褰勯梺鎼炲劘閸斿酣鍩婇弴銏＄厽闁规儳鐡ㄧ粈瀣煛鐏炵偓绀夌紒鐘崇⊕缁绘繈宕掑锝嗗珶闂備浇顕х换鎰殽韫囨洜涓嶉柟鎹愵嚙閽冪喐绻涢幋鐐垫噭闁稿海鍠栭弻鏇＄疀婵炴儳浜鹃柛鎰级閺侇亪姊婚崒娆戭槮闁圭⒈鍋婇幊鐔碱敍閻愬瓨娅囬梺闈涚墕椤︿粙寮崶褉鏀介柛灞剧矤閻掗箖鏌ｉ幇顒婅含闁哄苯绉瑰畷顐﹀礋椤愮喎浜惧┑鐘宠壘閻?(mouthsetting) 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾鐎规洦鍨跺畷绋课旈埀顒勫磼閵婏妇绡€濠电姴鍊绘晶鏇犵棯閹岀吋闁哄瞼鍠栧畷婊嗩槾閻㈩垱鐩弻锝夊箻閸愬弶娈婚梺鍝勬湰缁嬫牜绮诲☉銏犵闁告劏鏁╅敂鐣岀?
    if (isTalking && !spine._mouthData) {
      this._loadMouthSetting(idolId, spine)
    }
  }

  /**
   * 闂傚倸鍊峰ù鍥敋瑜忛埀顒佺▓閺呯娀銆佸▎鎾冲唨妞ゆ挾鍋熼悰銉╂⒑閸濆嫮鈻夐柛妯垮亹婢规洟宕烽鐔锋瀾闂佺粯顨呴悧鍡樼┍椤栫偞鐓涘ù锝呮啞椤ャ垽鏌″畝瀣М妤犵偛娲、妤佹媴閻熸澘澹嶇紓鍌氬€风拋鏌ュ磻閹炬剚鐔嗛柤鎼佹涧婵牓鏌ｉ幘璺烘瀾濞ｅ洤锕、娑橆煥閸愩劋绮梻浣告啞閺屻劑顢栭崶鈺傤潟?mouthsetting JSON闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏃堟暜閸嬫挾绮☉妯诲櫧闁活厽鐟╅弻鐔告綇妤ｅ啯顎嶉梺绋垮濡啴寮婚妶鍚ゅ湱鈧綆鍋呴悵鏇烆渻閵堝骸浜濇繛鑼枛瀵濡搁埡浣虹潉闂佸壊鍋嗛崰鎰枔娴煎瓨鈷戠紒瀣儥閸庢劙鏌熼崨濠冨€愰柛鈹垮劜瀵板嫭绻涢悙顒傗偓鍝勵渻閵堝棙瀵欓柛宀€鍋涙禒鎰版煟?spine._mouthData闂?   * 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸弫鎾绘偐閸愬弶鐤勯梻浣筋嚃閸ㄥジ鎮橀幇顖樹汗闁圭儤鎸搁埀顒€顭烽弻銈夊箒閹烘垵濮庢繛瀵稿У濡炰粙寮婚敐澶嬪亹闁告瑥顦ˇ鈺呮⒑娴兼瑧绉甸柛瀣躬閻涱噣骞掑Δ鈧崡鎶芥煟濡櫣浠涙繝銏″灴濮婅櫣娑甸崨顓ф闂佽妞挎禍鐐垫閻愬搫骞㈡俊顖欒閸ゃ倝姊洪幖鐐插姶闁告挻宀搁幃?updateWorldTransform 闂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ礀绾惧潡鏌ｉ姀銏╃劸闁汇倗鍋撶换娑㈠箣濞嗗繒浠鹃梺绋款儍閸婃繈寮婚弴鐔虹鐟滃秶鈧凹鍘奸埢鎾村鐎涙鍘介柟鍏肩暘閸斿秴鈽夎閺岀喓鎷犺绾惧潡鏌嶈閸撴氨鍠婂鍛殕闁归棿绀佺粻鏍喐閻楀牆绗掗柣鎰躬閺屾洘绻涢崹顔煎Б缂備椒绶氶ˉ鎾舵閹惧瓨濯撮柦妯侯槼閺佸灝鈹戦悙宸Ч婵炲弶绮屽嵄闁圭増婢樼粻濠氭偣閸ヮ亜鐨洪柨娑欑矊閳规垿鎮欓弶鎴犱桓闂佽崵鍠嗛崕鎶藉窗婵犲偆鍚嬪璺侯儌閹锋椽鏌ｆ惔锝嗩仧闂傚嫬瀚…鍨熺紒妯哄伎闂佺鐬奸崑鐐烘偂濞戞◤褰掓晲閸涱喗鍠愰柤鍙夌墬缁绘稓鈧數顭堥鎾剁磼閻樿櫕宕屾鐐插暙閳诲酣骞欓崘鈺傛珜濠电姷鏁告慨鏉懨洪妸銉ф殾妞ゅ繐鎳愮弧鈧?await闂?   */
  async _loadMouthSetting(idolId, spine) {
    try {
      const resp = await fetch(getMouthSettingUrl(idolId))
      if (!resp.ok) return
      const data = await resp.json()
      if (data?.mouthes?.length) {
        spine._mouthData = data
        if (spine.customIsTalking) {
          try {
            spine.skeleton.updateWorldTransform()
          } catch (_) {}
        }
      }
    } catch (_) {
      // Silently fall back to global constants
    }
  }
  // Fade transitions

  /**
   * Fade a spine model in (alpha 0 闂?1) over ~300ms.
   * Fades the wrapper so the entire model blends as one layer.
   */
  setSpinePartsVisible(idolId, visible) {
    const entry = this.spineInstances[idolId]
    if (!entry?.spine) return
    entry.spine._partsVisible = visible !== false
    this._applyOptionalPartsSlots(entry.spine)
  }

  _detectOptionalPartsSlots(spine, idolId = '', modelId = '') {
    const skeleton = spine?.skeleton
    const data = skeleton?.data
    if (!data?.slots) return []

    const include = /(accessory|_acc|acc_|glasses?|beard|badge|cat|chain|necklace|bracelet|watch|ring|pierce|earring|ribbon|hat|cap|mask)/i
    const exclude = /(mouth|tooth|teeth|tongue|lip|eye|eyebrow|face|nose|cheek|sweat|blush|shadow|hair_base|body_base|skin)/i
    const attachmentBySlot = new Map()

    try {
      const attachments = data.defaultSkin?.getAttachments?.() || []
      for (const att of attachments) {
        const slotName = data.slots?.[att.slotIndex]?.name || ''
        const names = attachmentBySlot.get(slotName) || []
        names.push(att.name || att.attachmentName || '')
        attachmentBySlot.set(slotName, names)
      }
    } catch (_) {}

    const slots = []
    for (const slotData of data.slots) {
      const slotName = slotData?.name || ''
      const attNames = attachmentBySlot.get(slotName) || []
      const haystack = [slotName, slotData?.attachmentName || '', ...attNames].join(' ')
      if (!haystack || exclude.test(haystack)) continue
      if (include.test(haystack)) slots.push(slotName)
    }

    if (slots.length) {
      console.log(`[PixiStageManager] Optional parts for "${idolId}" (${modelId}):`, slots.join(', '))
    }
    return Array.from(new Set(slots))
  }

  _applyOptionalPartsSlots(spine) {
    if (!spine || typeof spine._partsVisible !== 'boolean') return
    const slotNames = spine._optionalPartsSlots || []
    if (!slotNames.length) return
    if (!spine._partsSlotAlpha) spine._partsSlotAlpha = {}

    for (const slotName of slotNames) {
      const slot = spine.skeleton?.findSlot?.(slotName)
      if (!slot) continue
      if (spine._partsSlotAlpha[slotName] == null) {
        const defaultAlpha = Number.isFinite(slot.data?.color?.a) ? slot.data.color.a : slot.color.a
        spine._partsSlotAlpha[slotName] = defaultAlpha
      }
      slot.color.a = spine._partsVisible ? spine._partsSlotAlpha[slotName] : 0
    }
  }

  _fadeIn(spine, duration = 0.3) {
    const entry = Object.values(this.spineInstances).find(e => e.spine === spine)
    const target = entry?.wrapper || spine
    target.alpha = 0
    const durationMs = Math.max(0.01, Number(duration) || 0.3) * 1000
    const start = performance.now()
    const ticker = () => {
      if (target.destroyed) {
        this.app.ticker.remove(ticker)
        return
      }
      const t = Math.min((performance.now() - start) / durationMs, 1)
      target.alpha = t
      if (t >= 1) {
        this.app.ticker.remove(ticker)
      }
    }
    this.app.ticker.add(ticker)
  }

  animateSpineAlpha(idolId, targetAlpha, duration = 0.2, delay = 0) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const target = entry.wrapper || entry.spine
    if (!target || target.destroyed) return
    entry._alphaTween?.cancel?.()
    const startAlpha = Number.isFinite(target.alpha) ? target.alpha : 1
    const endAlpha = Math.max(0, Math.min(1, Number(targetAlpha)))
    const delayMs = Math.max(0, Number(delay) || 0) * 1000
    const durMs = Math.max(0.01, Number(duration) || 0.2) * 1000
    entry._alphaTween = runRafTween({
      durationMs: durMs,
      delayMs,
      startValue: startAlpha,
      endValue: endAlpha,
      ease: easeOutCubic,
      onUpdate: (alpha) => {
        if (!target.destroyed) target.alpha = alpha
      },
      shouldStop: () => target.destroyed,
      onComplete: () => {
        entry._alphaTween = null
      },
    })
  }

  /**
   * 濠电姷鏁告慨鐑藉极閸涘﹥鍙忓ù鍏兼綑閸ㄥ倸鈹戦崒婊庣劸闁哄嫨鍎甸弻鈥崇暤椤斿吋鍣烘繛鍫熸礋濮婇缚銇愰幒鎿勭吹缂備讲鍋撳〒姘ｅ亾闁诡喚鍋ゅ畷褰掝敃閻樿京鐩庨梻浣烘嚀閹碱偆绮旈崼鏇€鍥晝閸屾稓鍘卞┑鐘绘涧濡瑩骞嗛崼銉︻梿濠㈣泛顑囩弧鈧繝鐢靛Т閸婃悂顢旈埡鍛厱闁哄倽顕ч埀顒佺箞瀵寮撮姀鐘茶€垮┑鈽嗗灣閸庛倗鎷犻悙鐑樺€甸悷娆忓缁岃法绱掗崣澶婂姢妞ゆ洏鍎靛畷鐔碱敇濠靛洤濯伴梻浣藉Г閿氭い锔藉▕瀹曟繂螣鐞涒剝鏂€闂佺粯锚閻忔岸寮抽埡鍛厱閹兼番鍨归悘鈺冣偓鍨緲閿曘倗鍙呭銈呯箰鐎氼噣宕濋敃鈧—鍐Χ閸℃娼戦梺绋款儐閹瑰洭寮诲☉銏″亜濡炲绨奸搹搴ㄦ偠?闂?濠电姷鏁告慨鐑藉极閹间礁纾婚柣妯款嚙缁犲灚銇勮箛鎾搭棤缂佲偓婵犲洦鐓冪憸婊堝礈濮樿鲸宕叉繛鎴炵懃缁剁偤鎮楅敐搴′簽妞わ缚鍗抽幃?AlphaFilter 闂傚倸鍊峰ù鍥敋瑜忛埀顒佺▓閺呯娀銆佸▎鎾冲唨妞ゆ挾鍋熼悰銉╂⒑閸濆嫮鈻夐柛妯垮亹缁崵鎲撮崟鈺€绨婚梺瑙勬緲婢у酣鎮鹃柆宥嗙厸?Spine 闂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ磵閳ь剨绠撳畷濂稿閳ュ啿绨ラ梻浣筋潐婢瑰棙鏅跺Δ鍛；閻庯綆浜栭弨浠嬫煟濡绲绘い蹇ｄ邯閺屾盯鎮㈤崨濞夸虎闂佸搫鏈惄顖炲春閸曨垰绀冩い蹇庣劍椤秹姊绘担鑺ヮ棄闁哥喍鍗冲畷浼村冀椤撶偠鎽曢梺缁樻⒒閸樠呯不閺屻儲鐓欓梺顓ㄧ畱婢ф煡鏌℃担鑺ョ《缂佽鲸鎸婚幏鍛村箵閹哄秴顥氶梻浣筋嚙閸戠晫绱為崱娑樼獥婵°倕鎳忛崑鍌涚箾閹寸偐妫ㄧ憸鐗堝笚閺呮煡鏌涢顐簼缂傚秴鐗忕槐鎾诲磼濮樻瘷锝夋煕閵娿儲璐℃俊鍙夊姍楠炴帡骞樼€靛摜肖婵＄偑鍊栭崝鎴﹀垂婵犳艾鍌ㄦい鎰堕檮閳锋垿鏌ｉ悢鍛婄凡婵℃彃顭烽弻鐔煎礃閺屻儱寮板銈冨灪钃辩紒铏规櫕缁瑩宕归鍓у春濠碉紕鍋戦崐鏍ь潖婵犳碍鎯為幖绮瑰煑濞差亶鏁嶉柣鎰ˉ閹风粯绻涙潏鍓у埌闁硅绻濆畷顖炴倷閻戞鍘遍梺鍝勫暊閸嬫挻绻涢崣澶岀煂闁告帗甯″顕€宕煎┑鍫Ф濠电偠鎻徊鍧椻€﹂崼銉﹀€跺┑鐘叉处閳锋垹绱撴担濮戭亪鎮橀敂濮愪簻妞ゆ挾鍋為崰姗€鏌涢埞鍨伈鐎殿噮鍣ｅ畷濂告偄閸濆嫬绗氶梺鑽ゅ枑缁秶鍒掗幘宕囨殾婵犲﹤鍟犻弸搴ㄦ煙閻戞ê鐏╅柛濠冨浮濮婂宕掑▎鎺戝帯闂佺顑冮崝鎴濈暦閺囥垺鐒肩€广儱鎳愰弻鍫ユ⒑閸撹尙鍘涢柛鐔叉櫊楠炴帡骞樺畷鍥╃嵁闂備礁缍婇崑濠囧储妤ｅ啫鐭?   * 闂傚倸鍊峰ù鍥х暦閻㈢绐楅柟閭﹀枛閸ㄦ繄鈧箍鍎卞Λ妤呭垂閺傛５褰掓偐瀹割喖鍓鹃梺杞扮椤戝洭骞夊宀€鐤€婵炴垶鐟ュ▓鐔兼⒑閸涘娈橀柛瀣枛瀵娊鏁冮崒娑氬幈闂侀潧顧€缁茶姤淇婃總鍛婄厸閻庯綆浜滈埀顒€鐏濋～蹇撁洪鍕唶闁硅壈鎻徊鍧楁偩閻㈠憡鈷戦柣鐔告緲閺嗛亶姊虹敮顔惧埌妞ゆ洩缍侀獮鏍ㄦ媴閸濄儱濮?X闂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ磵閳ь剨绠撳畷濂稿閳ュ啿绨ラ梻浣筋潐濠㈡﹢宕ｉ幘璇茬倞妞ゆ帊绀佹禒铏圭磽娴ｅ壊鍎撴繛澶嬫礋瀹曟繈鏁冮埀顒勨€旈崘顔嘉ч柛鈩冾殔濞兼垿姊虹粙娆惧剱闁圭澧藉Σ鎰板箳閺冨倻锛滃┑顔筋殔濡瑩鎮挎笟鈧?缂傚倸鍊搁崐鎼佸磹閹间礁纾瑰瀣捣閻棗銆掑锝呬壕闂佺懓纾崰鏍€佸☉銏″€烽柡澶嬪灍閸嬫捇鎳滈悽鐢电槇闂傚倸鐗婄粙鎺撳緞閸曨垱鐓曢幖杈剧到閺嬫垹绱掔紒妯肩畺缂佺粯绻堝畷鎺戭煥閸愮偓婢戦梻鍌欑閹碱偊骞忕€ｎ喖绀堥柣鏃傚帶閽冪喐绻涢幋娆忕労闁轰礁鍟妵鍕箳閹存績鍋撻弰蹇婂徍闂傚倸鍊烽懗鍓佸垝椤栫偛绠伴柟缁㈠枛閻ょ偓绻涢幋娆忕仾缂佺姵甯″缁樻媴閻熼偊鍤嬬紓浣筋嚙閸婃瓕鐏嬪┑鐐叉缁绘帡寮抽敂閿亾閸忓浜鹃梺鍛婃处閸撴盯宕㈤崡鐐╂斀闁宠棄妫楅悘锝嗐亜椤撶偟澧﹂柛鈹惧亾濡炪倖甯婇懗鑸垫櫠鏉堚晝纾兼い鏃傗拡閸庢梹顨ラ悙鏉戞诞鐎殿噮鍣ｉ崺鈧い鎺嗗亾闁伙綁鏀卞鍕箛椤撶姴骞楅梻浣烘嚀椤曨參宕曢幇鐗堝€垮Δ锝呭暞閻撴洘鎱ㄥΟ鐓庡付濞存粎澧楅幈銊︾節閸愨斂浠㈤悗瑙勬磸閸斿秶鎹㈠┑鍥ㄥ劅闁靛繈鍨哄▓浠嬫⒒閸屾瑧鍔嶉悗绗涘厾娲晜閻ｅ矈娲稿銈呯箰閻楀棝寮伴妷鈺傜厓鐟滄粓宕滃璺何﹂柛鏇ㄥ灠缁犳娊鏌涢埄鍐︿沪濠㈣娲滅槐鎾诲磼濞嗘帒鍘＄紓渚囧櫘閸ㄨ泛鐣疯ぐ鎺擃棃婵炴垶顭囬妶顐︽⒒閸屾瑨鍏屾い銏狅躬楠炴捇顢旈崱娆庣瑝闂佺懓顕慨椋庝焊閻㈢鍋撻獮鍨姎妞わ缚鍗抽幃鈥斥槈閵忥紕鍘卞銈嗗姉婵挳鎮橀鍫熺厸闁糕€崇箲濞呭﹥鎱ㄦ繝鍕笡鐎垫澘瀚换婵嬪礋閹冲嘲娲﹂悡娑氣偓鍏夊亾閻庯綆鍓涜ⅵ闂備胶纭堕弲顏嗘崲濠靛棛鏆︽慨妞诲亾鐎规洘绮忛ˇ鎻掆攽椤旂鍋㈤柡宀嬬秮閹垽宕妷褏鍘戝┑鐘愁問閸ㄦ娊寮查锝囶洸缂佸绨遍弸搴ㄦ煙閹咃紞闁汇倕鎳橀弻锝嗘償閵忊懇濮囬柦鍐ㄥ船閳规垿顢涘☉娆忓攭闂佸搫鐭夌紞渚€鐛€ｎ喗鍊婚柛鈩冪懃婵椽姊绘担鍛婃儓婵☆偅绋掔换娑㈠焵椤掍焦鍙忓┑鐘插亞閻撹偐鈧娲樼敮鎺楋綖濠靛鏁勯悹鎭掑妽閺呭ジ姊婚崒娆戠獢婵炶壈宕电槐鐐哄炊閳哄啰顦繛鎾村焹閸嬫挸鈹戦埄鍐╁唉鐎规洘甯掗埥澶婎潩閸忚偐銈梻浣筋嚙閸戠晫绱為崱娑樼；闁告侗鍘搁弸宥夋煛瀹ュ啫濡跨紒鈾€鍋撻梻渚€娼ф蹇曞緤閸撗勫厹濡わ絽鍟悡鐔镐繆閵堝倸浜鹃梺鍝ュ枑濞兼瑩鎮?   */
  _fadeOutWrapper(wrapper) {
    if (!wrapper || wrapper.destroyed) return

    // Keep the whole wrapper rendered as a single layer during fade-out.
    const alphaFilter = new PIXI.AlphaFilter(wrapper.alpha || 1.0)

    const STEP = 0.12  // 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸崹楣冨箛娴ｅ湱绋佺紓鍌氬€烽悞锕佹懌闂佸憡鐟ョ换姗€寮婚悢铏圭＜闁靛繒濮甸悘鍫㈢磽娴ｅ搫啸闁轰礁顭峰璇差吋閸℃ê顫￠梺鐟板槻閼活垱鏅舵ィ鍐╃厵闁稿繗鍋愰弳姗€鏌涢弬璺ㄧ劯闁诡喗锕㈤獮搴ㄦ嚍閵壯冨箞闂備礁缍婇崑濠囧礈濞嗘垹妫憸鏃堝蓟?(~8闂?
    const ticker = () => {
      // 闂傚倸鍊搁崐宄懊归崶顒夋晪鐟滃秹婀侀梺缁樺灱濡嫮绮婚悩缁樼厵闁诡垎鍐╊啈闂佹悶鍎洪崜锕傚极瀹ュ鐓熼柟閭﹀灠閻ㄦ椽鏌ｉ幘鏉戠伌婵☆偄鎳橀、鏇㈠閳ユ剚妲遍梻浣哥秺椤ユ捇骞婇幘璇茬叀濠㈣埖鍔曢～鍛存煟濮椻偓濞佳勬叏閿旀垝绻嗛柣鎰典簻閳ь剚鐗曢蹇旂節濮橆剛锛涢梺鐟板⒔缁垶藟閸℃鐔嗛柤鎼佹涧婵牓鏌涙繝鍕毈闁哄被鍔岄埞鎴﹀幢濡儤顏犳俊鐐€х徊鐣屽椤撶姵顫曢柟鐑橆殔缁犳稒銇勯幘妤€瀚弳锔剧磽閸屾瑨鍏岀紒顕呭灦閹嫰顢涢悙鍙夌€梺鍦濠㈡澹曢崗闂寸箚闁靛牆鍊告禍鐐箾鐎涙鐭掔紒鐘崇墵瀵鈽夐姀鐘电杸濡炪倖宸婚崑鎾剁磼閻欐瑥娲﹂悡鐔兼煥閺冨洤袚妞ゃ儱鐗撻弻锛勪沪缁嬪灝鈷夐悗鍨緲鐎氭澘鐣烽崡鐐嶇喖鎳￠妶鍛埌婵犵數濮烽弫鎼佸磻濞戙垺鍎戝ù鍏兼綑缁€澶愭煙鏉堝墽鐣遍柡鍕╁劦閺屾洝绠涚€ｎ亖鍋撻弴鐘电焼闁稿瞼鍋為悡鐘崇箾閺夋埈鍎愰柡澶婄秺閺岋紕鈧綆鍋嗘晶顏呫亜椤忓嫬鏆ｅ┑鈥崇埣瀹曞崬螣閻戞ɑ顔傞梻鍌欒兌椤牏鈧稈鏅犲畷婵嬪即閻樻彃鐤鹃梻鍌欑窔濞佳囨偋閸℃蛋鍥ㄥ鐎涙ê浜?wrapper 闂傚倸鍊搁崐宄懊归崶褏鏆﹂柣銏㈩焾绾惧鏌ｉ幇顒佹儓缂佲偓閸曨厽鍠愰柣妤€鐗嗙粭鎺旂棯閹岀吋闁哄本鐩鎾Ω閵壯€鍋撻鍕厱闁靛绲芥俊璺ㄧ磼閳锯偓閸嬫挻绻濆▓鍨灍闁挎洍鏅犲畷銏°偅閸愩劎顦梺褰掓？閻掞箓鍩涢幋锔解拻闁割偆鍠庡畷鐔兼煕椤愮姴鍔氶柣銈囧亾缁绘繃绻濋崒婊冾暫闂佸搫顑勯悞锔界┍婵犲浂鏁嶆繝濠傛噹缁楋繝姊洪崨濠勬噧缂佺粯锕㈠濠氬Ω閵夈垺鏂€闂佺硶鍓濋〃蹇斿閳ь剛绱撻崒娆戝妽缂佸鍨归幑銏ゅ箳閺冣偓椤洟鏌熼悜妯诲鞍缂傚秴娲弻鏇熺箾瑜嶉幊鎰板汲椤撶姷纾介柛灞剧懅鐠愪即鏌涢悩鍐叉诞鐎殿喗褰冮埞鎴犫偓锝庝簽閸旓箑顪冮妶鍡楃瑨闁挎洩濡囩划鏃堟濞淬垻鎳撻…銊╁礋椤撶姷鍘滈梻浣筋嚃閸犳帡鍩€椤掍焦鐏遍柡鈧禒瀣厱妞ゆ劗濮撮悘顕€鏌ㄥ☉娆戠畺缂佺粯绋掑蹇涘礈瑜嶉崺宀勬⒑绾懎袚缂侇喖绉瑰鑼崉鐞涒剝顫嶅┑鐐叉缁夊磭鑺?Ticker
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
   * 闂?idolId 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偞鐗犻、鏇㈠Χ閸℃ぞ绮℃俊鐐€栭崝褏绮婚幋鐘差棜闁秆勵殕閻撴洘绻涢崱妤佺婵″弶妞介弻?wrapper 婵犵數濮撮惀澶愬级鎼存挸浜炬俊銈勭劍閸欏繘鏌ｉ幋锝嗩棄缁炬儳顭烽弻锝呂熷▎鎯ф闂佸搫瀚ㄩ崕鐢稿蓟閳ユ剚鍚嬮柛鎰╁妼椤鈹戦悙鍙夊櫧濠电偐鍋撻梺鍝勭焿缂嶄線寮幇鏉垮窛妞ゆ棁濮ょ€氭娊姊?AlphaFilter 婵犵數濮烽弫鍛婃叏閻戣棄鏋侀柟闂寸绾惧潡鏌熺€电孝缂佽翰鍊栫换娑橆啅椤旇崵鐩庨梺缁樺笒閻忔岸濡甸崟顖氱闁糕剝銇炴竟鏇㈡⒒娴ｅ憡鎲搁柛鐘查叄閹ê鈹戞繝搴㈡瘞婵犵數濮伴崹濂稿春閺嶎厼绀夐柡宥庡幗閸?   * 闂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ磵閳ь剨绠撳畷濂稿閳ュ啿绨ラ梻浣筋潐婢瑰棙鏅跺Δ鍛；閻庯綆鍠楅悡鏇熺箾閹存繂鑸归柣蹇曞█閺屾盯濡搁敂鍓х杽闂佸搫鐭夌徊鍊熺亽闂佺绻愰崥瀣掗崟顒傜闁瑰鍋炵亸顓犵磼婢跺﹦绉虹€殿喖顭锋俊鎼佸Ψ閵忊槅娼旀繝纰樻閸垳鎷冮敂鐣岊浄濡わ絽鍟埛鎴犵磼鐎ｎ亜鐨￠柛鏃傚枛閺屾稓鈧絻鍔岄埀顒佺箓椤曪絿鎷犲ù瀣潔闂侀潧绻嗛崜婵嗏枍濠婂牊鈷戦柛娑橈工婵倿鏌涢弬璺ㄧ劯闁炽儲鐗犲畷鍗炩槈濞嗗本瀚奸梻浣虹帛閹哥霉闁垮顩锋繛鎴欏灪閻撴洟鏌曟繛鍨姕閻犳劧绻濋弻娑㈠箳閹捐櫕璇為悗娈垮櫘閸ｏ綁宕洪埀顒併亜閹烘垵鈧懓鐣烽崣澶岀瘈闂傚牊绋掗敍宥嗙箾鐏忔牗娅嗛柕鍥у楠炴鎹勯惄鎺嬪灮缁辨挸顓奸崪浣光枅濠殿喖锕ュ浠嬪箠閿熺姴围闁告稑鎷戠换婵嬪蓟閿濆绠抽柣鎰暩閺嗙姴顪冮妶搴″箹闁诲繑绻嗛悘鎺楁⒑閸忚偐銈撮柡鍛箞钘濇い鏍仦閸婂灚顨ラ悙鑼虎闁告梹纰嶉妵鍕晜閸喖绁悗娈垮枟閻擄繝銆佸Δ鍛妞ゆ巻鍋撻柍褜鍓欓悥濂稿蓟閿濆绠涙い鏍ㄦ皑閸橆偄顪冮妶鍐ㄥ姎妞わ妇鏁诲濠氭晸閻樻彃绐涘銈嗘⒒閸嬫捇宕抽鐘电＝濞达綀娅ｇ敮娑㈡煟閳哄﹤鐏︾€殿噮鍋婇獮鍥级鐠侯煉绱叉繝寰锋澘鈧劙宕戦幘瓒佺懓顭ㄩ崼銏㈡毇闂佸搫鏈惄顖炵嵁閸ヮ剦鏁嗛柍褜鍓涢惀顏囶樄闁哄矉缍侀弫鍌炴嚍閵夘喗顥堟繝娈垮枛閿曘儱顪冩禒瀣祦闁归偊鍘介崕鐔兼煥濠靛棗鈧綊锝炲澶嬧拻濞达綀顫夐妵鐔兼煕濡亽鍋㈢€规洘鍔楃划娆撳垂椤斾勘鍋掗梻鍌欐祰瀹曞灚鎱ㄩ弶鎳ㄦ椽濡堕崨鍌滃枑缁绘繈宕掗妶鍥уШ濠电偛顕崢褔鎮洪妸鈺傚亗闊洦绋撻崣鎾绘煕閵夛絽濡界紒鈧埀顒勬煛瀹ュ繒绡€闁诡喖鍢查…銊╁幢濡ゅ啫濮洪梻浣侯焾闁帮絽顭囪閿濈偠绠涢幘浣规そ椤㈡柨顓奸崱妯荤彇闂傚倷绶氬褔鎮ч崱娑樼疇闊洦绋掗崐闈涒攽閻樺磭顣查柍閿嬪灴閺岀喖鎳栭埡浣风捕婵犲痉銈呬汗缂佽鲸甯炵槐鎺戭潨閸絺鍋撻崸妤佺厽婵炴垵宕▍宥嗩殽閻愬樊鍎旈柡浣稿暣閸┾偓妞ゆ帒瀚哥紞鏍煕濞戞鎽犻柣鎾冲暣閺屽秵娼幍顕呮М闂佸搫顑冮崐鏍ㄧ┍婵犲偆鍟呮い鏃囧亹娴犵鈹?idolId 闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏇炲€归崕鎴犳喐閻楀牆绗掔紒鈧径灞稿亾閸忓浜鹃梺閫炲苯澧撮柛鈹惧亾濡炪倖甯婄粈渚€宕甸鍕厱婵炲棗绻愰弳娆愩亜閺囶亞鎮肩紒杈ㄥ笒铻ｉ柤娴嬫櫇濡插洭姊绘担瑙勫仩闁稿孩绮撳畷銊╊敍濞戞氨袦闂傚倷娴囧畷鐢稿窗閹邦喖鍨濋悘鐐电摂濞尖晠鏌ㄩ弴鐐测偓鎼佹偪椤斿浜滈柡宥庡亜娴狅箓鏌嶉柨瀣伌闁哄瞼鍠栭幊鏍煛娴ｉ鎹曞┑鐘殿暯閳ь剙鍟块幃鎴︽煏閸パ冾伃妤犵偛顑呴埞鎴﹀炊瑜庨悾濠氭煟鎼淬値娼愭繛璇х畵瀹曞綊骞庨挊澶岊唹闂佸憡娲﹂崹鐗堝劔闁荤喐绮岀换姗€鎮伴鈧獮妯尖偓闈涙憸椤旀洟鏌℃径濠勫濠⒀傜矙楠炲啴宕楃粭杞扮盎闂佹寧绻傜€氼噣鎯屽▎鎴斿亾?   */
  _destroyWrapperNow(wrapper) {
    if (!wrapper || wrapper.destroyed) return
    const parent = wrapper.parent
    if (parent) parent.removeChild(wrapper)
    wrapper.destroy({ children: true, textures: true })
  }

  _fadeOutAndDestroy(idolId, immediate = false) {
    this._spawnTokens[idolId] = (this._spawnTokens[idolId] || 0) + 1
    delete this._pendingTalking[idolId]
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const { spine, wrapper } = entry

    // Cancel slide tween if active
    if (entry._slideTweenRaf) {
      cancelAnimationFrame(entry._slideTweenRaf)
      entry._slideTweenRaf = null
    }

    spine.customIsTalking = false
    delete this.spineInstances[idolId]

    if (immediate) this._destroyWrapperNow(wrapper || spine)
    else this._fadeOutWrapper(wrapper || spine)
  }

  /**
   * Set facial expression via Track 1 animation, with original game engine flag control.
   *
   * SideM spine data includes `face_xxx` animations (e.g. `face_happy`, `face_angry`).
   *
   * @param {string} idolId
   * @param {string} faceName - e.g. "happy", "angry", "face_happy"
   * @param {object|boolean} [faceFlags] - Flags from original data, or boolean shouldBlink for backward compat.
   *   { anim_flag: '闂?|'off', blush_flag: '闂傚倸鍊搁崐鎼佸磹妞嬪孩顐芥慨姗嗗墻閻掔晫鎲搁弮鍥棨婵＄偑鍊栧ú宥夊磻閹惧瓨鍙忓┑鐘叉噺椤ュ銇勯幘鍐叉倯鐎垫澘瀚换婵嬪礋閸倣婵嗏攽閻樿尙妫勯柡澶婄氨閸嬫捇寮撮姀鐘电枃闁硅偐琛ラ崜婵堢棯?|'off', sweat_flag: '婵?|'off' }
   *
   * 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸弫鎾绘偐椤愮喎浜鹃柨鏇炲€搁悙濠冦亜閹哄棗浜剧紓浣瑰姈椤ㄥ﹪寮婚悢鐓庣畾鐟滃繘骞楅悩宕囩闁告侗鍨版牎婵烇絽娲ら敃顏呬繆閸洖宸濇い鎾跺枑椤斿姊虹拠鎻掝劉闁告垵缍婂畷婊堟偄閻撳氦鎽曞┑鐐村灟閸ㄥ湱绮诲☉銏＄厓閺夌偞澹嗛ˇ锔姐亜椤掆偓閻楀棝鈥旈崘顔嘉ч柛鈩冾焽閸欏棝姊洪幐搴㈢８闁稿氦灏欑划姘綇閵娧呯槇闂佹悶鍎撮崺鏍疾椤掆偓閳规垿鏁嶉崟顐″摋濡炪倖娉﹂崟顓ф锤闂佸憡鎸嗛埀顒勫磻閹捐埖鍠嗛柛鏇ㄥ墰椤︺儱鈹戦悙鑼勾闁告梹鍨挎俊瀛樼瑹閳ь剙鐣烽妸褉鍋撳☉娅辨岸骞?   *   anim_flag='闂?  闂?blink cover 150ms闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏃堟暜閸嬫挾绮☉妯诲櫧闁活厽鐟╅弻鐔告綇妤ｅ啯顎嶉梺绋款儏椤戝寮诲☉銏犵労闁告劑鍔嶉幆娑欑箾鐎涙鐭婄紓宥咃躬瀵鏁愭径濠勭杸濡炪倖娲栭幊蹇撔掑畝鍕拺缂佸顑欓崕鎰版煙閸涘﹥鍊愰柛鈹垮劜瀵板嫭绻涢悙顒傗偓濠氭椤愩垺澶勯柟灏栨櫅椤洭骞橀崜浣猴紳闂佺鏈悷锔剧矈閺夋娓婚悗娑櫳戦崐鎰偓瑙勬礀濠€閬嶅箲閸曨剛鐟规い鏍ㄧ椤斿倿姊绘担鍛婂暈婵炶绠撳畷銏＄附閺夊棗顦～婵嬫嚋闂堟稈鍋撻悽鍛婄叆婵犻潧妫涢崙鍦磼閵娿儱鎮戦柕鍥у瀵剟骞愭惔鈩冪亷婵犳鍠栭敃銊モ枍閿濆洦顫曢柟鐑樺殾閻斿吋鎯為柛锔诲幗閸ゅ啴姊婚崒娆掑厡妞ゎ厼鐗嗛～婵嬫晝閸屾氨锛涢梺鍦濠㈡绮婚弻銉︾厪闊洤顑呴埀顒佹礈缁牓宕橀鐣屽帾婵犵數濮寸换鎺戠暆濞戙垺鐓曢悗锝庡亝瀹曞本顨ラ悙鏉戠瑨閾绘牠鏌嶈閸撶喖骞冮敓鐘虫櫢闁绘ê纾崢鍗炩攽閻愭潙鐏ョ€规洦鍓熼幃姗€鏁愰崱鎰盎闂佹寧妫侀褍鈻嶅鍡樺弿濠电姴鍟妵婵堚偓瑙勬磸閸斿秶鎹㈠┑鍥ㄥ劅闁挎繂鎳庢闂傚倸鍊风粈渚€骞楀鍕弿闁汇垻顭堢粻鏉库攽閻樺疇澹橀柣銈夌畺閹娼幍顔拘梺鍝勫暙閻楀棗顔忓┑鍥ヤ簻闁规崘娉涙禒褏鎲?0.1s 闂傚倸鍊峰ù鍥敋瑜嶉湁闁绘垼妫勭壕濠氭煥濠靛棭妲哥痪鎯х秺閺屸€愁吋鎼粹€崇缂佺偓鍎冲锟犲蓟閵堝悿鍦偓锝庡亝閻濇洟鎮楃憴鍕鐎殿喖澧庨幑銏犫攽閸モ晝鐦堥梺绋挎湰缁嬫垵鈻嶅┑瀣拺缂佸顑欓崕鎰版煙閻熺増鍠樻鐐插暞缁傛帞鈧綆浜滈悗顓烆渻閵堝棗濮﹂柛瀣€块獮瀣槹鎼达絿锛?
   *   anim_flag='off' 闂?闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏇楀亾妞ゎ亜鍟村畷绋课旈埀顒傜矆閸儲鐓ラ柡鍥╁仜閳ь剙鎽滅划鍫ュ醇閻旇櫣顔曢梺绯曞墲钃遍悘蹇ｅ弮閺屾盯濡搁妷銉㈠亾閸ф鍋傛い鎰剁畱閻愬﹪鏌曟繛褉鍋撳┑顔兼喘濮婃椽宕崟顒€顎涢梺鍛婃尵閸犳牠鐛崘顭戞建闁逞屽墴楠炲啫鈻庨幋鐐茬／闁哄鍋熸晶妤呮儓韫囨稒鈷掑ù锝堟閸氬綊鏌涢悩鍐插闁瑰箍鍨藉畷濂稿Ψ閵夈劍鎲版繝鐢靛仦閸ㄥ爼宕洪崘顔肩；闁瑰墽绮弲鏌ュ箹缁厜鍋撻懠顒€鍤梻鍌欑劍閻綊宕濆澶婂瀭闁告挷鐒﹀畷鍙夌節闂堟侗鍎忛柣鎺戠仛閵囧嫰骞掗幋婵愪紝闂佽桨绀侀崐鍧楀蓟濞戙埄鏁冮柕鍫濇噺閻庡姊洪崨濠冨碍缁剧虎鍘惧Σ鎰板箳閺冨倻锛滈梺闈涚箳婵鐚惧鍜佹富闁靛牆鍟崝婊堟煙缁嬪灝鈷旈柛鎺撳浮瀹曞ジ濡烽妷褜妲规俊鐐€栭悧妤冪矙閹捐鍌ㄩ柛妤冨亹閺€浠嬫煟閹邦剙绾фい銉︾矌缁辨帗寰勭€ｎ偄鍞夐悗瑙勬礃缁诲倿鍩㈡惔銊ョ閻庣數顭堥獮姗€姊绘担绋款棌闁绘挸鐗撳畷鎴﹀礋椤栨稑鈧爼鎮楀☉娆欎緵婵炲牅绮欓弻锝夊箛椤掆偓缁狙勩亜閵夛絽鐏柍褜鍓濋～澶娒鸿箛娑樼闁硅揪璐熼埀顑跨閳藉顫滈崱妯哄厞婵＄偑鍊栫敮鎺楀磻婵犲嫭顫曢柣銏㈡暩绾句粙鏌涚仦鎹愬闁逞屽墰閸忔﹢骞冮悙鐑樻櫇闁稿本姘ㄩˇ顕€姊洪崷顓炲妺婵﹤顭烽幆宀勫幢濡炴洖缍婇弫鎰板椽娴ｅ湱绋愬┑鐐茬摠缁酣骞婇幘鐑┾偓锕傚锤濡や礁娈濋梻鍌氱墛缁嬫垿锝炲澶嬧拺?   *   blush_flag='闂傚倸鍊搁崐鎼佸磹妞嬪孩顐芥慨姗嗗墻閻掔晫鎲搁弮鍥棨婵＄偑鍊栧ú宥夊磻閹惧瓨鍙忓┑鐘叉噺椤ュ銇勯幘鍐叉倯鐎垫澘瀚换婵嬪礋閸倣婵嗏攽閻樿尙妫勯柡澶婄氨閸嬫捇寮撮姀鐘电枃闁硅偐琛ラ崜婵堢棯? 闂?濠电姷鏁告慨鐑藉极閹间礁纾块柟瀵稿Т缁躲倝鏌﹀Ο渚＆婵炲樊浜濋弲婊堟煟閹伴潧澧幖鏉戯躬濮婃椽宕ㄦ繝鍐槱闂佹悶鍔嶅妯绘櫏闂佸搫琚崕鏌ユ偂閸愵亝鍠愭繝濠傜墕缁€鍫ユ煟閺冨倸甯堕柦鍐枛閺屾洟宕煎┑鎰︾紓浣哄珡閸ャ劎鍘甸柣搴ｆ暩椤牊绂掗敃鍌涚厱闁绘ê鍟挎慨宥夋煛瀹€瀣ɑ闁诡垱妫冩慨鈧柍鍨涙櫆閻忎線姊绘担鍛婃儓闁硅櫕鍔栫换娑㈠焵椤掑倵鍋撳▓鍨珮闁稿瀚伴、妯荤附缁嬭法鍊為梺鎸庢濡嫭鍒婃导瀛樷拻濞达絿顭堥幃鎴澝瑰鈧划娆忕暦閺囥垺鐒肩€广儱鎳愰ˇ顓㈡⒑闂堟单鍫ュ疾濠婂牆鐓曢柟杈鹃檮閻撴洘绻涢幋鐑囧叕鐎规悶鍎崇槐鎺懳旀担绋挎懙闂佸搫鐭夌紞渚€骞冮姀銈呯骇闁瑰瓨绻傞～鎾翠繆閻愵亜鈧牠寮婚妸褎宕叉慨妞诲亾鐎殿喖顭峰畷鍗炍旀繝鍌涘€梻浣告啞娓氭宕归悡骞綁骞橀瑙ｆ嫽婵炶揪绲块…鍫ニ夎箛娑欑厱閻庯綆浜濋崳褰掓偂閵堝棙鍙忔俊鐐额嚙娴滄儳顪冮妶鍐ㄧ仾闁挎岸鎮￠妶鍡愪簻闊洦鎸婚崳浠嬫煕?cheek_dye 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗ù锝夋交閼板潡寮堕崼姘珔闁搞劍绻冮妵鍕冀閵娧呯厑闂佸搫妫欑划宥嗙┍婵犲洤围闁告侗鍙庢禒鍓х磽?
   *   sweat_flag='婵?     闂?濠电姷鏁告慨鐑藉极閹间礁纾块柟瀵稿Т缁躲倝鏌﹀Ο渚＆婵炲樊浜濋弲婊堟煟閹伴潧澧幖鏉戯躬濮婃椽宕ㄦ繝鍐槱闂佹悶鍔嶅妯绘櫏闂佸搫琚崕鏌ユ偂閸愵亝鍠愭繝濠傜墕缁€鍫熸叏濡寧纭剧紒鐘靛仱閺屾洘绻涜鐎氼剟寮搁崒鐐粹拺闁告稑锕ョ粈鈧梺璇茬箲瀹€鎼佸箖閹呮殝闁逛絻娅曢弬鈧梻浣虹帛閸ㄩ潧煤閵娧呯煋闁汇垹鎲￠悡鏇㈡煥濠靛棛绠崇紒澶樺枤閳ь剚顔栭崳顕€宕戦崟顖ｆ晣濠靛倻顭堥悙濠囨煥閺冨洦顥夊┑顖欏嵆濮婄粯鎷呯粙鎸庡€繛瀛樼矆缁瑥鐣烽弴銏＄劶鐎广儱鎳愰ˇ顓㈡⒑闂堟单鍫ュ疾濠婂牆鐓曢柟杈鹃檮閻撴洘绻涢幋鐑囧叕鐎规悶鍎崇槐鎺懳旀担绋挎懙闂佸搫鐭夌紞渚€骞冮姀銈呯骇闁瑰瓨绻傞～鎾翠繆閻愵亜鈧牠寮婚妸褎宕叉慨妞诲亾鐎殿喖顭峰畷鍗炍旀繝鍌涘€梻浣告啞娓氭宕归悡骞綁骞橀瑙ｆ嫽婵炶揪绲块…鍫ニ夎箛娑欑厱閻庯綆浜濋崳褰掓偂閵堝棙鍙忔俊鐐额嚙娴滄儳顪冮妶鍐ㄧ仾闁挎岸鎮￠妶鍡愪簻闊洦鎸婚崳浠嬫煕?swet 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗ù锝夋交閼板潡寮堕崼姘珔闁搞劍绻冮妵鍕冀閵娧呯厑闂佸搫妫欑划宥嗙┍婵犲洤围闁告侗鍙庢禒鍓х磽?
   */
  updateSpineFace(idolId, faceName, faceFlags) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry
    try {
      // Normalize: ensure faceName starts with "face_"
      const animName = faceName.startsWith('face_') ? faceName : `face_${faceName}`
      const allAnims = spine.state.data.skeletonData.animations.map(a => a.name)
      const faceKey = faceFlags && typeof faceFlags === 'object'
        ? `${animName}|${faceFlags.anim_flag || ''}|${faceFlags.blush_flag || ''}|${faceFlags.sweat_flag || ''}`
        : `${animName}|||`

      // 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾鐎规洦鍨跺畷绋课旈埀顒勫磼閵婏妇绡€濠电姴鍊绘晶鏇犵棯閹岀吋闁哄瞼鍠栧畷婊嗩槾閻㈩垱鐩弻锝夊箻閸愬弶娈婚梺鍝勬湰缁嬫牜绮诲☉銏犵闁告劏鏁╅敂鐣岀?濠电姷鏁告慨鐑藉极閹间礁纾块柟瀵稿Т缁躲倝鏌﹀Ο渚＆婵炲樊浜濋弲婊堟煟閹伴潧澧幖鏉戯躬濮婅櫣绮欑捄銊т紘闂佺顑囬崑銈呯暦閹达箑围濠㈣泛顑囬崢顏呯節閻㈤潧浠ч柛瀣尭閳诲秹宕卞☉娆戝幈闁诲函缍嗘禍鍫曞磿閺冨牊鐓欐い鏃傚帶濡插鏌嶇拠鍙夊攭缂佺姵鐩獮娆撳礃瑜忓Λ顖氣攽?flag 濠电姷鏁告慨鐑藉极閹间礁纾婚柣鎰惈缁犱即鏌ゆ慨鎰偓鏇㈠几閸懇鍋撻獮鍨姎婵炲眰鍔戦幆灞解枎閹惧鍘甸梺缁樺灦閿曗晛鈻撻弴銏＄厱閹肩补妲勯煬顒勬煛鐏炶濡奸柍钘夘槸铻ｅ〒姘煎灟閻ヮ亪姊绘担鍛婃儓婵☆偅鐟ч崚鎺撴償閵娿儳鐤呴梺褰掓？缁€浣虹不閿濆鐓ラ柡鍐ㄦ储閳ь兘鍋撻梺绋款儐閹瑰洤鐣烽妸鈺佺妞ゆ挾鍠愬▍鍥⒒娴ｇ懓顕滄俊顐＄铻為柛鏇ㄥ灠缁€?闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾鐎规洦鍨跺畷绋课旈埀顒勫磼閵婏妇绡€濠电姴鍊绘晶鏇犵棯閹岀吋闁哄瞼鍠栧畷婊嗩槾閻㈩垱鐩弻锝夊箻閸愬弶娈婚梺鍝勬湰缁嬫牜绮诲☉銏犵闁告劏鏁╅敂鐣岀?
      if (faceFlags && typeof faceFlags === 'object') {
        spine._faceFlags = {
          anim_flag: faceFlags.anim_flag || '',
          blush_flag: faceFlags.blush_flag || '',
          sweat_flag: faceFlags.sweat_flag || '',
        }
      }

      if (allAnims.includes(animName)) {
        if (spine._currentFaceKey === faceKey) return
        const trackEntry = spine.state.setAnimation(1, animName, true)
        spine._currentFaceAnim = animName
        spine._currentFaceKey = faceKey
        if (trackEntry) {
          trackEntry.mixAttachmentThreshold = 0.0
          spine._blinkCoverEndTime = 0
          spine._savedEyeAtts = null

          // 闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾鐎规洦鍨跺畷绋课旈埀顒勫磼閵婏妇绡€濠电姴鍊绘晶鏇犵棯閹岀吋闁哄瞼鍠栧畷婊嗩槾閻㈩垱鐩弻锝夊箻閸愬弶娈婚梺鍝勬湰缁嬫牜绮诲☉銏犵闁告劏鏁╅敂鐣岀?闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偞鐗犻、鏇㈡晝閳ь剛绮婚悩鍏呯箚妞ゆ牗绻傛禍鍦棯閹规劕袚闁逛究鍔岃灒闁圭娴烽妴鎰磽娴ｆ彃浜鹃梺绋挎湰缁嬫帡宕ｈ箛鏂剧箚闁绘劙顤傞崵娆徝瑰鍫㈢暫婵﹨娅ｉ幏鐘诲灳瀹曞洣鍝楁繝鐢靛仜濡﹪宕㈤懞銉р攳濠电姴鍋嗗鎵偓鍏夊亾濠电姴鍞鍡欑＝闁稿本鐟╁鐑芥煕閺傝法肖闁告帗甯￠獮妯兼嫚閼艰埖鎲伴梻浣虹帛濮婂宕曢妶鍥︾剨闁圭儤鍩堥悢鍡涙偣閾忕懓鐨戠€规悶鍎甸弻锟犲幢濡吋鍣伴梺?闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾鐎规洦鍨跺畷绋课旈埀顒勫磼閵婏妇绡€濠电姴鍊绘晶鏇犵棯閹岀吋闁哄瞼鍠栧畷婊嗩槾閻㈩垱鐩弻锝夊箻閸愬弶娈婚梺鍝勬湰缁嬫牜绮诲☉銏犵闁告劏鏁╅敂鐣岀?
          // 闂?闂?blink cover 150ms (闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸弫鎾绘偐閸愯弓鐢婚梻浣瑰缁诲倿藝椤栨粌顥氶柛褎顨嗛埛鎴炪亜閹哄棗浜剧紓浣割槺閺佽鐣烽幋锕€围闁糕剝鐟ч鏇㈡⒑缁洖澧叉い銊ユ缁鈧綆鍠楅悡鏇㈡煏閸繃顥炵紒鈧€ｎ喗鐓涢悘鐐垫櫕鍟稿銇卞倻绐旈柡灞剧洴楠炴澹曠€ｎ亶妫熸俊鐐€栧ú蹇涘磿闂堟稓鏆﹂柣鏃傗拡閺佸洭鏌ｉ幋婵囶棡妞ゃ儻绻濆铏规嫚閹绘帒姣愮紓鍌氱Т濡瑧绮嬪鍛斀閻庯絽鐏氶弲鈺呮⒑閹肩偛鍔撮柛鎾村哺閸╂盯骞嬮悩鐢碉紳婵炶揪绲介～鏍敂閸℃瑧鐣跺┑顔筋焾閸╂牠鎮￠弴銏犵婵烇綆鍓欓埀顒佹礃缁傚秷銇愰幒鎾跺幍濡ょ姷鍋涢悘婵嬫倶閼碱兘鍋撶憴鍕闁挎洏鍨烘穱濠囧箹娴ｈ娅滈梺绋挎湰閻喗绔熼弴銏♀拺闁革富鍘奸崝瀣亜閵娿儲鍤囬柟顕嗙節閺佹捇鎮╁畷鍥у箞婵犵數鍋為崹闈涚暦椤掑嫭鍊堕柨婵嗘娴滄粓鏌ㄩ弮鍥跺殭婵炲懎绉甸幈銊︾節閸屻倗鍚嬮悗瑙勬礃鐢帡锝炲┑瀣垫晞閻犳亽鍔嶉弲濂告⒒閸屾瑧顦﹂柟鐚溿倖鎳岄梻浣侯焾鐎涒晜绻涙繝鍥ф槬闁绘劕鎼粈鍐┿亜閺冨洤浜归柨娑欑矒濮婅櫣绱掑Ο鍝勵潙闁诲繐绻戦悷鈺呫€佸▎鎰瘈闁搞儯鍔夐幏娲⒑閸涘﹤濮囩€殿喖鐖奸獮鍡涘醇閵夛妇鍘遍梺缁樻磻缁€渚€鎮橀敐鍜佺唵閻熸瑥瀚粈鍐倵娴ｅ啫浜归柍褜鍓氱粙鎺椻€﹂崶顒€鍌ㄩ梺顒€绉甸埛鎴︽煕閿旇骞栭柛鏂款儔閺屾盯濡搁妸銉у帿閻庡灚婢樼€氭澘鐣烽悢纰辨晣婵炴垶眉婢规洟鏌ｉ悢鍝ユ噧閻庢凹鍘剧划鍫ュ礃椤旂晫鍘介梺鐟扮仢鐎氼喚寮ч埀顒€螖閻橀潧浠滄俊顐ｇ箞瀹曟椽鍩€椤掍降浜滈柟鐑樺灥椤忣亪鏌ｉ幘瀵告创闁哄本鐩俊鐑筋敍濠婂啫鐓傚┑鐘媰閸曨偆绁烽梺?
          // off 闂?闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏇楀亾妞ゎ亜鍟村畷绋课旈埀顒傜矆閸儲鐓ラ柡鍥╁仜閳ь剙鎽滅划鍫ュ醇閻旇櫣顔曢梺绯曞墲钃遍悘蹇ｅ弮閺屾盯濡搁妷銉㈠亾閸ф鍋傛い鎰剁畱閻愬﹪鏌曟繛褉鍋撳┑顔兼喘濮婃椽宕崟顒€顎涢梺鍛婃尵閸犳牠鐛崘顭戞建闁逞屽墴楠炲啫鈻庨幋鐐茬／闁哄鍋熸晶妤呮儓韫囨稒鈷掑ù锝堟閸氬綊鏌涢悩鍐插闁瑰箍鍨藉畷濂稿Ψ閵夈劍鎲版繝鐢靛仦閸ㄥ爼宕洪崘顔肩；闁瑰墽绮弲鏌ュ箹缁厜鍋撻懠顒€鍤梻鍌欑劍閻綊宕濆澶婂瀭闁告挷鐒﹀畷鍙夌節闂堟侗鍎忛柣鎺戠仛閵囧嫰骞掗幋婵愪紝闂佽桨绀侀崐鍧楀蓟濞戙埄鏁冮柕鍫濇噺閻庡姊?(闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偛顦甸弫鎾绘偐閸愯弓鐢婚梻浣瑰缁诲倿藝椤栨粌顥氶柛顭戝晹瑜版帗鍋傞幖杈剧稻閹插ジ姊洪幖鐐测偓鏇㈡偋閹捐钃熼柣鏂挎啞缂嶅洭鏌涢幘妤€鎳忓▓鍝ョ磽閸屾瑨鍏屽┑顕€娼ч悾婵嬪箹娴ｆ瓕鎽曞┑鐐村灦鑿ゆ俊鎻掔墦閺屾稑螖閸愩劋鎴锋繛瀵稿Л閺呯娀骞冨Δ鍐╁枂闁告洦鍓涢ˇ銊モ攽閻愭彃绾х紒顔奸鍗遍柟鐗堟緲缁犺櫕淇婇妶鍌氫壕缂備胶濮电粙鎺楀Φ閸曨喚鐤€闁规崘鎻槐鐐测攽閳ヨ櫕鈻曢柛锝忕秮楠炲啫鐣￠柇锔惧弳闂佸憡娲﹂崜娑㈠礄閳ユ剚娓婚柕鍫濈箰椤╊剟鏌℃担绛嬪殭妞ゆ洩缍侀、鏇㈠閳轰焦鍊梻浣规偠閸庡姊介崟顖氱闁告劦鍠楅埛鎴︽煕韫囨艾浜归柕鍫熸尦閺岋繝宕ㄩ鍓х杽濡ょ姷鍋涢ˇ鎶藉Φ閹版澘绠抽柟缁㈠灡鐎氬ジ姊绘担铏瑰笡闁瑰摜顭堥湁闁绘垼濮ら弲顒傗偓骞垮劚椤︿即鎮″☉銏＄厱婵犲ň鍋撶紒鈧担鍦洸濞寸厧鐡ㄩ悡娆愩亜閺冨洤袚闁靛洦绻冮〃銉╂倷瀹割喖鍓堕梺杞扮閸婂骞夐幘顔芥櫜闁糕剝顨忔导婊勭節绾板纾块柛瀣灴瀹曟劙寮介鐐殿唶闂佺粯鍔﹂崜姘跺矗韫囨稒鐓熸い顐幘缁佸嘲鈹?
          // 闂?闂傚倸鍊搁崐鎼佸磹妞嬪海鐭嗗〒姘ｅ亾妤犵偞鐗犻、鏇㈡晜閽樺缃曟繝鐢靛Т閿曘倗鈧凹鍣ｉ妴鍛村蓟閵夛妇鍘介梺褰掑亰閸犳牠宕濈€ｎ喗鐓?flag 闂?濠电姷鏁告慨鐑藉极閹间礁纾块柟瀵稿Т缁躲倝鏌﹀Ο渚＆婵炲樊浜濋弲婊堟煟閹伴潧澧幖鏉戯躬濮婅櫣绮欑捄銊т紘闂佺顑囬崑銈呯暦閹达箑鐓涢柛鎰ㄦ櫅閺嬫垿鏌熼崗鑲╂殬闁告柨顦甸崺鈧い鎺嶇劍椤ュ牓鏌涢埞鎯т壕婵＄偑鍊栫敮濠傤渻閹烘梹宕查柛鈩兦滄禍婊堟煛瀹ュ啫濡虹紒鍫曚憾閺屾稒鎯斿☉妯哄Е闂佸搫鏈粙鎴︼綖濠靛鏁嗗ù锝呮啞閻忓酣姊绘担鍛婃儓閻炴凹鍋婂畷婵嗙暆閸曨偆鍙€婵犮垼娉涜癌闁绘梻鍘ч崹鍌涖亜閺囩偞鍣哥紒杈ㄦ⒐缁绘繈鎮介棃娑楃捕濡炪倖娲﹂崢浠嬪箞閵娾晜鍋ㄩ柛娑橈工閸擃喖顪冮妶鍡欏⒈闁稿绋撶划璇差潩閼哥數鍘遍梺闈涱樈閸犳牗鏅堕鈧獮鍡涙偄閸忕厧浠┑鐘诧工閸燁垶骞戦敐澶嬬厾闁告繂瀚懜瑙勩亜椤撴粌濮傜€规洖銈搁幃銏ゅ传閸曨偆顓奸梻鍌欐祰瀹曠敻宕戦悙鐢电煓闁割偁鍎辩粈鍫熺節闂堟稒顥戦柡瀣Ч閺屾盯鍩勯崘锔跨捕闂佽　鍋?
          if (faceFlags && typeof faceFlags === 'object' && faceFlags.anim_flag === 'off') {
            // off means the switch is instant, without blink masking.
            spine._blinkCoverEndTime = 0
          } else if (faceFlags && typeof faceFlags === 'object' && faceFlags.anim_flag === '闂?') {
            // anim_flag === '闂?: 闂傚倸鍊搁崐鎼佸磹閻戣姤鍊块柨鏇楀亾妞ゎ亜鍟撮獮鎰償閿濆孩閿ゆ繝寰锋澘鈧洟骞婃惔锝囩焼濠㈣埖鍔曠粻鍦磼椤旀娼愭い搴℃閺岋繝鍩€椤掑嫭鏅濋柛灞剧〒閸橀亶鎮楅崗澶婁壕闂侀€炲苯澧寸€规洘鍨甸埥澶婎潩閸欐鐟濋梻浣筋潐閸庡吋鎱ㄩ妶澶嬪亗闁告劦鍠楅悡鏇熺節闂堟稒顥滄い蹇婃櫊閺屽秷顧侀柛鎾村哺閹椽寮撮～顑藉亾?150ms
            spine._blinkCoverEndTime = 0
            spine._savedEyeAtts = null
            trackEntry.mixDuration = 0.03
          } else {
            // 闂?flags 闂傚倸鍊搁崐鎼佸磹閻戣姤鍤勯柛顐ｆ礀缁犵娀鏌熼崜褏甯涢柛瀣ㄥ€濋弻鏇熺箾閻愵剚鐝曢梺绋款儏椤戝棙绌辨繝鍥ч柛灞剧煯婢规洟姊绘担鐟邦嚋婵炴彃绻樺畷瑙勭鐎ｃ劉鍋撴担鍓叉建闁逞屽墯閹便劑鍩€椤掑嫭鐓冮柕澶堝劚閺嗗崬顭跨憴鍕诞婵﹦绮粭鐔煎焵椤掆偓椤洩顦归挊婵囥亜閹惧崬鐏╃痪鐐閵囧嫰寮村Δ鈧禍楣冩倵? 闂傚倸鍊搁崐宄懊归崶顒夋晪鐟滃秹婀侀梺缁樺灱濡嫮绮婚悩缁樼厵闁诡垎鍐╊啈闂佹悶鍎洪崜锕傚极瀹ュ鐓熼柟閭﹀灠閻ㄦ椽鏌ｉ幘鏉戠伌婵☆偄鎳橀、鏇㈠閳ユ剚妲辨繝纰樻閸嬪嫮鎹㈤幇鏉课ラ柟鐑橆殕閸ゅ鏌涜箛鎾存喐缂佺姵鑹鹃—鍐Χ閸℃瑥顫ф繛鎾寸椤ㄥ﹤鐣烽弴銏犖ㄩ柍鍝勫€婚崢鍗炩攽椤旀枻渚涢柛鎾村哺瀹曟澘顫滈埀顒勫蓟閿涘嫪娌悹鍥ㄥ絻椤牓姊虹€圭姵顥夋い锔诲灥閻忔帡姊洪崜鑼帥闁革綆鍠楃€靛ジ宕橀妸銏℃杸闂佺粯鍔曞Ο濠囧吹閻斿皝鏀芥い鏃傚亾閺嗩剟鏌熼姘伃妞ゃ垺鐩幃娆撴嚑椤掑倹姣庨梻鍌欑劍閹爼宕曞ú顏勭婵炲棙鍔曢崝鏃堟⒑閼姐倕鏋戠紒顔艰嫰闇夐柣鎴ｅГ閸ゅ秹鏌涘Δ鍐ㄥ壉闁绘挶鍎甸弻娑㈩敃閵堝懏鐏侀梺鍛婎焽閺佸寮婚敐澶嬪€烽悗鐢电《閺嬫棃姊洪崨濠冨鞍缂佽鍊块崺銏狀吋婢跺﹤鑰垮┑锛勫仧缁垶寮埀?
            spine._blinkCoverEndTime = 0
            spine._savedEyeAtts = null
            trackEntry.mixDuration = 0.03
          }
        }
      } else {
        // Fallback: clear Track 1 to show the default skeleton face
        console.warn(`[PixiStageManager] Face anim "${animName}" not found on "${entry.modelId}", clearing track`)
        spine.state.clearTrack(1)
        spine._currentFaceAnim = null
        spine._currentFaceKey = null
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
    entry._tween?.cancel?.()
    const startX = entry.spine.x
    const dx = targetX - startX
    const duration = 280
    entry._tween = runRafTween({
      durationMs: duration,
      startValue: startX,
      endValue: targetX,
      ease: easeOutCubic,
      onUpdate: (x) => {
        entry.spine.x = x
      },
      onComplete: () => {
        entry._tween = null
      },
    })
  }

  setSpineAlpha(idolId, alpha) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const target = entry.wrapper || entry.spine
    target.alpha = alpha
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
   *   - Most emotional actions have a paired loop: `angry` 闂?`angry_loop`.
   *   - Single-shot animations (e.g. `neck_yes`, `neck_no`) have no `_loop` variant
   *     and should fall back to `wait_loop`.
   */
  playSpineAnim(idolId, animName, skipChain = false, noBack = false, motionSetting = null) {
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry
    try {
      const allAnims = spine.state.data.skeletonData.animations.map(a => a.name)
      if (spine._currentBodyAnim === animName) return

      if (animName.endsWith('_loop')) {
        // Already a loop animation 闂?play directly
        spine.state.setAnimation(0, animName, true)
      } else if (skipChain || noBack) {
        // Single-shot, no auto-chain 闂?used when step has timeline
        spine.state.setAnimation(0, animName, false)
      } else {
        // Single-shot animation: play once, then chain the official pose loop.
        const loopVariant = animName + '_loop'
        const officialPose = motionSetting?.pose || ''
        const fallback = officialPose && allAnims.includes(officialPose)
          ? officialPose
          : allAnims.includes(loopVariant)
            ? loopVariant
            : 'wait_loop'

        spine.state.setAnimation(0, animName, false)
        if (allAnims.includes(fallback)) {
          spine.state.addAnimation(0, fallback, true, 0)
        }
      }
      spine._currentBodyAnim = animName
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to play anim "${animName}" on "${idolId}":`, err.message)
    }
  }

  /**
   * Instant body animation switch 闂?no crossfade morph (for timeline events).
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
      spine.stateData.defaultMix = 0.3  // 300ms 闂?smooth timeline anim transitions
      spine.state.setAnimation(0, animName, isLoop)
      spine._currentBodyAnim = animName
      spine.stateData.defaultMix = savedMix
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to switch anim "${animName}" on "${idolId}":`, err.message)
    }
  }

  playSpineNeckAnim(idolId, animName) {
    // DISABLED 闂?neck animation on Track 3 causes pose freezing; needs full
    // transition model rework to match official snap-cut style (see ADV_STATE_MACHINE_NOTES.md)
    return
    /* original code:
    const entry = this.spineInstances[idolId]
    if (!entry) return
    const { spine } = entry
    try {
      const allAnims = spine.state.data.skeletonData.animations.map(a => a.name)
      if (!allAnims.includes(animName)) {
        console.warn(`[PixiStageManager] Neck anim "${animName}" not found on "${entry.modelId}"`)
        return
      }
      if (spine._currentNeckAnim === animName) return
      const track = spine.state.setAnimation(3, animName, false)
      spine._currentNeckAnim = animName
      if (track) {
        const listener = { complete: () => { spine.state.setEmptyAnimation(3, 0.25); spine._currentNeckAnim = null } }
        track.listener = listener
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to play neck anim "${animName}" on "${idolId}":`, err.message)
    }
    */
  }

  stopSpineNeckAnim(idolId) {
    // DISABLED 闂?see playSpineNeckAnim
    /* original code:
    const entry = this.spineInstances[idolId]
    if (!entry) return
    try {
      entry.spine.state.setEmptyAnimation(3, 0.25)
      entry.spine._currentNeckAnim = null
    } catch (err) {
      console.warn(`[PixiStageManager] Failed to stop neck anim on "${idolId}":`, err.message)
    }
    */
  }

  /**
   * Remove a spine model with a fade-out transition.
   * The model fades out over ~12 frames then destroys itself.
   */
  removeSpine(idolId, immediate = false) {
    this._fadeOutAndDestroy(idolId, immediate)
  }

  clearAllSpines() {
    this._pendingTalking = {}
    // Reset camera zoom/pan
    this.resetCameraZoom()
    // Collect wrappers first so we can clear the map before fade-outs begin.
    // This avoids stale ticker callbacks destroying a newer model with the same idolId.
    const wrappers = []
    for (const idolId of Object.keys(this.spineInstances)) {
      this._spawnTokens[idolId] = (this._spawnTokens[idolId] || 0) + 1
      const entry = this.spineInstances[idolId]
      delete this.spineInstances[idolId]
      if (entry) {
        if (entry.spine) entry.spine.customIsTalking = false
        if (entry._slideTweenRaf) {
          cancelAnimationFrame(entry._slideTweenRaf)
          entry._slideTweenRaf = null
        }
        wrappers.push(entry.wrapper || entry.spine)
      }
    }

  }

  destroy() {
    this._dragSpineId = null
    if (this._globalMoveHandler && this.app) {
      this.app.stage.off('globalpointermove', this._globalMoveHandler)
      this._globalMoveHandler = null
    }
    if (this._debugMarkerUpdater && this.app?.ticker) {
      this.app.ticker.remove(this._debugMarkerUpdater)
      this._debugMarkerUpdater = null
    }
    if (this._debugOverlay) {
      this._debugOverlay.destroy({ children: true })
      this._debugOverlay = null
    }
    this._resizeObserver?.disconnect()
    this._resizeObserver = null
    this.clearAllSpines()
    this.clearBackground()
    for (const id of Object.keys(this._bgEffectEntries)) {
      this._removeBgEffect(id)
    }
    this._bgEffectEntries = {}
    if (this.app) {
      this.app.destroy(true)
      this.app = null
    }
  }
}
