#!/usr/bin/env node

import fs from 'node:fs'
import process from 'node:process'

const mounted = process.argv.includes('--mounted')
const root = new URL('..', import.meta.url)
const manifestPath = new URL('public/data/song_experimental_audio.json', root)
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

function fail(message) {
  throw new Error(`[song-experimental-audio] ${message}`)
}

if (manifest.schema_version !== 1 || manifest.status !== 'experimental' || manifest.scope !== 'song_detail_only') {
  fail('manifest must be the v1 song-detail-only experimental contract')
}
const entry = manifest.songs?.drvalv
if (!entry) fail('drvalv sample is missing')
if (!entry.single_tracks?.full_mix?.url) fail('full-mix single track is missing')
if (!entry.backing?.url) fail('backing track is missing')
const soloEntries = Object.entries(entry.solo_tracks || {})
if (soloEntries.length !== 49) fail(`expected all 49 idol vocal candidates, found ${soloEntries.length}`)
for (const [idolCode, solo] of soloEntries) {
  if (!solo.vocal?.url) fail(`${idolCode} vocal track is missing`)
  if (!solo.backing?.url) fail(`${idolCode} backing relation is missing`)
  if (solo.sync?.sample_delta > 1 || solo.sync?.sample_delta < -1) {
    fail(`${idolCode} solo/backing metadata delta exceeds one sample`)
  }
}
if (!Array.isArray(entry.unit_tracks) || entry.unit_tracks.length < 1) fail('no unit single-track candidate is listed')

if (mounted) {
  const base = process.env.SONG_EXPERIMENTAL_BASE_URL || 'http://127.0.0.1:5174'
  const urls = new Set([
    entry.single_tracks.full_mix.url,
    entry.backing.url,
    ...soloEntries.flatMap(([, solo]) => [solo.vocal.url, solo.backing.url]),
  ])
  for (const path of urls) {
    const response = await fetch(new URL(path, base))
    if (!response.ok) fail(`${path} returned HTTP ${response.status}`)
  }
}

console.log(`Song experimental audio contract OK${mounted ? ' (mounted)' : ''}`)
