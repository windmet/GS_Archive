// Presentation framing, independent of character identity and authored camera cues: the stage renders at a
// logical 720 px height; figure placement itself follows the native ADV geometry (AdvStageLayout.js).
export const STORY_FRAME_HEIGHT = 720

export function storyStageFrame(width, height) {
  if (!(width > 0) || !(height > 0)) return null
  const scale = height / STORY_FRAME_HEIGHT
  return { width: width / scale, height: STORY_FRAME_HEIGHT, scale }
}
