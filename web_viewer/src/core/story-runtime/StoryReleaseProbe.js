const emptyAudioSession = () => ({
  context_state: 'uninitialized',
  pause_reasons: [],
  active_sources: 0,
  sources: [],
  disabled: false,
  disposed: true,
})

const emptyAudioManager = () => ({
  bgm_cue: null,
  ambient_cue: null,
  has_bgm_source: false,
  has_ambient_source: false,
  cleanup_timers: 0,
})

const emptyPlayback = () => ({
  auto_enabled: false,
  skip_enabled: false,
  paused: [],
  timer_pending: 0,
})

const emptyStage = () => ({
  stage_children: 0,
  spine_container_children: 0,
  debug_markers: 0,
  silhouette_relayout_jobs: 0,
  overlays: { active_count: 0 },
})

function memorySnapshot() {
  const memory = globalThis.performance?.memory
  return memory ? {
    used_js_heap_size: memory.usedJSHeapSize,
    total_js_heap_size: memory.totalJSHeapSize,
    js_heap_size_limit: memory.jsHeapSizeLimit,
  } : null
}

export class StoryReleaseProbe {
  constructor() {
    this._viewerCollectors = new Set()
    this._stageManagers = new Set()
    this._audioSessions = new Set()
    this._audioContextsCreated = 0
    this._audioContextsClosed = 0
    this._audioContextCloseFailures = 0
  }

  registerViewer(collector) {
    if (typeof collector !== 'function') throw new TypeError('viewer collector must be a function')
    this._viewerCollectors.add(collector)
    return () => this._viewerCollectors.delete(collector)
  }

  registerStageManager(manager) {
    if (!manager || typeof manager !== 'object') throw new TypeError('stage manager is required')
    this._stageManagers.add(manager)
    return () => this._stageManagers.delete(manager)
  }

  registerAudioSession(session) {
    if (!session || typeof session !== 'object') throw new TypeError('audio session is required')
    this._audioSessions.add(session)
    return () => this._audioSessions.delete(session)
  }

  audioContextCreated() {
    this._audioContextsCreated++
  }

  audioContextClosed() {
    this._audioContextsClosed++
  }

  audioContextCloseFailed() {
    this._audioContextCloseFailures++
  }

  inspect() {
    return Object.freeze({
      story_viewers_live: this._viewerCollectors.size,
      pixi_stage_managers_live: this._stageManagers.size,
      story_audio_sessions_live: this._audioSessions.size,
      audio_contexts_created: this._audioContextsCreated,
      audio_contexts_closed: this._audioContextsClosed,
      audio_contexts_live: Math.max(0, this._audioContextsCreated - this._audioContextsClosed),
      audio_context_close_failures: this._audioContextCloseFailures,
    })
  }

  collectSnapshot() {
    const collector = [...this._viewerCollectors].at(-1)
    const current = collector?.() || {}
    const viewerAttached = Boolean(collector)
    return {
      captured_at: new Date().toISOString(),
      route: current.route || globalThis.location?.href || '',
      step: current.step || { index: null, id: null, type: null },
      visibility: current.visibility || {
        state: globalThis.document?.visibilityState || 'unknown',
        hidden: Boolean(globalThis.document?.hidden),
        debug_override: null,
        pause_reasons: [],
      },
      audio_session: current.audio_session || emptyAudioSession(),
      audio_manager: current.audio_manager || emptyAudioManager(),
      playback: current.playback || emptyPlayback(),
      step_effects: current.step_effects || { timer_pending: 0 },
      runtime: current.runtime || null,
      runtime_active_count: current.runtime_active_count || 0,
      runtime_frame_pending: Number(Boolean(current.runtime_frame_pending)),
      spine: current.spine || {
        instances: 0,
        ids: [],
        silhouettes: 0,
        silhouette_ids: [],
        pending_silhouettes: 0,
        pending_silhouette_ids: [],
      },
      stage: current.stage || emptyStage(),
      memory: current.memory || memorySnapshot(),
      endpoint: { viewer_attached: viewerAttached },
      lifecycle: this.inspect(),
    }
  }
}

export const storyReleaseProbe = new StoryReleaseProbe()
