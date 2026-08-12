import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const DEFAULTS = Object.freeze({
  minDurationMs: 2 * 60 * 60 * 1000,
  minSamples: 241,
  minIntervalSamples: 228,
  minQuietDelayMs: 30_000,
  minViewerCycles: 2,
})

const METRICS = Object.freeze({
  heap_used_js_bytes: ['memory', 'used_js_heap_size'],
  spine_instances: ['spine', 'instances'],
  stage_children: ['stage', 'stage_children'],
  active_audio_sources: ['audio_session', 'active_sources'],
  audio_cleanup_timers: ['audio_manager', 'cleanup_timers'],
  playback_timer_pending: ['playback', 'timer_pending'],
  step_effect_timer_pending: ['step_effects', 'timer_pending'],
  active_runtime_cues: ['runtime_active_count'],
  audio_contexts_live: ['lifecycle', 'audio_contexts_live'],
})

const QUIET_ZERO = Object.freeze({
  story_viewers_live: ['lifecycle', 'story_viewers_live'],
  pixi_stage_managers_live: ['lifecycle', 'pixi_stage_managers_live'],
  story_audio_sessions_live: ['lifecycle', 'story_audio_sessions_live'],
  audio_contexts_live: ['lifecycle', 'audio_contexts_live'],
  audio_context_close_failures: ['lifecycle', 'audio_context_close_failures'],
  active_audio_sources: ['audio_session', 'active_sources'],
  audio_cleanup_timers: ['audio_manager', 'cleanup_timers'],
  playback_timer_pending: ['playback', 'timer_pending'],
  step_effect_timer_pending: ['step_effects', 'timer_pending'],
  runtime_frame_pending: ['runtime_frame_pending'],
  active_runtime_cues: ['runtime_active_count'],
  spine_instances: ['spine', 'instances'],
  silhouette_instances: ['spine', 'silhouettes'],
  silhouette_pending: ['spine', 'pending_silhouettes'],
  stage_children: ['stage', 'stage_children'],
  spine_container_children: ['stage', 'spine_container_children'],
  active_screen_overlays: ['stage', 'overlays', 'active_count'],
  silhouette_relayout_jobs: ['stage', 'silhouette_relayout_jobs'],
})

function getPath(value, path) {
  return path.reduce((current, key) => current == null ? null : current[key], value)
}

function summarize(samples, path) {
  const values = samples.map(sample => getPath(sample, path)).filter(Number.isFinite)
  if (!values.length) return null
  return {
    first: values[0],
    last: values.at(-1),
    min: Math.min(...values),
    max: Math.max(...values),
    net_change: values.at(-1) - values[0],
  }
}

export function analyzeStorySoakReport(report, options = {}) {
  const config = { ...DEFAULTS, ...options }
  const invalid = []
  const insufficient = []
  const failures = []
  const warnings = []
  if (!report || typeof report !== 'object') invalid.push('report must be a JSON object')
  const samples = Array.isArray(report?.samples) ? report.samples : []
  if (!Array.isArray(report?.samples)) invalid.push('samples must be an array')
  if (invalid.length) return { verdict: 'INVALID_REPORT', invalid, insufficient, failures, warnings }

  if (report.contract !== 'story-release-soak-v2') {
    insufficient.push(`P2-B lifecycle evidence requires story-release-soak-v2, received ${report.contract || 'none'}`)
  }
  if (report.status !== 'stopped') insufficient.push('report must be stopped before analysis')
  if (Number(report.elapsed_ms) < config.minDurationMs) {
    insufficient.push(`elapsed_ms ${Number(report.elapsed_ms) || 0} is below ${config.minDurationMs}`)
  }
  if (samples.length < config.minSamples) {
    insufficient.push(`sample count ${samples.length} is below ${config.minSamples}`)
  }
  const intervalSamples = samples.filter(sample => sample.reason === 'interval').length
  if (intervalSamples < config.minIntervalSamples) {
    insufficient.push(`interval sample count ${intervalSamples} is below ${config.minIntervalSamples}`)
  }
  if (Number(report.sample_count) !== samples.length) {
    invalid.push(`sample_count ${report.sample_count} does not match samples.length ${samples.length}`)
  }

  const detached = samples.filter(sample => sample.reason === 'viewer-detached')
  const attached = samples.filter(sample => sample.reason === 'viewer-attached')
  const quiet = [...samples].reverse().find(sample => sample.reason === 'quiet-endpoint') || null
  if (detached.length < config.minViewerCycles) {
    insufficient.push(
      `completed viewer cycles ${detached.length} are below ${config.minViewerCycles}`,
    )
  }
  if (!quiet) {
    insufficient.push('quiet-endpoint sample is missing')
  } else {
    const precedingDetach = [...detached].reverse().find(sample => sample.elapsed_ms <= quiet.elapsed_ms)
    if (!precedingDetach) insufficient.push('quiet-endpoint has no preceding viewer-detached sample')
    else if (quiet.elapsed_ms - precedingDetach.elapsed_ms < config.minQuietDelayMs) {
      insufficient.push(
        `quiet-endpoint delay ${quiet.elapsed_ms - precedingDetach.elapsed_ms}ms is below ${config.minQuietDelayMs}ms`,
      )
    }
    for (const [name, path] of Object.entries(QUIET_ZERO)) {
      const value = getPath(quiet, path)
      if (!Number.isFinite(value)) insufficient.push(`quiet-endpoint metric ${name} is missing`)
      else if (value !== 0) failures.push(`quiet-endpoint ${name} expected 0, received ${value}`)
    }
  }

  const finalQuarterCount = Math.max(1, Math.ceil(samples.length * 0.25))
  const finalQuarter = samples.slice(-finalQuarterCount)
  const fullRun = {}
  const final25 = {}
  for (const [name, path] of Object.entries(METRICS)) {
    fullRun[name] = summarize(samples, path)
    final25[name] = summarize(finalQuarter, path)
    if (!fullRun[name]) insufficient.push(`metric ${name} has no numeric samples`)
  }
  if (finalQuarter.length >= 8 && final25.heap_used_js_bytes?.net_change > 0) {
    warnings.push('final 25% heap net change is positive; inspect GC shape and retained object counts manually')
  }

  const routes = [...new Set(samples.map(sample => sample.route).filter(Boolean))]
  const evidence = {
    duration_ms: Number(report.elapsed_ms) || 0,
    sample_count: samples.length,
    interval_sample_count: intervalSamples,
    final_25_percent_sample_count: finalQuarter.length,
    viewer_cycles: detached.length,
    viewer_mount_markers: attached.length,
    routes,
    reasons: [...new Set(samples.map(sample => sample.reason).filter(Boolean))],
    full_run: fullRun,
    final_25_percent: final25,
    quiet_endpoint: quiet,
  }

  let verdict = 'MACHINE_GATE_PASSED_REVIEW_REQUIRED'
  if (invalid.length) verdict = 'INVALID_REPORT'
  else if (failures.length) verdict = 'MACHINE_GATE_FAILED'
  else if (insufficient.length) verdict = 'INSUFFICIENT_EVIDENCE'
  return { verdict, invalid, insufficient, failures, warnings, evidence }
}

async function main() {
  const filename = process.argv[2]
  if (!filename) throw new Error('usage: node scripts/analyze-story-soak-report.mjs <report.json>')
  const report = JSON.parse(await readFile(filename, 'utf8'))
  const result = analyzeStorySoakReport(report)
  console.log(JSON.stringify(result, null, 2))
  if (result.verdict !== 'MACHINE_GATE_PASSED_REVIEW_REQUIRED') process.exitCode = 2
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
