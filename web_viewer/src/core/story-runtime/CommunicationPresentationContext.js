/**
 * CommunicationPresentationContext — pure presentation projection for
 * mobile story scenes (talk / call / choice). It only decides "which
 * scene to show"; it holds no story state and never advances steps.
 *
 * Resolution order (handoff §5.3):
 *   1. current step is explicitly talk / talk_stamp / call, or its
 *      state carries talk_mode / phone_mode;
 *   2. current step is a choice: inherit from the nearest communication
 *      step on the real history path;
 *   3. stop inheritance at adv / title / synopsis / text_time boundaries;
 *   4. direct deep-link into a choice: fall back to linear predecessors
 *      when the history path is empty;
 *   5. future explicit presentation_context fields win over inference.
 */
import { getUnitCodeByCharaId, normalizeUnitCode } from '../../utils/UnitNameMap.js'

const COMMUNICATION_TYPES = new Set(['talk', 'talk_stamp', 'call'])
const MODE_BOUNDARIES = new Set(['adv', 'title', 'synopsis', 'text_time'])

function modeFromStep(step) {
  if (!step) return null
  if (step.type === 'call') return 'call'
  if (step.type === 'talk' || step.type === 'talk_stamp') return 'talk'
  const st = step.state || {}
  if (st.phone_mode === true) return 'call'
  if (st.talk_mode === true) return 'talk'
  return null
}

function charaIdFromStep(step) {
  return step?.chara_id || step?.stamp?.chara_id || ''
}

function unitCodeFromScenario(scenarioId) {
  const m = String(scenarioId || '').match(/8_2_x_(\d{3}[a-z]{3})/)
  return m ? normalizeUnitCode(m[1]) : null
}

/**
 * @param {object} input
 * @param {object} input.step current step
 * @param {number} input.stepIndex current step index
 * @param {Array} input.historyStack real history path indices
 * @param {Array} input.steps compiled steps (linear predecessor fallback)
 * @param {string} input.scenarioId compiled scenario id
 * @returns {{mode: 'talk'|'call'|null, phase: 'dialogue'|'choice'|'reply', unitCode: string|null, primaryCharaId: string, isGroup: boolean}}
 */
export function resolveCommunicationContext({ step, stepIndex, historyStack, steps, scenarioId }) {
  const isGroup = String(scenarioId || '').startsWith('8_2_')
  const explicitMode = modeFromStep(step)
  const phase = step?.type === 'choice' ? 'choice' : 'dialogue'

  // Nearest communication step on the real history path (choice inherits),
  // plus the nearest step that actually carries a chara_id (a choice step
  // itself usually does not).
  const path = Array.isArray(historyStack) ? [...historyStack] : []
  let inheritedStep = null
  let charaStep = null
  if (stepIndex != null && !path.includes(stepIndex)) path.push(stepIndex)
  const realPath = [...path].reverse()
  for (const idx of realPath) {
    const s = (steps && steps[idx]) || null
    if (!s) continue
    if (!inheritedStep && modeFromStep(s)) inheritedStep = s
    if (!charaStep && charaIdFromStep(s)) charaStep = s
    if (MODE_BOUNDARIES.has(s.type)) break
  }

  // Linear predecessor fallback for direct deep-links (no history yet):
  // mode inheritance and chara/unit resolution each scan backwards.
  let linearStep = null
  if (steps && stepIndex != null) {
    for (let i = stepIndex - 1; i >= 0; i--) {
      const s = steps[i]
      if (!linearStep && modeFromStep(s)) linearStep = s
      if (!charaStep && charaIdFromStep(s)) charaStep = s
      if (linearStep && charaStep) break
      if (MODE_BOUNDARIES.has(s.type) && !charaStep) break
    }
  }

  const source = inheritedStep || linearStep || step
  const mode = explicitMode || (source ? modeFromStep(source) : null)

  let unitCode = unitCodeFromScenario(scenarioId)
  const primaryCharaId = charaStep ? charaIdFromStep(charaStep) : (source ? charaIdFromStep(source) : '')
  if (!unitCode && primaryCharaId) {
    unitCode = getUnitCodeByCharaId(primaryCharaId) || null
  }

  return { mode, phase, unitCode, primaryCharaId, isGroup }
}
