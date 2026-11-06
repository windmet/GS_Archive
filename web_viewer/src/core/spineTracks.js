// IdolFigureSkeleton (client 2.6.10). Order matters: face attachments override
// the additive neck layer; close-mouth/close-eye override the expression.
export const SPINE_TRACK = Object.freeze({ body: 0, neck: 1, face: 2, mouth: 3, eye: 4 })

// Web presentation choice: the client ResetNeck before a body motion is
// SetEmptyAnimation(1, 0), which drops a held neck tilt in one frame while the
// motion's first frames barely move. Fading the tilt out over the client's back
// motion mix lets head and body change together. Explicit neck stops, skips and
// cleanup stay instant.
export const MOTION_NECK_RESET_MIX = 0.3

// Client PlayMotionInternal/PlayNeckInternal clamp to the clip's duration,
// even for loops. Callers select the exact entry specified by each client path.
export function applySpineTrackTime(entry, seconds = 0) {
  if (!entry) return
  const value = Number(seconds)
  entry.trackTime = Math.min(Number(entry.animation?.duration ?? entry.animationEnd ?? 0),
    Number.isFinite(value) ? Math.max(0, value) : 0)
}
