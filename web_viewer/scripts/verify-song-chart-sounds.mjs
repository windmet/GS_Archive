import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { createSongChartSoundPlayer, songSoundRole, songChartSounds as spec } from '../src/presentation/SongChartSoundPlayer.js'
assert.equal(Object.keys(spec.sets).length,4)
for (const asset of Object.values(spec.assets)) {
  const file=new URL('../public'+asset.url,import.meta.url)
  if(fs.existsSync(file)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),asset.sha256)
}
assert.equal(songSoundRole({endpoint:'middle',role:'normal'}),null)
assert.equal(songSoundRole({endpoint:'head',role:'sp'}),null)
assert.equal(songSoundRole({endpoint:'head',role:'p_skill'}),'perfect')
assert.equal(songSoundRole({endpoint:'head',role:'p_skill'},'president'),'pskill')
const started=[],stopped=[]
const ctx={state:'running',currentTime:10,destination:{},async resume(){},async close(){},
  createGain:()=>({gain:{value:0},connect(){}}),decodeAudioData:async b=>b,
  createBufferSource(){return {connect(){},disconnect(){},start(t){started.push(t)},stop(){stopped.push(this)}}}}
const player=createSongChartSoundPlayer({contextFactory:()=>ctx,fetchAudio:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)})})
player.setTimeline({groups:[{seconds:1,events:[{role:'normal'},{role:'normal'},{role:'swipe_right'}]},{seconds:2,events:[{role:'p_skill'}]}]})
for(const set of Object.keys(spec.sets)) {
 await player.prepare(set); player.seek(.9); const before=started.length
 player.paint(.9);assert.equal(started.length-before,2,'same-timing taps collapse independently of flick')
 assert.equal(started.at(-1),10.1); player.paint(.95);assert.equal(started.length-before,2,'lookahead cannot double play')
 player.seek(1.8);assert.equal(stopped.length>0,true)
 player.paint(2.01);assert.equal(started.length-before,3,'P skill scheduled once')
 player.seek(0);player.paint(4);assert.equal(started.length-before,3,'large jump suppresses catch-up')
}
await player.prepare('off'); const count=started.length; player.seek(.9);player.paint(.9);assert.equal(started.length,count)
player.dispose()
console.log('Four sound sets, hashes, simultaneous suppression, lookahead, cancel/seek, catch-up and off passed')
