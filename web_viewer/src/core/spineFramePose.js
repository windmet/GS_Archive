// Client SkeletonGraphic.Update(float) (2.6.10, RVA 0x13a36e8) resets the whole
// skeleton with Skeleton.SetToSetupPose before AnimationState.Apply on every
// frame. Pixi Spine keeps the previous pose instead, so keys from a replaced body
// clip and offsets from the additive neck track would otherwise persist.
// afterApply runs where the client's UpdateLocal delegate runs: after Apply,
// before UpdateWorldTransform.
export function installNativeFramePose(spine, afterApply = null) {
  const apply = spine.state.apply.bind(spine.state)
  spine.state.apply = (skeleton) => {
    skeleton.setToSetupPose()
    const applied = apply(skeleton)
    afterApply?.(skeleton)
    return applied
  }
}
