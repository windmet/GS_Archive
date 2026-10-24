import hitEffectsConfig from '../../config/song-hit-effects.v1.json' with { type: 'json' }

export { hitEffectsConfig }

const DEG_TO_RAD = Math.PI / 180

// Sample deterministic render layers for transient hit effects
export function sampleHitEffectFrame(hit, age, contracts = hitEffectsConfig.defaultContracts) {
  const instructions = []
  if (!hit || age < 0) return instructions

  const hitType = hit.hitType ?? 0
  const contract = contracts?.[String(hit.pathId)]

  // 1. Ordinary PERFECT (14650) - 9 systems
  if (hitType === 0) {
    const duration = 0.70
    if (age >= duration) return instructions

    // Layer 0: flash (2x2 tap_shine, frame 2 = row 1, col 0)
    if (age < 0.30) {
      const p = age / 0.30
      instructions.push({
        textureId: 440,
        subName: 'flash',
        sx: 0, sy: 128, sw: 128, sh: 128,
        w: 128 * (1.1 + 0.4 * p), h: 128 * (1.1 + 0.4 * p),
        rotation: 0,
        alpha: (1 - p) * 0.95,
        blendMode: 'lighter',
      })
    }

    // Layer 1 & 2: shine (2x2 tap_shine, frame 0 = row 0, col 0, two rotations)
    if (age < 0.30) {
      const p = age / 0.30
      instructions.push({
        textureId: 440,
        subName: 'shine-1',
        sx: 0, sy: 0, sw: 128, sh: 128,
        w: 110 * (1.0 + 0.2 * p), h: 110 * (1.0 + 0.2 * p),
        rotation: 0,
        alpha: (1 - p) * 0.85,
        blendMode: 'lighter',
      })
      instructions.push({
        textureId: 440,
        subName: 'shine-2',
        sx: 0, sy: 0, sw: 128, sh: 128,
        w: 110 * (1.0 + 0.2 * p), h: 110 * (1.0 + 0.2 * p),
        rotation: Math.PI / 4,
        alpha: (1 - p) * 0.85,
        blendMode: 'lighter',
      })
    }

    // Layer 3: circle (4x4 circleframe_3, 16-frame animation over 0.70s)
    if (age < 0.70) {
      const p = age / 0.70
      const frame = Math.min(15, Math.floor(p * 16))
      const col = frame % 4
      const row = Math.floor(frame / 4)
      const alpha = p < 0.15 ? p / 0.15 : Math.max(0, 1 - (p - 0.15) / 0.85)
      instructions.push({
        textureId: 339,
        subName: 'circle-339',
        sx: col * 256, sy: row * 256, sw: 256, sh: 256,
        w: 220 * (0.85 + 0.35 * p),
        h: 220 * (0.85 + 0.35 * p) * 0.82, // perspective X-tilt ~35 deg
        rotation: 0,
        alpha: alpha * 0.95,
        blendMode: 'lighter',
      })
    }

    // Layer 5: circle (4x4 circleframe_2, bursts at t=0 and t=0.1)
    for (const burstTime of [0.0, 0.10]) {
      const burstAge = age - burstTime
      if (burstAge >= 0 && burstAge < 0.60) {
        const p = burstAge / 0.60
        const frame = Math.min(15, Math.floor(p * 16))
        const col = frame % 4
        const row = Math.floor(frame / 4)
        const alpha = burstAge < 0.1 ? burstAge / 0.1 : Math.max(0, 1 - (burstAge - 0.1) / 0.5)
        instructions.push({
          textureId: 461,
          subName: `circle-461-burst-${burstTime}`,
          sx: col * 256, sy: row * 256, sw: 256, sh: 256,
          w: 190 * (0.8 + 0.4 * p),
          h: 190 * (0.8 + 0.4 * p) * 0.82,
          rotation: 0,
          alpha: alpha * 0.85,
          blendMode: 'lighter',
        })
      }
    }

    // Layer 6: circle (4x4 circleframe_2_2)
    if (age < 0.60) {
      const p = age / 0.60
      const frame = Math.min(15, Math.floor(p * 16))
      const col = frame % 4
      const row = Math.floor(frame / 4)
      const alpha = age < 0.1 ? age / 0.1 : Math.max(0, 1 - (age - 0.1) / 0.5)
      instructions.push({
        textureId: 446,
        subName: 'circle-446',
        sx: col * 256, sy: row * 256, sw: 256, sh: 256,
        w: 180 * (0.85 + 0.35 * p),
        h: 180 * (0.85 + 0.35 * p) * 0.82,
        rotation: 0,
        alpha: alpha * 0.80,
        blendMode: 'lighter',
      })
    }

    // Layer 7: glitter (2x2 tap_shine, frame 1 = row 0, col 1, 4 sparkles per burst at t=0, 0.1, 0.2)
    for (const burstTime of [0.0, 0.10, 0.20]) {
      const bAge = age - burstTime
      if (bAge >= 0 && bAge < 0.50) {
        const p = bAge / 0.50
        const alpha = Math.max(0, 1 - p) * 0.85
        const dist = bAge * 85
        for (let i = 0; i < 4; i++) {
          const angle = (i * 90 + burstTime * 360) * DEG_TO_RAD
          instructions.push({
            textureId: 440,
            subName: `glitter-${burstTime}-${i}`,
            sx: 128, sy: 0, sw: 128, sh: 128,
            dx: Math.cos(angle) * dist,
            dy: Math.sin(angle) * dist * 0.82,
            w: 24, h: 24,
            rotation: angle,
            alpha,
            blendMode: 'lighter',
          })
        }
      }
    }

    // Layer 8: speedline (stretched billboard rays, 20 rays at t=0)
    if (age < 0.30) {
      const p = age / 0.30
      const alpha = (1 - p) * 0.75
      const dist = age * 160
      const rayLen = 35 * (1 + p)
      for (let i = 0; i < 12; i++) {
        const angle = (i * 30) * DEG_TO_RAD
        instructions.push({
          textureId: 440,
          subName: `speedline-${i}`,
          sx: 0, sy: 128, sw: 128, sh: 128,
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist * 0.82,
          w: rayLen, h: 10,
          rotation: angle,
          alpha,
          blendMode: 'lighter',
        })
      }
    }
  }

  // 2. Flick hits (hitType 1 = Up, 2 = Right, 3 = Left)
  else if (hitType >= 1 && hitType <= 3) {
    const duration = 0.70
    if (age >= duration) return instructions
    const p = age / duration

    // Direction angle
    const dirAngle = hitType === 1 ? -Math.PI / 2 : hitType === 2 ? 0 : Math.PI
    const streakDist = age * 180

    // Core flash & shine
    if (age < 0.30) {
      const sp = age / 0.30
      instructions.push({
        textureId: 440,
        subName: 'flick-flash',
        sx: 0, sy: 128, sw: 128, sh: 128,
        w: 120 * (1.1 + 0.3 * sp), h: 120 * (1.1 + 0.3 * sp),
        rotation: 0,
        alpha: (1 - sp) * 0.9,
        blendMode: 'lighter',
      })
    }

    // Directional flick line (935-flick_line.png)
    if (age < 0.45) {
      const fp = age / 0.45
      instructions.push({
        textureId: 935,
        subName: 'flick-streak',
        sx: 0, sy: 0, sw: 2048, sh: 2048,
        dx: Math.cos(dirAngle) * streakDist,
        dy: Math.sin(dirAngle) * streakDist * 0.82,
        w: 160 * (1 + fp * 0.5), h: 80,
        rotation: dirAngle + Math.PI / 2,
        alpha: (1 - fp) * 0.85,
        blendMode: 'lighter',
      })
    }
  }

  // 3. P-Skill (hitType 5) - rotating starframe
  else if (hitType === 5) {
    const duration = 0.50
    if (age >= duration) return instructions
    const p = age / duration

    // Starframe square frame (720-starframe.png) rotated 45 degrees
    instructions.push({
      textureId: 720,
      subName: 'pskill-frame',
      sx: 0, sy: 0, sw: 1024, sh: 1024,
      w: 160 * (0.8 + 0.4 * p), h: 160 * (0.8 + 0.4 * p),
      rotation: Math.PI / 4 + p * 0.4,
      alpha: (1 - p) * 0.9,
      blendMode: 'lighter',
    })

    // Inner starframe2 (889-starframe2.png)
    instructions.push({
      textureId: 889,
      subName: 'pskill-frame-inner',
      sx: 0, sy: 0, sw: 1024, sh: 1024,
      w: 120 * (0.9 + 0.3 * p), h: 120 * (0.9 + 0.3 * p),
      rotation: Math.PI / 4 - p * 0.4,
      alpha: (1 - p) * 0.85,
      blendMode: 'lighter',
    })

    // Central flash
    if (age < 0.30) {
      const sp = age / 0.30
      instructions.push({
        textureId: 440,
        subName: 'pskill-flash',
        sx: 0, sy: 0, sw: 128, sh: 128,
        w: 100 * (1 + sp * 0.3), h: 100 * (1 + sp * 0.3),
        rotation: 0,
        alpha: (1 - sp) * 0.95,
        blendMode: 'lighter',
      })
    }
  }

  // 4. Special (hitType 6) - M_mark & double SP ring
  else if (hitType === 6) {
    const duration = 0.55
    if (age >= duration) return instructions
    const p = age / duration

    // Central M_mark (346-sptap_M_mark.png)
    instructions.push({
      textureId: 346,
      subName: 'sp-m-mark',
      sx: 0, sy: 0, sw: 1024, sh: 1024,
      w: 90 * (1 + p * 0.2), h: 90 * (1 + p * 0.2),
      rotation: 0,
      alpha: (1 - p) * 0.95,
      blendMode: 'lighter',
    })

    // Expanding outer ring
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

  // Flash: pulsing starburst (rateOverTime: 3)
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

  // Shine: rotating contact star (rateOverTime: 2)
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

  // Glitter: continuous sparkles orbiting the hold head (rateOverTime: 20 + 10)
  for (let i = 0; i < 4; i++) {
    const orbitAngle = (age * 4.0 + i * (Math.PI / 2))
    const r = 26 + Math.sin(age * 8 + i) * 6
    instructions.push({
      textureId: 440,
      subName: `hold-glitter-${i}`,
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

// Sample Auto UI 3-layer animation from native EvalAnimationAuto (1090)
export function sampleAutoEvaluationFrame(age, animData = hitEffectsConfig.evaluation.animation) {
  if (age < 0 || age >= animData.duration) return null

  // Target 1: EvaluationImage (main sprite 2068)
  const scale1 = age < 0.1333 ? 1.10 - 0.10 * (age / 0.1333) : 1.0
  const alpha1 = age < 0.9167 ? 1.0 : Math.max(0, 1.0 - (age - 0.9167) / 0.0833)

  const layers = [
    {
      target: 'EvaluationImage',
      spriteId: 2068,
      scaleX: scale1,
      scaleY: scale1,
      alpha: alpha1,
    },
  ]

  // Target 2: EvaluationEffectImage (initial flash)
  if (age < 0.1333) {
    const p = age / 0.1333
    layers.push({
      target: 'EvaluationEffectImage',
      spriteId: 2068,
      scaleX: 1.10 - 0.10 * p,
      scaleY: 1.10 - 0.10 * p,
      alpha: (1 - p) * 0.50,
      blendMode: 'lighter',
    })
  }

  // Target 3: EvaluationEffectImage2 (horizontal expansion streak)
  if (age < 0.3333) {
    const p = age / 0.3333
    const pScale = Math.min(1, age / 0.1333)
    const scaleX = 1.10 + (1.4288 - 1.10) * pScale
    const scaleY = 1.10 + (0.9284 - 1.10) * pScale
    layers.push({
      target: 'EvaluationEffectImage2',
      spriteId: 2068,
      scaleX,
      scaleY,
      alpha: (1 - p) * 0.50,
      colorTint: { r: 0, g: 1.0 - p * 0.6, b: 0.8 - p * 0.5 },
      blendMode: 'lighter',
    })
  }

  return { age, layers }
}
