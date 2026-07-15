# Story Event Detail And Reward Provenance

Last checked: 2026-07-15

## Decision

Each archived story collection should have an independent detail page, but an event page is not merely a larger episode preview. It is an event entity page that combines:

- official event identity and visual assets;
- event period and event type;
- the formal pre-play story synopsis;
- playback entry for the archived scenario;
- participating idols and unit classification;
- cards whose acquisition source is proven by reward tables.

This is the same archive pattern used by the gasha detail page: catalog rows lead to a stable entity page, and playback or card pages are downstream destinations.

## Masterdata Support

The decoded `client_master_data` supports this direction directly.

| Table | Model | Useful fields |
| ---: | --- | --- |
| 10 | `EventStoryChapterData` | Event code to story chapter relation. |
| 11 | `EventStorySectionData` | Story section, title, release time. |
| 12 | `EventStoryEpisodeData` | Episode title, resource id, story reward groups. |
| 70 | `EventStoryProductData` | Product granted after reading an episode. |
| 112 | `EventData` | Name, type, event period, display period, BGM and asset ids. |
| 113 | `EventTheaterData` | THEATER reward group and aggregation periods. |
| 114 | `EventTheaterRewardData` | Required total PT, limited flag and product. |
| 124 | `EventTourData` | TOUR reward group and aggregation periods. |
| 126 | `EventTourRewardData` | Required total PT, limited flag and product. |

`ProductData.Type = 7` is a direct card product in the verified samples. `Type = 30` uses the same card id and represents a card fragment product. The frontend preserves both rather than collapsing fragments into a direct-card claim.

Generated frontend data:

- `public/data/masterdata/event_index.json`
- generator: `../data_pipeline/masterdata_extract.py`
- verifier: `scripts/verify-event-index.mjs`

## Not Alone Verification

Event `10001`, `GROWING SIGN@L -Not Alone-`, establishes the complete chain:

1. Table 112 identifies the activity period as 2021-10-10 15:00 through 2021-10-17 21:00 JST.
2. Table 113 links event detail `1` to THEATER reward group `1`.
3. Table 114 grants `048mom_sr02` at 25,000 PT and `047shu_sr02` at 53,000 PT.
4. Table 10 links event `10001` to story chapter `410001`.
5. Tables 11 and 12 identify the final story as `エピソード10` and its in-term product group `5`.
6. Table 70 grants `049eis_r02` when that episode is read during the event term.
7. Table 114 also grants fragments for `049eis_r02` starting at 8,400 PT.

These values match the archived wiki page and prove that the prior release-time relation was incomplete: it found the correct three cards, but it could not describe how they were obtained.

## Frontend State

Implemented:

- story portal and search modes;
- independent detail pages for non-event story records;
- event entity page with official banner, dates, synopsis and playback;
- event search cards with banner, event scope, event type, date, synopsis and verified reward-card icons;
- event episode lists built from the formal episode rows and compiled step boundaries;
- direct playback from an individual episode, including a persistent `start_step` deep link;
- reward cards grouped by acquisition method;
- direct separation between Raw reward evidence and Derived same-release relations;
- synopsis removed from the formal player timeline while remaining on the detail page.

The event page intentionally keeps a supplemental `Derived` section only when a same-release card is not present in a reward table. This makes uncertainty visible instead of silently merging evidence levels.

The presentation index now records `episode_index`, `episode_part`, start/end step, dialogue count and voice count for each compiled episode boundary. The 2026-07-15 verification covers 1,394 compiled stories, 900 pre-play synopses and 1,532 episode boundaries. The event navigation verifier additionally confirms that all 36 archived event entities map to 396 selectable episodes. For Not Alone, the 11 formal parts `a` through `k` resolve to Prologue plus Episodes 1-10; selecting the sixth entry writes `start_step=125` and restores as `EP06` after a page reload.

## Limits

- The 59 static event entities include THEATER, TOUR, 315 CARNIVAL, Valentine and White Day records. Only 36 currently map to the normal archived event-story family. Do not fabricate story pages for event types without a matching archived story entity.
- Ranking reward tables contain rank bands and honor ids, but they do not describe historical player rankings. The archive can show reward rules, not past leaderboard results.
- The static tables do not restore live player progress, exchange inventory or service-era user state.
- Full item-name normalization for non-card products remains future work. The current event page only exposes card and card-fragment products whose ids can be resolved against the card index.

## Next Direction

1. Apply the verified episode-boundary model to main and unit stories, starting with chapter landing pages that emphasize formal chapter and episode titles.
2. Normalize non-card `ProductData` ids so the event page can offer an optional full PT reward table without raw numeric labels.
3. Add event music linkage through `SongId` and the existing music catalog.
4. Extend the same independent-page pattern to idol, card, work, birthday and extra story collections without forcing unrelated story families into an event schema.
5. Add optional per-episode completion state locally only after the navigation hierarchy is stable; do not imitate unavailable service-era account state.

The immediate UI priority is now the main-story and unit-story hierarchy. Event entity presentation and episode navigation are no longer blockers and provide the implementation pattern for those pages.
