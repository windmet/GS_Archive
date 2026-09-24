import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

export async function hashFile(file) {
  const hash = createHash('sha256')
  let size = 0
  for await (const chunk of createReadStream(file)) { hash.update(chunk); size += chunk.length }
  return { sha256: hash.digest('hex'), size }
}

export async function writeSourceBaseline({ root, entries, missing, plans }) {
  const output = path.join(root, '.deploy/storage-compression')
  await fs.mkdir(output, { recursive: true })
  if (await fs.realpath(output) !== output) throw new Error('Refusing redirected baseline output')
  const target = path.join(output, 'source-baseline.json')
  // Never replace a previous baseline. A new batch needs an explicitly archived
  // baseline, not an implicit rewrite that erases the audit comparison.
  try { await fs.access(target); throw new Error(`Baseline already exists: ${target}`) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  const old = JSON.parse(await fs.readFile(path.join(root, '.deploy/r2-manifest.json'), 'utf8'))
  const oldByKey = new Map(old.entries.map(e => [e.request_key, e]))
  const drift = { added: [], removed: [], size_changed: [], same_size_content_changed: [], prior_source_hash_unavailable: [] }
  const current = []
  for (const entry of entries) {
    const before = await fs.stat(entry.source)
    const hash = await hashFile(entry.source)
    const after = await fs.stat(entry.source)
    if (before.size !== hash.size || after.size !== hash.size || before.mtimeMs !== after.mtimeMs) {
      throw new Error(`Source changed during baseline: ${entry.request_key}`)
    }
    const previous = oldByKey.get(entry.request_key)
    const oldSourceHash = previous?.source_sha256 || (previous?.transform === 'copy' ? previous.sha256 : null)
    if (!previous) drift.added.push(entry.request_key)
    else if (previous.source_size !== hash.size) drift.size_changed.push(entry.request_key)
    else if (oldSourceHash && oldSourceHash !== hash.sha256) drift.same_size_content_changed.push(entry.request_key)
    if (previous && !oldSourceHash) drift.prior_source_hash_unavailable.push(entry.request_key)
    current.push({ request_key: entry.request_key, source: path.relative(root, entry.source).replaceAll('\\', '/'),
      provenance: entry.provenance, source_size: hash.size, source_sha256: hash.sha256,
      source_content_type: entry.source_content_type })
    if (current.length % 10000 === 0) console.log(`Source hashes ${current.length}/${entries.length}`)
  }
  const keys = new Set(current.map(e => e.request_key))
  drift.removed = old.entries.filter(e => !keys.has(e.request_key)).map(e => e.request_key)
  const manifest = { schema_version: 3, kind: 'source-baseline',
    created_at: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    previous_manifest_sha256: (await hashFile(path.join(root, '.deploy/r2-manifest.json'))).sha256,
    totals: { source_files: current.length, source_bytes: current.reduce((s, e) => s + e.source_size, 0), plans, missing: missing.length },
    drift, missing, entries: current }
  await fs.writeFile(target, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' })
  console.log(JSON.stringify({ baseline: target, totals: manifest.totals, drift: Object.fromEntries(Object.entries(drift).map(([k, v]) => [k, v.length])) }, null, 2))
}
