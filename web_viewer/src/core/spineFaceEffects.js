// IdolFigureSkeleton.SetCheekHidden / SetSweatHidden (client 2.6.10) collect the
// slots whose names start with "cheek" / "swet" (string literals of the
// <SetCheekHidden>b__60_0 / <SetSweatHidden>b__61_0 predicates). While hidden,
// UpdateCheek / UpdateSweat clear their attachments after every Apply.
const CHEEK_PREFIX = 'cheek'
const SWEAT_PREFIX = 'swet'

export function faceEffectSlots(skeleton) {
  const slots = skeleton?.slots || []
  const byPrefix = prefix => slots.filter(slot => slot.data.name.startsWith(prefix))
  return { cheek: byPrefix(CHEEK_PREFIX), sweat: byPrefix(SWEAT_PREFIX) }
}

// IdolCommandData parses idol_face [4] / [5] as isSweatOff / isCheekOff (== "off");
// the compiler stores them as sweat_flag / blush_flag.
export function hideFaceEffects(effectSlots, faceFlags) {
  if (!effectSlots || !faceFlags) return
  if (faceFlags.blush_flag === 'off') for (const slot of effectSlots.cheek) slot.setAttachment(null)
  if (faceFlags.sweat_flag === 'off') for (const slot of effectSlots.sweat) slot.setAttachment(null)
}
