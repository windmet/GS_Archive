// The game's separate shadow SpriteRenderer follows Spine's `shadow` bone.
// Read world coordinates after pose evaluation, rather than the container
// origin or the feet (which would make a lifted foot move the ground plane).
export function characterShadowLayout(spine, profile) {
  const bone = profile && spine.skeleton.findBone(profile.bone)
  if (!bone) return null
  return {
    x: spine.x + bone.worldX * spine.scale.x,
    y: spine.y + bone.worldY * spine.scale.y,
    scaleX: spine.scale.x * profile.pixelsToSpineUnits,
    scaleY: spine.scale.y * profile.pixelsToSpineUnits,
  }
}

export function installCharacterShadowFollower(spine, sync) {
  const update = spine.update
  spine.update = function (...args) {
    const result = update.apply(this, args)
    sync()
    return result
  }
  return () => { spine.update = update }
}
