const DEFAULT_SAMPLE_INTERVAL_MS = 30_000
const DEFAULT_MAX_SAMPLES = 1024
const DEFAULT_MAX_DURATION_MS = 4 * 60 * 60 * 1000

const getPath = (value, path) => path.reduce(
  (current, key) => current == null ? null : current[key],
  value,
)

function summarizeMetric(samples, path) {
  const values = samples
    .map(sample => getPath(sample, path))
    .filter(Number.isFinite)
  if (!values.length) return null
  return {
    first: values[0],
    last: values.at(-1),
    min: Math.min(...values),
    max: Math.max(...values),
    net_change: values.at(-1) - values[0],
    decrease_observed: values.some((value, index) => index > 0 && value < values[index - 1]),
  }
}

export class ReleaseSoakRecorder {
  constructor({
    sampleIntervalMs = DEFAULT_SAMPLE_INTERVAL_MS,
    maxSamples = DEFAULT_MAX_SAMPLES,
    maxDurationMs = DEFAULT_MAX_DURATION_MS,
    now = () => Date.now(),
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
  } = {}) {
    this.sampleIntervalMs = sampleIntervalMs
    this.maxSamples = maxSamples
    this.maxDurationMs = maxDurationMs
    this._now = now
    // Browser timer functions can reject a non-Window receiver. Wrapping them
    // prevents `this._setInterval(...)` from forwarding the recorder as `this`.
    this._setInterval = (callback, delay) => setIntervalFn(callback, delay)
    this._clearInterval = timer => clearIntervalFn(timer)
    this._collector = null
    this._timer = null
    this._status = 'idle'
    this._startedAt = null
    this._stoppedAt = null
    this._stopReason = null
    this._samples = []
  }

  attachCollector(collector) {
    this._collector = typeof collector === 'function' ? collector : null
    if (this._status === 'running') this.record('viewer-attached')
  }

  detachCollector(collector = null) {
    if (!collector || this._collector === collector) this._collector = null
  }

  start({ reset = true } = {}) {
    if (this._status === 'running') return this.inspect()
    if (reset) this.reset()
    this._status = 'running'
    this._startedAt = this._now()
    this._stoppedAt = null
    this._stopReason = null
    this.record('start')
    if (this._status === 'running') {
      this._timer = this._setInterval(() => this.record('interval'), this.sampleIntervalMs)
    }
    return this.inspect()
  }

  stop(reason = 'manual') {
    if (this._status !== 'running') return this.inspect()
    this.record('stop')
    if (this._status === 'running') this._finishStop(this._now(), reason)
    return this.inspect()
  }

  _finishStop(capturedAt, reason) {
    this._status = 'stopped'
    this._stoppedAt = capturedAt
    this._stopReason = reason
    if (this._timer != null) this._clearInterval(this._timer)
    this._timer = null
  }

  reset() {
    if (this._timer != null) this._clearInterval(this._timer)
    this._timer = null
    this._status = 'idle'
    this._startedAt = null
    this._stoppedAt = null
    this._stopReason = null
    this._samples = []
  }

  record(reason = 'manual') {
    if (this._status !== 'running') return null
    const capturedAt = this._now()
    const reachedDuration = capturedAt - this._startedAt >= this.maxDurationMs
    if (!this._collector) {
      if (reachedDuration) this._finishStop(capturedAt, 'duration')
      return null
    }
    const collected = this._collector()
    if (!collected || typeof collected !== 'object') return null
    const sample = {
      sequence: this._samples.length,
      captured_at: new Date(capturedAt).toISOString(),
      elapsed_ms: capturedAt - this._startedAt,
      reason,
      ...collected,
    }
    this._samples.push(sample)
    if (this._samples.length >= this.maxSamples) this._finishStop(capturedAt, 'capacity')
    else if (reachedDuration) this._finishStop(capturedAt, 'duration')
    return sample
  }

  inspect() {
    const now = this._status === 'running' ? this._now() : this._stoppedAt
    return {
      status: this._status,
      sample_interval_ms: this.sampleIntervalMs,
      max_samples: this.maxSamples,
      max_duration_ms: this.maxDurationMs,
      sample_count: this._samples.length,
      started_at: this._startedAt == null ? null : new Date(this._startedAt).toISOString(),
      stopped_at: this._stoppedAt == null ? null : new Date(this._stoppedAt).toISOString(),
      stop_reason: this._stopReason,
      elapsed_ms: this._startedAt == null || now == null ? 0 : now - this._startedAt,
    }
  }

  export() {
    const samples = this._samples.map(sample => structuredClone(sample))
    return {
      contract: 'story-release-soak-v2',
      ...this.inspect(),
      summary: {
        heap_used_js_bytes: summarizeMetric(samples, ['memory', 'used_js_heap_size']),
        spine_instances: summarizeMetric(samples, ['spine', 'instances']),
        silhouette_instances: summarizeMetric(samples, ['spine', 'silhouettes']),
        silhouette_pending: summarizeMetric(samples, ['spine', 'pending_silhouettes']),
        active_audio_sources: summarizeMetric(samples, ['audio_session', 'active_sources']),
        audio_cleanup_timers: summarizeMetric(samples, ['audio_manager', 'cleanup_timers']),
        playback_timer_pending: summarizeMetric(samples, ['playback', 'timer_pending']),
        step_effect_timer_pending: summarizeMetric(samples, ['step_effects', 'timer_pending']),
        runtime_frame_pending: summarizeMetric(samples, ['runtime_frame_pending']),
        active_runtime_cues: summarizeMetric(samples, ['runtime_active_count']),
        active_screen_overlays: summarizeMetric(samples, ['stage', 'overlays', 'active_count']),
        stage_children: summarizeMetric(samples, ['stage', 'stage_children']),
        spine_container_children: summarizeMetric(samples, ['stage', 'spine_container_children']),
        debug_markers: summarizeMetric(samples, ['stage', 'debug_markers']),
        silhouette_relayout_jobs: summarizeMetric(samples, ['stage', 'silhouette_relayout_jobs']),
        story_viewers_live: summarizeMetric(samples, ['lifecycle', 'story_viewers_live']),
        pixi_stage_managers_live: summarizeMetric(samples, ['lifecycle', 'pixi_stage_managers_live']),
        story_audio_sessions_live: summarizeMetric(samples, ['lifecycle', 'story_audio_sessions_live']),
        audio_contexts_live: summarizeMetric(samples, ['lifecycle', 'audio_contexts_live']),
        audio_context_close_failures: summarizeMetric(samples, ['lifecycle', 'audio_context_close_failures']),
      },
      samples,
    }
  }
}

export const releaseSoakRecorder = new ReleaseSoakRecorder()
