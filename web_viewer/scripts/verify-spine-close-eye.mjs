import assert from 'node:assert/strict'
import fs from 'node:fs'
import { SkeletonBinary, Skeleton, AnimationState, AnimationStateData, RegionAttachment, MeshAttachment, BoundingBoxAttachment, PathAttachment, PointAttachment, ClippingAttachment } from '@pixi-spine/runtime-3.8'
import { PixiStageManager } from '../src/core/PixiStageManager.js'

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
const skeleton = new Skeleton(data)
const state = new AnimationState(new AnimationStateData(data))
const spine = { state, skeleton }
const stage = Object.create(PixiStageManager.prototype)
stage.spineInstances = { '002sht': { modelId: '002sht_002_00', spine } }

const attachment = slot => skeleton.findSlot(slot)?.getAttachment()?.name || null
const step = () => { state.update(1 / 30); state.apply(skeleton) }

// idol_face [3] = "目": eyes open.
stage.updateSpineFace('002sht', 'default', { anim_flag: '目', blush_flag: 'off', sweat_flag: 'off' })
step()
const openEyeball = attachment('eyeball_L')
assert.ok(openEyeball, 'open eyes show the eyeball')
assert.equal(attachment('eyeclosed_L'), null)
// idol_face [3] = "off": client isEyeOff -> PlayCloseEye holds eye_close.
stage.updateSpineFace('002sht', 'happy', { anim_flag: 'off', blush_flag: 'off', sweat_flag: 'off' })
for (let i = 0; i < 10; i++) step()
assert.equal(attachment('eyeclosed_L'), 'eyeclosed_L')
assert.equal(attachment('eyeball_L'), null, 'eye_close hides the eyeball while held')
// Back to "目": ResetCloseEye restores the open-eye attachments.
stage.updateSpineFace('002sht', 'default', { anim_flag: '目', blush_flag: 'off', sweat_flag: 'off' })
for (let i = 0; i < 3; i++) step()
assert.equal(attachment('eyeclosed_L'), null)
assert.equal(attachment('eyeball_L'), openEyeball)
console.log('Spine close eye: idol_face "off" holds eye_close on track 4 and "目" restores the open eyes (real 002sht skeleton)')
