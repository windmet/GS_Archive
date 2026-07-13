# Card Art External Mapping

Date: 2026-07-13

## Decision

Use the original `ALL_PHOTOS` directories as an external read-only asset source. Do not copy the full PNG collection into `public/`.

Default root:

`E:/BaiduNetdiskDownload/SideM/GS_Res/ALL_PHOTOS/assets/resources/image/image_card`

Override with `SIDEM_CARD_ART_ROOT` when the archive is moved to another machine.

## Source families

| Family | Files | Logical coverage | Approx. size | Archive use |
| --- | ---: | --- | ---: | --- |
| `image_card_portrait_hide` | 1,361 | 535 normal + 826 trained unique cards | 0.65 GiB | Default clean portrait |
| `image_card_portrait_show` | 1,361 | Same cards, with rarity/name frame | 0.66 GiB | Optional future skin |
| `image_card_landscape` | 248 | 124 SSR normal + trained pairs | 0.55 GiB | SSR full composition |

The source contains 2,722 portrait PNGs and 248 landscape PNGs. External mounting avoids adding roughly 1.2 GiB for the currently used clean portraits plus landscapes, or 1.85 GiB if framed portraits are also published.

## URL contract

- Clean portrait: `/assets/card-art/portrait/image_card_portrait_hide_{resource_id}[p].png`
- Framed portrait: `/assets/card-art/portrait/image_card_portrait_show_{resource_id}[p].png`
- SSR landscape: `/assets/card-art/landscape/image_card_landscape_{resource_id}[p].png`

`p` means the trained/awakened version. Vite and `server.js` expose the same URL contract and enforce file-name/path checks.

## Duplicate resource IDs

`card_index.json` contains 836 rows but only 826 unique `resource_id` values. Ten IDs are duplicated by tutorial placeholder records. Examples:

- `001tom_n01`: official `スタートライン` vs. `チュートリアル2回目用フォト`
- `001tom_ssr01`: official `瞳に映るその先に` vs. `チュートリアル用フォト`

Archive selectors and manifest generation now prefer official rows over records whose title starts with `チュートリアル` or whose `card_id` is in the 90,000,000 range. This rule is global and currently resolves all ten collisions.

## Current coverage

- Unique card resources: 826
- Clean normal portraits: 535 / 826
- Clean trained portraits: 826 / 826
- SSR normal landscapes: 124 / 124
- SSR trained landscapes: 124 / 124
- Normal card-text voices (`{voice_base}_01_01`): 535 / 826
- Trained card-text voices (`{voice_base}_01_09`): 826 / 826

The 291 cards without a normal portrait are intentional single-state cards rather than missing assets. They comprise five 49-idol SR series (`NEXT DESTIN@TION!`, `PASSION FESTIVAL`, `315!!!SHOP`, `Take a Stump!`, and `超常事変`) plus 46 `グローリーモノクローム` cards. All have only the trained portrait and `{voice_base}_01_09` card-text voice; their normal text is blank or an internal placeholder.

Dual-state cards attach both text voices directly to their matching text blocks. Single-state cards display one canonical portrait and one `卡面台词` block, and no longer appear as missing-normal errors. Mapped cues are removed from the unclassified voice list.

## Follow-up

1. Add a framed/clean display toggle only after the card detail interaction is stable.
2. Add image zoom/lightbox and landscape-first SSR presentation.
3. If remote hosting becomes a goal, generate WebP/AVIF derivatives and publish an asset manifest instead of shipping the original PNG tree.
4. Keep tutorial placeholders available only as raw-data diagnostics; do not expose them as canonical archive cards.
