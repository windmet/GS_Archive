# Source Gate 通信剧情测试输入修复

输入 HEAD：717bce98。GitHub [Source Gate 37070173508](https://github.com/windmet/GS_Archive/actions/runs/37070173508) 在 Verify localization runtime 失败：通信 SFC 回归导入未跟踪的 `public/data/compiled/001tom_301_2_3_001_01_09_b.json`，干净检出无此文件。此前步骤通过，但后续 Penlight 回归未执行，不能记录成完整门禁通过。

将这一份 19,082 B 实际 compiled 剧情完整原字节保存到 `fixtures/localization/communication-001tom-compiled.json`；旁置 provenance receipt 记录原路径、scenario ID、长度与 SHA256。测试固定读取这个受跟踪输入并检查字节身份，仍编译实际 StoryViewer 控制片段、PlayerControlDock 与 MobileChatScene，保留原有 choice／前进／完成、文本和贴图参与者、头像及中日切换断言。没有引入整库拷贝、合成对话或修改生产内容。

实际本地验证：`npm run verify:story-localization`、`node scripts/verify-player-communication-ui.mjs`、本批 `git diff --check` 通过。这是独立测试输入修复，不影响前端代码，不机械运行 Vite。内存 renderer 不等于 Browser／媒体验收；此记录不宣称后续 GitHub 门禁已通过。

后续补充：Git 默认换行转换会破坏 byte hash，fixture 专属 `.gitattributes` 使用 `-text whitespace=cr-at-eol`，使原始 CRLF 字节与 source receipt 在 Windows／Linux 一致。没有修改 SHA 来迁就换行转换。完整 [Source Gate 37070990646](https://github.com/windmet/GS_Archive/actions/runs/37070990646) 已于 `fcd0a5e6` 成功，实际通过本地化运行时步骤及其后全部 source 检查；之后镜头改动 `2800eae3` 的 [Source Gate 37072347273](https://github.com/windmet/GS_Archive/actions/runs/37072347273) 亦完整成功。
