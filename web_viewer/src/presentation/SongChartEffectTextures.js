// Shared decoded images and bounded, per-cell vertex-color multiplication.
// No blur/drop-shadow surrogate: RGB is multiplied and source alpha retained.
const images = new Map(), cells = new Map()
const MAX_BYTES = 16 * 1024 * 1024
let cachedBytes = 0

// A ready texture is shared for the page's lifetime; a failed one is fetched again by the next
// subscriber, and every listener (renderers included) hears the retry's outcome.
export function subscribeEffectTexture(id, url, listener) {
  let entry = images.get(id)
  if (!entry) images.set(id, entry = { image: null, status: 'failed', listeners: new Set() })
  if (entry.status === 'failed') {
    const image = new Image()
    entry.image = image; entry.status = 'pending'
    for (const fn of entry.listeners) fn(entry)
    image.onload = () => { if (entry.image !== image) return; entry.status = 'ready'; for (const fn of entry.listeners) fn(entry) }
    image.onerror = () => { if (entry.image !== image) return; entry.status = 'failed'; for (const fn of entry.listeners) fn(entry) }
    image.src = url
  }
  entry.listeners.add(listener)
  listener(entry)
  return () => entry.listeners.delete(listener)
}

export function drawEffectTexture(ctx, image, instruction, rect) {
  const { sx, sy, sw, sh, colorTint } = instruction
  const rgb = ['r', 'g', 'b'].map(k => Math.round(Math.max(0, Math.min(1, colorTint?.[k] ?? 1)) * 255))
  if (rgb.every(v => v === 255)) { ctx.drawImage(image, sx, sy, sw, sh, ...rect); return }
  const key = [image.src, sx, sy, sw, sh, ...rgb].join(':')
  let cell = cells.get(key)
  if (!cell) {
    cell = document.createElement('canvas'); cell.width = sw; cell.height = sh
    const buffer = cell.getContext('2d', { willReadFrequently: true })
    if (!buffer) { ctx.drawImage(image, sx, sy, sw, sh, ...rect); return }
    buffer.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh)
    const pixels = buffer.getImageData(0, 0, sw, sh)
    for (let i = 0; i < pixels.data.length; i += 4) {
      for (let channel = 0; channel < 3; channel++) pixels.data[i + channel] *= rgb[channel] / 255
    }
    buffer.putImageData(pixels, 0, 0)
    const bytes = sw * sh * 4
    while (cells.size && cachedBytes + bytes > MAX_BYTES) {
      const oldest = cells.keys().next().value, removed = cells.get(oldest)
      cachedBytes -= removed.width * removed.height * 4; cells.delete(oldest)
    }
    if (bytes <= MAX_BYTES) { cells.set(key, cell); cachedBytes += bytes }
  } else { cells.delete(key); cells.set(key, cell) }
  ctx.drawImage(cell, ...rect)
}
