// IdolFigureSkeleton (client 2.6.10). Order matters: face attachments override
// the additive neck layer; close-mouth/close-eye override the expression.
export const SPINE_TRACK = Object.freeze({ body: 0, neck: 1, face: 2, mouth: 3, eye: 4 })

// Client PlayMotionInternal/PlayNeckInternal clamp to the clip's duration,
// even for loops. Callers select the exact entry specified by each client path.
export function applySpineTrackTime(entry, seconds = 0) {
  if (!entry) return
  const value = Number(seconds)
  entry.trackTime = Math.min(Number(entry.animation?.duration ?? entry.animationEnd ?? 0),
    Number.isFinite(value) ? Math.max(0, value) : 0)
}
