# 健身交互与冷淡风改版

## 行为

- 训练以日期、部位和保存为主，时长及备注收进补充信息。
- 动作选择占用同一个面板，最近使用优先，可按训练部位筛选并一次多选。
- 打开面板、进入选择页、添加动作后分别聚焦标题，不聚焦输入框。数字键盘使用完成键，Enter 结束输入，不自动添加组。
- 明细组表格统一保存，新增组复用上一组数据；RPE 和备注等附加字段仍可编辑。
- 首页按周/月展示训练次数圆环、日期图和当天记录；只统计已完成训练，同一天多条分别计数。
- 周目标沿用设置；月目标按 `ceil(weeklyGoal * daysInMonth / 7)` 折算，历史周期使用当前目标。超额保留真实次数；不提供图片导出。

## 接口与兼容

`GET /api/fitness/summary?period=week|month&date=YYYY-MM-DD`

返回 `period`、`start`（包含）、`end`（不包含）、`count`、`goal` 和 `days`。每天包含日期、次数及记录的 ID、标题、部位摘要。通过现有轻量查询按用户权限读取；匿名只读取公开已完成记录。响应为 `private, no-store`。日期归属遵循用户时区、日期精度与周起始日。无数据库迁移，不改变现有训练写入接口。

切换周期时取消旧请求；加载失败提供重试，不展示虚假的零次数。首页初始周期服务端渲染。保持首页健身组件的既有显示/排序设置。

## 视觉与图标

冷白灰、石墨文字、单一雾蓝强调；深色模式对应石墨灰和浅蓝。功能图标统一使用项目已有 Lucide。移除纸张纹理、手绘空状态与不规则圆角。保留 44px 触控目标、16px 输入字号和减少动态效果偏好。

奶牛猫由内置 imagegen 生成，项目内最终资源：

- `public/brand-cat.png`：透明品牌标志。
- `public/favicon.png`：32px。
- `public/apple-touch-icon.png`：180px。
- `public/icon-192.png`、`public/icon-512.png`：主屏幕图标，保留裁切安全区。

生成提示：

> Generate one final app icon artwork for Fubao, a minimal personal fitness and travel journal. One very chubby black-and-white cow-pattern domestic cat, front-facing seated squat loaf silhouette, oversized round white belly, tiny short paws, small ears, simple calm dot eyes, asymmetrical black patches on head and one side. Sophisticated restrained flat graphic mark, bold clean shapes, no outline clutter, no text or letters, no gradients or shadows, no UI mockup. Black charcoal and off-white cat against a perfectly uniform cool light gray #F4F6F8 background. Centered square 1024x1024 composition, cat fully within center 65% safe area so it reads clearly at 32px and maskable mobile app icon crops. A little charming but visually quiet.

工具实际返回带透明通道的 1254px PNG。用 Sharp 派生品牌和各尺寸图标；主屏幕版本铺设冷灰底。缓存版本升级到 v8，manifest、主题色及离线页同步更新。

## 验证

- 72 项测试通过，新增统计测试覆盖跨年、不同周起始日、闰月、同日多次、进行中/草稿排除、时区和超额计数。
- 浏览器验证打开面板、进入动作选择、返回明细时焦点均不在输入框；完成键结束输入。
- 一次添加两个动作、三组训练保存成功；RPE 与组备注修改保存正确。
- 注入保存失败后部位选择仍保留，重试保存成功；汇总请求失败不呈现零次数，重试恢复。
- 本地 API 验证私人记录不会进入匿名汇总，非法日期返回 400。
- 390、393、430、1280px 四个一级页面均无横向溢出；浅深主题四个一级页面 WCAG A/AA 自动检查通过（等待主题过渡完成后扫描）。
- 截图保存在 `output/playwright/cool-*.png`。

实际 iPhone Safari/PWA 软件键盘和主屏幕裁切仍需真机验收；浏览器自动化只能验证焦点与布局。本轮仅本地 Git 提交，不推送或部署。
