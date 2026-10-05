// Node-side scene data for projections that cannot run in the browser (they use node:crypto).
// Writes qa/gallery/generated/*.json (gitignored). capture-gallery runs this first.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildMobileRecords } from '../../readmodels/lib/mobile_projection.mjs'
import * as selectors from '../../src/data/idolCommunicationSelectors.js'

const root = fileURLToPath(new URL('../../', import.meta.url))
const json = path => JSON.parse(readFileSync(`${root}public/data/${path}`, 'utf8'))

export function prepareGalleryData() {
  const out = `${root}qa/gallery/generated/`
  mkdirSync(out, { recursive: true })
  const records = buildMobileRecords({
    mobileArchive: json('masterdata/mobile_archive_index.json'),
    randomTalkPresentation: json('masterdata/random_talk_presentation_index.json'),
    compiledIndex: json('compiled/index.json'),
    idolUnit: json('masterdata/idol_unit_dictionary.json'),
    archiveManifest: json('archive_manifest.json'),
    cardIndex: json('masterdata/card_index.json'),
    idolEpisode: json('masterdata/idol_episode_index.json'),
  }, selectors)
  writeFileSync(`${out}mobile-001tom.json`, JSON.stringify(records.idolRecords.find(record => record.id === '001tom')))
}

if (import.meta.url === `file:///${process.argv[1]?.replaceAll('\\', '/')}`) prepareGalleryData()
