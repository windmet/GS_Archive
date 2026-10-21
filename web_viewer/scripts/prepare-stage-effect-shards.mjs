import fs from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {compileStageEffectShards,STAGE_EFFECT_CATALOG_URL} from '../src/core/chibiStageEffectShards.js'
const root=new URL('../public/',import.meta.url)
const paths={effects:'assets/live-chibi/stage-effects/index.json',commands:'data/stage-stagelight-commands.json',oldSuspension:'data/stage-old-suspension.json',sprites:'data/stage-new-suspension-sprites.json'}
const documents=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([name,path])=>{
  const text=await fs.readFile(new URL(path,root),'utf8');return [name,{text,data:JSON.parse(text)}]
})))
const {catalog,files}=compileStageEffectShards(documents,text=>createHash('sha256').update(text).digest('hex'))
files.set(STAGE_EFFECT_CATALOG_URL,JSON.stringify(catalog)+'\n')
if(!process.argv.includes('--write') && !process.argv.includes('--check'))throw Error('Choose --check or --write')
for(const [path,text] of files) {
  const target=new URL(path.slice(1),root)
  if(process.argv.includes('--write')){await fs.mkdir(new URL('.',target),{recursive:true});await fs.writeFile(target,text)}
  else if(await fs.readFile(target,'utf8')!==text)throw Error(`Stale stage effect shard: ${path}`)
}
console.log(JSON.stringify({mode:process.argv.includes('--write')?'write':'check',arrangements:Object.keys(catalog.songs).length,
  catalogBytes:Buffer.byteLength(files.get(STAGE_EFFECT_CATALOG_URL)),commonBytes:catalog.common.bytes,
  shardBytes:Object.values(catalog.songs).reduce((sum,song)=>sum+song.bytes,0),maxShard:Math.max(...Object.values(catalog.songs).map(song=>song.bytes))}))
