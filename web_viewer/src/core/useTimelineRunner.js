import { getCachedMotionSetting } from '../utils/IdolMotionSettingStore.js'

export function useTimelineRunner({ spineStageRef, currentStep }) {
  let _timelineEvents = []
  const _firedTimeline = new Set()
  let _timelineStartTime = 0
  let _timelineRAF = false

  function _fireTimelineEvent(event, eventIndex) {
    const mgr = spineStageRef.value?.manager
    if (!mgr) return
    const eventKey = `timeline:${currentStep.value?.step_id || 0}:${eventIndex}`
    console.log('[Timeline] fire:', event.type, event.chara_id, event.value, 'at', event.time + 's')
    if (event.type === 'spine_face') {
      mgr.updateSpineFace(event.chara_id, event.value, {
        anim_flag: event.anim_flag,
        blush_flag: event.blush_flag,
        sweat_flag: event.sweat_flag,
      })
    } else if (event.type === 'spine_anim') {
      const modelId = mgr.spineInstances?.[event.chara_id]?.modelId || ''
      const motionSetting = getCachedMotionSetting(event.chara_id, modelId, event.value)
      mgr.playSpineAnim?.(event.chara_id, event.value, false, !!event.no_back, motionSetting, true, 0.3)
    } else if (event.type === 'spine_neck_anim') {
      mgr.playSpineNeckAnim?.(event.chara_id, event.value, eventKey)
    } else if (event.type === 'spine_neck_stop') {
      mgr.stopSpineNeckAnim?.(event.chara_id, eventKey)
    } else if (event.type === 'spine_color') {
      mgr.setSpineColor(event.chara_id, event.value, event.duration ?? 0, 0)
    }
  }

  function _tickTimeline() {
    if (!_timelineRAF) return
    if (_firedTimeline.size >= _timelineEvents.length) {
      _timelineRAF = false
      return
    }

    const elapsed = (performance.now() - _timelineStartTime) / 1000

    for (let i = 0; i < _timelineEvents.length; i++) {
      if (_firedTimeline.has(i)) continue
      if (elapsed >= _timelineEvents[i].time) {
        _fireTimelineEvent(_timelineEvents[i], i)
        _firedTimeline.add(i)
      }
    }

    requestAnimationFrame(_tickTimeline)
  }

  function startTimeline() {
    cancelTimeline()
    const step = currentStep.value
    if (!step?.timeline || step.timeline.length === 0) {
      _timelineEvents = []
      return
    }
    _timelineEvents = step.timeline
    _firedTimeline.clear()
    _timelineStartTime = performance.now()
    _timelineRAF = true
    _tickTimeline()
  }

  function fastForwardTimeline() {
    if (!_timelineEvents || _timelineEvents.length === 0) return
    for (let i = 0; i < _timelineEvents.length; i++) {
      if (_firedTimeline.has(i)) continue
      _fireTimelineEvent(_timelineEvents[i], i)
      _firedTimeline.add(i)
    }
    cancelTimeline()
  }

  function cancelTimeline() {
    _timelineRAF = false
    _timelineEvents = []
    _firedTimeline.clear()
  }

  return {
    startTimeline,
    fastForwardTimeline,
    cancelTimeline,
  }
}
