# DO_NOT_REOPEN

本文件记录已经收束或暂时冻结的问题。除非用户明确要求，不要重新展开这些方向。

## 1. Y 轴定位旧探索

当前本地版本已经解决主要 Y 轴定位问题。
不要基于旧记忆重新建议：

* 重新推翻当前 Y 轴方案
* 重新比较大量 `yMode`
* 重新引入复杂 pivot/bounds 实验
* 重新展开早期 `rootOffsetBlend` / `baselineVisualBottom` 的争论

如果本次任务不是定位 bug，不要主动分析 Y 轴问题。

## 2. Debug 面板减重

当前 debug 面板已经经过减重。
除非用户明确要求，不要建议恢复大量历史 debug 字段。

允许建议：

* 把 debug 面板拆成独立组件
* 把 debug URL 参数读取拆成 config
* 把 dump 函数收进 composable

不建议：

* 继续新增大批 UI 字段
* 重新加入旧版 bounds/pivot 实验显示
* 把 debug 面板当成主要业务逻辑重写

## 3. 粒子效果

纯前端不接 Unity 原始粒子系统时，不追求完美复刻。
不要反复建议继续复刻 Unity 粒子，除非用户明确重启该方向。

默认策略：

* 可禁用
* 可静态 fallback
* 可简化为 Pixi 层效果

## 4. Raw 资产全量扫描

不要默认扫描 raw 资产全目录。
资源相关任务优先查看：

* manifest
* generated index
* fixture
* 用户明确指定的文件

## 5. 大重构

当前工程处于稳定排查期。
默认不建议大规模重构。
所有修改应满足：

* 小步
* 可回滚
* 可 smoke test
* 不改无关模块
* 不破坏当前稳定行为
