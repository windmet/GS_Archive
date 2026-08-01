# GS Archive Song Domain P1 Closeout — 2026-08-01

## Scope

This batch closes the metadata-first Song-B archive and adds a bounded,
song-detail-only audio experiment. It does not promote a general audio player,
solo mixer contract, MV player, or live-stage runtime.

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

## Field-7 performer semantics normalization — 2026-08-02

The former `unit_mapping` / `raw_unit_id` names were semantically wrong for
category 3. Field 7 is now projected as a discriminated `performance_selector`:
category 2 is `kind=unit` and may expose its exact table-24 `unit_id`; category
3 is `kind=collective_or_special`, keeps only `selector_id`, and always exposes
`unit_id=null`. The derived song catalog mirrors the raw pair as
`raw_category` / `raw_selector_id` and adds a separate `performer_scope`.

The 14 category-3 songs are not uniformly all-idol recordings. The scope is
derived without guessing:

- `configurable_formation`: no fixed fields 30–34 and table 46 enables
  `HasSwitchSinger` (DRVALV, BYNDTD, GRWSML, TKSTP1, TKSTP2);
- `fixed_special_lineup`: fields 30–34 explicitly name a cross-unit cast
  (including TRUE HORIZON, ANYWHERE, FLASH LIGHT, and precious love);
- `unspecified_special`: neither an explicit cast nor SwitchSinger evidence is
  present (including the president April Fools variant and Reason!!).

Category-2 songs remain `fixed_unit`. The UI therefore calls the section
`演唱类别与演唱者`: it shows the confirmed unit when one exists, otherwise a
scope card explaining configurable formation, fixed special lineup, or an
unspecified special category. The raw selector stays visible only as audit
evidence and is explicitly not interpreted as a unit id.

## Song-C experimental player (bounded, not release evidence)

The first experiment uses `drvalv` with all 49 per-idol vocal ACBs (the default
selection remains `001tom`, 天ヶ瀬 冬馬) and one shared
`song3_drvalv_bgm.acb` backing candidate. Existing local Chibi music candidates
provide the single-track original, unit, and `drv999` special-version choices.
The song detail page now offers two explicit modes:

- single-track: original, backing, special, or unit candidate;
- Solo＋伴奏（实验）: one idol vocal element and one backing element, with shared
  transport, seek, reset, and independent gains.

vgmstream metadata for the sample is 44.1 kHz. The vocal and backing each expose
5,745,602 samples; the full-mix/unit cue exposes 5,745,601 samples, so the
metadata delta is at most one sample. The browser check confirmed both M4A
elements reached `readyState=4` and played together with about 0.01 seconds of
observed runtime drift. This proves the experiment is technically playable, not
that the mix has been perceptually calibrated or release-accepted.

The tracked contract is `public/data/song_experimental_audio.json`; local media
is generated by `scripts/prepare-song-experimental-audio.py --all-idols` and
remains under the existing ignored binary-asset boundary. Use
`verify:song-experimental-audio` for the source contract and the `:mounted`
variant only when the local candidates are present at 5174.

### Unity/masterdata mixer reverse-audit boundary

The decoded `SongData` schema confirms that table 46 carries song availability
and performance-selection facts, not a browser mixer preset. In particular,
fields 35/37/42/43 are `HasOriginalMember`, `HasSoloSinging`,
`SoloSingingOpenAt`, and `OriginalSongId`; the decoded rows for `drvalv`,
`byndtd`, and `grwsml` have `HasSoloSinging=1`, which agrees with their
per-idol ACB files and `*_bgm` backing file. The same rows have no gain,
pan, fade, or per-track offset fields.

The `song_drvalv.unity3d` bundle and the exported Chibi choreography expose
stage, lip-sync, and `singerEvents` timing (which idol(s) sing at each point),
but no audio-mixer parameters. A first CRI/vgmstream metadata pass found all
49 vocal files as mono `CRI HCA`, `44100 Hz`, `5,745,602` samples, with
`mixingInfo` `1 -> 1` and no loop metadata; the backing is stereo `2 -> 2`,
`5,745,602` samples, also with no loop metadata. This confirms channel/layout
facts, not the runtime gain/pan policy. The next audit target is therefore
client runtime/CRI player calls: look for gain, pan, start offset, fade, loop,
or ducking instructions before treating two-track playback as an official mix.
Until that evidence is found, the current player intentionally exposes only
independent vocal/backing gains and labels the result experimental.

## Deferred Song-C discussion

Status: **NOT EXECUTED**.

Before promoting beyond this experiment, decide and verify:

1. whether an idol-vocal ACB is sample-aligned with the backing ACB;
2. whether the game mixes those files simultaneously or applies gain/offset;
3. whether full mix, unit cue, idol vocal, and backing are separate player
   modes or one work-level performance selector;
4. publication, browser format, caching, cleanup, autoplay, and resume rules;
5. whether Chibi Stage consumes the same route-backed performance selection.

No solo or layered-player claim is release evidence until those checks pass.
