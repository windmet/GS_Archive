import assert from 'node:assert/strict'
import { getSceneIconUrl } from '../src/utils/AssetResolver.js'
import { storyAssetAdapter } from '../src/utils/StoryAssetAdapters.js'
assert.equal(getSceneIconUrl('01jup'), '/assets/units/logos/image_unit_logo_01jup.png')
assert.equal(getSceneIconUrl('003hok'), '/assets/idols/icons/image_chara_icon_003hok.png')
for (const id of ['01jup', '003hok']) assert.equal(storyAssetAdapter({kind:'image-icon',id}).url, getSceneIconUrl(id))
console.log('Scene icon routing verified: unit logo and idol portrait share preload/runtime resolution')
