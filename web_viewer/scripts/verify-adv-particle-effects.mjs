import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ADV_CANVAS_PER_WORLD, ADV_ORTHOGRAPHIC_SIZE, advStageUnit, advToScreen } from '../shared/story/AdvStageLayout.js'
import { effectTextures } from '../shared/story/EffectTextures.js'
import {
  ADV_PARTICLE_MODEL as model, advParticleEffectAlpha, advParticleLifetime, advParticlePrefab, advParticleQuad, advParticleSystems, sampleAdvParticles,
} from '../src/core/advParticleEffects.js'

const root = new URL('../', import.meta.url)
const fixture = JSON.parse(readFileSync(new URL('scripts/fixtures/adv-particle-effects-native.json', root), 'utf8'))

// Raw placement: a RectTransform's planar position is (anchor - parent pivot) x parent size + anchoredPosition
// (its serialized localPosition x/y is stale); the prefab root sits at the BackEffect origin.
function rawEmitterCanvas(chain) {
  let x = 0, y = 0, scale = 1
  for (let i = chain.length - 1; i >= 0; i--) {
    const transform = chain[i], parent = chain[i + 1]
    let px = transform.position.x, py = transform.position.y
    if (transform.rect) {
      assert.deepEqual(transform.rect.anchorMin, transform.rect.anchorMax, 'point anchors')
      if (!parent) { px = 0; py = 0; assert.deepEqual(transform.rect.anchoredPosition, { x: 0, y: 0 }) }
      else {
        px = (transform.rect.anchorMin.x - parent.rect.pivot.x) * parent.rect.sizeDelta.x + transform.rect.anchoredPosition.x
        py = (transform.rect.anchorMin.y - parent.rect.pivot.y) * parent.rect.sizeDelta.y + transform.rect.anchoredPosition.y
      }
    }
    x += px * scale; y += py * scale; scale *= transform.scale.x
  }
  return { x, y }
}
const close = (actual, expected, message, epsilon = 1e-6) => assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: ${actual} vs ${expected}`)

// 1. Binding and placement contract.
assert.equal(model.schemaVersion, 1); assert.equal(model.contract, 'native-adv-particle-v1')
assert.equal(model.placement.canvasPerWorld, ADV_CANVAS_PER_WORLD)
assert.equal(model.placement.characterSortingOrder, 10); assert.equal(model.placement.prewarm, false)
assert.deepEqual(Object.keys(model.prefabs).sort(), ['fx_adv_cameraflare_left', 'fx_adv_cameraflare_right', 'fx_adv_punch', 'fx_adv_rain', 'fx_adv_rain_heavy', 'fx_adv_rain_heavy2'])
assert.equal(fixture.unityDataSha256, model.unityDataSha256)
for (const id of ['fx_adv_rain', 'fx_adv_rain_heavy', 'fx_adv_rain_heavy2']) assert.equal(advParticlePrefab(id, { lightPosition: 1 }), id)
assert.deepEqual([0, 1, 2, 3, undefined].map(lightPosition => advParticlePrefab('cameraflare', { lightPosition })),
  [null, 'fx_adv_cameraflare_left', 'fx_adv_cameraflare_right', null, null])
assert.equal(advParticlePrefab('fx_adv_sakura'), null, 'sakura stays on its own handler in this PR')
for (const id of Object.keys(model.effects)) {
  const textures = new Set(Object.values(typeof model.effects[id] === 'string' ? { one: model.effects[id] } : model.effects[id])
    .flatMap(prefab => advParticleSystems(prefab).map(system => system.texture)))
  // punch is an effect_single (screen_effects command) that instantiates its prefab on the bg effect parent.
  const domain = id === 'fx_adv_punch' ? 'screen_effects' : 'bg_effects'
  assert.deepEqual(effectTextures({ id }, domain).textures, [...textures], `${id}: plan requests exactly the native textures`)
}
for (const [key, texture] of Object.entries(model.textures)) {
  const bytes = readFileSync(new URL(`public${texture.file}`, root))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), texture.pngSha256, `${key}: published PNG is the checked APK copy`)
  assert.equal(bytes.readUInt32BE(16), texture.width); assert.equal(bytes.readUInt32BE(20), texture.height)
}

// 2. Every serialized system against its RAW record (the fixture carries the unmodified ParticleSystem).
const expected = {
  fx_adv_rain: { Rain_far: [5, 100, 5], Rain_near: [2, 100, 15] },
  fx_adv_rain_heavy: { Rain_far: [20, 100, 5], Rain_near: [5, 100, 15] },
  fx_adv_rain_heavy2: { Rain_far: [130, 200, 5], Rain_near: [20, 100, 15] },
  fx_adv_cameraflare_left: { cameraflare: [1, 10, 15] },
  fx_adv_cameraflare_right: { cameraflare: [1, 10, 15] },
  fx_adv_punch: { punch: [0, 10, 15], punch_add: [0, 10, 16] },
}
for (const [prefab, systems] of Object.entries(model.prefabs)) {
  assert.deepEqual(systems.systems.map(system => system.name).sort(), Object.keys(expected[prefab]).sort(), prefab)
  for (const system of systems.systems) {
    const raw = fixture.prefabs[prefab].find(record => record.pathId === system.source.pathId)
    assert.ok(raw, `${prefab}/${system.name}: RAW record`)
    const initial = raw.modules.InitialModule, emission = raw.modules.EmissionModule, shape = raw.modules.ShapeModule
    const [rate, capacity, sorting] = expected[prefab][system.name]
    assert.equal(system.rate, rate); assert.equal(emission.rateOverTime.scalar, rate)
    assert.equal(system.capacity, capacity); assert.equal(initial.maxNumParticles, capacity)
    assert.equal(system.sortingOrder, sorting); assert.equal(raw.renderer.sortingOrder, sorting)
    assert.equal(system.layer, sorting > 10 ? 'front' : 'back')
    assert.equal(raw.main.scalingMode, 1, 'Local scaling: parent (canvas) scale is ignored')
    assert.equal(Number(raw.main.prewarm), 0); assert.equal(raw.main.simulationSpeed, 1); assert.equal(Number(raw.main.moveWithTransform), 0)
    assert.equal(system.speed.scalar, initial.startSpeed.scalar, 'moving edge speed restored from RAW')
    assert.equal(system.speed.minScalar, initial.startSpeed.minScalar)
    // Shared billboard rendering now follows native clockwise angles; no ADV compensation.
    assert.equal(system.rotation.scalar, initial.startRotation.scalar); assert.equal(system.rotation.minScalar, initial.startRotation.minScalar)
    if (raw.modules.RotationModule) assert.equal(system.angularVelocity.scalar, raw.modules.RotationModule.curve.scalar)
    assert.ok(!system.adaptations.includes('rotation-negated-to-clockwise'))
    // A disabled ShapeModule (punch) emits from the emitter point.
    if (shape) assert.deepEqual(system.shape.m_Rotation, shape.m_Rotation); else assert.equal(system.shape, null)
    assert.equal(system.commandAlphaPower, 'ColorModule' in raw.modules ? 2 : 1)
    if (raw.modules.ForceModule) for (const axis of 'xyz') assert.equal(raw.modules.ForceModule[axis].scalar, 0, 'only an inert force is dropped')
    const flags = raw.rendererFlags
    assert.deepEqual(system.flip ?? { x: 0, y: 0 }, { x: flags.m_Flip.x, y: flags.m_Flip.y })
    assert.deepEqual(system.pivot ?? { x: 0, y: 0 }, { x: raw.renderer.pivot.x, y: raw.renderer.pivot.y })
    // Unity clamps billboards to m_MaxParticleSize view heights; the largest particle stays below it.
    assert.ok(Math.max(system.size.scalar, system.size.minScalar) <= flags.m_MaxParticleSize * 2 * ADV_ORTHOGRAPHIC_SIZE)
    const shader = raw.renderer.materials[0].shader.name
    assert.equal(system.blend, shader === 'Mobile/Particles/Alpha Blended' ? 'normal' : 'add')
    // Synthesized emitter: hierarchy position in particle units, own scale only.
    const { x, y } = rawEmitterCanvas(raw.transformChain)
    close(system.chain[0].position.x * ADV_CANVAS_PER_WORLD, x, `${prefab} emitter x`, 1e-3)
    close(system.chain[0].position.y * ADV_CANVAS_PER_WORLD, y, `${prefab} emitter y`, 1e-3)
    assert.deepEqual(system.chain[0].scale, raw.transformChain[0].scale)
  }
}
// The flare roots sit at canvas (512, 253) with scale 72; the children put the emitters near the top corners.
close(model.prefabs.fx_adv_cameraflare_left.systems[0].canvasPosition.x, 512 - 15.6 * 72, 'left flare x', 1e-3)
close(model.prefabs.fx_adv_cameraflare_right.systems[0].canvasPosition.y, 253 + 0.9 * 72, 'right flare y', 1e-3)

// Rain spawns above the frame and falls through all of it (the view is 2 x 4.347826 particle units tall).
for (const prefab of ['fx_adv_rain', 'fx_adv_rain_heavy', 'fx_adv_rain_heavy2'])
  for (const system of advParticleSystems(prefab))
    assert.ok(system.chain[0].position.y > 4.347826, `${prefab}/${system.name}: emitter above the top of the view`)

// 3. Command alpha: CreateBgEffectCoroutine fallback, then SetEffectAlpha on start colour and lifetime keys.
assert.equal(advParticleEffectAlpha('fx_adv_rain', undefined), 1)
assert.equal(advParticleEffectAlpha('fx_adv_rain', -1, { lightAlpha: 0.3 }), 1)
assert.equal(advParticleEffectAlpha('cameraflare', undefined, { lightAlpha: 0.3 }), 0.3)
assert.equal(advParticleEffectAlpha('cameraflare', -1, { lightAlpha: 0.3 }), 0.3)
assert.equal(advParticleEffectAlpha('cameraflare', 0.6, { lightAlpha: 0.3 }), 0.6)
assert.equal(advParticleEffectAlpha('cameraflare', 0, { lightAlpha: 0.3 }), 0)

// 4. Stage mapping with an independent formula: canvas = particle units x 72 around the view centre.
const width = 1280, height = 720, unit = advStageUnit(width, height)
close(unit, 720 / (2 * 4.347826 * 72), 'landscape unit')
const flare = model.prefabs.fx_adv_cameraflare_left.systems[0]
const sample = { x: 100, y: -50, a: 200, b: 0, c: 0, d: 300, alpha: 0.5, color: 0xffffff, frame: 2 }
const quad = advParticleQuad(flare, sample, 0.6, width, height)
const centre = advToScreen(width, height, 1 * 72, 0.5 * 72)
// Pivot (-0.1, -0.1): the quad moves -0.1 width along Unity +x and -0.1 height along Unity +y (up).
close(quad.x, centre.x - 0.1 * 2 * 72 * unit, 'pivot x'); close(quad.y, centre.y + 0.1 * 3 * 72 * unit, 'pivot y')
close(quad.a, 2 * 72 * unit, 'quad width'); close(quad.d, 3 * 72 * unit, 'quad height')
close(quad.alpha, 0.5 * 0.36, 'alpha squared'); assert.equal(quad.frame, 2)
const rain = model.prefabs.fx_adv_rain.systems[0]
const mirrored = advParticleQuad(rain, sample, 1, width, height)
assert.equal(mirrored.a, -quad.a, 'flip x mirrors the particle x axis'); close(mirrored.x, advToScreen(width, height, 72, 36).x, 'no pivot on rain')

// 5. Particle motion against the RAW parameters, independent of the sampler's internals.
const toWorld = (q, w, h) => {
  const k = advStageUnit(w, h) * ADV_CANVAS_PER_WORLD, origin = advToScreen(w, h, 0, 0)
  return { x: (q.x - origin.x) / k, y: (origin.y - q.y) / k, size: Math.hypot(q.a, q.b) / k, sizeY: Math.hypot(q.c, q.d) / k }
}
for (const prefab of ['fx_adv_rain', 'fx_adv_rain_heavy', 'fx_adv_rain_heavy2']) {
  for (const system of advParticleSystems(prefab)) {
    const record = fixture.prefabs[prefab].find(record => record.pathId === system.source.pathId), raw = record.modules
    const emitter = rawEmitterCanvas(record.transformChain)
    const theta = raw.ShapeModule.m_Rotation.z * Math.PI / 180, radius = raw.ShapeModule.radius.value
    const [low, high] = [raw.InitialModule.startSpeed.scalar, raw.InitialModule.startSpeed.minScalar].map(Math.abs).sort((a, b) => a - b)
    const quads = sampleAdvParticles(system, 4000, 1000, 1, width, height)
    assert.ok(quads.length > 0, `${prefab}/${system.name}: live particles`)
    for (const q of quads) {
      const world = toWorld(q, width, height)
      const p = { ...world, x: world.x - emitter.x / ADV_CANVAS_PER_WORLD, y: world.y - emitter.y / ADV_CANVAS_PER_WORLD }
      // Edge along the rotated x axis through the emitter; motion along the rotated -Y.
      const along = p.x * Math.cos(theta) + p.y * Math.sin(theta), down = p.x * Math.sin(theta) - p.y * Math.cos(theta)
      assert.ok(Math.abs(along) <= radius + 1e-6, `${prefab}: on the ${radius} edge (${along})`)
      assert.ok(down >= -1e-9, `${prefab}: rain falls (${down})`)
      assert.ok(down <= high * 1.5 + 1e-6, `${prefab}: within speed x lifetime`)
      const within = (value, curve) => value >= Math.min(curve.scalar, curve.minScalar) - 1e-6 && value <= Math.max(curve.scalar, curve.minScalar) + 1e-6
      assert.ok(within(p.size, raw.InitialModule.startSize) && within(p.sizeY, raw.InitialModule.startSizeY), `${prefab}: size3D`)
      // Constant startRotation (1.623 or 1.745 rad) drawn clockwise: 90 degrees plus the shape tilt.
      // (the quad x axis is mirrored by m_Flip x, so undo it before reading the angle in y-down screen space).
      close(Math.atan2(-q.b, -q.a), raw.InitialModule.startRotation.scalar, `${prefab}: clockwise start rotation`, 1e-6)
      assert.ok(q.alpha > 0 && q.alpha <= raw.InitialModule.startColor.maxColor.a + 1e-9)
    }
    assert.ok(low > 0)
    // Each streak lies along its fall: the Edge emits along the tilted shape +Y and a negative speed falls
    // along (sin z, cos z) in y-down screen space, independent of the sampler.
    const fall = { x: Math.sin(theta), y: Math.cos(theta) }
    for (const q of quads) assert.ok(Math.abs(fall.x * q.b - fall.y * q.a) / Math.hypot(q.a, q.b) < 1e-6, `${prefab}: streak along its fall`)
  }
}
for (const prefab of ['fx_adv_cameraflare_left', 'fx_adv_cameraflare_right']) {
  const system = advParticleSystems(prefab)[0]
  const quads = sampleAdvParticles(system, 20000, 0, 1, width, height)
  assert.equal(quads.length, 4, `${prefab}: 1/s for 4 s lifetimes`)
  for (const q of quads) {
    const p = toWorld(q, width, height)
    // Undo the pivot, then the particle must lie within the 0.2 circle around the emitter.
    const k = advStageUnit(width, height) * ADV_CANVAS_PER_WORLD
    const ax = q.a / (system.flip?.x ? -1 : 1), bx = q.b
    const px = (system.pivot.x * ax - system.pivot.y * q.c) / k, py = -(system.pivot.x * bx - system.pivot.y * q.d) / k
    const ex = system.chain[0].position.x, ey = system.chain[0].position.y
    assert.ok(Math.hypot(p.x - px - ex, p.y - py - ey) <= 0.2 + 1e-6, `${prefab}: circle radius 0.2`)
    assert.ok(p.size >= 15 - 1e-6 && p.size <= 25 + 1e-6, `${prefab}: size 15..25`)
    assert.ok(q.frame >= 0 && q.frame < 4)
  }
}
// No prewarm and the start delay: nothing before activation, the first particle at 1/rate.
assert.equal(sampleAdvParticles(rain, 999, 1000, 1, width, height).length, 0)
assert.equal(sampleAdvParticles(flare, 1999, 1000, 1, width, height).length, 0)
assert.equal(sampleAdvParticles(flare, 2001, 1000, 1, width, height).length, 1)

// effect_single punch: one burst per system, placed at the command's canvas (x, y) and scaled about
// the prefab root (StoryParticleEffect.SetEffectScale multiplies each system's localScale).
for (const system of advParticleSystems('fx_adv_punch')) {
  const raw = fixture.prefabs.fx_adv_punch.find(record => record.pathId === system.source.pathId)
  assert.equal(raw.modules.EmissionModule.m_Bursts.length, 1); assert.equal(Number(raw.main.looping), 0)
  assert.deepEqual(system.bursts, [{ time: 0, count: 1 }])
  const plain = sampleAdvParticles(system, 1100, 1000, 1, width, height)
  const placed = sampleAdvParticles(system, 1100, 1000, 1, width, height, { x: -300, y: 20, scale: 1.5 })
  assert.equal(plain.length, 1, `${system.name}: one particle`); assert.equal(placed.length, 1)
  const a = toWorld(plain[0], width, height), b = toWorld(placed[0], width, height)
  close(a.x, 0, `${system.name}: unplaced at the view centre`, 1e-6); close(a.y, 0, `${system.name}: unplaced y`, 1e-6)
  close(b.x, -300 / ADV_CANVAS_PER_WORLD, `${system.name}: canvas x`, 1e-6)
  close(b.y, 20 / ADV_CANVAS_PER_WORLD, `${system.name}: canvas y (Unity up)`, 1e-6)
  close(b.size, a.size * 1.5, `${system.name}: command scale`, 1e-6)
  // lifetime 0.23 s: gone well before the 1 s duration ends.
  assert.equal(sampleAdvParticles(system, 1000 + raw.modules.InitialModule.startLifetime.scalar * 1000 + 1, 1000, 1, width, height).length, 0)
}
close(advParticleLifetime('fx_adv_punch'), (1 + advParticleSystems('fx_adv_punch')[0].lifetime.scalar) * 1000, 'non-looping prefab ends after duration + lifetime', 1e-3)
assert.equal(advParticleLifetime('fx_adv_rain'), Infinity, 'looping prefab never ends by itself')

// 6. Local only: re-extract from the APK and compare with the committed model and fixture.
const script = fileURLToPath(new URL('scripts/prepare-adv-particle-effects.py', root))
const run = spawnSync(process.env.PYTHON || 'python', [script, '--if-available'], { encoding: 'utf8' })
if (run.error) console.log(`native receipt: Python unavailable (${run.error.code}), re-extraction skipped`)
else if (run.status !== 0) assert.fail(`APK re-extraction differs:\n${run.stderr}`)
else if (run.stdout.startsWith('source-absent')) console.log(`native receipt: ${run.stdout.trim()}, re-extraction skipped`)
else console.log(`native receipt: ${run.stdout.trim()} matched the APK`)
console.log('adv particle effects: PASS')
