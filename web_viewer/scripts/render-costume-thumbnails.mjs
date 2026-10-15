// Costume thumbnails for story-only models the client ships no (or a mismatched) image_costume_icon for.
// Renders each model on the running viewer's home spine stage (paused idle frame), once over black and once
// over white; the pair gives exact alpha. The canvas draws the stage under a view transform, so the neck and
// hip bones are located by drawing markers at them. The crop runs from the chin to below the hip, matching
// the game's 148 px torso icons; full-body suits (FULL_FIGURE) are shrunk onto the stage and shown whole.
// Writes public/assets/costume-renders/<model>.png (ignored media, upload with the release) and the tracked
// manifest src/data/costumeRenderThumbs.json.
// Usage: PLAYWRIGHT_MODULE=<path to playwright/index.mjs> node scripts/render-costume-thumbnails.mjs [--base http://127.0.0.1:5177] [model ...]
import crypto from 'node:crypto'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const root = new URL('..', import.meta.url)
const args = process.argv.slice(2)
const baseIndex = args.indexOf('--base')
const base = baseIndex >= 0 ? args.splice(baseIndex, 2)[1] : 'http://127.0.0.1:5177'
const SIZE = 148
// A torso crop of the frog suit is only green belly.
const FULL_FIGURE = new Set(['010pie_001_00'])
// The client's icon for this model shows another costume (a yellow jacket; the model is a grey sweater).
const ICON_MISMATCH = new Set(['037jir_108_00'])
const catalog = JSON.parse(fs.readFileSync(new URL('public/data/masterdata/domains/costume_catalog.json', root), 'utf8'))
const stories = JSON.parse(fs.readFileSync(new URL('src/data/storyCostumes.json', root), 'utf8')).costumes
const homeModels = new Set(stories.map(costume => costume.modelId))
const missing = catalog.entries.filter(entry => entry.image?.status === 'file-not-found').map(entry => entry.id)
const models = args.length ? args : [...missing, ...ICON_MISMATCH]
const unreachable = models.filter(model => !homeModels.has(model))
if (unreachable.length) throw new Error(`Not selectable on the home stage: ${unreachable.join(' ')}`)

const playwrightPath = process.env.PLAYWRIGHT_MODULE
if (!playwrightPath) throw new Error('Set PLAYWRIGHT_MODULE to a playwright index.mjs')
const { chromium } = await import(pathToFileURL(playwrightPath).href)
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const outDir = new URL('public/assets/costume-renders/', root)
fs.mkdirSync(outDir, { recursive: true })
const manifestUrl = new URL('src/data/costumeRenderThumbs.json', root)
const manifest = fs.existsSync(manifestUrl) ? JSON.parse(fs.readFileSync(manifestUrl, 'utf8')) : { thumbs: {} }

function prepareStage({ idolCode, full }) {
  const spine = window.__spines?.[idolCode]
  if (!spine) throw new Error(`no spine for ${idolCode}`)
  spine.state.timeScale = 0
  let stage = spine
  while (stage.parent) stage = stage.parent
  // Reuse the page's own Pixi classes through the background sprite, which also spans the view.
  const sprite = stage.children.find(child => child.texture)
  const view = sprite.getBounds()
  const square = () => {
    const shape = new sprite.constructor(sprite.texture.constructor.WHITE)
    stage.addChild(shape)
    return shape
  }
  if (full) {
    const bounds = spine.getBounds()
    const factor = view.height * 0.85 / bounds.height
    spine.scale.set(spine.scale.x * factor, spine.scale.y * factor)
    const fitted = spine.getBounds()
    spine.position.set(spine.x + view.x + view.width / 2 - (fitted.x + fitted.width / 2), spine.y + view.y + view.height / 2 - (fitted.y + fitted.height / 2))
  }
  const keep = new Set()
  for (let node = spine; node; node = node.parent) keep.add(node)
  const hide = node => { for (const child of node.children || []) { if (child === spine) continue; if (keep.has(child)) hide(child); else child.visible = false } }
  hide(stage)
  const backdrop = square()
  stage.setChildIndex(backdrop, 0)
  backdrop.position.set(-5000, -5000)
  backdrop.width = backdrop.height = 10000
  backdrop.tint = 0x000000
  const point = name => { const bone = spine.skeleton.findBone(name); return stage.toLocal(spine.toGlobal({ x: bone.worldX, y: bone.worldY })) }
  const markers = full ? [] : [point('neck'), point('hip')].map(position => {
    const marker = square()
    marker.anchor.set(0.5)
    marker.width = marker.height = 8
    marker.position.copyFrom(position)
    marker.tint = 0xff00ff
    marker.visible = false
    return marker
  })
  const style = document.createElement('style')
  style.textContent = 'body *{visibility:hidden!important}.spine-stage-canvas,.spine-stage-canvas canvas{visibility:visible!important}'
  document.head.append(style)
  window.__thumb = { spine, backdrop, markers }
}

async function composeThumbnail({ black, white, markers, size }) {
  const pixels = async data => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob())
    const work = new OffscreenCanvas(bitmap.width, bitmap.height), context = work.getContext('2d')
    context.drawImage(bitmap, 0, 0)
    return context.getImageData(0, 0, bitmap.width, bitmap.height)
  }
  const onBlack = await pixels(black), onWhite = await pixels(white)
  const { width, height } = onBlack
  const matte = new ImageData(width, height)
  const box = { left: width, right: -1, top: height, bottom: -1 }
  for (let i = 0; i < matte.data.length; i += 4) {
    // white - black = 255 * (1 - alpha) per channel; colour over black is premultiplied.
    const alpha = 1 - ((onWhite.data[i] - onBlack.data[i]) + (onWhite.data[i + 1] - onBlack.data[i + 1]) + (onWhite.data[i + 2] - onBlack.data[i + 2])) / 765
    const a = Math.max(0, Math.min(1, alpha))
    for (let c = 0; c < 3; c++) matte.data[i + c] = a > 0 ? Math.min(255, Math.round(onBlack.data[i + c] / a)) : 0
    matte.data[i + 3] = Math.round(a * 255)
    if (a > 0.05) {
      const x = (i / 4) % width, y = Math.floor(i / 4 / width)
      box.left = Math.min(box.left, x); box.right = Math.max(box.right, x); box.top = Math.min(box.top, y); box.bottom = Math.max(box.bottom, y)
    }
  }
  if (box.right < 0) throw new Error('empty render')
  let crop
  if (markers) {
    const marked = await pixels(markers)
    const spots = []
    for (let i = 0; i < marked.data.length; i += 4) {
      if (marked.data[i] > 200 && marked.data[i + 1] < 60 && marked.data[i + 2] > 200) spots.push({ x: (i / 4) % width, y: Math.floor(i / 4 / width) })
    }
    const midY = spots.reduce((sum, spot) => sum + spot.y, 0) / spots.length
    const centre = list => ({ x: list.reduce((sum, spot) => sum + spot.x, 0) / list.length, y: list.reduce((sum, spot) => sum + spot.y, 0) / list.length })
    const upper = spots.filter(spot => spot.y < midY), lower = spots.filter(spot => spot.y >= midY)
    if (!upper.length || !lower.length) throw new Error('neck/hip markers not both on the canvas')
    const neck = centre(upper), hip = centre(lower), span = hip.y - neck.y
    // The neck bone sits just under the chin: the chin lands at the top edge and the belt about 72% down.
    crop = { x: (neck.x + hip.x) / 2 - span * 0.75, y: neck.y - span * 0.1, side: span * 1.5 }
  } else {
    const side = Math.max(box.right - box.left, box.bottom - box.top) * 1.04
    crop = { x: (box.left + box.right) / 2 - side / 2, y: (box.top + box.bottom) / 2 - side / 2, side }
  }
  const full = new OffscreenCanvas(width, height)
  full.getContext('2d').putImageData(matte, 0, 0)
  const work = new OffscreenCanvas(size, size)
  work.getContext('2d').drawImage(full, crop.x, crop.y, crop.side, crop.side, 0, 0, size, size)
  const bytes = new Uint8Array(await (await work.convertToBlob({ type: 'image/png' })).arrayBuffer())
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text)
}

try {
  for (const model of models) {
    const idolCode = model.slice(0, 6), full = FULL_FIGURE.has(model)
    await page.goto(`${base}/?view=home&home_idol=${idolCode}&home_costume=${model}`)
    await page.waitForSelector(`.immersive-home[data-home-stage-ready="1"][data-home-costume="${model}"]`, { timeout: 120000 })
    await page.waitForTimeout(1500)
    await page.evaluate(prepareStage, { idolCode, full })
    const canvas = page.locator('.spine-stage-canvas canvas')
    const capture = async () => { await page.waitForTimeout(300); return (await canvas.screenshot()).toString('base64') }
    const black = await capture()
    await page.evaluate(() => { window.__thumb.backdrop.tint = 0xffffff })
    const white = await capture()
    let markers = null
    if (!full) {
      await page.evaluate(() => { window.__thumb.backdrop.tint = 0x000000; window.__thumb.spine.visible = false; for (const marker of window.__thumb.markers) marker.visible = true })
      markers = await capture()
    }
    const data = Buffer.from(await page.evaluate(composeThumbnail, { black, white, markers, size: SIZE }), 'base64')
    fs.writeFileSync(new URL(`${model}.png`, outDir), data)
    manifest.thumbs[model] = { url: `/assets/costume-renders/${model}.png`, framing: full ? 'full-figure' : 'torso', ...(ICON_MISMATCH.has(model) ? { replacesIcon: true } : {}), sha256: crypto.createHash('sha256').update(data).digest('hex'), bytes: data.length, width: SIZE, height: SIZE }
    console.log(`${model} ${data.length} B`)
  }
} finally {
  await browser.close()
}
const thumbs = Object.fromEntries(Object.entries(manifest.thumbs).sort(([left], [right]) => left.localeCompare(right)))
fs.writeFileSync(manifestUrl, JSON.stringify({ schema: 'GS-COSTUME-RENDER-THUMBS-V1', source: 'site render of the home spine stage: paused idle frame, alpha from black/white backdrops', thumbs }, null, 1) + '\n')
