/** Strip the existing Unity wrapper before parsing the text atlas. */
export function decodeSpineAtlasText(buffer) {
  const text = new TextDecoder('utf-8').decode(buffer)
  const sizeIndex = text.indexOf('\nsize:')
  if (sizeIndex < 0) return text
  const lineStart = text.lastIndexOf('\n', sizeIndex - 1)
  if (lineStart < 0) return text
  const atlas = text.substring(lineStart + 1)
  const firstLine = atlas.split('\n')[0].trim()
  return firstLine && !firstLine.includes(':') ? atlas : text
}

/** Mirrors the installed TextureAtlas parser: blank lines delimit pages. */
export function readSpineAtlasPages(atlasText) {
  if (typeof atlasText !== 'string') throw new TypeError('Atlas text is required')
  const pages = [], seen = new Set()
  let needPage = true, beforeFirstPage = true
  for (const raw of atlasText.split(/\r\n|\r|\n/)) {
    const line = raw.trim()
    if (!line) { needPage = true; continue }
    // Optional atlas header key/value entries precede the first page.
    if (beforeFirstPage && line.includes(':')) continue
    if (!needPage) continue
    if (/[\\:?#%\x00-\x1f]/.test(line) || line.startsWith('/') ||
        line.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new TypeError(`Unsafe atlas page: ${line}`)
    }
    if (seen.has(line)) throw new TypeError(`Duplicate atlas page: ${line}`)
    seen.add(line); pages.push(line)
    needPage = false; beforeFirstPage = false
  }
  if (!pages.length) throw new TypeError('Atlas contains no texture pages')
  return pages
}

/** Expand logical dependencies without fetching or claiming decode readiness. */
export function resolveSpineAtlasDependencies(plan, { modelId, atlasText, atlasSha256, modelKind }) {
  if (modelKind !== 'spine' || !/^sha256:[a-f0-9]{64}$/.test(atlasSha256 || '')) {
    throw new TypeError('Atlas expansion requires verified Spine model kind and source hash')
  }
  const next = structuredClone(plan)
  const bundle = next.assets.find(asset => asset.key === `spine-bundle:${modelId}`)
  if (!bundle) throw new TypeError('Spine bundle is absent from the plan')
  if (bundle.dependencyState !== 'pending') throw new TypeError('Spine bundle was already expanded')
  const pages = readSpineAtlasPages(atlasText)
  for (const page of pages) {
    const key = `spine-texture:${modelId}/${page}`
    next.assets.push({ key, kind: 'spine-texture', id: `${modelId}/${page}`, dependencies: [],
      dependencyState: 'complete', pending: null, uses: structuredClone(bundle.uses),
      atlasSource: { modelId, sha256: atlasSha256, page } })
    bundle.dependencies.push(key)
  }
  bundle.atlasSource = { sha256: atlasSha256, pages }
  bundle.dependencyState = 'complete'; bundle.pending = null
  next.dependenciesComplete = next.unresolved.length === 0 && next.assets.every(asset => asset.dependencyState === 'complete')
  return next
}
