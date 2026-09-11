# 全站降噪与即时设置保存 · 2026-09-10

## 界面

采用灰白墨黑的语义化主题，旅行照片提供主要色彩。后续交互修订增加少量鼠尾草绿，用于选中状态、主操作、导航和小图标底色，保持卡片表面中性。参考 [Things 的按需展开与信息层级](https://culturedcode.com/things/features/) 和 [Day One 的照片记录](https://dayoneapp.com/)，不使用其品牌素材。

首页保留今日训练、本周次数和最近旅行照片；周活动与最近动态使用紧凑区域。移除多彩整块背景、大进度环、重复统计、Slide Arrow 与 Tilted Cover。健身入口为今日、记录、动作库；模板和统计仍可进入。旅行默认足迹，地图、Wishlist 和国内景点发现属于次级入口。表单、详情、登录、关于和设置共享主题、排版及触摸尺寸。

Animata 的轻量交互参考继续保留 MIT 署名，固定来源 commit 为 de9aabb0eed14e0db944bb07720961ddc450c672。动效使用 CSS / View Transition，不添加 Motion 运行库。图标、manifest、离线页和浏览器主题色同步更新；Service Worker 静态缓存升级到 v4。

## 训练项与动作选择

- 训练项通过 aria-pressed 驱动底色、边框与勾选；已完成组也提供局部色彩反馈。主题切换不对文字与背景做颜色渐变，避免过渡阶段对比度不足。
- 工作区只保留底栏一个“添加动作”，空状态说明动作和组数可选。动作选择在当前工作区内切换，不叠加弹窗；返回恢复添加入口焦点，选择后定位到新动作。
- 选择器自动接收当前训练项，默认显示相关动作；多个训练项合并匹配。用户可切换全部动作，并保留跨筛选、多次搜索的待选动作。已加入的动作单独标注并支持定位，不混入本次新增计数。
- GET /api/fitness/exercises 支持 trainingItems（逗号分隔的训练项枚举）。使用来源肌群与别名映射，匹配主要或辅助肌群，主要肌群匹配排在前面。例如背部仍能搜到以臀肌为主要目标、下背部为辅助肌群的硬拉。
- 相关肌群作为 JSON 参数绑定，避免多项筛选超出 D1 参数数量上限；保留分页、收藏、最近和常用的归属过滤。精确选择其他部位或目标肌群时切换全部范围，避免隐藏筛选条件互相冲突。
- 不新增数据库迁移、运行库、外部图片请求或必填字段。

## 设置协议

- PATCH /api/settings 接受 preferences 的部分字段、widgets 的指定属性，以及包含四个唯一 Widget key 的 order。
- 偏好通过 D1 json_patch 原子修改。Widget 显隐、尺寸和排序只改对应属性；多标签页修改不同字段不会互相覆盖。同一字段以最后写入为准。
- 前端串行发送，合并待发送修改。失败保留输入及待提交内容，提供重试和未保存离开提醒；不在失败时显示已保存。
- 主题即时预览；语言等队列全部保存后再切换。访客只保存本机偏好。
- PUT 继续支持完整设置恢复；密码修改与导入仍为明确操作。
- mapStyle 不再出现在界面或控制地图表现，旧数据库与备份字段仍兼容。
- 本次不需要 SQL migration，schemaVersion 保持 1。

## 旅行与性能

- 默认旅行页不加载景点发现、Wishlist 或世界地图数据。国内搜索支持 preferCountry=CN；英文省份在中文界面显示对应译名。
- 中国地图根据实际记录与 Wishlist 坐标生成标记，支持普通城市、省级记录和预置景点；缺失坐标仍保留列表。预置景点不伪装成个人足迹。
- 世界与中国底图均由本地 Natural Earth 数据显式生成：pnpm exec tsx scripts/render-world-map.ts。构建不下载数据。
- 健身按视图查询：动作库与模板不拉取并计算全部训练历史；动作筛选数据展开后请求。
- 旅行列表与首页使用缩略图，大图进入详情后加载。私人 HTML、API、导出与照片继续 private/no-store。

## 验证

52 项 Vitest 测试、22 项 Playwright 流程通过；动作选择最后调整后的 7 项针对性回归再次通过。新增验证训练项的可见选中状态、唯一添加入口、相关肌群合并筛选、跨范围多选、已有动作定位、Escape 返回焦点，以及新版选择面板的中英文与明暗主题。Astro strict check 和生产构建无诊断。

覆盖一键打卡、空字段组记录、多选动作、跨午夜补录、保存恢复、版本冲突、模板、PR、旧备份、旅行上传、图片权限、设置即时保存/断网重试/多标签页、国内地图真实标记。检查 320/390/768/1440px，全站中英文和明暗主题，并用 axe 检查页面与关键弹窗。

首轮全站降噪的同机本地 Workers 生产预览、空数据首页、Chromium 390×844、4× CPU、150ms 延迟、200KB/s 下载：

| 指标                 | 本次改造前 | 本次改造后 |
| -------------------- | ---------: | ---------: |
| LCP                  |      852ms |      680ms |
| CLS                  |          0 |          0 |
| 初始 JavaScript gzip |       503B |       625B |

新增的菜单键盘操作和主题色同步保持在 1KB 以内；性能测试强制校验 LCP ≤2.5s、CLS ≤0.1、初始 JS gzip ≤150KB。以上为单次受控本地结果，不是现场 INP、真机结果或全球网络延迟保证。带照片首页另通过首屏位置和响应式检查。本次训练交互与配色修订的同条件复测 LCP 为 708ms、CLS 为 0、首页初始 JS 仍为 625B gzip。截图与测量在忽略目录 output/playwright/。

## 发布与回滚

推送 GitHub main，由既有 Cloudflare Workers Builds 自动执行安装、测试、构建与 deploy:ci。GitHub Actions 仅做检查，不替代 Cloudflare 发布。未新增付费服务或部署资源。

回滚使用前一个 Git commit 的 Worker 构建；此次没有迁移或业务数据格式变更。测试记录和上传对象由测试 finally 清理，线上验证只创建可识别的私人临时记录并恢复被验证的单项设置。

## 紧凑 Bento 与入场反馈 · 2026-09-10

首页参考用户提供的 ThisUX Bento 网格截图（https://x.com/thisuxhq/status/2097690196095742442）的对齐关系与错落布局，不复制品牌素材。默认 Desktop 为 12 列：训练和周活动在左，旅行照片跨两行，最近记录为短列表。Mobile 保持单列；卡片圆角 16px、间距 12px、照片 160px，进行中训练并入训练摘要。390×844 带照片、达标状态和进行中训练的首屏可完整看到三个主模块。用户自定义显隐、排序和大小继续生效；768–1023px 小尺寸卡片使用两列，避免侧栏挤压内容。

日期与问候按用户设置时区呈现；日期型记录和旅行日期按日历日期格式化，避免跨时区显示成前一天。最近记录优先显示主卡未展示的训练与旅行。训练卡使用极浅鼠尾草绿，其余保持中性。全站标题、表单、列表及设置行适度收紧，主要触摸区域保留 44px。

加载使用 CSS transform：8px 位移、0.985 缩放、每张 200ms、按当前顺序间隔 40ms。文字和布局首帧即存在，不设置 opacity:0，不等待图片，不依赖首页 React hydration。首页取消叠加的根节点淡入；刷新数据、滚动、窗口变化不重播，后退与 BFCache 恢复直接显示，Reduced Motion 关闭动画。

打卡和完成训练、旅行保存成功后使用共享勾选反馈；跨页确认仅消费一次短期 sessionStorage 回执，不使用 URL 参数伪造保存状态。自动保存不庆祝。达标反馈按用户和周在当前浏览器会话内去重；存储不可用时退化为静态记录状态。未修改 API、SQL Schema、备份格式、缓存权限或部署资源，未添加依赖。

验证：58 项 Vitest、24 项 Playwright 流程通过；最后的平板小卡片修正后，4 项首页/性能检查再次通过。覆盖 D1 保存、版本冲突、幂等、私人记录和图片、设置即时保存、备份恢复、键盘、axe、双语、两种主题、320/390/768/1440px，以及动画顺序、后退、Reduced Motion、慢图片、自定义 Widget、保存反馈与达标去重。Astro strict check 与生产构建通过。

同机本地 Workers 预览、空数据首页、Chromium 390×844、4× CPU、150ms 延迟、200KB/s 下载：

| 指标                 | 本次改造前 | 本次改造后 |
| -------------------- | ---------: | ---------: |
| LCP                  |      696ms |      732ms |
| CLS                  |          0 |          0 |
| 初始 JavaScript gzip |       625B |      1495B |

以上为单次受控测量，轻微 LCP 波动不表示现场速度变化。新增 JS 870B；未引入动画运行库。录屏 `output/playwright/bento-entry-mobile.webm`、`bento-entry-desktop.webm` 及截图保存在忽略目录；带照片截图使用本地 QA 记录，不代表线上真实个人旅行。发布仍由 GitHub main 推送触发 Cloudflare Workers Builds。

## 默认布局与文案精简 · 2026-09-11

取消首页模块的小／中／大选项。首页按内容及屏宽自动排列，旧 size 字段仅为数据库与 JSON 备份兼容保留，不再参与渲染；显隐、排序和即时保存继续生效。默认训练与周历在左、旅行在右，其他排序用两列自然排列，落单模块占满一行；手机保持单列。

删除移动页头右侧及侧栏底部的用户名设置链接，品牌只保留一个可见入口。首页缩短模块名称，去除重复时间、周起始日期、旅行省份、公开提示和“最近记录已在上方展示”等说明；没有额外记录时收起最近模块。默认训练名称改为展示训练项或打卡状态，不重复“今日训练”。

问候依据设置时区使用日出／太阳／月亮图标，搭配小面积低饱和底色；图标入场仅轻转 240ms。周历用小圆点和 aria-current=date 标注今天。沿用卡片入场、后退恢复和 Reduced Motion 行为，不新增客户端库、数据迁移或部署资源。

本轮验证：62 项 Vitest、11 项相关 Playwright 流程通过；最终日期文案调整后，4 项首页与性能检查再次通过。覆盖模块显隐/排序、旧尺寸忽略、无额外记录时收起模块、单个可见品牌入口、问候、双语明暗主题、320/390/768/1440px、axe、后退与 Reduced Motion。类型检查和构建通过。受控移动首页 LCP 732ms、CLS 0、初始 JS gzip 1495B；该测量为本地预览，不代表真实用户网络。

## 2026-09-11 · Direct recording and photo-first travel

Persistent check-in selections now recover by calendar date, patch one session with revision protection and update recent receipts. Detailed recording uses an independent workspace with compact completed sets. Travel begins with the native photo picker; selected locations, optional dates and photo organization use progressive disclosure. The Lightbox loads on demand and returns keyboard focus to its photo. See [DIRECT-RECORDING.md](DIRECT-RECORDING.md) for API and state behavior.

The homepage adds seven SSR bars for actual daily training counts, preserving the existing greeting, photo hierarchy and entrance sequence. Below 390px the chart wraps to keep touch targets comfortable. Home/Today header reads and SQL pagination reduce history data loading without changing stored records or backup formats.

Controlled comparison: Chromium, 390×844, 4× CPU throttle, 150ms latency and 200KB/s download, local Workers preview with an anonymous empty-data view. Before: LCP 732ms, CLS 0, initial JS gzip 1495B. After: LCP 732ms, CLS 0, initial JS gzip 1495B (an earlier sample was 740ms). The chart adds no client JavaScript. These are controlled measurements, not production field INP or physical-device results.

Validation: strict type check and build pass; 63 domain tests, including a midnight DST gap. All 31 browser cases passed across the regression runs; the final workspace/map changes were rechecked with 11 passing cases. Browser coverage includes D1 partial-write idempotency/ownership, lost-response retries, tab conflicts, date restore, optional measurements, contextual exercise selection, templates, photo-first creation, HEIC/AVIF/large-photo and WebKit upload, old JSON restore, settings autosave, four responsive widths, both languages/themes, axe and reduced motion. No migration or new external service is required.
