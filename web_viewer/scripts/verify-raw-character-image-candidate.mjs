import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  RAW_CHARACTER_IMAGE_CANDIDATE_KINDS,
  birthdayStoryIdolCode,
  getRawCharacterImageCandidateUrl,
  getPromotedCharacterImageUrl,
  hasRawCharacterImageCandidate,
} from '../src/utils/CharacterImageResolver.js'

assert.deepEqual(RAW_CHARACTER_IMAGE_CANDIDATE_KINDS, [
  'birthday_visual',
  'event_story_visual',
  'mobile_bustup',
  'name_plate',
  'sign',
  'story_visual',
])

const enabled = '?raw_character_candidate=birthday_visual%3A001tom'
assert.equal(
  getRawCharacterImageCandidateUrl('birthday_visual', '001tom', enabled),
  '/assets/character-candidate/birthday_visual/001tom.png',
)
assert.equal(
  birthdayStoryIdolCode({
    file: '1_x_002sht_2_1_2_002_12.json',
    characters: ['001tom', '002sht', '003hok'],
  }),
  '002sht',
)
assert.equal(
  birthdayStoryIdolCode({ characters: ['001tom'] }),
  '001tom',
)
assert.equal(
  birthdayStoryIdolCode({ characters: ['001tom', '002sht'] }),
  '',
)
assert.equal(
  hasRawCharacterImageCandidate('birthday_visual', '001tom', enabled),
  true,
)
assert.equal(
  getRawCharacterImageCandidateUrl('birthday_visual', '002sht', enabled),
  '',
)
assert.equal(
  getRawCharacterImageCandidateUrl('unknown', '001tom', enabled),
  '',
)
assert.equal(
  getRawCharacterImageCandidateUrl('birthday_visual', '../RAW', enabled),
  '',
)
assert.equal(
  getPromotedCharacterImageUrl('birthday_visual', '001tom', {
    entries: [{
      kind: 'birthday_visual',
      idol_code: '001tom',
      asset_url: '/assets/stories/birthday/image_chara_birthday_visual_001tom.png',
    }],
  }),
  '/assets/stories/birthday/image_chara_birthday_visual_001tom.png',
)
assert.equal(
  getPromotedCharacterImageUrl('birthday_visual', '002sht', { entries: [] }),
  '',
)

const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
assert.match(appSource, /story\.domain === 'birthday'/)
assert.match(
  appSource,
  /birthdayStoryIdolCode\(story\)/,
)
assert.match(appSource, /getPromotedCharacterImageUrl/)

const viteSource = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8')
assert.match(viteSource, /rawCharacterImageCandidatePlugin\(\)/)
assert.match(viteSource, /CHARACTER_IMAGE_CANDIDATE_KINDS\.has\(kind\)/)
assert.match(viteSource, /Cache-Control', 'no-store'/)

console.log('RAW character-image candidate: explicit query gate and bounded Vite route verified')
