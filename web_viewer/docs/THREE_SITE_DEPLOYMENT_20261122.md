# 三站改造与发布记录 · 2026-11-22

## 入口与源码

| 入口 | 仓库与发布源 | 读者用途 |
| --- | --- | --- |
| gs-archive.com | windmet/GS_Archive，master 经 PR 合入，读模型、本地语料与源码一起打包 | 剧情、卡片、歌曲及当前状态 |
| blog.gs-archive.com | windmet/gs-archive-journal，独立私有仓库的 main，Astro 静态输出，Pages 项目 gs-archive-journal | 资料馆馆刊，目录、Markdown 文章、RSS、sitemap |
| ssr.gs-archive.com | windmet/smgs-ssr，稳定版 14c910f 派生 codex/ssr-card-links，上传到 smgs-ssr 的 main 环境 | 按 resource_id 打开动态卡面，查看对应资料 |

## 资料馆

11 月 22 日实施前，正式回执源码 7123e47a、读模型 a15e642d、译文 61c373ae。预览回执源码 73aeb42f、读模型 72169db6、译文 bd1b897a。GitHub master 为 b28d1c32，与当时的预览树一致。生产 Pages 指针为 0416f1f5，默认 pages.dev 域同样服务生产。测试者使用 [预览站](https://preview.gs-archive.com/)。

候选 d9fe4359 继承 #219 的读模型（货币用途的两处中文修订）、先前的门户与语音跳转更新及门户壁纸退役。新增关于页馆刊入口、124 个已收录动画的详情页入口和缺失脚本的 404 修复。首屏 JS gzip 估算 198,745 B，上限 216,064 B。数据 d049f4fa、compiled 4afb61ee，未上传 R2。

Pages Functions 接管 /_app/* 的静态回退。缺失脚本返回 404 与 no-store，已有脚本仍由 Pages 返回。冒烟会对缺失脚本的状态或缓存错误报 fail。首轮预览部署 52286fc4 已在公网通过回执、入口 JS、缺失脚本、23 个域索引、6 个 R2 抽样和 canonical 检查。含跨站入口的最终候选已部署至 f53c0868，通过同一组公网冒烟，部署中的 1,665 个译文包逐字节匹配。桌面 Edge 已验证 SSR 卡有入口、普通卡没有入口、关于页显示馆刊链接。包位于本工作树的 .deploy/pkg-preview-d9fe4359，清单 SHA256 为 66e7b6ad537834dd4bd628d4c145e648a5264ab51a8121daa0724cb9d936e4c9。

正式晋升按 [发布契约](RELEASE_CONTRACT.md) 执行。对冻结的 sourceDigest 4b682f6d38167b79ce430cca3ef059b4269b1734d058dedf3213cd7fdb5f9f93，在部署的预览走 config/release-journeys.json 中的桌面、Android Chromium 与 iOS Safari 旅程。另关注 vivo、QQ 内置浏览器冷启动，以及 iOS 故事和歌曲封面首次加载。验收通过后从同一候选生成 production 包，核对批准语句、译文、robots、sitemap 和两个正式入口。11 月 10 日的设备例外只记录当次发布。

## 动态卡面

公网发行版保留 catalog.v2.json 的指纹 8eebf849dda55fa6，49 人、124 张卡。以卡片编号和 resource_id 对照 GS 读模型中的 124 个公开 SSR 详情，全部唯一匹配。业务层教程别名由资料馆归并。主站仅在已核对的 resource_id 上渲染链接，收录新卡时同步更新 src/content/animated-card-resources.json。

稳定版源码 5f83a17，Pages 预览 ae77ed51、正式 c829169d，上一个可回滚正式部署 7ce051cd。Node 33 项测试和生产包校验通过。桌面 Edge 已在预览及原正式入口验证冬美旬 SSR 2 直达、刷新、切换至 SSR 1、浏览器返回、未知 ID 回到默认卡。媒体仍使用原 R2。卡面页的「查看卡片资料」按已核准的 resource_id 打开资料馆。旧分享入口可继续使用。[冬美旬 SSR 2](https://smgs-ssr.pages.dev/?card=021jun_ssr02)

## 馆刊

新工程在 E:/Web_build/GS_Archive_Journal，独立于本机 folio 项目。首版刊登《冬美旬的第二张 SSR 是怎么找回来的》，取材于卡面站补录记录。读者可由文章进入卡面；当前链接使用已验证的 pages.dev 域。文章 frontmatter 和文件名驱动目录、固定链接和 RSS。构建生成独立 sitemap、canonical、分享标题和摘要。正式部署 47a46a08，首版可回滚至 9939f213。写作与发布命令见馆刊仓库 README。[馆刊](https://gs-archive-journal.pages.dev/) · [源码](https://github.com/windmet/gs-archive-journal)

## 域名启用与回滚

两个自定义域均已注册到对应 Pages 项目。现有 Pages OAuth 无 DNS 记录读写权限，注册后验证报告 CNAME 缺失。随后使用区域 DNS 编辑令牌核对同名记录并创建以下两条代理 CNAME。

| 类型 | 名称 | 目标 |
| --- | --- | --- |
| CNAME | ssr | smgs-ssr.pages.dev |
| CNAME | blog | gs-archive-journal.pages.dev |

等待 Pages 域验证和证书 active，从新域复查馆刊文章、RSS、sitemap，以及 SSR catalog 指纹、冬美旬纹理、换卡返回和主站反向入口。新域确认后更新馆刊文章的卡面地址。移动端播放与返回需在设备实测。

主站晋升前的回滚锚点是 0416f1f5。优先在对应项目回滚独立 Pages 部署，并保留该版本所引用的 R2 数据。两个子站的发布及回滚互相独立。[Cloudflare 自定义域说明](https://developers.cloudflare.com/pages/configuration/custom-domains/)

