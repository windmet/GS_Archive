import { resolveCommunicationContext } from '../../src/core/story-runtime/CommunicationPresentationContext.js'
import { communicationUiAssets } from './CommunicationUiAssets.js'

/**
 * The communication assets a scenario loads, one entry per step that renders a
 * phone scene.
 *
 * `resolveCommunicationContext` is the runtime's rule for which scene a step
 * shows — including what a choice step inside a conversation inherits from the
 * steps before it — so it is the only rule applied here. The walk uses the
 * linear order, which is the deterministic path a direct entry into the
 * scenario takes; a different history can reach a different character, and a
 * requirement that only one route needs must still be discoverable.
 *
 * Requirements are recorded per step rather than per scene: a call keeps its
 * surface while the caller changes, and a chat keeps every message it has
 * shown, so what has to exist is the union across the steps.
 */
export function communicationRequirements(scenario) {
  const steps = scenario?.steps
  if (!Array.isArray(steps)) return []
  const scenarioId = scenario.scenario_id
  return steps.flatMap((step, stepIndex) => {
    const context = resolveCommunicationContext({ step, stepIndex, historyStack: [], steps, scenarioId })
    if (!context.mode) return []
    const text = step?.dialogue?.source_text
    return [{
      stepIndex,
      mode: context.mode,
      charaId: context.primaryCharaId || '',
      unitCode: context.unitCode || null,
      requirements: communicationUiAssets({
        mode: context.mode,
        unitCode: context.unitCode || null,
        charaId: context.primaryCharaId || '',
        texts: typeof text === 'string' && text ? [text] : [],
      }),
    }]
  })
}
