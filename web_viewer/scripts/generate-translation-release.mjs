import fs from 'node:fs/promises'
import path from 'node:path'
import {computeTranslationRelease} from './lib/translation-release.mjs'
const root = path.resolve(import.meta.dirname,'..')
const {release,entries,manifest,config,manifestFile,configFile}=await computeTranslationRelease(root)
await fs.writeFile(manifestFile,manifest)
await fs.writeFile(configFile,config)
console.log(`Translation release ${release}: ${entries.length} source-bound files`)
