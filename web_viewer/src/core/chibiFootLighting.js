// Native Skeleton-Gradient uses local mesh Y, not whole-Spine multiplication.
// ChangeFootColor's CSV rate -> runtime uniforms is still unresolved. Sample
// the authored rate, but keep height zero until a verified mapping is supplied.
// Never turn that unknown rate into a cutoff or full-strength replacement.
const clamp = x => Math.max(0, Math.min(1, x))
export function footLightingAt(events = [], time = 0) {
  let state = { rgb: [0, 0, 0], height: 0, rate: 0 }, track = null
  const sample = t => {
    if (!track) return state
    const f = track.duration > 0 ? clamp((t-track.time)/track.duration) : 1
    return { rgb: track.from.rgb.map((v,i) => v+(track.to.rgb[i]-v)*f),
      height: 0, rate: track.from.rate+(track.to.rate-track.from.rate)*f }
  }
  for (const event of events) {
    if (event.time > time) break
    if (!/^#[0-9a-f]{6}$/i.test(event.color || '') || !Number.isFinite(Number(event.opacity))) continue
    state = sample(event.time)
    const color = parseInt(event.color.slice(1),16)
    track = { from: state, to: { rgb: [16,8,0].map(s => ((color>>s)&255)/255),
      height: 0, rate: Number(event.opacity) }, time:event.time, duration:Math.max(0,Number(event.duration)||0) }
  }
  return sample(time)
}

// Inverse affine transform evaluated at render time: pose, camera, resize,
// performer translation and export cannot leave a screen-space gradient behind.
export function localHeightRow(m) {
  const determinant=m.a*m.d-m.b*m.c
  return [m.b/determinant,-m.a/determinant,(m.a*m.ty-m.b*m.tx)/determinant]
}
export function shadeFootPixel(rgba, height, state) {
  const alpha=state.height>0 ? 1-clamp(height/state.height) : 0
  return [...rgba.slice(0,3).map((v,i) => v*(1-alpha)+state.rgb[i]*rgba[3]*alpha),rgba[3]]
}
export const FOOT_FRAGMENT = `
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform highp vec4 inputSize;
uniform highp vec4 outputFrame;
uniform highp vec3 localHeight;
uniform vec3 footRgb;
uniform float footHeight;
void main() {
  vec4 tex = texture2D(uSampler,vTextureCoord);
  highp vec2 world = vTextureCoord * inputSize.xy + outputFrame.xy;
  highp float height = dot(vec3(world,1.0),localHeight);
  float amount = footHeight > 0.0 ? 1.0-clamp(height/footHeight,0.0,1.0) : 0.0;
  gl_FragColor = vec4(mix(tex.rgb,footRgb*tex.a,amount),tex.a);
}`
export function syncFootLighting(PIXI, runtime, state, enabled) {
  let filter=runtime.footLightingFilter
  if (!filter && enabled && state.height>0) {
    filter=new PIXI.Filter(undefined,FOOT_FRAGMENT,{
      localHeight:new Float32Array(3),footRgb:new Float32Array(3),footHeight:0 })
    filter.apply=function(manager,input,output,clearMode) {
      this.uniforms.localHeight.set(localHeightRow(runtime.spine.worldTransform))
      manager.applyFilter(this,input,output,clearMode)
    }
    runtime.footLightingFilter=filter
  }
  if (!filter) return
  filter.enabled=enabled && state.height>0
  filter.uniforms.footHeight=state.height
  filter.uniforms.footRgb.set(state.rgb)
  const others=(runtime.spine.filters || []).filter(f => f!==filter)
  runtime.spine.filters=filter.enabled ? [...others,filter] : (others.length ? others : null)
}
export function releaseFootLighting(runtime) {
  const filter=runtime?.footLightingFilter
  if (!filter) return
  runtime.spine.filters=(runtime.spine.filters || []).filter(f=>f!==filter)
  filter.destroy()
  runtime.footLightingFilter=null
}
