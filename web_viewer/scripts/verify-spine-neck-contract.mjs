import assert from 'node:assert/strict'
import { Animation, AttachmentTimeline, ColorTimeline, RotateTimeline } from '@pixi-spine/runtime-3.8'
import { neckOverlayAnimation } from '../src/core/spineNeckOverlay.js'
const face = new AttachmentTimeline(1); face.slotIndex = 0; face.setFrame(0, 0, 'closed')
const neutral = new AttachmentTimeline(1); neutral.slotIndex = 0; neutral.setFrame(0, 0, 'open')
const tint = new ColorTimeline(1); tint.slotIndex = 0; tint.setFrame(0, 0, 1, 1, 1, 1)
const prop = new AttachmentTimeline(1); prop.slotIndex = 1; prop.setFrame(0, 0, 'prop')
const rotation = new RotateTimeline(1); rotation.boneIndex = 0; rotation.setFrame(0, 0, 12)
const neck = new Animation('neck_question', [neutral, tint, prop, rotation], 1.6)
const data = { animations: [new Animation('face_happy', [face], 0), neck] }
const overlay = neckOverlayAnimation(neck, data)
assert.deepEqual(overlay.timelines, [prop, rotation])
assert.equal(overlay.duration, 1.6)
assert.equal(neck.timelines.length, 4)
assert.equal(neckOverlayAnimation(neck, data), overlay)
console.log('Neck contract: face-owned slots excluded; prop, motion, duration and source retained')
