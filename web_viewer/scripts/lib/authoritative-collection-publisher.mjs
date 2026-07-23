import { mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { compareAuthoritativeRuntimeProjection } from './authoritative-scenario-compiler.mjs'
import { hashBytes, jsonBytes, resolveInside } from './authoritative-collection-candidate.mjs'
import { buildCompiledScenarioMigrationReport } from './compiled-scenario-migration.mjs'

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

async function exists(file) {
  try { await stat(file); return true } catch (error) { if (error?.code === 'ENOENT') return false; throw error }
}

export async function atomicWriteFrom(source, target) {
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.authoritative-publish-tmp`)
  if (await exists(temporary)) throw new Error(`Temporary publish file already exists: ${temporary}`)
  await mkdir(path.dirname(target), { recursive: true })
  const bytes = await readFile(source)
  const handle = await open(temporary, 'wx')
  try {
    await handle.writeFile(bytes)
    await handle.sync()
  } finally {
    await handle.close()
  }
  try { await rename(temporary, target) } finally { await rm(temporary, { force: true }) }
}

export async function publishAuthoritativeCollection({
  workspaceRoot,
  candidateDirectory,
  compiledDirectory,
  backupDirectory,
  confirmGroup,
  publishWrite = atomicWriteFrom,
}) {
  const workspace = path.resolve(workspaceRoot)
  const candidate = path.resolve(candidateDirectory)
  const compiled = path.resolve(compiledDirectory)
  const backup = path.resolve(backupDirectory)
  const backupRelation = path.relative(compiled, backup);
  const backupIsInsideCompiled =
    backupRelation === '' ||
    (!backupRelation.startsWith('..') && !path.isAbsolute(backupRelation));
  if (backupIsInsideCompiled) {
    throw new Error('Backup directory must be outside the compiled corpus')
  }
  try {
    if ((await readdir(backup)).length) throw new Error(`Backup directory must be empty: ${backup}`)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  const manifest = await readJson(path.join(candidate, 'authoritative_candidate_manifest.json'))
  if (manifest.candidate_kind !== 'authoritative-story-v2-collection' || !manifest.group_id) {
    throw new Error('Invalid authoritative candidate manifest')
  }
  if (confirmGroup !== manifest.group_id) throw new Error(`Explicit group confirmation is required: ${manifest.group_id}`)
  if (!Array.isArray(manifest.files) || manifest.files.length < 2) throw new Error('Candidate manifest file set is incomplete')

  const schema = await readJson(path.join(workspace, 'schemas', 'compiled-scenario-v2-authoritative.schema.json'))
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  addFormats(ajv)
  const validate = ajv.compile(schema)
  const records = []
  for (const record of manifest.files) {
    if (record.schema_valid !== true || record.runtime_text_equivalent !== true) {
      throw new Error(`Candidate record is not accepted: ${record.file}`)
    }
    const source = resolveInside(candidate, record.file)
    const target = resolveInside(compiled, record.file)
    if (!await exists(source) || !await exists(target)) throw new Error(`Candidate or formal target is missing: ${record.file}`)
    const sourceBytes = await readFile(source)
    const targetBytes = await readFile(target)
    if (hashBytes(sourceBytes) !== record.candidate_hash) throw new Error(`Candidate hash drift: ${record.file}`)
    if (hashBytes(targetBytes) !== record.old_hash) throw new Error(`Formal corpus drift since candidate build: ${record.file}`)
    const sourceValue = JSON.parse(sourceBytes)
    const targetValue = JSON.parse(targetBytes)
    if (!validate(sourceValue)) throw new Error(`${record.file}: ${ajv.errorsText(validate.errors)}`)
    let projectionInput = targetValue
    if (record.compatibility_evidence) {
      const evidencePath = resolveInside(candidate, record.compatibility_evidence.file)
      if (!await exists(evidencePath)) throw new Error(`Compatibility evidence is missing: ${record.file}`)
      const evidenceBytes = await readFile(evidencePath)
      if (hashBytes(evidenceBytes) !== record.compatibility_evidence.hash) {
        throw new Error(`Compatibility evidence hash drift: ${record.file}`)
      }
      projectionInput = JSON.parse(evidenceBytes)
      const migrationAudit = buildCompiledScenarioMigrationReport(targetValue, projectionInput)
      if (!migrationAudit.acceptance.passed) {
        throw new Error(`${record.file}: compatibility migration audit rejected evidence`)
      }
    }
    const equivalence = compareAuthoritativeRuntimeProjection(projectionInput, sourceValue)
    if (!equivalence.passed) throw new Error(`${record.file}: projection drift: ${equivalence.differences.join(', ')}`)
    records.push({ ...record, source, target, sourceBytes, targetBytes })
  }

  await mkdir(backup, { recursive: true })
  for (const record of records) {
    const backupTarget = resolveInside(backup, record.file)
    await mkdir(path.dirname(backupTarget), { recursive: true })
    await writeFile(backupTarget, record.targetBytes)
  }
  const published = []
  try {
    for (const record of records) {
      await publishWrite(record.source, record.target)
      published.push(record)
    }
    for (const record of records) {
      if (hashBytes(await readFile(record.target)) !== record.candidate_hash) {
        throw new Error(`Published hash verification failed: ${record.file}`)
      }
    }
  } catch (error) {
    for (const record of published.reverse()) {
      await atomicWriteFrom(resolveInside(backup, record.file), record.target)
    }
    throw error
  }
  const report = {
    schema_version: 1,
    group_id: manifest.group_id,
    compiler_version: manifest.compiler_version,
    published_at: new Date().toISOString(),
    files: records.map(record => ({
      file: record.file,
      old_hash: record.old_hash,
      new_hash: record.candidate_hash,
      backup_hash: hashBytes(record.targetBytes),
    })),
  }
  await writeFile(path.join(backup, 'authoritative_publish_backup_manifest.json'), jsonBytes(report))
  return report
}
