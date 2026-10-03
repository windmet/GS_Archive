const validPosition = value => Number.isInteger(value) && value >= 1 && value <= 5
const validCostumeId = value => typeof value === 'string' && /^\d{3}_\d{2}$/.test(value)
const hasLabel = costume => typeof costume?.label === 'string' && Boolean(costume.label.trim())

// Catalog member order identifies a roster, not an official stage placement.
// This UI rule assigns that order to ascending script performer slots.
export function buildOriginalStageLineup(song, performerCodes, characters, idolDirectory) {
  if (song?.vocalSetting?.mode === 'unit') return buildUnitStageLineup(song, characters, idolDirectory)
  if (!song || song.songCode === 'drv999' || !Array.isArray(performerCodes) || !performerCodes.length ||
      !Array.isArray(characters) || !Array.isArray(song.positions) || !Array.isArray(song.stagePositionMap)) return null
  const positions = song.positions
  const map = song.stagePositionMap
  if (performerCodes.length !== positions.length || map.length !== positions.length ||
      positions.some(position => !validPosition(position)) || new Set(positions).size !== positions.length ||
      performerCodes.some(code => typeof code !== 'string' || !code.trim() ||
        characters.filter(character => character?.id === code).length !== 1) ||
      new Set(performerCodes).size !== performerCodes.length) return null
  if (map.some(entry => !validPosition(entry?.performerSlot) || !validPosition(entry?.stagePosition)) ||
      new Set(map.map(entry => entry.performerSlot)).size !== map.length ||
      new Set(map.map(entry => entry.stagePosition)).size !== map.length ||
      map.some(entry => !positions.includes(entry.stagePosition))) return null
  const result = Array(5).fill('')
  const ordered = [...map].sort((left, right) => left.performerSlot - right.performerSlot)
  ordered.forEach((entry, index) => { result[entry.stagePosition - 1] = performerCodes[index] })
  return result
}

function buildUnitStageLineup(song, characters, idolDirectory) {
  const unitCode = song.vocalSetting.unitCode
  if (song.songCode === 'drv999' || typeof unitCode !== 'string' || !unitCode.trim() ||
      !Array.isArray(characters) || !Array.isArray(idolDirectory) ||
      !Array.isArray(song.positions) || !song.positions.length ||
      !Array.isArray(song.stagePositionMap) || song.stagePositionMap.length !== 5 ||
      !Array.isArray(song.onStagePerformerSlots) || !song.onStagePerformerSlots.length) return null
  const positions = song.positions
  const map = song.stagePositionMap
  const activeSlots = song.onStagePerformerSlots
  if (positions.some(position => !validPosition(position)) || new Set(positions).size !== positions.length ||
      activeSlots.some(slot => !validPosition(slot)) || new Set(activeSlots).size !== activeSlots.length ||
      map.some(entry => !validPosition(entry?.performerSlot) || !validPosition(entry?.stagePosition)) ||
      new Set(map.map(entry => entry.performerSlot)).size !== map.length ||
      new Set(map.map(entry => entry.stagePosition)).size !== map.length) return null
  const members = idolDirectory.filter(idol => idol?.unitCode === unitCode).map(idol => idol.id)
  if (!members.length || members.length !== positions.length || activeSlots.length !== members.length ||
      new Set(members).size !== members.length ||
      members.some(id => typeof id !== 'string' || !id.trim() ||
        idolDirectory.filter(idol => idol?.id === id).length !== 1 ||
        characters.filter(character => character?.id === id).length !== 1)) return null
  const activeMap = map.filter(entry => activeSlots.includes(entry.performerSlot))
    .sort((left, right) => left.performerSlot - right.performerSlot)
  if (activeMap.length !== positions.length || activeMap.some(entry => !positions.includes(entry.stagePosition))) return null
  const result = Array(5).fill('')
  const orderedMembers = [...members].sort()
  activeMap.forEach((entry, index) => { result[entry.stagePosition - 1] = orderedMembers[index] })
  return result
}

// Viewer slots are { position, characterId }; inactive slots do not participate.
// Match the original source name; a shared design can have different local IDs.
// Preserve those IDs so applying a uniform resolves each idol's actual resource.
export function commonStageCostumes(lineup, characters, activePositions) {
  if (!Array.isArray(lineup) || !Array.isArray(characters) || !Array.isArray(activePositions) ||
      !activePositions.length || activePositions.some(position => !validPosition(position)) ||
      new Set(activePositions).size !== activePositions.length) return []
  const activeCharacters = []
  for (const position of activePositions) {
    const slots = lineup.filter(slot => slot?.position === position)
    if (slots.length !== 1 || typeof slots[0].characterId !== 'string' || !slots[0].characterId) return []
    const matches = characters.filter(character => character?.id === slots[0].characterId)
    if (matches.length !== 1 || !Array.isArray(matches[0].costumes)) return []
    activeCharacters.push(matches[0])
  }
  const result = []
  for (const costume of activeCharacters[0].costumes) {
    const sourceName = sourceCostumeName(costume)
    if (!validCostumeId(costume?.id) || !sourceName) continue
    const assignments = []
    for (const character of activeCharacters) {
      const matches = character.costumes.filter(entry => sourceCostumeName(entry) === sourceName)
      if (matches.length !== 1 || !validCostumeId(matches[0]?.id) ||
          character.costumes.filter(entry => entry?.id === matches[0].id).length !== 1) break
      assignments.push([character.id, matches[0].id])
    }
    if (assignments.length === activeCharacters.length) {
      result.push({ ...costume, costumeIdsByIdol: Object.fromEntries(assignments) })
    }
  }
  return result
}

// Sync the chosen source design wherever an active idol owns one unique model.
// Missing target models are reported, rather than substituted with a shared ID
// or a translated display name. Planning never changes the existing lineup.
export function planStageCostumeSync(lineup, characters, activePositions, referenceCharacterId, referenceCostumeId) {
  if (!Array.isArray(lineup) || !Array.isArray(characters) || !Array.isArray(activePositions) ||
      !activePositions.length || activePositions.some(position => !validPosition(position)) ||
      new Set(activePositions).size !== activePositions.length ||
      typeof referenceCharacterId !== 'string' || !referenceCharacterId.trim() || !validCostumeId(referenceCostumeId)) return null
  const slots = []
  for (const position of [...activePositions].sort((left, right) => left - right)) {
    const matches = lineup.filter(slot => slot?.position === position)
    if (matches.length !== 1 || typeof matches[0].characterId !== 'string' || !matches[0].characterId.trim()) return null
    slots.push(matches[0])
  }
  if (!slots.some(slot => slot.characterId === referenceCharacterId)) return null
  const references = characters.filter(character => character?.id === referenceCharacterId)
  if (references.length !== 1 || !Array.isArray(references[0].costumes)) return null
  const referenceCostumes = references[0].costumes.filter(costume => costume?.id === referenceCostumeId)
  if (referenceCostumes.length !== 1) return null
  const sourceName = sourceCostumeName(referenceCostumes[0])
  if (!sourceName || !uniqueSourceCostume(references[0], sourceName)) return null
  const matched = [], unmatched = []
  for (const slot of slots) {
    const people = characters.filter(character => character?.id === slot.characterId)
    const costume = people.length === 1 ? uniqueSourceCostume(people[0], sourceName) : null
    if (costume) matched.push({ position: slot.position, idolCode: slot.characterId, costumeId: costume.id })
    else unmatched.push({ position: slot.position, idolCode: slot.characterId })
  }
  return { sourceName, matched, unmatched }
}

// These are the two named all-idol designs. Verify every formal directory
// member independently; a one-person/one-unit intersection is not global proof.
export function universalStageCostumes(characters, idolDirectory) {
  if (!Array.isArray(characters) || !Array.isArray(idolDirectory) || !idolDirectory.length ||
      idolDirectory.some(idol => typeof idol?.id !== 'string' || !idol.id.trim()) ||
      new Set(idolDirectory.map(idol => idol.id)).size !== idolDirectory.length) return []
  const people = []
  for (const id of idolDirectory.map(idol => idol.id).sort()) {
    const matches = characters.filter(character => character?.id === id)
    if (matches.length !== 1 || !Array.isArray(matches[0].costumes)) return []
    people.push(matches[0])
  }
  const result = []
  for (const sourceName of ['グローイングブライティ', 'ファーストグロース']) {
    const costumes = people.map(character => uniqueSourceCostume(character, sourceName))
    if (costumes.every(Boolean)) {
      result.push({ ...costumes[0], costumeIdsByIdol: Object.fromEntries(people.map((character, index) => [character.id, costumes[index].id])) })
    }
  }
  return result
}

function uniqueSourceCostume(character, sourceName) {
  if (!Array.isArray(character?.costumes)) return null
  const matches = character.costumes.filter(costume => sourceCostumeName(costume) === sourceName)
  if (matches.length !== 1 || !validCostumeId(matches[0]?.id) ||
      character.costumes.filter(costume => costume?.id === matches[0].id).length !== 1) return null
  return matches[0]
}

function sourceCostumeName(costume) {
  if (!hasLabel(costume)) return ''
  const suffix = typeof costume.id === 'string' && costume.id ? ` · ${costume.id}` : ''
  const label = suffix && costume.label.endsWith(suffix) ? costume.label.slice(0, -suffix.length) : costume.label
  return label.trim() ? label : ''
}

export function stageCostumeLabel(costume) {
  return sourceCostumeName(costume) || '衣装待确认'
}
