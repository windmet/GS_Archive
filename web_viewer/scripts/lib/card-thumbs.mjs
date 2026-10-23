import fs from 'node:fs/promises'
import path from 'node:path'
import { encodeLosslessWebp } from './lossless-webp.mjs'
import { CARD_ART_THUMB_PREFIX, CARD_ART_THUMB_QUALITY, cardArtThumbSpec } from '../../shared/portal/CardArtThumbnails.js'

/**
 * Portal card-art thumbnail cache.
 *
 * Thumbnails are derived, never part of the corpus: the source of truth stays
 * the original PNG under the external card-art root. The encoded WebP is cached
 * under this checkout's ignored `.analysis/` tree and reused by both the dev
 * server and the deployment export, so the bytes the browser sees locally are
 * exactly the bytes the export stages for R2.
 *
 * The cache directory is keyed by encoded size and quality: changing either
 * produces a different directory instead of silently serving stale artwork.
 * (The source artwork itself is immutable; only the policy changes.)
 */

const inflight = new Map()

function isFile(file) {
  return fs.lstat(file).then(stat => stat.isFile(), error => {
    if (error.code === 'ENOENT') return false
    throw error
  })
}

export function cardArtThumbCacheRoot(root) {
  return path.join(root, '.analysis', 'card-art-thumbnails')
}

export function cardArtThumbCachePath(root, thumbKey) {
  const spec = cardArtThumbSpec(thumbKey)
  if (!spec) throw new Error(`Not a card-art thumbnail key: ${thumbKey}`)
  const relative = thumbKey.slice(CARD_ART_THUMB_PREFIX.length)
  return path.join(cardArtThumbCacheRoot(root), `${spec.width}x${spec.height}-q${CARD_ART_THUMB_QUALITY}`, ...relative.split('/'))
}

/**
 * Encodes `thumbKey` from `source` unless the cached file already exists.
 * Concurrent callers for one key share a single encode.
 */
export async function ensureCardArtThumb({ root, source, thumbKey }) {
  const target = cardArtThumbCachePath(root, thumbKey)
  const running = inflight.get(target)
  if (running) return running
  const job = (async () => {
    if (await isFile(target)) return target
    const spec = cardArtThumbSpec(thumbKey)
    await fs.mkdir(path.dirname(target), { recursive: true })
    // method=4 rather than the lossless pass's method=6: for lossy WebP the
    // exhaustive alpha search at method=6 costs ~1.8 s per portrait here, while
    // method=4 produces the same visual result ~4% larger in ~0.1 s.
    await encodeLosslessWebp({ source, target, lossy: true, width: spec.width, quality: CARD_ART_THUMB_QUALITY, method: 4 })
    return target
  })()
  inflight.set(target, job)
  try {
    return await job
  } finally {
    inflight.delete(target)
  }
}
