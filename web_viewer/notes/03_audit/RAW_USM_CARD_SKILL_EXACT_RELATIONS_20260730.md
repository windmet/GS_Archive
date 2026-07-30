# RAW USM Card Skill Exact Relations

Status: merged in PR #24

Date: 2026-07-30

## Decision

All 124 `RAW/movie/skill_movie_*.usm` identities are promoted from
`filename-candidate` to `exact-masterdata / card-skill-movie`.

This promotion is not based on the filename family alone. IL2CPP protobuf
metadata identifies CardData table 1 field 14 as `ResourceId` and field 31 as
`HasSkillCutinResource`. The complete set of 124 distinct ResourceIds whose
field 31 is true exactly equals the complete set of 124 RAW identities after
adding the `skill_movie_` namespace prefix.

## Shared resources

There are 127 qualifying card records because three resource identities are
shared:

| ResourceId | Card IDs |
| --- | --- |
| `001tom_ssr01` | `1401001`, `9401001` |
| `004ter_ssr01` | `1404001`, `9404001` |
| `047shu_ssr01` | `1447001`, `9447001` |

For each pair, both the normal card and tutorial card explicitly set
`HasSkillCutinResource = true`. The relation is therefore one physical movie
resource to multiple CardData records. The authoritative index preserves both
card IDs and both source offsets; it does not discard or guess between them.

## Artifacts

```text
public/data/masterdata/card_skill_movie_index.json
schemas/usm-relation-catalog-v3.schema.json
public/data/usm_relation_catalog.json
scripts/verify-card-skill-movie-index.py
scripts/generate-usm-relation-catalog.py
scripts/verify-usm-relation-catalog.mjs
```

The original v1 and v2 schemas remain immutable historical contracts.

## Result

```text
Card skill-movie index:
124 resources / 127 card records / 3 shared resources

RAW USM relation catalog:
260 total / 77 exact consumer / 154 exact masterdata / 29 unresolved
```

Both source-only and mounted verification pass. Mounted verification reparses
CardData table 1 and requires byte-for-byte equality with the committed index.
PR #24 final-head source gate `30511853325` and post-merge source gate
`30511892344` both passed. The merge commit is `66a0e1d`.

## Boundary

This batch reads source identities and masterdata only. It does not decode,
demux, transcode, copy, publish, or add any USM media to Git. It does not claim
a browser consumer for skill movies. The remaining 29 records stay unresolved
until an independent authority proves their semantics.
