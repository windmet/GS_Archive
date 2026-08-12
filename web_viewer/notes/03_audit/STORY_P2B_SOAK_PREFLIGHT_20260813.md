# Story P2-B soak preflight — 2026-08-13

Status: **INSTRUMENTATION READY; 2–4 HOUR REAL-AUDIO SOAK NOT EXECUTED**

This note supersedes the v1 recorder controls and 481-sample instructions in
dated 2026-07 handoffs; those files remain historical evidence.

## Contract

With `runtimeDebug=1`, `StoryReleaseSoakPanel.vue` stays mounted at the App
level while StoryViewer routes mount and unmount. The panel owns START, QUIET
ENDPOINT, STOP and EXPORT. Its collector uses `StoryReleaseProbe.js`, so a
post-unmount sample contains zeroed viewer fields plus Story-owned lifecycle
counts instead of silently dropping the sample.

Interval samples remain 30 seconds apart. Capacity is 1,024 samples with a
separate four-hour duration ceiling, so route/lifecycle marker samples do not
consume the former 481-sample budget and end a mixed run early.

New exports use `story-release-soak-v2`. The counters are deliberately scoped
to `releaseOwner: story-player`; Archive Home, Song and Chibi audio must not be
misclassified as Story Runtime leaks.

The timer evidence is bounded to named Story owners:

- PlaybackModeController polling timer;
- legacy step-effect fade-auto timer;
- AudioManager cleanup timers;
- Runtime scheduler animation-frame ownership;
- Pixi silhouette relayout jobs.

It does not claim to intercept every browser timer.

## Machine gate

```powershell
npm run verify:release-soak
npm run analyze:story-soak -- <report.json>
```

The analyzer requires v2 evidence, a stopped report, at least 2 hours / 241
total samples plus 228 interval samples, two completed viewer cycles, and a
quiet-endpoint sample at least 30 seconds after the last viewer-detached sample.
Event markers therefore cannot substitute for periodic coverage. Its hard quiet checks require
Story viewers, Pixi managers, Story audio sessions/contexts/sources, named
timers, Runtime cues/frames, Spine instances, stage children, overlays and
relayout jobs to be zero.

The success verdict is `MACHINE_GATE_PASSED_REVIEW_REQUIRED`, not P2-B PASS.
Heap shape, the final 25% resource curves, visible progression, Choice,
Backlog, Auto/Skip, real Voice/BGM/Ambient/SE and Page Visibility recovery still
require human review.

## Real run

Use normal Edge/Chrome on local port 5174 with real audio and
`runtimeDebug=1`; do not use `noAudio=1`. Exercise Event `1_3_10001_01`, its
repaired short stage, the published 7.5s/6.0s long choreography, Choice,
Backlog, Auto/Skip, episode navigation, visibility changes and repeated
Story → portal → Story cycles.

At the end, return to the portal, wait 30–60 seconds, click QUIET ENDPOINT,
STOP and EXPORT. Archive the report outside the repository with browser/OS,
commit, URL, elapsed time, operation log and console boundary. If a monotonic
resource increase or functional defect appears early, stop and retain the
failed report rather than continuing only to reach two hours.

## Preflight browser proof

The in-app browser exercised two complete Event episode mount/unmount cycles on
`127.0.0.1:5175`, followed by a 46.148-second quiet window. The exported v2
report contained 11 samples; its quiet endpoint reported three Story
AudioContexts created / three closed, with viewers, Pixi managers, Story audio
sessions, live contexts, sources, named timers, Runtime cues/frames, Spine and
stage children all at zero. The analyzer correctly returned
`INSUFFICIENT_EVIDENCE` only for duration, total samples and interval samples.
This is preflight proof, not P2-B acceptance.

Port 5174 was occupied by an unrelated Magazine site during this check, so the
temporary Vite server used 5175. Formal P2-B must first confirm the intended
Story Viewer owns 5174. Console inspection showed no application error; it did
show the existing third-party PixiJS v7.2 `utils.rgb2hex` / `utils.hex2rgb`
deprecation warnings when Spine initialized. Record these as the pre-run known
warning baseline and treat any additional warning/error as new evidence.

External evidence:

- `C:\Users\windm\.codex\evidence\sidem-story-runtime\2026-08-13\story-p2b-preflight-two-cycle-short.json`
- `C:\Users\windm\.codex\evidence\sidem-story-runtime\2026-08-13\story-p2b-preflight-quiet-endpoint.png`
