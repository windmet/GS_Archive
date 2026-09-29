# Resource status read-model cutover (2026-09-25)

Starting HEAD: `7ec4be3`. The attached architecture package is reference material; source behavior and data come from this checkout.

The producer projects only the fields rendered by the resource status page from `archive_manifest.json`, `archive_verification.json`, and `ui_asset_catalog.json`. The complete manifest relations and visual asset entries stay out of this route's read model. The page accepts the projected manifest, verification and visual-asset summary, while retaining its existing presentation and Spine Lab entry.

Local candidate `E:\GS_readmodels_candidate_20260925_r16`, release `68c2209975c804050e125fd9472d1cbeb8267d9a64566e3c88ba1d5d6c5a083a`: `verify_artifacts` verified 2,967 files; the inline bootstrap is 11,762 bytes. The producer's 28 tests passed, including a comparison against all source fields rendered on this page. `npm run verify:archive-startup-route`, `npm run verify:archive-async-navigation`, and `npm run build:check` passed. The build output is the reusable `.analysis/build-check` code build without a public asset copy.

In the local Browser on `127.0.0.1:5176`, direct `?view=archive_status` showed the verification, coverage, inventory and visual-asset summaries. Its resource inventory contained exactly the resources index, one directory page and one detail leaf, with no legacy `/data` startup request and no console warning/error. Mobile and 1280×800 desktop views were inspected. Entering from Portal and returning to Portal worked; the Portal's Stories entry was also checked after removing its obsolete legacy-data gate, and it loaded the story read models without a legacy startup request.

This is local code and Browser acceptance. It is not a full public-asset package, deployment, physical-device, or real-media acceptance. Other routes still depend on legacy data, and the full cutover contract remains unpromoted.
