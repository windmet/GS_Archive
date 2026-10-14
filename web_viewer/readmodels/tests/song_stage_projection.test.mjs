import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { readCheckout } from '../lib/checkout_adapter.mjs'

const viewer = fileURLToPath(new URL('../..', import.meta.url))

test('[local-corpus] song leaves carry the same primary stage entry as the source manifest', async () => {
  const source = JSON.parse(await fs.readFile(new URL('../../public/data/song_timelines/manifest.json', import.meta.url), 'utf8'))
  const { product } = await readCheckout(viewer, { dataRevision: 'test', mediaEpoch: 'test' })
  assert.equal(source.schemaVersion, 1)
  assert.equal(source.timeUnit, 'ms')
  for (const song of product.songs) {
    const expected = (source.songs[song.song_code] || [])
      .find(entry => !entry.variant && ['choreography_candidate', 'special_single'].includes(entry.stageKind)) || null
    const actual = product.songViews[song.song_code].stageCandidate
    assert.deepEqual(actual, expected ? { id: expected.id, stageKind: expected.stageKind } : null, song.song_code)
  }
  assert.equal(product.songViews.brndnf.stageCandidate?.id, 'brndnf_live_effect')
  assert.equal(product.songViews.drv999.stageCandidate?.stageKind, 'special_single')
})

test('[local-corpus] song leaves name their albums and official 3D live videos', async () => {
  const { product } = await readCheckout(viewer, { dataRevision: 'test', mediaEpoch: 'test' })
  const views = product.songViews
  assert.ok(Object.values(views).every(view => view.albums.length === view.links.length), 'every master-data link has a curated album')
  assert.deepEqual(views.drvalv.albums, [{ url: 'https://lnk.to/LACM-24181s',
    title: 'THE IDOLM@STER SideM GROWING SIGN@L 01 Growing Smiles！', catalogNumber: 'LACM-24181' }])
  const withVideo = Object.entries(views).filter(([, view]) => view.officialVideos.length)
  assert.equal(withVideo.length, 16)
  assert.equal(withVideo.filter(([, view]) => view.officialVideos[0].source === 'growing_stars').length, 11)
  // Every GROWING STARS 3D MV the client ships has its official upload; MV LIVE (reason) has none.
  for (const [code, view] of Object.entries(views)) {
    if (view.movies.some(movie => movie.title === '3DMV')) assert.equal(view.officialVideos[0]?.source, 'growing_stars', code)
  }
  assert.deepEqual(views.reason.officialVideos, [])
  assert.equal(views.wathon.officialVideos[0].youtubeId, 'HeiptD9Hb-k')
})
