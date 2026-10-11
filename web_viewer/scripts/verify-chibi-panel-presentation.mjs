import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { entityKey, stripEvidence } from '../readmodels/lib/common.mjs'
import { buildSongPresentation } from '../src/presentation/SongPresentation.js'
import { buildOriginalStageLineup, commonStageCostumes, planStageCostumeSync, stageCostumeLabel, universalStageCostumes } from '../src/presentation/ChibiPanelPresentation.js'

const json = name => JSON.parse(readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8'))
const characters = json('assets/live-chibi/manifest.json').characters
const choreography = json('assets/live-chibi/choreography/index.json').songs
const catalog = json('data/song_catalog.json').songs
const dictionary = json('data/masterdata/idol_unit_dictionary.json')
const costumeDictionary = json('data/masterdata/costume_dictionary.json')
const costumeTranslations = json('translations/zh-CN/archive-general/costumes.json').entries.costume.name
const manifest = json('data/archive_manifest.json')
const idolDirectory = JSON.parse(readFileSync(new URL('../readmodels/bootstrap.inline.json', import.meta.url), 'utf8')).idols
const songFor = code => choreography.find(song => song.songCode === code && !song.variant)
// Actual songs.detail uses stripEvidence(song) and buildSongPresentation, as
// readmodels/lib/projections.mjs and checkout_adapter.mjs do. No guessed roster.
const publicDetail = code => ({ song: stripEvidence(catalog[code]),
  view: buildSongPresentation(catalog[code], dictionary, { manifest }) })
const membersFor = code => publicDetail(code).view.performers.map(performer => performer.id)
const clone = value => JSON.parse(JSON.stringify(value))
const snapshot = JSON.stringify({ characters, choreography, catalog, idolDirectory })

const examples = [
  ['knwonl', ['038tak', '039mcr', '040ren'], ['', '039mcr', '038tak', '040ren', '']],
  ['brndnf', ['001tom', '002sht', '003hok'], ['', '002sht', '001tom', '003hok', '']],
  ['psblts', ['035mco', '036rui', '037jir'], ['', '036rui', '035mco', '037jir', '']],
  ['flslgt', ['007kei', '009kyj', '022nat', '048mom'], ['048mom', '009kyj', '007kei', '022nat', '']],
  ['cfprde', ['027yuk', '028soi', '029ass', '030mak', '031sak'], ['030mak', '028soi', '027yuk', '029ass', '031sak']],
]
for (const [code, members, expected] of examples) {
  const projected = publicDetail(code)
  assert.deepEqual(projected.song.performance_mapping.performer_idol_codes, members)
  assert.deepEqual(membersFor(code), members)
  assert.deepEqual(buildOriginalStageLineup(songFor(code), membersFor(code), characters), expected,
    `${code}: known roster assigned by UI slot rule; not proof of official stage placement`)
}
for (const code of ['drvalv', 'byndtd', 'grwsml']) {
  assert.equal(publicDetail(code).song.performance_mapping.performer_scope, 'configurable_formation')
  assert.deepEqual(membersFor(code), [])
  assert.equal(buildOriginalStageLineup(songFor(code), membersFor(code), characters), null,
    'free formation cannot acquire a guessed official five-person roster')
}
const solo = choreography.find(song => song.songCode === 'drvalv' && song.variant === 'solo')
assert.equal(buildOriginalStageLineup(solo, ['040ren'], characters), null,
  'real Solo retains a five-slot map and cannot be silently reinterpreted as a complete one-slot roster')
// Explicit synthetic complete single-slot fixture, retaining the real Solo's
// authored slot 1 -> center 3 entry. This is not an edited production script.
const completeSolo = { ...solo, stagePositionMap: solo.stagePositionMap.filter(entry => entry.performerSlot === 1) }
assert.deepEqual(buildOriginalStageLineup(completeSolo, ['040ren'], characters), ['', '', '040ren', '', ''],
  'a complete single-slot map is supported without hardcoding five performers')
assert.equal(buildOriginalStageLineup(songFor('drv999'), ['040ren'], characters), null,
  'special director performance never receives an idol formation')
const three = songFor('knwonl')
const members = membersFor('knwonl')
const shuffledMap = { ...three, stagePositionMap: [...three.stagePositionMap].reverse() }
assert.deepEqual(buildOriginalStageLineup(shuffledMap, members, characters), ['', '039mcr', '038tak', '040ren', ''],
  'script performerSlot order, not input map array order, determines assignment')
const invalid = (song, roster = members, people = characters) =>
  assert.equal(buildOriginalStageLineup(song, roster, people), null)
invalid(three, [])
invalid(three, members.slice(0, 2))
invalid(three, [members[0], members[0], members[2]])
invalid(three, [members[0], 'unknown-idol', members[2]])
invalid(three, [members[0], ' ', members[2]])
invalid(three, [members[0], null, members[2]])
invalid(three, members, [...characters, characters.find(character => character.id === members[0])])
invalid(null)
for (const mutate of [
  song => { song.positions = [] },
  song => { song.positions[0] = song.positions[1] },
  song => { song.positions[0] = 6 },
  song => { song.positions[0] = '2' },
  song => { song.stagePositionMap.pop() },
  song => { song.stagePositionMap[0].stagePosition = 1 },
  song => { song.stagePositionMap[0].stagePosition = 6 },
  song => { song.stagePositionMap[0].stagePosition = song.stagePositionMap[1].stagePosition },
  song => { song.stagePositionMap[0].performerSlot = song.stagePositionMap[1].performerSlot },
  song => { song.stagePositionMap[0].performerSlot = 0 },
  song => { song.stagePositionMap[0] = null },
]) {
  const changed = clone(three); mutate(changed); invalid(changed)
}
// A Unit needs a verified directory and its explicit active performer subset;
// the base song's empty roster alone must not silently acquire a guessed fill.
invalid(choreography.find(song => song.id === 'drvalv_live_effect_01jup'), membersFor('brndnf'))
const unitSongs = choreography.filter(song => song.vocalSetting?.mode === 'unit')
assert.equal(unitSongs.length, 48, 'actual three songs each contain sixteen authored Unit variants')
assert.equal(new Set(unitSongs.map(song => song.vocalSetting.unitCode)).size, 16)
assert.equal(idolDirectory.length, 49)
for (const idol of idolDirectory) {
  assert.equal(dictionary.by_idol_code[idol.id].idol_code, idol.id)
  assert.equal(manifest.unit_membership_by_idol[idol.id].unit_code, idol.unitCode,
    'bootstrap unit membership is the actual formal identity projection')
  assert.equal(String(manifest.unit_membership_by_idol[idol.id].unit_id), idol.unitId)
}
const unitByCode = unitCode => unitSongs.find(song => song.songCode === 'drvalv' && song.vocalSetting.unitCode === unitCode)
const unitJupiter = unitByCode('01jup')
assert.deepEqual(buildOriginalStageLineup(unitJupiter, [], characters, idolDirectory), ['', '002sht', '001tom', '003hok', ''])
// A recorded slot order (table 46 fields 30-34) decides who stands where; a partial or foreign one is ignored.
assert.deepEqual(buildOriginalStageLineup(unitJupiter, ['003hok', '001tom', '002sht'], characters, idolDirectory, { slotOrdered: true }), ['', '001tom', '003hok', '002sht', ''])
assert.deepEqual(buildOriginalStageLineup(unitJupiter, ['003hok', '001tom'], characters, idolDirectory, { slotOrdered: true }), ['', '002sht', '001tom', '003hok', ''])
assert.deepEqual(buildOriginalStageLineup(unitJupiter, ['003hok', '001tom', '002sht'], characters, idolDirectory), ['', '002sht', '001tom', '003hok', ''], 'Unordered codes never reorder a unit song')
assert.deepEqual(buildOriginalStageLineup(unitByCode('03alt'), [], characters, idolDirectory), ['', '008rei', '007kei', '', ''])
assert.deepEqual(buildOriginalStageLineup(unitByCode('08hig'), [], characters, idolDirectory),
  ['023har', '021jun', '020hay', '022nat', '024shk'])
for (const song of unitSongs) {
  const roster = idolDirectory.filter(idol => idol.unitCode === song.vocalSetting.unitCode).map(idol => idol.id).sort()
  const expected = roster.length === 2 ? ['', roster[1], roster[0], '', '']
    : roster.length === 3 ? ['', roster[1], roster[0], roster[2], '']
      : [roster[3], roster[1], roster[0], roster[2], roster[4]]
  assert.ok([2, 3, 5].includes(roster.length))
  assert.deepEqual(song.positions, roster.length === 2 ? [2, 3] : roster.length === 3 ? [2, 3, 4] : [1, 2, 3, 4, 5])
  assert.deepEqual(song.onStagePerformerSlots, roster.map((_, index) => index + 1))
  assert.deepEqual(buildOriginalStageLineup(song, [], characters, idolDirectory), expected,
    `${song.id}: actual Unit roster to authored active slots, never official-placement evidence`)
}
assert.deepEqual(buildOriginalStageLineup({ ...unitJupiter, stagePositionMap: [...unitJupiter.stagePositionMap].reverse(),
  onStagePerformerSlots: [...unitJupiter.onStagePerformerSlots].reverse() }, ['untrusted-base-roster'], characters,
  [...idolDirectory].reverse()), ['', '002sht', '001tom', '003hok', ''],
  'directory order and input map array order do not override canonical members or performerSlot order')
const invalidUnit = (song = unitJupiter, directory = idolDirectory, people = characters) =>
  assert.equal(buildOriginalStageLineup(song, [], people, directory), null)
assert.equal(buildOriginalStageLineup(unitJupiter, [], characters), null)
invalidUnit(unitJupiter, null)
invalidUnit(unitJupiter, [])
invalidUnit(unitJupiter, idolDirectory.filter(idol => idol.id !== '002sht'))
invalidUnit(unitJupiter, [...idolDirectory, idolDirectory.find(idol => idol.id === '002sht')])
invalidUnit(unitJupiter, [...idolDirectory, { ...idolDirectory.find(idol => idol.id === '002sht'), unitCode: 'another-unit' }])
invalidUnit(unitJupiter, idolDirectory.map(idol => idol.id === '002sht' ? { ...idol, id: 'unknown-idol' } : idol))
invalidUnit(unitJupiter, idolDirectory.map(idol => idol.id === '002sht' ? { ...idol, id: '' } : idol))
invalidUnit(unitJupiter, idolDirectory, characters.filter(character => character.id !== '002sht'))
invalidUnit(unitJupiter, idolDirectory, [...characters, characters.find(character => character.id === '002sht')])
for (const mutate of [
  song => { song.songCode = 'drv999' },
  song => { song.vocalSetting.unitCode = '' },
  song => { song.vocalSetting.unitCode = 'unknown-unit' },
  song => { song.vocalSetting.mode = 'solo' },
  song => { song.positions = [] },
  song => { song.positions[0] = 0 },
  song => { song.positions[0] = '2' },
  song => { song.positions[0] = song.positions[1] },
  song => { song.positions[0] = 5 },
  song => { song.stagePositionMap.pop() },
  song => { song.stagePositionMap[0].stagePosition = song.stagePositionMap[1].stagePosition },
  song => { song.stagePositionMap[0].performerSlot = song.stagePositionMap[1].performerSlot },
  song => { song.stagePositionMap[4].stagePosition = 6 },
  song => { song.stagePositionMap[4] = null },
  song => { song.onStagePerformerSlots = [] },
  song => { song.onStagePerformerSlots.pop() },
  song => { song.onStagePerformerSlots[0] = 6 },
  song => { song.onStagePerformerSlots[0] = '1' },
  song => { song.onStagePerformerSlots[0] = song.onStagePerformerSlots[1] },
  song => { song.onStagePerformerSlots[0] = 4 },
]) {
  const changed = clone(unitJupiter); mutate(changed); invalidUnit(changed)
}
assert.equal(buildOriginalStageLineup(solo, ['040ren'], characters, idolDirectory), null,
  'a verified unit directory does not loosen the actual Solo incomplete-map boundary')
assert.equal(buildOriginalStageLineup(songFor('drvalv'), [], characters, idolDirectory), null,
  'the base free-formation song still has no fixed original members')

const jupiterSlots = [
  { position: 1, characterId: 'not-an-active-idol' },
  { position: 2, characterId: '002sht' },
  { position: 3, characterId: '001tom' },
  { position: 4, characterId: '003hok' },
]
const shared = commonStageCostumes(jupiterSlots, characters, [2, 3, 4])
assert.deepEqual(shared.map(costume => costume.id), ['005_00', '104_00', '106_00', '107_00'])
const firstActive = characters.find(character => character.id === '002sht')
const assertActualCostumeOptions = (options, first) => {
  for (const option of options) {
    const { costumeIdsByIdol, ...sourceFields } = option
    assert.deepEqual(sourceFields, first.costumes.find(costume => costume.id === option.id),
      'all first-active costume resource fields are preserved')
    for (const [idolId, costumeId] of Object.entries(costumeIdsByIdol)) {
      const actual = characters.find(character => character.id === idolId).costumes.find(costume => costume.id === costumeId)
      assert.equal(stageCostumeLabel(actual), stageCostumeLabel(option))
      const source = costumeDictionary.by_model_resource_id[`${idolId}_${costumeId}`]
      assert.equal(source.idol_code, idolId)
      assert.equal(source.model_resource_id, `${idolId}_${costumeId}`)
      assert.equal(source.costume_name, stageCostumeLabel(option), 'each assignment resolves to its exact formal source name')
    }
  }
}
assertActualCostumeOptions(shared, firstActive)
assert.deepEqual(shared.find(costume => stageCostumeLabel(costume) === 'ファーストグロース').costumeIdsByIdol,
  { '002sht': '106_00', '001tom': '105_00', '003hok': '105_00' })

// The user's actual mixed K.now O.nly lineup has different local uniform IDs.
const mixedSlots = [
  { position: 2, characterId: '039mcr' },
  { position: 3, characterId: '004ter' },
  { position: 4, characterId: '040ren' },
]
const mixedShared = commonStageCostumes(mixedSlots, characters, three.positions)
assert.deepEqual(mixedShared.map(stageCostumeLabel), ['グローイングブライティ', 'フィジカルスパークルレッド', 'ファーストグロース'])
assert.deepEqual(mixedShared.find(costume => stageCostumeLabel(costume) === 'ファーストグロース').costumeIdsByIdol,
  { '039mcr': '105_00', '004ter': '106_00', '040ren': '106_00' })
assertActualCostumeOptions(mixedShared, characters.find(character => character.id === '039mcr'))
const tigerLineup = buildOriginalStageLineup(three, members, characters)
const tigerSlots = tigerLineup.map((characterId, index) => ({ position: index + 1, characterId }))
const tigerShared = commonStageCostumes(tigerSlots, characters, three.positions)
assert.deepEqual(tigerShared.map(stageCostumeLabel),
  ['グローイングブライティ', 'ワイルドウィナーズ', 'フィジカルスパークルレッド', 'ファーストグロース', 'グレイテストクライマー'])
assert.deepEqual(tigerShared.find(costume => stageCostumeLabel(costume) === 'ファーストグロース').costumeIdsByIdol,
  { '039mcr': '105_00', '038tak': '105_00', '040ren': '106_00' })
assert.deepEqual(tigerShared.find(costume => stageCostumeLabel(costume) === 'グレイテストクライマー').costumeIdsByIdol,
  { '039mcr': '106_00', '038tak': '106_00', '040ren': '107_00' },
  'the source-name rule supports another proven common design without a hardcoded uniform allowlist')
assertActualCostumeOptions(tigerShared, characters.find(character => character.id === '039mcr'))
assert.equal(costumeTranslations['ファーストグロース'], '初次成长', 'actual production costume translation')
const firstGrowthIds = new Set()
for (const character of characters) {
  const options = character.costumes.filter(costume => stageCostumeLabel(costume) === 'ファーストグロース')
  assert.equal(options.length, 1, `${character.id}: the actual source design is unambiguous`)
  firstGrowthIds.add(options[0].id)
  const source = costumeDictionary.by_model_resource_id[`${character.id}_${options[0].id}`]
  assert.equal(source.idol_code, character.id)
  assert.equal(source.costume_name, 'ファーストグロース')
  assert.equal(source.model_resource_id, `${character.id}_${options[0].id}`)
}
assert.deepEqual([...firstGrowthIds].sort(), ['104_00', '105_00', '106_00', '107_00'],
  'all actual manifest members have formal model bindings; their local short IDs are not one shared ID')
assert.equal(shared.some(costume => costume.id === '101_00'), false,
  'actual Jupiter 101_00 designs have different labels and are not a common costume')
assert.deepEqual(commonStageCostumes(jupiterSlots, characters, []), [])
assert.deepEqual(commonStageCostumes(jupiterSlots, characters, [2, 2]), [])
assert.deepEqual(commonStageCostumes(jupiterSlots, characters, [0]), [])
assert.deepEqual(commonStageCostumes(jupiterSlots, characters, [1, 2, 3, 4]), [])
assert.deepEqual(commonStageCostumes(jupiterSlots.filter(slot => slot.position !== 3), characters, [2, 3, 4]), [])
assert.deepEqual(commonStageCostumes([...jupiterSlots, jupiterSlots[1]], characters, [2, 3, 4]), [])
assert.deepEqual(commonStageCostumes(null, characters, [2]), [])
assert.deepEqual(commonStageCostumes(jupiterSlots, null, [2]), [])

// Explicit synthetic omissions/conflicts test conservative boundaries. They
// do not claim these malformed costumes exist in the actual manifest.
const pairSlots = [{ position: 1, characterId: 'a' }, { position: 2, characterId: 'b' }]
const syntheticCharacters = (left, right) => [
  { id: 'a', costumes: left }, { id: 'b', costumes: right },
]
const costume = { id: '005_00', label: 'Long complete costume name · 005_00', atlas: 'original-atlas' }
for (const right of [
  { ...costume, label: 'Different costume · 005_00' },
  { ...costume, label: '' },
  { ...costume, label: ' ' },
  { ...costume, label: null },
  { ...costume, id: '006_00' },
  { ...costume, label: ' · 005_00' },
  { ...costume, label: 'Long complete costume name+ · 005_00' },
]) assert.deepEqual(commonStageCostumes(pairSlots, syntheticCharacters([costume], [right]), [1, 2]), [])
assert.deepEqual(commonStageCostumes(pairSlots, syntheticCharacters([costume], [costume, { ...costume }]), [1, 2]), [])
const otherId = { ...costume, id: '006_00', label: 'Long complete costume name · 006_00', atlas: 'other-id-atlas' }
assert.deepEqual(commonStageCostumes(pairSlots, syntheticCharacters([costume], [costume, otherId]), [1, 2]), [],
  'two distinct resources with the same source name are ambiguous, even if one short ID matches')
assert.deepEqual(commonStageCostumes(pairSlots, syntheticCharacters([costume, otherId], [costume]), [1, 2]), [],
  'the first member must also have one unique source-name match')
assert.deepEqual(commonStageCostumes(pairSlots, syntheticCharacters([costume], [costume,
  { ...costume, label: 'Different source name · 005_00' }]), [1, 2]), [], 'duplicate local IDs cannot safely drive a select value')
const translatedLeft = { ...costume, displayName: '相同中文译名' }
const translatedRight = { ...costume, label: 'Different source name · 005_00', displayName: '相同中文译名' }
assert.deepEqual(commonStageCostumes(pairSlots, syntheticCharacters([translatedLeft], [translatedRight]), [1, 2]), [],
  'explicit synthetic translated-name collision never establishes source identity')
const fullId = { ...costume, id: '001tom_005_00', label: 'Same label' }
assert.deepEqual(commonStageCostumes(pairSlots, syntheticCharacters([fullId], [fullId]), [1, 2]), [])
const syntheticShared = commonStageCostumes(pairSlots, syntheticCharacters([costume], [{ ...costume }]), [1, 2])
assert.deepEqual(syntheticShared, [{ ...costume, costumeIdsByIdol: { a: '005_00', b: '005_00' } }])
assert.deepEqual(commonStageCostumes(pairSlots, syntheticCharacters([costume], [otherId]), [1, 2]),
  [{ ...costume, costumeIdsByIdol: { a: '005_00', b: '006_00' } }], 'same source name carries each member actual resource ID')
assert.equal(Object.hasOwn(costume, 'costumeIdsByIdol'), false, 'source costume remains unmodified')
assert.deepEqual(commonStageCostumes([{ position: 1, characterId: 'a' }, { position: 2, characterId: 'a' }],
  syntheticCharacters([costume], [otherId]), [1, 2]), [{ ...costume, costumeIdsByIdol: { a: '005_00' } }],
  'a repeated active idol uses its one actual resource assignment')
assert.deepEqual(commonStageCostumes([{ position: 1, characterId: 'a' }], [{ id: 'a' }], [1]), [])

assert.equal(stageCostumeLabel(shared[0]), 'グローイングブライティ')
assert.equal(stageCostumeLabel(characters[0].costumes.find(costume => costume.id === '101_01')), 'ミッドナイトプラネット+')
assert.equal(stageCostumeLabel(costume), 'Long complete costume name')
assert.equal(stageCostumeLabel({ ...costume, label: 'Full · inner title · 005_00' }), 'Full · inner title')
assert.equal(stageCostumeLabel({ ...costume, label: 'Full title · 006_00' }), 'Full title · 006_00')
assert.equal(stageCostumeLabel({ ...costume, label: 'Full title · 005_00 extra' }), 'Full title · 005_00 extra')
assert.equal(stageCostumeLabel({ label: 'Untouched full name' }), 'Untouched full name')
assert.equal(stageCostumeLabel({ label: ' · 005_00', id: '005_00' }), '衣装待确认')
assert.equal(stageCostumeLabel({ id: '005_00' }), '衣装待确认')
assert.equal(stageCostumeLabel(null), '衣装待确认')

// The regular all-idol actions are proven against the complete formal
// directory, not against whichever one or three idols happen to be on stage.
const universal = universalStageCostumes(characters, idolDirectory)
assert.deepEqual(universal.map(stageCostumeLabel), ['グローイングブライティ', 'ファーストグロース'])
assertActualCostumeOptions(universal, characters.find(character => character.id === '001tom'))
for (const option of universal) {
  assert.deepEqual(Object.keys(option.costumeIdsByIdol), idolDirectory.map(idol => idol.id).sort())
  assert.equal(Object.keys(option.costumeIdsByIdol).length, 49, 'each universal design verifies all actual formal members')
}
assert.deepEqual(universalStageCostumes([...characters].reverse(), [...idolDirectory].reverse()), universal,
  'resource options and per-idol assignments are deterministic across directory order')
assert.equal(universal.some(option => ['ミッドナイトプラネット', 'ミッドナイトプラネット+', 'ワイルドウィナーズ']
  .includes(stageCostumeLabel(option))), false, 'exclusive SSR and unit costumes cannot become all-idol shortcut actions')
assert.deepEqual(universalStageCostumes(null, idolDirectory), [])
assert.deepEqual(universalStageCostumes(characters, null), [])
assert.deepEqual(universalStageCostumes(characters, []), [])
assert.deepEqual(universalStageCostumes(characters, [...idolDirectory, idolDirectory[0]]), [])
assert.deepEqual(universalStageCostumes(characters, [...idolDirectory, { id: 'unknown-idol' }]), [])
assert.deepEqual(universalStageCostumes(characters, [{ id: '' }]), [])
assert.deepEqual(universalStageCostumes(characters.filter(character => character.id !== '049eis'), idolDirectory), [])
assert.deepEqual(universalStageCostumes([...characters, characters[0]], idolDirectory), [])
for (const mutate of [
  character => { character.costumes = character.costumes.filter(costume => stageCostumeLabel(costume) !== 'ファーストグロース') },
  character => { character.costumes.push({ ...character.costumes.find(costume => stageCostumeLabel(costume) === 'ファーストグロース') }) },
  character => {
    const growth = character.costumes.find(costume => stageCostumeLabel(costume) === 'ファーストグロース')
    character.costumes.push({ ...growth, label: `Different source name · ${growth.id}` })
  },
]) {
  const changed = clone(characters); mutate(changed.find(character => character.id === '049eis'))
  assert.deepEqual(universalStageCostumes(changed, idolDirectory).map(stageCostumeLabel), ['グローイングブライティ'],
    'one unproven member removes only that universal design, never replaces its model')
}

const currentJupiter = jupiterSlots.map(slot => ({ ...slot, costumeId: '005_00' }))
const beforeCurrentJupiter = JSON.stringify(currentJupiter)
assert.deepEqual(planStageCostumeSync(currentJupiter, characters, [4, 2, 3], '001tom', '105_00'), {
  sourceName: 'ファーストグロース',
  matched: [{ position: 2, idolCode: '002sht', costumeId: '106_00' },
    { position: 3, idolCode: '001tom', costumeId: '105_00' },
    { position: 4, idolCode: '003hok', costumeId: '105_00' }],
  unmatched: [],
}, 'actual Jupiter initial growth resolves each different local model ID; planning sorts a copy of positions')
assert.deepEqual(planStageCostumeSync(currentJupiter, characters, [2, 3, 4], '001tom', '101_00'), {
  sourceName: 'ミッドナイトプラネット',
  matched: [{ position: 3, idolCode: '001tom', costumeId: '101_00' }],
  unmatched: [{ position: 2, idolCode: '002sht' }, { position: 4, idolCode: '003hok' }],
}, 'actual SSR sync is a partial/exclusive match; the other Jupiter 101_00 models are different designs')
assert.deepEqual(planStageCostumeSync(currentJupiter, characters, [2, 3, 4], '001tom', '101_01'), {
  sourceName: 'ミッドナイトプラネット+',
  matched: [{ position: 3, idolCode: '001tom', costumeId: '101_01' }],
  unmatched: [{ position: 2, idolCode: '002sht' }, { position: 4, idolCode: '003hok' }],
}, 'SSR recolor remains distinct from the normal source design')
assert.equal(JSON.stringify(currentJupiter), beforeCurrentJupiter, 'planning does not update either matched or resting/unmatched slots')
assert.deepEqual(planStageCostumeSync(mixedSlots, characters, three.positions, '004ter', '106_00').matched,
  [{ position: 2, idolCode: '039mcr', costumeId: '105_00' },
    { position: 3, idolCode: '004ter', costumeId: '106_00' },
    { position: 4, idolCode: '040ren', costumeId: '106_00' }], 'actual mixed group receives the proven per-idol initial growth IDs')

const syntheticPlan = (people = syntheticCharacters([costume], [otherId]), slots = pairSlots,
  positions = [1, 2], referenceId = 'a', referenceCostumeId = '005_00') =>
  planStageCostumeSync(slots, people, positions, referenceId, referenceCostumeId)
const partialPlan = {
  sourceName: 'Long complete costume name',
  matched: [{ position: 1, idolCode: 'a', costumeId: '005_00' }],
  unmatched: [{ position: 2, idolCode: 'b' }],
}
assert.deepEqual(syntheticPlan(), { ...partialPlan,
  matched: [{ position: 1, idolCode: 'a', costumeId: '005_00' }, { position: 2, idolCode: 'b', costumeId: '006_00' }], unmatched: [] },
  'same original name across different local IDs establishes a match')
for (const people of [
  syntheticCharacters([costume], [{ ...costume, label: 'Different costume · 005_00' }]),
  syntheticCharacters([translatedLeft], [translatedRight]),
  syntheticCharacters([costume], [{ ...costume, label: 'Long complete costume name+ · 005_00' }]),
  syntheticCharacters([costume], [costume, otherId]),
  syntheticCharacters([costume], [costume, { ...costume, label: 'Different costume · 005_00' }]),
  [{ id: 'a', costumes: [costume] }, { id: 'b' }],
  [{ id: 'a', costumes: [costume] }],
  [...syntheticCharacters([costume], [otherId]), { id: 'b', costumes: [otherId] }],
]) assert.deepEqual(syntheticPlan(people), partialPlan, 'target omission/ambiguity is reported without guessed replacement')
assert.deepEqual(syntheticPlan(undefined, [{ position: 1, characterId: 'a' }, { position: 2, characterId: 'missing-idol' }]),
  { ...partialPlan, unmatched: [{ position: 2, idolCode: 'missing-idol' }] })
assert.deepEqual(syntheticPlan(undefined, [...pairSlots, { position: 3, characterId: 'unknown-resting-idol' }], [1]), {
  sourceName: 'Long complete costume name', matched: [{ position: 1, idolCode: 'a', costumeId: '005_00' }], unmatched: [],
}, 'resting positions are absent from the entire plan even when they lack a character/model')
assert.deepEqual(syntheticPlan(undefined, [{ position: 1, characterId: 'a' }, { position: 2, characterId: 'a' }]), {
  sourceName: 'Long complete costume name', matched: [{ position: 1, idolCode: 'a', costumeId: '005_00' },
    { position: 2, idolCode: 'a', costumeId: '005_00' }], unmatched: [],
}, 'the same active idol in two positions receives its exact resource in both positions')
for (const people of [
  syntheticCharacters([costume, { ...costume }], [otherId]),
  syntheticCharacters([costume, otherId], [otherId]),
  syntheticCharacters([{ ...costume, label: '' }], [otherId]),
  syntheticCharacters([], [otherId]),
  [{ id: 'a' }, { id: 'b', costumes: [otherId] }],
  [...syntheticCharacters([costume], [otherId]), { id: 'a', costumes: [costume] }],
]) assert.equal(syntheticPlan(people), null, 'an ambiguous or unavailable reference cannot create a partial plan')
for (const positions of [[], [1, 1], [0], [6], ['1'], null]) assert.equal(syntheticPlan(undefined, undefined, positions), null)
for (const slots of [[], pairSlots.slice(0, 1), [...pairSlots, pairSlots[0]],
  [{ position: 1, characterId: 'a' }, { position: 2, characterId: '' }]]) assert.equal(syntheticPlan(undefined, slots), null)
assert.equal(syntheticPlan(null), null)
assert.equal(syntheticPlan(undefined, null), null)
assert.equal(syntheticPlan(undefined, undefined, undefined, 'b'), null, 'reference costume ID must exist for its own idol')
assert.equal(syntheticPlan(undefined, pairSlots, [2]), null, 'a stale non-active reference cannot sync to another active idol')
assert.equal(syntheticPlan(undefined, undefined, undefined, 'a', 'unknown-costume'), null)

const frozenPeople = syntheticCharacters([Object.freeze({ ...costume })], [Object.freeze({ ...otherId })])
frozenPeople.forEach(character => { Object.freeze(character.costumes); Object.freeze(character) }); Object.freeze(frozenPeople)
const frozenSlots = Object.freeze(pairSlots.map(slot => Object.freeze({ ...slot })))
const frozenPositions = Object.freeze([2, 1])
assert.deepEqual(syntheticPlan(frozenPeople, frozenSlots, frozenPositions), {
  sourceName: 'Long complete costume name',
  matched: [{ position: 1, idolCode: 'a', costumeId: '005_00' }, { position: 2, idolCode: 'b', costumeId: '006_00' }], unmatched: [],
}, 'the planner accepts frozen inputs without sorting or editing their arrays/objects')
assert.equal(JSON.stringify({ characters, choreography, catalog, idolDirectory }), snapshot, 'presentation does not mutate source data')

// Optional actual published artifact parity. The base suite stays checkout-
// portable; this flag exercises the independently generated public projection.
const args = process.argv.slice(2)
assert.ok(!args.length || args.length === 2 && args[0] === '--read-model-root', 'Expected --read-model-root <directory>')
if (args.length) {
  const root = path.resolve(args[1])
  const bootstrap = JSON.parse(readFileSync(path.join(root, 'bootstrap.inline.json'), 'utf8'))
  for (const [code, members, expected] of examples) {
    const artifact = JSON.parse(readFileSync(path.join(root, 'pages', '_catalog', 'v', bootstrap.release,
      'songs', 'detail', `${entityKey(code)}.json`), 'utf8'))
    assert.equal(artifact.kind, 'songs.detail')
    assert.equal(artifact.data.id, code)
    assert.equal(artifact.data.song.song_code, code)
    assert.deepEqual(artifact.data.song.performance_mapping, publicDetail(code).song.performance_mapping)
    assert.deepEqual(artifact.data.view.performers.map(performer => performer.id), members)
    assert.deepEqual(buildOriginalStageLineup(songFor(code), artifact.data.view.performers.map(performer => performer.id), characters), expected)
  }
  assert.deepEqual(bootstrap.idols.map(({ id, unitCode, unitId }) => ({ id, unitCode, unitId })),
    idolDirectory.map(({ id, unitCode, unitId }) => ({ id, unitCode, unitId })), 'independently published Unit identity parity')
  for (const song of unitSongs) assert.deepEqual(buildOriginalStageLineup(song, [], characters, bootstrap.idols),
    buildOriginalStageLineup(song, [], characters, idolDirectory))
  console.log(`Actual public songs.detail parity passed for ${examples.length} member rosters and all ${unitSongs.length} Unit variants with published bootstrap identities; release ${bootstrap.release}`)
}
console.log('Chibi panel presentation: real 3/4/5-person rosters and all 48 Unit variants with formal 49-member directory, actual Solo incomplete-map exclusion, labeled complete one-slot fixture, malformed-map/directory/member guards, free-formation/special exclusions, actual mixed/THE虎牙道/Jupiter costume assignments, complete 49-member universal design bindings, exact-source partial/exclusive SSR sync planning, source-name/local-ID ambiguity and synthetic translation-collision guards, inactive-slot and frozen-input protection, exact label suffix passed. UI slot assignment is not official stage-placement evidence; no SFC, Browser, resource/audio or CSV timing claim.')
