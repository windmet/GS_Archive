import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
)
export const repositoryRoot = path.resolve(projectRoot, '..')
export const publicationRoot = path.join(projectRoot, 'public', 'data', 'publication')
export const releasesRoot = path.join(publicationRoot, 'releases')
export const annotationsRoot = path.join(publicationRoot, 'annotations')
export const manifestPath = path.join(publicationRoot, 'manifest.json')
export const schemaPath = path.join(projectRoot, 'schemas', 'publication-release-v1.schema.json')
export const versionPolicyPath = path.join(
  projectRoot,
  'policies',
  'publication-ledger-versions.v1.json',
)
export const versionPolicySchemaPath = path.join(
  projectRoot,
  'schemas',
  'publication-ledger-version-policy-v1.schema.json',
)

export function readReleaseFiles() {
  if (!existsSync(releasesRoot)) return []
  return readdirSync(releasesRoot, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => ({
      filename: entry.name,
      release: JSON.parse(readFileSync(path.join(releasesRoot, entry.name), 'utf8')),
    }))
    .sort((left, right) =>
      left.release.created_at.localeCompare(right.release.created_at) ||
      left.release.release_id.localeCompare(right.release.release_id),
    )
}

export function buildPublicationManifest(releaseRecords) {
  const state = new Map()
  const generatedFrom = []

  for (const { release } of releaseRecords) {
    generatedFrom.push(release.release_id)
    for (const entry of release.entries) {
      if (release.transaction_kind === 'supersede' && entry.published.length === 0) {
        state.delete(entry.logical_id)
        continue
      }
      state.set(entry.logical_id, {
        release_id: release.release_id,
        domain: entry.domain,
        artifacts: entry.published,
        consumers: entry.consumers,
      })
    }
  }

  return {
    schema_version: 1,
    generated_from: generatedFrom,
    by_logical_id: Object.fromEntries(
      [...state.entries()].sort(([left], [right]) => left.localeCompare(right)),
    ),
  }
}

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function findAbsolutePathStrings(value, pointer = '$', results = []) {
  if (typeof value === 'string') {
    if (/^[A-Za-z]:[\\/]/.test(value) || /^\\\\/.test(value)) results.push(pointer)
    return results
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => findAbsolutePathStrings(item, `${pointer}[${index}]`, results))
    return results
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      findAbsolutePathStrings(item, `${pointer}.${key}`, results)
    }
  }
  return results
}

export function currentStateBefore(releaseRecords, targetReleaseIndex, logicalId) {
  const manifest = buildPublicationManifest(releaseRecords.slice(0, targetReleaseIndex))
  return manifest.by_logical_id[logicalId] || null
}

export function sha256Bytes(bytes) {
  const hash = createHash('sha256')
  hash.update(bytes)
  return hash.digest('hex')
}

export function readAnnotationFiles() {
  if (!existsSync(annotationsRoot)) return []
  return readdirSync(annotationsRoot, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => entry.name)
    .sort()
}

export function resolvePublishedPath(relativePath) {
  return path.resolve(repositoryRoot, relativePath)
}

function readIndexBlob(relativePath) {
  try {
    return execFileSync('git', ['show', `:${relativePath}`], {
      cwd: repositoryRoot,
      encoding: 'buffer',
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch {
    return null
  }
}

function configuredEol(relativePath) {
  try {
    const output = execFileSync(
      'git',
      ['check-attr', 'eol', '--', relativePath],
      { cwd: repositoryRoot, encoding: 'utf8' },
    )
    return output.trim().split(': ').at(-1)
  } catch {
    return null
  }
}

function semanticJson(bytes) {
  return stableJson(JSON.parse(bytes.toString('utf8')))
}

export function verifyPublishedArtifact(artifact) {
  const filename = resolvePublishedPath(artifact.path)
  if (!existsSync(filename)) return `published file does not exist: ${artifact.path}`

  const canonicalBytes = readIndexBlob(artifact.path)
  if (!canonicalBytes) return `published file is not present in the Git index: ${artifact.path}`
  if (canonicalBytes.length !== artifact.bytes) {
    return `published canonical size drifted: ${artifact.path}`
  }
  if (sha256Bytes(canonicalBytes) !== artifact.sha256) {
    return `published canonical hash drifted: ${artifact.path}`
  }

  const runtimeBytes = readFileSync(filename)
  if (artifact.path.endsWith('.json')) {
    if (configuredEol(artifact.path) !== 'lf') {
      return `published JSON must declare eol=lf: ${artifact.path}`
    }
    try {
      if (semanticJson(runtimeBytes) !== semanticJson(canonicalBytes)) {
        return `published runtime JSON differs semantically from canonical bytes: ${artifact.path}`
      }
    } catch (error) {
      return `published runtime JSON is invalid: ${artifact.path} (${error.message})`
    }
  } else if (!runtimeBytes.equals(canonicalBytes)) {
    return `published runtime bytes differ from canonical bytes: ${artifact.path}`
  }

  return null
}
