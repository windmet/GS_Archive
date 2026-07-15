# Spine Eye Blink Attachment Fix

Date: 2026-07-15

## Symptom

Rapid story-step changes could leave an idol without eyes. The intended closed-eye transition also rendered as an empty eye area instead of a closed-eye frame.

## Root Cause

The blink detector only recognized slot names containing `_close`. Communication models use names such as:

- `eyeclosed_R` / `eyeclosed_L`
- `eyeclosed_shadow_R` / `eyeclosed_shadow_L`

For `001tom_002_00`, the old configuration therefore contained 16 open-eye slots in `hide` and no attachments in `show`. During an `anim_flag=目` face transition, the renderer cleared the open eyes but had no closed-eye attachment to display.

## Fix

`src/core/spineBlinkSlots.js` now:

1. recognizes `eyeclosed`, `eye_close` and `eyelid_close` naming families;
2. resolves attachments through the default skin attachment list;
3. requires both left and right closed-eye attachments before enabling the manual blink cover;
4. returns `null` for incomplete models so open eyes are never cleared without a complete replacement.

`cancelBlinkCover()` remains responsible for restoring captured open-eye attachments when rapid navigation interrupts a transition.

## Runtime Evidence

Winter Touma `001tom_002_00` resolves four closed-eye attachments: both eye lines and both shadows. During an extended diagnostic blink, all four were attached while the open eye white, pupil and clip slots were null. After restoring the production 150 ms duration and rapidly advancing three expression steps, both sides returned to their normal open-eye attachments with no closed-eye residue.

Run:

```powershell
npm run verify:spine-blink
```

The verification covers interrupted restoration, paired `eyeclosed` detection and the incomplete-pair safety fallback.
