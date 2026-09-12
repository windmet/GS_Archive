/** Source idol_priority is depth: larger values sit behind smaller values.
 * Pixi child order is back-to-front. Preserve source order for equal depths. */
export function storySpineOrder(states) {
  const depth = state => Number.isFinite(Number(state.idol_priority)) ? Number(state.idol_priority) : 0
  return states.slice().sort((a, b) => depth(b) - depth(a)).map(state => state.id)
}
