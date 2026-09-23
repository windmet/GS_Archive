# Refactor real-audio short regression — 2026-09-08

Status: **SHORT REGRESSION OBSERVED; P2-B LONG SOAK NOT COMPLETE**.

Code baseline: `40f04b5a7c2fd86a8e694b1eb45088ff08a2fbd5` on
`codex/archive-architecture-refactor`. No source edits occurred during recording.
Surface: Codex in-app browser, Windows, local Story Viewer on port 5175.
The page used `runtimeDebug=1` without `noAudio=1`. Browser version and the
application console were not collected in this run.

## Operations and observed behavior

1. Start the app-level recorder on Home; navigate through Story Catalog to
   Event 430018, GROWING SELECTION -運命光年-.
2. Play `episodes/1_3_30018_01_a.json`, range 2–18, advance from the title,
   enable Auto. Dialogue advances; the visible debug snapshot reports a running
   AudioContext and a real voice source (`a1002.m4a`). Three Spine actors render.
3. Open Backlog during step 11. The visible snapshot reports the overlay pause
   reason and a suspended AudioContext with the `can_softdrink_open` SE source.
   Restore the earlier 北斗 dialogue at step 6. Auto turns off, the text and
   actors render, and the AudioContext returns to running with no pause reason.
4. Return to Event Detail and start `episodes/1_3_30018_01_b.json`, range 1–34.
   Enable Auto; progression reaches step 12, with a running AudioContext,
   `b1013.m4a` voice source and one Spine actor.
5. Return to Event Detail, then Home. After the quiet window, record QUIET
   ENDPOINT, STOP and EXPORT using the visible controls.

The screenshot inspected during Backlog restoration was 1280×720. It showed
the three actors, dialogue and playback toolbar. The runtime diagnostic overlay
occupied the right side; this is not a clean product-layout acceptance image.

## Export and analysis

Original UI-exported JSON, saved outside the repository:

`C:\Users\windm\.codex\evidence\sidem-story-runtime\2026-09-08\40f04b5-two-cycle-real-audio-short.json`

Recording: 14:12:03.675–14:14:46.476 UTC, 162,801 ms, 19 samples,
5 interval samples, 2 completed viewer cycles.

`npm run analyze:story-soak -- <report>` returned `INSUFFICIENT_EVIDENCE`
(exit 1): only duration, total samples and interval samples were below the
existing two-hour gate. Invalid entries, failures and analyzer warnings were
empty. These analyzer warnings do not represent browser console inspection.

The quiet endpoint recorded zero Story viewers, Pixi managers, Story audio
sessions, live AudioContexts, audio sources, named timers, runtime cues/frames,
Spine instances, stage children, overlays and relayout jobs. Two Story
AudioContexts were created and both closed without a recorded close failure.
Heap samples ranged from 102,428,348 to 134,323,843 bytes; the short curve does
not establish long-term memory stability.

## Remaining acceptance

This run proves bounded interaction and teardown behavior with real audio
resources; it does not establish audible output quality. The protocol's
`1_3_10001_01` sample and long choreography, Choice, Skip, BGM/Ambient playback,
real Page Visibility recovery, console review and two-hour mixed-operation
coverage remain outstanding. The 2026-08-13 protocol's full P2-B gate remains
unchanged. This short run is additional regression evidence after B1–B25,
not a substitute for that release acceptance.
