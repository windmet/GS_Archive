import fs from 'node:fs/promises';
import path from 'node:path';
import {SkeletonBinary,RegionAttachment,MeshAttachment,BoundingBoxAttachment,PathAttachment,PointAttachment,ClippingAttachment} from '@pixi-spine/runtime-3.8';
import {decodeUnitySpineSkeleton} from '../shared/story/SpineBinary.js';
class Attachments{
  newRegionAttachment(_s,n){return new RegionAttachment(n)} newMeshAttachment(_s,n){return new MeshAttachment(n)}
  newBoundingBoxAttachment(_s,n){return new BoundingBoxAttachment(n)} newPathAttachment(_s,n){return new PathAttachment(n)}
  newPointAttachment(_s,n){return new PointAttachment(n)} newClippingAttachment(_s,n){return new ClippingAttachment(n)}
}
const root=path.resolve(process.argv[2]||'');if(!process.argv[2]||root.startsWith(path.resolve('public')))throw Error('Supply an external candidate');
let models=0;
for(let id=1;id<=49;id++){
  const file=path.join(root,'photo_costumes',`${id}.json`),value=JSON.parse(await fs.readFile(file,'utf8'));
  for(const binding of Object.values(value.models)){
    if(binding.status!=='verified-local-files')continue;
    const bytes=await fs.readFile(path.join('public',binding.skeleton.url));
    const clean=decodeUnitySpineSkeleton(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
    const data=new SkeletonBinary(new Attachments()).readSkeletonData(new Uint8Array(clean));
    binding.animationNames=data.animations.map(animation=>animation.name);models++;
  }
  await fs.writeFile(file,JSON.stringify(value,null,2)+'\n');
}
console.log(`${models} dictionary-owned skeletons parsed; exact animation inventories recorded`);
