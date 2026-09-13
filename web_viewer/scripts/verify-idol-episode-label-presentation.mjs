import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { presentIdolEpisodeLabel } from '../src/presentation/idolEpisodeLabel.js'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
assert.equal(presentIdolEpisodeLabel({ sourceName: 'スモールトーク1' }), 'SMALL TALK 01')
assert.equal(presentIdolEpisodeLabel({ sourceName: 'エピソード5' }), 'EPISODE 05')
assert.equal(presentIdolEpisodeLabel({ sourceName: 'source', kind: 'small_talk', ordinal: 3 }), 'SMALL TALK 03')
assert.equal(presentIdolEpisodeLabel({ sourceName: 'source', kind: 'episode', ordinal: 12 }), 'EPISODE 12')
assert.equal(presentIdolEpisodeLabel({ sourceName: '第1話' }), '第1話')
assert.equal(presentIdolEpisodeLabel({ sourceName: '不明な表記' }), '不明な表記')
assert.equal(presentIdolEpisodeLabel({}), '')

const raw = read('public/data/masterdata/idol_episode_index.json')
const index = JSON.parse(raw)
let normalized = 0
for (const chapter of index.chapters) {
  for (const section of chapter.sections) {
    for (const episode of section.episodes) {
      const display = presentIdolEpisodeLabel({ sourceName: episode.name })
      if (episode.name.startsWith('スモールトーク')) assert.match(display, /^SMALL TALK \d{2}$/)
      else if (episode.name.startsWith('エピソード')) assert.match(display, /^EPISODE \d{2}$/)
      else assert.equal(display, episode.name)
      normalized += display !== episode.name ? 1 : 0
    }
  }
}
assert.ok(normalized > 0)
assert.equal(read('public/data/masterdata/idol_episode_index.json'), raw, 'source catalog stays byte-identical')
for (const file of ['ArchiveIdolStory.vue', 'ArchiveStoryCollection.vue', 'ArchiveMobileArchive.vue', 'ArchiveStoryReader.vue', 'ArchiveStoryDetail.vue', 'ArchiveStoryCatalog.vue']) {
  assert.match(read(`src/components/archive/${file}`), /presentIdolEpisodeLabel/, `${file} consumes the shared presenter`)
}
console.log(`Idol episode label presentation: ${normalized} real labels, birthday relation and Reader UI wiring passed`)
