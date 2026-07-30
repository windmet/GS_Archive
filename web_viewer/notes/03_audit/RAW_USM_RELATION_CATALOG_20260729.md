# RAW USM Relation Catalog

Status: v1 merged in PR #8; v2 MovieAnnounce refinement merged in PR #22;
v3 CardData skill-movie refinement merged in PR #24; v4 SongData movie
refinement merged in PR #26; v5 gasha client refinement merged in PR #28

Date: 2026-07-29

## Scope

This batch establishes a machine-readable identity and relation catalog for
every `.usm` directly under mounted `RAW/movie`. It does not decrypt, demux,
transcode, copy, publish, or add any media payload to Git.

The committed authority surface is:

```text
schemas/usm-relation-catalog-v5.schema.json
public/data/usm_relation_catalog.json
public/data/client/gasha_movie_contract.json
public/data/masterdata/movie_announce_index.json
public/data/masterdata/card_skill_movie_index.json
public/data/masterdata/song_movie_index.json
scripts/generate-usm-relation-catalog.py
scripts/generate-gasha-movie-client-contract.py
scripts/verify-gasha-movie-client-contract.py
scripts/verify-card-skill-movie-index.py
scripts/verify-usm-relation-catalog.mjs
```

The catalog records relative source identity, bytes, SHA-256, CRID container
magic, header-level media metadata, exact filename-token masterdata relations,
consumer candidates, mapping state, and evidence. It contains no absolute
machine paths.

## Population

| Metric | Value |
| --- | ---: |
| RAW USM files | 260 |
| RAW USM bytes | 2,143,803,200 |
| exact consumer relations | 89 |
| BackMonitor movie relations | 73 |
| BackMonitor transition relations | 4 |
| exact gasha client relations | 12 |
| exact MovieAnnounce masterdata relations | 30 |
| exact CardData skill-movie masterdata relations | 124 |
| exact SongData movie masterdata relations | 12 |
| exact masterdata relations total | 166 |
| unresolved relations | 5 |
| successful ffprobe header reads | 260 |
| entries with an exact music-catalog filename token | 52 |
| distinct exact music tokens | 22 |

Family classification is filename-derived and does not claim semantic
publication:

| Family | Files |
| --- | ---: |
| `skill-movie` | 124 |
| `live-backmonitor` | 82 |
| `movie-home` | 30 |
| `3dmv` | 11 |
| `card-rarity` | 11 |
| `mvlive` | 1 |
| `ssr-motion` | 1 |

## Relation boundary

The 77 exact relations are not inferred from filenames. They are the complete
union of the existing BackMonitor index and the exact `Backmonitor` identities
referenced by 119 mounted RAW choreography scripts:

```text
73 BackMonitor movies + 4 alpha transitions = 77 exact consumers
```

Each exact consumer record retains the referencing RAW effect-script IDs and
the existing browser derivative metadata.

The v2 refinement independently parses masterdata table 175
`MovieAnnounces`. Its 30 unique `ResourceId` values exactly equal the 30
`movie_home_announce_<ResourceId>` RAW identities, so those records are
`exact-masterdata / movie-announce`. They do not claim a browser consumer or
derivative.

The v3 refinement independently parses CardData table 1. Its 124 unique
`ResourceId` values whose `HasSkillCutinResource` field is true exactly equal
the 124 `skill_movie_<ResourceId>` RAW identities. The relation index preserves
127 card records: 121 resources have one card, while three resources are
intentionally shared by a normal card and a tutorial card. All six records
explicitly set `HasSkillCutinResource`; the catalog therefore records the
one-to-many card IDs instead of selecting an arbitrary card.

The v4 refinement independently parses SongData table 46. Eleven distinct
ResourceIds with a concrete `MovieOffset` exactly equal all 11
`3dmv_<ResourceId>` identities. The only song with an enabled
`MvliveOpenAt` earlier than the table's 2100-01-01 disabled sentinel is
`reason`, exactly matching `mvlive_reason`. One 3dmv resource, `pl1gdd`, is
shared by two qualifying SongData records; both song IDs and source offsets are
preserved.

The v5 refinement parses the archived IL2CPP metadata v27 snapshot into a
deterministic client contract. `GashaAnimationMovieManager` exposes distinct
start/SSR movie fields and playback methods, while the literal table exposes
`c0{0}_{1}.usm`, all five rarity keys, and `ssr_motion.usm`. The resulting
11 start movies plus one fixed SSR movie exactly equal the complete mounted
RAW population selected by that contract, so those 12 records are
`exact-consumer / gasha-animation-movie`.

The other five records remain `unresolved`; all are BackMonitor-family physical
variants absent from the 119 archived choreography scripts. A family-shaped
consumer is recorded only as `filename-candidate`. A candidate does not
authorize a derivative or a stable publication.

Music relations are also bounded: a token is recorded only when an underscore
delimited filename token exactly equals a key in
`public/data/masterdata/music_catalog.json`. No fuzzy title match is used.

Direct ffprobe reads identify all 260 sources as USM and expose at least one
stream header. Duration remains `null` when the encrypted container does not
provide a reliable value; missing duration is never rewritten as zero.

## Verification

Source-only verification checks:

- strict JSON Schema 2020-12;
- deterministic sorted, unique IDs and relative paths;
- summary totals, byte totals, family totals, and mapping totals;
- exact-consumer shape, script evidence, derivative roles, and identity-bound
  relative paths for 73 movies and 4 transitions;
- music-token existence and filename boundary;
- absence of absolute paths;
- exact equality with the 30-record committed MovieAnnounce table-175 index;
- exact equality with the 124-resource / 127-record committed CardData
  skill-movie index;
- exact equality with the 11-3dmv + 1-mvlive / 13-record committed SongData
  movie index;
- exact equality with the 11-start + 1-SSR committed gasha client contract;
- the current `260 / 89 / 166 / 5` population boundary.

Mounted verification additionally checks:

- exact equality with the mounted 73-movie + 4-transition BackMonitor index;
- exact equality of recorded derivative metadata with that index;
- exact equality with the live `RAW/movie/*.usm` filename population;
- exact reparse parity with mounted masterdata table 175;
- exact reparse parity with mounted CardData table 1, including field 31
  `HasSkillCutinResource`;
- exact reparse parity with mounted SongData table 46, including `MovieOffset`
  and enabled `MvliveOpenAt`;
- exact regeneration parity with the mounted IL2CPP metadata v27 gasha client
  contract;
- file byte count;
- `CRID` magic;
- SHA-256 for all 260 files.

Validated locally on 2026-07-30:

```text
RAW USM relation catalog verified (source-only):
260 total / 89 exact consumer / 166 exact masterdata / 5 unresolved

RAW USM relation catalog verified (mounted):
260 total / 89 exact consumer / 166 exact masterdata / 5 unresolved

Archive baseline verified (source-only):
10329 compiled JSON artifacts, 108 tracked PNG files

Archive baseline verified (mounted):
10329 compiled JSON artifacts, 108 tracked PNG files
```

The source-only GitHub gate now runs the catalog verifier. The archive baseline
report reads the committed catalog for USM population and BackMonitor relation
counts, so those figures remain reproducible without mounting ignored RAW.

## Next boundary

This phase is complete when the branch passes review and merges. Follow-up
semantic work should select a bounded unresolved family and improve relations
without rewriting source identity. It must remain separate from:

- bulk USM decode or MP4 conversion;
- media publication;
- Story Runtime long-soak acceptance;
- publication-ledger transactions;
- the 1,271 `image_*` relation catalog.
