// Encode a single PNG from bounded raster tiles, never a full-height Canvas.
// PNG IDAT chunks concatenate one zlib stream; tile boundaries are not image boundaries.
export const PNG_TILE_PIXELS = 2 * 1024 * 1024
export const PNG_BROWSER_PIXELS = 64 * 1024 * 1024
export const PNG_OUTPUT_BUDGET = 256 * 1024 * 1024
const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const table = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1
  return n >>> 0
})
export function pngChunk(type, data = new Uint8Array()) {
  const result = new Uint8Array(data.length + 12), view = new DataView(result.buffer)
  view.setUint32(0, data.length)
  result.set(new TextEncoder().encode(type), 4); result.set(data, 8)
  let crc = 0xffffffff
  for (let i = 4; i < result.length - 4; i++) crc = table[(crc ^ result[i]) & 255] ^ (crc >>> 8)
  view.setUint32(result.length - 4, (crc ^ 0xffffffff) >>> 0)
  return result
}
export function pngHeader(width, height) {
  if (![width, height].every(n => Number.isSafeInteger(n) && n > 0 && n <= 0x7fffffff)) throw new Error('PNG 尺寸超出格式上限；请使用离线导出，不会缩小或截断谱面')
  const data = new Uint8Array(13), view = new DataView(data.buffer)
  view.setUint32(0, width); view.setUint32(4, height)
  data[8] = 8; data[9] = 6 // 8-bit RGBA
  return [signature, pngChunk('IHDR', data)]
}
export function planSongChartPng(width, height, factor = 2) {
  if (![width, height, factor].every(n => Number.isSafeInteger(n) && n > 0) || factor > 4) throw new Error('PNG 导出尺寸无效')
  const outputWidth = width * factor, outputHeight = height * factor
  pngHeader(outputWidth, outputHeight)
  const overlap = 8
  const tileHeight = Math.min(1024, Math.floor(PNG_TILE_PIXELS / outputWidth) - 2 * overlap)
  if (tileHeight < 1 || outputWidth > 4096) throw new Error('单段像素预算不足；请使用离线导出，不会缩小或截断谱面')
  return { width: outputWidth, height: outputHeight, factor, overlap, tileHeight }
}

export function assertBrowserSongChartPng(width, height, factor = 2) {
  const plan = planSongChartPng(width, height, factor)
  // Repeated SVG decodes also consume browser memory, even with bounded Canvas tiles.
  // Reject before asset embedding/rasterization; the offline encoder has no total pixel cap.
  if (plan.width > PNG_BROWSER_PIXELS / plan.height) throw new Error('完整 PNG 超出浏览器安全像素预算；请先导出 SVG，再使用离线导出。不会缩小或截断谱面')
  return plan
}

export function songChartPngTile(document, plan, start, rows) {
  const top = Math.max(0, start - plan.overlap)
  const bottom = Math.min(plan.height, start + rows + plan.overlap)
  const svg = document.documentElement
  svg.setAttribute('width', plan.width); svg.setAttribute('height', bottom - top)
  svg.setAttribute('viewBox', `0 ${top / plan.factor} ${plan.width / plan.factor} ${(bottom - top) / plan.factor}`)
  svg.setAttribute('preserveAspectRatio', 'none')
  return { top, height: bottom - top, crop: start - top, rows }
}
export async function exportSongChartPng(content, { factor = 2, onProgress = () => {}, check = () => {} } = {}) {
  if (typeof CompressionStream !== 'function') throw new Error('浏览器不支持分段 PNG 编码；请保存 SVG 并使用 npm run export:song-chart-png -- input.svg output.png')
  const doc = new DOMParser().parseFromString(content, 'image/svg+xml')
  if (doc.querySelector('parsererror')) throw new Error('SVG 解析失败')
  const box = doc.documentElement.getAttribute('viewBox').split(/\s+/).map(Number)
  if (box[0] !== 0 || box[1] !== 0) throw new Error('谱面坐标无效')
  const plan = assertBrowserSongChartPng(box[2], box[3], factor)
  const parts = pngHeader(plan.width, plan.height)
  const stream = new CompressionStream('deflate'), writer = stream.writable.getWriter(), reader = stream.readable.getReader()
  let compressedBytes = 0, streamError
  const drain = (async () => {
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        check(); compressedBytes += value.byteLength + 12
        if (compressedBytes > PNG_OUTPUT_BUDGET) throw new Error('PNG 文件超过浏览器安全预算；请保存 SVG 并使用离线导出，尺寸保持不变')
        parts.push(pngChunk('IDAT', value))
      }
    } catch (e) { streamError = e; await reader.cancel(e).catch(() => {}) }
  })()
  const canvas = document.createElement('canvas')
  let tileUrl, image
  try {
    for (let start = 0; start < plan.height; start += plan.tileHeight) {
      check(); if (streamError) throw streamError
      const tile = songChartPngTile(doc, plan, start, Math.min(plan.tileHeight, plan.height - start))
      tileUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(doc)], { type: 'image/svg+xml' }))
      image = new Image(); image.src = tileUrl
      await image.decode(); check()
      canvas.width = plan.width; canvas.height = tile.height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('浏览器无法创建栅格画布；请使用离线导出')
      ctx.drawImage(image, 0, 0)
      const pixels = ctx.getImageData(0, tile.crop, plan.width, tile.rows).data
      // Filter 0 for each row, inside the single continuous deflate stream.
      const stride = plan.width * 4, rows = new Uint8Array((stride + 1) * tile.rows)
      for (let row = 0; row < tile.rows; row++) rows.set(pixels.subarray(row * stride, (row + 1) * stride), row * (stride + 1) + 1)
      await writer.write(rows)
      URL.revokeObjectURL(tileUrl); tileUrl = null; image.src = ''; image = null
      onProgress(Math.round((start + tile.rows) / plan.height * 100))
      await new Promise(resolve => setTimeout(resolve, 0))
    }
    await writer.close(); await drain
    if (streamError) throw streamError
    check(); parts.push(pngChunk('IEND'))
    return new Blob(parts, { type: 'image/png' })
  } catch (e) {
    await writer.abort(e).catch(() => {}); await drain
    throw streamError || e
  } finally {
    if (tileUrl) URL.revokeObjectURL(tileUrl)
    if (image) image.src = ''
    canvas.width = canvas.height = 0
  }
}
