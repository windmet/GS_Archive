# GS Archive Song Domain P1 Closeout — 2026-08-01

## Scope

This batch closes the metadata-only Song-B archive. It does not publish a new
audio player, solo mixer, MV player, or live-stage runtime.

## Product model

- masterdata table 46 remains the authority for 61 song entities;
- the catalog presents 60 song works because `drv999` is an April Fools
  performance variant of `drvalv`, not an unrelated work;
- `drvalv`, `byndtd`, and `grwsml` retain their 16 unit cues, 49 idol-vocal
  files, backing layer, choreography, lipsync, and live-effect relations;
- oneshot phrase voices remain distinct from full idol-vocal files;
- table-46 `2000-01-01 JST` is rendered as “initial inclusion”, while the
  `2100-01-01 JST` hidden sentinel is rendered as “special version”.

The curated `drv999 -> Extra 602` relation is stored outside masterdata in
`public/data/song_related_entity_index.json` with its external evidence URL.
It must not be generalized into Story/Event relations by title matching.

## Table 46 performer-mapping correction

The earlier statement that table 46 had no performer mapping was incorrect.
The old `music_catalog` projection omitted fields 7 and 30–34:

- all 61 unique song codes have field 7; category 2 covers 47 unit songs and
  resolves exactly to the 16 table-24 units;
- category 3 covers 14 all-roster or special songs. Its numeric field-7 value
  is retained as an unresolved selector and must not be presented as unit
  ownership;
- fields 30–34 are populated on 20 of the 99 table rows, but duplicate live
  rows reduce this to 13 unique songs. Both counts are retained explicitly;
- category-2 songs without explicit fields 30–34 obtain their display roster
  from the already confirmed unit-membership index and carry
  `performer_basis=confirmed_unit_roster`, rather than pretending the idol
  list came directly from table 46;
- category-3 songs only gain Idol links when fields 30–34 explicitly identify
  performers.

The song detail page now separates this semantic performer mapping from the
RAW ACB layer mapping. Unit and Idol pages expose the reverse song relations,
and entity-to-song navigation preserves an explicit `parent` return path.
`verify:song-masterdata-mappings:mounted` rechecks the committed projection
against the decoded table 46 and the confirmed unit roster.

## Navigation

- `song_scope` and `q` are route-backed and survive detail navigation, refresh,
  breadcrumb navigation, the existing return button, and browser Back;
- unit performance cues link to canonical Unit pages;
- idol vocal/oneshot identities link to canonical Idol pages;
- the April Fools variant links to the Extra 602 collection with
  `parent=song_detail`, preserving the explicit return path;
- Chibi Stage, MV playback, and audio playback links remain deferred until the
  player contract is agreed.

## Binary publication

The 61 exact RAW covers are published as 365x360 navigation derivatives. The
index retains each RAW bundle hash, Texture2D name, PathID, and original
730x720 dimensions. The published batch is about 14.8 MB and is governed by
owner release `2026-08-01-song-jackets-001` with a reviewed 10–25 MiB exception.

## Deferred Song-C discussion

Status: **NOT EXECUTED**.

Before implementing solo playback, decide and verify:

1. whether an idol-vocal ACB is sample-aligned with the backing ACB;
2. whether the game mixes those files simultaneously or applies gain/offset;
3. whether full mix, unit cue, idol vocal, and backing are separate player
   modes or one work-level performance selector;
4. publication, browser format, caching, cleanup, autoplay, and resume rules;
5. whether Chibi Stage consumes the same route-backed performance selection.

No solo or layered-player claim is release evidence until those checks pass.
