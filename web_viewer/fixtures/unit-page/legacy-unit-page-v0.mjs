// Frozen App unit projections from eff79c7, before F16 extraction.
import { buildUnitCardSummary } from '../../src/data/archiveSelectors.js'
export function legacyUnitPage(id, data) {
  const computed = fn => ({ get value() { return fn() } })
  const idolUnitData = { value: data.dictionary }, archiveManifestData = { value: data.manifest },
    cardMap = { value: data.cardMap }, storyCatalog = { value: data.stories },
    songCatalogData = { value: data.songs }, currentArchiveUnitCode = { value: id }
const unitCatalogEntries = computed(() => (idolUnitData.value?.units || []).map(unit => {
  const unitId = String(unit.unit_id)
  const members = Object.entries(archiveManifestData.value?.unit_membership_by_idol || {})
    .filter(([, evidence]) => String(evidence.unit_id) === unitId)
    .map(([idolCode]) => ({ idol_code: idolCode, ...idolUnitData.value?.by_idol_code?.[idolCode] }))
    .sort((a, b) => Number(a.idol_id || 0) - Number(b.idol_id || 0))
  const cardStats = buildUnitCardSummary(cardMap.value, members.map(member => member.idol_code))
  const eventRelations = archiveManifestData.value?.unit_event_relations_by_unit?.[unitId] || {
    team_events: [],
    attribute_event_appearances: [],
    mixed_unit_appearances: [],
  }
  return {
    unit,
    members,
    storyCount: storyCatalog.value.filter(entry => entry.domain === 'unit_story' && entry.unitId === unitId).length,
    cardStats,
    eventRelations,
  }
}))

const currentArchiveUnit = computed(() => (idolUnitData.value?.units || []).find(unit =>
  String(unit.unit_code) === currentArchiveUnitCode.value || String(unit.unit_id) === currentArchiveUnitCode.value,
) || null)

const currentArchiveUnitMembers = computed(() => {
  const id = String(currentArchiveUnit.value?.unit_id || '')
  return unitCatalogEntries.value.find(entry => String(entry.unit.unit_id) === id)?.members || []
})

const currentArchiveUnitEntry = computed(() => {
  const id = String(currentArchiveUnit.value?.unit_id || '')
  return unitCatalogEntries.value.find(entry => String(entry.unit.unit_id) === id) || null
})

const currentArchiveUnitStories = computed(() => {
  const id = String(currentArchiveUnit.value?.unit_id || '')
  return storyCatalog.value
    .filter(entry => entry.domain === 'unit_story' && entry.unitId === id)
    .sort((a, b) => a.resourceId.localeCompare(b.resourceId))
})

const currentArchiveUnitSongs = computed(() => {
  const unitId = Number(currentArchiveUnit.value?.unit_id || 0)
  return Object.values(songCatalogData.value?.songs || {})
    .filter(song => song.performance_mapping?.confirmed_unit?.unit_id === unitId)
    .sort((left, right) => Number(left.song_id || 0) - Number(right.song_id || 0))
})


return { entries: unitCatalogEntries.value, unit: currentArchiveUnit.value, members: currentArchiveUnitMembers.value, entry: currentArchiveUnitEntry.value, stories: currentArchiveUnitStories.value, songs: currentArchiveUnitSongs.value }
}
