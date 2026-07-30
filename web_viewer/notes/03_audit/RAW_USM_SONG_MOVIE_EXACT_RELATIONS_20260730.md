# RAW USM Song Movie Exact Relations

Status: pending review

Date: 2026-07-30

## Decision

Promote all 11 `3dmv_*` identities and the single `mvlive_reason` identity to
exact SongData masterdata relations.

IL2CPP protobuf metadata identifies table 46 as SongData, field 4 as
`ResourceId`, field 24 as `MovieOffset`, and field 38 as `MvliveOpenAt`.
The 11 distinct ResourceIds with a concrete MovieOffset exactly equal the full
RAW `3dmv_<ResourceId>` population. The only ResourceId with an enabled
MvliveOpenAt earlier than the table's `4102412400` disabled sentinel is
`reason`, exactly equal to the sole RAW `mvlive_reason` identity.

## Shared resource

The index contains 12 resources and 13 qualifying SongData records.
`pl1gdd` is the only shared resource: song IDs 25 and 99 both carry the same
ResourceId and MovieOffset. The relation preserves both records and source
offsets instead of choosing one.

## Artifacts

```text
public/data/masterdata/song_movie_index.json
schemas/usm-relation-catalog-v4.schema.json
public/data/usm_relation_catalog.json
scripts/verify-song-movie-index.py
scripts/generate-usm-relation-catalog.py
scripts/verify-usm-relation-catalog.mjs
```

The v1-v3 schemas remain immutable historical contracts.

## Result

```text
Song movie index:
11 3dmv + 1 mvlive resources / 13 SongData records / 1 shared resource

RAW USM relation catalog:
260 total / 77 exact consumer / 166 exact masterdata / 17 unresolved
```

Source-only and mounted verification both pass. Mounted verification reparses
SongData table 46 and requires byte-for-byte equality with the committed
index.

## Boundary

This batch does not decode, demux, transcode, copy, publish, or add USM media
to Git. It records an exact masterdata identity, not a browser consumer. The
remaining card-rarity, unmatched BackMonitor-family, and `ssr_motion`
identities stay unresolved.
