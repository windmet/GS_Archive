import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadArchiveSources } from './lib/archive-sources.mjs'

const root = await mkdtemp(path.join(os.tmpdir(), 'sidem-js-archive-sources-'))

try {
  const configPath = path.join(root, 'config', 'archive_sources.json')
  await mkdir(path.dirname(configPath), { recursive: true })
  await writeFile(
    configPath,
    `${JSON.stringify({
      schema_version: 1,
      archive_root: '..',
      legacy_root: 'legacy',
    })}\n`,
    'utf8',
  )

  const sources = loadArchiveSources({
    configPath,
    environment: {},
  })
  assert.equal(sources.archiveRoot, root)
  assert.equal(sources.legacyRoot, path.join(root, 'legacy'))
  assert.equal(
    sources.legacyPath('GS_Res', 'Audio'),
    path.join(root, 'legacy', 'GS_Res', 'Audio'),
  )
  assert.equal(sources.legacyConfigured, true)

  const nullConfig = path.join(root, 'archive_sources.null.json')
  await writeFile(nullConfig, `${JSON.stringify({
    schema_version: 1,
    archive_root: '.',
    legacy_root: null,
  })}\n`, 'utf8')
  const fallback = loadArchiveSources({
    configPath: nullConfig,
    environment: {},
  })
  assert.equal(
    fallback.legacyRoot,
    path.join(root, 'sources', 'legacy_curated'),
  )
  assert.equal(fallback.legacyConfigured, false)
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log('Archive JS source configuration fixture passed.')
