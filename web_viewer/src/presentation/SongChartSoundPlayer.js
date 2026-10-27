import manifest from '../../config/song-chart-sounds.v1.json' with { type: 'json' }
export { manifest as songChartSounds }

export function songSoundRole(event, set = 'se1') {
  if (event.endpoint === 'middle') return null
  if (event.role.startsWith('swipe_')) return 'flick'
  // GetTapSE uses PSkillTap for LARGE only on the April Fools branch.
  // Selecting that set globally intentionally applies that branch to any song.
  if (event.role === 'p_skill' && set === 'president') return 'pskill'
  if (event.role === 'sp') return null // shared ACB Special is separate
  return 'perfect'
}

// One scheduler follows the existing media clock. A short lookahead schedules
// buffers precisely; seeking/pausing cancels them rather than replaying crossed
// events or letting a hidden tab catch up with a burst of old sounds.
export function createSongChartSoundPlayer({ contextFactory = () => new (window.AudioContext || window.webkitAudioContext)(), fetchAudio = url => fetch(url) } = {}) {
  let context, gain, groups = [], index = 0, generation = 0, selected = 'off', last = -Infinity, scheduled = 0
  const buffers = new Map(), sources = new Set()
  function cancel() {
    for (const source of sources) { try { source.stop() } catch {} }
    sources.clear(); last = -Infinity
  }
  function seek(seconds) {
    cancel(); last = seconds; index = groups.findIndex(g => g.seconds > seconds)
    if (index < 0) index = groups.length
  }
  async function prepare(set) {
    const token = ++generation
    cancel(); selected = set
    if (!manifest.sets[set]) return
    context ||= contextFactory()
    if (!gain) { gain = context.createGain(); gain.connect(context.destination) }
    // resume is called synchronously inside the user's click before fetching.
    await context.resume()
    await Promise.all([...new Set(Object.values(manifest.sets[set]))].map(async id => {
      if (buffers.has(id)) return
      const response = await fetchAudio(manifest.assets[id].url)
      if (!response.ok) throw Error('效果音加载失败')
      buffers.set(id, await context.decodeAudioData(await response.arrayBuffer()))
    }))
    return token === generation
  }
  function paint(seconds, rate = 1, volume = 1) {
    if (!context || context.state !== 'running' || !manifest.sets[selected]) return
    gain.gain.value = volume
    if (Number.isFinite(last) && (seconds < last || seconds - last > .3)) seek(seconds)
    last = seconds
    const until = seconds + .12 * rate
    while (index < groups.length && groups[index].seconds <= until) {
      const group = groups[index++]
      if (group.seconds < seconds - .025) continue
      // Native same-timing suppression: one of each sound kind per timestamp.
      for (const role of new Set(group.events.map(e => songSoundRole(e,selected)).filter(Boolean))) {
        const id = manifest.sets[selected][role], buffer = buffers.get(id)
        if (!buffer) continue
        const source = context.createBufferSource()
        source.buffer = buffer; source.connect(gain); sources.add(source)
        source.onended = () => { sources.delete(source); source.disconnect() }
        source.start(context.currentTime + Math.max(0, (group.seconds - seconds) / rate))
        scheduled++
      }
    }
  }
  return { prepare, paint, seek, cancel,
    get stats() { return { scheduled, active:sources.size, decoded:buffers.size, context:context?.state || 'idle' } },
    setTimeline(timeline) { groups = timeline?.groups || []; seek(0) },
    dispose() { generation++; cancel(); void context?.close() },
  }
}
