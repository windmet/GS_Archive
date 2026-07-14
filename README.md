# GS Archive

`GS Archive` is a local-first archive viewer and reconstruction project for *THE IDOLM@STER SideM GROWING STARS*. It turns extracted scenario data, masterdata evidence, and locally available media into a searchable web archive with a playable story viewer.

The repository is the source of truth for code, schemas, relationship rules, verification reports, and development notes. It is not a mirror of the original game assets.

## Current Scope

- Vue archive shell with stable, shareable URL state.
- Idol, unit, card, gasha, event, story, interaction, and resource views.
- Compiled scenario player with local voice, lip-sync, background, and Spine support.
- Evidence-based card/event/gasha/unit relations derived from masterdata and confirmed research.
- Reproducible data pipelines and archive verification reports.

Current verified archive snapshot:

- 8,441 / 8,441 scenario JSON files parse successfully.
- 26,849 / 26,912 canonical dialogue voice references resolve (99.77%).
- 826 normalized card entities.
- 61 logical gasha entities.
- 36 classified event entities.

## Architecture

The project keeps three evidence layers separate:

1. `raw/masterdata`: source evidence and decoded tables.
2. `data_pipeline`: normalization, relationship derivation, and asset catalog generation.
3. `web_viewer`: static indexes, Vue archive UI, and the scenario player.

`masterdata` defines entities and relationships. Compiled scenarios define story presentation. The UI asset catalog records visual evidence. One layer must not invent missing facts for another.

Important paths:

| Path | Purpose |
| --- | --- |
| `data_pipeline/` | Scenario compilation and archive index generators |
| `web_viewer/src/` | Vue application and player source |
| `web_viewer/public/data/` | Versioned generated indexes and verification reports |
| `web_viewer/notes/` | Architecture decisions, audits, and regression records |
| `web_viewer/public/assets/` | Local runtime media; intentionally excluded from Git |

## Local Development

```powershell
cd web_viewer
npm install
npm run dev
```

The default development URL is `http://127.0.0.1:5173/`.

Large media remains outside the repository. The development server can mount external roots through:

- `SIDEM_AUDIO_ROOT`
- `SIDEM_LIPSYNC_ROOT`
- `SIDEM_CARD_ART_ROOT`
- `SIDEM_ADV_BACKGROUND_ROOT` during scenario compilation

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
- Voice, card art, event banners, Spine files, and other original binary media.
- Machine-specific paths, temporary analysis output, and reproducible runtime copies.

The original game, characters, names, artwork, audio, and trademarks belong to their respective rights holders. This repository does not grant permission to redistribute extracted game assets.

## Development Guidance

Start with [UI asset evidence and reconstruction guidance](web_viewer/notes/04_refactor/UI_ASSET_EVIDENCE_AND_RECONSTRUCTION_NEXT_PHASE_20260714.md). The notes index is available at [web_viewer/notes/INDEX.md](web_viewer/notes/INDEX.md).

The GitHub repository can be connected to ChatGPT for code and documentation search. That view only reflects committed files; local assets, generated-but-uncommitted data, and the live browser state still require the local development environment.
