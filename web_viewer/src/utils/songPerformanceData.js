const CHOREOGRAPHY_INDEX_URL = '/assets/live-chibi/choreography/index.json'

let choreographyPromise = null

export function fetchSongPerformanceChoreography() {
  if (!choreographyPromise) {
    choreographyPromise = fetch(CHOREOGRAPHY_INDEX_URL).then(response => {
      if (!response.ok) throw new Error(`歌曲演唱切换表加载失败 (${response.status})`)
      return response.json()
    }).catch(error => {
      choreographyPromise = null
      throw error
    })
  }
  return choreographyPromise
}
