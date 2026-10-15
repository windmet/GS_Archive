import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {sampleBloomSystem,attachBloom} from '../src/core/chibiBloomParticles.js'
const data=JSON.parse(fs.readFileSync(new URL('../public/data/stage-bloom-particles.json',import.meta.url)))
const published=process.argv.includes('--published-assets')
const index=published?JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/object-layers/index.json',import.meta.url))):{assets:Object.fromEntries(Object.entries(data.assets).map(([name,m])=>[name,{bundle:m.bundle,particleCount:m.particleCount}]))}
const hash=published?crypto.createHash('sha256').update(fs.readFileSync(new URL('../public/assets/live-chibi/object-layers/index.json',import.meta.url))).digest('hex'):data.objectIndexSha256
const attached=attachBloom(index,data,hash)
assert.throws(()=>attachBloom(index,data,'0'.repeat(64)))
assert.equal(Object.keys(data.assets).length,3)
if(published)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../public/assets/live-chibi/'+data.texture.file,import.meta.url))).digest('hex'),data.texture.pngSha256)
for(const [name,model] of Object.entries(data.assets)){
 assert.equal(attached.assets[name].bloomAnimation.systems.length,3)
 assert.equal(index.assets[name].bloomAnimation,undefined)
 const system=model.systems[1]
 assert.deepEqual(sampleBloomSystem(system,100,0),[])
 const a=sampleBloomSystem(system,200,0),b=sampleBloomSystem(system,400,0)
 assert.equal(a.length,name.endsWith('_1')?60:40)
 const radius=s=>Math.hypot(s.x-system.position.x*100,(s.y+system.position.y*100)/system.scaleY/Math.cos(system.angle*Math.PI/180))
 assert.ok(radius(b[0])>radius(a[0]))
 const theta=p=>Math.atan2(-(p.y+system.position.y*100)/system.scaleY/Math.cos(system.angle*Math.PI/180),p.x-system.position.x*100)
 const steps=a.slice(1).map((p,i)=>Math.round((((theta(p)-theta(a[i]))/(Math.PI*2)+1)%1)*10000))
 assert.ok(new Set(steps).size>steps.length*.8,'Birth angles must not advance by a fixed step: that creates an orbiting regular ring')
 const radial=a.map(radius),mean=radial.reduce((a,b)=>a+b)/radial.length
 assert.ok(Math.sqrt(radial.reduce((sum,r)=>sum+(r-mean)**2,0)/radial.length)>.015*mean,'Native random speeds must spread the radial front')
 for(let i=0;i<a.length;i++){
  const dx=p=>p.x-system.position.x*100,dy=p=>p.y+system.position.y*100
  assert.ok(Math.abs(dx(a[i])*dy(b[i])-dy(a[i])*dx(b[i]))<1e-6,'The SAME particle keeps its birth direction; it cannot orbit')
  assert.ok(radius(b[i])>radius(a[i]),'Every surviving burst particle travels outward')
 }
 assert.equal(model.systems[0].speed.scalar,0,'Separate disk shimmer retains its native zero speed')
 assert.deepEqual(sampleBloomSystem(system,400,0),b)
 assert.deepEqual(sampleBloomSystem(system,4000,0),[])
 assert.equal(system.radius<.001,true)
 assert.ok(model.systems[2].billboardScaleY<.5)
}
console.log('FLASH LIGHT 3 bloom prefabs / 9 emitters: resource hashes, outward unmasked emission, native delays, lifetime, replay and end retirement passed')
