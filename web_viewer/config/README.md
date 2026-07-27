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
