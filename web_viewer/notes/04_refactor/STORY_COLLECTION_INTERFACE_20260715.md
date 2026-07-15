# Story Collection Interface

Last checked: 2026-07-15

## Purpose

Main and unit stories now use a stable collection hierarchy instead of relying on the flat search result list:

```text
story portal
  -> main chapter or unit collection
    -> formal story chapter
      -> compiled episode boundary
        -> player start_step
```

Search remains available as a cross-domain diagnostic and discovery surface. It is not the primary reading hierarchy for main or unit stories.

## Data Model

The collection selector joins three authoritative layers:

- `story_master_index.json` groups define the main chapter or unit identity;
- chapter and episode rows define formal labels, titles, order and resource ids;
- `story_presentation_index.json` defines the compiled start/end step for each episode part.

Verified scope:

| Domain | Collections | Formal chapters | Episode rows |
| --- | ---: | ---: | ---: |
| Main story | 3 master groups | 22 | 204 |
| Unit story | 16 units | 64 | 540 |
| Total | 19 | 86 | 744 |

The third main-story group and each unit's fourth chapter may exist in masterdata without a compiled scenario. These records remain visible when their collection is opened, but playback is disabled. The frontend must not infer missing dialogue or fabricate a scenario file.

## Interface Behavior

- Main story and unit buttons on the story portal open `story_collection` routes.
- A collection page uses the official main chapter banner or unit story visual.
- Formal chapters are shown as accordion rows with title, synopsis, episode count and voice count.
- The first available chapter opens by default.
- Whole-chapter playback starts after any pre-play synopsis.
- Individual episode buttons use the compiled episode boundary and write a one-based `start_step` query parameter.
- Reloading a player deep link restores the same episode; Back returns to the originating collection.
- Unavailable chapter and episode controls are disabled and visually distinct.

Examples:

- Main chapter 1: `?view=story_collection&story_type=main&story_section=101`
- Jupiter: `?view=story_collection&story_type=unit_story&story_section=1`
- Main story episode deep link: `?view=player&story_type=main&story_section=101&scenario=1_4_001_01.json&start_step=113&return=story_collection`

## Verification

Run:

```powershell
npm run verify:story-collections
npm run verify:routes
npm run build
```

`verify:story-collections` checks collection/chapter/episode totals, compiled-file presence, boundary counts, disabled unavailable rows, and representative Main Story/Jupiter records.

Browser QA covered:

- desktop main chapter page and Jupiter collection page;
- episode selection, player episode badge, reload and Back restoration;
- unavailable Jupiter chapter state;
- 390x844 main chapter layout, horizontal overflow and broken images.

## Next Direction

1. Reuse the collection page for idol stories, where the collection identity is the idol rather than a unit.
2. Decide whether card stories should group by card series, acquisition source or card resource before applying this model.
3. Keep birthday, seasonal and work pages specialized because their grouping metadata and reader expectations differ.
4. Add local reading progress only after all formal collection routes are stable.
