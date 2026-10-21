import fs from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {compileConsumerShards,CONSUMER_CATALOG_URL} from '../src/core/chibiConsumerShards.js'
const root=new URL('../public/',import.meta.url)
const paths={penlightCommands:'data/stage-penlight-commands.json',penlightModel:'assets/live-chibi/penlight/index.json',emitters:'data/stage-object-emitters.json'}
const documents=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([key,path])=>{const text=await fs.readFile(new URL(path,root),'utf8');return [key,{text,data:JSON.parse(text)}]})))
const {catalog,files}=compileConsumerShards(documents,text=>createHash('sha256').update(text).digest('hex'))
files.set(CONSUMER_CATALOG_URL,JSON.stringify(catalog)+'\n')
if(!process.argv.includes('--write') && !process.argv.includes('--check'))throw Error('Choose --check or --write')
for(const [path,text] of files){const target=new URL(path.slice(1),root)
 if(process.argv.includes('--write')){await fs.mkdir(new URL('.',target),{recursive:true});await fs.writeFile(target,text)}
 else if(await fs.readFile(target,'utf8')!==text)throw Error(`Stale consumer shard: ${path}`)
}
console.log(JSON.stringify({mode:process.argv.includes('--write')?'write':'check',songs:Object.keys(catalog.songs).length,emitters:Object.keys(catalog.emitters).length,
 catalogBytes:Buffer.byteLength(files.get(CONSUMER_CATALOG_URL)),commonBytes:catalog.common.bytes,
 penlightBytes:Object.values(catalog.songs).reduce((n,item)=>n+item.bytes,0),emitterBytes:Object.values(catalog.emitters).reduce((n,item)=>n+item.bytes,0)}))
