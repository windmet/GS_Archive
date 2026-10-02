import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {createHash} from 'node:crypto'
const base=process.argv[2];assert(base?.startsWith('https://'))
const m=JSON.parse(await fs.readFile('public/data/song_experimental_audio.json'))
const urls=new Set()
for(const song of Object.values(m.songs)){
 urls.add(song.backing.url)
 for(const track of Object.values(song.single_tracks||{}))if(track.url)urls.add(track.url)
 for(const track of song.unit_tracks||[])if(track.url)urls.add(track.url)
 for(const solo of Object.values(song.solo_tracks))urls.add(solo.vocal.url)
}
const queue=[...urls],results=[]
await Promise.all(Array.from({length:6},async()=>{while(queue.length){const url=queue.shift(),local=await fs.readFile('public'+url)
 const r=await fetch(base+url,{headers:{Range:'bytes=0-31'},signal:AbortSignal.timeout(45000)}),body=Buffer.from(await r.arrayBuffer())
 assert.equal(r.status,206,url);assert.equal(r.headers.get('content-type'),'audio/mp4',url);assert.equal(r.headers.get('content-range'),`bytes 0-31/${local.length}`,url);assert(body.equals(local.subarray(0,32)),url)
 const result={url,status:r.status,bytes:local.length,range:true}
 if(/\/(byndtd|drvalv|grwsml)_(001tom|bgm)\.m4a$/.test(url)){
  const full=await fetch(base+url,{signal:AbortSignal.timeout(60000)});assert.equal(full.status,200,url)
  const remote=Buffer.from(await full.arrayBuffer());assert.equal(remote.length,local.length,url)
  result.sha256=createHash('sha256').update(local).digest('hex');assert.equal(createHash('sha256').update(remote).digest('hex'),result.sha256,url)
 }
 results.push(result)
}}))
await fs.writeFile('.analysis/ipad-audio-collection-20261002/music-http.json',JSON.stringify({base,at:new Date().toISOString(),checked:results.length,fullHashes:results.filter(r=>r.sha256).length,results},null,2))
console.log(`Verified ${results.length} published AAC resources: Range, MIME, byte lengths and signatures; ${results.filter(r=>r.sha256).length} full SHA-256 matches.`)
