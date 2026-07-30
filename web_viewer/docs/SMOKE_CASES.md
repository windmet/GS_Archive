# SMOKE_CASES

状态：人工兼容样例目录，不是自动化 Story Runtime 门禁。

本文件定义 SpineStage 的固定 smoke 样例，覆盖核心显示状态机而非全量资源。
`npm run smoke` 当前只执行 production build；自动化 Runtime owner/lifecycle
验证使用 `npm run verify:story-runtime-foundation`。

样例中的 legacy `step.state` 只描述输入兼容形态。Screen、Background、
Camera 和 SE transition 必须先由 `ScenarioNormalizer` 归一化，再由
`useStoryRuntimeCues` 调度；`SpineStage` 与 `applyStepSceneState` 不拥有这些
transition channel。

## 样例清单

| ID | 名称 | 覆盖场景 |
|----|------|---------|
| 01 | 单人立绘 | 背景、spawn、face、anim、默认位置 |
| 02 | 双人同屏 priority | z-order / idol_priority |
| 03 | 同模型更新 | 不重生 spine，只更新 face/anim/pos |
| 04 | 换模型 | 旧 spine 删除，新 model spawn |
| 05 | 角色退场 | desired spines 为空时清除旧角色 |
| 06 | 背景切换 | 不同 step 间 bg 切换 |
| 07 | fallback background | step 无 bg 时使用 fallback |
| 08 | 缺失 spine fallback | silhouette 显示，场景不崩溃 |
| 09 | scene icon | icon 图片显示 |
| 10 | slide/fade | 画面过渡效果 |

---

## Smoke 01 — 单人立绘

验证：背景 + 单人 spawn + 默认 face/anim + 中心位置

```json
{
  "id": "smoke_01_single_spine",
  "step": {
    "chara_id": "016sei",
    "state": {
      "bg": "smoke_bg_day",
      "spines": [{
        "id": "016sei",
        "model": "016sei_005_00",
        "face": "face_default",
        "anim": "wait_loop",
        "pos_x": 0, "pos_y": 0,
        "idol_priority": 0,
        "parts_visible": true
      }]
    }
  }
}
```

## Smoke 02 — 双人同屏 priority

验证：双人同时显示 + z-order 按 idol_priority

```json
{
  "id": "smoke_02_two_spines_priority",
  "step": {
    "chara_id": "016sei",
    "state": {
      "bg": "smoke_bg_day",
      "spines": [
        {
          "id": "016sei",
          "model": "016sei_005_00",
          "face": "face_default",
          "anim": "wait_loop",
          "pos_x": 220, "pos_y": 0,
          "idol_priority": 2
        },
        {
          "id": "011min",
          "model": "011min_005_00",
          "face": "face_default",
          "anim": "wait_loop",
          "pos_x": -220, "pos_y": 0,
          "idol_priority": 1
        }
      ]
    }
  }
}
```

## Smoke 03 — 同模型更新

验证：模型不变时只更新 face/anim/pos，不重新生成 spine

```json
{
  "id": "smoke_03_same_model_update",
  "steps": [
    {
      "chara_id": "016sei",
      "state": {
        "bg": "smoke_bg_day",
        "spines": [{
          "id": "016sei",
          "model": "016sei_005_00",
          "face": "face_default",
          "anim": "wait_loop",
          "pos_x": 0, "pos_y": 0
        }]
      }
    },
    {
      "chara_id": "016sei",
      "state": {
        "bg": "smoke_bg_day",
        "spines": [{
          "id": "016sei",
          "model": "016sei_005_00",
          "face": "face_smile",
          "anim": "talk_loop",
          "pos_x": 80, "pos_y": 0
        }]
      }
    }
  ]
}
```

## Smoke 04 — 换模型

验证：不同 model 时旧 spine 被删除 + 新 spine 生成

```json
{
  "id": "smoke_04_model_replace",
  "steps": [
    {
      "chara_id": "016sei",
      "state": {
        "bg": "smoke_bg_day",
        "spines": [{
          "id": "016sei",
          "model": "016sei_005_00",
          "face": "face_default",
          "anim": "wait_loop"
        }]
      }
    },
    {
      "chara_id": "016sei",
      "state": {
        "bg": "smoke_bg_day",
        "spines": [{
          "id": "016sei",
          "model": "016sei_101_00",
          "face": "face_default",
          "anim": "wait_loop"
        }]
      }
    }
  ]
}
```

## Smoke 05 — 角色退场

验证：spines 数组为空或目标角色不在内时，清理旧 spine

```json
{
  "id": "smoke_05_remove_spine",
  "steps": [
    {
      "chara_id": "016sei",
      "state": {
        "bg": "smoke_bg_day",
        "spines": [{
          "id": "016sei",
          "model": "016sei_005_00",
          "face": "face_default",
          "anim": "wait_loop"
        }]
      }
    },
    {
      "chara_id": "",
      "state": {
        "bg": "smoke_bg_day",
        "spines": []
      }
    }
  ]
}
```

## Smoke 06 — 背景切换

验证：不同 step 之间 bg 切换

```json
{
  "id": "smoke_06_background_switch",
  "steps": [
    {
      "chara_id": "",
      "state": { "bg": "smoke_bg_day" }
    },
    {
      "chara_id": "",
      "state": { "bg": "smoke_bg_night" }
    }
  ]
}
```

## Smoke 07 — Fallback background

验证：step 不含 bg 时，fallbackBg 生效

```json
{
  "id": "smoke_07_fallback_background",
  "step": {
    "chara_id": "",
    "state": { "bg": null },
    "fallbackBg": "smoke_bg_fallback"
  }
}
```

## Smoke 08 — 缺失 spine fallback

验证：spine 资源不存在时显示 silhouette，场景不崩溃

```json
{
  "id": "smoke_08_missing_spine_silhouette",
  "step": {
    "chara_id": "999test",
    "state": {
      "bg": "smoke_bg_day",
      "spines": [{
        "id": "999test",
        "model": "999test_missing_00",
        "face": "face_default",
        "anim": "wait_loop",
        "pos_x": 0, "pos_y": 0
      }]
    }
  }
}
```

## Smoke 09 — Scene icon

验证：scene icon 图片显示

```json
{
  "id": "smoke_09_scene_icon",
  "step": {
    "chara_id": "",
    "state": {
      "bg": "smoke_bg_day",
      "image_icon": "smoke_test_icon"
    }
  }
}
```

## Smoke 10 — Screen slide / fade

验证：legacy `state.screen_slide` 经 ScenarioNormalizer 归一化为
`screen.directional_wipe` cue 后，画面过渡效果正常。不要把此样例直接传给
`applyStepSceneState` 并期待它播放 transition。

```json
{
  "id": "smoke_10_screen_slide",
  "step": {
    "chara_id": "",
    "state": {
      "bg": "smoke_bg_day",
      "screen_slide": {
        "type": "wipe",
        "color": "#000000",
        "duration": 0.5,
        "delay": 0,
        "direction": "6"
      }
    }
  }
}
```
