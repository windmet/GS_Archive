# Notes Index

This folder collects working notes and investigation records that were previously scattered at the repository root.

Latest story runtime architecture note: `notes/04_refactor/STORY_VIEWER_RUNTIME_REFACTOR_DESIGN_20260718.md`

Latest story/portal localization contract: `notes/04_refactor/STORY_LOCALIZATION_CONTRACT_20260719.md`

Latest archive/story navigation handoff: `notes/04_refactor/ARCHIVE_STORY_NEXT_WINDOW_HANDOFF_20260716.md`

Latest Story Runtime post-merge handoff: `notes/04_refactor/STORY_POST_MERGE_HANDOFF_20260723.md`

Latest RAW + master-data migration log: `notes/05_exploration/RAW_MASTERDATA_MIGRATION_20260726.md`

Full RAW + master-data resource audit: `notes/03_audit/RAW_MASTERDATA_FULL_AUDIT_20260726.md`

The pre-merge release closure guide remains at `notes/04_refactor/STORY_POST_88969A1_RELEASE_GUIDE_20260723.md` for historical evidence.

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
  - `RAW_MASTERDATA_FULL_AUDIT_20260726.md`
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
- `03_audit/IDOL_EPISODE_MOBILE_MASTERDATA_AUDIT_20260716.md` - idol episode hierarchy, personal/unit Mobile entities, unlock-condition reversal, random Talk metadata, local gaps, and page guidance.
- `03_audit/MAIN_PROLOGUE_EPISODE_BOUNDARY_AUDIT_20260715.md` - raw-vs-compiled audit for `1_4_001_00`, episode range isolation, repeated phone-call diagnosis, and voice-prefix correction.
- `03_audit/RAW_MASTERDATA_FULL_AUDIT_20260726.md` - full RAW integrity, master-data authority boundary, story/card/background/audio coverage, browser gates, unresolved domains, and promotion contract.
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
- `04_refactor/IDOL_STORY_AND_MOBILE_INTERFACE_20260716.md` - 49-idol personal-story pages, merged SMALL TALK boundaries, normalized Mobile tabs, after-story phone links, and next-phase story collection direction.
- `04_refactor/PRIMARY_ARCHIVE_NAVIGATION_20260716.md` - content-first Idol/Card/Interaction navigation, default Touma routes, shared idol switching, legacy URL migration, and normalized related counts.
- `04_refactor/ARCHIVE_STORY_NEXT_WINDOW_HANDOFF_20260716.md` - next-window priorities for unified story collections, remaining Extra/Birthday/Card Story domains, player product behavior, local reading state, evidence constraints, and acceptance gates.
- `04_refactor/STORY_VIEWER_RUNTIME_REFACTOR_DESIGN_20260718.md` - complete no-code implementation design for the story runtime refactor, including Scenario IR v2, deterministic clock, performance lifecycle, snapshots, adapters, Auto/Skip/Backlog, resource loading, migration phases, Git boundaries, and acceptance tests.
- `04_refactor/STORY_LOCALIZATION_CONTRACT_20260719.md` - implementation-ready localization contract for deterministic text identity, source hashing, translation overlays, speaker and choice identity, unified text resolution, UI/content language separation, conservative migration, portal entities, Git phases, and acceptance tests.
- `04_refactor/STORY_POST_88969A1_RELEASE_GUIDE_20260723.md` - fact-check of the post-88969a1 assessment, second strict collection status, feature-freeze boundary, CI/release acceptance sequence, and PR merge gates.
- `04_refactor/STORY_POST_MERGE_HANDOFF_20260723.md` - primary next-window entry after PR #1 merge: exact master baseline, completed scope, missing release evidence, IDM/audio boundary, execution order, and reference index.
- `04_refactor/STAGE_CHIBI_NEXT_WINDOW_HANDOFF_20260716.md` - current Chibi stage baseline, supported and approximate effects, missing Particle/Suspensionlight/Penlight work, validation rules, and next-window execution order.
