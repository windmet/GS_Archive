/**
 * Legacy authored fields that the normalizer records as unrepresented but that
 * nonetheless require nothing to download.
 *
 * The normalizer emits no cue for these, which is a statement about the cue
 * layer, not about the runtime. Each entry below is consumed directly by
 * SpineStage or ScreenEffectManager against a resource already enumerated
 * elsewhere, so the field is accounted for while adding no requirement.
 *
 * Anything not listed stays an open question on purpose: a field is only
 * asset-free when a real handler explains why. `state.screen_effects` is the
 * case in point — the normalizer marks it only when the screen manager
 * animates none of the ids, which is a genuine gap rather than coverage.
 */
const ASSET_FREE_FIELDS = [
  // SpineStage reads these off the spine state and tweens the spine instance it
  // already loaded — alpha via animateSpineAlpha, tint via setSpineColor.
  { pattern: /^state\.spines\.[^.]+\.fade$/, handledBy: 'SpineStage:spine-alpha' },
  { pattern: /^state\.spines\.[^.]+\.idol_color_transition$/, handledBy: 'SpineStage:spine-tint' },
]

/**
 * @returns {{handledBy: string}|null} null when the field is not accounted for
 * and has to stay unresolved.
 */
export function legacyFieldCoverage(field) {
  const entry = ASSET_FREE_FIELDS.find(candidate => candidate.pattern.test(field))
  return entry ? { handledBy: entry.handledBy } : null
}
