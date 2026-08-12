# GS Archive

`GS Archive` is a local-first archive viewer and reconstruction project for *THE IDOLM@STER SideM GROWING STARS*. It turns extracted scenario data, masterdata evidence, and locally available media into a searchable web archive with a playable story viewer.

The repository is the source of truth for code, schemas, relationship rules, verification reports, and development notes. It is not a mirror of the original game assets.

## Current Scope

- Vue archive shell with stable, shareable URL state.
- Idol, unit, card, gasha, event, story, song, interaction, and resource views.
- Compiled scenario player with local voice, lip-sync, background, and Spine support.
- Evidence-based card/event/gasha/unit relations derived from masterdata and confirmed research.
- Reproducible data pipelines and archive verification reports.

Current verified archive snapshot:

- 3,398 / 3,398 RAW logical story groups have a unique public match.
- 4,939 / 4,939 valid RAW scenario parts are represented in public output.
- 26,890 / 26,902 RAW story voice references resolve; the remaining 12 are
  authored dangling references.
- Published authoritative Story Runtime v2 currently contains four
  collections and one standalone RAW-published scene, for 30 JSON artifacts.
  Collections `1_4_001_00` and `1_3_10001_01` are ledger-governed; the other
  two collections and the standalone scene predate the publication ledger.
<!-- authoritative-v2-summary collections=4 standalone=1 artifacts=30 -->
<!-- publication-ledger-summary releases=3 stable_logical_ids=2 -->
- Masterdata contains 836 card rows and 826 unique card resource IDs; RAW
  covers 826 / 826 resources, while the portal independently normalizes 826
  card entities.
- 61 logical gasha entities and 36 classified event entities are available in
  the archive indexes.
- 61 routable song entities have bounded RAW-derived jackets and exact main-audio
  relations; experimental layered playback remains explicitly separate from the
  archive catalog contract.
- Birthday Story currently resolves 4 chapters, 181 sections and 181 episodes;
  179 episodes have an explicit subject and 2 producer-birthday common episodes
  remain intentionally unassigned.

The 10,329 JSON files recursively present under `public/data/compiled` are
compiled artifacts, not 10,329 distinct stories. Aggregate, episode, manifest,
fixture, and per-source files are counted separately on disk.

The current repository state and next authorized sequence are maintained in
[CURRENT_ARCHIVE_BASELINE.md](web_viewer/notes/03_audit/CURRENT_ARCHIVE_BASELINE.md).
The 2026-07-28 metric baseline and 2026-08-10 workflow closeout remain dated
historical evidence.

## Architecture

The project keeps four evidence layers separate:

1. `raw/masterdata`: source evidence and decoded tables.
2. Unity object and CRI cue identity: subresources inside authoritative payloads.
3. `data_pipeline`: normalization, relationship derivation, and asset catalog generation.
4. `web_viewer`: static indexes, Vue archive UI, and the scenario player.

`masterdata` defines entities and relationships. Compiled scenarios define story presentation. The UI asset catalog records visual evidence. One layer must not invent missing facts for another.

Organizer-created photo, audio, and scenario exports are compatibility and
parity references. They are not default identity authorities after the
RAW/masterdata migration.

Important paths:

| Path | Purpose |
| --- | --- |
| `data_pipeline/` | Scenario compilation and archive index generators |
| `web_viewer/src/` | Vue application and player source |
| `web_viewer/public/data/` | Versioned generated indexes and verification reports |
| `web_viewer/notes/` | Architecture decisions, audits, and regression records |
| `web_viewer/config/` | Machine-local archive source contract and tracked example |
| `web_viewer/.analysis/` | Ignored inventory, candidate, derived, and rollback workspace |
| `web_viewer/public/assets/` | Runtime media; ignored by default with documented small-asset exceptions |

## Local Development

```powershell
git clone https://github.com/windmet/GS_Archive.git
cd GS_Archive\web_viewer
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

The project verification URL used by the current migration is
`http://127.0.0.1:5174/`.

Large media remains outside the repository. Copy
`web_viewer/config/archive_sources.example.json` to the ignored
`archive_sources.local.json` and configure the local RAW, masterdata, legacy
reference, workspace, derived, publish, and optional tool paths there.

Legacy environment variables remain explicit compatibility overrides for
older tools. They are not the preferred source contract.

Asset synchronization scripts copy only the locally required subset into ignored runtime directories. For example, `data_pipeline/build_ui_asset_catalog.py` can synchronize confirmed unit logos, the brand mark, and manifest-listed event banners from an extracted `assets/resources` root.

## Verification

From `web_viewer/`:

```powershell
node scripts/verify-archive-routes.mjs
npm run verify:archive
npm run build
```

`npm run build` copies the current `public/` tree. When a full local media set is mounted and only the Vue source needs checking, use the source-only build used by this project:

```powershell
node --input-type=module -e "import { build } from 'vite'; await build({ configFile: './vite.config.js', configLoader: 'native', publicDir: false })"
```

Frontend changes should also be checked in a real browser at desktop, tablet, and 390 px mobile widths. A DOM image element is not sufficient evidence of a valid asset; verify its natural dimensions and inspect the browser console.

## Repository Boundary

Tracked:

- Application and pipeline source code.
- Schemas, normalized relationship rules, and lightweight manifests.
- Verification output and development documentation.

Not tracked:

- IPA files, AssetBundles, ACB archives, or extraction directories.
- Original RAW and masterdata files.
- Bulk voice, card art, event media, Spine files, decoded audio, and other
  reproducible large binary trees.
- Machine-specific paths, temporary analysis output, and reproducible runtime copies.

Documented exceptions:

- approved small portal assets;
- explicit test fixtures;
- documentation evidence;
- small stable promoted assets with source identity, hashes, consumers,
  rollback evidence, and a governing manifest.

The 2026-07-28 baseline tracked 108 PNG files totalling 26,384,189 bytes. After
the bounded Extra Story and Song portal batches, the current repository boundary
is 183 tracked PNG files totalling 49,123,497 bytes. The exact boundary and
`git add -f` rules are defined in
[BINARY_AND_PUBLICATION_POLICY_20260728.md](web_viewer/notes/04_refactor/BINARY_AND_PUBLICATION_POLICY_20260728.md).

The original game, characters, names, artwork, audio, and trademarks belong to their respective rights holders. This repository does not grant permission to redistribute extracted game assets.

## Development Guidance

Start with the stable
[current archive baseline](web_viewer/notes/03_audit/CURRENT_ARCHIVE_BASELINE.md),
then the [project map](web_viewer/docs/PROJECT_MAP.md) and
[notes index](web_viewer/notes/INDEX.md). Historical migration logs remain
useful evidence, but they do not override the stable current-state entry.

The GitHub repository can be connected to ChatGPT for code and documentation search. That view only reflects committed files; local assets, generated-but-uncommitted data, and the live browser state still require the local development environment.
