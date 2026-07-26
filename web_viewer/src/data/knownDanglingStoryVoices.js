const RAW_AUTHORED_DANGLING_STORY_VOICES = [
  ['1_1_007sai_01_1_1_007_01', 'c1004'],
  ['1_1_007sai_01_1_1_007_01', 'b1008'],
  ['1_5_037jir_1_5_037_03', '1_5_037_03_3009'],
  ['013kys_302_2_3_002_01_09_a', '2_3_013_02_09_a1000'],
  ['013kys_302_2_3_002_01_09_a', '2_3_013_02_09_a1001'],
  ['013kys_302_2_3_002_01_09_a', '2_3_013_02_09_a1003'],
  ['013kys_302_2_3_002_01_09_a', '2_3_013_02_09_a1004'],
  ['013kys_302_2_3_002_01_09_a', '2_3_013_02_09_a1005'],
  ['013kys_302_2_3_002_01_09_a', '2_3_013_02_09_a1006'],
  ['013kys_302_2_3_002_01_09_a', '2_3_013_02_09_a1007'],
  ['013kys_302_2_3_002_01_09_a', '2_3_013_02_09_a1100'],
  ['013kys_302_2_3_002_01_09_a', '2_3_013_02_09_a1101'],
]

const DANGLING_KEYS = new Set(
  RAW_AUTHORED_DANGLING_STORY_VOICES.map(([scenarioId, voice]) => `${scenarioId}\0${voice}`),
)

/**
 * These references exist in the authoritative RAW scenario JSON, while the
 * matching RAW ACB cue and lipsync TextAsset are both absent. Keep this list
 * exact: it prevents guaranteed 404s without inventing replacement audio.
 */
export function isKnownDanglingStoryVoice(scenarioId, voice) {
  const normalizedVoice = String(voice || '').replace(/\.m4a$/i, '')
  return DANGLING_KEYS.has(`${scenarioId || ''}\0${normalizedVoice}`)
}

export const knownDanglingStoryVoiceCount = DANGLING_KEYS.size
