# 深链接 Browser 验收清单（批次 F 之前的基线）

目的：确认已合并的导航上下文、返回决策、locator parent 兜底在真实环境里的行为，作为 Reader URL 瘦身前的基线。
`<host>` 为被测环境。每条记录：实际落点 URL、是否通过、异常截图。

通用检查（每条都看）：
- 地址栏里不应出现 `from=`、`portal_from=`、`home_from=`。
- 控制台无未捕获错误。
- 返回落点后页面内容已加载，不是空白或加载中。

## A. 来源上下文（history.state）
| # | 起点 | 操作 | 期望 |
|---|------|------|------|
| A1 | `<host>/?view=portal` | 进入任一偶像页，再点页面内返回 | 回到 Portal，搜索和范围保留 |
| A2 | `<host>/?view=home` | 通过 Home 进入某偶像/卡片/活动，再返回 | 回到 Home，选中的偶像、cue、costume 不变 |
| A3 | 在 A1 的偶像页 | 按 F5 刷新，再点返回 | 仍回到 Portal（来源经刷新保留） |
| A4 | 在 A2 的目标页 | 按 F5 刷新，再点返回 | 仍回到 Home |
| A5 | 同一标签页 | 进入详情后用浏览器后退，再前进 | 前进后页面与来源一致 |

## B. Reader 返回
| # | 起点 | 操作 | 期望 |
|---|------|------|------|
| B1 | 活动详情页（如 `?view=event_detail&event=410001`） | 打开其中一话进 Reader，点返回 | 回到该活动详情 |
| B2 | 在 B1 的 Reader | 刷新后点返回 | 回到该活动详情 |
| B3 | 在 B1 的 Reader | 复制地址栏，新标签粘贴打开，点返回 | 回到活动详情，不是故事目录 |
| B4 | 合集页（main/unit/birthday/extra 各一） | 进 Reader，返回 | 回到对应合集和章节 |
| B5 | 偶像故事页 | 进 Reader，新标签粘贴打开，返回 | 回到偶像故事页同一章节 |
| B6 | Work 页（stories 与 lines 各一） | 进 Reader，新标签粘贴打开，返回 | 回到 Work 页，模式正确 |
| B7 | 季节活动（valentine 等） | 进 Reader，新标签粘贴打开，返回 | 回到该 campaign，偶像正确 |
| B8 | 复刻活动里的一话（reprint） | 进 Reader，新标签粘贴打开，返回 | 回到首次上线的活动，不是 `event:` 前缀的复刻页 |
| B9 | 卡片剧情 | 进 Reader，新标签粘贴打开，返回 | 回到对应故事详情 |

## C. Reader 到 Player
| # | 起点 | 操作 | 期望 |
|---|------|------|------|
| C1 | 任一 Reader | 点播放进入 Player，再点返回 | 回到该 Reader，位置不丢 |
| C2 | C1 的 Player | 刷新，再点返回 | 回到 Reader |
| C3 | C1 的 Player | 复制链接，新标签打开，返回 | 回到 Reader 或其父页，不白屏 |

## D. 地址栏瘦身
| # | 起点 | 操作 | 期望 |
|---|------|------|------|
| D1 | `<host>/?view=about` 附加一串无关参数，如 `&event=1&q=x&card=2` | 回车加载，再点页内任一链接后返回 | about 的地址栏被清成只有 `view=about` |
| D2 | `archive_status`、`live`、`studio`、`unit_catalog`、`welcome` | 同 D1 | 同样不残留无关参数 |
| D3 | 旧链接：带 `?from=...`、`?portal_from=...`、`?home_from=...` 的 URL | 直接打开 | 页面正常，返回仍按来源落点；之后地址栏不再含这些参数 |

## 失败时请附
- 起点 URL、操作步骤、实际落点 URL。
- 是否为新标签或刷新后出现。
- 控制台报错（如有）。

## 修订（2026-10-12 首轮验收后）
- B5：首轮失败，已由 `c4b0913f` 修复，需复测。
- B8：期望改为“返回复刻活动（URL 里的 event 身份优先），不是首次上线活动”。
- B9：Reader 入口改为故事目录里 `card_scenarios` 的卡片剧情条目；卡片详情的电话/聊天直接进 Player，不属于 Reader。
- 环境：测试前确认本地服务的 release 与 `readmodels/bootstrap.inline.json` 一致（`999b2c90…`，含 locator parent）。

## E. 批次 F：event Reader 的地址栏瘦身
| # | 起点 | 操作 | 期望 |
|---|------|------|------|
| E1 | 从单位页（unit_detail）进入某活动，再进 Reader | 看地址栏 | 只有 `reading`、`event` 等身份字段，没有 `parent`、`category`、`unit` |
| E2 | 在 E1 的 Reader | 点返回 | 回到该活动，且活动页的“返回”仍回到单位页 |
| E3 | 在 E1 的 Reader | 刷新，点返回 | 同 E2 |
| E4 | 复制 E1 的地址到新标签，点返回 | | 回到该活动；其“返回”回活动目录（不带原来源，属预期） |
| E5 | 旧链接 `?view=reader&reading=...&event=...&parent=unit_detail&category=idol&unit=01jup` | 直接打开，点返回 | 回到活动，来源仍是单位页；地址栏随后不再含这三个参数 |
| E6 | 非活动 Reader（main/unit/work/seasonal/idol_story） | 看地址栏与返回 | 与批次 F 前一致 |
