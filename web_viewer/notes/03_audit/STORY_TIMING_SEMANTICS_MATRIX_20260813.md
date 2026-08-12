# Story timing semantics regression matrix — 2026-08-13

Status: **SOURCE/COMPILER MATRIX IMPLEMENTED; BROWSER AND P2-B REMAIN SEPARATE**

## Decision

The step-9 repair is generalized into a bidirectional compiler regression
matrix. A delayed Spine cue extends a silent stage only when its target remains
visible in that stage entry. Explicit authored waits still own longer
choreography.

| Case | Source evidence | Expected compiler result | Evidence level |
| --- | --- | --- | --- |
| missing target | Event a step 9 pattern: `048mom@5s`, authored wait `0.5s`, entry contains only `047shu` | duration `0.5s`; cue retained but cannot extend/block the stage | compiler/source verified; displayed repair consumer-verified separately |
| pending fade-out target | committed boundary fixture: visible `047shu`, delayed cue at `5s`, same-stage fade-out, wait `0.5s` | duration `0.5s`; outgoing target cannot keep the stage alive | compiler-verified fixture |
| visible target extension | committed boundary fixture: visible `047shu`, delayed cue at `4.5s`, wait `0.5s` | duration `4.7s` (`cue tail + 0.2s`) | compiler-verified fixture |
| authored long choreography C | Event c RAW commands 15–16: visible `047shu`, `joy@4.5s`, explicit wait `7.5s` | duration remains `7.5s` | mounted RAW plus tracked published strict-v2 artifact |
| authored long choreography F | Event f RAW commands 13–17: visible `048mom`, cues at `1s/3.5s`, explicit wait `6s` | duration remains `6s` | mounted RAW plus tracked published strict-v2 artifact |

The two positive published cases are intentionally stronger than a synthetic
unit-only claim: `episodes/1_3_10001_01_c.json` step 4 and
`episodes/1_3_10001_01_f.json` step 3 are checked for entry target, blocking cue
and exact duration. Fresh compilation of the mounted RAW locates the same
choreography at steps 5 and 4 respectively; the published strict-v2 step IDs
are therefore not reused as RAW-compiler lookup keys. The committed fixtures
independently exercise the compiler rule in source-only CI.

## Gate

```powershell
npm run verify:story-timing-semantics -- --source-only
# With the Event RAW mount available:
npm run verify:story-timing-semantics
```

`verify:story-step9-timing` remains a compatibility alias and runs the expanded
matrix. GitHub Source Gate calls the new canonical command directly.

## Acceptance boundary

This matrix proves compiler output and tracked published-artifact invariants. It
does not prove that the full 7.5s/6.0s performances look correct in a browser,
does not provide the outstanding steps 114/117 directional-wipe evidence, and
does not execute the P2-B 2–4 hour Runtime soak. Those remain explicit consumer
or release-acceptance gates.
