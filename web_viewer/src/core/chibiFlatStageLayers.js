// A visibility owner, not a rendering parent: Unity renderer sorting is global.
export function createFlatStageLayers(parent) {
  const children = new Set()
  let visible = true
  return {
    get children() { return [...children] },
    get visible() { return visible },
    set visible(value) { visible = Boolean(value); for (const child of children) child.renderable = visible },
    addChild(child) {
      parent.addChild(child)
      children.add(child)
      child.renderable = visible
      child.once('removed', () => children.delete(child))
      return child
    },
  }
}

// Flattened legacy composite art needs the movie behind the whole bitmap.
// Dynamic-only scenes have native Image_layer orders and use the native plane.
export function backmonitorDepths(state, nativeLayers=true) {
  const base = nativeLayers ? Number(state.sortingOrder) || 1000 : -30000
  return { movie:base, transition:base+2, back:base-5, logo:base+1, noise:base+5, glow:base+110 }
}
