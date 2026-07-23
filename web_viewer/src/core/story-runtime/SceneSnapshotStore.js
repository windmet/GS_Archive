function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function toChoiceObject(selectedChoices) {
  if (selectedChoices instanceof Map) return Object.fromEntries(selectedChoices)
  return clone(selectedChoices || {})
}

function dialogueText(dialogue) {
  return dialogue?.source_text || dialogue?.text_jp || dialogue?.text || dialogue?.text_cn || ''
}

/**
 * In-memory history of stable story states. Nodes contain serializable data
 * only; renderer objects, timers and audio sources never enter this store.
 */
export class SceneSnapshotStore {
  constructor({ now = () => globalThis.performance?.now?.() ?? Date.now() } = {}) {
    this._now = now
    this._scenarioId = null
    this._sourceHash = null
    this._sourceRange = null
    this._visitSequence = 0
    this._nodes = []
  }

  beginScenario({ scenarioId, sourceHash = null, sourceRange = null } = {}) {
    if (!scenarioId) throw new TypeError('scenarioId is required')
    this._scenarioId = String(scenarioId)
    this._sourceHash = sourceHash == null ? null : String(sourceHash)
    this._sourceRange = clone(sourceRange)
    this._visitSequence = 0
    this._nodes = []
  }

  record({ stepIndex, step, snapshot, entrySnapshot = null, selectedChoices = {}, captured = false } = {}) {
    if (!this._scenarioId) throw new Error('beginScenario must be called before record')
    if (!Number.isInteger(stepIndex) || stepIndex < 0) throw new RangeError('stepIndex must be a non-negative integer')
    if (!step || !Number.isInteger(step.step_id)) throw new TypeError('step with integer step_id is required')
    if (!snapshot || typeof snapshot !== 'object') throw new TypeError('serializable snapshot is required')

    const visit = ++this._visitSequence
    const node = Object.freeze({
      node_id: `session:${this._scenarioId}:step-${step.step_id}:visit-${visit}`,
      scenario_id: this._scenarioId,
      source_hash: this._sourceHash,
      episode_index: step.episode_index ?? null,
      step_index: stepIndex,
      step_id: step.step_id,
      step_type: step.type || 'unknown',
      dialogue: clone(step.dialogue || null),
      selected_choices: toChoiceObject(selectedChoices),
      snapshot: clone(snapshot),
      snapshot_source: captured ? 'captured-runtime' : 'compiled-settled',
      navigation_snapshot: clone(entrySnapshot || snapshot),
      navigation_snapshot_source: entrySnapshot ? 'compiled-entry' : (captured ? 'captured-runtime' : 'compiled-settled'),
      read: true,
      voice: step.dialogue?.voice ? { cue: step.dialogue.voice } : null,
      created_at: this._now(),
      source_range: clone(this._sourceRange),
    })
    this._nodes.push(node)
    return clone(node)
  }

  list({ readableOnly = false } = {}) {
    const nodes = readableOnly
      ? this._nodes.filter(node => dialogueText(node.dialogue) || Object.keys(node.selected_choices).length > 0)
      : this._nodes
    return clone(nodes)
  }

  get(nodeId) {
    const node = this._nodes.find(candidate => candidate.node_id === nodeId)
    return node ? clone(node) : null
  }

  popPrevious() {
    const node = this._nodes.pop()
    return node ? clone(node) : null
  }

  truncateAfter(nodeId) {
    const index = this._nodes.findIndex(node => node.node_id === nodeId)
    if (index < 0) return false
    this._nodes = this._nodes.slice(0, index + 1)
    return true
  }

  clear() {
    this._visitSequence = 0
    this._nodes = []
  }

  get size() {
    return this._nodes.length
  }
}

export function isReadableHistoryStep(step) {
  if (!step) return false
  if (step.type === 'choice') return true
  return Boolean(dialogueText(step.dialogue))
}
