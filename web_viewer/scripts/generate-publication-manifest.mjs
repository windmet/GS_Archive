import { mkdir, writeFile } from 'node:fs/promises'
import {
  buildPublicationManifest,
  manifestPath,
  publicationRoot,
  readReleaseFiles,
  releasesRoot,
  stableJson,
} from './lib/publication-ledger.mjs'

await mkdir(publicationRoot, { recursive: true })
await mkdir(releasesRoot, { recursive: true })
const releases = readReleaseFiles()
const manifest = buildPublicationManifest(releases)
await writeFile(manifestPath, stableJson(manifest), 'utf8')

console.log(
  `Publication manifest written: ${releases.length} releases / ` +
  `${Object.keys(manifest.by_logical_id).length} stable logical IDs`,
)
