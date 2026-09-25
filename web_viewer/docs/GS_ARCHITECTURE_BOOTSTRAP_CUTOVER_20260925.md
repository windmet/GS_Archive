# GS 门户 bootstrap 切换：第二批

输入 HEAD `9a17e86`，分支 `codex/gs-architecture-rebuild`。沿用已验证的
`fdbfbc927800cef97f15388b9962c53b5b9a836650cd8b72efdec789b219e2aa`
本地 read-model 候选，只提交其 11,509 B bootstrap，不提交 2,961 个静态模型文件。

## 变更

- Vite 在 HTML 中内联有版本的 bootstrap；客户端同步验证后，Portal、welcome、
  idol picker 使用其真实身份、Home 资格与计数。首屏不启动 21 项 legacy 数据批量请求。
- 尚未迁移的页面在用户进入时才读取旧数据。Portal 保留可操作，显示局部等待状态；
  返回 Portal 或进入设置会取消过时的页面跳转。后续域迁移会逐一删除此兼容入口。
- 装配器允许已内联且与候选逐字一致的 bootstrap，发现版本不一致时在创建候选
  目录前拒绝。Vite 的 publication-policy middleware 不再把 Connect app 当后置钩子。

## 本地验证

- `node --test readmodels/tests/*.test.mjs`：25 项通过，包括内联版本匹配/拒绝。
- `npm run verify:portal-navigation`、`verify:routes`、`verify:archive-navigation-state`、
  `verify:archive-async-navigation`：通过。
- `npm run build:check`：完整代码编译通过，产物仅 `.analysis/build-check`，
  `copyPublicDir:false`，HTML 含且仅含一个 bootstrap script。未生成可部署媒体包。
- Codex Browser 经 127.0.0.1:5176 的只读静态 QA 服务读取本次构建及原有 public。
  465×492 视口：Portal 非空、无框架覆盖层；进入设置、显示 49 人物选择、返回
  Portal，首帧没有旧的全站读取遮罩，控制台无 error/warn。服务端请求记录中，这段旅程有 HTML 请求而无
  `/data/**` 请求。点击歌曲后，Portal 保持可操作并显示等待状态，随后旧版歌曲
  目录正常显示 60 首；该未迁移页面实际发出 21 个 `/data/**` GET。

本机 Vite dev 首次启动遇到 publication-policy 中间件返回值错误，修正后进程
可以启动但根路径请求仍停滞；Browser 验收使用可响应的静态代码构建服务，
其脚本在 `E:\GS_readmodel_qa_server_20260925.mjs`，无资源复制。桌面视口覆盖、
弱网、iPad Safari、Android Edge、正式 Pages/Functions/R2 操作计数未验收。
生产入口仍静态导入大部分特性模块，其他公开路由仍走旧的整批请求；
本批不是全站切换或发布批准。
