import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import {validateOriginalLineups, originalMemberSelection} from '../src/core/chibiOriginalLineups.js'
import {buildOriginalStageLineup} from '../src/presentation/ChibiPanelPresentation.js'
const read = file => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'))
const native = validateOriginalLineups(read('public/data/stage-original-lineups.json'))
const catalog = read('public/data/song_catalog.json').songs
const songs = read('public/data/stage-choreography-shards.json').index.songs
const clone = value => JSON.parse(JSON.stringify(value))
const characters = read('readmodels/bootstrap.inline.json').idols.map(i => ({id:i.id}))
const directory = read('readmodels/bootstrap.inline.json').idols
const basisCounts = {}
let changed = 0, valid = 0
for (const [code,row] of Object.entries(native.songs)) {
  basisCounts[row.basis] = (basisCounts[row.basis] || 0) + 1
  const published = catalog[code], mapping = published.performance_mapping
  assert.equal(row.songId, published.song_id, 'Export must match effective catalog SongData identity')
  assert.deepEqual([...row.codes].sort(), [...mapping.performer_idol_codes].sort())
  assert.equal(row.unitCode, mapping.confirmed_unit?.unit_code || null)
  if (row.basis === 'table46-explicit') assert.deepEqual(row.codes, mapping.performer_slot_idol_codes)
  const song = songs.find(s => s.songCode === code && !s.variant)
  const selection = originalMemberSelection(song,native,[],false)
  assert.equal(selection.basis,row.basis)
  const lineup = buildOriginalStageLineup(song,selection.codes,characters,directory,selection)
  assert(lineup, `${code}: exported original roster must map to actual active slots`)
  valid++
  if(row.basis === 'table2-unit-default') {
    const old=buildOriginalStageLineup(song,mapping.performer_idol_codes,characters,directory)
    if(old && JSON.stringify(old)!==JSON.stringify(lineup))changed++
  }
}
assert.deepEqual(basisCounts, {'table46-explicit':13,'table2-unit-default':41})
assert.equal(valid,54);assert.equal(changed,24)
const cafe = songs.find(s=>s.id==='cfprde_live_effect')
assert.deepEqual(native.songs.cfprde.codes,['029ass','027yuk','028soi','030mak','031sak'])
assert.deepEqual(native.songs.psblts.codes,['035mco','037jir','036rui'],'Song explicit order overrides S.E.M default')
const frame=songs.find(s=>s.id==='yknkmh_live_effect')
const select=originalMemberSelection(frame,native,[],false)
assert.equal(frame.stagePositionMap.length,5)
assert.deepEqual(buildOriginalStageLineup(frame,select.codes,characters,directory,select),['','015ryu','014hid','016sei',''])
assert.equal(buildOriginalStageLineup(frame,select.codes,characters,directory),null,'Legacy incomplete-map guard remains unless native active subset is explicit')
for(const mutate of [s=>s.onStagePerformerSlots.push(4),s=>s.performerSlots.pop(),s=>s.onStagePerformerSlots=[1,1,3],
  s=>s.stagePositionMap[4].stagePosition=3,s=>s.stagePositionMap[4].performerSlot=1,s=>s.onStagePerformerSlots=[1,2,6]]) {
  const bad=clone(frame);mutate(bad)
  assert.equal(buildOriginalStageLineup(bad,select.codes,characters,directory,select),null,'Hidden slots must remain valid and cannot enter the active roster')
}
const shifted=clone(frame)
shifted.onStagePerformerSlots=[2,3,4];shifted.positions=[1,2,4]
assert.equal(buildOriginalStageLineup(shifted,select.codes,characters,directory,select),null,
  'Native unit auto-deck fills slots 1..N; it cannot shift those members into arbitrary active deck slots')
for(const song of songs.filter(s=>s.vocalSetting || s.variant)) {
  const fallback=['001tom','002sht','003hok']
  const result=originalMemberSelection(song,native,fallback,false)
  assert.equal(result.codes,fallback,'Base-song source must not replace a selected vocal variant')
  assert.equal(result.activeSubset,false)
}
for(const code of ['drvalv','byndtd','grwsml','reason','tkstp1','tkstp2','drv999'])assert(!native.songs[code])
for(const mutate of [d=>d.source.masterdataSha256='',d=>d.source.unitOrderField='32',d=>d.songs.cfprde.codes=['unknown'],
  d=>d.songs.cfprde.codes.push(d.songs.cfprde.codes[0]),d=>d.songs.cfprde.unitCode=null,d=>d.songs.cfprde.songId=-1]) {
  const bad=clone(native);mutate(bad);assert.throws(()=>validateOriginalLineups(bad))
}
// Evaluate the actual SFC computed declarations so a stale prop path cannot
// satisfy the pure helper checks while leaving the real page on ID ordering.
const source=readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
const declarations=source.split(/\r?\n/).filter(line=>/^const (nativeOriginalLineups|originalSelection|originalStageLineup) =/.test(line)).join('\n')
const ref=value=>({value})
const computed=fn=>({get value(){return fn()}})
const env={shallowRef:ref,computed,selectedSong:ref(cafe),props:{originalPerformers:[],originalSlotOrdered:false,idolDirectory:directory},
  characters:ref(characters),originalMemberSelection,buildOriginalStageLineup,native,result:null}
vm.createContext(env)
vm.runInContext(declarations+';nativeOriginalLineups.value=native;result=originalStageLineup.value',env)
assert.deepEqual(Array.from(env.result),['030mak','027yuk','029ass','028soi','031sak'])
const loader=readFileSync(new URL('../src/utils/liveChibiSpine.js',import.meta.url),'utf8').split(/\r?\n/).find(line=>line.startsWith('export const fetchLiveChibiOriginalLineups'))
const options={signal:new AbortController().signal}
let calls=0
const load=new Function('indexTransport','validateOriginalLineups',loader.replace('export ','')+';return fetchLiveChibiOriginalLineups')({load:async(url,received)=>{
  calls++;assert.equal(url,'/data/stage-original-lineups.json');assert.equal(received,options);return {data:native}
}},validateOriginalLineups)
assert.equal(await load(options),native);assert.equal(calls,1)
console.log('Native original lineups: 54 fixed songs / 13 explicit + 41 unit defaults, 24 corrected orders, hidden slots, variant exclusions, SFC and transport passed')
