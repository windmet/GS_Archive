// Voice lookahead for the story player. The client has every voice on disk before a story
// starts; the archive streams them, so the next lines are fetched while the current one plays.

/** Voiced steps after `fromIndex`, in authored order. A short script is taken whole. */
export function upcomingVoiceSteps(steps, fromIndex, { limit = 3, wholeScriptAt = 8, scan = 40 } = {}) {
  const list = Array.isArray(steps) ? steps : []
  const start = Math.max(0, fromIndex + 1)
  const voiced = []
  for (let index = start; index < list.length; index++) {
    if (list[index]?.dialogue?.voice) voiced.push({ step: list[index], index })
  }
  if (voiced.length <= wholeScriptAt) return voiced.map(entry => entry.step)
  return voiced.filter(entry => entry.index < start + scan).slice(0, limit).map(entry => entry.step)
}

/**
 * Keeps at most `concurrency` lookahead loads in flight. A new position replaces the queue
 * but lets running loads finish; a new script aborts everything from the previous one.
 */
export function createVoiceLookahead({ prefetch, concurrency = 2, limit = 3, wholeScriptAt = 8 } = {}) {
  let scenario = null, controller = null, queue = [], running = 0
  const seen = new Set()
  function pump() {
    while (running < concurrency && queue.length && controller && !controller.signal.aborted) {
      const step = queue.shift()
      const signal = controller.signal
      running++
      Promise.resolve()
        .then(() => prefetch({ step, scenarioId: scenario?.scenario_id, signal }))
        .catch(() => false)
        .finally(() => { running--; pump() })
    }
  }
  function update(nextScenario, index) {
    if (nextScenario !== scenario) {
      controller?.abort(new Error('scenario changed'))
      scenario = nextScenario; seen.clear(); queue = []
      controller = nextScenario ? new AbortController() : null
    }
    if (!scenario) return []
    for (const step of queue) seen.delete(step) // replaced before it ran
    const targets = upcomingVoiceSteps(scenario.steps, index, { limit, wholeScriptAt })
    queue = targets.filter(step => !seen.has(step))
    for (const step of queue) seen.add(step)
    pump()
    return targets
  }
  function dispose() {
    controller?.abort(new Error('lookahead disposed'))
    controller = null; scenario = null; queue = []; seen.clear()
  }
  return { update, dispose, inspect: () => ({ queued: queue.length, running, seen: seen.size }) }
}
