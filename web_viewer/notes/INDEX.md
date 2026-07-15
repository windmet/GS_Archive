# Notes Index

This folder collects working notes and investigation records that were previously scattered at the repository root.

Latest architecture note: `notes/04_refactor/STAGE_CHIBI_SPINE_AND_CHOREOGRAPHY_20260714.md`

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
  - `SPINE_ATOMIC_FADE_FIX_20260715.md`
  - `SPINE_EYE_BLINK_ATTACHMENT_FIX_20260715.md`
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
- `03_audit/MAIN_EXTRA_BIRTHDAY_MASTERDATA_AUDIT_20260715.md` - main, Extra/Home Story, birthday, Valentine/White Day campaign audit, visibility rules, coverage, and normalized index guidance.
- `03_audit/WORK_STORY_MASTERDATA_AUDIT_20260715.md` - work scene lines and short stories, category relations, compiled coverage, and page guidance.
- `03_audit/MAIN_PROLOGUE_EPISODE_BOUNDARY_AUDIT_20260715.md` - raw-vs-compiled audit for `1_4_001_00`, episode range isolation, repeated phone-call diagnosis, and voice-prefix correction.
- `02_debug/SPINE_EYE_BLINK_ATTACHMENT_FIX_20260715.md` - missing-eye root cause, paired `eyeclosed` detection, interrupted-transition recovery, and regression command.
- `04_refactor/MASTERDATA_UI_RECONSTRUCTION_GUIDANCE_20260710.md` - staged plan for masterdata-backed routing, archive UI reconstruction, interaction pages, and data-quality gates.
- `04_refactor/SEKAI_VIEWER_DIRECTION_GUIDANCE_20260713.md` - selected方案 A, Sekai Viewer comparison, licensing boundary, and archive-first implementation order.
- `04_refactor/ARCHIVE_COVERAGE_AND_UNIT_EVIDENCE_20260713.md` - generated manifest counts, coverage results, missing card assets, and the evidence-based idol-to-unit derivation.
- `04_refactor/ARCHIVE_QUERY_AND_UNIT_UI_20260713.md` - cross-domain story model, query routes, card asset-state UI, and unit catalog/detail behavior.
- `04_refactor/CARD_DETAIL_MEDIA_INTERACTION_20260713.md` - card-detail clean/framed mode, full-screen media viewer, card navigation, and the corrected 4:5 portrait preview ratio.
- `04_refactor/CARD_RELATION_EVIDENCE_20260713.md` - source fields, proof rules, validation, and UI behavior for same-release events and common card series.
- `04_refactor/STAGE_CHIBI_SPINE_AND_CHOREOGRAPHY_20260714.md` - LiveCharacter resource composition, attachment bug fixes, 1,403-motion catalog, official lip curves, ACB-to-M4A song extraction, and audio-clock choreography.
- `04_refactor/EPISODE_ARTIFACT_AND_CONTINUOUS_PLAYBACK_20260715.md` - compatibility episode artifacts, local step rebasing, playback queues, and continuous episode transitions.
- `04_refactor/STORY_COLLECTION_INTERFACE_20260715.md` - main/unit collection hierarchy, 744 episode boundaries, stable collection routes, unavailable-record policy, and browser verification.
