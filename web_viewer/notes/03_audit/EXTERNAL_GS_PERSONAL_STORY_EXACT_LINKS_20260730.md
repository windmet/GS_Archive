# GS Personal Story Exact External Links — 2026-07-30

Status: implemented on `codex/external-story-links-personal`

## Scope

This batch audits four GS-only personal-story candidates from Bilibili favorite
folder `3689692756`. It does not change the publication ledger, mirror video
media, or claim Story Runtime release acceptance.

## Accepted exact mappings

| BVID | Uploader | Internal section | Boundary |
| --- | --- | --- | --- |
| `BV1ZM411S7bV` | 死扛桑 (`8798195`) | 大河タケル `23801`, `1_2_038_01_a`–`e` | single video: first `a` dialogue and final `e` dialogue match |
| `BV1HPKDz5E2u` | 叶絵理奈 (`16493529`) | 円城寺道流 `23901`, `1_2_039_01_a`–`e` | parts `1.1`–`1.5`: every part opening and final dialogue match |
| `BV113KfzrEHj` | 叶絵理奈 (`16493529`) | 牙崎漣 `24001`, `1_2_040_01_a`–`e` | parts `1.1`–`1.5`: every part opening and final dialogue match |

The verifier requires every `exact-idol-story` record to:

- carry no event or collection ID;
- reference existing `idol_episode_index` episode resource IDs;
- stay within one idol and one section;
- cover the section's complete episode boundary;
- use `complete-story` coverage.

## Boundary evidence

All accepted audit copies decoded to completion with ffmpeg before visual
comparison. The comparisons used the original Japanese dialogue rendered in
the video and the tracked compiled JSON under `public/data/compiled`.

### 円城寺道流

The five final frames respectively match:

1. `すぐに見つかるといいんだが……。`
2. `迷子の小鳥を探してるんです。`
3. `それなら、こういう方法はどうでしょうか。`
4. `自分も、めげずに捜索を続けるッスよ！`
5. `いつでも自分を頼ってくださいね、……師匠！`

Their openings also follow local episodes `a` through `e` in order.

### 牙崎漣

The five openings match local episodes `a` through `e`: sleeping, fixing hair
and clothes, choosing breakfast, the award ceremony, and the taiyaki handoff.
The five final frames match the corresponding local final dialogue, including
the producer apology, the producer chasing 漣, `フン、当然だろ`, the crowd
leaving, and the final `世界中に知れ渡るな！` line.

### 大河タケル 第1話

The opening matches `1_2_038_01_a`:

```text
お疲れさまです、タケルさん。
お待たせしてしまいましたか？
```

The final rendered dialogue matches `1_2_038_01_e`:

```text
だから、待っていてくれ。
俺も必ずお前たちを見つけ出してみせる
```

## Deferred candidate

`BV1Na4y1S7R7` (`大河武个人剧情 第2话`) remains unregistered. The local
section `23802` contains three small-talk resources plus five main episode
resources. The temporary media copy did not pass full decode, so this batch
does not infer whether the video covers all eight resources or only the five
main episodes.

## UI behavior

The dedicated `external_story_resources` view now resolves accepted personal
stories through `idol_episode_index`, uses the tracked local idol icon, and
opens `idol_story_archive` for the correct idol. The corresponding personal
story section also displays the safe canonical Bilibili link and uploader
attribution.

No remote cover, avatar, subtitle, or video file is stored in the archive.

## Validation

```text
verify:external-story-resources:
8 GS records / 8 exact mappings / 8 unique BVIDs

verify:external-story-resource-ui:
PASS

verify:idol-story-interface:
49 idols / 491 of 491 playable segments / 29 after-story links

verify:routes:
PASS

verify:home:
PASS

vite build:
PASS in 1m35s
```

Fresh browser checks on port 5174:

- direct `?view=external_story_resources` renders 8 exact resources;
- 円城寺道流's internal action opens
  `?view=idol_story_archive&idol=039mcr&story_type=idol_story`;
- section `23901` renders the canonical `BV1HPKDz5E2u` external link with
  `_blank` and `noopener noreferrer external`;
- a 390 × 844 viewport renders 8 cards in one grid column with no horizontal
  overflow.

The browser console still reports the pre-existing missing ignored
`raw_character_image_promotions.json` mount. No external-story or personal-story
runtime error was observed.
