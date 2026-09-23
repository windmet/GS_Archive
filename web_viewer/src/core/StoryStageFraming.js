// Presentation framing, independent of character identity and authored camera cues.
// Calibrated against the supplied game captures: upper-body ADV/home framing.
export const STORY_FRAME_HEIGHT = 720
export const STORY_PORTRAIT_SCALE = 1.25
const PORTRAIT_FOCUS_Y = 80

export function storyStageFrame(width, height) {
  if (!(width > 0) || !(height > 0)) return null
  const scale = height / STORY_FRAME_HEIGHT
  return { width: width / scale, height: STORY_FRAME_HEIGHT, scale }
}

export function storyPortraitBaseY(baseY) {
  return PORTRAIT_FOCUS_Y + (baseY - PORTRAIT_FOCUS_Y) * STORY_PORTRAIT_SCALE
}
