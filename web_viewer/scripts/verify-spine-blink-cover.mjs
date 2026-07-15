import assert from 'node:assert/strict'
import { cancelBlinkCover } from '../src/core/spineBlinkCover.js'

const attachments = new Map([
  ['eyewhite', null],
  ['eyeline', null],
  ['eyelid_close', 'eyelid_close'],
])
const spine = {
  _blinkCfg: { show: [{ slot: 'eyelid_close', att: 'eyelid_close' }] },
  _savedEyeAtts: { eyewhite: 'eyewhite_default', eyeline: 'eyeline_default' },
  _blinkCoverEndTime: 1000,
  skeleton: {
    setAttachment(slot, attachment) { attachments.set(slot, attachment) },
  },
}

assert.equal(cancelBlinkCover(spine), true)
assert.equal(attachments.get('eyewhite'), 'eyewhite_default')
assert.equal(attachments.get('eyeline'), 'eyeline_default')
assert.equal(attachments.get('eyelid_close'), null)
assert.equal(spine._savedEyeAtts, null)
assert.equal(spine._blinkCoverEndTime, undefined)
assert.equal(cancelBlinkCover(spine), false)

console.log('Spine blink cover verified: interrupted transitions restore open-eye attachments.')
