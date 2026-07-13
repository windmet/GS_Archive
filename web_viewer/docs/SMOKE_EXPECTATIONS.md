# SMOKE_EXPECTATIONS

每个 smoke case 的预期行为和断言。

## Smoke 01 — 单人立绘

```json
{
  "caseId": "smoke_01_single_spine",
  "assertions": [
    { "type": "background-visible", "expected": true },
    { "type": "spine-count", "expected": 1 },
    { "type": "visible-spines", "expected": ["016sei"] },
    { "type": "front-spine", "expected": "016sei" },
    { "type": "no-console-error", "expected": true }
  ],
  "manualCheck": [
    "背景正常显示",
    "角色显示在屏幕中央",
    "默认 face/anim 生效",
    "debug 面板关闭时不影响舞台"
  ]
}
```

## Smoke 02 — 双人同屏 priority

```json
{
  "caseId": "smoke_02_two_spines_priority",
  "assertions": [
    { "type": "spine-count", "expected": 2 },
    { "type": "visible-spines", "expected": ["016sei", "011min"] },
    { "type": "background-visible", "expected": true },
    { "type": "no-console-error", "expected": true }
  ],
  "manualCheck": [
    "两名角色均显示在正确位置",
    "idol_priority 高的角色在前面",
    "背景没有闪烁为空"
  ]
}
```

## Smoke 03 — 同模型更新

```json
{
  "caseId": "smoke_03_same_model_update",
  "assertions": [
    { "type": "model-changed", "expected": false },
    { "type": "spine-recreated", "expected": false },
    { "type": "face-updated", "expected": true },
    { "type": "anim-updated", "expected": true },
    { "type": "position-updated", "expected": true },
    { "type": "no-console-error", "expected": true }
  ],
  "manualCheck": [
    "角色没有闪烁重生（无销毁重建过程）",
    "表情从 default 变为 smile",
    "动画从 wait_loop 变为 talk_loop",
    "角色位置平移"
  ]
}
```

## Smoke 04 — 换模型

```json
{
  "caseId": "smoke_04_model_replace",
  "assertions": [
    { "type": "model-changed", "expected": true },
    { "type": "old-model-removed", "expected": true },
    { "type": "new-model-spawned", "expected": true },
    { "type": "no-console-error", "expected": true }
  ],
  "manualCheck": [
    "旧模型完全消失（无残留纹理）",
    "新模型正常显示",
    "中间无闪烁空档期过长"
  ]
}
```

## Smoke 05 — 角色退场

```json
{
  "caseId": "smoke_05_remove_spine",
  "assertions": [
    { "type": "final-spine-count", "expected": 0 },
    { "type": "old-spines-removed", "expected": true },
    { "type": "background-still-visible", "expected": true },
    { "type": "no-console-error", "expected": true }
  ],
  "manualCheck": [
    "旧角色完全消失",
    "背景仍然显示（画面不卡死）",
    "无内存泄漏提示"
  ]
}
```

## Smoke 06 — 背景切换

```json
{
  "caseId": "smoke_06_background_switch",
  "assertions": [
    { "type": "background-visible", "expected": true },
    { "type": "no-console-error", "expected": true }
  ],
  "manualCheck": [
    "背景从 day → night 变化",
    "切换过程平滑（有 transition 时可见过渡）",
    "无黑色空窗期"
  ]
}
```

## Smoke 07 — Fallback background

```json
{
  "caseId": "smoke_07_fallback_background",
  "assertions": [
    { "type": "background-visible", "expected": true },
    { "type": "no-console-error", "expected": true }
  ],
  "manualCheck": [
    "尽管 step.bg 为 null，背景仍显示 fallback",
    "控制台无 'missing background' 类型错误"
  ]
}
```

## Smoke 08 — 缺失 spine fallback

```json
{
  "caseId": "smoke_08_missing_spine_silhouette",
  "assertions": [
    { "type": "spine-asset-missing", "expected": true },
    { "type": "silhouette-shown", "expected": true },
    { "type": "scene-still-usable", "expected": true },
    { "type": "no-fatal-error", "expected": true }
  ],
  "manualCheck": [
    "没有 spine 时显示 silhouette 占位",
    "场景不崩溃（不白屏、不卡死）",
    "debug 面板可正常打开"
  ]
}
```

## Smoke 09 — Scene icon

```json
{
  "caseId": "smoke_09_scene_icon",
  "assertions": [
    { "type": "icon-visible", "expected": true },
    { "type": "no-console-error", "expected": true }
  ],
  "manualCheck": [
    "icon 图片在舞台中显示",
    "icon 位置正确"
  ]
}
```

## Smoke 10 — Screen slide / fade

```json
{
  "caseId": "smoke_10_screen_slide",
  "assertions": [
    { "type": "no-console-error", "expected": true }
  ],
  "manualCheck": [
    "过渡效果可见（wipe/slide）",
    "过渡结束后正常显示下一画面",
    "过渡参数（duration/delay）和预期一致"
  ]
}
```
