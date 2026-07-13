# Archive Query And Unit UI - 2026-07-13

## Cross-Domain Story Catalog

`buildStoryCatalog()` converts story masterdata into one query model. Its identity is the compiled file, not the raw master row. This reduces 2,838 master rows to 1,394 playable story entities while retaining all related titles and resource IDs.

| Domain | Unique stories |
| --- | ---: |
| Main | 22 |
| Event | 36 |
| Unit story | 54 |
| Idol story | 107 |
| Card scenario | 342 |
| Work | 637 |
| Birthday | 152 |
| Extra | 44 |

Parent group and chapter titles are included in `searchText`. This is required for queries such as `GROWING`, where the event title lives on the parent group rather than the compiled episode row.

Route:

```text
?view=story_catalog
&story_type=<domain>
&availability=all|playable|missing
&sort=domain|title|resource|steps_desc
&q=<query>
```

The view renders 80 records initially and adds 80 per request. Opening a story writes `return=story_catalog`; player Back restores the complete filter query.

## Card Asset State

The manifest now includes `card_assets_by_id` with four booleans per card:

- `normal_icon`
- `awakened_icon`
- `normal_large`
- `awakened_large`

Card detail displays ordinary and awakened icons independently and labels all four states. Missing ordinary art is no longer hidden behind an awakened-image fallback. Current inventory:

- ordinary icons: 545 / 836
- awakened icons: 836 / 836
- ordinary large images: 1 / 836
- awakened large images: 1 / 836

## Unit Catalog And Detail

Routes:

```text
?view=unit_catalog&category=idol
?view=unit_detail&category=idol&unit=01jup
```

The catalog joins authoritative unit metadata with derived membership evidence and deduplicated unit stories. Unit detail shows:

- representative background
- unit name, kana, color, and description
- member links to stable idol detail URLs
- unit-story links to the player

Opening a unit story preserves the unit code in the player URL and returns to the same unit detail. Idol detail provides the reverse link to its unit.

## Verified Behaviors

- Event query `story_type=event&sort=steps_desc&q=GROWING` returns 36 entities and survives reload.
- Story catalog incremental display changes 80 rows to 160 without navigation.
- Story player returns to the original query and result count.
- Jupiter resolves to three members and three deduplicated unit stories.
- Unit story player returns to `unit=01jup` detail.
- Missing-image and fully-covered card samples render the expected four asset states.
- Desktop and 390×844 layouts have no horizontal overflow.
