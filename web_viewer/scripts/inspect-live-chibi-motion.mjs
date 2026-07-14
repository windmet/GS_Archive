import fs from 'node:fs'
import path from 'node:path'
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
  const motionPath = path.join(assetRoot, 'motions', 'choreography', String(bodyType), `${motionId}.bin`)
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

function parseAnimations(skeletonBinary, skeletonData, setupBytes, bodyType, motionId) {
  const motionPath = path.join(assetRoot, 'motions', 'choreography', String(bodyType), `${motionId}.bin`)
  const input = new BinaryInput(fs.readFileSync(motionPath), readSetupStringTable(setupBytes))
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

const args = process.argv.slice(2)
const bodyType = Number(args[0] || 1)
if (args[1] === '--transition' && args.length >= 5) {
  console.log(JSON.stringify(inspectTransition(bodyType, Number(args[2]), Number(args[3]), Number(args[4]), Number(args[5] || 0)), null, 2))
} else {
  const motionIds = args.slice(1).map(Number).filter(Number.isFinite)
  if (!motionIds.length) {
  console.error('Usage: node scripts/inspect-live-chibi-motion.mjs <bodyType> <motionId...>')
  console.error('   or: node scripts/inspect-live-chibi-motion.mjs <bodyType> --transition <fromId> <fromTimeSeconds> <toId> [fromAnimationIndex]')
  process.exitCode = 1
  } else {
    console.log(JSON.stringify(motionIds.map(id => inspectMotion(bodyType, id)), null, 2))
  }
}
