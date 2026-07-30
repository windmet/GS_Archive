# GS Archive Main Story Domain Landing

Date: 2026-07-30

Branch: `codex/story-main-domain-landing-p1`

Stacked base: `codex/story-domain-ia-a` / `cc8043b`

## 1. Scope

This P1-Story-IA-B batch turns:

```text
view=story_catalog&story_type=main
```

into a real Main Story domain landing.

It consumes the masterdata-derived `main` model from
`storyDomainIdentityIndex.js`. It does not:

- change the global search identity model;
- add Birthday or Extra landing pages;
- rewrite story collections or playback;
- scan RAW;
- create a publication transaction;
- perform strict-v2 promotion or Runtime soak.

## 2. Product contract

The Story surface now has three distinct states:

```text
view=story_catalog
  -> all-story portal

view=story_catalog&story_type=main
  -> Main Story domain landing

view=story_catalog&story_type=main&story_mode=search
  -> legacy search filtered to Main Story
```

The all-story portal exposes a natural `查看全部` action for Main Story.
Direct links and refresh restore the same domain landing.

## 3. Masterdata presentation

The landing displays:

| Item | Count |
| --- | ---: |
| Master collections | 3 |
| Published chapters | 22 |
| Logical episode rows | 204 |

Collection behavior:

- group `101`: 11 chapters / 102 logical rows, opens the existing collection;
- group `102`: 11 chapters / 102 logical rows, opens the existing collection;
- group `103`: zero chapters, displayed as a disabled master placeholder.

The placeholder is not counted as published content and cannot start
playback.

## 4. Navigation behavior

- all-story portal `查看全部` -> Main Story landing;
- Main Story landing collection card -> existing `story_collection`;
- Main Story landing existing `返回` button -> all-story portal;
- Main Story collection existing `返回` button -> Main Story landing;
- browser Back continues to use browser history;
- stable `q`, `unit_filter`, and `rarity` parameters survive the landing /
  collection round trip.

No browser-history stack is copied into the domain model.

## 5. Responsive and accessibility behavior

- the collection list uses semantic buttons;
- the unpublished group is a real disabled button;
- the landing summary uses a definition list;
- the collection region has an accessible heading;
- desktop uses three cards;
- medium screens use two cards;
- narrow screens use one card and compact summary metrics.

## 6. Verification

Source and model gate:

```text
npm run verify:main-story-domain-landing
npm run verify:story-domain-identity
npm run verify:routes
```

Browser acceptance must cover:

- natural portal entry;
- direct deep link;
- refresh;
- collection entry;
- existing Back button in both landing and collection;
- browser Back;
- disabled group `103`;
- stable filter preservation;
- desktop and narrow-screen layout.

## 7. Stacked integration note

The breadcrumb batch is independently published on:

```text
codex/archive-breadcrumb-p1-ui
```

That batch temporarily routes the `主线剧情` crumb to the all-story portal
because the domain landing did not yet exist at its base. After both batches
are merged, a final integration patch must point that crumb to:

```text
view=story_catalog&story_type=main
```

This integration must continue to clear `parent` / `return` while preserving
stable filters.
