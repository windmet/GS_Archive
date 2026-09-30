import { computed, ref } from 'vue'

import { presentIdolEpisodeLabel } from '../presentation/idolEpisodeLabel.js'
const queueEntry = ({ file, startStep, endStep, id, label, exists }) => ({ file, startStep, endStep, id, label: presentIdolEpisodeLabel({ sourceName: label }), exists })
const entryKey = entry => JSON.stringify([entry.id, entry.file, entry.startStep ?? null, entry.endStep ?? null])
const boundary = value => Number(value) > 0 ? Number(value) : null

/** Owns queue membership and cursor. Product pages provide ordered episodes;
 * navigation owns loading, return routes, and superseding asynchronous work.
 */
export function useEpisodeQueue() {
  const entries = ref([]), cursor = ref(-1)
  const revision = ref(0)
  const current = computed(() => entries.value[cursor.value] || null)
  const hasAdjacent = computed(() => cursor.value >= 0 && cursor.value < entries.value.length - 1)
  const hasNext = computed(() => hasAdjacent.value && entries.value[cursor.value + 1].exists !== false && Boolean(entries.value[cursor.value + 1].file))
  const snapshot = computed(() => Object.freeze({ revision: revision.value,
    currentKey: current.value ? entryKey(current.value) : '',
    entries: Object.freeze(entries.value.map(entry => Object.freeze({ ...entry, entryKey: entryKey(entry), available: entry.exists !== false && Boolean(entry.file) }))) }))
  function clear() { entries.value = []; cursor.value = -1; revision.value++ }
  function start(episodes, index) {
    if (!Number.isInteger(index) || !episodes[index]?.file) { clear(); return null }
    entries.value = episodes.map(queueEntry)
    if (new Set(entries.value.map(entryKey)).size !== entries.value.length) { clear(); throw Error('Ambiguous episode queue identity') }
    cursor.value = index
    revision.value++
    return current.value
  }
  function restore(episodes, file, { startStep, endStep } = {}) {
    const available = episodes
    const index = available.findIndex(episode => episode.exists !== false && episode.file === file &&
      (boundary(startStep) === null || boundary(episode.startStep) === boundary(startStep)) &&
      (boundary(endStep) === null || boundary(episode.endStep) === boundary(endStep)))
    if (index < 0) { clear(); return false }
    start(available, index)
    return true
  }
  function next() {
    if (!hasNext.value) return null
    cursor.value += 1
    revision.value++
    return current.value
  }
  function peekNext() { return hasAdjacent.value ? entries.value[cursor.value + 1] : null }
  function select(key, expectedRevision) {
    if (expectedRevision !== revision.value) return false
    const index = entries.value.findIndex(entry => entryKey(entry) === key)
    if (index < 0 || entries.value[index].exists === false || !entries.value[index].file) return false
    cursor.value = index; revision.value++; return true
  }
  return { current, hasNext, snapshot, start, restore, next, peekNext, select, clear }
}
