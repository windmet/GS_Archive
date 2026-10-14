# 5212 舞台选曲目录恢复

用户反馈：全员/多编成入口缺失，Take a StuMp!被过滤，不能选择编成队伍。

## 根因

这是本窗口重启5212导致的环境回归。为让Vite识别新增背屏/背景PNG而重启时，没有保留原进程的`SIDEM_READMODEL_CANDIDATE`。原启动日志`.analysis/native-relation-candidates/vite-5212-latest.log`明确指定：`E:/Web_build/GS_Archive_Domain_Work/rm-native-relations-20261013`。裸启动改用checked-in bootstrap，却没有相应本地`/_catalog`服务，歌曲目录/详情请求收到SPA HTML。

`useSongNavigation`无法装载目录，`useStageSongProjection`传给舞台的songDirectory变为空。ChibiSongLibrary只能从部分脚本vocalSetting推导少量分类：全员/编成只剩3首，其他大量条目成为unknown，tkstp1/tkstp2没有vocalSetting，因而不再出现在全员/编成中。歌曲详情experimental同样缺失，会影响与歌曲页衔接的声部/编成信息。

分类代码最后修改为`ad95f853`，本轮灯光/图层提交未改分类逻辑。但本窗口改变服务启动参数，直接造成实际退化，不能转交给其他分支或归因于歌曲页的多槽策略。之前两个图层验证记录把读模型错误称为既有问题不准确，现已修正文档。

## 恢复与验证

已恢复上述原候选路径，仅重启归属明确的5212，端口不变。恢复后PID60960；复用服务时需重新核验PID/命令，不依赖该历史数字。没有改歌曲页多槽策略、分类代码或资源读模型内容。

原候选release为`1443ba17bda823fab56fdf04bea0aa527c4a0d0fe19486c202520e00c00636c5`。实际songs/index HTTP为200、application/json，1192字节，SHA256 `53c2b0da5dd50a2b54f9e03e1082e2a6f531f1f13433a0d1e43634877f22c4c3`，与候选磁盘文件逐字节一致。

`node scripts/verify-chibi-song-library.mjs --read-model-root E:/Web_build/GS_Archive_Domain_Work/rm-native-relations-20261013`通过：60首歌曲、118个精确脚本ID，分类5首全员/编成、47首组合曲、8首特别编成，3首主要全员曲各保留16个组合版本。该命令验证源数据/目录映射，不代替Browser操作。

5212实际Edge Browser已验证：全员/编成分类列出Beyond The Dream、DRIVE A LIVE、Growing Smiles!、Take 01、Take 02；两个Take可点选并出现5名人物。DRIVE的20个编排选项包含全部16个组合版本，实际切换Jupiter/Altessimo/High×Joker/C.FIRST，确认精确脚本ID、活动槽位和可见人数3/2/5/3。390×844分类下两个Take仍可见，截图已查看。此次页面错误为0。小型receipt及截图位于`C:/Users/windm/.codex/visualizations/2026/10/13/01a13599-5517-7113-9331-e6ac3c22279e/stage-*restored*`。

源码无分类/多槽修改，仅服务环境恢复与文档事实修正，因此本记录只进行链接/内容/diff检查，不额外构建或复制媒体包。部署/推送状态没有改变。

后续需要重启此服务时，先检查原启动日志/环境并保留该候选；不直接使用裸Vite命令。启动进程需继承`SIDEM_READMODEL_CANDIDATE`，然后检查当前页面bootstrap release和实际`/_catalog` JSON，再确认舞台目录/声部可用。不能把SPA fallback当作无关提示忽略。
