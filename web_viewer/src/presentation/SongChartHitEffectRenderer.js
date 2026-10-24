import hitEffectsConfig from '../../config/song-hit-effects.v1.json' with { type: 'json' }

export { hitEffectsConfig }

const DEG_TO_RAD = Math.PI / 180

// Asset texture pixel dimensions lookup
const TEXTURE_SIZES = {
  440: { width: 256, height: 256 },
  339: { width: 1024, height: 1024 },
  461: { width: 1024, height: 1024 },
  446: { width: 1024, height: 1024 },
  935: { width: 2048, height: 2048 },
  346: { width: 1024, height: 1024 },
  720: { width: 1024, height: 1024 },
  889: { width: 1024, height: 1024 },
  943: { width: 1024, height: 1024 },
  2068: { width: 136, height: 63 },
}

// Sample deterministic render layers for transient hit effects driven by source contract
export function sampleHitEffectFrame(hit, age, contracts = hitEffectsConfig.defaultContracts) {
  const instructions = []
  if (!hit || age < 0) return instructions

  const hitType = hit.hitType ?? 0
  const HIT_TYPE_DEFAULT_PATH_IDS = {
    0: '14650',
    1: '37973',
    2: '19171',
    3: '34995',
    4: '32265',
    5: '11316',
    6: '15053',
  }
  const contractId = hit.pathId != null
    ? String(hit.pathId)
    : (HIT_TYPE_DEFAULT_PATH_IDS[hitType] || '14650')
  const contract = contracts?.[contractId]
  if (!contract || !Array.isArray(contract.layers)) return instructions

  for (let layerIdx = 0; layerIdx < contract.layers.length; layerIdx++) {
    const layer = contract.layers[layerIdx]
    const { subName, texture, lifetime, bursts, uv } = layer
    const textureId = texture?.pathId ?? 440
    const texMeta = TEXTURE_SIZES[textureId] || { width: 256, height: 256 }
    const tilesX = uv?.tilesX ?? 1
    const tilesY = uv?.tilesY ?? 1
    const totalFrames = tilesX * tilesY
    const sw = Math.floor(texMeta.width / tilesX)
    const sh = Math.floor(texMeta.height / tilesY)

    const burstList = Array.isArray(bursts) && bursts.length ? bursts : [{ time: 0, count: 1 }]

    for (const burst of burstList) {
      const bTime = burst.time ?? 0
      const burstAge = age - bTime
      if (burstAge < 0 || burstAge >= lifetime) continue
      const p = burstAge / lifetime

      if (subName === 'flash') {
        const frame = Math.round((uv?.startFrame ?? 0.5) * totalFrames) % totalFrames
        const col = frame % tilesX, row = Math.floor(frame / tilesX)
        instructions.push({
          textureId,
          subName: 'flash',
          sx: col * sw, sy: row * sh, sw, sh,
          w: 128 * (1.1 + 0.4 * p), h: 128 * (1.1 + 0.4 * p),
          rotation: 0,
          alpha: (1 - p) * 0.95,
          blendMode: 'lighter',
        })
      } else if (subName === 'shine') {
        const frame = Math.round((uv?.startFrame ?? 0) * totalFrames) % totalFrames
        const col = frame % tilesX, row = Math.floor(frame / tilesX)
        const rotation = layerIdx % 2 === 1 ? Math.PI / 4 : 0
        instructions.push({
          textureId,
          subName: 'shine-' + (layerIdx % 2 === 1 ? '2' : '1'),
          sx: col * sw, sy: row * sh, sw, sh,
          w: 110 * (1.0 + 0.2 * p), h: 110 * (1.0 + 0.2 * p),
          rotation,
          alpha: (1 - p) * 0.85,
          blendMode: 'lighter',
        })
      } else if (subName === 'circle') {
        const frame = Math.min(totalFrames - 1, Math.floor(p * totalFrames))
        const col = frame % tilesX, row = Math.floor(frame / tilesX)
        const alpha = burstAge < 0.1 ? burstAge / 0.1 : Math.max(0, 1 - (burstAge - 0.1) / Math.max(0.01, lifetime - 0.1))
        const baseW = textureId === 339 ? 220 : textureId === 461 ? 190 : 180
        const w = baseW * (0.85 + 0.35 * p)
        const nameSuffix = bTime > 0 ? '-burst-' + Number(bTime.toFixed(2)) : ''
        instructions.push({
          textureId,
          subName: 'circle-' + textureId + nameSuffix,
          sx: col * sw, sy: row * sh, sw, sh,
          w, h: w * 0.82,
          rotation: 0,
          alpha: alpha * (textureId === 339 ? 0.95 : 0.85),
          blendMode: 'lighter',
        })
      } else if (subName === 'glitter') {
        const frame = Math.round((uv?.startFrame ?? 0.25) * totalFrames) % totalFrames
        const col = frame % tilesX, row = Math.floor(frame / tilesX)
        const count = burst.count ?? 4
        const dist = burstAge * 85
        for (let j = 0; j < count; j++) {
          const angle = (j * (360 / count) + bTime * 360) * DEG_TO_RAD
          instructions.push({
            textureId,
            subName: 'glitter-' + bTime + '-' + j,
            sx: col * sw, sy: row * sh, sw, sh,
            dx: Math.cos(angle) * dist,
            dy: Math.sin(angle) * dist * 0.82,
            w: 24, h: 24,
            rotation: angle,
            alpha: (1 - p) * 0.85,
            blendMode: 'lighter',
          })
        }
      } else if (subName === 'speedline') {
        const frame = Math.round((uv?.startFrame ?? 0.5) * totalFrames) % totalFrames
        const col = frame % tilesX, row = Math.floor(frame / tilesX)
        const count = burst.count ?? 20
        const dist = burstAge * 160
        const rayLen = 35 * (1 + p)
        for (let j = 0; j < count; j++) {
          const angle = (j * (360 / count)) * DEG_TO_RAD
          instructions.push({
            textureId,
            subName: 'speedline-' + j,
            sx: col * sw, sy: row * sh, sw, sh,
            dx: Math.cos(angle) * dist,
            dy: Math.sin(angle) * dist * 0.82,
            w: rayLen, h: 10,
            rotation: angle,
            alpha: (1 - p) * 0.75,
            blendMode: 'lighter',
          })
        }
      } else if (subName === 'line') {
        const col = 0, row = 0
        const dirAngle = hitType === 1 ? -Math.PI / 2 : hitType === 2 ? 0 : Math.PI
        const streakDist = burstAge * 180
        instructions.push({
          textureId: 935,
          subName: 'flick-streak',
          sx: col * sw, sy: row * sh, sw, sh,
          dx: Math.cos(dirAngle) * streakDist,
          dy: Math.sin(dirAngle) * streakDist * 0.82,
          w: 160 * (1 + p * 0.5), h: 80,
          rotation: dirAngle + Math.PI / 2,
          alpha: (1 - p) * 0.85,
          blendMode: 'lighter',
        })
      } else if (subName === 'M_mark') {
        const col = 0, row = 0
        instructions.push({
          textureId: 346,
          subName: 'sp-m-mark',
          sx: col * sw, sy: row * sh, sw, sh,
          w: 90 * (1 + p * 0.2), h: 90 * (1 + p * 0.2),
          rotation: 0,
          alpha: (1 - p) * 0.95,
          blendMode: 'lighter',
        })
      } else if (subName === 'square') {
        const col = 0, row = 0
        const isInner = textureId === 889
        instructions.push({
          textureId,
          subName: isInner ? 'pskill-frame-inner' : 'pskill-frame',
          sx: col * sw, sy: row * sh, sw, sh,
          w: (isInner ? 120 : 160) * (0.8 + 0.4 * p),
          h: (isInner ? 120 : 160) * (0.8 + 0.4 * p),
          rotation: Math.PI / 4 + (isInner ? -1 : 1) * p * 0.4,
          alpha: (1 - p) * (isInner ? 0.85 : 0.9),
          blendMode: 'lighter',
        })
      }
    }
  }

  // Complementary special outer ring if Special
  if (hitType === 6) {
    const p = Math.min(1, age / 0.55)
    instructions.push({
      textureId: 339,
      subName: 'sp-ring',
      sx: 0, sy: 0, sw: 256, sh: 256,
      w: 240 * (0.7 + 0.5 * p), h: 240 * (0.7 + 0.5 * p) * 0.82,
      rotation: 0,
      alpha: (1 - p) * 0.85,
      blendMode: 'lighter',
    })
  }

  return instructions
}

// Sample continuous hold effect (5 systems in fx_in_touch_circle_hold 32265)
export function sampleHoldEffectFrame(hold, age) {
  const instructions = []
  if (!hold || age < 0) return instructions

  const pulse = Math.sin(age * 10) * 0.15
  instructions.push({
    textureId: 440,
    subName: 'hold-flash',
    sx: 0, sy: 128, sw: 128, sh: 128,
    w: 110 * (1.0 + pulse), h: 110 * (1.0 + pulse),
    rotation: 0,
    alpha: 0.65 + pulse * 0.5,
    blendMode: 'lighter',
  })

  instructions.push({
    textureId: 440,
    subName: 'hold-shine-1',
    sx: 0, sy: 0, sw: 128, sh: 128,
    w: 80, h: 80,
    rotation: age * 2.5,
    alpha: 0.80,
    blendMode: 'lighter',
  })
  instructions.push({
    textureId: 440,
    subName: 'hold-shine-2',
    sx: 0, sy: 0, sw: 128, sh: 128,
    w: 80, h: 80,
    rotation: age * 2.5 + Math.PI / 4,
    alpha: 0.80,
    blendMode: 'lighter',
  })

  for (let i = 0; i < 4; i++) {
    const orbitAngle = age * 4.0 + i * (Math.PI / 2)
    const r = 26 + Math.sin(age * 8 + i) * 6
    instructions.push({
      textureId: 440,
      subName: 'hold-glitter-' + i,
      sx: 128, sy: 0, sw: 128, sh: 128,
      dx: Math.cos(orbitAngle) * r,
      dy: Math.sin(orbitAngle) * r * 0.82,
      w: 22, h: 22,
      rotation: orbitAngle,
      alpha: 0.75,
      blendMode: 'lighter',
    })
  }

  return instructions
}

// Keyframe curve evaluation helper
function evaluateKeyframeCurve(keyframes, t, defaultValue = 1.0) {
  if (!keyframes || !keyframes.length) return defaultValue
  if (t <= keyframes[0].t) return keyframes[0].val ?? defaultValue
  if (t >= keyframes.at(-1).t) return keyframes.at(-1).val ?? defaultValue
  for (let i = 0; i < keyframes.length - 1; i++) {
    const k0 = keyframes[i], k1 = keyframes[i + 1]
    if (t >= k0.t && t <= k1.t) {
      const p = (t - k0.t) / (k1.t - k0.t)
      return k0.val + (k1.val - k0.val) * p
    }
  }
  return defaultValue
}

// Sample Auto UI 3-layer animation from native EvalAnimationAuto (1090)
export function sampleAutoEvaluationFrame(age, animData = hitEffectsConfig.evaluation.animation) {
  if (age < 0 || age >= (animData.duration ?? 1.0)) return null

  const targets = animData.targets || {}
  const layers = []

  // Target 1: EvaluationImage
  if (targets.EvaluationImage) {
    const scaleX = evaluateKeyframeCurve(targets.EvaluationImage.scale?.map(k => ({ t: k.t, val: k.x })), age, 1.0)
    const scaleY = evaluateKeyframeCurve(targets.EvaluationImage.scale?.map(k => ({ t: k.t, val: k.y })), age, 1.0)
    const alpha = evaluateKeyframeCurve(targets.EvaluationImage.alpha, age, 1.0)
    if (alpha > 0.001) {
      layers.push({
        target: 'EvaluationImage',
        spriteId: 2068,
        scaleX,
        scaleY,
        alpha,
      })
    }
  }

  // Target 2: EvaluationEffectImage (initial flash)
  if (targets.EvaluationEffectImage) {
    const scaleX = evaluateKeyframeCurve(targets.EvaluationEffectImage.scale?.map(k => ({ t: k.t, val: k.x })), age, 1.0)
    const scaleY = evaluateKeyframeCurve(targets.EvaluationEffectImage.scale?.map(k => ({ t: k.t, val: k.y })), age, 1.0)
    const alpha = evaluateKeyframeCurve(targets.EvaluationEffectImage.alpha, age, 0.0)
    if (alpha > 0.001) {
      layers.push({
        target: 'EvaluationEffectImage',
        spriteId: 2068,
        scaleX,
        scaleY,
        alpha,
        blendMode: 'lighter',
      })
    }
  }

  // Target 3: EvaluationEffectImage2 (horizontal expansion streak with cyan-green glow)
  if (targets.EvaluationEffectImage2) {
    const scaleX = evaluateKeyframeCurve(targets.EvaluationEffectImage2.scale?.map(k => ({ t: k.t, val: k.x })), age, 1.0)
    const scaleY = evaluateKeyframeCurve(targets.EvaluationEffectImage2.scale?.map(k => ({ t: k.t, val: k.y })), age, 1.0)
    const alpha = evaluateKeyframeCurve(targets.EvaluationEffectImage2.alpha, age, 0.0)
    const colorG = evaluateKeyframeCurve(targets.EvaluationEffectImage2.colorG, age, 1.0)
    const colorB = evaluateKeyframeCurve(targets.EvaluationEffectImage2.colorB, age, 0.8)
    if (alpha > 0.001) {
      layers.push({
        target: 'EvaluationEffectImage2',
        spriteId: 2068,
        scaleX,
        scaleY,
        alpha,
        colorTint: { r: 0, g: colorG, b: colorB },
        blendMode: 'lighter',
      })
    }
  }

  return { age, layers }
}
