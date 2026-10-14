# Gasha pool rules and art (2026-10-14)

Gasha pages now show the pool's rules as read from its Wikiwiki page. The 25 ticket-only pools also show the
client's own banner, logo and key-visual art.

## Sources

| Data | Source | File |
| --- | --- | --- |
| Rules, prices, step-up, memory-star exchange, page text | Wikiwiki per-gasha pages (`【ガシャ】「…」`), linked from the past-notice pages, checked 2026-10-14 | `public/data/editorial/wiki-gasha-pages.json` (`scripts/extract-wikiwiki-gasha-pages.py`) |
| Ticket-pool art | RAW `image_gasha_banner_<id>` (200×100), `image_gasha_logo_<id>` (280×280), `image_gasha_bg_<id>` (1800×1068) | `public/assets/gasha-pool/` (local, not tracked); index `public/data/editorial/gasha-pool-media.json` (`scripts/prepare-gasha-pool-media.py`) |
| Pool ↔ client gasha id | Banner text, read by hand from the RAW banners | `config/gasha-pool-media.v1.json` |
| Per-gasha detail files | Join of the above | `public/data/editorial/gasha-pools/<id>.json` and `index.json` (`scripts/generate-gasha-pool-details.mjs`) |

Totals:
- 74 wiki pages covering 76 pools; 78 archive gashas have rules.
- 22 ticket pools have art; 3 are unresolved.
- 31 client gasha ids were extracted; 21 of them have a key visual.
- The media package is 7.1 MB.
- The detail JSON is 849 KB in total; the largest single file is 26 KB.

## Identity basis

- `banner_text`: the pool's name is printed on exactly one banner.
- `banner_text_chronology`: several banners carry the same name, and the regular-pool id order (1xxxx) decides between them. 49 pools with announcement codes confirm that this order is chronological (gasha id = announcement code // 10).
- `banner_text_shared`: the pool ran several times and several banners carry its name. 限定復刻プラチナガシャ is the case here. Its banners are listed as same-name banners and are not matched to individual runs.
- Unresolved:
  - 1st Anniversary 第1弾 and 第2弾: two banners (20046 and 20047). Neither one says which 弾 it is.
  - 当日限定: no banner exists in the client data.

  The page lists the candidates and the reason, and does not guess.

## What is not available

- **Numeric rates:** they came from the server (`GashaRateArgs`/`GashaRateReply`). The saved container has no API cache, and Wikiwiki does not record them either. The page states only what the wiki says, for example that new cards have a higher rate than other cards of the same rarity.
- **Server-side gasha fields:** `GashaData` in the decompiled client (`GashaPlans`, `GashaCeiling`, `GashaDetail`, `MovieAnnounceId`, `CardDetails`, `GashaStep`) is all delivered by the server and was not saved.
- **Page period conflicts:** for イナズマロック and SSR出現率UP, the notice says 21:00 while the page says 15:00. The extractor records both under `period_conflicts`. The archive keeps the notice time.
- **4/4 プラチナガシャ:** has no wiki page.

## Presentation

- `src/presentation/gashaRuleFacts.js` turns 20 kinds of recognised lines into Chinese statements. The full Japanese page text stays in a collapsible 「卡池页原文」 block, with a link to the page.
- If an exchange lists exactly the related cards, all at one price, it is shown as one line.
- `ArchiveGashaArt.vue` shows the key visual with the logo when a key visual exists. Otherwise it shows the logo over a blurred banner.

## Verification

- `npm run verify:gasha-pool-details` (also part of `verify:editorial-source`). It checks that:
  - the detail files rebuild exactly from their sources;
  - each ticket-only pool is named exactly once in the config;
  - the media index matches the config hash;
  - all 757 facts read as statements;
  - `--require-media` additionally hashes all 83 art files.
- `npm run build:check`.
- The browser path journey (46 steps).
- Screenshots of the following pages at 1280 and 390 wide:
  - a ticket pool with a variant (花火);
  - a key-visual pool (NEXT DESTIN@TION);
  - the shared pool (限定復刻);
  - an unresolved pool (1st Anniversary);
  - an announcement gasha (210003);
  - the catalogue grid.

The media was not uploaded to R2, and nothing was deployed.
