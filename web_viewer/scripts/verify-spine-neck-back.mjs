import assert from 'node:assert/strict'
import fs from 'node:fs'
import { SkeletonBinary, AnimationState, AnimationStateData, RegionAttachment, MeshAttachment, BoundingBoxAttachment, PathAttachment, PointAttachment, ClippingAttachment } from '@pixi-spine/runtime-3.8'
import { MixBlend } from '@pixi-spine/base'
import { SpineManager } from '../src/core/SpineManager.js'

class DiagnosticAttachmentLoader {
  newRegionAttachment(_skin, name) { return new RegionAttachment(name) }
  newMeshAttachment(_skin, name) { return new MeshAttachment(name) }
  newBoundingBoxAttachment(_skin, name) { return new BoundingBoxAttachment(name) }
  newPathAttachment(_skin, name) { return new PathAttachment(name) }
  newPointAttachment(_skin, name) { return new PointAttachment(name) }
  newClippingAttachment(_skin, name) { return new ClippingAttachment(name) }
}

const bytes = fs.readFileSync(new URL('../public/assets/spines/002sht_002_00/comu.skel', import.meta.url))
const len = bytes.readUInt32LE(0)
const offset = 4 + len + ((4 - (4 + len) % 4) % 4) + 4
const data = new SkeletonBinary(new DiagnosticAttachmentLoader()).readSkeletonData(new Uint8Array(bytes.subarray(offset)))
const names = data.animations.map(animation => animation.name)
const expectedBack = ['neck_back', 'neck_back_lookup'].find(name => names.includes(name))
assert.ok(expectedBack, 'fixture skeleton has a lookup back animation')

const state = new AnimationState(new AnimationStateData(data))
const manager = new SpineManager({ spineInstances: { '002sht': { modelId: '002sht_002_00', spine: { state } } } })
const sequence = () => {
  const out = []
  for (let entry = state.getCurrent(3); entry; entry = entry.next) out.push([entry.animation.name, entry.mixBlend])
  return out
}

// Plain neck motion: set directly, additive.
manager.playSpineNeckAnim('002sht', 'neck_lookup')
assert.deepEqual(sequence().map(([name]) => name), ['neck_lookup'])
// Leaving the held lookup pose: client PlayNeckInternal plays its back animation
// (first available of neck_back / neck_back_lookup, mix 0.25 s), then queues the new neck.
manager.playSpineNeckAnim('002sht', 'neck_yes')
assert.deepEqual(sequence(), [[expectedBack, MixBlend.add], ['neck_yes', MixBlend.add]])
assert.equal(state.getCurrent(3).mixDuration, 0.25)
// neck_yes is not a held pose: the next neck is set directly.
manager.playSpineNeckAnim('002sht', 'neck_no')
assert.deepEqual(sequence().map(([name]) => name), ['neck_no'])
// After a reset (ResetNeck / motion entry without neck) there is no held pose to leave.
manager.playSpineNeckAnim('002sht', 'neck_lookup')
manager.stopSpineNeckAnim('002sht')
manager.playSpineNeckAnim('002sht', 'neck_question')
assert.deepEqual(sequence().map(([name]) => name), ['neck_question'])
console.log(`Spine neck back: held lookup/question poses leave through ${expectedBack} (mix 0.25 s, additive); plain and reset necks set directly`)
