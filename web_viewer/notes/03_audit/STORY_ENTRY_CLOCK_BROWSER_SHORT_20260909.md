# Entry-clock browser regression — 2026-09-09

Baseline: `8e24445`, branch `codex/archive-architecture-refactor`. No source edits
during recording. Status: bounded browser regression observed; long soak incomplete.

On port 5175 in the in-app browser, opened Event 430018, then its prologue
`episodes/1_3_30018_01_a.json` (range 2–18). The URL used `runtimeDebug=1` and
did not disable audio. Auto was initially enabled; advancing past the title
allowed dialogue progression. Visible diagnostics reported three Spine instances
and a running AudioContext. The exported report captured voice `a1002.m4a`.

Opened Story Log at step 9. After the diagnostic refresh, the overlay pause
reason was present and AudioContext was suspended. Closed the log; the context
returned to running with empty pause reasons and dialogue advanced to step 11.
Returned to Event Detail, waited at least 30 seconds, then used QUIET ENDPOINT,
STOP and EXPORT. Read and saved the UI's exported textarea without private
runtime inspection.

Original export, outside the repository:
`C:/Users/windm/.codex/evidence/sidem-story-runtime/2026-09-09/8e24445-entry-clock-short.json`

`npm run analyze:story-soak -- <export>` returned `INSUFFICIENT_EVIDENCE` (exit 1):
131,564 ms, 11 samples, 4 interval samples, one completed viewer cycle. All four
are below the existing release gate. Invalid entries, failures and analyzer
warnings were empty; these are not browser console results.

The quiet endpoint had zero live Story viewers, Pixi managers, audio sessions,
AudioContexts, audio sources, playback/effect timers, runtime cues/frames, Spine
instances, stage children, overlays and silhouette relayout jobs. One AudioContext
was created and closed, with zero recorded close failures.

The inspected narrow screenshot was dominated by the diagnostic panel and its
horizontal overflow; it is not product layout acceptance. Character count comes
from visible diagnostics, not a clean screenshot assessment. This run does not
prove that the B26/B27 compatibility slide/tint/fade branches were exercised,
audible quality, a browser console review, or long-term stability. Those targeted
clock branches retain their controlled production-method regression evidence.
