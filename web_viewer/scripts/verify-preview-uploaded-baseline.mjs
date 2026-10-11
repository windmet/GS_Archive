import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { loadPreviewUploadedBaseline } from './lib/preview-uploaded-baseline.mjs'
import { isPreviewDataSnapshotKey, isPreviewGzipCandidate, resolvePreviewObjectKey,
  previewTransformKind } from '../shared/deploy/PreviewAssetTransform.js'

// Tiny metadata/source fixtures only. --historical additionally reads the exact
// existing 20261002 metadata chain; it never opens its original media paths.
const root = path.resolve(process.cwd())
const fixtureParent = path.join(root, '.analysis/verify-preview-uploaded-baseline')
await fs.mkdir(fixtureParent, { recursive: true })
assert.equal(await fs.realpath(fixtureParent), fixtureParent, 'Linked fixture parent')
const fixture = await fs.mkdtemp(path.join(fixtureParent, 'case-'))
const outputPaths = []
let junctionPath = null
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const jsonBytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n')
const clone = value => JSON.parse(JSON.stringify(value))
const put = async (file, value) => { await fs.writeFile(file, jsonBytes(value)); return file }
const row = (key, text, source = path.join(fixture, 'not-present', key)) => ({ request_key: key,
  source, provenance: 'verification-fixture', source_size: Buffer.byteLength(text),
  source_content_type: key.endsWith('.json') ? 'application/json' : key.endsWith('.png') ? 'image/png' : 'text/plain',
  source_sha256: sha(text) })
const revision = rows => sha(JSON.stringify(rows.filter(item => isPreviewDataSnapshotKey(item.request_key))
  .map(item => [item.request_key, item.source_sha256])))
const uploaded = (item, dataRevision) => ({ ...item,
  object_key: resolvePreviewObjectKey(item.request_key, { gzip: isPreviewGzipCandidate(item.request_key), dataRevision }),
  transform: previewTransformKind(item.request_key, { gzip: isPreviewGzipCandidate(item.request_key) }),
  deployed_size: item.source_size, deployed_sha256: sha(`physical:${item.source_sha256}`) })

async function writeOverlay(name, { rows, selected, remote = 'fixture:preview', completedAt = '2026-10-01T12:00:00.000Z',
  mutateInput, mutateManifest, mutateReceipt, mutateDescriptor, parents }) {
  const directory = path.join(fixture, name)
  await fs.mkdir(directory)
  const sourceInput = { schema_version: 3, kind: 'current-source-inventory', entries: clone(rows) }
  // Real inventory inputs can be hash-free: only seed/verified uploads prove
  // hashes. Supplying convenient source hashes must not bypass missing parents.
  sourceInput.entries.forEach(item => { delete item.source_sha256 })
  mutateInput?.(sourceInput)
  const inputRaw = jsonBytes(sourceInput)
  const dataRevision = revision(rows)
  const manifest = { schema_version: 3, kind: 'incremental-preview', stage: 'objects', dataRevision,
    inventory_sha256: sha(inputRaw), entries: selected.map(item => uploaded(item, dataRevision)) }
  manifest.totals = { files: manifest.entries.length, deployed_bytes: manifest.entries.reduce((sum, item) => sum + item.deployed_size, 0) }
  if (parents) manifest.baseline_evidence = parents
  mutateManifest?.(manifest)
  const manifestRaw = jsonBytes(manifest)
  const receipt = { mode: '--upload', remote, completed_at: completedAt,
    manifest_sha256: sha(manifestRaw), objects: manifest.entries.length }
  mutateReceipt?.(receipt)
  const receiptRaw = jsonBytes(receipt)
  await Promise.all([fs.writeFile(path.join(directory, 'input.json'), inputRaw),
    fs.writeFile(path.join(directory, 'manifest.json'), manifestRaw), fs.writeFile(path.join(directory, 'receipt.json'), receiptRaw)])
  const descriptor = { schema_version: 1, kind: 'uploaded-preview-baseline-overlay', remote, dataRevision,
    manifest: { file: 'manifest.json', sha256: sha(manifestRaw) },
    receipt: { file: 'receipt.json', sha256: sha(receiptRaw) },
    source_input: { file: 'input.json', sha256: sha(inputRaw) } }
  mutateDescriptor?.(descriptor)
  return put(path.join(directory, 'overlay.json'), descriptor)
}

async function removeFixtureDirectory(directory, expectedParent) {
  const relative = path.relative(expectedParent, directory)
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Refusing cleanup outside fixture root')
  try {
    assert.equal(await fs.realpath(directory), directory, 'Refusing linked fixture cleanup')
    await fs.rm(directory, { recursive: true })
  } catch (error) { if (error.code !== 'ENOENT') throw error }
}

try {
  const data = row('data/catalog.json', '{}'), priorImage = row('assets/icon.png', 'old-image'), image = row('assets/icon.png', 'new-image')
  const seedFile = await put(path.join(fixture, 'seed.json'), { schema_version: 3, kind: 'source-baseline', entries: [data, priorImage] })
  const seedBytes = await fs.readFile(seedFile)
  const validOverlay = await writeOverlay('valid', { rows: [data, image], selected: [image] })
  const load = overlayFiles => loadPreviewUploadedBaseline({ baselineFile: seedFile, overlayFiles, remote: 'fixture:preview' })
  const base = await loadPreviewUploadedBaseline({ baselineFile: seedFile })
  const merged = await load([validOverlay])
  assert.equal(base.sources.get(image.request_key), priorImage.source_sha256)
  assert.equal(merged.sources.get(image.request_key), image.source_sha256)
  assert.equal(merged.sources.get(data.request_key), data.source_sha256)
  assert.equal(merged.evidence.overlays[0].uploaded_sources, 1)
  assert.deepEqual(await fs.readFile(seedFile), seedBytes, 'Seed bytes are never replaced')
  assert.equal(base.sources.get(image.request_key), priorImage.source_sha256, 'Previously returned seed map remains unchanged')
  await assert.rejects(loadPreviewUploadedBaseline({ baselineFile: seedFile, overlayFiles: [validOverlay] }), /baseline-remote/)
  await assert.rejects(loadPreviewUploadedBaseline({ baselineFile: seedFile, overlayFiles: [validOverlay], remote: 'fixture:elsewhere' }), /remote/)
  await assert.rejects(load([validOverlay, validOverlay]), /Duplicate overlay descriptor/)
  const copiedDescriptor = path.join(path.dirname(validOverlay), 'copied-overlay.json')
  await fs.copyFile(validOverlay, copiedDescriptor)
  await assert.rejects(load([validOverlay, copiedDescriptor]), /Duplicate uploaded manifest/)

  const rejectionCases = [
    ['plan', { mutateReceipt: item => { item.mode = '--plan' } }, /successful upload/],
    ['unfinished', { mutateReceipt: item => { delete item.completed_at } }, /completion time/],
    ['wrong-remote', { mutateReceipt: item => { item.remote = 'fixture:elsewhere' } }, /different remote/],
    ['receipt-manifest', { mutateReceipt: item => { item.manifest_sha256 = '0'.repeat(64) } }, /manifest hash/],
    ['input-hash', { mutateManifest: item => { item.inventory_sha256 = '0'.repeat(64) } }, /inventory hash/],
    ['revision', { mutateDescriptor: item => { item.dataRevision = '0'.repeat(64) } }, /revision mismatch/],
    ['source-path', { mutateManifest: item => { item.entries[0].source += '-wrong' } }, /source path mismatch/],
    ['source-size', { mutateManifest: item => { item.entries[0].source_size += 1 } }, /source size mismatch/],
    ['source-type', { mutateManifest: item => { item.entries[0].source_content_type = 'text/plain' } }, /content type mismatch/],
    ['unsafe-key', { mutateManifest: item => { item.entries[0].object_key = '../icon.webp' } }, /Invalid uploaded object key/],
    ['wrong-object', { mutateManifest: item => { item.entries[0].object_key = 'assets/icon.png' } }, /object key violates/],
    ['wrong-transform', { mutateManifest: item => { item.entries[0].transform = 'copy' } }, /transform policy/],
    ['duplicate-request', { mutateInput: item => { item.entries.push(clone(item.entries[0])) } }, /Duplicate current-source/],
    ['duplicate-object', { mutateManifest: item => {
      item.entries.push({ ...item.entries[0], request_key: 'assets/icon.PNG' })
      item.totals.files += 1; item.totals.deployed_bytes *= 2
    } }, /Duplicate uploaded object/],
    ['object-count', { mutateReceipt: item => { item.objects += 1 } }, /object count/],
    ['object-hash', { mutateManifest: item => { item.entries[0].deployed_sha256 = 'obsolete' } }, /physical object hash/],
    ['object-bytes', { mutateManifest: item => { item.totals.deployed_bytes += 1 } }, /byte total/],
    ['missing-source', { mutateInput: item => { item.entries.pop() } }, /absent from input/],
  ]
  for (const [name, changes, reason] of rejectionCases) {
    const descriptor = await writeOverlay(name, { rows: [data, image], selected: [image], ...changes })
    await assert.rejects(load([descriptor]), reason, name)
  }
  const corrupt = await writeOverlay('corrupt-bytes', { rows: [data, image], selected: [image] })
  await fs.appendFile(path.join(path.dirname(corrupt), 'receipt.json'), ' ')
  await assert.rejects(load([corrupt]), /bytes differ/)
  const unavailable = await writeOverlay('absent-artifact', { rows: [data, image], selected: [image],
    mutateDescriptor: item => { item.source_input.file = 'missing.json' } })
  await assert.rejects(load([unavailable]), { code: 'ENOENT' })
  const parentData = row('data/new-parent.json', '{"added":true}')
  const firstParent = await writeOverlay('parent', { rows: [data, parentData, image], selected: [parentData, image] })
  const parent = await load([firstParent])
  const laterImage = row('assets/icon.png', 'later-image')
  const child = await writeOverlay('child', { rows: [data, parentData, laterImage], selected: [laterImage],
    completedAt: '2026-10-02T12:00:00.000Z', parents: parent.evidence })
  const chained = await load([firstParent, child])
  assert.equal(chained.sources.get(image.request_key), laterImage.source_sha256)
  await assert.rejects(load([child]), /Missing or reordered uploaded parent/)
  const legacyChild = await writeOverlay('legacy-child', { rows: [data, parentData, laterImage], selected: [laterImage],
    completedAt: '2026-10-02T12:00:00.000Z' })
  await assert.rejects(load([legacyChild]), /parent source hash/, 'Inventory-supplied hashes cannot invent omitted parent evidence')
  await assert.rejects(load([child, firstParent]), /Missing or reordered uploaded parent/)
  const older = await writeOverlay('older', { rows: [data, laterImage], selected: [laterImage], completedAt: '2026-09-30T12:00:00.000Z' })
  await assert.rejects(load([validOverlay, older]), /completion order/)

  // Exercise the actual prepare command, rather than a mirror of its selection
  // expression. Only small plain text/JSON are staged; no image encoders run.
  const dataPath = path.join(fixture, 'catalog.json'), textPath = path.join(fixture, 'icon.txt')
  await fs.writeFile(dataPath, '{}'); await fs.writeFile(textPath, 'uploaded-text')
  const actualData = row('data/catalog.json', '{}', dataPath), actualText = row('assets/icon.txt', 'uploaded-text', textPath)
  const priorText = row('assets/icon.txt', 'old-text', textPath)
  const cliSeed = await put(path.join(fixture, 'cli-seed.json'), { schema_version: 3, kind: 'source-baseline', entries: [actualData, priorText] })
  const cliOverlay = await writeOverlay('cli-upload', { rows: [actualData, actualText], selected: [actualText] })
  const inputFile = path.join(fixture, 'cli-input.json'), remoteFile = path.join(fixture, 'cli-remote.json')
  const cliInput = rows => ({ schema_version: 3, kind: 'current-source-inventory', missing: [], entries: rows.map(item => {
    const copy = { ...item }; delete copy.source_sha256; return copy
  }) })
  await put(inputFile, cliInput([actualData, actualText]))
  const liveRows = [actualData, actualText].map(item => ({ Path: uploaded(item, revision([actualData, actualText])).object_key,
    Size: item.source_size, Hashes: { sha256: 'deliberately-outdated-physical-hash' } }))
  await put(remoteFile, liveRows)
  let run = 0
  const prepare = async ({ overlay = '', expectedError, extra = [], encoderUnavailable = false, outputOverride = '' } = {}) => {
    const output = outputOverride || path.join(root, '.deploy', `verify-preview-baseline-${path.basename(fixture)}-${++run}`)
    outputPaths.push(output)
    const argv = ['scripts/prepare-preview-incremental-assets.mjs', '--inventory', inputFile, '--remote', remoteFile,
      '--baseline', cliSeed, '--out', output, ...extra]
    if (overlay) argv.push('--baseline-overlay', overlay, '--baseline-remote', 'fixture:preview')
    const result = spawnSync(process.execPath, argv, { cwd: root, encoding: 'utf8',
      env: encoderUnavailable ? { ...process.env, PYTHON_PATH: path.join(fixture, 'encoder-must-not-run.exe') } : process.env })
    if (expectedError) {
      assert.notEqual(result.status, 0, 'Invalid metadata must reject prepare')
      assert.match(result.stderr, expectedError)
      await assert.rejects(fs.access(output), { code: 'ENOENT' }, 'Rejection precedes output directory creation')
      return null
    }
    assert.equal(result.status, 0, result.stderr)
    return JSON.parse(await fs.readFile(path.join(output, 'manifest.json'), 'utf8'))
  }
  const ordinary = await prepare()
  assert.deepEqual(ordinary.entries.map(item => item.request_key), ['assets/icon.txt'], 'Original no-overlay invocation retains source-hash selection')
  const unchanged = await prepare({ overlay: cliOverlay })
  assert.equal(unchanged.entries.length, 0, 'Successful overlay skips unchanged sources despite obsolete remote hashes')
  assert.equal(unchanged.baseline_evidence.overlays.length, 1)
  await put(remoteFile, liveRows.slice(0, 1))
  const remoteMissing = await prepare({ overlay: cliOverlay })
  assert.deepEqual(remoteMissing.entries.map(item => item.request_key), ['assets/icon.txt'], 'Missing fresh physical key always stages the source')
  await put(remoteFile, liveRows)
  await fs.writeFile(textPath, 'changed-again')
  await put(inputFile, cliInput([actualData, row(actualText.request_key, 'changed-again', textPath)]))
  const changed = await prepare({ overlay: cliOverlay })
  assert.deepEqual(changed.entries.map(item => item.request_key), ['assets/icon.txt'], 'Fresh source drift cannot be hidden by a live key')
  await fs.writeFile(textPath, 'uploaded-text'); await fs.writeFile(dataPath, '{"new":true}')
  await put(inputFile, cliInput([row(actualData.request_key, '{"new":true}', dataPath), actualText]))
  const freshSnapshot = await prepare({ overlay: cliOverlay })
  assert.deepEqual(freshSnapshot.entries.map(item => item.request_key), ['data/catalog.json'], 'New snapshot revision stages JSON at its new immutable key')
  const corruptCli = await writeOverlay('cli-invalid', { rows: [actualData, actualText], selected: [actualText],
    mutateReceipt: item => { item.remote = 'fixture:wrong-bucket' } })
  const preservedSource = await fs.readFile(textPath)
  await prepare({ overlay: corruptCli, expectedError: /different remote/ })
  assert.deepEqual(await fs.readFile(textPath), preservedSource)
  await put(inputFile, cliInput([actualData, actualData]))
  await prepare({ expectedError: /Duplicate source request/ })
  await put(inputFile, cliInput([{ ...actualText, request_key: '../unsafe.txt' }]))
  await prepare({ expectedError: /Invalid source metadata/ })
  const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGfoAAAAASUVORK5CYII=', 'base64')
  const pngPath = path.join(fixture, 'icon.png')
  await fs.writeFile(pngPath, pngBytes)
  const actualPng = row('assets/tiny.png', pngBytes, pngPath)
  const pngOverlay = await writeOverlay('cli-png-upload', { rows: [actualData, actualPng], selected: [actualPng] })
  await fs.writeFile(dataPath, '{}')
  await put(inputFile, cliInput([actualData, actualPng]))
  await put(remoteFile, [actualData, actualPng].map(item => ({
    Path: uploaded(item, revision([actualData, actualPng])).object_key, Size: 1, Hashes: { sha256: 'obsolete' } })))
  const unchangedPng = await prepare({ overlay: pngOverlay, encoderUnavailable: true })
  assert.equal(unchangedPng.entries.length, 0, 'An unchanged uploaded PNG must succeed without any available encoder')
  const redirected = path.join(fixture, 'redirected-output')
  await fs.mkdir(redirected)
  const link = path.join(root, '.deploy', `verify-preview-baseline-${path.basename(fixture)}-junction`)
  let junctionTest = 'passed'
  try {
    await fs.symlink(redirected, link, process.platform === 'win32' ? 'junction' : 'dir')
    junctionPath = link
    await prepare({ overlay: pngOverlay, outputOverride: path.join(link, 'must-not-be-created'),
      expectedError: /Linked staging output parent/ })
    assert.deepEqual(await fs.readdir(redirected), [], 'Parent-link rejection must not create even an empty external directory')
  } catch (error) {
    if (!junctionPath && ['EPERM', 'ENOTSUP', 'EACCES'].includes(error.code)) junctionTest = `unavailable:${error.code}`
    else throw error
  }

  let historical = null
  if (process.argv.includes('--historical')) {
    const manifestFile = path.join(root, '.deploy/productization-assets-lossless-20261002/manifest.json')
    const receiptFile = path.join(root, '.deploy/productization-assets-lossless-20261002/upload-receipt.json')
    const sourceInputFile = path.join(root, '.analysis/archive-general-localization/preview-current-source-inventory-lossless.json')
    const historicalDescriptor = await put(path.join(fixture, 'historical-overlay.json'), {
      schema_version: 1, kind: 'uploaded-preview-baseline-overlay', remote: 'cloudflare:sidem-archive-preview',
      dataRevision: '879c3ea4e9a860fc5e819eece6c98c56c8f80b0640eb80df7ceacbfedea96436',
      manifest: { file: manifestFile, sha256: '2a68c6938a8a94b6b19987f7c9468f5c13c491662fab43f2e9bc0714c88cc9f9' },
      receipt: { file: receiptFile, sha256: '0faa74e696bfe3b4b2746fee04f41ed2d99e90ceeda396ea56ae30d1b6758d48' },
      source_input: { file: sourceInputFile, sha256: '723a58055b66fa1fbf1e5202d6346fe65708a03fe60f93cbd9963aa8241587d6' },
    })
    const historicalSeed = path.join(root, '.deploy/storage-compression/source-baseline.json')
    const accepted = await loadPreviewUploadedBaseline({ baselineFile: historicalSeed,
      overlayFiles: [historicalDescriptor], remote: 'cloudflare:sidem-archive-preview' })
    assert.equal(accepted.evidence.seed.sha256, 'c5ab806ee57778bc387322acfcf5211ecdf0521721a6df279dbe52a6e006e5b9')
    const seed = JSON.parse((await fs.readFile(historicalSeed, 'utf8')).replace(/^\uFEFF/, ''))
    const manifest = JSON.parse((await fs.readFile(manifestFile, 'utf8')).replace(/^\uFEFF/, ''))
    const oldHashes = new Map(seed.entries.map(item => [item.request_key, item.source_sha256]))
    const previouslyReselected = manifest.entries.filter(item => oldHashes.get(item.request_key) !== item.source_sha256)
    assert.equal(previouslyReselected.length, 10783)
    assert(manifest.entries.every(item => accepted.sources.get(item.request_key) === item.source_sha256))
    historical = { metadataChainPassed: true, uploadedSources: accepted.evidence.overlays[0].uploaded_sources,
      oldBaselineWouldReselect: previouslyReselected.length, originalMediaRead: 0, priorFilesModified: 0 }
  }
  console.log(JSON.stringify({ passed: true, fixtureCases: rejectionCases.length,
    prepareBehaviorPassed: true, noOverlayCompatible: true, junctionTest, historical }, null, 2))
} finally {
  for (const output of outputPaths) await removeFixtureDirectory(output, path.join(root, '.deploy'))
  if (junctionPath) {
    assert.equal(path.dirname(junctionPath), path.join(root, '.deploy'), 'Refusing cleanup outside junction fixture parent')
    assert((await fs.lstat(junctionPath)).isSymbolicLink(), 'Refusing to remove a non-link junction fixture')
    await fs.unlink(junctionPath)
  }
  await removeFixtureDirectory(fixture, fixtureParent)
}
