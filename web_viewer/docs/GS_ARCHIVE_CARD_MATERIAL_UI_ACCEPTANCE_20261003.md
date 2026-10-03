# 卡片衣装与突破材料界面验收

输入 HEAD：`73098c9e`，分支 `codex/chibi-stage-reconstruction-20261002`。本批接续已提交的数据生产器，只提交卡片/藏品消费者及其导航，不包含另一个窗口的舞台灯光工作。

| Before | After | Why |
| --- | --- | --- |
| 星座元素和设定正文同一字阶 | 源数据首行单独保留为 12px 次级设定信息 | 保留语义边界，降低标题抢视线 |
| 手机沿用原文排版折行 | 手机自然排版正文，宽屏保留作者折行 | 窄屏减少碎行，不修改源文或译文 |
| 突破素材只有文字 | 正式物品名称、贴图、可点击资料入口 | 卡片素材配置与物品实体联动 |
| 物品详情没有卡片逆查 | 原始配置对应的卡面缩略图与卡片导航 | 从用途返回实际卡片 |

葛之叶雨彦中文已有引语段，日文源文没有该引语；牙崎涟为连续设定正文。两者按各自已有段落处理，不推断翻译缺句、不补写日文。340 个实际衣装分组均采用相同原则；六个明确源数据首行被识别为设定信息，其余正文不凭短句猜标题。

突破材料只使用 Cards table 1 field 23 到 Items table 16 的明确关联。657 张有配置，169 张为空；空配置不制造未知道具。五种材料逆向计数为 49、85、399、112、12。反查是使用用途，不声明获得途径或解锁条件。

## 验证

- `node --experimental-vm-modules scripts/verify-card-costume-presentation.mjs`：340 分组、中日设定/引语差异、既有卡面语音规则、五个实际材料绑定、缺图/过期上下文/169 空字段通过。首次省略 VM 参数的命令报错；按测试所需 Node VM 参数重跑通过。
- `verify-card-readmodel-navigation.mjs`、`verify-collection-readmodel-navigation.mjs`、`verify-archive-relation-navigation.mjs`：通过，覆盖竞态/重试/16 条导航及刷新链。
- `npm run build:check`：通过，`copyPublicDir:false`，唯一输出 `.analysis/build-check`，14.42 秒。日志 `.analysis/ui-chibi-panel-20261003/build-check.log`。
- Browser 使用 RAM 固定的生产代码 bundle，`127.0.0.1:5204`，根 HTML SHA256 `1cc7e26a4654a6e4e29dc49cd926506a6aa710a3cd18eab8aad8be11989af9d9`。卡片组件 JS SHA256 `e29fd9a6b00972d7718af16bd211fec00e7d6524431b28fc0b60c034d93f40ed`。静态媒体从当前 checkout public 映射，资料使用下述本地候选。
- 实际 320×740 牙崎涟 CN/JA：标题保留独立行、正文自然排版，页面宽度和滚动宽度均 320；1920×900 宽屏保留既有折行。另实际窄窗 319×515 检查葛之叶雨彦中文设定与引语分段。
- 实际图片导航：`044ame_ssr02` → `item:10505` → 点击 `040ren_ssr03` 缩略图 → 对应卡片 → 返回物品详情；返回焦点落在原卡片行。12 个反查缩略图均解码为 148px 宽。截图在 `.analysis/ui-card-materials-20261003/`。

## 数据与发布边界

候选资料目录：`E:/Web_build/GS_Archive_Domain_Work/card-material-preview-readmodels-20261003`，release `0b0612426eeb7090b52aacc59a09fd6c580646827a5e5a194cf0e9c9d3b44c0b`。生产投影 API 的受保护本地 source snapshot QA，8751 个 JSON 文件、77,220,500 解码字节，完整 artifact 校验通过。它没有复制媒体，也没有发布到 R2。

仓库 `readmodels/bootstrap.inline.json` 保留既有正式 release；5204 的本地验收服务通过明确 `--preview-bootstrap` 将候选 bootstrap 注入所服务的 HTML，并验证 legacy/偶像目录一致。旧数据无这些可选字段时消费者仍可运行。5198 及其他窗口服务未停用。本记录不表示线上数据已切换、不表示完整部署包或实体手机验收。
