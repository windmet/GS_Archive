import assert from 'node:assert/strict'
import { createMediaElementClock } from '../src/utils/mediaElementClock.js'

class FakeAudio extends EventTarget {
  currentTime = 0
  duration = NaN
  playbackRate = 1
  readyState = 0
  paused = true
  seeking = false
  ended = false
  error = null

  fire(name) { this.dispatchEvent(new Event(name)) }
}

const updates = []
const clock = createMediaElementClock(snapshot => updates.push(snapshot))
assert.equal(clock.getSnapshot().phase, 'idle')
assert.equal(clock.seek(3), false)

const audio = new FakeAudio()
clock.bind(audio)
assert.equal(clock.getSnapshot().phase, 'loading')
audio.readyState = 2
audio.duration = 130.6
audio.fire('loadedmetadata')
assert.deepEqual(clock.getSnapshot(), {
  phase: 'ready', currentTime: 0, duration: 130.6, playbackRate: 1, errorCode: null,
})
audio.paused = false
audio.readyState = 4
audio.fire('playing')
assert.equal(clock.getSnapshot().phase, 'playing')
audio.currentTime = 17.25
audio.fire('timeupdate')
assert.equal(clock.getSnapshot().currentTime, 17.25)
audio.fire('waiting')
assert.equal(clock.getSnapshot().phase, 'waiting')
audio.fire('canplay')
assert.equal(clock.getSnapshot().phase, 'playing')
audio.seeking = true
audio.fire('seeking')
assert.equal(clock.getSnapshot().phase, 'seeking')
audio.seeking = false
audio.fire('seeked')
assert.equal(clock.getSnapshot().phase, 'playing')
audio.playbackRate = 1.5
audio.fire('ratechange')
assert.equal(clock.getSnapshot().playbackRate, 1.5)
assert.equal(clock.seek(999), true)
assert.equal(audio.currentTime, 130.6)
audio.paused = true
audio.fire('pause')
assert.equal(clock.getSnapshot().phase, 'ready')
audio.ended = true
audio.fire('ended')
assert.equal(clock.getSnapshot().phase, 'ended')
audio.ended = false
audio.error = { code: 4 }
audio.fire('error')
assert.equal(clock.getSnapshot().phase, 'error')
assert.equal(clock.getSnapshot().errorCode, 4)

const replacement = new FakeAudio()
clock.bind(replacement)
assert.equal(clock.getSnapshot().phase, 'loading')
const count = updates.length
audio.fire('timeupdate')
assert.equal(updates.length, count, 'replaced media must not retain listeners')
clock.dispose()
assert.equal(clock.getSnapshot().phase, 'idle')
replacement.fire('timeupdate')
assert.equal(updates.length, count + 1, 'disposed media must not retain listeners')
console.log('Media element clock verified: load, play, waiting, seek, rate, end, error, replacement and dispose')
