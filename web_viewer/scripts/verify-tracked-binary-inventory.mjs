import { execFileSync, spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import {
  generateTrackedBinaryInventory,
  inventoryPath,
  projectRoot,
  schemaPath,
  stableJson,
} from './lib/tracked-binary-inventory.mjs'

const MiB = 1024 * 1024
const NORMAL_FILE_LIMIT = 2 * MiB
const EXCEPTION_FILE_LIMIT = 5 * MiB
const NORMAL_BATCH_LIMIT = 10 * MiB
const EXCEPTION_BATCH_LIMIT = 25 * MiB
const failures = []
const [schema, inventory] = await Promise.all(
  [schemaPath, inventoryPath].map(filename => readFile(filename, 'utf8').then(JSON.parse)),
)

const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)
const validate = ajv.compile(schema)
if (!validate(inventory)) {
  failures.push(
    ...validate.errors.map(error => `schema ${error.instancePath || '/'} ${error.message}`),
  )
}

try {
  execFileSync(
    'git',
    ['merge-base', '--is-ancestor', inventory.generated_from_commit, 'HEAD'],
    { cwd: projectRoot, stdio: 'ignore' },
  )
} catch {
  failures.push('generated_from_commit is not an ancestor of HEAD')
}

const current = await generateTrackedBinaryInventory({
  captureCommit: inventory.generated_from_commit,
  generatedAt: inventory.generated_at,
})
if (stableJson(inventory) !== stableJson(current)) {
  failures.push('inventory differs from the current Git-tracked PNG set or file content')
}

const logicalIds = new Set()
const paths = new Set()
const batches = new Map()
for (const entry of inventory.entries || []) {
  if (logicalIds.has(entry.logical_id)) failures.push(`duplicate logical_id: ${entry.logical_id}`)
  logicalIds.add(entry.logical_id)
  if (paths.has(entry.path)) failures.push(`duplicate path: ${entry.path}`)
  paths.add(entry.path)

  if (/^https?:\/\//i.test(entry.path) || /^https?:\/\//i.test(entry.logical_id)) {
    failures.push(`remote URL cannot masquerade as a local tracked asset: ${entry.path}`)
  }

  const projectRelativePath = entry.path.replace(/^web_viewer\//, '')
  const ignored = spawnSync(
    'git',
    ['check-ignore', '--no-index', '--quiet', '--', projectRelativePath],
    { cwd: projectRoot },
  ).status === 0
  if (entry.force_add_allowed !== ignored) {
    failures.push(
      `force_add_allowed must match the exact path ignore boundary: ${entry.path}`,
    )
  }

  if (entry.grandfathered) continue
  const review = entry.exception_review
  if (entry.bytes > NORMAL_FILE_LIMIT && !review?.approved) {
    failures.push(`file exceeds 2 MiB without exception review: ${entry.path}`)
  }
  if (entry.bytes > EXCEPTION_FILE_LIMIT && review?.explicit_user_approval !== true) {
    failures.push(`file exceeds 5 MiB without explicit user approval: ${entry.path}`)
  }

  const batch = entry.owner_release
  if (!batch) {
    failures.push(`new-policy file lacks owner_release: ${entry.path}`)
    continue
  }
  if (!batches.has(batch)) batches.set(batch, [])
  batches.get(batch).push(entry)
}

for (const [releaseId, entries] of batches) {
  const bytes = entries.reduce((total, entry) => total + entry.bytes, 0)
  const reviews = entries.map(entry => entry.exception_review)
  if (bytes > NORMAL_BATCH_LIMIT && !reviews.every(review => review?.approved)) {
    failures.push(`batch ${releaseId} exceeds 10 MiB without exception review`)
  }
  if (
    bytes > EXCEPTION_BATCH_LIMIT &&
    !reviews.every(review => review?.explicit_user_approval === true)
  ) {
    failures.push(`batch ${releaseId} exceeds 25 MiB without explicit user approval`)
  }
}

if (failures.length) {
  console.error('Tracked binary inventory verification failed:')
  failures.forEach(failure => console.error(`- ${failure}`))
  process.exitCode = 1
} else {
  console.log(
    `Tracked binary inventory verified: ${inventory.summary.files} PNG files / ` +
    `${inventory.summary.bytes} bytes; all ${inventory.summary.grandfathered_files} ` +
    'entries are grandfathered',
  )
}
