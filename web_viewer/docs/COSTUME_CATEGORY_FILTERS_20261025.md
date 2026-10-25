# 首页与摄影衣装类别筛选（2026-10-25）

分支 `portal/20261025-costume-filters` 从最新 master `d0531dcc`（#99）切出，未以舞台分支为 base。舞台服装工作已提交推送至 `stage/20261025-costume-groups` / `e0bb2543`，按用户要求收尾；该分支尚未合入，本轮不修改舞台消费者。

## 舞台常服边界确认

原生 table27 LiveCostumes 的549模型与本地舞台 manifest 一一对应。图鉴690模型中另外141个属于 table28-only；已对141个RAW包重放审计，均有comu atlas/skeleton/texture，均无cos atlas+texture，包括基础常服、运动服和其他剧情服。原始审计在 `.analysis/costume-wiring-20261025/boundary.json`。这确认的是这些模型不在原生Live资源合同中，不按外观断言任何便服风格的Live衣装都不存在。

## 类别与消费边界

[prepare-costume-categories.py](../scripts/prepare-costume-categories.py) 从固定PB SHA `25d48a557c50ac2429f0f55e5d0b766b490b37711eece4baa720cf47570f0ea1` 重读原生table2/24/27/28，生成跟踪的 [costumeCategories.json](../src/data/costumeCategories.json)，默认只读比对，`--write`才重写。IdolUnitId使用field3、IdolType使用field7；另一款归族使用IsAnother、同偶像唯一普通款、原文+后缀及NormalSongId/EventSongId一致性，不依赖中文译名或服装编号猜测。

| 类别 | 模型数 |
|---|---:|
| 全员套服 | 98 |
| 组合套服（含另一款） | 126 |
| 属性套服 | 67 |
| 跨组合套服 | 10 |
| 个人服装 | 248 |
| 常服／剧情服 | 141 |

共690模型，每个只属于一个分类。549个Live模型的分类已逐项与已收尾舞台分支投影比较，完全一致；141个剧情模型不伪装成全员Live套服。分类为来源关系整理标签，不是原生过滤器或服装解锁条件。未知模型保留在“其他衣装”，不因未归类而消失。

[CostumeCategories.js](../src/presentation/CostumeCategories.js) 和 [CostumeCategoryFilter.vue](../src/components/archive/CostumeCategoryFilter.vue) 为首页/摄影共用的筛选层。分类索引仅随两个已有懒加载页面消费，不加载整个服装字典，也不新增媒体或read-model发布绑定。

- 首页桌面工具条、手机衣装面板和场景设置共享类别状态；换偶像后恢复全部。筛选不更新selectedCostume、不改变当前模型或触发选装。当前模型若在类别外，select保留明确标注“当前…（分类外）”的固定选项，手机面板显示当前衣装提示。
- 摄影图层编辑使用相同类别与计数；只筛所选人物实际costumes，未知或不可用项不做跨人替换。换图层恢复全部，类别外的当前模型保留，选择某件衣装才更新selected.modelId。位置、动作、表情及文件格式不变。
- 摄影未命名模型复用已有 `storyCostumeLabel` 核实名称（运动服／秋冬便服等）；有原生名的模型保持原文/翻译链，不改source数据或模型身份。

## 验收

- 新 `verify-costume-category-filters.mjs` 纳入CI batch：690模型无重复、549/141边界、各分类精确集合、另一款归类、不同编号同款、译名不参与身份、未知模型保留、筛选不修改输入、类别外当前模型固定显示，以及首页三个入口/摄影接线。
- 生成器无写入重建、全549模型与舞台分类逐项比较通过。`verify:source-batch` 179/179通过。最终 `build:check` 18.41s通过（摄影命名显示调整后重跑目标回归与构建），固定E盘 `.analysis/build-check`、不拷贝public；不是完整媒体包。
- Browser：主checkout5213 / PID64608，当前portal分支源模块。源码bootstrap为 `1accd9d0aa698ec03ec6d0b80211939f914940abac105d51021b36a8fb321081`；进程仍指定 `rm-release-20261015`，本轮不更换候选、不重启服务，不宣称门户发布候选或生产更新。
- 首页1280×720：冬马15衣装，组合类别只列2款，同时保留当前基础常服分类外选项；筛选前后仍为001tom_002_00，明确选脉冲节拍后才为001tom_104_00，真实画面已加载。场景设置切常服类别，当前组合服不变。390×844手机面板显示4个常服/剧情选项，实际选择001tom_004_00运动服并渲染；换北斗后类别恢复全部15项。clientWidth=scrollWidth=390。
- 摄影冷加载空画布→加入冬马→编辑图层→类别/服装：组合类别保留当前基础常服；选组合服再切常服类别时不换装。实际选择运动服001tom_004_00，显示完整人物与类别/服装控件；原编号形式的无名服装显示既有核实名称。添加北斗并切图层后恢复全部；390×844下选择组合类的003hok_107_01，真实人物渲染、无横向溢出。未保存或导出用户构图。
- Console error为空；不把既有Spine/Pixi warning计作零警告。未验收所有690模型、所有姿势兼容、真机、生产bundle或发布环境。

截图在 `C:/Users/windm/.codex/visualizations/2026/10/19/01a15519-1b92-77f3-a842-31b108360858/`：`home-costume-filter-desktop.png`、`home-costume-filter-mobile.png`、`photo-costume-filter-desktop.png`、`photo-costume-filter-mobile.png`。小日志在 `.analysis/costume-filters-20261025/`。

原有三份资源/翻译元数据改动已用输入快照逐字节保留；无关未跟踪文件不纳入提交。无R2上传、read-model重编译、部署或PR操作。图鉴详情的动态Spine预览仍为后续门户待办，本轮仅推广类别筛选。
