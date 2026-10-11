import assert from 'node:assert/strict'
import fs from 'node:fs'
import { chibiGroundRegistration, projectChibiGround } from '../src/core/chibiStageCoordinates.js'

// Independent visual witnesses from the published 1900x1060 stage art;
// these are measured platform centres, not extracted Unity transforms.
const witnesses = [
  { csv: { x: -350, y: 270 }, image: { x: 600, y: 620 } },
  { csv: { x: 0, y: 140 }, image: { x: 950, y: 750 } },
  { csv: { x: 350, y: 230 }, image: { x: 1300, y: 660 } },
]
for (const [width, height] of [[1280,720],[869.46,489.07125],[357,200.8125],[327,183.9375],[321,180.5625]]) {
  const fit = Math.min(width / 1280, height / 720)
  for (const { csv, image } of witnesses) {
    const point = projectChibiGround('steqmg', csv, width, height)
    const artPoint = { x: width/2+(image.x-950)*fit, y: height/2+(image.y-530)*fit }
    assert.ok(Math.abs(point.x-artPoint.x)<1e-8)
    assert.ok(Math.abs(point.y-artPoint.y)<1e-8)
    // The former baseline displaced all three equally toward the front edge.
    const oldY = height*.82+(180-csv.y)*fit
    assert.ok(Math.abs(oldY-point.y-50.4*fit)<1e-8)
  }
}
assert.equal(chibiGroundRegistration('steqmg').id, 'design-space-ground-v1')
for (const code of ['anwhre','tkstp1','tkstp2','psblts','drvalv','brndnf',undefined]) {
  const point = projectChibiGround(code, {x:230,y:190}, 1280,720)
  assert.equal(point.x, 870)
  assert.equal(point.y, 530)
  assert.equal(chibiGroundRegistration(code).id, 'design-space-ground-v1')
  // A letterboxed/rounded canvas must retain registration with centred art.
  for (const [width,height] of [[869,489],[800,500]]) {
    assert.equal(projectChibiGround(code,{x:230,y:190},width,height).y,
      height/2+170*Math.min(width/1280,height/720))
  }
}
// Check all published arrangements, including movement events and variants.
// This proves coordinate consistency, not visual fidelity of unvisited stages.
if (process.argv.includes('--published-assets')) {
  const catalog = JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/choreography/index.json',import.meta.url),'utf8'))
  let positions = 0
  for (const song of catalog.songs) {
    for (const event of song.positionEvents || []) {
      if (![event.x,event.y].every(Number.isFinite)) continue
      const point = projectChibiGround(song.songCode,event,1280,720)
      assert.equal(point.x,640+event.x)
      assert.equal(point.y,720-event.y)
      for (const [width,height] of [[357,201],[321,180],[800,500]]) {
        const fit = Math.min(width/1280,height/720)
        const scaled = projectChibiGround(song.songCode,event,width,height)
        assert.ok(Math.abs((scaled.x-width/2)/fit-(point.x-640))<1e-8)
        assert.ok(Math.abs((scaled.y-height/2)/fit-(point.y-360))<1e-8)
      }
      positions++
    }
  }
  console.log(`Published ground projection: ${positions} positions across ${catalog.songs.length} arrangements; visual coverage remains separate`)
}
console.log('Ground registration: three independent platform witnesses and design-space resize checks passed')
