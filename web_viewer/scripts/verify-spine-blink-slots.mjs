import assert from 'node:assert/strict'
import { detectBlinkSlots } from '../src/core/spineBlinkSlots.js'

function createSpine(slotNames, attachmentNames) {
  const attachments = attachmentNames.map(({ slot, name }) => ({ slotIndex: slotNames.indexOf(slot), name }))
  return {
    skeleton: {
      data: {
        slots: slotNames.map(name => ({ name })),
        findSlotIndex: name => slotNames.indexOf(name),
        defaultSkin: {
          getAttachments: () => attachments,
          getAttachment: (index, name) => attachments.find(item => item.slotIndex === index && item.name === name) || null,
        },
      },
      getAttachment: () => null,
    },
  }
}

const touma = createSpine(
  ['eyewhite_R', 'eyeball_R', 'eyeclosed_R', 'eyewhite_L', 'eyeball_L', 'eyeclosed_L'],
  [{ slot: 'eyeclosed_R', name: 'eyeclosed_R' }, { slot: 'eyeclosed_L', name: 'eyeclosed_L' }],
)
const config = detectBlinkSlots(touma)
assert.deepEqual(config.show, [
  { slot: 'eyeclosed_R', att: 'eyeclosed_R' },
  { slot: 'eyeclosed_L', att: 'eyeclosed_L' },
])
assert.deepEqual(config.hide, ['eyewhite_R', 'eyeball_R', 'eyewhite_L', 'eyeball_L'])

const incomplete = createSpine(
  ['eyewhite_R', 'eyeclosed_R', 'eyewhite_L', 'eyeclosed_L'],
  [{ slot: 'eyeclosed_R', name: 'eyeclosed_R' }],
)
assert.equal(detectBlinkSlots(incomplete), null)

console.log('Spine blink slots verified: paired eyeclosed attachments are required.')
