import { createApp } from '/node_modules/vue/dist/vue.runtime.esm-bundler.js'
import Chart from '/src/components/archive/ArchiveSongChartPreview.vue'
import { getSongFullMixUrl } from '/src/utils/AssetResolver.js'
import { buildSongChartTiming } from '/src/presentation/SongChartTiming.js'
import { compileSongChartDemonstration } from '/src/presentation/SongChartDemonstration.js'

const byId = id => document.getElementById(id)
const status = byId('status'), result = byId('result'), run = byId('run'), download = byId('download')
const songs = (await (await fetch('/data/song_catalog.json')).json()).songs
let app, downloadUrl
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

async function until(test, message, timeout = 15000) {
  const deadline = performance.now() + timeout
  while (!test()) {
    if (performance.now() >= deadline) throw new Error(message)
    await delay(20)
  }
}

function summary(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return { n: 0 }
  const at = fraction => Number(sorted[Math.ceil(sorted.length * fraction) - 1].toFixed(3))
  return { n: sorted.length, p50: at(.5), p95: at(.95), p99: at(.99), max: at(1) }
}

function layerTotals(values) {
  return {
    draws: summary(values.map(v => v.draws)),
    bytes: summary(values.map(v => v.bytes)),
    totalDraws: values.reduce((sum, v) => sum + v.draws, 0),
    totalBytes: values.reduce((sum, v) => sum + v.bytes, 0),
  }
}

function summarize(sample) {
  const rows = [...sample.frames.values()]
  const layer = name => rows.flatMap(frame => frame[name] ? [frame[name]] : [])
  const hold = layer('hold'), effect = layer('effect')
  const intervals = sample.raf.slice(1).map((time, i) => time - sample.raf[i])
  return {
    mode: sample.mode,
    media: [sample.mediaFrom, sample.mediaTo],
    rafMs: summary(intervals),
    longRaf: { over33ms: intervals.filter(ms => ms > 33.5).length, over50ms: intervals.filter(ms => ms > 50).length },
    trackFrames: rows.length,
    combo315Frames: layer('svg').filter(v => v.combo315).length,
    geometryMs: summary(layer('geometry').map(v => v.ms)),
    visibleNotes: summary(layer('geometry').map(v => v.notes)),
    vueTrackUpdateMs: summary(layer('svg').map(v => v.ms)),
    hold: { ...layerTotals(hold), ms: summary(hold.map(v => v.ms)), vertices: summary(hold.map(v => v.vertices)) },
    effect: {
      ...layerTotals(effect), ms: summary(effect.map(v => v.ms)), sampleMs: summary(effect.map(v => v.sampleMs)),
      particles: summary(effect.map(v => v.particles)), canvas2dFrames: effect.filter(v => v.renderer === 'canvas2d-fallback').length,
      observedLostFrames: effect.filter(v => v.contextLost).length,
    },
    sync: {
      // A missing submission means the sampled id was not recorded by an expected layer.
      missingSvg: rows.filter(v => !v.svg).length,
      expectedHold: rows.filter(v => v.svg?.holdExpected).length,
      missingHold: rows.filter(v => v.svg?.holdExpected && !v.hold).length,
      holdSvgFallbackFrames: rows.filter(v => v.svg?.holdFallback).length,
      expectedEffect: rows.filter(v => v.svg?.effectExpected).length,
      missingEffect: rows.filter(v => v.svg?.effectExpected && !v.effect).length,
      holdSubmitAfterSvgMs: summary(rows.flatMap(v => v.svg && v.hold ? [v.hold.at - v.svg.at] : [])),
      effectSubmitAfterSvgMs: summary(rows.flatMap(v => v.svg && v.effect ? [v.effect.at - v.svg.at] : [])),
    },
    events: sample.events,
    warnings: sample.warnings,
  }
}

async function capture(mode, code, difficulty, song, start, seconds) {
  app?.unmount()
  const sample = { mode, frames: new Map(), raf: [], events: [], warnings: [] }
  let active = false
  const audit = {
    mode,
    record(frame, name, stats) {
      if (!active || !frame) return
      if (name === 'track') sample.frames.set(frame.id, { ...frame })
      else {
        const row = sample.frames.get(frame.id)
        if (row) row[name] = { ...stats, at: performance.now() }
      }
    },
    event(type) { if (active) sample.events.push({ type, at: performance.now() }) },
  }
  app = createApp(Chart, {
    standalone: true, songCode: code, title: song.title,
    difficulties: [difficulty], audioTrack: { url: getSongFullMixUrl(code) },
  })
  app.provide('song-chart-audit', audit)
  const player = app.mount('#app')
  try {
    await until(() => document.querySelector('.track-svg'), '谱面加载超时')
    const audio = document.querySelector('audio'), slider = document.querySelector('[aria-label="谱面时间轴"]')
    for (const type of ['waiting', 'stalled', 'seeking', 'seeked', 'pause', 'ratechange']) {
      audio.addEventListener(type, () => {
        if (active) sample.events.push({ type, time: audio.currentTime, at: performance.now() })
      })
    }
    audio.preload = 'auto'
    audio.load()
    await until(() => audio.readyState >= 1 || audio.error, '音频元数据加载超时')
    if (audio.error) throw new Error('音频加载失败（' + audio.error.code + '）')
    if (start + seconds > audio.duration) throw new Error('采样区间超过音频时长')
    slider.value = String(Math.max(0, start - .5))
    slider.dispatchEvent(new Event('input', { bubbles: true }))
    document.querySelector('.chart-play').click()
    await until(() => !audio.paused && audio.readyState >= 3, '音频播放超时')
    await until(() => audio.currentTime >= start, '音频未到达采样起点')
    sample.mediaFrom = audio.currentTime
    active = true
    const began = performance.now()
    let frameRequest
    const observe = now => {
      sample.raf.push(now)
      frameRequest = requestAnimationFrame(observe)
    }
    const visibility = () => {
      if (document.visibilityState !== 'visible' || !document.hasFocus()) {
        sample.warnings.push('页面隐藏或失去焦点')
      }
    }
    visibility()
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('blur', visibility)
    frameRequest = requestAnimationFrame(observe)
    try {
      await until(() => audio.currentTime >= start + seconds || audio.ended, '音频停滞', (seconds + 10) * 1000)
    } finally {
      active = false
      cancelAnimationFrame(frameRequest)
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('blur', visibility)
      sample.mediaTo = audio.currentTime
    }
    if (sample.mediaTo - sample.mediaFrom < (performance.now() - began) / 1000 * .95) {
      sample.warnings.push('媒体推进落后于墙钟')
    }
    return { summary: summarize(sample), frames: [...sample.frames.values()], raf: sample.raf }
  } finally {
    player.pause()
  }
}

run.disabled = false
status.textContent = '就绪'
run.onclick = async () => {
  run.disabled = true
  download.hidden = true
  result.textContent = ''
  try {
    const code = byId('song').value, song = songs[code], difficulty = song.gameplay.difficulties.find(d => d.type === 4)
    const chart = await (await fetch(difficulty.chart.url)).json()
    const timing = buildSongChartTiming(chart)
    const seconds = Math.min(60, Math.max(3, byId('duration').valueAsNumber || 8))
    const milestone = compileSongChartDemonstration(chart).events[314]?.seconds
    const requestedStart = byId('milestone').checked && Number.isFinite(milestone) ? milestone - 1 : byId('start').valueAsNumber
    const defaults = { ldyrdm: 40, infoct: (timing.segments[1]?.seconds ?? 3) - 1.5, cfprde: 12, knwonl: 60, remasq: 18 }
    const start = Math.round(Math.max(0, Math.min(timing.duration - seconds, Number.isFinite(requestedStart) ? requestedStart : defaults[code])) * 100) / 100
    const report = {
      code, start, seconds, milestone, speed: 5, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      browser: navigator.userAgent, limitation: 'CPU and JS layer submissions only. GPU present times require a device trace.',
      samples: [],
    }
    const show = () => {
      result.textContent = JSON.stringify({ ...report, samples: report.samples.map(s => s.summary) }, null, 2)
    }
    for (const mode of ['A', 'B', 'C', 'D']) {
      status.textContent = '正在采样 ' + mode
      report.samples.push(await capture(mode, code, difficulty, song, start, seconds))
      show()
    }
    if (downloadUrl) URL.revokeObjectURL(downloadUrl)
    downloadUrl = URL.createObjectURL(new Blob([JSON.stringify(report)], { type: 'application/json' }))
    download.href = downloadUrl
    download.hidden = false
    status.textContent = '采样完成'
  } catch (error) {
    status.textContent = '失败：' + error.message
  } finally {
    run.disabled = false
  }
}
