# 页面职责与记录流程重构

日期：2026-09-14。

## 改造前的实操

修改前已启动本地 Workers 预览，在 Chromium 1440×844 和 390×844 中通过登录表单登录，进入首页、搜索动作、点击历史记录、展开旅行地图并操作设置。

实际发现：健身历史行直接将同一页面上方表单切换成编辑态；旅行列表、完整新增表单、卡片编辑按钮和地图在同一长页内竞争。动作选择同时有相关/全部和使用频率两套导航。

## 页面职责对比

| 区域 | 修改前 | 修改后 |
| --- | --- | --- |
| 首页 | 两张生活卡，但手机卡片较高 | 保留绘本图标和米白/绿/暖色；两张整卡入口，无表单，压缩首屏 |
| 健身 | 新建、同页编辑、历史混合；辅助入口靠下 | `/fitness` 查看：轻量近况、日期分组列表、唯一新建入口；顶部记录/统计/模板/动作库 |
| 训练新建 | 内联编辑器 | `/fitness/new`：日期、部位、选填时长和备注；动作明细主动展开 |
| 训练详情 | 已完成详情、进行中自动变成编辑器 | `/fitness/:id` 只读；`/fitness/:id/edit` 明确编辑、保存修改/取消 |
| 旅行 | 图集、完整表单和辅助工具同页 | `/travel` 只看图集；`/travel/new` 新建；`/travel/:id` 详情；`/travel/:id/edit` 编辑 |
| 设置 | 外观、通用、目标等散落 | 个人资料、外观、训练默认值、旅行/照片、数据与账号；即时保存保留 |

历史 `?view=history` 路径继续兼容日历；默认入口为新的记录列表。统计/模板/动作库及地图/想去/发现能力保留。主页面不再下载完整新增表单的 React island。

## 保存与数据边界

- 新建和明确编辑页面使用现有 WorkoutEditor、TravelEditor、schema 与保存服务。训练编辑关闭自动保存；点击取消前改动不会写入 D1。其他仍在使用自动保存的调用方不受影响。
- 权限、默认私人、revision、mutation_id、R2 私有读取和旧备份规则保留。
- `0007_manual_place.sql` 只插入一个无国家、无坐标的系统地点，不修改表结构，不改用户记录。实际手动地点名保存在既有 `travel_entries.place_name`，不会写入公共搜索库。不将未知国家计入国家数。
- 上传保留总超时 120 秒，并增加 30 秒无进展超时；优化后的单张照片可重试。失败照片提供删除入口。
- 地点搜索保留加载、无结果、失败状态，新增重试与手动名称回退。
- 返回旅行列表恢复 URL/滚动位置，只保存位置，不将私人内容存入浏览器存储。
- 手机保存栏固定于底部导航上方；Visual Viewport 变化时处理键盘留空。字段单列，主要按钮至少 44px。

## 验证结果

- `pnpm build`：Astro/TypeScript 检查零错误，Workers 构建通过。
- `pnpm test`：63 项通过。
- `pnpm db:migrate`：在已有本地库成功应用 0007；没有删除原记录。
- `pnpm exec playwright test tests/e2e/task-flow.spec.ts tests/e2e/data.spec.ts tests/e2e/settings.spec.ts`：9 项通过（最后一次 32.9 秒）。

1440px 和 390px 均实际通过 UI 登录、从首页进入健身、只选背部和 60 分钟保存、搜索并加入硬拉/输入 80kg×5/记一组/保存、查看只读详情、取消编辑验证未写入、保存修改；进入旅行、搜索上海、上传真实 JPEG、保存、详情、修改描述、模拟地点服务 503 后保存手动地点；最后检查设置分组。

另外验证：匿名访问私人训练/照片返回 404；模板复制、PR 重算、JSON 恢复；设置主题/语言、网络失败重试、多标签页修改不同字段；模拟照片上传停在 99% 后快进时钟触发超时并实际重试上传；旅行列表返回滚动位置。

六个核心页面在桌面及手机检查 axe WCAG 2 A/AA，无违规。英文、暗色、Reduced Motion 在 320/390/768/1440px 检查无横向溢出；390px 检查保存按钮位置和高度。含照片首页两张卡底部位于底部导航以上。

### 证据

本机 `output/playwright/` 中：

- `ia-before-{home,fitness,travel,settings}-{1440,390}.png`：修改前实际操作。
- `ia-after-{home,fitness,workout-new,workout-exercise,workout-detail,travel,travel-new,travel-detail,settings}-{1440,390}.png`：修改后实际流程。
- `ia-after-home-with-photo-{1440,390}.png`：保存旅行后的首页。
- `ia-after-english-dark-390.png`：英文暗色手机表单。
- `report/index.html`：上述九项测试的报告。

照片截图中的彩色图片是测试夹具，不是新增的装饰素材。测试只清理本次创建的记录；没有清理生产数据。

## 验证范围与限制

- 手机测试是实际浏览器的视口仿真，不是实体 iPhone/Android；实体键盘、系统照片选择器和相机 HEIC 本轮未重测。
- 本轮运行的是上面列出的相关测试，未把旧内联页面交互测试算作通过；这些旧脚本仍保留，部分断言需要随新路由继续更新。
- 手动地点无坐标，不会猜测地图标记；以后可在编辑中更换为匹配地点。
- 本轮不声称线上真实用户 LCP/INP 指标或全设备兼容验收。

## 修改文件
- `src/components/SaveFeedback.astro`
- `src/components/ui/button.tsx`
- `src/features/fitness/ExerciseSearch.tsx`
- `src/features/fitness/Templates.tsx`
- `src/features/fitness/WorkoutActions.tsx`
- `src/features/fitness/WorkoutEditor.tsx`
- `src/features/settings/SettingsPanel.tsx`
- `src/features/travel/LocationSearch.tsx`
- `src/features/travel/TravelActions.tsx`
- `src/features/travel/TravelEditor.tsx`
- `src/features/travel/photos.ts`
- `src/layouts/Base.astro`
- `src/lib/use-unsaved.ts`
- `src/locales/en-US.json`
- `src/locales/zh-CN.json`
- `src/pages/api/[...path].ts`
- `src/pages/fitness/[id].astro`
- `src/pages/fitness/index.astro`
- `src/pages/settings.astro`
- `src/pages/travel/[id].astro`
- `src/pages/travel/index.astro`
- `src/server/services/travel.ts`
- `tests/e2e/settings.spec.ts`
- `docs/PAGE-TASKS.md`
- `migrations/0007_manual_place.sql`
- `src/components/FormViewport.astro`
- `src/components/TravelScroll.astro`
- `src/features/fitness/WorkoutFormPage.tsx`
- `src/features/fitness/WorkoutHistoryList.astro`
- `src/features/travel/TravelFormPage.tsx`
- `src/features/travel/TravelGallery.astro`
- `src/pages/fitness/[id]/edit.astro`
- `src/pages/fitness/new.astro`
- `src/pages/travel/[id]/edit.astro`
- `src/pages/travel/new.astro`
- `src/styles/task-pages.css`
- `tests/e2e/task-flow.spec.ts`

## 线上复核发现的登录加载问题

首次线上复核发现：脚本尚未加载完成时，登录表单会使用浏览器默认提交方式。补充了 hydration 就绪状态、加载期间禁用字段和提交，并显式声明 POST 防止默认 GET；不改变登录接口或密码。新增浏览器延迟 JS 加载的回归测试。

追加文件：`src/features/settings/Login.tsx`。

进行中训练的显式编辑保存仍保留 active/draft 状态；只有主动使用“更多”内的“完成训练”才结束，已添加专门回归测试。

首次主发布 `cf13612` 的 GitHub 检查与 Cloudflare Workers Builds 均成功，线上 1440/390px 已验证登录、两张首页卡、训练/旅行列表及新建后取消、设置分组，未写入生产业务记录。登录保护随下一次修正提交发布。
