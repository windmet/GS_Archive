# RAW USM MovieAnnounce Exact Relations

Status: implementation verified; pending PR

Date: 2026-07-30
Branch: `codex/usm-movie-announce-exact-relations`
Base: `968c80bb33a03307ead911c93407e8ca3b107366`

## Scope

This batch refines only the 30 `movie_home_announce_*` records already present
in the 260-file RAW USM catalog. It does not decode, demux, transcode, copy,
publish, or add any movie payload to Git.

The previous catalog classified all 30 records as `unresolved` because their
consumer shape was filename-derived. That state was correct until an
independent authority was identified.

## Independent authority

The decoded masterdata protobuf schema identifies top-level field 175 as:

```text
Growing.Models.Data.Masterdata.MovieAnnounces
-> Growing.Models.Data.MovieAnnounceData
```

`MovieAnnounceData` contains:

```text
1 Id
2 Type
3 SortOrder
4 ShortSkipTime
5 Term
6 ResourceId
7 SkipType
```

The mounted decoded protobuf contains 30 table-175 records and 30 unique
`ResourceId` values. The exact RAW identity rule is:

```text
MovieAnnounceData.ResourceId <id>
-> movie/movie_home_announce_<id>.usm
```

The two populations are equal:

```text
30 table-175 ResourceIds
30 movie_home_announce USMs
0 missing
0 extra
0 duplicate ResourceIds
0 duplicate MovieAnnounce IDs
```

This is stronger than a filename candidate: the semantic table independently
names the complete bounded resource population.

## Contract

The masterdata extractor now emits:

```text
public/data/masterdata/movie_announce_index.json
```

Each entry retains the seven semantic fields and its table-175 byte offset.
The narrow `--movie-announce-only` mode regenerates only this index.

USM catalog v2 adds:

```text
schemas/usm-relation-catalog-v2.schema.json

mapping.state = exact-masterdata
mapping.kind = movie-announce
mapping.masterdata_relation.catalog =
  movie_announce_index.movie_announces
```

The relation records `resource_id`, masterdata record ID, and evidence. It
does not claim a browser consumer or derivative asset. Existing BackMonitor
relations remain `exact-consumer`.

The resulting disjoint population is:

```text
260 total
77 exact consumer
30 exact masterdata
153 unresolved
```

The 11 `3dmv_*` records and `mvlive_reason` remain unresolved. Their exact
song-code filename tokens are useful evidence, but no independent consumer or
masterdata asset relation was found in this batch.

## Verification

`verify-movie-announce-index.py` checks in source-only mode:

- schema version and exact 30-record population;
- unique, sorted ResourceIds and unique record IDs;
- table-175 field map and source offsets;
- valid active terms and stable summary.

Mounted mode independently reparses the configured decoded protobuf and
requires byte-for-byte semantic equality with the committed index.

`verify-usm-relation-catalog.mjs` checks:

- strict v2 JSON Schema;
- exact equality between all 30 table-175 identities and catalog relations;
- relation shape and non-overlap with BackMonitor;
- unchanged 260 RAW identities, bytes, hashes, CRID headers, and probe data;
- `77 / 30 / 153` summary consistency.

Local results:

```text
MovieAnnounce index source-only: PASS, 30 / 30
MovieAnnounce index mounted: PASS, 30 / 30
USM catalog source-only: PASS, 260 / 77 / 30 / 153
USM catalog mounted: PASS, 260 / 77 / 30 / 153
Archive baseline source-only: PASS, 10329 JSON / 108 PNG
Archive baseline mounted: PASS, 10329 JSON / 108 PNG
Vite production build: PASS, 2,407 modules / 2m 16s
git diff --check: PASS
```

## Boundary

- No USM payload is tracked or modified.
- No MP4 or other derivative is created.
- `exact-masterdata` proves table-175 identity, not browser playback.
- Remaining filename candidates are not promoted.
- No publication-ledger transaction is created.
- Story Runtime long-soak remains deferred.
