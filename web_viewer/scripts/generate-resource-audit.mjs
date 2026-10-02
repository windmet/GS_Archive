import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
const root=process.cwd(), read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'))
const hash=createHash('sha256'), sources=[]
const source=file=>{const bytes=fs.readFileSync(path.join(root,file));hash.update(file).update(bytes);sources.push({file,sha256:createHash('sha256').update(bytes).digest('hex')});return JSON.parse(bytes)}
const card=source('public/data/masterdata/card_index.json'), costumes=source('public/data/masterdata/costume_dictionary.json'), idols=source('public/data/masterdata/idol_unit_dictionary.json'), items=source('public/data/masterdata/domains/item_catalog.json'), honors=source('public/data/masterdata/domains/honor_catalog.json'), photos=source('public/data/masterdata/domains/photo_materials.json'), songs=source('public/data/song_catalog.json'), charts=source('public/data/song_charts/manifest.json'), reader=source('public/data/reading/manifest.json'), publication=source('public/data/publication/manifest.json')
const assets={}, extensions={}, missing=[], unavailable=[];let fileCount=0,bytesTotal=0, latest=0
function walk(dir,relative='') {
 if(!fs.existsSync(dir)){unavailable.push(relative);return}
 for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
  const file=path.join(dir,entry.name), rel=relative?`${relative}/${entry.name}`:entry.name
  if(entry.isSymbolicLink()){unavailable.push(rel);continue}
  if(entry.isDirectory())walk(file,rel)
  else if(entry.isFile()){
   const stat=fs.statSync(file), group=rel.split('/')[0], ext=path.extname(rel).toLowerCase()||'(无扩展名)'
   ;(assets[group]||={files:0,bytes:0}).files++;assets[group].bytes+=stat.size
   ;(extensions[ext]||={files:0,bytes:0}).files++;extensions[ext].bytes+=stat.size
   fileCount++;bytesTotal+=stat.size;latest=Math.max(latest,stat.mtimeMs);hash.update(rel).update(`${stat.size}:${stat.mtimeMs}`)
  }
 }
}
walk(path.join(root,'public/assets'))
assert(songs.songs && !Array.isArray(songs.songs) && charts.songs && !Array.isArray(charts.songs),'Song/chart catalogue shape changed')
let chartFiles=0, chartMissing=0, chartChanged=0
for(const entry of Object.values(charts.songs).flatMap(song=>Object.values(song))) {
 assert(/^\/data\/song_charts\/[a-z0-9_-]+\.json$/.test(entry.url),'Unexpected chart path')
 const file=path.join(root,'public',entry.url.slice(1));chartFiles++
 if(!fs.existsSync(file)){chartMissing++;continue}
 const bytes=fs.readFileSync(file);hash.update(entry.url).update(bytes)
 if(bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)chartChanged++
}
const counts=[{label:'偶像',count:idols.idols.length},{label:'卡片资料记录',count:card.cards.length},{label:'衣装资料记录',count:costumes.costumes.length},{label:'道具',count:items.entries.length},{label:'称号',count:honors.entries.length},{label:'摄影素材',count:Object.values(photos).filter(Array.isArray).reduce((n,a)=>n+a.length,0)},{label:'歌曲',count:Object.keys(songs.songs).length},{label:'谱面文件（含未分配轨）',count:chartFiles},{label:'阅读文档',count:reader.entries.length},{label:'发布来源记录',count:Object.keys(publication.by_logical_id||{}).length}]
// This is a local filesystem inventory, not online MIME, decode or device QA.
const target=path.join(root,'config/resource-audit.json');let previous=null
if(fs.existsSync(target))previous=read('config/resource-audit.json')
let storage=previous?.storage||null
if(process.argv.includes('--refresh-r2')){
 const remote='cloudflare:sidem-archive-preview', raw=execFileSync('rclone',['size',remote,'--json'],{encoding:'utf8',windowsHide:true,maxBuffer:1024*1024}), value=JSON.parse(raw)
 storage={remote,objects:value.count,bytes:value.bytes,checkedAt:new Date().toISOString(),limitBytes:8600000000,belowLimit:value.bytes<8600000000,scope:'目标预览桶全部对象，含旧版本；不是本地 public 目录大小'}
}
const digest=hash.digest('hex'), value={schemaVersion:1,sourceDigest:digest,auditedAt:previous?.sourceDigest===digest?previous.auditedAt:new Date().toISOString(),scope:'当前客户端资料目录与本地 public/assets 文件清单；不代表在线全资源可用或设备验收',counts,chartIntegrity:{files:chartFiles,missing:chartMissing,changed:chartChanged},localAssets:{files:fileCount,bytes:bytesTotal,latestFileChange:latest?new Date(latest).toISOString():null,groups:assets,extensions,unavailable},sources,storage,legacy:{manifestGenerated:read('public/data/archive_manifest.json').generated_at,verificationGenerated:read('public/data/archive_verification.json').generated_at}}
const text=JSON.stringify(value,null,2)+'\n'
if(!previous||JSON.stringify(previous)!==JSON.stringify(value))fs.writeFileSync(target,text)
console.log(JSON.stringify({auditedAt:value.auditedAt,sourceDigest:digest,counts,localAssets:{files:fileCount,bytes:bytesTotal,unavailable:unavailable.length},storage},null,2))
