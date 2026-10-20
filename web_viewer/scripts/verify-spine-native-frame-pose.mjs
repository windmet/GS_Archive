import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  SkeletonBinary, Skeleton, AnimationState, AnimationStateData,
  RegionAttachment, MeshAttachment, BoundingBoxAttachment, PathAttachment, PointAttachment, ClippingAttachment,
} from '@pixi-spine/runtime-3.8'
import { decodeUnitySpineSkeleton } from '../shared/story/SpineBinary.js'
import { SpineManager } from '../src/core/SpineManager.js'
import { SPINE_TRACK } from '../src/core/spineTracks.js'
import { installNativeFramePose } from '../src/core/spineFramePose.js'
import { faceEffectSlots, hideFaceEffects } from '../src/core/spineFaceEffects.js'

// Client SkeletonGraphic.Update resets the skeleton to the setup pose before every
// Apply; IdolFigureSkeleton.UpdateLocal then clears hidden cheek/sweat slots.
// Real 039mcr skeleton: its eye whites are weighted to eyelash_L/R, whose scale
// only the additive neck clips key.
class DiagnosticAttachmentLoader {
  newRegionAttachment(_skin, name) { return new RegionAttachment(name) }
  newMeshAttachment(_skin, name) { return new MeshAttachment(name) }
  newBoundingBoxAttachment(_skin, name) { return new BoundingBoxAttachment(name) }
  newPathAttachment(_skin, name) { return new PathAttachment(name) }
  newPointAttachment(_skin, name) { return new PointAttachment(name) }
  newClippingAttachment(_skin, name) { return new ClippingAttachment(name) }
}
const bytes = fs.readFileSync(new URL('../public/assets/spines/039mcr_001_00/comu.skel', import.meta.url))
const skel = decodeUnitySpineSkeleton(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
const data = new SkeletonBinary(new DiagnosticAttachmentLoader()).readSkeletonData(new Uint8Array(skel))

function createIdol() {
  const skeleton = new Skeleton(data)
  const stateData = new AnimationStateData(data)
  stateData.defaultMix = 0
  const spine = { skeleton, stateData, state: new AnimationState(stateData) }
  spine._faceEffectSlots = faceEffectSlots(skeleton)
  installNativeFramePose(spine, () => hideFaceEffects(spine._faceEffectSlots, spine._faceFlags))
  spine.state.setAnimation(SPINE_TRACK.body, 'wait_loop', true)
  spine.state.setAnimation(SPINE_TRACK.face, 'face_default', true)
  const manager = new SpineManager({ spineInstances: { idol: { spine, modelId: '039mcr_001_00' } } })
  const run = (seconds) => {
    for (let t = 0; t < seconds - 1e-9; t += 1 / 60) {
      spine.state.update(1 / 60)
      spine.state.apply(skeleton)
      skeleton.updateWorldTransform()
    }
  }
  return { spine, skeleton, manager, run }
}
const bone = (skeleton, name) => skeleton.findBone(name)
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-4, `${message}: ${actual} != ${expected}`)

// neck_lookup holds its last key (eyelash scaleX 0.95, chara_MIX y -1). Added once
// per frame on top of the setup pose, it must stay there however long it is held.
{
  const idol = createIdol()
  const reference = createIdol()
  idol.manager.playSpineNeckAnim('idol', 'neck_lookup', 'step:1:event:0')
  idol.run(4)
  reference.run(4)
  for (const name of ['eyelash_L', 'eyelash_R']) {
    close(bone(idol.skeleton, name).scaleX, 0.95 * bone(idol.skeleton, name).data.scaleX, `${name} held neck scale`)
  }
  close(bone(idol.skeleton, 'chara_MIX').y, bone(reference.skeleton, 'chara_MIX').y - 1, 'chara_MIX held neck offset')

  idol.manager.stopSpineNeckAnim('idol', 'step:2:event:0')
  idol.run(1 / 60)
  reference.run(1 / 60)
  for (const name of ['eyelash_L', 'eyelash_R', 'chara_MIX', 'neck']) {
    const actual = bone(idol.skeleton, name), expected = bone(reference.skeleton, name)
    for (const key of ['x', 'y', 'rotation', 'scaleX', 'scaleY']) close(actual[key], expected[key], `${name}.${key} after neck stop`)
  }
}

// idol_face blush/sweat flags: "off" clears the "cheek"/"swet" slots after Apply,
// any other value leaves what the face clip and setup pose show.
{
  const effects = faceEffectSlots(createIdol().skeleton)
  assert.deepEqual(effects.cheek.map(slot => slot.data.name), ['cheek_R', 'cheek_L'])
  assert.ok(effects.sweat.length > 0 && effects.sweat.every(slot => slot.data.name.startsWith('swet')))
  const fake = { slots: ['cheek dye_L', 'swet_1', 'sweater_L', 'sweat1', 'head_blush'].map(name => ({ data: { name } })) }
  const names = faceEffectSlots(fake)
  assert.deepEqual(names.cheek.map(slot => slot.data.name), ['cheek dye_L'])
  assert.deepEqual(names.sweat.map(slot => slot.data.name), ['swet_1'], 'client prefix is "swet": sweater/sweat slots are not sweat effects')

  const idol = createIdol()
  idol.spine.state.setAnimation(SPINE_TRACK.face, 'face_swet', true)
  const visible = () => ({
    cheek: idol.spine._faceEffectSlots.cheek.filter(slot => slot.attachment).length,
    sweat: idol.spine._faceEffectSlots.sweat.filter(slot => slot.attachment).length,
  })
  idol.spine._faceFlags = { anim_flag: '目', blush_flag: 'チーク', sweat_flag: '汗' }
  idol.run(0.5)
  const shown = visible()
  assert.ok(shown.cheek > 0 && shown.sweat > 0, `cheek and sweat show when flagged on: ${JSON.stringify(shown)}`)
  idol.spine._faceFlags = { anim_flag: '目', blush_flag: 'off', sweat_flag: 'off' }
  idol.run(1 / 60)
  assert.deepEqual(visible(), { cheek: 0, sweat: 0 }, '"off" hides cheek and sweat')
  idol.spine._faceFlags = { anim_flag: '目', blush_flag: 'チーク', sweat_flag: '汗' }
  idol.run(1 / 60)
  assert.deepEqual(visible(), shown, 'turning the flags back on restores the attachments on the next frame')
}

console.log('Spine native frame pose: setup pose before every Apply (neck offsets bounded and cleared on stop) and cheek/swet hiding (real 039mcr skeleton)')
