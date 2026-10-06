export const STUDIO_WIDTH=1280,STUDIO_HEIGHT=720;
export function studioExportSize(width=STUDIO_WIDTH,height=STUDIO_HEIGHT) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('Invalid export size');
  const scale=Math.min(1,Math.sqrt(2*1024*1024/(width*height)),1920/width,1080/height);
  return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))};
}
export function verifiedStudioPreset(media,kind,id,modelId) {
  const preset=media?.entries?.[`${kind}:${id}`]?.preset;
  if(!preset || preset.status!=='script-bound-runtime-pending' || preset.modelId!==modelId || !media.models?.[modelId] || media.models[modelId].status!=='verified-local-files')throw Error('摄影预设尚未完成来源绑定');
  return preset;
}
export function studioAnimationPlan(pose,face,names) {
  const chosenFace=face.face || pose.face;
  if(!pose.motion || !chosenFace)throw Error('姿势或表情配置缺失');
  for(const animation of [pose.motion,chosenFace,pose.neck].filter(Boolean))if(!names.includes(animation))throw Error(`模型缺少配置动作：${animation}`);
  return {motion:pose.motion,face:chosenFace,neck:pose.neck || null};
}
// The studio's four filters have no web shader; each is a colour matrix pulled toward sepia or grey
// by a strength. The stage builds the matrix from this table and the material picker previews the
// same thing as a CSS filter on the current scene.
export const STUDIO_WEB_FILTERS=Object.freeze({
  sepia:{kind:'sepia',strength:1},sepia_light:{kind:'sepia',strength:.35},
  gray:{kind:'desaturate',strength:.6},mono:{kind:'desaturate',strength:1},
});
export function studioFilterCss(resourceId) {
  const filter=STUDIO_WEB_FILTERS[resourceId];
  return filter ? `${filter.kind==='sepia'?'sepia':'grayscale'}(${filter.strength})` : 'none';
}
