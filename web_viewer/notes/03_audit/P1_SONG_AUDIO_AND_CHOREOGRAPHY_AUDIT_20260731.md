# P1-Song-A: RAW Song Audio and Choreography Audit

Date: 2026-07-31
Phase: P1-Song-A exact-relation audit
Branch: `codex/song-domain-audit-p1`

## 1. Purpose and boundary

This batch establishes the exact, machine-verifiable relation between the 61
`music_catalog` songs and their RAW audio and choreography payloads. It
implements the identity/version/audio-layer/choreography/lipsync/MV layer of
the P1-Song model:

```text
歌曲作品
  -> 演唱 / 演出版本
    -> 完整混音 / 伴奏层 / 偶像声部层
    -> 编舞 / 口型 / MV
```

No media is decoded, copied, or published. This batch only reads RAW
containers (ACB cue names via vgmstream; UnityFS objects via UnityPy) and
commits a read-only relation catalog plus this audit.

## 2. Masterdata identity

`music_catalog.json` (table 46) defines 61 song codes. `song_movie_index.json`
adds 11 exact 3dmv relations and 1 mvlive relation (see section 6).

## 3. RAW audio population

`RAW/audio/song3_*.acb`: 313 files.

File-level classification:

| kind | count | pattern |
| --- | ---: | --- |
| base | 63 | `song3_<code>.acb` |
| idol vocal | 245 | `song3_<code>_<idol-code>.acb` |
| backing | 5 | `song3_<code>_bgm.acb` |

Every one of the 61 catalog codes has a base file. The extra base files
`00test` and `02test` are test entities not present in the music catalog and
are recorded as `extra_entities` with kind `test`.

## 4. ACB internal cue structure

vgmstream `-m` scans classify the ACB files into three shapes:

### 4a. Layered songs (3): `byndtd`, `drvalv`, `grwsml`

Each has 51 files: 1 base + 49 idol vocal + 1 backing. The base ACB exposes
17 cues:

- 16 unit performance cues: `song3_<code>_<unit-code>` (e.g.
  `song3_byndtd_001jup` … `song3_byndtd_016cfi`), mapping 1:1 to the 16
  unit codes in `idol_unit_dictionary.json` (unit codes use a zero-padded
  three-digit prefix, e.g. `05w00` for W);
- 1 full-mix cue with `_preview` and `_soundcheck` aliases (e.g.
  `song3_byndtd; song3_byndtd_preview; song3_byndtd_soundcheck`).

Duration evidence: base full-mix, backing, and idol-vocal files share the
same sample length per song (e.g. `byndtd` 113,333 s; `drvalv` 130,285 s;
`grwsml` 126,294 s with a 127,058 s idol variant). The layered mix, backing,
and per-idol vocal layers are therefore the same performance, layered at
runtime. The per-idol vocal files (`song3_<code>_<idol-code>.acb`) are not
the unit cue; they carry the individual idol vocal track used by the game's
mix.

`tkstp1` and `tkstp2` each have 51 files (1 base + 49 idol + 1 backing) but
their base ACB exposes a single full-mix cue; they are single-cue songs with
idol-vocal and backing files, not unit-cue-layered. “Single-cue” here describes
only the base ACB cue shape; it does not mean that the live vocal selection is
one fixed solo track.

### 4c2. Take a StuMp! five-slot vocal selection

The five-person grouping observed in the recording is supported by three
independent local sources:

1. table 46 rows for `tkstp1` and `tkstp2` carry `OnStageCount=5` and
   `HasSwitchSinger=1`; their field-37 `HasSoloSinging` is not enabled and
   field-42 remains the disabled sentinel. This separates the five-slot live
   vocal selector from the table-46 “solo singing” feature flag.
2. Each song has 49 per-idol ACBs (`song3_<code>_<idol-code>.acb`) plus one
   backing ACB. The per-idol files are one-cue, mono `vocal_*` assets; the
   backing is one-cue stereo `song_*` audio. There are no `<code>_<unit-code>`
   base cues, so this is not the 16-unit-cue format used by `byndtd`, `drvalv`,
   and `grwsml`.
3. The Unity bundles contain one `<code>_live_effect` CSV. It has 47
   (`tkstp1`) / 48 (`tkstp2`) `SwitchSinger` events, and every event carries
   five binary state columns (`value1`–`value5`). The generated Chibi relation
   consequently resolves five performer slots and a stable stage-position map
   (performer slots `1..5` -> stage positions `3,2,4,1,5`).

The correct model is therefore: choose/assign five idols to the live
performance slots, then use the `SwitchSinger` timeline to select which slot
or slots sing at each moment. The 49 ACB files are the selectable idol voice
pool, not 49 simultaneously active channels; the base full-mix cue remains a
separate playback option. The supplied recording’s “编组五人各自有 solo”
observation is consistent with this slot-based model and with the IPA runtime
symbols `SwitchSingerUtil`, `InitParallelSongs`, `SetMuteSong`, and
`SetPan3dAngleSong`.

### 4a2. Unit-cue / choreography-effect consistency

The three layered songs (`byndtd`, `drvalv`, `grwsml`) are exactly the three
songs whose choreography bundles carry per-unit `live_effect` TextAsset
variants (`<code>_live_effect_<unit-code>`, plus `solo`, `solo_multi`,
`solo_single`; `grwsml` also `tutorial`). The ACB unit-cue set and the
choreography effect-variant set both cover the same 16 unit codes, so the
per-unit audio cue and per-unit stage effect belong to the same performance
variant.

### 4b. Oneshot songs (2): `flslgt`, `pcuslv`

Each has a single base file exposing 51 cues:

- 1 full-mix cue with preview/soundcheck aliases;
- 49 oneshot cues `song3_<code>_oneshot_<idol-code>` (e.g.
  `song3_flslgt_oneshot_001tom` … `song3_flslgt_oneshot_049eis`).

### 4c. Single-cue songs (56)

56 catalog songs (61 minus 3 layered minus 2 oneshot) expose a single
full-mix cue with preview/soundcheck aliases; among them `tkstp1`/`tkstp2`
additionally have idol-vocal and backing files.

The remaining catalog songs each expose a single full-mix cue with
preview/soundcheck aliases.

The 245 idol-vocal files are verified against `speaker_dictionary.json`:
every suffix is a known idol code (`001tom` … `049eis`, 49 codes, all
present).

## 5. Choreography bundles

`RAW/asset/song_*.unity3d`: 61 files (UnityFS 2019.4), one per catalog song.

Each bundle contains TextAsset objects:

- `<code>_fumen` — choreography/score data (61/61 present);
- `<code>_for_lipsync` — lip-sync data (60/61; `song_drv999` lacks it);
- `<code>_live_effect[_<variant>]` — live stage effects.

Unit-effect variants:

| song | variants |
| --- | --- |
| `byndtd` | 16 unit codes + `solo` + `solo_multi` + `solo_single` (19) |
| `drvalv` | 16 unit codes + `solo` + `solo_multi` + `solo_single` (19) |
| `grwsml` | 16 unit codes + `solo` + `solo_multi` + `solo_single` + `tutorial` (20) |
| other 58 | base effect only |

Every bundle also carries sprite/texture assets: `image_jacket_<code>`
(61/61) and `image_song_bg_<code>` (61/61) — the song jacket and stage
background — plus stage effect sprites/textures.

`song_drv999.unity3d` is the only bundle with Animator/AnimationClip/
AnimatorController objects.

The three unit-effect variant songs (`byndtd`, `drvalv`, `grwsml`) are the
three "first campaign" songs; `grwsml` additionally has a `tutorial` variant.

## 6. Movie relations (from committed catalogs)

`song_movie_index.json` + `usm_relation_catalog.json` already record 11
exact `3dmv_<resource>` relations and 1 `mvlive_reason` relation; all 11
3dmv resources have a matching `RAW/movie/3dmv_*.usm` file and a matching
`song_movie_index` entry (pl1gdd shared by two song rows). `byndtd`,
`drvalv`, `grwsml`, `flslgt`, `pcuslv`, `tkstp1`, `tkstp2` and the other
launch-era songs have no 3dmv in the snapshot.

## 7. Committed outputs

```text
schemas/song-audio-relation-catalog-v1.schema.json
public/data/song_audio_relation_catalog.json
scripts/generate-song-audio-relation-catalog.py
scripts/verify-song-audio-relation-catalog.mjs
```

The generator is read-only: it scans RAW ACB cue names with vgmstream and
writes the catalog. The verifier cross-checks the catalog against the RAW
file population (counts, song set equality, base/idol/backing presence,
test entities, layered/oneshot summary) and the committed schema. It runs in
source-only mode without a RAW mount; with a RAW mount it additionally
re-scans file existence.

## 8. Open items

- The runtime "idol vocal + backing = full mix" mix recipe is inferred from
  the shared ACB layer lengths and naming. A stronger proof would come from
  ACB sequence/Cue configuration or runtime behaviour; this batch does not
  claim to have decoded the ACB mix graph.
- Chibi now preserves both the source performer slot and its mapped stage
  position for every `SwitchSinger` event; `tkstp1/2` validate as five
  position-identical motion timelines with singer-order-only changes. This is
  a position/lipsync mapping, not yet proof of the browser mixer’s gain/pan
  policy.
- `song_drv999` has no `_for_lipsync` TextAsset and no idol/backing layers;
  it is the April Fools variant.
- `00test` / `02test` base files are test entities; they are excluded from
  the catalog song set and recorded as extras.
