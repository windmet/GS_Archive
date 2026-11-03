# 许可评议（2026-11-03）

仓库是公开的，但在这之前没有 LICENSE 文件。本文记录：仓库里的东西各归谁、各适用什么许可、Spine 运行库要做什么。
这是项目内部的整理，不是法律意见；有商业合作或收到权利方联系时，以专业意见为准。

## 1. 仓库里有四类东西

| 类别 | 例子 | 归谁 | 处理 |
|---|---|---|---|
| 项目自己写的代码和文档 | `src`、`scripts`、`readmodels`、`data_pipeline`、`docs` | 站长 | **MIT**（根目录 `LICENSE`） |
| 游戏内容及其生成物 | masterdata 生成的 JSON、受跟踪的游戏 PNG、compiled 剧情、媒体 | BANDAI NAMCO Entertainment Inc. 等权利方 | 不授予任何权利；LICENSE 开头写明排除 |
| 同人译文 | `translation/`、`public/translations/` | 译文是游戏文本的演绎作品；站长只对自己的翻译劳动有权利，原文权利仍属权利方 | **不套开源或 CC 许可**；沿用关于页的「转载译文请注明出处」 |
| 第三方组件 | Spine Runtimes、PixiJS、Vue、Lucide、Barlow 字体 | 各自作者 | 按各自许可；全文见 `web_viewer/THIRD_PARTY_NOTICES.txt` |

## 2. 为什么代码用 MIT

- 目的是让别人能看、能学、能做类似的资料站。MIT 最短，限制最少，和主要依赖（PixiJS、Vue 是 MIT，Lucide 是 ISC）一致。
- 考虑过 AGPL-3.0（要求改版网站公开源码）：对一个人维护的同人项目，执行成本高、劝退贡献者，收益很小，所以不选。
- 不用担心「别人拿代码去做商业站」：代码可以自由用，但游戏素材本来就不在许可范围里，MIT 不会让任何人因此获得素材的权利。
- 没有许可证的公开仓库，在法律上默认保留所有权利：别人连 fork 后修改都没有明确授权。加 MIT 是把现状说清楚。

## 3. 为什么译文不套 CC

CC BY-NC-SA 在同人翻译里很常见，但它的效力是「授予许可人自己拥有的权利」。译文是演绎作品，原文权利不在我们手上；
套 CC 容易让人以为可以按 CC 自由转载整段剧情。维持现状更准确：转载注明出处，以原权利方的立场为准。

## 4. Spine 运行库（需要处理）

网页里打包了 `@pixi-spine/runtime-3.8`（及 `@pixi-spine/base`）。它们是 Spine Runtimes 的移植，npm 包的 license 字段是 `SEE SPINE-LICENSE`，
对应 pixijs/spine 仓库的 Spine Runtimes License Agreement（2020-01-01 版，全文已收进 `THIRD_PARTY_NOTICES.txt`）。条款有两项要求：

1. **整合运行库的人要有自己的 Spine Editor 许可**：「each user of the Products must obtain their own Spine Editor license」。
   官方销售页说明，Spine 许可同时授权在你的游戏和应用里使用运行库；论坛的官方回复也说，即使不打算用编辑器、只是播放导出的动画，也需要许可。
   这一条没有免费或非商业的例外（教育版只给认证教育机构）。
   - **站长需要买一份 Spine Essential**（当前售价 69 美元，原价 99 美元，一次性买断，按个人）。Essential 就够了；年收入 50 万美元以上才要 Enterprise。
   - **网站访客不需要**：他们是成品的使用者，不是整合运行库的人。
   - **fork 仓库自己部署的人需要各自的许可**：已写进 LICENSE 开头和第三方声明。
2. **再分发时要附上许可文本和版权声明**：部署的网页 JS 里含运行库代码，但打包时源码头部的许可注释会被去掉，
   而且 npm 包本身没有附带许可文件。
   - **已处理**：`web_viewer/THIRD_PARTY_NOTICES.txt` 收录了全文；关于页「开源组件」一节链接到它，构建时它作为资源随页面发布（`_app/THIRD_PARTY_NOTICES-<hash>.txt`）。

另外：游戏里的 Spine 骨骼和贴图是游戏素材，权利属于权利方，和运行库许可是两回事；买 Spine 许可不会让我们获得这些素材的任何权利。

替代方案：完全不用运行库，就只能把动画预先录成视频或序列帧，剧情播放器、小人舞台、摄影工作台都做不了，所以不考虑。

## 5. 待办

- [ ] 站长购买 Spine Essential 许可（以个人名义），购买记录自己留存，不进仓库。
- [ ] 确认根目录 `LICENSE`（MIT + 排除范围）后合并。
- [ ] 以后新增前端依赖时，把它的许可文本补进 `THIRD_PARTY_NOTICES.txt`。

## 出处

- Spine Runtimes License Agreement：https://github.com/pixijs/spine （`SPINE-LICENSE`）；3.8 分支原文 https://github.com/EsotericSoftware/spine-runtimes/blob/3.8/LICENSE
- Spine Editor License Agreement：http://esotericsoftware.com/spine-editor-license
- 价格与许可说明：https://esotericsoftware.com/spine-purchase
- 官方论坛的许可答复：https://esotericsoftware.com/forum/d/10301 、https://es.esotericsoftware.com/forum/d/10079-licence-questions
