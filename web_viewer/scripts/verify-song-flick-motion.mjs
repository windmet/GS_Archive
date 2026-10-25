import assert from 'node:assert/strict'
import { songAnimatedFlickHint, flickDisplacement, songFlickMotion } from '../src/presentation/SongFlickMotion.js'
const root={position:[0,0,0],scale:[1,1,1]}
for(const role of ['swipe_left','swipe_right','swipe_up']) {
 const a=songAnimatedFlickHint(role,root,.05,7),b=songAnimatedFlickHint(role,root,.25,7)
 assert.equal(a.layers.length,6,'three systems with two source burst particles')
 assert.notDeepEqual(a,b,'arrows must move relative to the body')
 assert.deepEqual(a,songAnimatedFlickHint(role,root,.05,7),'seek/pause reproducible')
 const source=songFlickMotion.layers[role][1],axis=role==='swipe_up'?'y':'x'
 const d=flickDisplacement(source.velocity[axis],.25,.5)
 assert.ok(Math.abs(Math.abs(d)-.4375)<1e-6,'integrated source velocity at apex')
 assert.ok(Math.abs(flickDisplacement(source.velocity[axis],.5,.5))<1e-6,'returns before next burst')
 assert.ok(b.layers.some(x=>x.url.includes('blur-')),'blur texture is consumed')
}
console.log('Native loop/burst, velocity integral, moving outline/fill/blur and deterministic seeks passed')
