// Native UpdateLip semantics (client 2.6.10) on a fake skeleton: bone scales, slot attachments, curve timing.
import assert from 'node:assert/strict'
import { LipSyncController } from '../src/core/LipSyncController.js'
import { sampleLipScale } from '../src/utils/LipSyncHelpers.js'
import { SPINE_TRACK } from '../src/core/spineTracks.js'

const slotNames = ['mouth', 'mouth_clip', 'tooth_top', 'tooth_bottom', 'tongue']
const slots = slotNames.map(name => ({ name, attachment: 'initial', setAttachment(value) { this.attachment = value } }))
const bone = { scaleX: 9, scaleY: 9 }
const skeleton = {
  slots,
  findBone: name => name === 'mouth' ? bone : null,
  findSlotIndex: name => slotNames.indexOf(name),
  getAttachment: (index, name) => `${slotNames[index]}:${name}`,
  updateWorldTransform() {},
}
const tracks = []
tracks[SPINE_TRACK.face] = { animation: { name: 'face_default' } }
const spine = { skeleton, state: { tracks }, destroyed: false }
const info = {
  animationName: 'face_default', turnOffLipSync: false, openMouthScale: 2, closeMouthScale: 1.5,
  openMouthAttachmentName: 'open', closeMouthAttachmentName: 'closed', openMouthClipAttachmentName: 'clip',
  upperTeethAttachmentName: 'upper', lowerTeethAttachmentName: '', tongueAttachmentName: 'tongue',
  attachmentsWhenOpenMouth: [], attachmentsWhenCloseMouth: [{ slotName: 'tongue', attachmentName: 'shut' }],
}
spine._mouthData = { mouthes: [info, { ...info, animationName: 'face_off', turnOffLipSync: true }] }
const controller = new LipSyncController({ getSpineEntry: id => id === 'idol' ? { spine, modelId: 'idol_001_00' } : null })
let sample = null
controller.setTalking('idol', true, () => sample)
const frame = () => skeleton.updateWorldTransform()

sample = { x: 0.8, y: 0.5 }; frame()
assert.deepEqual([bone.scaleY, bone.scaleX], [0.8, 1], 'open: scaleY = x, scaleX = y * openMouthScale')
assert.deepEqual(slots.map(s => s.attachment), ['mouth:open', 'mouth_clip:clip', 'tooth_top:upper', null, 'tongue:tongue'], 'open attachments, empty name = none')

sample = { x: 1, y: 0 }; frame()
assert.deepEqual([bone.scaleY, bone.scaleX], [1, 1.5], 'closed: scaleY 1, scaleX closeMouthScale')
assert.deepEqual(slots.map(s => s.attachment), ['mouth:closed', null, null, null, 'tongue:shut'], 'closed attachments clear clip, teeth and tongue')

tracks[SPINE_TRACK.face] = { animation: { name: 'face_off' } }
bone.scaleX = bone.scaleY = 7; sample = { x: 0.8, y: 0.5 }; frame()
assert.deepEqual([bone.scaleY, bone.scaleX], [7, 7], 'turnOffLipSync leaves the rig untouched')

tracks[SPINE_TRACK.face] = { animation: { name: 'face_unknown' } }; frame()
assert.deepEqual([bone.scaleY, bone.scaleX], [7, 7], 'no MouthInfo leaves the rig untouched')

tracks[SPINE_TRACK.face] = null; tracks[SPINE_TRACK.body] = { animation: { name: 'face_default' } }; frame()
assert.equal(bone.scaleY, 0.8, 'body animation is the fallback key')

// Curve timing: 60 fps samples from 0.1 s, no interpolation, closed once the curve ends.
const scales = Array.from({ length: 60 }, (_, i) => ({ x: 1, y: i / 100 }))
assert.deepEqual(sampleLipScale({ scales }, 0), { x: 1, y: 0.06 })
assert.deepEqual(sampleLipScale({ scales }, 0.2), { x: 1, y: 0.18 })
assert.equal(sampleLipScale({ scales }, 0.9), null)
console.log('Native lip sync: bone scales, open/closed attachments, turnOff/missing info, fallback key, curve timing')
