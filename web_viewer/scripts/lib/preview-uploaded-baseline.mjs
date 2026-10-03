import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { isPreviewDataSnapshotKey, isPreviewGzipCandidate, resolvePreviewObjectKey,
  previewTransformKind } from '../../shared/deploy/PreviewAssetTransform.js'

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const hashPattern = /^[a-f0-9]{64}$/
const parse = bytes => JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''))
const validHash = (value, label) => assert(typeof value === 'string' && hashPattern.test(value), `Invalid ${label}`)
const validDate = (value, label) => {
  assert(typeof value === 'string' && Number.isFinite(Date.parse(value)), `Invalid ${label}`)
  return Date.parse(value)
}
const validKey = (value, label) => assert(typeof value === 'string' && value.length > 0
  && !/[\\\0\r\n?#:]/.test(value)
  && value.split('/').every(part => part && part !== '.' && part !== '..'), `Invalid ${label}`)
const sourcePath = value => {
  assert(typeof value === 'string' && value.length > 0, 'Invalid source path')
  return path.resolve(value)
}

function sourceRows(document, kind) {
  assert.equal(document.schema_version, 3, `Unsupported ${kind} schema`)
  assert.equal(document.kind, kind, `Expected ${kind}`)
  assert(Array.isArray(document.entries), `Missing ${kind} entries`)
  const rows = new Map()
  for (const row of document.entries) {
    validKey(row.request_key, `${kind} request key`)
    assert(!rows.has(row.request_key), `Duplicate ${kind} request: ${row.request_key}`)
    sourcePath(row.source)
    assert(Number.isSafeInteger(row.source_size) && row.source_size >= 0, 'Invalid source size')
    assert(typeof row.source_content_type === 'string' && row.source_content_type.length > 0, 'Invalid source content type')
    if (kind === 'source-baseline') validHash(row.source_sha256, 'baseline source hash')
    rows.set(row.request_key, row)
  }
  return rows
}

function dataRevisionFor(input, sources) {
  // Keep the source inventory's original order: this is the prepare script's
  // immutable JSON snapshot contract, not a sorted or selected-only projection.
  return sha256(JSON.stringify(input.entries.filter(row => isPreviewDataSnapshotKey(row.request_key))
    .map(row => {
      const hash = sources.get(row.request_key)
      validHash(hash, `parent source hash for ${row.request_key}`)
      return [row.request_key, hash]
    })))
}

function verifyDeclaredParents(manifest, seedEvidence, priorEvidence) {
  if (manifest.baseline_evidence === undefined) return // Existing historical manifests predate overlays.
  const declared = manifest.baseline_evidence
  assert.equal(declared?.seed?.sha256, seedEvidence.sha256, 'Uploaded manifest has a different seed baseline')
  assert(Array.isArray(declared.overlays), 'Invalid uploaded parent evidence')
  const hashes = rows => rows.map(row => [row.manifest_sha256, row.receipt_sha256, row.source_input_sha256])
  assert.deepEqual(hashes(declared.overlays), hashes(priorEvidence), 'Missing or reordered uploaded parent overlay')
}

async function readBoundArtifact(descriptor, property, directory) {
  const binding = descriptor[property]
  assert(binding && typeof binding.file === 'string' && binding.file.length > 0, `Missing ${property} file`)
  validHash(binding.sha256, `${property} binding hash`)
  const file = await fs.realpath(path.resolve(directory, binding.file))
  const bytes = await fs.readFile(file)
  assert.equal(sha256(bytes), binding.sha256, `${property} bytes differ from overlay binding`)
  return { file, sha256: binding.sha256, document: parse(bytes) }
}

/**
 * Read only explicit metadata. Never scan, hash or stat original media, consult
 * a bucket, or rewrite the seed/receipts. The caller must still hash current
 * sources and require their physical keys in its fresh remote listing.
 */
export async function loadPreviewUploadedBaseline({ baselineFile, overlayFiles = [], remote = '' }) {
  assert(typeof baselineFile === 'string' && baselineFile.length > 0, 'Missing source baseline file')
  assert(Array.isArray(overlayFiles), 'Invalid overlay files')
  const seedFile = await fs.realpath(path.resolve(baselineFile))
  const seedBytes = await fs.readFile(seedFile)
  const seedRows = sourceRows(parse(seedBytes), 'source-baseline')
  const seedEvidence = { file: seedFile, sha256: sha256(seedBytes) }
  let sources = new Map([...seedRows].map(([key, row]) => [key, row.source_sha256]))
  const overlays = [], descriptors = new Set(), manifests = new Set()
  let lastCompletedAt = -Infinity
  if (overlayFiles.length) assert(typeof remote === 'string' && /^[\w-]+:[^/\s]+$/.test(remote),
    'Overlays require --baseline-remote <remote:bucket>')

  for (const descriptorPath of overlayFiles) {
    assert(typeof descriptorPath === 'string' && descriptorPath.length > 0, 'Missing overlay descriptor')
    const descriptorFile = await fs.realpath(path.resolve(descriptorPath))
    assert(!descriptors.has(descriptorFile), 'Duplicate overlay descriptor')
    descriptors.add(descriptorFile)
    const descriptorBytes = await fs.readFile(descriptorFile), descriptor = parse(descriptorBytes)
    assert.equal(descriptor.schema_version, 1, 'Unsupported overlay descriptor schema')
    assert.equal(descriptor.kind, 'uploaded-preview-baseline-overlay', 'Invalid overlay descriptor kind')
    assert.equal(descriptor.remote, remote, 'Overlay remote differs from explicit target')
    validHash(descriptor.dataRevision, 'overlay data revision')
    const directory = path.dirname(descriptorFile)
    const [manifestArtifact, receiptArtifact, inputArtifact] = await Promise.all([
      readBoundArtifact(descriptor, 'manifest', directory),
      readBoundArtifact(descriptor, 'receipt', directory),
      readBoundArtifact(descriptor, 'source_input', directory),
    ])
    const manifest = manifestArtifact.document, receipt = receiptArtifact.document, input = inputArtifact.document
    assert(!manifests.has(manifestArtifact.sha256), 'Duplicate uploaded manifest overlay')
    manifests.add(manifestArtifact.sha256)
    assert.equal(manifest.schema_version, 3, 'Unsupported uploaded manifest schema')
    assert.equal(manifest.kind, 'incremental-preview', 'Expected incremental uploaded manifest')
    assert.equal(manifest.stage, 'objects', 'Unexpected uploaded object stage')
    assert(Array.isArray(manifest.entries), 'Missing uploaded entries')
    assert.equal(manifest.totals?.files, manifest.entries.length, 'Uploaded file count mismatch')
    validHash(manifest.dataRevision, 'uploaded data revision')
    assert.equal(manifest.dataRevision, descriptor.dataRevision, 'Overlay data revision mismatch')
    assert.equal(manifest.inventory_sha256, inputArtifact.sha256, 'Uploaded source inventory hash mismatch')
    assert.equal(receipt.mode, '--upload', 'Receipt is not a successful upload')
    const completedAt = validDate(receipt.completed_at, 'upload completion time')
    assert(completedAt > lastCompletedAt, 'Overlays must be supplied in upload completion order')
    assert.equal(receipt.remote, remote, 'Upload receipt belongs to a different remote')
    assert.equal(receipt.manifest_sha256, manifestArtifact.sha256, 'Upload receipt manifest hash mismatch')
    assert.equal(receipt.objects, manifest.entries.length, 'Upload receipt object count mismatch')
    verifyDeclaredParents(manifest, seedEvidence, overlays)
    const inputRows = sourceRows(input, 'current-source-inventory')
    const nextSources = new Map(sources), requests = new Set(), objects = new Set()
    let deployedBytes = 0
    for (const entry of manifest.entries) {
      validKey(entry.request_key, 'uploaded request key')
      validKey(entry.object_key, 'uploaded object key')
      assert(!requests.has(entry.request_key), `Duplicate uploaded request: ${entry.request_key}`)
      assert(!objects.has(entry.object_key), `Duplicate uploaded object: ${entry.object_key}`)
      requests.add(entry.request_key); objects.add(entry.object_key)
      validHash(entry.source_sha256, 'uploaded source hash')
      validHash(entry.deployed_sha256, 'uploaded physical object hash')
      assert(Number.isSafeInteger(entry.deployed_size) && entry.deployed_size >= 0, 'Invalid uploaded object size')
      deployedBytes += entry.deployed_size
      const source = inputRows.get(entry.request_key)
      assert(source, `Uploaded source is absent from input: ${entry.request_key}`)
      assert.equal(sourcePath(source.source), sourcePath(entry.source), 'Uploaded source path mismatch')
      assert.equal(source.source_size, entry.source_size, 'Uploaded source size mismatch')
      assert.equal(source.source_content_type, entry.source_content_type, 'Uploaded source content type mismatch')
      const gzip = isPreviewGzipCandidate(entry.request_key)
      assert.equal(entry.object_key, resolvePreviewObjectKey(entry.request_key, { gzip, dataRevision: manifest.dataRevision }),
        'Uploaded physical object key violates transform policy')
      assert.equal(entry.transform, previewTransformKind(entry.request_key, { gzip }), 'Uploaded transform policy mismatch')
      nextSources.set(entry.request_key, entry.source_sha256)
    }
    assert.equal(manifest.totals.deployed_bytes, deployedBytes, 'Uploaded byte total mismatch')
    assert.equal(dataRevisionFor(input, nextSources), manifest.dataRevision, 'Uploaded source hashes do not bind the data revision')
    overlays.push({ descriptor_file: descriptorFile, descriptor_sha256: sha256(descriptorBytes),
      manifest_file: manifestArtifact.file, manifest_sha256: manifestArtifact.sha256,
      receipt_file: receiptArtifact.file, receipt_sha256: receiptArtifact.sha256,
      source_input_file: inputArtifact.file, source_input_sha256: inputArtifact.sha256,
      remote, dataRevision: manifest.dataRevision, completed_at: receipt.completed_at, uploaded_sources: requests.size })
    sources = nextSources
    lastCompletedAt = completedAt
  }
  return { sources, evidence: { seed: seedEvidence, overlays } }
}
