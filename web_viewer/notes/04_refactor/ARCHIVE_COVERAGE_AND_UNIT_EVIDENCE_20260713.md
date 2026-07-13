# Archive Coverage And Unit Evidence - 2026-07-13

## Purpose

This note records how `public/data/archive_manifest.json` is generated and which relationships are authoritative versus derived. Regenerate it with:

```powershell
npm run manifest
```

## Current Inventory

| Resource | Count |
| --- | ---: |
| Indexed scenarios | 2,576 |
| Physical compiled JSON files | 8,443 |
| Idols | 49 |
| Cards | 836 |
| Home voice cues | 2,564 |
| Background files | 400 |
| Spine model directories | 728 |
| Voice files | 32,421 |

The physical compiled JSON count is intentionally larger than the archive navigation count. It includes generated and supporting JSON files that are not independent story entries.

## Coverage Results

| Domain | Available | Total | Coverage |
| --- | ---: | ---: | ---: |
| Story master records | 2,838 | 2,838 | 100% |
| Card home voice relations | 2,564 | 2,564 | 100% |
| Card scenario relations | 313 | 313 | 100% |
| Normal card icons | 545 | 836 | 65.2% |
| Awakened card icons | 836 | 836 | 100% |
| Idol-to-unit evidence | 49 | 49 | 100% |

`story_master_records` counts masterdata rows. Multiple episode rows may point to one compiled scenario; the current 2,838 rows resolve to 1,394 unique compiled files.

## Unit Membership Evidence

`idol_unit_dictionary.json` has authoritative unit records, but every idol currently has null `unit_id`, `unit_code`, and `unit_name`. The field named `unit_relation_candidate_f32` is not a unit relation: it increments from 1 to 49 with idol order and must not be used as a unit ID.

Membership is derived from `story_master_index.json`:

1. Join unit-story groups to chapters and episodes.
2. Deduplicate episode rows by unit group and compiled file.
3. Count each `001tom`-style idol code in `compiled_summary.characters` for every unit.
4. Assign the unit with the highest appearance count.
5. Record the winning count, competing count, and method in `unit_membership_by_idol`.

Current evidence resolves all 49 idols with no top-score ties. The UI uses this mapping for filtering and labels, but the source dictionary remains unchanged. If future data creates a tie, the manifest records the idol in `coverage.unit_membership.ambiguous` and the relation must be reviewed before being presented as settled.

## UI Boundary

- `/` shows inventory totals and the source-data update date.
- `?view=archive_status` shows coverage, asset counts, and the first missing normal-card IDs.
- `?view=idols&category=idol&unit_filter=<unit_id>` provides a refresh-safe unit filter.
- Idol detail displays the derived unit name while preserving the evidence in the manifest.
- The resources navigation opens data status first; Spine lab remains a separate full-screen tool.

## Remaining Risks

- Normal card icons are incomplete. The UI continues to prefer awakened icons and falls back to normal icons only when necessary.
- File existence proves local availability, not visual correctness.
- Voice count proves files are present, not that every cue-to-file path is playable in the browser.
- Unit membership is high-confidence derived evidence, not a recovered masterdata foreign key.
