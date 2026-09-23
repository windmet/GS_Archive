import { resolveCommunicationContext } from '../../src/core/story-runtime/CommunicationPresentationContext.js'

export function resolveStoryPresentation(input) {
  const communication = resolveCommunicationContext(input)
  const surface = communication.mode === 'talk' ? 'chat' : communication.mode || 'stage'
  if (surface !== 'stage') return { ...communication, surface, needsStage: false, needsBackdrop: true }
  // Empty authored transition/setup steps around a standalone conversation
  // still advance normally, but do not need a WebGL renderer of their own.
  const steps = input.steps || []
  const narrative = new Set(['adv', 'title', 'synopsis', 'text_time', 'call', 'talk', 'talk_stamp', 'choice'])
  const snapshot = input.step?.entry_snapshot || input.step?.state
  const neighbours = [steps.slice(0, input.stepIndex).reverse().find(s => narrative.has(s.type)),
    steps.slice(input.stepIndex + 1).find(s => narrative.has(s.type))].filter(Boolean)
  const emptyCommunicationBridge = !narrative.has(input.step?.type) && !snapshot?.spines?.length
    && neighbours.length > 0 && neighbours.every(s => ['call', 'talk', 'talk_stamp'].includes(s.type))
  return { ...communication, surface, needsStage: surface === 'stage' && !emptyCommunicationBridge,
    needsBackdrop: surface !== 'stage' }

}
