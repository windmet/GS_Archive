# Local archive source configuration

`archive_sources.example.json` is the committed schema example.
`archive_sources.local.json` is machine-specific and ignored by Git.

Resolution precedence is:

1. a tool's explicit path argument, such as `--raw-root`;
2. `--sources-config`;
3. the `SIDEM_ARCHIVE_SOURCES_CONFIG` environment variable;
4. `archive_sources.local.json`;
5. repository-relative built-in defaults.

Copy the example only when a new machine does not already have a local file.
Do not commit the local file.

Masterdata has two deliberately separate inputs:

- `masterdata_source_file`: XOR-state `client_master_data`;
- `masterdata_decoded_file`: decoded protobuf.

The current `masterdata_extract.py` default remains `--input-state xor`.
Passing a decoded PB requires `--input-state decoded`; otherwise the data would
be XORed a second time.

Generate the RAW inventory from `web_viewer` with:

```powershell
npm run verify:archive-sources
python ..\data_pipeline\raw_source_manifest.py
```

The manifest command never writes inside RAW. Its default ignored outputs are:

```text
web_viewer/.analysis/raw-migration/source/files.jsonl
web_viewer/.analysis/raw-migration/source/summary.json
```

The card, ADV-background, and character-image audit/candidate tools also load
this contract. Their explicit path arguments remain final overrides:

```powershell
python ..\data_pipeline\audit_raw_card_coverage.py
python ..\data_pipeline\audit_raw_background_coverage.py
python ..\data_pipeline\audit_raw_character_resources.py

python ..\data_pipeline\extract_raw_card_candidate.py 001tom_r01
python ..\data_pipeline\extract_raw_background_candidate.py bg001_315pro_in_01
python ..\data_pipeline\extract_raw_character_image_candidate.py `
  event_story_visual 002sht
```

Audio tools use the same precedence. Configure `vgmstream_file`,
`ffmpeg_file`, and `ffprobe_file` only in the ignored local configuration.
The committed example deliberately leaves those machine-specific executable
paths as `null`.

With the local configuration present, the complete audio inventory and bounded
candidate regressions can run without repeating source or executable paths:

```powershell
python ..\data_pipeline\audit_raw_audio_coverage.py
python ..\data_pipeline\index_raw_audio_cues.py
python ..\data_pipeline\compare_raw_audio_cue_variants.py
python ..\data_pipeline\audit_master_bgm_selector_mapping.py

python ..\data_pipeline\extract_raw_audio_candidate.py `
  --kind bgm --cue usual_day
python ..\data_pipeline\extract_raw_acb_sequence_candidate.py `
  --kind se --cue waribashi
```

`audit_master_bgm_selector_mapping.py` defaults to the configured XOR-state
source. When passing the decoded PB explicitly, also pass
`--master-data-state decoded`. Candidate outputs remain ignored under
`.analysis/raw-migration/audio`; these commands do not publish stable assets.

The RAW story coverage, voice-gap audit, and bounded candidate extractor also
use the shared contract:

```powershell
python ..\data_pipeline\audit_raw_story_coverage.py
python ..\data_pipeline\audit_raw_story_voice_gaps.py
python ..\data_pipeline\extract_raw_story_candidate.py `
  --scenario-container ..\RAW\asset\scenario_1_2_001_12.unity3d `
  --scenario-id 1_x_001tom_2_1_2_001_12
```

The coverage audit requires the default source manifest so every bundle record
retains its RAW SHA-256. The candidate extractor prefers the complete audio cue
index and falls back to configured `vgmstream` only when the default index does
not exist. An organizer-era voice directory is deliberately not a default
source; pass `--legacy-voice-root` explicitly only for parity evidence.

Vite and `generate-archive-manifest.mjs` load the same JSON through the
source-only JavaScript loader. `legacy_root` is explicitly the organizer-era
SideM directory, not RAW authority. The current development defaults derive:

```text
scripts/lipsyncdata/adxlip
GS_Res/Audio
story_viewer/voice_ogg
GS_Res/ALL_PHOTOS/assets/resources/image/image_card
```

The existing `SIDEM_LIPSYNC_ROOT`, `SIDEM_AUDIO_ROOT`,
`SIDEM_LEGACY_AUDIO_ROOT`, and `SIDEM_CARD_ART_ROOT` environment variables
remain final overrides. If `legacy_root` is `null`, builds use a non-existent
repository-local `sources/legacy_curated` placeholder and do not fall back to a
developer's drive path.

The live-chibi song builder also uses this contract. Its default input is
`RAW/audio`, and its default `vgmstream`/FFmpeg executables come from the
ignored local configuration. Explicit CLI arguments and the existing
`VGMSTREAM_CLI`/`FFMPEG` environment variables remain final overrides:

```powershell
python scripts\prepare-live-chibi-audio.py --song-code drvalv

# Isolated forced candidate; does not touch the stable public music directory.
python scripts\prepare-live-chibi-audio.py `
  --song-code drv999 --force `
  --output-root .analysis\raw-migration\live-chibi-audio
```

Omitting `--output-root` preserves the established
`public/assets/live-chibi/music` output. Use the isolated form for source
identity regressions before replacing any stable derivative.

The live-chibi Backmonitor builder uses configured `RAW/movie` as its physical
authority and derives the choreography CSV root from `legacy_root`. FFmpeg,
FFprobe, and the ignored WannaCRI package root are machine-specific:

```powershell
python -m pip install `
  --target .analysis\workspace\wannacri-runtime `
  WannaCRI==0.3.1

python scripts\prepare-live-chibi-backmonitor.py `
  --asset live_backmonitor_movie_ballade_01 `
  --force `
  --output-root .analysis\raw-migration\live-chibi-backmonitor\candidate
```

Configure `wannacri_root` to the directory that contains
`wannacri/__init__.py`. Explicit `--script-root`, `--movie-root`, media-tool,
WannaCRI, and output arguments remain final overrides. Repeat `--asset` for a
bounded set; when a target index already exists, the selected records merge
without dropping its other entries. Omitting `--asset` retains the established
full 73-movie/4-transition build.

The live-chibi image-layer builder follows the same split-source contract:
`liveeffectscript` CSVs under `legacy_root` provide semantic references, while
configured `RAW/asset/song_<songCode>.unity3d` is the physical authority.

```powershell
python scripts\prepare-live-chibi-image-layers.py `
  --asset stage_flslgt_01 `
  --force `
  --output-root .analysis\raw-migration\live-chibi-image-layers\candidate
```

Explicit `--script-root`, `--raw-asset-root`, and `--output-root` arguments
remain final overrides. Repeat `--asset` for a bounded set. A selected rebuild
merges its records into an existing target index, so an isolated mirror of the
57-entry stable index can be used for non-destructive regression. Omitting
`--asset` retains the established full 57-image build.

The live-chibi object-layer builder also treats `liveeffectscript` CSVs as
semantic references and configured `RAW/asset` as physical authority:

```powershell
python scripts\prepare-live-chibi-object-layers.py `
  --asset fx_in_bnckgy_overlight_1 `
  --force `
  --output-root .analysis\raw-migration\live-chibi-object-layers\candidate
```

Explicit `--script-root`, `--raw-asset-root`, and `--output-root` arguments
remain final overrides. Repeat `--asset` for a bounded set. Selected records
are replaced in place in an existing target index, preserving the full catalog
order and its explicit missing list. Omitting `--asset` retains the established
185-reference build.

The live-chibi static-stage builder excludes stage textures dynamically
referenced by `liveeffectscript`, then composites the remaining numbered
textures from configured `RAW/asset/song_<songCode>.unity3d`:

```powershell
python scripts\prepare-live-chibi-stage-backgrounds.py `
  --song-code bnckgy `
  --force `
  --output-root .analysis\raw-migration\live-chibi-stage-backgrounds\candidate
```

Explicit `--script-root`, `--raw-asset-root`, and `--output-root` arguments
remain final overrides. Repeat `--song-code` for a bounded set. Selected songs
replace their records in place in an existing target index. Omitting
`--song-code` retains the established full 55-background build.

The main live-chibi builder now reads body metadata, five shared setup
skeletons, costume atlas/textures, and all animation fragments directly from
configured `RAW/asset`. Choreography CSVs and the existing 60 Hz lip-sync JSON
remain declared legacy semantic/derived inputs:

```powershell
python scripts\prepare-live-chibi-assets.py `
  --output-root .analysis\raw-migration\live-chibi-core\candidate
```

The committed stable `inventory.json` is the default `--costume-selection`;
its 549 `modelId` rows deliberately bound this supply-chain migration to the
live-compatible `cos.atlas` / `cos` subset. Use explicit `--raw-asset-root`,
`--effect-script-root`, `--live-lip-sync-root`, `--costume-selection`, and
`--output-root` overrides for isolated audits. The other 141 master models are
not unpublished live costumes: their RAW bundles contain the independent
communication Spine payload `comu.atlas` / `comu.skel` / `comu`, but no
live-chibi `cos` payload. They are already published under
`public/assets/spines` and must not be added to the live inventory.

Reproduce that consumer-boundary and stable-output regression with:

```powershell
npm run audit:live-chibi-costume-boundary
```

The ignored report is written to
`.analysis/raw-migration/live-chibi-costume-boundary/audit.json`.

The live-chibi stage-effect textures are a deliberate exception to RAW
authority. They are embedded in the client XAPK's nested main APK
`assets/bin/Data/data.unity3d`; the matching built-in Laserlight and
Pinspotlight texture names were not found in `RAW/asset`. Configure the exact
container through the ignored `xapk_file` field:

```powershell
python scripts\prepare-live-chibi-stage-effects.py `
  --output-root .analysis\raw-migration\live-chibi-stage-effects\candidate
```

An explicit `--xapk` remains the final source override. Omitting
`--output-root` preserves the established
`public/assets/live-chibi/stage-effects` target. The script requires an exact
configured file and never searches a personal directory for the newest XAPK.
Like executable paths, `xapk_file` is machine-specific and must remain only in
`archive_sources.local.json`; the committed example keeps it `null`.
