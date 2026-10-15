import { extraStorySeriesDefinition } from './extraStoryTaxonomy.js'

// RAW scenario_5_03_000_22_a ends with `live 2`: the game cuts from the story into the April Fools Live.
// It is the only script with that command. The compiled story keeps no step for it, so the Player offers
// the song when part a (step 27, in both the episode file and the combined story) completes.
const PART_A = Object.freeze({ afterStepId: 27, seriesId: '602' })
const LIVE_LINKS = Object.freeze({ '5_03_000_22_a': PART_A, '5_03_000_22': PART_A })

export function storyLiveLink(scenarioId) {
  const link = LIVE_LINKS[String(scenarioId || '')]
  const song = link && extraStorySeriesDefinition(link.seriesId).song
  return song ? { afterStepId: link.afterStepId, code: song.code, title: song.title } : null
}
