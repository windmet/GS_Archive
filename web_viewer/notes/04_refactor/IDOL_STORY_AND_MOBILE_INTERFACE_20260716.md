# Idol Story And Mobile Interface

Last checked: 2026-08-02

## Purpose

The story archive now has dedicated, masterdata-backed surfaces for personal Idol Episodes and Mobile communication. The flat compiled-file lists remain useful for diagnosis, but they are no longer the primary entry point for these domains.

```text
story portal
  -> idol story archive
    -> idol / formal section / named episode segment
      -> player range
    -> after-story phone link
      -> focused Mobile record

story portal
  -> Mobile archive
    -> personal talk / phone / unit talk / random Talk
      -> grouped compiled conversation
```

## Verified Data Scope

| Entity | Verified count |
| --- | ---: |
| Idols with personal-story pages | 49 |
| Formal personal-story sections | 78 |
| Personal-story episode records | 491 |
| Playable personal-story segments | 491 |
| After-story phone links | 29 |
| Normalized Mobile scenario records | 1,269 |
| Personal talks | 830 |
| Phone calls | 342 |
| Unit talks | 97 |
| Random Talk topics | 245 |

One Mobile scenario, `8_2_2_013`, is still locally missing. The interface keeps its record visible and disables playback instead of inventing a file.

## Personal Story Playback Boundaries

Most formal personal-story episodes already expose `episode_index` or generated `episodes/*.json` artifacts. Birthday `SMALL TALK` records are different: several master rows such as `_a`, `_b`, and `_c` can point to one merged compiled file without formal episode metadata.

`generate-story-presentation-index.mjs` now derives named boundaries when:

- a compiled file has no formal episode boundaries;
- multiple source rows end in letter parts;
- the compiled steps contain enough `stage` transitions.

The first segment starts at the first stage. Remaining segment starts are selected from the final required stage transitions, so an internal stage change inside the first talk is preserved instead of being misclassified as a new talk.

Representative checks:

- Touma `1_2_001_12_a/b/c`: one compiled file, ranges `3-8`, `9-14`, `15-20` in one-based player coordinates;
- Hokuto `1_2_003_12_a/b/c`: the first talk retains its internal stage change;
- all 491 personal-story records resolve to a non-empty, in-range playback target.

## Interface Behavior

### Idol Story

- The story portal opens `idol_story_archive` instead of filtering the generic search list.
- The page selector exposes all 49 idols and preserves the selected idol in the URL.
- Each formal section shows its background, title, pre-play synopsis, release date, rewards, dialogue/voice counts, and named episode controls.
- Whole-section playback uses the existing episode queue and returns to the same idol page.
- A known `idol_story_episode_finished` condition appears as an After Story communication strip and opens the matching Mobile phone record.

Example:

```text
?view=idol_story_archive&idol=001tom
?view=player&idol=001tom&scenario=1_x_001tom_2_1_2_001_12.json&start_step=3&end_step=8&return=idol_story_archive
```

### Mobile

- `personal`, `phone`, `unit`, and `random` are separate tabs, not inferred story categories.
- Rows sharing one compiled file are grouped into one playback item while preserving every unlock condition.
- Card acquisition, awakening, and limit-break conditions link back to the normalized card detail page.
- Mission, term, personal-story completion, and card conditions remain visibly distinct.
- `mobile_scenario` focuses an exact normalized record after crossing from a story page.
- Static masterdata does not provide user read, favorite, received, or actual unlock state; those states must remain local-only when implemented.

### Random topic pool semantics

`random` is not a fourth authored conversation history. It is a client
selection pool reconstructed from two masterdata authorities:

- table 104: topic label, active time window, selection weight and
  `interval_day` before repeat appearance;
- table 105: time-windowed intro labels and join probability.

The archive therefore labels this surface **随机话题池** and reports topic and
intro counts separately. Playback is an archival, sequential preview of the
compiled script file; it does not claim to reproduce the live server/client
selection result. Actual received/read state remains outside static
masterdata.

`random_talk_presentation_index.json` adds a reproducible derived presentation
layer without changing either authority. Its generator resolves every table
104/105 `script_label` through the compiled scenario `jump_points`, then stores
the exact one-based `start_step`/`end_step`, first authored dialogue, dialogue
count and choice count. Current coverage is 245/245 topics and 343/343 intros
across 49 compiled files, with zero missing labels. The UI uses the first
dialogue as the readable topic title and opens an exact playback range; the
technical label remains secondary evidence.

Regenerate and verify with:

```powershell
npm run generate:random-talk-presentation
npm run verify:random-talk-presentation
```

For `017kir`, table 104 contains five candidate topics in one compiled script,
and table 105 contains seven possible intros. Three topics are all-day and two
open from 18:00 until midnight; each topic has weight 1000 and a 14-day repeat
interval. The topic playback ranges are `2–7`, `8–12`, `13–17`, `18–22` and
`23–27`.

Example:

```text
?view=mobile_archive&idol=001tom&unit=01jup&mobile_mode=phone&mobile_scenario=20230801
```

## Verification

Run:

```powershell
npm run story:presentation
npm run verify:story-presentation
npm run verify:idol-communication
npm run verify:idol-story-interface
npm run verify:routes
npm run build
```

Browser QA covered the Touma personal-story page and focused phone archive at 1280x720 and 390x844. Both views had no broken images, page-level horizontal overflow, or console errors. Mobile tabs intentionally scroll within their own tab strip at narrow widths. The `017kir` Random Talk page additionally showed five readable topic cards; selecting the second card opened the exact `start_step=8&end_step=12` range at `1 / 5`, and browser Back returned to `mobile_mode=random`. Profile text emoji markup rendered as the local emoji asset instead of exposing raw tags.

## Next Direction

1. Build a unified Story Collection landing layer that treats Main, Unit, Event, Idol, Work, Seasonal, Birthday, and Mobile as first-class collections with their own detail contracts.
2. Add local reading progress and favorites through a small versioned client repository; do not merge them into static masterdata indexes.
3. Add previous/next navigation between formal sections while keeping the player queue boundary explicit.
4. Normalize card-story collections only after choosing an authoritative grouping rule for card series, release source, and event reward relations.
5. Add localized synopsis text as an overlay index. Preserve Japanese master text as the source-of-truth field.
