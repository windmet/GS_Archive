import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'

// The one translation release computation. The runtime appends ?rev=<release> to every
// translation fetch, so the release must change whenever any published pack byte changes,
// and must not change because a Windows checkout rewrote line endings.
export async function computeTranslationRelease(root) {
  const base=path.join(root,'public/translations'), manifestFile=path.join(base,'manifest.json')
  const entries=[], crlf=[]
  async function walk(dir) {
    for (const item of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))) {
      const file=path.join(dir,item.name)
      if(item.isDirectory()) await walk(file)
      else if(item.name.endsWith('.json') && file!==manifestFile) {
        const bytes=await fs.readFile(file), rel=path.relative(base,file).replaceAll('\\','/')
        // JSON escapes CR inside strings, so a raw CR byte only comes from checkout conversion.
        if(bytes.includes(13)) crlf.push(rel)
        entries.push({file:rel,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length})
      }
    }
  }
  await walk(base)
  if(crlf.length) throw new Error(`Translation packs have CR bytes (CRLF checkout?): ${crlf.slice(0,5).join(', ')}${crlf.length>5?` and ${crlf.length-5} more`:''}. Re-checkout them with LF before computing the release.`)
  const release=createHash('sha256').update(JSON.stringify(entries)).digest('hex')
  return {
    release, entries,
    manifest: JSON.stringify({schemaVersion:1,release,entries})+'\n',
    config: JSON.stringify({schemaVersion:1,release,files:entries.length})+'\n',
    manifestFile, configFile: path.join(root,'config/translation-release.json'),
  }
}
