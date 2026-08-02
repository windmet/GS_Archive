import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createReadStream, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
)
export const repositoryRoot = path.resolve(projectRoot, '..')
export const inventoryPath = path.join(
  projectRoot,
  'policies',
  'tracked-binary-assets.v1.json',
)
export const schemaPath = path.join(
  projectRoot,
  'schemas',
  'tracked-binary-assets-v1.schema.json',
)

function git(...args) {
  return execFileSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function trackedPngPaths() {
  const output = git('ls-files', '--', '*.png')
  return (output ? output.split(/\r?\n/) : [])
    .filter(Boolean)
    .map(filename => `web_viewer/${filename.replaceAll('\\', '/')}`)
    .sort()
}

async function sha256(filename) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filename)) hash.update(chunk)
  return hash.digest('hex')
}

function basenameWithoutExtension(filename) {
  return path.posix.basename(filename, path.posix.extname(filename))
}

function classify(relativePath) {
  const stem = basenameWithoutExtension(relativePath)
  const logicalStem = stem.toLowerCase()

  if (relativePath.startsWith('web_viewer/notes/')) {
    return {
      category: 'documentation-evidence',
      logical_id: `documentation-evidence:${logicalStem}`,
      consumer: ['project-documentation'],
      reason_tracked: 'grandfathered visual evidence referenced by project notes',
      force_add_allowed: false,
    }
  }

  if (relativePath.includes('/assets/brand/')) {
    return {
      category: 'portal-asset',
      logical_id: `portal-brand:${logicalStem}`,
      consumer: ['archive-shell'],
      reason_tracked: 'grandfathered local portal brand asset',
      force_add_allowed: true,
    }
  }

  const eventMatch = stem.match(/^image_chara_event_story_visual_(.+)$/)
  if (eventMatch) {
    return {
      category: 'stable-promoted-asset',
      logical_id: `event-story-visual:${eventMatch[1]}`,
      consumer: ['ArchiveEventDetail', 'ArchiveStoryDetail'],
      reason_tracked: 'grandfathered RAW-derived stable event story visual',
      force_add_allowed: true,
    }
  }

  const extraStoryMatch = stem.match(/^image_extra_(banner|kv_story)_(\d+)$/)
  if (extraStoryMatch && relativePath.includes('/assets/stories/extra/')) {
    return {
      category: 'portal-asset',
      logical_id: `extra-story-${extraStoryMatch[1]}:${extraStoryMatch[2]}`,
      consumer: ['ArchiveStoryCatalog', 'ArchiveStoryCollection'],
      reason_tracked: 'bounded RAW-derived Extra Story portal navigation visual',
      force_add_allowed: true,
      owner_release: '2026-07-30-extra-story-visuals-001',
      grandfathered: false,
    }
  }

  if (relativePath.includes('/assets/silhouette/')) {
    return {
      category: 'test-fixture',
      logical_id: `story-silhouette:${logicalStem}`,
      consumer: ['StoryViewer', 'verify:silhouette'],
      reason_tracked: 'grandfathered minimal silhouette runtime fixture',
      force_add_allowed: true,
    }
  }

  const birthdayMatch = stem.match(/^image_chara_birthday_visual_(.+)$/)
  if (birthdayMatch) {
    return {
      category: 'stable-promoted-asset',
      logical_id: `birthday-visual:${birthdayMatch[1]}`,
      consumer: ['ArchiveStoryDetail'],
      reason_tracked: 'grandfathered RAW-derived stable birthday story visual',
      force_add_allowed: true,
    }
  }

  const unitMatch = stem.match(/^image_unit_logo_(.+)$/)
  if (unitMatch) {
    return {
      category: 'portal-asset',
      logical_id: `unit-logo:${unitMatch[1]}`,
      consumer: ['ArchiveHome', 'ArchiveStoryDetail'],
      reason_tracked: 'grandfathered local unit navigation asset',
      force_add_allowed: true,
    }
  }

  if (relativePath.includes('/public/data/fx_extracted/')) {
    return {
      category: 'stable-promoted-asset',
      logical_id: `story-fx:${logicalStem}`,
      consumer: ['StoryViewer'],
      reason_tracked: 'grandfathered generated FX image used by the story runtime',
      force_add_allowed: false,
    }
  }

  throw new Error(`Tracked PNG has no binary-policy classification: ${relativePath}`)
}

export async function generateTrackedBinaryInventory({
  captureCommit,
  generatedAt,
} = {}) {
  const commit = captureCommit || git('rev-parse', 'HEAD')
  const timestamp = generatedAt || git('show', '-s', '--format=%cI', commit)
  const entries = []

  for (const relativePath of trackedPngPaths()) {
    const filename = path.resolve(repositoryRoot, relativePath)
    const classification = classify(relativePath)
    entries.push({
      path: relativePath,
      bytes: statSync(filename).size,
      sha256: await sha256(filename),
      ...classification,
      owner_release: classification.owner_release ?? null,
      grandfathered: classification.grandfathered ?? true,
    })
  }

  return {
    schema_version: 1,
    generated_at: timestamp,
    generated_from_commit: commit,
    governed_extensions: ['png'],
    summary: {
      files: entries.length,
      bytes: entries.reduce((total, entry) => total + entry.bytes, 0),
      grandfathered_files: entries.filter(entry => entry.grandfathered).length,
      new_policy_files: entries.filter(entry => !entry.grandfathered).length,
    },
    entries,
  }
}

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}
