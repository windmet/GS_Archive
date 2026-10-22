import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createArchiveAssetResolver, loadArchiveAssetRoots, isWithinRoot } from './lib/archive-assets.mjs'
import { loadArchiveSources } from './lib/archive-sources.mjs'
import { NON_WAVEFORM_SE_CUES } from '../src/core/AudioManager.js'

// Converts the story BGM, ambience and SE cues the legacy converted library (GS_Res/Audio) never had, straight
// from RAW, into <derived_root>/audio/<bgm|ambient|sfx>/<cue>.ogg — the last place the shared resolver
// (scripts/lib/archive-assets.mjs) looks, so the dev server, the preview export and the 配乐 catalogue all find
// them. A BGM or ambience cue is its own same-stem ACB (the AWB when the ACB holds no streams); an SE cue is the
// one subsong of the se_*.acb banks whose stream name lists it. The encoding matches the legacy library:
// vgmstream's default render (two loops and a 10 s fade when the stream loops), Vorbis 160k stereo / 96k mono.
// Song cues (song3_<code>) are not converted here: they play the song's full mix (AssetResolver.getBgmUrl).
// config/derived_story_audio.json records each file's RAW source, subsong and bytes.
// Usage: node scripts/build-derived-story-audio.mjs [--check]
const viewerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(viewerRoot, 'config/derived_story_audio.json')
const check = process.argv.includes('--check')

const sources = loadArchiveSources()
const config = JSON.parse(fs.readFileSync(sources.configPath, 'utf8'))
const roots = loadArchiveAssetRoots({ sources })
const resolver = createArchiveAssetResolver(roots)
const rawAudio = path.join(sources.rawRoot, 'audio')
const KIND_DIR = { bgm: 'bgm', ambient: 'ambient', se: 'sfx' }
const nonWaveform = new Set(NON_WAVEFORM_SE_CUES)

const sha256 = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const rawRelative = file => path.relative(sources.archiveRoot, file).split(path.sep).join('/')
const legacyFile = (kind, cue) => resolver.audioCandidates(`${kind}/${cue}.ogg`)
  .find(file => !isWithinRoot(roots.derivedAudio, file) && fs.existsSync(file))

// Every cue the story catalogue plays that the legacy library lacks.
const catalog = JSON.parse(fs.readFileSync(path.join(viewerRoot, 'src/data/storyAudioCatalog.json'), 'utf8'))
const targets = []
for (const kind of ['bgm', 'ambient', 'se']) {
  for (const entry of catalog[kind]) {
    if (entry.kind === 'song' || nonWaveform.has(entry.cue) || legacyFile(kind, entry.cue)) continue
    targets.push({ kind, cue: entry.cue })
  }
}

function run(file, args) {
  const result = spawnSync(file, args, { encoding: 'utf8', maxBuffer: 64 << 20 })
  if (result.status !== 0) throw new Error(`${path.basename(file)} ${args.join(' ')} failed: ${result.stderr || result.stdout}`)
  return result.stdout
}
// vgmstream -I prints one JSON line per selected subsong.
const streamInfo = (file, subsongArgs = []) =>
  run(config.vgmstream_file, ['-m', '-I', ...subsongArgs, file]).split('\n').filter(Boolean).map(line => JSON.parse(line))

let seBanks
function locate({ kind, cue }) {
  if (kind !== 'se') {
    for (const ext of ['.acb', '.awb']) {
      const file = path.join(rawAudio, cue + ext)
      if (!fs.existsSync(file)) continue
      let infos
      try { infos = streamInfo(file) } catch { continue }
      assert.equal(infos[0].streamInfo?.total ?? 1, 1, `${cue}: ${ext} holds several streams`)
      return { file, subsong: null, info: infos[0] }
    }
    throw new Error(`${cue}: no decodable RAW/audio/${cue}.acb or .awb`)
  }
  seBanks ||= fs.readdirSync(rawAudio).filter(name => /^se_.*\.acb$/.test(name)).sort()
    .map(name => {
      // A bank of control-only cues (se_commu_action) holds no streams vgmstream can open.
      try { return { file: path.join(rawAudio, name), streams: streamInfo(path.join(rawAudio, name), ['-S', '0']) } }
      catch { return { file: path.join(rawAudio, name), streams: [] } }
    })
  const hits = seBanks.flatMap(bank => bank.streams
    .filter(info => info.streamInfo.name.split(';').map(name => name.trim()).includes(cue))
    .map(info => ({ file: bank.file, subsong: info.streamInfo.index, info })))
  assert.equal(hits.length, 1, `${cue}: expected one SE bank subsong, found ${hits.length}`)
  return hits[0]
}

function convert(target, out) {
  const source = locate(target)
  const bitrate = source.info.channels === 1 ? '96k' : '160k'
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sidem-derived-audio-'))
  try {
    const wav = path.join(tmp, 'decoded.wav')
    run(config.vgmstream_file, [...(source.subsong == null ? [] : ['-s', String(source.subsong)]), '-o', wav, source.file])
    fs.mkdirSync(path.dirname(out), { recursive: true })
    // bitexact keeps the Ogg serial number fixed, so a rebuild writes the same bytes.
    run(config.ffmpeg_file, ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-c:a', 'libvorbis', '-b:a', bitrate,
      '-fflags', '+bitexact', '-flags:a', '+bitexact', '-map_metadata', '-1', out])
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  const loop = source.info.loopingInfo
  return {
    kind: target.kind,
    cue: target.cue,
    source: {
      path: rawRelative(source.file),
      sha256: sha256(source.file),
      subsong: source.subsong,
      stream_name: source.info.streamInfo?.name ?? null,
      sample_rate: source.info.sampleRate,
      channels: source.info.channels,
      samples: source.info.numberOfSamples,
      loop: loop ? { start: loop.start, end: loop.end } : null,
    },
    output: { path: `audio/${KIND_DIR[target.kind]}/${target.cue}.ogg`, sha256: sha256(out), bytes: fs.statSync(out).size,
      codec: 'vorbis', bitrate },
  }
}

const outFile = target => path.join(roots.derivedAudio, KIND_DIR[target.kind], `${target.cue}.ogg`)
const key = entry => `${entry.kind}:${entry.cue}`

if (check) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const recorded = new Map(manifest.files.map(entry => [key(entry), entry]))
  const missing = targets.filter(target => !recorded.has(key(target))).map(key)
  assert.deepEqual(missing, [], 'story cues the legacy library lacks and the manifest does not derive')
  for (const entry of manifest.files) {
    const out = outFile(entry)
    assert.ok(fs.existsSync(out), `${key(entry)}: ${out} is missing`)
    assert.equal(sha256(out), entry.output.sha256, `${key(entry)}: derived bytes drifted`)
    assert.equal(sha256(path.join(sources.archiveRoot, entry.source.path)), entry.source.sha256, `${key(entry)}: RAW source drifted`)
    assert.equal(resolver.audioCandidates(`${entry.kind}/${entry.cue}.ogg`).find(file => fs.existsSync(file)), out,
      `${key(entry)}: the resolver serves another file`)
  }
  console.log(`Derived story audio OK: ${manifest.files.length} RAW-derived cues on disk match the manifest and are what the resolver serves; ${targets.length} catalogue cues lack a legacy file.`)
} else {
  const files = targets.map(target => convert(target, outFile(target)))
  const counts = Object.fromEntries(['bgm', 'ambient', 'se'].map(kind => [kind, files.filter(file => file.kind === kind).length]))
  const ffmpegVersion = run(config.ffmpeg_file, ['-hide_banner', '-version']).split('\n')[0]
  const manifest = {
    schema: 'GS-DERIVED-STORY-AUDIO-V1',
    about: 'Story cues the legacy converted library lacks, decoded from RAW. Files live under <derived_root>/audio (git-ignored); this manifest is their provenance. Built by scripts/build-derived-story-audio.mjs.',
    encoder: { vgmstream: files.length ? streamInfo(path.join(sources.archiveRoot, files[0].source.path))[0].version : null,
      ffmpeg: ffmpegVersion, render: 'vgmstream default (2 loops + 10 s fade when looping)', codec: 'libvorbis 160k stereo / 96k mono, bitexact' },
    counts,
    files,
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Derived ${files.length} story cues from RAW (${JSON.stringify(counts)}) into ${roots.derivedAudio}`)
}
