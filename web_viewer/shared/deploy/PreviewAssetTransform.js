/**
 * Deployment transform policy for the private R2 Preview.
 *
 * Runtime URLs are a frozen contract: Story JSON, Spine `.atlas` files and the
 * asset resolvers keep requesting `.png`. Only the physical R2 object may differ,
 * so the same pure policy must drive both the local exporter and the Pages
 * Function. Nothing here may touch the filesystem, Node built-ins or the DOM.
 */

// The whole PNG corpus is converted. `assets/brand/` is the single documented
// exception: it stays a real PNG so `verify-preview-http` keeps a control probe
// proving that an untransformed PNG request still serves PNG bytes. Expressed as
// an exclusion list rather than an allowlist because the intent is "all of it,
// with one named exception" -- an allowlist would silently skip any resource
// family added later.
export const PREVIEW_WEBP_EXCLUDED_PREFIXES = Object.freeze([
  'assets/brand/',
])

export const COPY_TRANSFORM = 'copy'
export const LOSSLESS_WEBP_TRANSFORM = 'webp-lossless-alpha0-rgb0'
export const GZIP_TRANSFORM = 'gzip-v1'
export const PREVIEW_GZIP_PREFIXES = Object.freeze([
  'data/compiled/', 'assets/lipsync/', 'assets/live-chibi/motions/',
])

export function isPreviewGzipCandidate(key) {
  return typeof key === 'string'
    && ((key.endsWith('.json') && PREVIEW_GZIP_PREFIXES.slice(0, 2).some(prefix => key.startsWith(prefix)))
      || (key.startsWith('assets/live-chibi/motions/') && /\.(motion|bin)$/.test(key)))
    && !key.split('/').some(part => !part || part === '.' || part === '..' || part.includes('\\'))
}

// Default off: pushing code must not switch live requests to objects that have
// not been uploaded. Canary mode changes only the explicit, reviewed key list.
export function previewGzipEnabled(env, key) {
  if (!isPreviewGzipCandidate(key)) return false
  if (env.ARCHIVE_GZIP_MODE === 'all') return true
  if (env.ARCHIVE_GZIP_MODE !== 'canary') return false
  const keys = JSON.parse(env.ARCHIVE_GZIP_CANARY_KEYS || '[]')
  if (!Array.isArray(keys) || !keys.every(isPreviewGzipCandidate)) throw new Error('Invalid gzip canary keys')
  return keys.includes(key)
}

const PNG_EXTENSION = /\.png$/i

export function isPreviewLosslessWebpCandidate(requestKey) {
  if (typeof requestKey !== 'string' || !PNG_EXTENSION.test(requestKey)) return false
  return !PREVIEW_WEBP_EXCLUDED_PREFIXES.some(prefix => requestKey.startsWith(prefix))
}

/** Logical request key -> physical R2 object key. Identity when not transformed. */
export function isPreviewDataSnapshotKey(key) {
  return typeof key === 'string' && key.startsWith('data/') && !key.startsWith('data/compiled/')
    && key.endsWith('.json') && !key.split('/').some(part => !part || part === '.' || part === '..' || part.includes('\\'))
}

export function resolvePreviewObjectKey(requestKey, { gzip = false, dataRevision = '' } = {}) {
  if (dataRevision && isPreviewDataSnapshotKey(requestKey)) {
    if (!/^[a-f0-9]{64}$/.test(dataRevision)) throw new Error('Invalid data snapshot revision')
    return `versions/${dataRevision}/${requestKey}`
  }
  if (gzip && isPreviewGzipCandidate(requestKey)) return `${requestKey}.gz`
  return isPreviewLosslessWebpCandidate(requestKey)
    ? requestKey.replace(PNG_EXTENSION, '.webp')
    : requestKey
}

export function previewTransformKind(requestKey, { gzip = false } = {}) {
  if (gzip && isPreviewGzipCandidate(requestKey)) return GZIP_TRANSFORM
  return isPreviewLosslessWebpCandidate(requestKey) ? LOSSLESS_WEBP_TRANSFORM : COPY_TRANSFORM
}
