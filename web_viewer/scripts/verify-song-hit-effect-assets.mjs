import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

const cfg = JSON.parse(readFileSync(new URL('../config/song-hit-effects.v1.json', import.meta.url)))
const publicRoot = new URL('../public/', import.meta.url)
const receipt = JSON.parse(readFileSync(new URL('./fixtures/song-hit-effect-assets.json', import.meta.url)))

// 1. Verify all 10 native assets exist in public/ with matching SHA256
assert.ok(cfg.assets, 'Assets registry exists')
const assetEntries = Object.values(cfg.assets)
assert.equal(assetEntries.length, 9, 'Nine native hit effect textures registered')

for (const asset of assetEntries) {
  const expected = receipt.textures.find(t => t.pathId === asset.pathId)
  assert.ok(expected, `Source texture receipt: ${asset.pathId}`)
  assert.equal(asset.pngSha256, expected.pngSha256, 'PNG hash bound to IPA export receipt')
  execFileSync('git', ['ls-files', '--error-unmatch', `public${asset.url}`], { cwd: new URL('../', import.meta.url), stdio: 'pipe' })
  const filePath = new URL(asset.url.replace(/^\//, ''), publicRoot)
  assert.ok(existsSync(filePath), `Asset exists: ${asset.url}`)
  const bytes = readFileSync(filePath)
  const actualHash = crypto.createHash('sha256').update(bytes).digest('hex')
  assert.equal(actualHash, asset.pngSha256, `SHA256 matches for ${asset.name} (${asset.url})`)
}

// 2. Verify Auto UI sprite
const autoSprite = cfg.evaluation.sprite
assert.equal(autoSprite.pngSha256, receipt.evaluation.sprite.pngSha256)
execFileSync('git', ['ls-files', '--error-unmatch', `public${autoSprite.url}`], { cwd: new URL('../', import.meta.url), stdio: 'pipe' })
assert.equal(autoSprite.pathId, 2068)
const autoSpritePath = new URL(autoSprite.url.replace(/^\//, ''), publicRoot)
assert.ok(existsSync(autoSpritePath), `Auto sprite exists: ${autoSprite.url}`)
const autoBytes = readFileSync(autoSpritePath)
const autoHash = crypto.createHash('sha256').update(autoBytes).digest('hex')
assert.equal(autoHash, autoSprite.pngSha256, 'Auto sprite SHA256 matches')
assert.equal(autoSprite.width, 136)
assert.equal(autoSprite.height, 63)

// 3. Verify AnimationClip curves for EvalAnimationAuto
const anim = cfg.evaluation.animation
assert.equal(anim.pathId, 1090)
assert.equal(anim.name, 'EvalAnimationAuto')
assert.equal(anim.duration, 1.0)
assert.ok(anim.targets.EvaluationImage.scale.length >= 3, 'EvaluationImage scale curve')
assert.ok(anim.targets.EvaluationImage.alpha.length >= 3, 'EvaluationImage alpha curve')
assert.ok(anim.targets.EvaluationEffectImage2.scale.length >= 2, 'EvaluationEffectImage2 scale curve')

// 4. Verify layer contracts for ordinary PERFECT (14650)
const perfect = cfg.defaultContracts['14650']
assert.equal(perfect.name, 'fx_in_touch_circle_perfect')
assert.equal(perfect.layers.length, 9, '9 systems in ordinary PERFECT')

// Layer 0: flash (2x2 tap_shine)
assert.equal(perfect.layers[0].subName, 'flash')
assert.equal(perfect.layers[0].uv.tilesX, 2)
assert.equal(perfect.layers[0].uv.tilesY, 2)
assert.equal(perfect.layers[0].uv.startFrame, 0.5)

// Layer 3: circle (4x4 circleframe_3)
assert.equal(perfect.layers[3].subName, 'circle')
assert.equal(perfect.layers[3].uv.tilesX, 4)
assert.equal(perfect.layers[3].uv.tilesY, 4)

// Layer 8: speedline (stretched billboard, renderMode 1)
assert.equal(perfect.layers[8].subName, 'speedline')
assert.equal(perfect.layers[8].renderMode, 1)

// 5. Verify hold contract (32265)
const hold = cfg.defaultContracts['32265']
assert.equal(hold.name, 'fx_in_touch_circle_hold')
assert.equal(hold.layers.length, 5, '5 systems in hold')
assert.ok(hold.layers.every(l => l.looping), 'All hold systems loop')

// CI is filesystem-only. An explicitly requested HTTP check must fail on any
// missing/wrong response rather than swallowing assertions in a broad catch.
const origin = process.argv.find(arg => arg.startsWith('--origin='))?.slice('--origin='.length)
if (origin) {
  for (const asset of [...assetEntries, autoSprite]) {
    const res = await fetch(`${origin}${asset.url}`, { signal: AbortSignal.timeout(10000) })
    assert.equal(res.status, 200, `HTTP status 200 for ${asset.url}`)
    assert.ok(res.headers.get('content-type')?.includes('image/png'), `HTTP image/png for ${asset.url}`)
    const hash = crypto.createHash('sha256').update(Buffer.from(await res.arrayBuffer())).digest('hex')
    assert.equal(hash, asset.pngSha256, `HTTP bytes match source for ${asset.url}`)
  }
  console.log('Explicit HTTP verification: 10 PNG response types, statuses and source hashes passed.')
} else {
  console.log('HTTP checks not requested; source-only filesystem validation.')
}

console.log('Hit-effect source assets verified: 10 tracked PNG hashes and declared contract headers passed. Native particle rendering is a separate acceptance boundary.')
