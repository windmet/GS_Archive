import assert from 'node:assert/strict'
import { buildArchiveUrl, readArchiveRoute, normalizeArchiveRoute, buildArchiveSourceQuery, readArchiveSourceRoute, archiveSectionForRoute } from '../src/core/archiveRoute.js'

import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
const runtime = useArchiveNavigationState()
runtime.view.value = 'chart_lab'
runtime.currentSongId.value = 'drvalv'
runtime.detailSourceRoute.value = buildArchiveSourceQuery({ view: 'song_detail', song: 'drvalv' })
const runtimeUrl = buildArchiveUrl('http://localhost/', runtime.currentArchiveRoute())
assert.equal(readArchiveRoute(runtimeUrl).view, 'chart_lab')
assert.equal(readArchiveRoute(runtimeUrl).song, 'drvalv')
assert.equal(readArchiveSourceRoute(readArchiveRoute(runtimeUrl).sourceRoute).song, 'drvalv')

const origin = 'http://localhost/'
const song = { view: 'song_detail', song: 'drvalv', songScope: 'layered', query: 'DRIVE' }
const sourceRoute = buildArchiveSourceQuery(song)
const lab = readArchiveRoute(buildArchiveUrl(origin, { view: 'chart_lab', song: 'drvalv', sourceRoute }))
assert.equal(lab.view, 'chart_lab')
assert.equal(lab.song, 'drvalv')
const source = readArchiveSourceRoute(lab.sourceRoute)
assert.equal(source.view, 'song_detail')
assert.equal(source.song, 'drvalv')
assert.equal(source.query, 'DRIVE')
assert.equal(source.songScope, 'layered')
// The tools entry opens the chart tool itself; it picks its song inside, never via the song catalogue.
assert.equal(normalizeArchiveRoute({ view: 'chart_lab' }).view, 'chart_lab')
assert.equal(normalizeArchiveRoute({ view: 'chart_lab' }).song || '', '')
assert.equal(archiveSectionForRoute(lab), 'experiments')
assert.equal(readArchiveRoute(buildArchiveUrl(origin, { view: 'experiments' })).view, 'experiments')
const studio = readArchiveRoute(buildArchiveUrl(origin, { view: 'picture_studio', photoIdol: '1', photoEntity: 'poses:1', sourceRoute: buildArchiveSourceQuery({ view: 'photo_catalog', photoIdol: '1', photoEntity: 'poses:1' }) }))
assert.equal(studio.view, 'picture_studio')
assert.equal(studio.photoEntity, 'poses:1')
assert.equal(readArchiveSourceRoute(studio.sourceRoute).photoIdol, '1')
assert.equal(normalizeArchiveRoute({ view: 'chart_lab', song: 'drvalv', sourceRoute: '?view=chart_lab&song=drvalv' }).sourceRoute, undefined)
// The tools entry opens the chart tool (which picks its song inside), and the tool owns the song
// data it shows: without that ownership the detail was released on entry and the page never loaded.
const { readFileSync } = await import('node:fs')
const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
assert.match(app, /<ArchiveExperiments [^>]*@charts="openChartTool"/)
assert.doesNotMatch(app, /@charts="openSongCatalog"/)
assert.match(app, /\[songReadModelCatalog,songReadModelDetail,\[[^\]]*'chart_lab'[^\]]*\]\]/)
assert.match(app, /<ArchiveChartLab [^>]*:songs="chartSongs"[^>]*@select-song="selectChartSong"/)
console.log('Experiment routes: chart reload identity, exact source return, song-less chart tool, studio source and bounded tool nesting passed')
