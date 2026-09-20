import { communicationRequirements } from '../../../shared/story/CommunicationScenes.js'
import { storyAssetAdapter } from '../../utils/StoryAssetAdapters.js'
import { Preloader } from '../../utils/Preloader.js'

// Warm ordinary images only. Missing artwork uses the communication UI fallback;
// it must not strand a readable conversation behind an invisible actor gate.
export async function warmCommunicationScene({ scenario, stepIndex, historyStack, backdropUrl, signal }) {
  const visible = new Set([...historyStack, stepIndex])
  const urls = new Set(backdropUrl ? [backdropUrl] : [])
  for (const scene of communicationRequirements(scenario, { historyStack, currentStepIndex: stepIndex })) {
    if (!visible.has(scene.stepIndex)) continue
    const stamp = scenario.steps[scene.stepIndex]?.stamp
    for (const asset of [...scene.requirements, ...(stamp?.id ? [{ kind: 'stamp', id: stamp.id }] : [])]) {
      const adapter = storyAssetAdapter(asset)
      if (adapter.operation === 'image' && adapter.url) urls.add(adapter.url)
    }
  }
  const results = await Promise.allSettled([...urls].map(url => Preloader._preloadImage(url, { signal })))
  signal.throwIfAborted()
  const failures = results.filter(result => result.status === 'rejected')
  if (failures.length) console.warn(`[Communication] ${failures.length} images unavailable; using visual fallbacks`)
  return { status: 'ready' }
}
