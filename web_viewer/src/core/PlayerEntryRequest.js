import { normalizeArchiveRoute } from './archiveRoute.js'

/** Route identifiers, not archive payloads. A return destination is not an entry dependency.
 * Reader's revision/anchor proof and synthetic card previews keep their own preparation. */
export function isDirectScenarioEntry(route) {
  return route?.view === 'player' && Boolean(route.scenario) && route.returnView !== 'reader'
}

export function playerReturnRoute(route, destination = route?.returnView || 'home') {
  if (!route) return normalizeArchiveRoute({ view: destination })
  const { scenario, voice, startStep, endStep, initialStep, returnView, ...context } = route
  return normalizeArchiveRoute({ ...context, view: destination })
}

/** Scope queue restoration to the selected chapter/section, never all chapters. */
export function selectPlayerQueue(groups, file, range = {}) {
  const same = episode => episode.file === file &&
    (!range.startStep || Number(episode.startStep) === Number(range.startStep)) &&
    (!range.endStep || Number(episode.endStep) === Number(range.endStep))
  const group = (groups || []).find(item => (item.episodes || []).some(same))
  return (group?.episodes || []).filter(episode => episode.exists !== false && episode.file)
}
