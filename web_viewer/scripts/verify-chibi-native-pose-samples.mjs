// Local RAW-backed diagnostic regression. Requires prepared native media;
// intentionally not a media-free CI or rendered-player acceptance test.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tool = path.join(root, 'scripts/inspect-live-chibi-motion.mjs')
const sample = (...args) => JSON.parse(execFileSync(process.execPath, [tool, ...args.map(String)], {
  cwd: root, encoding: 'utf8', maxBuffer: 12 * 1024 * 1024,
}))
let cases = 0
for (const bodyType of [1, 2]) {
  const result = sample(bodyType, '--pose', 20012, 0, 0, 0.4, 0.8, 1.4, 1.5, 0.4)
  assert.equal(result.status, 'native_pose_samples_not_player_or_render_acceptance')
  assert.equal(result.source.animationIndex, 0)
  assert.equal(result.animation.durationSeconds, 1.5)
  for (const source of [result.source.setup, result.source.motion]) {
    assert.equal(source.sha256, createHash('sha256').update(fs.readFileSync(path.join(root, source.path))).digest('hex'))
  }
  assert.deepEqual(result.samples[1], result.samples[5], 'Sampling order must not carry the previous pose')
  const handOffset = pose => {
    const head = pose.bones.find(b => b.name === 'head')
    const hand = pose.bones.find(b => b.name === 'arm_R_hand')
    assert.ok(head && hand)
    return hand.x - head.x
  }
  assert.ok(handOffset(result.samples[1]) > 100, 'Native main reaches one side')
  assert.ok(handOffset(result.samples[2]) < -100, 'Native main subsequently crosses to the other side')
  assert.ok(handOffset(result.samples[3]) > 0, 'Native main returns before its end')
  for (const pose of result.samples) {
    assert.ok(pose.bones.every(b => ['x', 'y', 'rotation', 'scaleX', 'scaleY'].every(key => Number.isFinite(b[key]))))
    assert.ok(pose.attachments.some(a => a.slot === 'hand_R' && a.bone === 'arm_R_hand'))
  }
  const loop = sample(bodyType, '--pose', 20012, 1, 0, 0.8, 1.5)
  assert.notEqual(loop.animation.name, result.animation.name)
  const offsets = loop.samples.map(handOffset)
  assert.ok(Math.max(...offsets) - Math.min(...offsets) < 1, 'Native 20012 loop is a held pose, not the main gesture')
  cases += 2
}
for (const args of [
  [1, '--pose', 20012, 0, -0.01], [1, '--pose', 20012, 0, 1.51],
  [1, '--pose', 20012, 2, 0], [1, '--pose', 20012, 0.5, 0],
  [1, '--pose', 20012, 0, 'NaN'], [1, '--pose', 20012, 0, 'Infinity'],
  [1.5, '--pose', 20012, 0, 0], [1, '--pose', 20012.5, 0, 0],
  [1, '--pose', 20012, 0], [1, '--pose'],
  [1, '--pose', 20012, 0, ...Array(101).fill(0)],
]) {
  const rejected = spawnSync(process.execPath, [tool, ...args.map(String)], { cwd: root, encoding: 'utf8' })
  assert.notEqual(rejected.status, 0)
  assert.equal(rejected.stdout, '', 'Invalid sampling must not produce an apparent evidence receipt')
  assert.match(rejected.stderr, /RangeError/)
  cases += 1
}
console.log(JSON.stringify({ status: 'pass_native_pose_diagnostics_only', cases, bodyTypes: [1, 2], motionId: 20012 }))
