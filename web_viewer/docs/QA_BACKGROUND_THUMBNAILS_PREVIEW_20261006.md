# Background thumbnails incremental preview acceptance

## Delivery

- Code commits: `7cc9e8c7` and `a0fa1aa6`, pushed to `codex/portal-architecture-cleanup-20261004`.
- Test deployment: https://679ac1c4.gs-archive-preview.pages.dev/?view=home&home_idol=001tom
- Deployment source revision: `a0fa1aa61036b5d9886b958cf3b73a33439a960e`.
- Data revision: `13133316fe4668073ded3dabc06f754bdd83ac3d12c6dedf2158186b70ff78da`.
- Readmodel release: `ce317169fc85ce52e2087fac36b46b65436af32515ff5619ee3f751047f1e0b1`.

## Incremental upload

The manifest contains 5,388 objects: 353 native background thumbnails, 49 story character images and 4,986 JSON objects in the immutable data snapshot. Staged bytes total 170,801,082. Checksum-based rclone copy completed successfully, retaining existing identical objects. No sync or remote deletion was used. Proxy environment variables were cleared only for the upload/deployment child processes.

Native thumbnails remain lossless WebP. An initial lossy thumbnail failed the existing PSNR threshold; the conversion policy was corrected instead of weakening validation. Full background images retain the existing lossy policy.

Capacity checks reused the fresh remote inventory and previous completed account usage receipt, as requested. Projected target bucket usage is 7,320,107,118 bytes; this is a projection, not a post-upload full bucket enumeration.

Evidence: `.deploy/background-finish-lossless-thumbs-20261006/{manifest.json,image-validation.json,upload-budget.json,upload-receipt.json,http-validation.json}` and `.analysis/background-finish-20261006/new-resources-http.json`.

## Verification

| Check | Result |
| --- | --- |
| Background variant generator and photo scene regression | Passed |
| Preview transform regression | Passed |
| `npm run build:check` and archive build audit | Passed; no full public corpus copy |
| Local desktop home selector | Passed; night filter expands to 14 published backgrounds, search combines with filter |
| Local mobile home and studio selector | Passed at 390 × 844; no horizontal overflow; studio night filter contains 17 spots |
| Published native thumbnail coverage | All 139 home backgrounds have native thumbnail files |
| Online HTTP | Passed; thumbnail bytes, MIME type and hash, background index, versioned data snapshot, gzip and audio Range checked |
| Online rendered interaction | Not completed: browser control transport repeatedly timed out after navigation; HTTP acceptance does not substitute for this |

Local Browser screenshots are under `.analysis/background-finish-20261006/`: `home-desktop.png`, `home-mobile.png`, `studio-mobile.png`. These are local rendered evidence, not online or physical device acceptance.

The existing 5210 production server was preserved. The current-source local test server runs on 5211. Historical inventory gaps (82 audio resources) remain outside this incremental batch. This acceptance does not cover every public route or physical devices, and the Pages deployment is a test deployment rather than production approval.
