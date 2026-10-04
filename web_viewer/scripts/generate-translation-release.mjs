import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
const root = path.resolve(import.meta.dirname,'..'), base=path.join(root,'public/translations')
const entries=[]
async function walk(dir) {
  for (const item of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))) {
    const file=path.join(dir,item.name)
    if(item.isDirectory()) await walk(file)
    else if(item.name.endsWith('.json') && file!==path.join(base,'manifest.json')) {
      const bytes=await fs.readFile(file)
      entries.push({file:path.relative(base,file).replaceAll('\\','/'),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length})
    }
  }
}
await walk(base)
const release=createHash('sha256').update(JSON.stringify(entries)).digest('hex')
await fs.writeFile(path.join(base,'manifest.json'),JSON.stringify({schemaVersion:1,release,entries})+'\n')
await fs.writeFile(path.join(root,'config/translation-release.json'),JSON.stringify({schemaVersion:1,release,files:entries.length})+'\n')
console.log(`Translation release ${release}: ${entries.length} source-bound files`)
