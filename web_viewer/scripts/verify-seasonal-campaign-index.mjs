import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const source = path.join(root, 'public', 'data', 'masterdata', 'seasonal_campaign_index.json')
const data = JSON.parse(fs.readFileSync(source, 'utf8'))

const failures = []
const assert = (condition, message) => {
  if (!condition) failures.push(message)
}

assert(data.schema_version === 1, 'schema_version must be 1')
assert(data.meta?.campaign_count === 4, 'expected four seasonal campaigns')
assert(data.meta?.cycle_count === 2, 'expected two Valentine/White Day cycles')
assert(data.meta?.raw_episode_count === 306, 'expected 306 raw episode rows')
assert(data.meta?.playback_entity_count === 208, 'expected 208 normalized playback entities')

for (const year of [2022, 2023]) {
  const valentine = data.by_id?.[`valentine_${year}`]
  const whiteDay = data.by_id?.[`white_day_${year}`]
  assert(valentine?.paired_campaign_id === `white_day_${year}`, `missing Valentine ${year} pair`)
  assert(whiteDay?.paired_campaign_id === `valentine_${year}`, `missing White Day ${year} pair`)

  for (const campaign of [valentine, whiteDay].filter(Boolean)) {
    assert(campaign.participants?.length === 51, `${campaign.id} must have 51 participants`)
    assert(campaign.playback_entity_count === 52, `${campaign.id} must have 52 playback entities`)
    const missing = [
      ...(campaign.introduction || []),
      ...(campaign.participants || []).flatMap(participant => participant.episodes || []),
    ].filter(episode => !episode.compiled_exists)
    assert(missing.length === 0, `${campaign.id} has ${missing.length} missing compiled resources`)
  }
}

if (failures.length) {
  console.error('Seasonal campaign index verification failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Seasonal campaign index verified: 4 campaigns, 2 cycles, 208 playback entities, 0 missing resources.')
