# Main, Extra And Birthday Story Masterdata Audit

Last checked: 2026-07-15

Reference pages:

- `https://wikiwiki.jp/sidem-gstars/メインストーリー`
- `https://wikiwiki.jp/sidem-gstars/エクストラストーリー`
- `https://wikiwiki.jp/sidem-gstars/誕生日2021`
- `https://wikiwiki.jp/sidem-gstars/誕生日：プロデューサー(プレイヤー)`

## Conclusion

The local decoded masterdata and compiled scenarios are sufficient to build independent archive pages for the main story, Extra Story, idol birthdays and Producer birthdays. All 432 referenced scenario resources in these families are present locally:

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
```

## UI Direction

1. Give main story a chapter landing page with its recovered long title, formal section timeline, implementation dates and episode/reward expansion.
2. Build Extra Story from table 178, not every table 143 row. Give the three excluded Home Story campaigns their own special collection.
3. Add `year 1 / year 2` tabs to birthday pages and a separate calendar filter.
4. On Producer birthday pages, group by `Story / Talk / Call`, then show location and time-of-day derived from the compiled stage state.
5. Preserve evidence labels in generated JSON so raw, compiled-derived and wiki-confirmed fields remain distinguishable.

The next data task should be a dedicated multi-family story index rather than more UI heuristics on top of the flattened generic catalog.
