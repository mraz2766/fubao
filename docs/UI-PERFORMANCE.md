# 全站降噪与即时设置保存 · 2026-09-10

## 界面

采用灰白墨黑的语义化主题，旅行照片提供主要色彩。参考 [Things 的按需展开与信息层级](https://culturedcode.com/things/features/) 和 [Day One 的照片记录](https://dayoneapp.com/)，不使用其品牌素材。

首页保留今日训练、本周次数和最近旅行照片；周活动与最近动态使用紧凑区域。移除多彩整块背景、大进度环、重复统计、Slide Arrow 与 Tilted Cover。健身入口为今日、记录、动作库；模板和统计仍可进入。旅行默认足迹，地图、Wishlist 和国内景点发现属于次级入口。表单、详情、登录、关于和设置共享主题、排版及触摸尺寸。

Animata 的轻量交互参考继续保留 MIT 署名，固定来源 commit 为 de9aabb0eed14e0db944bb07720961ddc450c672。动效使用 CSS / View Transition，不添加 Motion 运行库。图标、manifest、离线页和浏览器主题色同步更新；Service Worker 静态缓存升级到 v4。

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

52 项 Vitest 测试、20 项 Playwright 流程通过；最后主题色与中文标签调整后的 5 项设置、性能、全页面视觉回归再次通过。Astro strict check 和生产构建无诊断。

覆盖一键打卡、空字段组记录、多选动作、跨午夜补录、保存恢复、版本冲突、模板、PR、旧备份、旅行上传、图片权限、设置即时保存/断网重试/多标签页、国内地图真实标记。检查 320/390/768/1440px，全站中英文和明暗主题，并用 axe 检查页面与关键弹窗。

同机本地 Workers 生产预览、空数据首页、Chromium 390×844、4× CPU、150ms 延迟、200KB/s 下载：

| 指标 | 本次改造前 | 本次改造后 |
| --- | ---: | ---: |
| LCP | 852ms | 680ms |
| CLS | 0 | 0 |
| 初始 JavaScript gzip | 503B | 625B |

新增的菜单键盘操作和主题色同步保持在 1KB 以内；性能测试强制校验 LCP ≤2.5s、CLS ≤0.1、初始 JS gzip ≤150KB。以上为单次受控本地结果，不是现场 INP、真机结果或全球网络延迟保证。带照片首页另通过首屏位置和响应式检查。截图与测量在忽略目录 output/playwright/。

## 发布与回滚

推送 GitHub main，由既有 Cloudflare Workers Builds 自动执行安装、测试、构建与 deploy:ci。GitHub Actions 仅做检查，不替代 Cloudflare 发布。未新增付费服务或部署资源。

回滚使用前一个 Git commit 的 Worker 构建；此次没有迁移或业务数据格式变更。测试记录和上传对象由测试 finally 清理，线上验证只创建可识别的私人临时记录并恢复被验证的单项设置。
