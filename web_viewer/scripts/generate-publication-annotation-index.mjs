import { mkdir, writeFile } from 'node:fs/promises'
import {
  annotationIndexPath,
  annotationsRoot,
  buildAnnotationIndex,
  publicationRoot,
  readAnnotationRecords,
  stableJson,
} from './lib/publication-ledger.mjs'

await mkdir(publicationRoot, { recursive: true })
await mkdir(annotationsRoot, { recursive: true })
const annotations = readAnnotationRecords()
const index = buildAnnotationIndex(annotations)
await writeFile(annotationIndexPath, stableJson(index), 'utf8')

console.log(
  `Publication annotation index written: ${annotations.length} annotations / ` +
  `${Object.keys(index.by_release_id).length} target releases`,
)
