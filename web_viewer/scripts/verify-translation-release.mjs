import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import {computeTranslationRelease} from './lib/translation-release.mjs'

// The committed manifest and release must match the committed packs. build:check regenerates
// them silently, so without this a pack edit could ship under the old ?rev= and stay cached.
const root=path.resolve(import.meta.dirname,'..')
const {release,entries,manifest,config,manifestFile,configFile}=await computeTranslationRelease(root)
const committed=JSON.parse(await fs.readFile(manifestFile,'utf8'))
const stale=new Map(committed.entries.map(row=>[row.file,row]))
const changed=entries.filter(row=>stale.get(row.file)?.sha256!==row.sha256).map(row=>row.file)
const removed=committed.entries.filter(row=>!entries.some(entry=>entry.file===row.file)).map(row=>row.file)
assert.deepEqual({changed,removed},{changed:[],removed:[]},'translation packs changed without regenerating the release: node scripts/generate-translation-release.mjs')
assert.equal(await fs.readFile(manifestFile,'utf8'),manifest,'public/translations/manifest.json is stale')
assert.equal(await fs.readFile(configFile,'utf8'),config,'config/translation-release.json is stale')
console.log(`Translation release ${release.slice(0,12)}: manifest and config match ${entries.length} published packs`)
