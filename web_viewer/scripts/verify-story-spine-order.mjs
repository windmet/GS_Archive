import assert from 'node:assert/strict'
import { storySpineOrder } from '../src/core/StorySpineOrder.js'
const trio = [{ id: '038tak' }, { id: '039mcr', idol_priority: 1 }, { id: '040ren' }]
assert.deepEqual(storySpineOrder(trio), ['039mcr', '038tak', '040ren'], 'THE KOGADO ep6 step30: Michiru behind both fighters')
assert.deepEqual(trio.map(s => s.id), ['038tak', '039mcr', '040ren'], 'source roster is unchanged')
assert.deepEqual(storySpineOrder([{ id: 'a', idol_priority: 2 }, { id: 'b', idol_priority: 3 }, { id: 'c', idol_priority: 2 }]), ['b', 'a', 'c'])
console.log('Story priority depth verified: back-to-front projection and stable equal-depth order')
