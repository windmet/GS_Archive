// Cropped PNG coordinates differ from the original Sprite's full-rect pivot.
export function attachObjectSpriteGeometry(index,data,hash){
 if(data?.schemaVersion!==1 || data.objectIndexSha256!==hash)throw Error('Sprite geometry object index mismatch')
 const assets={...index.assets}
 for(const [name,model] of Object.entries(data.assets || {})){
  const original=assets[name]
  if(original?.bundle!==model.bundle)throw Error('Sprite geometry bundle mismatch')
  const textures=original.textures.map(texture=>{
   const geometry=model.textures.find(row=>row.id===texture.id && row.file===texture.file)
   if(!geometry || !Number.isFinite(geometry.pivot?.x) || !Number.isFinite(geometry.pivot?.y)
     || !/^[a-f0-9]{64}$/.test(geometry.pngSha256 || '') || !/^[a-f0-9]{64}$/.test(geometry.spriteSha256 || ''))throw Error('Invalid cropped Sprite registration')
   return {...texture,pivot:geometry.pivot,nativeGeometry:geometry}
  })
  assets[name]={...original,textures}
 }
 return {...index,assets}
}
export function applyObjectSpriteGeometry(runtime,entry){
 const textures=new Map(entry?.textures?.map(texture=>[texture.id,texture]) || [])
 for(const [i,sprite] of (runtime.objectSprites || []).entries()){
  const metadata=textures.get(entry.instances[i].texture)
  if(metadata)sprite.anchor.set(metadata.pivot.x,metadata.pivot.y)
 }
}
