# UI Quality Master Ledger

基线：master `c5efb7a0`；首次审计提交 `441780f9`；2026-10-30 A0 维护。未修复正式 UI，未部署。

状态枚举：UNREVIEWED / FOUND / REPRODUCED / NEEDS_CONFIRMATION / FIX_PENDING / FIXING / REGRESSION_PENDING / RESOLVED / NOT_APPLICABLE。

| ID | 级别 | 页面 / 组件 | 视口 / 交互状态 | 状态 | 证据与代码定位 | 根因与后续批次 |
|---|---|---|---|---|---|---|
| RR-01 | P1 | `/events/410001/` / ArchiveShell | 320×720；默认中文，冷进入 | REPRODUCED | [实际截图](E:/Web_build/SideM_Archived/web_viewer/.analysis/responsive-audit-20261030/exact/320x720-event-long.png)；`src/components/archive/ArchiveShell.vue:498,599,603`；标题 x53.99–292.18、语言控件 x261.36–310.46 | flex column 的子标题宽度未限定在 Grid 列，省略规则未有效收缩；A1 公共外壳审计，修复另行授权 |
| RR-02 | P2 | `/studio/edit/` / PictureStudio | 320×720；未选择图层 | REPRODUCED | [实际截图](E:/Web_build/SideM_Archived/web_viewer/.analysis/responsive-audit-20261030/complex/320x720-studio-edit.png)；`src/styles/picture-studio.css:104–113`、`src/components/archive/PictureStudio.vue:118` | 固定操作按钮占满宽度后说明列过窄，small 多行超出固定高；建议 A4 复杂工具审计，不把候选自动晋升为修复通过 |
| RR-03 | P3 | `/studio/edit/` / 摄影搜索输入 | 320×720；搜索聚焦 | NEEDS_CONFIRMATION | 初始 Browser 计算字号13px；`src/styles/picture-studio.css:27,67,189`；参见[原报告](RESPONSIVE_RELIABILITY_AUDIT_20261030.md) | iOS 输入聚焦缩放风险；字号已观测，真实缩放未复现。A5 真机审计；不可标记为已确认 iOS 缺陷 |

这些 REPRODUCED 状态引用同一未变化主干上的首次 Browser 证据，不表示 A0 对正式 UI 做了修复或完整回归。A1–A5 的分配是本轮建议，后续可按正式批次定义调整。
