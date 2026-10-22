import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createArchiveAssetResolver } from './lib/archive-assets.mjs'
import { candidateRoot } from './lib/archive-bootstrap-plugin.mjs'

// Writes src/data/storyAudioCatalog.json: every BGM, ambience and SE cue the stories of the story catalogue
// play, with the stories that play it. Stories are listed once in `files` (the catalogue's ids, each the name
// of a whole compiled story, `<scenario_id>.json`) and referenced by index. The catalogue is the read-model
// candidate the dev server serves (scripts/lib/archive-bootstrap-plugin.mjs), so every listed story opens. `available` says whether the converted audio the player fetches exists locally
// (scripts/lib/archive-assets.mjs, the same lookup the dev server and the preview export use).
// A BGM cue is the story score, a song (song3_<code>) or a song's instrumental (bgm_<code>_inst); song
// cues name the song so the page can open it. Score names are read from the cue name, not official titles.
// Usage: node scripts/build-story-audio-catalog.mjs [compiledDir]
const root = process.cwd()
const compiledDir = process.argv[2] || 'E:/Web_build/SideM_Archived/web_viewer/public/data/compiled'
const resolver = createArchiveAssetResolver()
const available = (kind, cue) => resolver.audioCandidates(`${kind}/${cue}.ogg`).some(file => fs.existsSync(file))
const songCatalog = JSON.parse(fs.readFileSync(path.join(root, 'public/data/song_catalog.json'), 'utf8')).songs
const songs = new Set(Object.keys(songCatalog))
// A song cue carries the song's title and jacket so the page need not load the song catalogue.
const songRef = code => ({ song: code, title: songCatalog[code].title, jacket: songCatalog[code].jacket_url || '' })
// song3_<code> is the song's full mix, the same source the song page plays (song_playback_audio.json); a song cue
// plays that file. The corpus's public folder holds it (compiledDir is <public>/data/compiled).
const publicDir = path.resolve(compiledDir, '../..')
const fullMix = JSON.parse(fs.readFileSync(path.join(root, 'public/data/song_playback_audio.json'), 'utf8')).songs
const fullMixUrl = code => fullMix[code]?.url && fs.existsSync(path.join(publicDir, fullMix[code].url)) ? fullMix[code].url : ''

// Readable names for the story score, read from the cue names (counsel = the producer's talks, and so on).
const SCORE = {
  job: '工作', lesson: '课程', school: '学校', fight: '对决', excite: '兴奋', mysterious: '神秘',
  trouble: '麻烦', trouble_serious: '麻烦 · 严肃',
  usual_day: '日常 · 白天', usual_night: '日常 · 夜晚',
  counsel_calm: '商谈 · 平静', counsel_wonder: '商谈 · 疑惑', counsel_country: '商谈 · 田园', counsel_heartful: '商谈 · 温馨',
  counsel_teary: '商谈 · 感伤', counsel_blue: '商谈 · 忧郁',
  event_before: '活动 · 开场前', event_after: '活动 · 结束后', live_before: 'LIVE · 开场前', live_after: 'LIVE · 结束后',
  city_usual_day: '街道 · 白天', city_usual_night: '街道 · 夜晚', city_downtown_day: '闹市 · 白天', city_downtown_night: '闹市 · 夜晚',
  park_day: '公园 · 白天', park_night: '公园 · 夜晚', shop_general: '店铺', shop_elegant: '店铺 · 高雅',
  growingsmiles_energy: 'GROWING SMILES! · 活力', growingsmiles_calm: 'GROWING SMILES! · 平静',
  adv_idol_birthday: '偶像生日', adv_grwsml_nomaster: 'GROWING SMILES! · 剧情版',
}
// Cues that are not a track: no_bgm stops the music; ambience 0 clears it.
const SILENCE = { bgm: new Set(['no_bgm']), ambient: new Set(['0']), se: new Set() }

function bgmKind(cue) {
  const song = /^song3_([a-z0-9]+)$/.exec(cue)?.[1]
  if (song && songs.has(song)) return { kind: 'song', ...songRef(song), url: fullMixUrl(song) }
  const inst = /^(?:bgm|adv)_([a-z0-9]+)(?:_tv)?_inst$/.exec(cue)?.[1]
  if (inst && songs.has(inst)) return { kind: 'song_inst', ...songRef(inst) }
  if (SCORE[cue]) return { kind: 'score', label: SCORE[cue] }
  // Story-only arrangements of a song (adv_<code>_…) and other one-off cues.
  const arranged = /^adv_([a-z0-9]+)_/.exec(cue)?.[1]
  return arranged && songs.has(arranged) ? { kind: 'song_arrangement', ...songRef(arranged) } : { kind: 'other' }
}

const candidate = candidateRoot()
assert.ok(candidate, 'no read-model candidate for the checked-in release')
const readPage = descriptor => JSON.parse(fs.readFileSync(path.join(candidate, 'pages', descriptor.url), 'utf8')).data
const bootstrap = JSON.parse(fs.readFileSync(path.join(candidate, 'bootstrap.inline.json'), 'utf8'))
const storyIndex = readPage(bootstrap.domains.stories)
const storyFiles = storyIndex.pages.flatMap(descriptor => readPage(descriptor).rows.map(row => row.file))
assert.equal(storyFiles.length, storyIndex.count, 'story catalogue pages disagree with its index')

const uses = { bgm: new Map(), ambient: new Map(), se: new Map() }
const files = new Set()
function add(kind, cue, file) {
  if (typeof cue !== 'string' || !cue || SILENCE[kind].has(cue)) return
  if (!uses[kind].has(cue)) uses[kind].set(cue, new Set())
  uses[kind].get(cue).add(file)
}
// A step's sounds in either step format: a legacy step keeps everything in `state` (one-shot SE in se / se_events);
// a story-snapshot-v2 step keeps BGM and ambience in its snapshots and plays SE as se.play cues.
function* stepSounds(step) {
  for (const state of [step.state, step.entry_snapshot, step.settled_snapshot]) {
    if (!state) continue
    yield ['bgm', state.bgm]
    yield ['ambient', state.environmental?.cue ?? state.environmental]
    yield ['se', state.se?.cue]
    for (const event of state.se_events || []) yield ['se', event?.cue]
  }
  for (const cue of step.cues || []) if (cue.action === 'se.play') yield ['se', cue.payload?.cue]
}
for (const file of storyFiles) {
  const story = JSON.parse(fs.readFileSync(path.join(compiledDir, file), 'utf8'))
  let plays = false
  for (const step of story.steps || []) for (const [kind, cue] of stepSounds(step)) {
    if (typeof cue === 'string' && cue && !SILENCE[kind].has(cue)) { add(kind, cue, file); plays = true }
  }
  if (plays) files.add(file)
}
const fileList = [...files].sort()
const fileIndex = new Map(fileList.map((file, index) => [file, index]))
// A cue with its own `url` (a song's full mix) plays that file; any other plays the path the story player fetches.
const entries = (kind, extra = () => ({})) => [...uses[kind]]
  .map(([cue, set]) => {
    const { url, ...facts } = extra(cue)
    return { cue, ...facts, ...(url ? { url } : {}), available: Boolean(url) || available(kind, cue), files: [...set].map(file => fileIndex.get(file)).sort((a, b) => a - b) }
  })
  .sort((a, b) => b.files.length - a.files.length || a.cue.localeCompare(b.cue))
const catalog = { schema: 'GS-STORY-AUDIO-CATALOG-V1', files: fileList, bgm: entries('bgm', bgmKind), ambient: entries('ambient'), se: entries('se') }
assert.ok(catalog.bgm.length > 50 && catalog.se.length > 300 && catalog.ambient.length > 50, 'the compiled corpus looks incomplete')
assert.ok(catalog.bgm.filter(entry => entry.kind === 'score').every(entry => entry.label))

const target = path.join(root, 'src/data/storyAudioCatalog.json')
fs.writeFileSync(target, JSON.stringify(catalog) + '\n')
const count = list => `${list.length} (${list.filter(entry => !entry.available).length} unavailable)`
console.log(`files ${fileList.length}; bgm ${count(catalog.bgm)} ${JSON.stringify(Object.groupBy(catalog.bgm, entry => entry.kind), (key, value) => Array.isArray(value) && key !== 'files' ? value.length : value)}; ambient ${count(catalog.ambient)}; se ${count(catalog.se)}; ${fs.statSync(target).size} bytes`)
