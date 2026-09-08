import { computed, ref } from 'vue'

const queueEntry = ({ file, startStep, endStep, id, label }) => ({ file, startStep, endStep, id, label })
const boundary = value => Number(value) > 0 ? Number(value) : null

/** Owns queue membership and cursor. Product pages provide ordered episodes;
 * navigation owns loading, return routes, and superseding asynchronous work.
 */
export function useEpisodeQueue() {
  const entries = ref([]), cursor = ref(-1)
  const current = computed(() => entries.value[cursor.value] || null)
  const hasNext = computed(() => cursor.value >= 0 && cursor.value < entries.value.length - 1)
  function clear() { entries.value = []; cursor.value = -1 }
  function start(episodes, index) {
    if (!Number.isInteger(index) || !episodes[index]?.file) { clear(); return null }
    entries.value = episodes.map(queueEntry)
    cursor.value = index
    return current.value
  }
  function restore(episodes, file, { startStep, endStep } = {}) {
    const available = episodes.filter(episode => episode.exists !== false && episode.file)
    const index = available.findIndex(episode => episode.file === file &&
      (boundary(startStep) === null || boundary(episode.startStep) === boundary(startStep)) &&
      (boundary(endStep) === null || boundary(episode.endStep) === boundary(endStep)))
    if (index < 0) { clear(); return false }
    start(available, index)
    return true
  }
  function next() {
    if (!hasNext.value) return null
    cursor.value += 1
    return current.value
  }
  return { current, hasNext, start, restore, next, clear }
}
