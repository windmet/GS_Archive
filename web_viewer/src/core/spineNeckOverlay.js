import { Animation, AttachmentTimeline, ColorTimeline, TwoColorTimeline } from '@pixi-spine/runtime-3.8'

const cache = new WeakMap()
const slotAppearance = timeline => Number.isInteger(timeline.slotIndex)
  && (timeline instanceof AttachmentTimeline || timeline instanceof ColorTimeline || timeline instanceof TwoColorTimeline)

// Exported neck clips contain neutral face attachments/colors. Additive blending
// only applies to transforms: discrete attachments still replace Track 1.
export function neckOverlayAnimation(animation, skeletonData) {
  if (!animation?.timelines?.length || !skeletonData?.animations) return animation
  if (cache.has(animation)) return cache.get(animation)
  const faceSlots = new Set(skeletonData.animations
    .filter(candidate => candidate.name.startsWith('face_'))
    .flatMap(candidate => candidate.timelines.filter(slotAppearance).map(timeline => timeline.slotIndex)))
  const timelines = animation.timelines.filter(timeline => !(slotAppearance(timeline) && faceSlots.has(timeline.slotIndex)))
  const result = timelines.length === animation.timelines.length ? animation : new Animation(animation.name, timelines, animation.duration)
  cache.set(animation, result)
  return result
}
