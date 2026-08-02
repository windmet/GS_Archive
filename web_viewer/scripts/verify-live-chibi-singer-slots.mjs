import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const indexPath = path.join(projectRoot, 'public', 'assets', 'live-chibi', 'choreography', 'index.json')

function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exit(1)
}

let index
try {
  index = JSON.parse(await readFile(indexPath, 'utf8'))
} catch (error) {
  fail(`missing generated Chibi choreography index: ${indexPath} (${error.message})`)
}

const songs = index.songs || []
let singerEvents = 0
let decodedCommaLyrics = 0
let preservedAngleLyrics = 0
for (const song of songs) {
  const performerByStage = new Map((song.stagePositionMap || [])
    .map(item => [Number(item.stagePosition), Number(item.performerSlot)]))
  for (const event of song.singerEvents || []) {
    singerEvents += 1
    if (!Array.isArray(event.performerSlots) || !Array.isArray(event.stagePositions)) {
      fail(`${song.id}: singer event must preserve performerSlots and stagePositions`)
    }
    const rawStagePositions = (event.singers || []).map(Number)
    const actualStagePositions = event.stagePositions.map(Number)
    if (JSON.stringify(rawStagePositions) !== JSON.stringify(actualStagePositions)) {
      fail(`${song.id} @ ${event.time}: SwitchSinger must remain authored stage positions`)
    }
    const expected = actualStagePositions
      .map(position => performerByStage.get(position) ?? position)
      .sort((left, right) => left - right)
    const actual = event.performerSlots.map(Number).sort((left, right) => left - right)
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      fail(`${song.id} @ ${event.time}: stage-position/performer-slot inverse mismatch`)
    }
  }
  for (const event of song.lyricEvents || []) {
    if (event.text.includes('<comma>')) fail(`${song.id}: decoded lyric still contains <comma>`)
    if (event.rawText !== undefined) {
      decodedCommaLyrics += 1
      if (!event.rawText.includes('<comma>') ||
          event.text !== event.rawText.replaceAll('<comma>', ',')) {
        fail(`${song.id} @ ${event.time}: rawText must preserve only the decoded <comma> source`)
      }
    }
    if (/[<>]/.test(event.text)) preservedAngleLyrics += 1
  }
}

for (const code of ['drvalv', 'byndtd', 'grwsml']) {
  const base = songs.find(item => item.songCode === code && !item.variant)
  if (base?.vocalSetting?.mode !== 'formation-or-all-stars') {
    fail(`${code}: base choreography must expose Formation / 315 ALL STARS setting`)
  }
  const units = songs.filter(item => item.songCode === code && item.vocalSetting?.mode === 'unit')
  if (units.length !== 16 || units.some(item => !item.vocalSetting?.unitCode)) {
    fail(`${code}: expected 16 labelled Unit choreography variants`)
  }
  for (const variant of ['solo', 'solo_multi', 'solo_single']) {
    const song = songs.find(item => item.songCode === code && item.variant === variant)
    if (!song) fail(`${code}/${variant}: Solo choreography is missing`)
    if (song.vocalSetting?.mode !== 'center' || song.vocalSetting?.rawVariant !== variant) {
      fail(`${code}/${variant}: Solo candidate must be labelled as Center with its RAW name`)
    }
    if (JSON.stringify(song.positions) !== JSON.stringify([3])) {
      fail(`${code}/${variant}: only canonical center stage position 3 may be visible`)
    }
    if (JSON.stringify(song.onStagePerformerSlots) !== JSON.stringify([1])) {
      fail(`${code}/${variant}: RAW performer slot 1 must be the sole on-stage performer`)
    }
    const centerMap = (song.stagePositionMap || [])
      .find(item => Number(item.performerSlot) === 1)
    if (Number(centerMap?.stagePosition) !== 3) {
      fail(`${code}/${variant}: RAW performer slot 1 must map to canonical stage position 3`)
    }
    for (const event of song.singerEvents || []) {
      if (JSON.stringify(event.stagePositions) !== JSON.stringify([3]) ||
          JSON.stringify(event.performerSlots) !== JSON.stringify([1])) {
        fail(`${code}/${variant} @ ${event.time}: Solo singer must remain center performer slot 1`)
      }
    }
  }
}

if (!decodedCommaLyrics) fail('no <comma> lyric placeholders were decoded')
if (!preservedAngleLyrics) fail('authored angle-bracket lyric text was not preserved')

for (const code of ['tkstp1', 'tkstp2']) {
  const song = songs.find(item => item.songCode === code && !item.variant)
  if (!song) fail(`${code}: base Chibi choreography missing`)
  const map = (song.stagePositionMap || []).map(item => Number(item.stagePosition))
  if (JSON.stringify(map) !== JSON.stringify([3, 2, 4, 1, 5])) {
    fail(`${code}: expected five-slot stage map [3,2,4,1,5]`)
  }
  if (code === 'tkstp1') {
    const secondLine = song.singerEvents.find(event => Number(event.time) === 7717)
    const victoryLine = song.singerEvents.find(event => Number(event.time) === 12315)
    if (JSON.stringify(secondLine?.stagePositions) !== JSON.stringify([3]) ||
        JSON.stringify(secondLine?.performerSlots) !== JSON.stringify([1])) {
      fail('tkstp1 @ 7717: expected RAW stage 3 / center performer slot 1')
    }
    if (JSON.stringify(victoryLine?.stagePositions) !== JSON.stringify([4, 5]) ||
        JSON.stringify(victoryLine?.performerSlots) !== JSON.stringify([3, 5])) {
      fail('tkstp1 @ 12315: expected RAW stages 4+5 / performer slots 3+5')
    }
  }
  const timelines = new Map()
  for (const event of song.events || []) {
    const position = Number(event.stagePosition ?? event.position)
    const timeline = timelines.get(position) || []
    timeline.push([event.time, event.motion, event.speed, event.mode])
    timelines.set(position, timeline)
  }
  const signatures = new Set([...timelines.values()].map(timeline => JSON.stringify(timeline)))
  if (timelines.size !== 5 || signatures.size !== 1) {
    fail(`${code}: five stage positions must share one motion timeline`)
  }
}

console.log(`Chibi singer-slot mapping verified: ${songs.length} scripts, ${singerEvents} singer events, ${decodedCommaLyrics} decoded <comma> lyrics`)
