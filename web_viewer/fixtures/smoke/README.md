# Smoke Fixtures

Smoke 测试用最小 fixture 集，覆盖 SpineStage 核心显示状态机。

## 使用方式

```js
// 在测试/调试中加载 fixture
const scenario = await fetch('/fixtures/smoke/scenarios/smoke_01_single_spine.json').then(r => r.json())
```

## 目录结构

```
fixtures/smoke/
├─ README.md                   本文件
├─ manifest.smoke.json         所有 smoke 样例索引
├─ scenarios/                  场景数据 (step JSON)
├─ expected/                   预期断言 (assertion JSON)
└─ assets/                     占位资源目录
```

## 角色约定

smoke 只需 3 类角色(无需 49 人全覆盖)：

| 类型 | ID | 用途 |
|------|-----|------|
| 稳定普通模型 | `016sei` | 常规 spawn / face / anim |
| 多人同屏模型 | `011min` | priority / bringToFront |
| 故意缺失模型 | `999test` | silhouette / fallback |
