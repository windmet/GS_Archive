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
for (const song of songs) {
  const stageMap = new Map((song.stagePositionMap || [])
    .map(item => [Number(item.performerSlot), Number(item.stagePosition)]))
  for (const event of song.singerEvents || []) {
    singerEvents += 1
    if (!Array.isArray(event.performerSlots) || !Array.isArray(event.stagePositions)) {
      fail(`${song.id}: singer event must preserve performerSlots and stagePositions`)
    }
    const expected = event.performerSlots
      .map(slot => stageMap.get(Number(slot)) ?? Number(slot))
      .sort((left, right) => left - right)
    const actual = event.stagePositions.map(Number).sort((left, right) => left - right)
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      fail(`${song.id} @ ${event.time}: singer slot/stage mapping mismatch`)
    }
  }
}

for (const code of ['tkstp1', 'tkstp2']) {
  const song = songs.find(item => item.songCode === code && !item.variant)
  if (!song) fail(`${code}: base Chibi choreography missing`)
  const map = (song.stagePositionMap || []).map(item => Number(item.stagePosition))
  if (JSON.stringify(map) !== JSON.stringify([3, 2, 4, 1, 5])) {
    fail(`${code}: expected five-slot stage map [3,2,4,1,5]`)
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

console.log(`Chibi singer-slot mapping verified: ${songs.length} scripts, ${singerEvents} singer events`)
