// Pure Home selection from a route: requested cue → that cue's costume → first costume, with the
// first cue as the cue default. A missing or unknown idol selects nothing.
export function resolveHomeSelection(idol, { homeCue, homeCostume } = {}) {
  if (!idol) return { id: '', cue: '', costume: '' }
  const cue = idol.cues?.find(item => item.cue === homeCue)?.cue || idol.cues?.[0]?.cue || ''
  const cueModel = idol.cues?.find(item => item.cue === cue)?.modelId
  const costume = idol.costumes?.find(item => item.modelId === homeCostume)?.modelId ||
    idol.costumes?.find(item => item.modelId === cueModel)?.modelId || idol.costumes?.[0]?.modelId || ''
  return { id: idol.id, cue, costume }
}
