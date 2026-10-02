import assert from 'node:assert/strict'
import fs from 'node:fs'
import { backmonitorRegistration, projectChibiBackmonitor } from '../src/core/chibiBackmonitorCoordinates.js'

// Independent measurements of the interior alpha hole in both original stage PNGs.
const aperture = [726, 300, 1160, 542]
const source = { x: -7, y: 340, scale: 920 }
for (const code of ['tkstp1', 'tkstp2']) {
  assert.equal(backmonitorRegistration(code).id, 'take-screen-aperture-v1')
  for (const [width,height] of [[1280,720],[869,489],[357,201],[321,180],[800,500]]) {
    for (const environmentScale of [1,1.073,.85]) {
      const fit = Math.min(width/1280,height/720)*environmentScale
      const movie = projectChibiBackmonitor(code,source,width,height,environmentScale)
      const opening = [width/2+(aperture[0]-950)*fit,height/2+(aperture[1]-530)*fit,
        width/2+(aperture[2]-950)*fit,height/2+(aperture[3]-530)*fit]
      const bounds = [movie.x-272*movie.scale/2,movie.y-144*movie.scale/2,
        movie.x+272*movie.scale/2,movie.y+144*movie.scale/2]
      assert.ok(bounds[0]<opening[0] && bounds[1]<opening[1] && bounds[2]>opening[2] && bounds[3]>opening[3])
      assert.ok(Math.abs(movie.y-(opening[1]+opening[3])/2)<1e-8)
      // The former screen was lower, leaving 7.52 design pixels uncovered at its top.
      assert.ok(Math.abs(height/2-90*fit-144*movie.scale/2-opening[1]-7.52*fit)<1e-8)
    }
  }
  // Authored motion remains relative to the registered frame, rather than snapping to it.
  const moved=projectChibiBackmonitor(code,{...source,x:23,y:360},1280,720)
  assert.equal(moved.x,663); assert.equal(moved.y,231)
}
assert.deepEqual(projectChibiBackmonitor('steqmg',source,1280,720),{x:633,y:270,scale:1.84})
if (process.argv.includes('--published-assets')) {
  const root=new URL('../public/assets/live-chibi/',import.meta.url)
  const read=path=>JSON.parse(fs.readFileSync(new URL(path,root),'utf8'))
  const songs=read('choreography/index.json').songs
  const backgrounds=read('stage-backgrounds/index.json').songs
  const media=read('backmonitor/index.json').assets
  for (const code of ['tkstp1','tkstp2']) {
    assert.equal(backgrounds[code].width,1900); assert.equal(backgrounds[code].height,1060)
    const song=songs.find(song=>song.id===code+'_live_effect')
    for (const event of song.backmonitorEvents) {
      assert.equal(event.x,source.x); assert.equal(event.y,source.y); assert.equal(event.scale,source.scale)
      const movie=media[event.movie]
      assert.equal(movie.width,272); assert.equal(movie.height,144)
    }
  }
  console.log('Published Take screen dimensions and all authored backmonitor positions passed')
}
console.log('Take aperture coverage: desktop, portrait, landscape, letterbox and environment scaling passed')
