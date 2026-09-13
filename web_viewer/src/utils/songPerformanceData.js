const MANIFEST_URL = '/data/song_timelines/manifest.json'

let manifestPromise = null
const detailPromises = new Map()

async function readJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`歌曲时间轴加载失败 (${response.status})`)
  return response.json()
}

export function fetchSongTimelineManifest() {
  if (!manifestPromise) {
    manifestPromise = readJson(MANIFEST_URL).then(manifest => {
      if (manifest?.schemaVersion !== 1 || manifest.timeUnit !== 'ms' || !manifest.songs) {
        throw new Error('歌曲时间轴索引格式不受支持')
      }
      return manifest
    }).catch(error => {
      manifestPromise = null
      throw error
    })
  }
  return manifestPromise
}

export async function fetchSongTimeline(choreographyId) {
  const manifest = await fetchSongTimelineManifest()
  const reference = Object.values(manifest.songs).flat().find(entry => entry.id === choreographyId)
  if (!reference) return null
  if (!detailPromises.has(choreographyId)) {
    const pending = readJson(reference.url).then(detail => {
      if (detail?.schemaVersion !== 1 || detail.id !== choreographyId ||
          detail.source?.entrySha256 !== reference.entrySha256 || detail.timeUnit !== 'ms') {
        throw new Error(`歌曲时间轴与索引不一致：${choreographyId}`)
      }
      return detail
    }).catch(error => {
      detailPromises.delete(choreographyId)
      throw error
    })
    detailPromises.set(choreographyId, pending)
  }
  return detailPromises.get(choreographyId)
}

export async function fetchSongPerformanceArrangements(songCode) {
  const manifest = await fetchSongTimelineManifest()
  const references = (manifest.songs[songCode] || []).filter(entry => !entry.variant && entry.singerCount > 0)
  return Promise.all(references.map(entry => fetchSongTimeline(entry.id)))
}

export async function fetchSongBaseTimeline(songCode) {
  const manifest = await fetchSongTimelineManifest()
  const reference = (manifest.songs[songCode] || []).find(entry => !entry.variant)
  return reference ? fetchSongTimeline(reference.id) : null
}
