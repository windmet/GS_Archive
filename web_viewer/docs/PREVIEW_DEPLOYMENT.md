# Cloudflare Pages / private R2 Preview

This is a Preview-only deployment contract. Do not attach a production domain or
interpret a Pages `master` build as production acceptance.

## Architecture

- `npm run build:preview` compiles only `index.html` and `/_app/*` into `dist`.
- Pages Functions handle `/assets/*` and `/data/*` using the private R2 binding
  `ARCHIVE_ASSETS`. Git does not contain the full local `public` corpus, so both
  prefixes must come from R2. The default Vite `build` remains unchanged.
- The R2 key equals the request path without the leading slash.
- Raw migration candidate routes served only by local development middleware
  are not published by this adapter.

## Local export and upload

Run from `web_viewer`. The staging area and manifest are ignored, stay on E:,
and are never committed. The exporter uses the existing archive asset resolver,
all compiled StoryAssetPlans, card availability flags, and local `public` files.

```powershell
npm run audit:preview-assets
node scripts/export-preview-assets.mjs --export --allow-missing
npm run verify:preview-assets
rclone copy .deploy/r2 cloudflare:sidem-archive-preview --dry-run --quiet
rclone copy .deploy/r2 cloudflare:sidem-archive-preview --transfers 16 --checkers 32 --progress
rclone check .deploy/r2 cloudflare:sidem-archive-preview
```

`--allow-missing` is a deliberate exception for an incomplete Preview, not a
claim of full closure. Inspect `.deploy/r2-manifest.json` → `missing` and do not
use this mode for Production. `rclone copy` does not delete extra remote keys;
do not replace it with `sync` without a separately reviewed deletion plan.

## Pages project

Use Git integration for `windmet/GS_Archive`, root directory `web_viewer`, build
command `npm run build:preview`, output `dist`. Select `master` as the reserved
production branch, disable automatic production branch deployments, and limit
automatic Preview deployments to `codex/p1-effect-texture-deps`. Cloudflare may
run an initial production-branch build while the project is being created;
leave it without a production R2 binding and without a custom domain. It is
not an accepted release. In Preview settings, bind R2 bucket
`sidem-archive-preview` as `ARCHIVE_ASSETS`, then redeploy the Preview branch so
the binding is available to Functions.

Do not create a Direct Upload Pages project as a shortcut: it cannot later be
switched to Git integration. Do not put R2 S3 credentials into Git, Pages build
variables, prompts, or logs. The R2 S3 key only uploads objects; it is not a
Pages administration login.

## Network acceptance

After obtaining the branch Preview URL, run:

```powershell
npm run verify:preview-http -- https://<preview>.pages.dev
```

Then inspect actual Browser cold/deep-link/refresh journeys for Reader, Story
Player, audio seek, mobile hero, and card portrait/landscape. Record 404 keys
against the manifest; an HTTP check alone does not prove rendering or playback.
