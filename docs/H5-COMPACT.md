# H5 紧凑布局验收 · 2026-09-14

本轮保留米白、手绘图标、绿色与暖橙色，主要调整 767px 以下布局。数据库、登录、API、图片限制及 Cloudflare 资源不变。

## 页面变化

- 首页两张整卡入口：压缩问候、插画、封面和留白，去掉重复箭头；今日状态、本周、本月和最近记录仍保留。
- 健身列表：今日状态与主操作紧凑排列，历史使用短行。新建/编辑隐藏底部主导航，使用顶部返回和固定保存栏；日期/时长、重量/次数并排。
- 动作明细：展开即出现搜索，删除首次展开后还要再点“添加动作”的步骤；只保留最近/常用/全部。新增组的复制入口收进更多，输入建议不再套额外卡片。
- 旅行：多记录为两列相册，单记录为紧凑大图。照片采用 88px 横向缩略图；只有照片栏滚动，页面不横向滚动。说明与必填缺项提示放在固定保存栏。
- 设置：共享分组背景，原有即时保存不变，补充现有风格的小图标。

## 同数据高度对比

浏览器 Chromium，390×844，中文浅色；本地相同记录和一条三照片测试旅行。文档高度包含页面底部安全留白，内容不足一屏时受视口最小高度约束。以下不是所有数据量的固定高度保证。

| 页面 | 修改前文档高度 | 修改后文档高度 | 差值 |
| --- | ---: | ---: | ---: |
| 首页 | 844px | 844px | 内容区 724 → 546px，两张卡均在首屏 |
| 健身列表 | 1140px | 905px | -235px |
| 新建训练（未展开动作） | 1034px | 844px | -190px，无需滚动到保存按钮 |
| 旅行列表 | 844px | 844px | 内容区 584 → 472px |
| 新建旅行（空照片） | 1145px | 844px | -301px |
| 新建旅行（三张照片） | 1221px | 844px | -377px，照片区域约 260 → 111px |
| 设置 | 1019px | 957px | -62px，保留组间空隙 |

普通底部导航从 72px 收紧至 60px（另加设备安全区）；新建/编辑隐藏该导航，固定保存栏替代。详细动作随内容自然增长，不用裁切隐藏输入。

## 地点、上传与输入遮挡

- 地点查询保留加载、无结果、失败和手动名称入口；真实浏览器拦截为 503 后手动保存并编辑成功。
- 保留上传总超时 120 秒、无进度 30 秒超时与单张重试；失败不会中断后续照片队列。
- 本轮新增 AbortSignal：删除单张、确认离开或卸载页面时中止对应请求，不再继续处理后续队列。浏览器拦截真实上传，取消后记录到 abort 已执行。
- 单张删除使用 44px 点击区域；三照片检查发现并修复了 grid 子元素 min-width 撑宽页面 8px 的问题。
- VisualViewport 同时照顾 input 和 textarea：只有输入被遮挡时滚动到可见位置。浏览器视口测试无法代替 iOS/Android 真机软键盘测试。

## 实际验证

- `pnpm build`：类型检查及 Workers 构建通过。
- `pnpm test`：7 个文件、63 个测试通过。
- Playwright 相关回归：9 项通过；最终三照片修订后重跑 task-flow 6 项全部通过。
- 390px 与 1440px：登录、快速记录（部位+60分钟）、动作80kg×5、详情、取消编辑、保存修改、三照片上传、旅行详情、地点接口失败手动名称编辑、设置分组。
- 私人训练与照片对访客返回404，模板/组/PR/JSON恢复及设置连续修改测试通过。
- 上传停滞→超时→重试→保存通过；慢连接登录防止未 hydration 原生提交通过；进行中记录编辑不会意外完成。
- 320px、中英文、暗色、Reduced Motion、固定保存位置测试通过；390px核心页面 axe WCAG A/AA 检查无违规。
- 360/390/430/1440px 三照片编辑页检查无整页横向溢出。

证据（本地，不提交含记录截图）：

- `output/playwright/h5-before-*.png` 与 `h5-after-*.png`
- `output/playwright/h5-before-travel-three-photos.png`、`h5-after-travel-three-photos.png`
- `output/playwright/ia-after-*-390.png`、`ia-after-*-1440.png`（回归全过程截图）
- `output/playwright/h5-responsive-photos.txt`、`h5-three-photos-measurements.txt`
- `output/playwright/report/index.html`

## 修改文件

- `src/styles/h5.css`：集中移动端规则。
- `src/styles/task-pages.css`：移除被替代的旧移动端覆盖。
- `src/layouts/Base.astro`：加载样式与表单页面标记。
- `src/components/FormViewport.astro`：输入可见范围处理。
- `src/features/dashboard/Dashboard.astro`：紧凑首页语义与封面。
- `src/features/fitness/WorkoutEditor.tsx`、`ExerciseSearch.tsx`：表单与动作选择。
- `src/features/travel/TravelEditor.tsx`、`TravelGallery.astro`、`photos.ts`：照片栏、画廊与取消请求。
- `src/features/settings/SettingsPanel.tsx`：分组图标。
- `tests/e2e/task-flow.spec.ts`：更新直接展开动作行为，增加三照片溢出检查，保存栏位置适配。

PC 保持原有布局，复用上传取消和动作明细展开改进。尚未在实体手机验证相机、HEIC系统选择器及软键盘；未把浏览器模拟结果称为真机验证。
