import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {attachObjectSpriteGeometry,applyObjectSpriteGeometry} from '../src/core/chibiObjectSpriteGeometry.js'
const data=JSON.parse(fs.readFileSync(new URL('../public/data/stage-object-sprite-geometry.json',import.meta.url)))
const published=process.argv.includes('--published-assets')
const index=published?JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/object-layers/index.json',import.meta.url))):{assets:Object.fromEntries(Object.entries(data.assets).map(([name,m])=>[name,{bundle:m.bundle,textures:m.textures.map(t=>({id:t.id,file:t.file,pivot:{x:.5,y:.5}}))}]))}
const hash=published?crypto.createHash('sha256').update(fs.readFileSync(new URL('../public/assets/live-chibi/object-layers/index.json',import.meta.url))).digest('hex'):data.objectIndexSha256
const attached=attachObjectSpriteGeometry(index,data,hash)
assert.throws(()=>attachObjectSpriteGeometry(index,data,'0'.repeat(64)))
assert.equal(Object.keys(data.assets).length,46)
assert.equal(Object.values(data.assets).reduce((sum,a)=>sum+a.textures.length,0),53)
const model=attached.assets.fx_in_ossshd_spotlight_1
const under=model.textures.find(t=>t.id==='8534608171218544774')
assert.ok(under.pivot.y < -3,'Native cropped light pool lies below the origin')
assert.ok(Math.abs(-under.pivot.y*113-387)<.001)
const sprite={anchor:{set(x,y){this.x=x;this.y=y}}},runtime={objectSprites:[sprite]}
applyObjectSpriteGeometry(runtime,{...model,instances:[{texture:under.id}]})
assert.equal(sprite.anchor.y,under.pivot.y,'Late optional geometry updates installed renderers')
assert.equal(index.assets.fx_in_ossshd_spotlight_1.textures.find(t=>t.id===under.id).pivot.y,.5,'Shared source stays untouched')
if(published)for(const model of Object.values(data.assets))for(const texture of model.textures){
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../public/assets/live-chibi/'+texture.file,import.meta.url))).digest('hex'),texture.pngSha256)
}
console.log('46 object prefabs / 53 cropped native Sprite registrations: light-pool Y, hashes, late refinement and immutable shared indexes passed')
