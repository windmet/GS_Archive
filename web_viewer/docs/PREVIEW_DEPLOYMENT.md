# Cloudflare Pages / private R2 Preview

This is a Preview-only deployment contract. Do not attach a production domain or
interpret a Pages `master` build as production acceptance.

## Deployment transform: lossless WebP

Runtime URLs are a frozen contract. Story JSON, Spine `.atlas` files and the
asset resolvers keep requesting `.png`; only the physical R2 object changes.

```text
/assets/.../foo.png   (request key, unchanged everywhere in the app)
        ↓  shared/deploy/PreviewAssetTransform.js
assets/.../foo.webp   (object key, what R2 actually stores)
```

`shared/deploy/PreviewAssetTransform.js` is the single policy. The exporter and
the Pages Function both import it, so they cannot drift. The scope is **every
PNG in the corpus**, expressed as an exclusion list with one entry:
`assets/brand/*.png` stays a real PNG so it can keep acting as the control probe
proving that an untransformed PNG request still serves PNG bytes. An exclusion
list rather than an allowlist is deliberate — an allowlist would silently skip
any resource family added to the corpus later, and that family would 404 because
the Function resolves `.png` to `.webp` unconditionally.

`verify:preview-transform` enforces that closure directly: it fails if any PNG
outside the exclusion list is still untransformed.

Encoding rules, from the earlier SSR migration: `alpha === 0` pixels get their
RGB zeroed (invisible pixels still bleed red or dark fringes into edge
sampling), `0 < alpha < 255` is untouched, dimensions are never resampled, and
the WebP is always lossless. PNGs are converted in full — there is no per-file
"keep the PNG if the WebP is bigger" escape hatch, because the Function resolves
`.png` to `.webp` unconditionally and a partial conversion would 404.

Manifest `schema_version` is 2. Each entry carries `request_key`, `object_key`,
`source_size`, `deployed_size`, `source_content_type`, `deployed_content_type`,
`transform` and the placement hash. `totals` reports source and deployed bytes
separately. `missing` still records request keys.

## Storage budget

The account is on the Cloudflare free tier, whose storage **budget** is 10 GB-month
across all buckets — a budget to stay clear of, not a hard ceiling to fill to.
Roughly 0.88 GB is already committed elsewhere. The account-wide figure is
therefore not the target: the Preview bucket itself should stay at
**≤ 8.2–8.3 GiB**, leaving real headroom rather than spending the free allowance
down to its edge.

First WebP pass (three domains only) measured 9.944 GiB source → **8.800 GiB
deployed**, which is inside the account budget but above the bucket target.
The second pass extends the transform to the whole PNG corpus: 2,376 files /
946.3 MiB remained, of which `assets/bg/` was 400 files / 764.0 MiB and
`assets/cards/icons/` 1,361 files / 41.5 MiB.

The two passes together are the shipped state: **9.944 GiB source →
8.479 GiB deployed** across 98,032 objects (15,399 PNGs converted, ratio
0.8527). The bucket measured 9,104,196,931 B, of which 392,558 B is 16 orphaned
`.png` leftovers from pre-transform uploads that the routing policy now shadows.

A measured 15-file background sample retained 65.9%, and the realized second
pass tracked it closely. It still lands at 8.479 GiB, so **the 8.2–8.3 GiB
target is not reachable by lossless PNG→WebP alone** — even converting every
remaining PNG saves about 323 MiB. Closing the remaining ~183 MiB gap needs a
different lever (lossy/AVIF backgrounds, or uploading less), and that is a
separate decision from this transform.

Backgrounds were classified by minimum alpha before the decision to convert, to
record what the `alpha === 0` cleanup actually does per class:

| class | files | MiB | cleanup applies |
| --- | --- | --- | --- |
| `alphaMin = 255` | 306 | 580.38 | no — plain lossless win |
| `0 < alphaMin < 255` | 93 | 183.04 | no — `alpha === 0` never occurs |
| `alphaMin = 0` | 1 | 0.53 | yes — the fringing cleanup |

The classes proved statistically indistinguishable in compression (66.1% /
65.3% / 63.9% retained), so opacity does not predict compressibility, and the
whole corpus is converted in one pass rather than split by class.

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
npm run report:preview-footprint
npm run verify:preview-routing
node scripts/export-preview-assets.mjs --export --allow-missing
npm run verify:preview-transform
npm run verify:preview-assets
node scripts/verify-preview-webp-quality.mjs
npm run generate:preview-canary
rclone copy .deploy/r2 cloudflare:sidem-archive-preview --files-from .deploy/canary-object-keys.txt --dry-run --progress
rclone copy .deploy/r2 cloudflare:sidem-archive-preview --files-from .deploy/canary-object-keys.txt --transfers 8 --checkers 16 --progress
rclone check .deploy/r2 cloudflare:sidem-archive-preview --files-from .deploy/canary-object-keys.txt
```

Only after the canary is accepted over HTTP in a browser, do the full copy:

```powershell
rclone copy .deploy/r2 cloudflare:sidem-archive-preview --dry-run --progress
rclone copy .deploy/r2 cloudflare:sidem-archive-preview --transfers 16 --checkers 32 --progress
rclone check .deploy/r2 cloudflare:sidem-archive-preview
rclone size cloudflare:sidem-archive-preview
```

`verify-preview-webp-quality.mjs` replaces eyeballing samples with an exact
comparison: alpha must be byte-identical, visible RGB must be byte-identical
(the encode is lossless), and only fully transparent pixels may differ, which is
the fringing cleanup itself. The canary list contains **object** keys, so
converted domains appear as `.webp` while untransformed ones keep their name.

The exporter repopulates `.deploy/r2` and then removes any staged object the new
manifest does not describe, so the staging tree always equals the manifest. That
matters here: the pre-WebP stage holds 13,024 `.png` objects whose keys are no
longer in the manifest, and leaving them would upload objects nothing references.
`rclone copy` never deletes remote keys, so those stale *remote* objects survive
until a separately reviewed cleanup. The live bucket carries exactly 16 such
leftovers — 15 `assets/stamps/*.png` and one
`assets/portal/image_mobile_background_common.png`, 392,558 B total, all from
uploads predating the transform. Their request keys are transformed, so the
routing policy resolves them to `.webp` and never reads the `.png` object; they
are dead weight, not a serving hazard.

Run the upload with the proxy cleared. `rclone` honours `HTTP_PROXY` /
`HTTPS_PROXY` / `ALL_PROXY` from the environment, and the local proxy caps
throughput at ~0.6 MiB/s against ~3.2 MiB/s direct — a 5x difference over a
9 GB corpus. `.deploy/upload-direct.cmd` clears those variables for its own
process and then runs the copy.

Pruning a reused tree is the current mechanism, not the desired end state. It
deletes files in place, it is at the mercy of external handles on this Windows
tree (an observed blocker: a stalled `fs.rm` with no error), and each pass costs
a full re-verification of the whole stage. **Future improvement:** export into a
fresh versioned staging directory (for example `.deploy/r2-<hash>`), verify and
upload it, then remove the superseded tree once its replacement is accepted.
That makes every export atomic and removes pruning from the critical path. Not
refactored in this pass, deliberately: the transform layer is the variable under
test and the staging layout should not move at the same time.

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
