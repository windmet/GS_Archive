import fs from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {compileChoreographyShards,CHOREOGRAPHY_CATALOG_URL} from '../src/core/chibiChoreographyShards.js'
const root=new URL('../public/',import.meta.url)
const paths={choreography:'assets/live-chibi/choreography/index.json',spotlight:'data/stage-spotlight-commands.json',wholeScreen:'data/stage-whole-screen.json',searchlights:'data/stage-searchlights.json'}
const documents=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([key,path])=>{
  const text=await fs.readFile(new URL(path,root),'utf8');return [key,{text,data:JSON.parse(text)}]
})))
const hash=text=>createHash('sha256').update(text).digest('hex')
const {catalog,files}=compileChoreographyShards(documents,hash)
files.set(CHOREOGRAPHY_CATALOG_URL,JSON.stringify(catalog)+'\n')
if(!process.argv.includes('--write') && !process.argv.includes('--check'))throw Error('Choose --check or --write')
for(const [path,text] of files) {
  const target=new URL(path.slice(1),root)
  if(process.argv.includes('--write')) {await fs.mkdir(new URL('.',target),{recursive:true});await fs.writeFile(target,text)}
  else if(await fs.readFile(target,'utf8')!==text)throw Error(`Stale choreography shard: ${path}`)
}
console.log(JSON.stringify({mode:process.argv.includes('--write')?'write':'check',source:catalog.index.sourceBinding,
  arrangements:catalog.index.songs.length,catalogBytes:Buffer.byteLength(files.get(CHOREOGRAPHY_CATALOG_URL)),
  shardBytes:[...files].filter(([path])=>path!==CHOREOGRAPHY_CATALOG_URL).reduce((n,[,text])=>n+Buffer.byteLength(text),0),
  largestShard:Math.max(...Object.values(catalog.shards).map(item=>item.bytes))}))
