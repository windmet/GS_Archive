import native from '../../config/song-combo-timing.v1.json' with { type: 'json' }
import { evaluateNativeCurve } from './SongChartHitEffectRenderer.js'
export { native as songComboTiming }

export function noteTimingSeconds(setting) {
  const steps=Math.max(native.timing.min,Math.min(native.timing.max,Math.round(Number(setting)||0)))
  return Math.fround(Math.fround(steps)*native.timing.stepMilliseconds)*native.timing.millisecondsToSeconds
}
export function delayedChartSeconds(mediaSeconds,setting) { return mediaSeconds-noteTimingSeconds(setting) }

// Counts are demonstration events, not touch judgements. The native clip is
// replayed at most once per three nominal 60Hz frames; media time keeps pause,
// rate changes and seeks deterministic rather than adding another rAF clock.
export function createSongComboPresentation() {
  let count=0,started=-Infinity
  function sample(frame,seek=false) {
    if(!frame) return null
    if(seek) { count=frame.count; started=-Infinity }
    else {
      for(const group of frame.crossed) {
        count+=group.events.length
        if(count>=native.animation.minCount && group.seconds-started>=native.animation.gateFrames/native.animation.sampleRate) started=group.seconds
      }
      count=frame.count
    }
    const age=frame.seconds-started
    return {count:Math.min(native.animation.maxCount,count),visible:count>=native.animation.minCount,
      scale:Number.isFinite(age)?evaluateNativeCurve(native.animation.scale.curve,Math.max(0,age),'x'):1,age}
  }
  return { sample }
}

export function comboLayout(count) {
  const digits=String(Math.max(0,Math.min(native.animation.maxCount,count))).split('')
  const pitch=native.layout.grid.cellWidth,width=(digits.length+1)*pitch
  const origin=native.layout.panel.rect.m_AnchoredPosition
  const digit=native.layout.digit.rect.m_SizeDelta,label=native.layout.label.rect.m_SizeDelta
  return {x:640+origin.x,y:-origin.y,left:-width/2,width,digits:digits.map((value,i)=>({
    value,x:-width/2+pitch*(i+.5)-digit.x/2,y:-digit.y/2,width:digit.x,height:digit.y,
    url:native.sprites['live_number_combo_'+value].url})),
    label:{x:-width/2+digits.length*pitch,y:-native.layout.grid.cellHeight/2-native.layout.label.rect.m_AnchoredPosition.y-label.y/2,width:label.x,height:label.y,url:native.sprites.live_combo_text.url}}
}
