# Main, Extra, Birthday And Seasonal Story Masterdata Audit

Last checked: 2026-07-15

Reference pages:

- `https://wikiwiki.jp/sidem-gstars/メインストーリー`
- `https://wikiwiki.jp/sidem-gstars/エクストラストーリー`
- `https://wikiwiki.jp/sidem-gstars/誕生日2021`
- `https://wikiwiki.jp/sidem-gstars/誕生日：プロデューサー(プレイヤー)`
- `https://wikiwiki.jp/sidem-gstars/過去のキャンペーン`
- `https://wikiwiki.jp/sidem-gstars/【キャンペーン】「Happy Valentine 2023」`

## Conclusion

The local decoded masterdata and compiled scenarios are sufficient to build independent archive pages for the main story, Extra Story, idol birthdays, Producer birthdays and seasonal campaigns. All 432 referenced scenario resources in the first four families are present locally:

- main story: 204/204 episode resources;
- Extra/Home Story: 47/47 episode resources;
- birthday story: 181/181 episode resources.

The current generic `story_master_index.json` preserves playback coverage, but it flattens several important distinctions. Dedicated indexes should retain chapter visibility, yearly birthday cycles, terms, character sets, rewards and evidence provenance.

## Main Story

### Raw structure

| Table | Model | Count | Useful fields |
| ---: | --- | ---: | --- |
| 4 | `MainStoryChapterData` | 3 | chapter label, release condition, open/display time, BGM, resource prefix |
| 5 | `MainStorySectionData` | 22 | prologue/story label, formal title, open time, representative background, reward group |
| 6 | `MainStoryEpisodeData` | 204 | episode label, scenario resource, sequential release condition, character set, reward group |
| 66 | `MainStoryProductData` | 46 | reading/completion products |
| 67 | `MainStoryCharacterSetData` | 204 | participating story characters per episode |

Only chapters 1 and 2 contain section and episode records. Table 4 also contains a chapter 3 configuration stub with a 2030 placeholder open time, but there are no table 5/6 children and no compiled scenarios for it. It must remain hidden.

Each released chapter contains one prologue with two raw episodes and ten numbered stories with ten raw episodes each. This gives 102 raw episode resources per chapter and 204 total.

### Information beyond the current catalog

- exact formal title and implementation time for every prologue/story;
- representative background resource for every story;
- chapter BGM (`bgm_drvalv_inst` in the current data);
- ten internal episode labels and resources for each numbered story;
- per-episode character sets and release dependencies;
- reward groups.

The common episode reward is `Product.Type = 2`, amount `50`. The wiki confirms this as 50 Star Gems per episode. Other product groups contain `Type = 25` ids and should not receive display names until the product/title enum relation is normalized.

Table 4 only calls the groups `第1章` and `第2章`. The long chapter titles shown by the wiki are nevertheless recoverable from the final completion text of each chapter's compiled story:

- `踏み出した一歩、輝く舞台を目指して`
- `叩きつけられた挑戦状！ トップアイドルへの道`

These titles should be marked as `compiled-derived`, not as table 4 fields.

## Extra Story And Home Story

### The important ownership boundary

The scenario records used by Extra Story are actually stored in the Home Story family:

| Table | Model | Count | Useful fields |
| ---: | --- | ---: | --- |
| 143 | `HomeStoryChapterData` | 10 | internal campaign family, open time, sort order |
| 144 | `HomeStorySectionData` | 47 | section title, exact term, type, optional linked content id |
| 145 | `HomeStoryEpisodeData` | 47 | title, resource, day count, release condition, mode, favorite flag, product/character set |
| 177 | `HomeStoryCharacterSetData` | 47 | participants |
| 183 | `HomeStoryProductData` | 16 | optional products |
| 178 | `ExtraStoryChapterData` | 7 | explicit Extra archive entry, UI resource/logo ids, archive term |

Therefore, table 143 count is not the visible Extra Story count. The correct normal archive gateway is table 178.

### Seven visible Extra families

1. New Year 2022, one story.
2. GROWING FES June 2022, one story.
3. 1st Anniversary, twenty stories.
4. GROWING FES September 2022, one story.
5. GROWING FES December 2022, one story.
6. New Year 2023, seventeen stories.
7. GROWING FES March 2023, one story (`アーティスティックに魅力を見せて`).

The referenced wiki list contains the first six but omits the March 2023 FES entry that is explicitly linked by local table 178. For archive construction, the local explicit relation is stronger evidence than the incomplete public list.

### Three Home Story families outside the Extra gateway

- April Fools 2022: two entries;
- March 2022 Producer Meeting tie-in: one entry;
- April Fools 2023: two entries.

These should be presented as a separate `special_home_story` collection instead of being silently mixed into Extra Story. The 2023 April Fools rows reuse the same two scenario resources as 2022; preserve both campaign records but deduplicate the playback entity.

Table 144 also contains exact limited terms, while table 178 gives long-lived archive visibility for the seven Extra families. This supports both an original-availability label and a permanent archive page.

## Birthday Story

### Raw structure

| Table | Model | Count | Useful fields |
| ---: | --- | ---: | --- |
| 76 | `BirthdayStoryChapterData` | 4 | play-year count, birthday type, cycle name |
| 77 | `BirthdayStorySectionData` | 181 | participant section and character relation |
| 78 | `BirthdayStoryEpisodeData` | 181 | resource, title, character set, optional product group |
| 80 | `BirthdayStoryCharacterSetData` | 181 | story participants |
| 86 | birthday notification data | 78 | idol, birthday label, exact one-day notification term |

Table 79 (`BirthdayStoryProductData`) has no records in this client masterdata, and the episode rows do not claim birthday reading rewards. The archive should not invent a reward badge for these stories.

### Four local cycles

| Cycle | Sections/episodes | Meaning |
| --- | ---: | --- |
| Producer birthday, year 1 | 51 | 49 idol reactions plus two Yamamura Ken entries |
| Idol birthday, year 1 | 50 | 49 idols plus Yamamura Ken |
| Producer birthday, year 2 | 51 | 49 idol reactions plus two Yamamura Ken entries |
| Idol birthday, year 2 | 29 | only the second-cycle birthdays released before service end |

The two Producer-birthday Yamamura entries are distinct: a login-time introduction and a normal follow-up story. This explains why the raw count is 51 rather than 49 or 50.

For Producer birthday year 1, the 49 idol scenarios reproduce the wiki's presentation-mode split:

- 15 normal ADV stories;
- 18 Talk scenes;
- 16 phone calls.

The mode is recoverable from compiled scenario steps (`adv`, `talk`, `call`) and the location/time-of-day can be derived from stage backgrounds. It is not an explicit enum in tables 76-78, so UI metadata must keep a `compiled-derived` source label.

Producer birthday year 2 changes the composition to 27 normal ADV scenes and 22 calls among the 49 idols. It should be a separate year tab, not merged as alternate text under year 1.

### What `Birthday 2021` means

The wiki's 2021 page is a calendar-year slice containing the twelve idol birthdays from game launch through December 2021. It is not equivalent to the local `Idol birthday, year 1` chapter, which spans the complete first play-year cycle and contains all 49 idols plus Yamamura Ken.

Table 86 confirms the calendar distribution of birthday notification windows:

- 2021: 12;
- 2022: 49;
- 2023: 17.

Use `cycle/year_count` for archive tabs and calendar year for filters. Do not infer one from the other.

### Dynamic Producer birthday limits

The wiki states that Producer birthday content is available for one week after the player-configured birthday and that the login introduction is one-time. Those user-relative rules are not encoded as static terms in tables 76-80. They belong to runtime/user-state behavior and should be described as wiki-confirmed game behavior, not reconstructed as a raw masterdata period.

## Valentine And White Day Campaign Stories

### Implementation status

The audit is now materialized as `public/data/masterdata/seasonal_campaign_index.json`. It is generated by `../data_pipeline/masterdata_extract.py --seasonal-campaign-only` and verified by `npm run verify:seasonal`.

The generated index contains four campaign entities, two explicit annual pairings, 306 internal episode rows and 208 normalized playback entities. After extending the compiled filename resolver to recognize split `_a`/`_b` filenames, all 208 playback entities resolve to local compiled JSON.

### Classification

Valentine and White Day are neither normal event stories nor Extra Story. They are seasonal campaign entities with participant-specific communications and progression rules. The archive should use a separate `seasonal_campaign` family while still allowing these scenarios to appear in a global story search.

The masterdata contains two paired cycles:

| Cycle | Valentine event | White Day event |
| --- | --- | --- |
| 2022 | `40001`, detail id 1 | `50001`, detail id 1 |
| 2023 | `40002`, detail id 2 | `50002`, detail id 2 |

Table 112 supplies the official campaign names, campaign periods and BGM. Table 153 explicitly links each White Day record back to the matching Valentine id. This relation is stronger than a date/name heuristic and should drive year pairing.

### Campaign and progression tables

| Table | Model | Count | Useful fields |
| ---: | --- | ---: | --- |
| 146 | `EventValentineData` | 2 | normal/rare chocolate item ids, aggregation and result-announcement terms |
| 147 | `EventValentineIdolData` | 98 | 49 idols per year and their level group |
| 148 | `EventValentineSubCharacterData` | 4 | Yamamura Ken and Saito President per year |
| 149 | `EventValentineLevelData` | 16 | cumulative point thresholds and level rewards |
| 150 | `EventValentineRankingRewardData` | 392 | 49 idols x 4 rank bands x 2 years, with honor ids |
| 153 | `EventWhitedayData` | 2 | White Day to Valentine relation |

For both years, the idol level thresholds are cumulative totals `0, 5, 15, 30, 50, 80`. The Valentine 2023 wiki shows the incremental chocolate costs `5, 10, 15, 20, 30`; these are the deltas between the same cumulative thresholds, not conflicting values.

The support-character level group has only level 1 and level 2, with one chocolate required for level 2. This reproduces the different unlock rule for Yamamura Ken and Saito President.

Table 150 describes ranking reward rules and honor ids. It does not contain historical leaderboard results. Final ranking numbers shown by the wiki remain external curated data and should not be presented as locally recovered masterdata.

### Story tables and counts

| Tables | Family | Raw rows |
| --- | --- | ---: |
| 157-159 | Valentine idol story | 149 |
| 160-162 | Valentine support story | 4 |
| 163-165 | White Day idol story | 149 |
| 166-168 | White Day support story | 4 |

The 306 raw episode rows normalize to 208 distinct playback entities:

| Campaign | Raw episode rows | Distinct playback entities |
| --- | ---: | ---: |
| Valentine 2022 | 101 | 52 |
| Valentine 2023 | 52 | 52 |
| White Day 2022 | 101 | 52 |
| White Day 2023 | 52 | 52 |

Each distinct campaign set consists of one common introduction, 49 idol stories and two support-character stories.

The 2022 idol rows contain two entries per idol at different required Valentine levels. Their `_a` and `_b` resources compile into one aggregate playback file per idol, so a catalog must preserve the two internal titles/requirements while emitting only one top-level playback entity. The 2023 campaign has one story row per idol and therefore does not require this aggregation.

### Valentine 2023 verification

The local relation reproduces the public campaign rules:

- event period comes from table 112 and matches 2023-01-31 through 2023-02-14;
- 49 idols use level group 3 and unlock their story at Valentine level 4;
- Yamamura Ken and Saito President use level group 4 and unlock at level 2;
- each participant story grants `Product.Type = 2`, amount `10`, confirmed by the wiki as 10 Star Gems after reading;
- the 49 x 4 ranking honor rows exist in table 150.

The wiki also documents five chocolate-reaction voice variants per idol. Those reactions are separate from tables 159/162 and are not yet normalized by `seasonal_communication_index.json`. They require a dedicated audio-cue relation audit and must not be counted as story episodes.

### White Day relation

White Day episode rows retain `RequiredValentineLevel`, `IsAlwaysReleased` and participant-specific product ids. This supports a paired year page where Valentine progression evidence and White Day return stories are shown together without pretending White Day is an independent generic event story.

The current seasonal index reports the two 2022 support White Day resources as missing because it looks for an aggregate filename. The actual compiled files exist as:

- `5_02_101_22_5_02_101_22_a.json`
- `5_02_102_22_5_02_102_22_a.json`

This is a resolver false negative, not missing content. The filename resolver should accept split compiled filenames for support-character seasonal stories.

### Archive page direction

1. Add a campaign landing page with 2022/2023 and Valentine/White Day segmented controls.
2. Show the official period, chocolate items, cumulative level track and reward rules on the campaign entity page.
3. Present a unit-grouped 49-idol grid plus a separate staff section for Yamamura Ken and Saito President.
4. Pair each participant's Valentine story with the matching White Day return story.
5. Expand the 2022 aggregate playback entity into its two internal story titles and unlock levels.
6. Keep reaction voices in a separate voice panel after their cue mapping is verified.
7. Label ranking rewards as static rules; do not import wiki leaderboard totals into raw masterdata fields.

## Recommended Generated Indexes

```text
main_story_index
  chapters[]
    raw_label
    compiled_derived_title
    bgm_resource_id
    visible
    sections[]
      title
      open_at
      background_resource_id
      episodes[]
      rewards[]

home_story_index
  campaigns[]
    home_story_chapter_id
    archive_kind: extra | special_home_story
    extra_story_entry_id?
    original_term
    archive_term?
    ui_resource_id?
    sections[]

birthday_story_index
  cycles[]
    birthday_type: producer | idol
    play_year_count
    entries[]
      participant
      calendar_date?
      mode: adv | talk | call
      mode_source: compiled-derived
      resource_id
      character_set

seasonal_campaign_index
  campaigns[]
    year
    season: valentine | white_day
    event_code
    paired_campaign_id
    term
    level_groups[]
    ranking_reward_rules[]
    participants[]
      participant_type: idol | support
      participant_id
      episodes[]
        internal_title
        required_level
        resource_id
        playback_entity_id
        rewards[]
```

## UI Direction

1. Give main story a chapter landing page with its recovered long title, formal section timeline, implementation dates and episode/reward expansion.
2. Build Extra Story from table 178, not every table 143 row. Give the three excluded Home Story campaigns their own special collection.
3. Add `year 1 / year 2` tabs to birthday pages and a separate calendar filter.
4. On Producer birthday pages, group by `Story / Talk / Call`, then show location and time-of-day derived from the compiled stage state.
5. Give Valentine and White Day a paired seasonal campaign page instead of mixing them into Event Story or Extra Story.
6. Preserve evidence labels in generated JSON so raw, compiled-derived and wiki-confirmed fields remain distinguishable.

The next data task should be a dedicated multi-family story index rather than more UI heuristics on top of the flattened generic catalog.
