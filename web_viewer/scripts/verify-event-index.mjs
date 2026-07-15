import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const eventIndex = JSON.parse(await readFile(new URL('../public/data/masterdata/event_index.json', import.meta.url), 'utf8'))
const notAlone = eventIndex.by_code['10001']

assert.equal(eventIndex.meta.event_count, 59)
assert.equal(notAlone.name, 'GROWING SIGN@L -Not Alone-')
assert.equal(notAlone.event_type_label, 'theater')
assert.equal(notAlone.start_at, 1633845600)
assert.equal(notAlone.end_at, 1634472000)
assert.equal(notAlone.story_chapter_id, 410001)

const directPointCards = notAlone.point_reward_cards.filter(reward => reward.reward_kind === 'card')
assert.deepEqual(directPointCards.map(reward => [reward.card_resource_id, reward.required_points]), [
  ['048mom_sr02', 25000],
  ['047shu_sr02', 53000],
])
assert.ok(notAlone.point_reward_cards.some(reward =>
  reward.card_resource_id === '049eis_r02' &&
  reward.reward_kind === 'card_fragment' &&
  reward.required_points === 8400,
))
assert.ok(notAlone.story_reward_cards.some(reward =>
  reward.card_resource_id === '049eis_r02' &&
  reward.episode_title === 'エピソード10' &&
  reward.availability === 'in_event_term',
))

console.log(`event index verified: ${eventIndex.meta.event_count} events`)
