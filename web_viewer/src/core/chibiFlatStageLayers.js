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

export function backmonitorDepths(state, nativeLayers) {
  const base = nativeLayers ? Number(state.sortingOrder) || 1000 : -30000
  return { movie:base, back:base-5, logo:base+1, noise:base+5, glow:base+110 }
}
