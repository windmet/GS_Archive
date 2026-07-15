# Episode Zero Masterdata Audit

Last checked: 2026-07-15

Reference page: `https://wikiwiki.jp/sidem-gstars/エピソードゼロ`

## Conclusion

The local decoded masterdata is sufficient to build a richer Episode Zero archive than the current unit-story search list. It confirms the wiki's public structure and adds machine-readable unlock, asset, episode and reward relations.

Current raw coverage:

- 16 unit groups in table 13;
- 64 chapter records in table 14;
- 54 actually released chapters with non-empty titles;
- 10 unreleased placeholder chapters with blank titles and future placeholder dates;
- 540 episode records in table 15, exactly 10 episodes for each released chapter;
- Episode Zero product groups in table 72.

The released chapter split is six units with four chapters and ten units with three chapters. This matches the final wiki list.

## Useful Fields

### Table 13: EpisodeZeroStoryChapterData

- unit id and unit name;
- chapter resource prefix;
- group sort order;
- default BGM resource id.

### Table 14: EpisodeZeroStorySectionData

- `第1話` through `第4話` label;
- formal scenario title;
- release condition;
- actual open timestamp and display-open timestamp;
- representative background resource id;
- section-level product group id.

The nested release condition decodes as condition type `503`, unit id and required trust rank. Released records reproduce the wiki thresholds:

| Story | Required trust rank for every unit member |
| --- | ---: |
| 第1話 | 3 |
| 第2話 | 10 |
| 第3話 | 30 |
| 第4話 | 40 |

Unreleased placeholders use rank `200`, a blank scenario title and a future timestamp. These are configuration stubs, not archive content, and must remain hidden from normal navigation.

### Table 15: EpisodeZeroStoryEpisodeData

- episode id and `エピソード1` through `エピソード10` label;
- sequential release dependency on the previous episode;
- scenario resource id such as `1_1_001_01_a`;
- episode open timestamp;
- episode product group;
- story character-set id.

The compiled archive currently aggregates the ten raw episode resources into one playable file per chapter. A future detail page can still expose the ten-episode index and use anchors or internal title-card positions to navigate within that aggregate playback file.

### Table 72: EpisodeZeroStoryProductData

The common episode reward group contains `ProductData.Type = 2`, amount `10`. The wiki identifies this as 10 Star Gems per episode. Until the product enum dictionary is normalized, the item name should be marked as wiki-confirmed/curated while the amount and group relation remain raw masterdata evidence.

Some chapter or episode groups also contain `ProductData.Type = 25` products. Their ids are present locally, but the item type has not yet been given a reliable display-name mapping. Do not label these products by guesswork.

## Current Index Gap

`story_master_index.json` already includes tables 13, 14 and 15, but generic parsing leaves nested release conditions as hex strings. It also does not include table 72. The current UI therefore knows titles, dates and playback resources but cannot yet render trust-rank requirements or reading rewards as normalized fields.

Recommended normalized entity:

```text
episode_zero_index
  units[]
    unit_id
    unit_name
    bgm_resource_id
    chapters[]
      chapter_id
      label
      title
      open_at
      background_resource_id
      required_trust_rank
      episodes[]
        episode_id
        label
        resource_id
        character_set_id
        rewards[]
```

## UI Direction

1. Keep the existing 16-unit visual gateway.
2. Turn each unit gateway into an independent Episode Zero unit page.
3. Show released chapters as a chronological list with title, release date, background image and trust-rank requirement.
4. Expand each chapter to its ten episodes and reading reward summary.
5. Enter aggregate playback at the corresponding chapter, with later work adding episode anchors.
6. Filter placeholders by semantic validity: non-empty title, released timestamp and compiled episode resources. Do not filter only by date.

This is a strong next construction target because the data is local, complete for released content and does not depend on a defunct service response.
