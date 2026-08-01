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
