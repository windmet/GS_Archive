// LiveObjectObjectLayer applies script order to EACH registered renderer.
// Preserve local transforms/mask scopes while allowing orders to interleave
// with actors and other stage objects in the shared camera container.
export function createObjectRendererPlanes(PIXI, runtime, parent) {
  if (runtime.rendererPlanes) return
  const root=runtime.container
  const renderers=runtime.floorEmitters
    ? runtime.floorEmitters.flatMap(emitter=>emitter.sprites)
    : runtime.particles ? runtime.particles.map(p=>p.sprite) : [...root.children]
  const buckets=new Map()
  // Snapshot ancestors before moving any leaf; mask sprites remain in root.
  const paths=renderers.map(sprite=> {
    const path=[]
    for(let node=sprite.parent;node && node!==root;node=node.parent)path.unshift(node)
    return {sprite,path,offset:runtime.entry.keepOriginalOrder ? Number(sprite.zIndex)||0 : 0}
  })
  for(const {sprite,path,offset} of paths) {
    let bucket=buckets.get(offset)
    if(!bucket) {
      const plane=new PIXI.Container()
      plane.sortableChildren=true
      parent.addChild(plane)
      bucket={plane,offset,ancestors:new Map()}
      buckets.set(offset,bucket)
    }
    let target=bucket.plane
    for(const source of path) {
      let clone=bucket.ancestors.get(source)
      if(!clone) {
        clone=new PIXI.Container()
        copyLocal(source,clone)
        clone.sortableChildren=source.sortableChildren
        clone.zIndex=source.zIndex
        // Retain the original mask's world transform and texture ownership.
        clone.mask=source.mask
        target.addChild(clone)
        bucket.ancestors.set(source,clone)
      }
      target=clone
    }
    target.addChild(sprite)
  }
  runtime.rendererPlanes=[...buckets.values()]
  // Keep transform traversal alive for masks; render only the global planes.
  root.renderable=false
  syncObjectRendererPlanes(runtime)
}

function copyLocal(source,target) {
  for(const key of ['position','scale','pivot','skew'])target[key].copyFrom(source[key])
  target.rotation=source.rotation
  target.alpha=source.alpha
  target.visible=source.visible
}

export function syncObjectRendererPlanes(runtime) {
  for(const {plane,offset,ancestors} of runtime.rendererPlanes || []) {
    copyLocal(runtime.container,plane)
    plane.zIndex=runtime.container.zIndex+offset
    for(const [source,clone] of ancestors)copyLocal(source,clone)
  }
}

export function releaseObjectRendererPlanes(runtime) {
  for(const {plane,ancestors} of runtime.rendererPlanes || []) {
    // Drop shared mask references before destroying the original mask owner.
    for(const clone of ancestors.values())clone.mask=null
    plane.removeFromParent()
    plane.destroy({children:true})
  }
  runtime.rendererPlanes=null
}
