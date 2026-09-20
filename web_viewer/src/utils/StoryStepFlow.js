export function isTransitionStep(step) {
  return step?.type === 'fadeout' ||
    step?.type === 'fadein' ||
    step?.type === 'fadecolor' ||
    step?.type === 'slidein' ||
    step?.type === 'slideout' ||
    step?.type === 'text_time' ||
    step?.type === 'text_disable' ||
    (step?.type === 'stage' && step?.auto_advance !== false) ||
    (step?.type === 'talk_stamp' && step?.auto_advance !== false)
}

export function getAutoAdvanceTiming(step) {
  if (!step?.type) return null

  if (step.type === 'fadeout' || step.type === 'fadein' || step.type === 'fadecolor') {
    const sf = step?.state?.screen_fade
    const duration = Number(sf?.duration ?? 0.5) + Number(sf?.delay ?? 0)
    return { delayMs: duration * 1000 + 450, pushHistory: true }
  }

  if (step.type === 'slidein' || step.type === 'slideout') {
    const slide = step?.state?.screen_slide
    const duration = Number(slide?.duration ?? 0.5) + Number(slide?.delay ?? 0)
    return { delayMs: duration * 1000 + 100, pushHistory: false }
  }

  if (step.type === 'text_disable') {
    const duration = Math.max(0.2, Number(step.duration || 0.6))
    return { delayMs: duration * 1000 + 80, pushHistory: false }
  }

  if (step.type === 'text_time') {
    const duration = Math.max(0.2, Number(step.duration || 1.2))
    return { delayMs: duration * 1000, pushHistory: false }
  }

  if (step.type === 'talk_stamp' && step.auto_advance !== false) {
    const duration = Math.max(0.2, Number(step.duration || 1.0))
    return { delayMs: duration * 1000, pushHistory: true }
  }

  if (step.type === 'stage' && step.auto_advance !== false) {
    const duration = Math.max(0.05, Number(step.duration || 0.6))
    return { delayMs: duration * 1000, pushHistory: true }
  }

  return null
}

// Internal visual timeline nodes are not separate reader clicks. Keep unknown
// nodes, explicit waits, captions, choices and communication messages as stops.
export function isManualBridge(step) {
  if (!step || step.auto_advance === false || step.unavailable || step.fatal || step.flow?.advance === 'choice') return false
  const dialogue = step.dialogue
  const text = dialogue?.source_text || dialogue?.text_jp || dialogue?.text || dialogue?.text_cn
  if (typeof text === 'string' && text.trim()) return false
  return ['stage', 'text_disable', 'fadein', 'fadeout', 'fadecolor', 'slidein', 'slideout'].includes(step.type)
}

export function nextInteractionIndex(steps, fromIndex, endIndex) {
  for (let index = fromIndex + 1; index <= endIndex; index++) {
    if (!isManualBridge(steps[index])) return index
  }
  return null
}
