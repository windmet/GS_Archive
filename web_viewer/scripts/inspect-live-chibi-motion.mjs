import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

import { BinaryInput, MixBlend, MixDirection } from '@pixi-spine/base'
import {
  BoundingBoxAttachment,
  ClippingAttachment,
  MeshAttachment,
  PathAttachment,
  PointAttachment,
  RegionAttachment,
  Skeleton,
  SkeletonBinary,
  Skin,
} from '@pixi-spine/runtime-3.8'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assetRoot = path.join(repoRoot, 'public', 'assets', 'live-chibi')

class DiagnosticAttachmentLoader {
  newRegionAttachment(_skin, name) { return new RegionAttachment(name) }
  newMeshAttachment(_skin, name) { return new MeshAttachment(name) }
  newBoundingBoxAttachment(_skin, name) { return new BoundingBoxAttachment(name) }
  newPathAttachment(_skin, name) { return new PathAttachment(name) }
  newPointAttachment(_skin, name) { return new PointAttachment(name) }
  newClippingAttachment(_skin, name) { return new ClippingAttachment(name) }
}

function readSetupStringTable(bytes) {
  const input = new BinaryInput(bytes)
  input.readString()
  input.readString()
  input.readFloat()
  input.readFloat()
  input.readFloat()
  input.readFloat()
  const nonessential = input.readBoolean()
  if (nonessential) {
    input.readFloat()
    input.readString()
    input.readString()
  }
  const count = input.readInt(true)
  return Array.from({ length: count }, () => input.readString())
}

function summarizeAnimation(animation) {
  const timelineTypes = {}
  for (const timeline of animation.timelines) {
    const name = timeline.constructor.name
    timelineTypes[name] = (timelineTypes[name] || 0) + 1
  }
  return {
    name: animation.name,
    durationSeconds: Number(animation.duration.toFixed(6)),
    timelineCount: animation.timelines.length,
    timelineTypes,
  }
}

function inspectMotion(bodyType, motionId) {
  const setupPath = path.join(assetRoot, 'setup', `body-${bodyType}.skel`)
  const motionPath = path.join(assetRoot, 'motions', 'choreography', String(bodyType), `${motionId}.motion`)
  const setupBytes = fs.readFileSync(setupPath)
  const skeletonBinary = new SkeletonBinary(new DiagnosticAttachmentLoader())
  const skeletonData = skeletonBinary.readSkeletonData(setupBytes)
  const input = new BinaryInput(fs.readFileSync(motionPath), readSetupStringTable(setupBytes))
  const animationCount = input.readInt(true)
  const animations = []
  for (let index = 0; index < animationCount; index += 1) {
    const name = input.readString()
    animations.push(summarizeAnimation(skeletonBinary.readAnimation(input, name, skeletonData)))
  }
  return { bodyType, motionId, animationCount, animations }
}

function parseAnimations(skeletonBinary, skeletonData, setupBytes, bodyType, motionId, motionBytes) {
  const motionPath = path.join(assetRoot, 'motions', 'choreography', String(bodyType), `${motionId}.motion`)
  const input = new BinaryInput(motionBytes ?? fs.readFileSync(motionPath), readSetupStringTable(setupBytes))
  const animationCount = input.readInt(true)
  return Array.from({ length: animationCount }, () => {
    const name = input.readString()
    return skeletonBinary.readAnimation(input, name, skeletonData)
  })
}

function bonePose(skeleton) {
  return skeleton.bones.map(bone => [bone.x, bone.y, bone.rotation, bone.scaleX, bone.scaleY])
}

function poseDelta(left, right) {
  let sum = 0
  let max = 0
  let count = 0
  for (let bone = 0; bone < left.length; bone += 1) {
    for (let value = 0; value < left[bone].length; value += 1) {
      const delta = Math.abs(left[bone][value] - right[bone][value])
      sum += delta * delta
      max = Math.max(max, delta)
      count += 1
    }
  }
  return { rms: Number(Math.sqrt(sum / count).toFixed(6)), max: Number(max.toFixed(6)) }
}

function inspectTransition(bodyType, fromMotionId, fromTime, toMotionId, fromAnimationIndex = 0) {
  const setupBytes = fs.readFileSync(path.join(assetRoot, 'setup', `body-${bodyType}.skel`))
  const skeletonBinary = new SkeletonBinary(new DiagnosticAttachmentLoader())
  const skeletonData = skeletonBinary.readSkeletonData(setupBytes)
  const from = parseAnimations(skeletonBinary, skeletonData, setupBytes, bodyType, fromMotionId)[fromAnimationIndex]
  const to = parseAnimations(skeletonBinary, skeletonData, setupBytes, bodyType, toMotionId)[0]
  const skeleton = new Skeleton(skeletonData)
  from.apply(skeleton, -1, fromTime, false, [], 1, MixBlend.replace, MixDirection.mixIn)
  const before = bonePose(skeleton)
  to.apply(skeleton, -1, 0, false, [], 1, MixBlend.replace, MixDirection.mixIn)
  const direct = bonePose(skeleton)
  skeleton.setToSetupPose()
  to.apply(skeleton, -1, 0, false, [], 1, MixBlend.replace, MixDirection.mixIn)
  const reset = bonePose(skeleton)
  return {
    bodyType,
    fromMotionId,
    fromTime,
    fromAnimationIndex,
    toMotionId,
    fromAnimation: from.name,
    toAnimation: to.name,
    beforeToDirect: poseDelta(before, direct),
    beforeToAfterSetupReset: poseDelta(before, reset),
    directVsReset: poseDelta(direct, reset),
  }
}

function inspectPoseSamples(bodyType, motionId, animationIndex, times) {
  if (!Number.isInteger(bodyType) || bodyType < 1 || !Number.isInteger(motionId) || motionId < 0) {
    throw new RangeError('Specify integer body and motion identities')
  }
  if (!Number.isInteger(animationIndex) || animationIndex < 0 || !times.length || times.length > 100) {
    throw new RangeError('Specify one animation index and 1–100 sample times')
  }
  const setupPath = path.join(assetRoot, 'setup', `body-${bodyType}.skel`)
  const motionPath = path.join(assetRoot, 'motions', 'choreography', String(bodyType), `${motionId}.motion`)
  const setupBytes = fs.readFileSync(setupPath)
  const motionBytes = fs.readFileSync(motionPath)
  const binary = new SkeletonBinary(new DiagnosticAttachmentLoader())
  const data = binary.readSkeletonData(setupBytes)
  const animation = parseAnimations(binary, data, setupBytes, bodyType, motionId, motionBytes)[animationIndex]
  if (!animation || times.some(t => !Number.isFinite(t) || t < 0 || t > animation.duration)) {
    throw new RangeError('Sample outside the selected native animation')
  }
  const skin = new Skin('diagnostic-base')
  for (const name of ['body', 'head', 'cos_defo']) {
    const source = data.findSkin(name)
    if (source) skin.addSkin(source)
  }
  const identity = (file, bytes) => ({ path: path.relative(repoRoot, file).replaceAll('\\', '/'),
    sha256: createHash('sha256').update(bytes).digest('hex') })
  return { schemaVersion: 1, status: 'native_pose_samples_not_player_or_render_acceptance', bodyType, motionId,
    source: { setup: identity(setupPath, setupBytes), motion: identity(motionPath, motionBytes), animationIndex,
      skins: ['body', 'head', 'cos_defo'].filter(name => data.findSkin(name)),
      coordinates: 'Spine world coordinates before player scale, camera, costume and rendering' },
    animation: summarizeAnimation(animation),
    samples: times.map(time => {
      // Native constraints can retain applied transforms even after setup reset.
      // Each diagnostic sample must be independent of the previous sample order.
      const skeleton = new Skeleton(data)
      skeleton.setSkin(skin)
      skeleton.setToSetupPose()
      animation.apply(skeleton, -1, time, false, [], 1, MixBlend.replace, MixDirection.mixIn)
      skeleton.updateWorldTransform()
      return { time, bones: skeleton.bones.map(b => ({ name: b.data.name,
        x: b.worldX, y: b.worldY, rotation: b.rotation, scaleX: b.scaleX, scaleY: b.scaleY })),
        attachments: skeleton.slots.filter(s => s.getAttachment()).map(s => ({
          slot: s.data.name, bone: s.bone.data.name, attachment: s.getAttachment().name })) }
    }) }
}

const args = process.argv.slice(2)
const bodyType = Number(args[0] || 1)
if (args[1] === '--pose') {
  console.log(JSON.stringify(inspectPoseSamples(bodyType, Number(args[2]), Number(args[3]), args.slice(4).map(Number)), null, 2))
} else if (args[1] === '--transition' && args.length >= 5) {
  console.log(JSON.stringify(inspectTransition(bodyType, Number(args[2]), Number(args[3]), Number(args[4]), Number(args[5] || 0)), null, 2))
} else {
  const motionIds = args.slice(1).map(Number).filter(Number.isFinite)
  if (!motionIds.length) {
  console.error('Usage: node scripts/inspect-live-chibi-motion.mjs <bodyType> <motionId...>')
  console.error('   or: node scripts/inspect-live-chibi-motion.mjs <bodyType> --transition <fromId> <fromTimeSeconds> <toId> [fromAnimationIndex]')
  console.error('   or: node scripts/inspect-live-chibi-motion.mjs <bodyType> --pose <motionId> <animationIndex> <seconds...>')
  process.exitCode = 1
  } else {
    console.log(JSON.stringify(motionIds.map(id => inspectMotion(bodyType, id)), null, 2))
  }
}
