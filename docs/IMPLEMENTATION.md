# 实施与验收记录

版本：0.1.0。验收环境：2026-09-10，Node 24、pnpm 11.19、Chromium 153、本地 Cloudflare Workers / D1 / R2 模拟环境。

## 产品与工程

暖白、炭灰和低饱和绿构成统一视觉系统。首页为 12 列 Bento；移动端为单列和底部导航。健身以数字和活动进度表达，旅行以地图、照片和时间线表达。真实数据库没有记录时展示空状态，不注入虚构生活数据。

| 阶段 | 本地交付状态                                                                                                                        |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Astro / Workers / React / Tailwind / strict TypeScript，四页布局、双语、主题和响应式导航已运行。                                    |
| 2    | Dashboard 视觉、空状态和 CSS 过渡已实现；最终生产代码不包含 Mock 数据。                                                             |
| 3    | 显式 migrations、账号初始化、登录/退出/改密、同源写入校验、私人/公开和快速训练 CRUD 已实现。                                        |
| 4    | 固定 commit 导入 1,324 个动作；中文名称和说明覆盖率均为 100%；搜索、筛选、收藏、最近与常用已接 D1。未引入受独立许可约束的动作图片。 |
| 5    | 详细训练、继承上一组重量、模板计划组与复制启动、进行中恢复、日历、统计、肌群和 PR 已实现。                                          |
| 6    | 地点分层搜索、Natural Earth 地图、Wishlist、旅行记录和时间线已接真实数据库。                                                        |
| 7    | 1–6 张图片约束、浏览器 WebP 压缩、大图/缩略图、EXIF 确认建议、排序、重试、Lightbox、照片墙及持久清理队列已实现。                    |
| 8    | 首页读取按访问身份过滤的真实训练与旅行记录；访客统计不包含私人记录。                                                                |
| 9    | 偏好与 Widget 保存、JSON 导入预览/去重/恢复、About 与来源声明、PWA 静态缓存已实现。                                                 |
| 10   | 本地类型检查、构建、领域与浏览器测试、响应式和自动化可访问性检查已执行；正式部署、真机和线上性能仍待外部环境。                      |

## 数据验收

- 本地目录：250 个国家、5,308 个省州、152,970 个源城市；另有 4 个中国直辖市的城市级派生条目，总计 152,974 个城市。
- 动作：1,324 条，中文名称与中文步骤均完整；未授权媒体数为 0。
- SQLite `foreign_key_check`：0 个违反约束的关联。
- 动作重复同步：新增 0、删除 0，无重复记录；源文件 SHA-256 使用固定 commit 的原始文件字节。
- 地点中文别名是增补层，并非所有全球城市都已有人工中文译名；缺省使用原生或英文名称。动作名称也建议随实际使用持续校对专业术语。

## 已执行验证

- `pnpm test`：40 项测试通过，涉及统计边界、时区、连续训练、Epley、旅行日期并集、单位换算、输入校验、密码与 WebP 头验证。
- `pnpm build`：Astro 检查 0 error、0 warning、0 hint，Workers 构建成功。
- `pnpm exec playwright test`：7 项浏览器测试通过。流程覆盖：快速打卡、私人/公开、实际 WebP 上传、照片权限撤销、模板独立复制、组记录、PR 重算、JSON 预览/跳过/恢复、未登录与缺少 CSRF 的写入拒绝。
- 320、390、768、1024、1440px，中英文和明暗主题；主要页面未发现横向溢出。axe 检查 WCAG 2 A/AA 与 2.1 AA；Reduced Motion 下仍能使用。
- Worker `deploy --dry-run` 成功，识别 DB、PHOTOS 与 ASSETS 绑定。这不是远程部署成功的证明。
- 受控本地移动基线：390×844、CPU 4 倍降速、150ms 网络延迟、约 1.6Mbps 下行；LCP 704ms、CLS 0、首页脚本（含内联）gzip 388 bytes。此结果为无个人记录的 SSR 首页，不包含打开后才加载的编辑器。
- 浏览器生成的截图、报告及受控性能记录保存在忽略提交的 `output/playwright/`。

## Production status (2026-09-10)

Remote D1 created; user's R2 `fubao` verified private, APAC, Standard. Worker deployed with Wrangler to https://fubao.mraz2766.workers.dev; homepage and login return 200. Workers Free confirmed; no upgrade made. GitHub Workers Builds still needs repository authorization (local OAuth returns 403). Other account projects were not changed.

Remote catalogs: 1,324 exercises, 4,421 locations (250 countries, 34 China regions, 4,137 cities including municipal derivatives), 12 scenic spots. Full global catalog remains local. Migrations 0003/0004 add scenic association and custom place names. Licensed catalog photos are committed static assets; personal photos remain private R2 objects.

Graphite/violet redesign supersedes earlier white/blue and warm/green versions. Local validation includes 40 unit tests and 8 E2E flows; rerun after visual changes. See `docs/DESIGN.md` for source reuse.

Physical-device photo picker/PWA/keyboard tests, production field performance and long-term cleanup behavior remain to be verified; local emulation is not a substitute.
