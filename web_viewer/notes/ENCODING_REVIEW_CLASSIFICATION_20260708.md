# Encoding Review Classification - 2026-07-08

This file records the first classification pass for files copied under
`_encoding_review/garbled_files_20260708/`.

## Result

Three active source files needed immediate fixes:

| File | Classification | Action |
|---|---|---|
| `src/core/useStoryNavigation.js` | `true-mojibake` in active UI label | Changed the CN language label from mojibake text to `中文`. |
| `src/components/SpineStage.vue` | `true-mojibake` in active debug UI and comments | Repaired debug button titles/text, copy feedback, one swallowed `if` block, and stale mojibake comments discovered during build verification. |
| `src/App.vue` | `true-mojibake` in active home/card UI and debug comments | Repaired visible card-detail labels, back button text, separators, Episode regex text, and console/CSS comments exposed during direct-route validation. |

The remaining copied files are Markdown notes. They should not be bulk-rewritten
yet because many matches may be caused by Japanese game text, copied terminal
output, or historical display encoding artifacts.

## Markdown Classification

| File | Classification | Rationale | Action |
|---|---|---|---|
| `notes/01_lipsync/LIPSYNC_COMPENSATION_BUGFIX.md` | `review-material` | Historical lip-sync note; may include resource names and copied diagnostic text. | Keep for reference. |
| `notes/01_lipsync/LIPSYNC_DEBUG_BUGFIX.md` | `review-material` | Historical lip-sync note; not active runtime source. | Keep for reference. |
| `notes/01_lipsync/LIPSYNC_INTEGRATION.md` | `review-material` | Contains Japanese/resource and technical text; do not rewrite blindly. | Keep for reference. |
| `notes/01_lipsync/LIPSYNC_SUBMODEL_BUGFIX.md` | `review-material` | Submodel debugging note; not active runtime source. | Keep for reference. |
| `notes/02_debug/PITFALLS_AND_DEBUGGING.md` | `review-material` | Important debugging guidance, but matched broad encoding scan. | Read semantically before editing. |
| `notes/02_debug/WEBP_R2_DEPLOYMENT_LESSONS.md` | `review-material` | Deployment note; not active runtime source. | Keep for reference. |
| `notes/03_audit/SPINE_COORDINATE_ANIMATION_AUDIT.md` | `review-material` | Audit note with resource terms and sample IDs. | Keep for reference. |
| `notes/03_audit/SPLIT_AUDIT_REPORT.md` | `review-material` | Historical split audit; some conclusions may be stale. | Keep for reference. |
| `notes/03_audit/TEXT_ASSET_AUDIT.md` | `review-material` | Text asset audit may contain raw Japanese/resource strings. | Keep for reference. |
| `notes/03_audit/TEXT_ASSET_STATE_MACHINE_AUDIT.md` | `review-material` | State-machine audit with raw command/sample evidence. | Keep for reference. |
| `notes/04_refactor/ARCHITECTURE_SPLIT_PLAN.md` | `review-material` | Refactor plan; partly superseded by newer split state. | Keep for reference. |
| `notes/05_exploration/ADV_STATE_MACHINE_NOTES.md` | `review-material` | Detailed ADV state notes; resource text is expected. | Keep for reference. |
| `notes/05_exploration/Y_AXIS_EXPLORATION_LOG.md` | `review-material` | Y-axis exploration note; not active runtime source. | Keep for reference. |
| `notes/06_archived/DEVELOPMENT.md` | `obsolete-note` | Archived overview is mojibake-heavy and superseded by newer status docs. | Do not use as current entry point. |

## Rule Going Forward

- Fix active source mojibake when it affects rendered UI, runtime labels, debug
  output, or comments that are used during active development.
- Do not rewrite Markdown solely because broad scans match CJK-looking fragments.
- Prefer newer status files as current references:
  - `DEVELOPMENT_STATUS_20260708.md`
  - `NEXT_STEP_GUIDANCE_20260708.md`
  - `REGRESSION_LEDGER_20260708.md`
- If a Markdown note is needed as authoritative evidence, inspect it manually and
  recover only the necessary section from a clean source.
