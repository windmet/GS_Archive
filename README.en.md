# GS Archive

An unofficial archive of *THE IDOLM@STER SideM GROWING STARS* (in service 2021-10-06 – 2023-07-31).

[中文](README.md)

The site collects the stories, phone calls and chats, cards, songs, events and gashas that were published in the game,
with Chinese translations, a text reader and a replay player for the stories, and web rebuilds of the charts, the 2D live stage and the photo studio.
The Chinese translations are machine translations: mainly Gemini 3.8 Flash, with GPT 6.1 Sol, Claude Sonnet 5.5 and Claude Opus 5.5 reviewing the whole text and checking proper nouns.
The site itself is in Chinese; untranslated passages fall back to the Japanese original, and the reader can switch to original or bilingual text at any time.

## Disclaimer

This is a personal, non-commercial fan project. It is not affiliated with, authorized or endorsed by BANDAI NAMCO Entertainment Inc. or any other rights holder.
All game text, images, audio and video belong to their respective rights holders. The project does not distribute game files.
Rights holders can reach the maintainer at windmet@outlook.com.

## What is in this repository

Code, data rules, verification reports and development notes. **Not** included: client files, RAW and masterdata originals,
voice, card art, Spine models or other bulk media. The few tracked exceptions (small portal images, test fixtures) are listed in the
[binary and publication policy](web_viewer/notes/04_refactor/BINARY_AND_PUBLICATION_POLICY_20260728.md).

| Path | Contents |
|---|---|
| `data_pipeline/` | Python: scenario compilation, index generation, asset catalogs |
| `web_viewer/src/` | The site and story player (Vue 3, PixiJS 7, Spine 3.8) |
| `web_viewer/readmodels/` | Read-model generators, client and assembly checks |
| `web_viewer/scripts/` | Node scripts for generation, audits, releases and verifiers |
| `web_viewer/translation/` | Translation project (glossary, review, batches) |
| `web_viewer/docs/`, `web_viewer/notes/` | Development notes (mostly Chinese) |

## Local development

Requires Node.js 24 and Python 3.

```powershell
git clone https://github.com/windmet/GS_Archive.git
cd GS_Archive\web_viewer
npm ci
npm run dev
```

A code-only checkout runs the source checks but shows almost no content. To see the full archive you need your own extracted client data:
copy `web_viewer/config/archive_sources.example.json` to the git-ignored `archive_sources.local.json` and point it at your RAW, masterdata and workspace directories.

Checks, from `web_viewer/`:

```powershell
npm run gate:source   # source gate, same as CI
npm run build:check   # compiles the source without copying local media
```

Do not use `vite build` or `npm run build` as a code check: it copies the whole `public/` tree, which holds several GB of local corpus.

## Feedback

Bugs, translation issues and broken pages: [GitHub Issues](https://github.com/windmet/GS_Archive/issues), or windmet@outlook.com.

## License

- Code and documentation written for this project: [MIT](LICENSE).
- Game content and data derived from it: excluded; no rights are granted.
- The site's translations: not under an open license; credit the source when quoting them.
- Third-party components keep their own licenses; see [THIRD_PARTY_NOTICES.txt](web_viewer/THIRD_PARTY_NOTICES.txt).
  The Spine Runtimes require every developer who integrates them to hold a Spine license, so a fork that deploys its own copy needs its own.
