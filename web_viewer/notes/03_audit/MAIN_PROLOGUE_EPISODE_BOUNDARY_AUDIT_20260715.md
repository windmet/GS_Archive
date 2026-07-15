# Main Prologue Episode Boundary Audit

Last checked: 2026-07-15

## Reported URLs

- `1_4_001_00.json&start_step=2`
- `1_4_001_00.json&start_step=28`

The visible symptom was that Ken Yamamura's phone call appeared to repeat and the surrounding story seemed out of order.

## Raw Evidence

Authoritative raw files:

- `E:/BaiduNetdiskDownload/SideM/scripts/scenariodata/1_4_001_00/scenario_1_4_001_00_a.json`
- `E:/BaiduNetdiskDownload/SideM/scripts/scenariodata/1_4_001_00/scenario_1_4_001_00_b.json`

Part `a` contains 118 commands, 12 normal text commands and no phone block. Part `b` contains 102 commands, one `phone_start`, four `phone_text` commands and one `phone_end`. The four Ken lines occur exactly once and in the same order as the compiled scenario.

Part `b` contains two `phone_ringtone` SE commands. This is authored behavior: the ringtone begins while the producer is recalling the dream, the scene returns from the gray flashback, and the ringtone is emitted again before the phone is answered. It is not a duplicated phone dialogue block.

## Root Cause

The compiled scenario correctly records two episode boundaries:

| Part | Compiled indices | One-based route range | Steps |
| --- | --- | --- | ---: |
| `a` | 0-26 | 1-27; playable start 2 | 27 |
| `b` | 27-59 | 28-60 | 33 |

The archive episode buttons previously wrote only `start_step`. Player navigation still used the end of the merged 60-step file as its last step. Starting part `a` therefore continued into part `b`, including the phone call. Opening part `b` separately played the same authored call again. The repetition was a playback-range bug, not duplicated raw text or a merge-order bug.

## Fix

- Episode records now expose both `startStep` and `endStep`.
- Archive routes persist optional `end_step`.
- Story navigation clamps Next, Previous, automatic transitions, choices and progress counters to the active range.
- Old URLs that only contain `start_step` infer the containing episode's end from compiled `episodes`, so the two reported URLs are fixed without migration.
- Whole-story playback without `start_step` still uses the full compiled file.

Expected results:

- `start_step=2` ends at `EP01 26/26` and never reaches a call step.
- `start_step=28` ends at `EP02 33/33`; the four Ken lines appear once each.

## Voice Cue Defect

The raw phone prefix is `1_4_001_00_b` and its suffixes are `b1007` through `b1010`. The compiler previously inserted another underscore and part letter, producing invalid names such as `1_4_001_00_b_b1007.m4a`.

The same pattern affected 526 cues across 30 compiled files. Every malformed cue had a corresponding canonical file in `voice_index`. The compiler now detects a suffix whose leading episode letter is already present at the end of the prefix and emits `..._b1007.m4a`. Voice relinking resolved all 26,912 dialogue references in the local compiled set.

## Verification

```powershell
npm run verify:story-playback-range
npm run verify:story-collections
npm run verify:event-story
npm run verify:routes
npm run verify:voice-cues
npm run build
```

Browser QA traversed both reported URLs to their disabled Next button. Part `a` remained inside EP01 with no Call UI; part `b` presented four unique phone lines in raw order and remained inside EP02.
