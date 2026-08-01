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
if (!entry.solo_tracks?.['001tom']?.vocal?.url) fail('001tom vocal track is missing')
if (!entry.solo_tracks?.['001tom']?.backing?.url) fail('001tom backing relation is missing')
if (entry.solo_tracks['001tom'].sync?.sample_delta > 1 || entry.solo_tracks['001tom'].sync?.sample_delta < -1) {
  fail('solo/backing metadata delta exceeds one sample')
}
if (!Array.isArray(entry.unit_tracks) || entry.unit_tracks.length < 1) fail('no unit single-track candidate is listed')

if (mounted) {
  const base = process.env.SONG_EXPERIMENTAL_BASE_URL || 'http://127.0.0.1:5174'
  const urls = [
    entry.single_tracks.full_mix.url,
    entry.backing.url,
    entry.solo_tracks['001tom'].vocal.url,
    entry.solo_tracks['001tom'].backing.url,
  ]
  for (const path of urls) {
    const response = await fetch(new URL(path, base))
    if (!response.ok) fail(`${path} returned HTTP ${response.status}`)
  }
}

console.log(`Song experimental audio contract OK${mounted ? ' (mounted)' : ''}`)
