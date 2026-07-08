# Notes Index

This folder collects working notes and investigation records that were previously scattered at the repository root.

## Layout

- `notes/00_inbox/` - temporary holding area for items that are not yet classified
- `notes/01_lipsync/` - mouth, lip, lipsync, and face-mesh related investigations
- `notes/02_debug/` - general debugging notes and pitfall logs
- `notes/03_audit/` - audit and review reports
- `notes/04_refactor/` - architecture split and refactoring plans
- `notes/05_exploration/` - exploratory notes and step logs
- `notes/06_archived/` - older or broadly general notes kept for reference

## Current Mapping

- `01_lipsync/`
  - `037JIR_FACE_MESH_BUGFIX.md`
  - `LIPSYNC_COMPENSATION_BUGFIX.md`
  - `LIPSYNC_DEBUG_BUGFIX.md`
  - `LIPSYNC_INTEGRATION.md`
  - `LIPSYNC_SUBMODEL_BUGFIX.md`
- `02_debug/`
  - `PITFALLS_AND_DEBUGGING.md`
  - `WEBP_R2_DEPLOYMENT_LESSONS.md`
- `03_audit/`
  - `1_4_001_01_ICON_SILHOUETTE_BG_AUDIT_20260708.md`
  - `SPINE_COORDINATE_ANIMATION_AUDIT.md`
  - `SPLIT_AUDIT_REPORT.md`
  - `TEXT_ASSET_AUDIT.md`
  - `TEXT_ASSET_STATE_MACHINE_AUDIT.md`
- `04_refactor/`
  - `ARCHITECTURE_SPLIT_PLAN.md`
  - `REFACTORING.md`
- `05_exploration/`
  - `ADV_STATE_MACHINE_NOTES.md`
  - `MASTERDATA_ARCHIVE_ROADMAP.md`
  - `nextstep.md`
  - `Y_AXIS_EXPLORATION_LOG.md`
- `06_archived/`
  - `DEVELOPMENT.md`

## Rule Of Thumb

If a new note is lip or mouth related, put it in `01_lipsync/` first. If it is unclear, keep it in `00_inbox/` until we decide where it belongs.

## Current Status Notes

- `DEVELOPMENT_STATUS_20260708.md` - current architecture/status snapshot, including the cameraflare archive decision, neck animation hold, and encoding review folder.
- `NEXT_STEP_GUIDANCE_20260708.md` - recommended next-phase direction: regression ledger, encoding classification, state cleanup, and deferred areas.
- `REGRESSION_LEDGER_20260708.md` - anchor scenario ledger for the stabilization pass.
- `ENCODING_REVIEW_CLASSIFICATION_20260708.md` - classification of encoding-review files and the one active UI label fixed.
- `SPINE_STAGE_SYNC_EXTRACTION_PLAN_20260708.md` - safe first-cut boundary for reducing `SpineStage.vue`.
- `03_audit/1_4_001_01_ICON_SILHOUETTE_BG_AUDIT_20260708.md` - root cause notes for the persistent `102sha` icon, missing president silhouette asset path, and displayed `19 -> 20` background-shift check.
