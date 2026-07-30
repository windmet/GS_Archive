# GS Archive Extra Story Domain Landing

Date: 2026-07-30
Phase: P1-Story-IA-C
Branch: `codex/story-extra-domain-landing-p1`
Stacked base: `codex/story-domain-ia-a` (`cc8043b`)

## Outcome

`view=story_catalog&story_type=extra` is now a formal archive landing rather
than an implicit search result page.

The landing and collection routes use the masterdata identity model from
`storyDomainIdentityIndex.js`:

- 47 formal collections;
- 47 logical entries;
- 45 distinct resource IDs;
- 44 compiled playback files.

The counts intentionally differ. A compiled file is a playback target, not a
semantic story identity.

## Shared playback boundary

`5_03_000_22.json` is shared by four masterdata entries:

- 2022 April Fools opening;
- 2022 April Fools ending;
- 2023 April Fools opening;
- 2023 April Fools ending.

All four remain separate archive collections. Playback uses the existing
presentation boundaries and resolves to:

- `episodes/5_03_000_22_a.json` for opening entries;
- `episodes/5_03_000_22_b.json` for ending entries.

This preserves logical identity without duplicating compiled media.

## Routes and navigation

- Domain landing:
  `?view=story_catalog&story_type=extra`
- Formal collection:
  `?view=story_collection&story_type=extra&story_section=<master_group_id>`
- Player:
  keeps `story_type=extra`, `story_section`, `return=story_collection`, and
  the selected episode file/range.

Natural entry, direct deep link, refresh, browser Back, and the existing Back
button return to the formal Extra landing. Stable query state such as `q`,
`unit_filter`, and `rarity` remains in the route.

## Responsive and accessibility contract

- desktop: three-column collection grid;
- medium viewport: two columns;
- narrow viewport at 620 px or below: one column;
- the statistics use `dl` semantics;
- the collection list is a labelled region;
- each collection is a native button with a complete accessible name.

The in-app browser session was fixed at 1280 by 720, so desktop behavior was
live-tested. Narrow-screen behavior is covered by the source verifier and CSS
gate; a live resizable narrow viewport remains a separate acceptance step.

## Verification

Run:

```powershell
npm run verify:extra-story-domain-landing
npm run verify:story-domain-identity
npm run verify:story-collections
npm run verify:story-presentation
npm run verify:routes
npm run verify:archive-baseline:source-only
npm run build
git diff --check
```

5174 acceptance covers:

- natural entry from the story portal;
- direct domain and collection deep links;
- refresh;
- browser Back and existing Back;
- stable route filters;
- shared a/b playback boundaries.

## Explicit exclusions

- birthday formal archive work remains P1-Story-IA-D;
- breadcrumb integration across the independent P1 branches remains a small
  merge-order patch;
- search, relationship data, player internals, and publication are unchanged;
- strict-v2 promotion remains P2-A;
- 2–4 hour soak remains P2-B and is still **NOT EXECUTED**.
