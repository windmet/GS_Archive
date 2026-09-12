export function episodeStartIndex(episode) {
  const legacy = Number(episode?.start_step_index)
  if (Number.isFinite(legacy)) return legacy
  const strict = Number(episode?.start_step_id)
  return Number.isFinite(strict) ? Math.max(0, strict - 1) : null
}

export function episodeEndIndex(episode) {
  const legacy = Number(episode?.end_step_index)
  if (Number.isFinite(legacy)) return legacy
  const strict = Number(episode?.end_step_id)
  return Number.isFinite(strict) ? Math.max(0, strict - 1) : null
}

/** Public entry coordinates are one-based array positions, never step IDs. */
export function resolveStoryPlaybackWindow(scenario, { startStep, initialStep, endStep } = {}) {
  const steps = scenario?.steps || []
  const found = steps.findIndex(step => step?.type !== 'synopsis')
  const firstPlayableIndex = found < 0 ? 0 : found
  const lastIndex = Math.max(0, steps.length - 1)
  const startEpisode = !Number.isFinite(startStep) ? null : (scenario?.episodes || []).find(episode => {
    const first = episodeStartIndex(episode), last = episodeEndIndex(episode)
    const index = Math.max(0, startStep - 1)
    return first != null && last != null && index >= first && index <= last
  }) || null
  const startIndex = !Number.isFinite(startStep) ? Math.min(firstPlayableIndex, lastIndex)
    : Math.max(firstPlayableIndex, Math.min(lastIndex, startStep - 1))
  const requestedEnd = Number.isFinite(endStep) ? endStep - 1 : episodeEndIndex(startEpisode)
  const endIndex = !Number.isFinite(requestedEnd) ? lastIndex : Math.max(startIndex, Math.min(lastIndex, requestedEnd))
  const requested = Number.isFinite(initialStep) ? initialStep : startStep
  const entryIndex = !Number.isFinite(requested) ? startIndex : Math.max(startIndex, Math.min(endIndex, requested - 1))
  return { startIndex, endIndex, entryIndex, firstPlayableIndex }
}
