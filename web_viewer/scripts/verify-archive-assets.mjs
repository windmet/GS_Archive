import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { createArchiveServer } from '../server.js'
import { createArchiveAssetResolver, loadArchiveAssetRoots, isWithinRoot } from './lib/archive-assets.mjs'

const viewerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = await mkdtemp(path.join(os.tmpdir(), 'sidem-asset-contract-'))
const keys = ['SIDEM_ARCHIVE_SOURCES_CONFIG', 'SIDEM_AUDIO_ROOT', 'SIDEM_LEGACY_AUDIO_ROOT', 'SIDEM_LIPSYNC_ROOT', 'SIDEM_CARD_ART_ROOT']
const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]))
let vite, production

async function put(relative, contents) {
  const file = path.join(root, relative)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, contents)
  return file
}

try {
  const configPath = await put('sources.json', JSON.stringify({ schema_version: 1, archive_root: '.', legacy_root: 'legacy' }))
  const environment = { SIDEM_ARCHIVE_SOURCES_CONFIG: configPath }
  const roots = loadArchiveAssetRoots({ environment })
  assert.equal(roots.audio, path.join(root, 'legacy/GS_Res/Audio'))
  const overrideNames = { audio: 'SIDEM_AUDIO_ROOT', legacyAudio: 'SIDEM_LEGACY_AUDIO_ROOT', lipsync: 'SIDEM_LIPSYNC_ROOT', cardArt: 'SIDEM_CARD_ART_ROOT' }
  for (const [name, key] of Object.entries(overrideNames)) {
    assert.equal(loadArchiveAssetRoots({ environment: { ...environment, [key]: root } })[name], root)
  }
  const resolver = createArchiveAssetResolver(roots)
  // Ordered candidates are part of the compatibility contract: direct cues win.
  assert.deepEqual(resolver.audioCandidates('/se/step_walk_come_conc_boot.ogg'), [
    ...['step_walk_come_conc_boot', 'step_walk_come_conc_boot_hall', 'step_walk_come_conc_boot_slow'].flatMap(cue => [
      ...['sfx', 'telephone', 'system'].map(dir => path.join(roots.audio, dir, `${cue}.ogg`)),
      path.join(roots.legacyAudio, `${cue}.ogg`),
    ]),
  ])
  assert.deepEqual(resolver.audioCandidates('/unknown/test.ogg'), [])
  assert.deepEqual(resolver.audioCandidates('/se/'), [])
  assert.deepEqual(resolver.audioCandidates('/se/../../../../outside.ogg'), [])
  assert.equal(resolver.lipsyncPath('/../outside.json'), null)
  assert.equal(resolver.cardArtPath('/portrait/../outside.png'), null)
  assert.equal(resolver.cardArtPath('/unknown/image_card_portrait_001tom.png'), null)
  assert.equal(isWithinRoot(root, `${root}-neighbor/file`), false)
  assert.equal(isWithinRoot(root, root), false)

  await put('dist/index.html', '<html>fixture fallback</html>')
  const cases = []
  async function asset(relative, url, body, mime) {
    await put(relative, body)
    cases.push({ url, body, mime })
  }
  const audio = 'legacy/GS_Res/Audio'
  await asset(`${audio}/sfx/priority.ogg`, '/assets/audio/se/priority.ogg', 'sfx wins', 'audio/ogg')
  await put(`${audio}/telephone/priority.ogg`, 'lower priority telephone')
  await put(`${audio}/system/priority.ogg`, 'lower priority system')
  await put('legacy/story_viewer/voice_ogg/priority.ogg', 'lower priority legacy')
  await asset(`${audio}/telephone/phone.ogg`, '/assets/audio/se/phone.ogg', 'telephone fallback', 'audio/ogg')
  await asset(`${audio}/system/system.ogg`, '/assets/audio/se/system.ogg', 'system fallback', 'audio/ogg')
  await asset('legacy/story_viewer/voice_ogg/old.ogg', '/assets/audio/se/old.ogg', 'legacy fallback', 'audio/ogg')
  await asset(`${audio}/sfx/group_step_walk_conc_sneaker.ogg`, '/assets/audio/se/step_walk_away_conc_sneaker.ogg', 'walk alias', 'audio/ogg')
  await asset(`${audio}/sfx/group_step_run_conc_sneaker.ogg`, '/assets/audio/se/step_run_come_conc_sneaker.ogg', 'run alias', 'audio/ogg')
  await asset(`${audio}/sfx/step_walk_come_conc_boot_hall.ogg`, '/assets/audio/se/step_walk_away_conc_boot.ogg', 'boot hall', 'audio/ogg')
  await put(`${audio}/sfx/step_walk_come_conc_boot_slow.ogg`, 'lower priority boot slow')
  await asset(`${audio}/ambient/room.ogg`, '/assets/audio/ambient/room_t.ogg', 'ambient fallback', 'audio/ogg')
  await asset(`${audio}/ambient/exact_t.ogg`, '/assets/audio/ambient/exact_t.ogg', 'exact ambient wins', 'audio/ogg')
  await put(`${audio}/ambient/exact.ogg`, 'lower priority ambient')
  await asset(`${audio}/bgm/day.ogg`, '/assets/audio/bgm/day.ogg?version=1', 'query stripped', 'audio/ogg')
  await asset(`${audio}/bgm/space cue.ogg`, '/assets/audio/bgm/space%20cue.ogg', 'decoded name', 'audio/ogg')
  await asset('legacy/scripts/lipsyncdata/adxlip/example.json', '/assets/lipsync/adxlip/example.json?v=1', '{"lip":1}', 'application/json')
  for (const kind of ['portrait', 'landscape']) {
    await asset(`legacy/GS_Res/ALL_PHOTOS/assets/resources/image/image_card/image_card_${kind}/image_card_${kind}_001tom.png`, `/assets/card-art/${kind}/image_card_${kind}_001tom.png`, `${kind} fixture`, 'image/png')
  }

  for (const key of keys) delete process.env[key]
  process.env.SIDEM_ARCHIVE_SOURCES_CONFIG = configPath
  vite = await createServer({ root: viewerRoot, configFile: path.join(viewerRoot, 'vite.config.js'), configLoader: 'native', publicDir: false, logLevel: 'error', server: { host: '127.0.0.1', port: 0, watch: null } })
  await vite.listen()
  production = createArchiveServer({ distDir: path.join(root, 'dist') })
  production.listen(0, '127.0.0.1')
  await once(production, 'listening')
  for (const [name, server] of [['vite', vite.httpServer], ['standalone', production]]) {
    const base = `http://127.0.0.1:${server.address().port}`
    for (const { url, body, mime } of cases) {
      const response = await fetch(base + url)
      assert.equal(response.status, 200, `${name}: ${url}`)
      assert.ok(response.headers.get('content-type')?.startsWith(mime), `${name}: ${url} MIME`)
      assert.equal(await response.text(), body, `${name}: ${url} body`)
      if (mime === 'image/png') assert.equal(response.headers.get('cache-control'), 'public, max-age=86400')
    }
    const forbidden = await fetch(`${base}/assets/lipsync/adxlip/%2e%2e%2foutside.json`)
    assert.equal(forbidden.status, 403)
    await forbidden.text()
  }
  // Standalone retains the dist fallback for resources not mounted externally.
  const missing = await fetch(`http://127.0.0.1:${production.address().port}/assets/audio/se/missing.ogg`)
  assert.equal(await missing.text(), '<html>fixture fallback</html>')
  console.log(`Archive assets: root precedence, ordered resolution, containment and ${cases.length * 2} real HTTP asset responses passed (Vite + standalone). Fixture bytes only; not real-media acceptance.`)
} finally {
  await vite?.close()
  if (production) {
    production.closeAllConnections()
    await new Promise((resolve, reject) => production.close(error => error ? reject(error) : resolve()))
  }
  for (const key of keys) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
  // root is the unique mkdtemp directory created by this verifier.
  await rm(root, { recursive: true, force: true })
}
