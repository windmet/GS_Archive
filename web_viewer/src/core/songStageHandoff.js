const STAGE_POSITIONS = [1, 2, 3, 4, 5]

function clampGain(value) {
  return Math.max(0, Math.min(1, Number(value) || 0))
}

function positionMap(song) {
  if (!Array.isArray(song?.stagePositionMap) || song.stagePositionMap.length !== 5) return null
  const entries = song.stagePositionMap.map(entry => ({
    performerSlot: Number(entry.performerSlot),
    stagePosition: Number(entry.stagePosition),
  }))
  if (entries.some(entry => !STAGE_POSITIONS.includes(entry.performerSlot) || !STAGE_POSITIONS.includes(entry.stagePosition))) return null
  if (new Set(entries.map(entry => entry.performerSlot)).size !== 5 || new Set(entries.map(entry => entry.stagePosition)).size !== 5) return null
  return entries
}

export function createSongStageHandoff({ songCode, arrangement, stageLineup, audioExperiment, vocalGain, backingGain, sourceTimeSeconds }) {
  const map = positionMap(arrangement)
  if (!songCode || arrangement?.songCode !== songCode || !arrangement?.id || !map ||
      !Array.isArray(stageLineup) || stageLineup.length !== 5 ||
      audioExperiment?.song_code !== songCode || audioExperiment?.stage_vocal?.slot_count !== 5) return null
  const idols = STAGE_POSITIONS.map(position => stageLineup[position - 1] || '')
  if (!idols.some(Boolean)) return null
  if (idols.some(idolCode => idolCode && !audioExperiment.solo_tracks?.[idolCode]?.vocal?.url)) return null
  return {
    songCode,
    choreographyId: arrangement.id,
    vocalMode: 'switch-singer',
    resumePolicy: 'restart-at-zero',
    sourceTimeSeconds: Math.max(0, Number(sourceTimeSeconds) || 0),
    vocalGain: clampGain(vocalGain),
    backingGain: clampGain(backingGain),
    positions: map.map(entry => ({
      ...entry,
      idolCode: idols[entry.stagePosition - 1],
    })),
  }
}

export function resolveSongStageHandoff(handoff, song, characters) {
  const map = positionMap(song)
  if (!map || !Array.isArray(song?.positions) || song.positions.length !== 5 || !handoff ||
      handoff.songCode !== song.songCode || handoff.choreographyId !== song.id ||
      handoff.vocalMode !== 'switch-singer' || handoff.resumePolicy !== 'restart-at-zero' ||
      !Array.isArray(handoff.positions) || handoff.positions.length !== 5) return null
  const expected = new Map(map.map(entry => [entry.performerSlot, entry.stagePosition]))
  const byPosition = Array(5).fill('')
  for (const entry of handoff.positions) {
    if (expected.get(entry.performerSlot) !== entry.stagePosition ||
        !STAGE_POSITIONS.includes(entry.stagePosition)) return null
    if (entry.idolCode && !characters.some(character => character.id === entry.idolCode)) return null
    byPosition[entry.stagePosition - 1] = entry.idolCode || ''
  }
  if (new Set(handoff.positions.map(entry => entry.stagePosition)).size !== 5) return null
  return {
    stageLineup: byPosition,
    vocalGain: clampGain(handoff.vocalGain),
    backingGain: clampGain(handoff.backingGain),
    sourceTimeSeconds: Math.max(0, Number(handoff.sourceTimeSeconds) || 0),
  }
}
