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
