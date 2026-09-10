# Fubao

线上地址： https://fubao.mraz2766.workers.dev

个人生活 Dashboard：记录训练、回顾旅行与照片。默认简体中文，支持 English、明暗主题、桌面侧栏和移动端底部导航。

使用 Astro、React Islands、TypeScript、Tailwind 与 shadcn/ui，运行于 Cloudflare Workers；业务数据保存到 D1，照片保存到私有 R2。没有独立 Node 服务，也没有生产环境实时 GitHub 数据请求。

## 快速开始

需要 Node.js 22.12+（建议 Node 24）和 pnpm 11.19。无需 Cloudflare 账号即可使用本地 D1/R2 模拟环境。

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:init
pnpm data:sync:fitness
pnpm data:sync:locations --country=CN
pnpm data:sync:scenic
pnpm dev
```

打开终端给出的本地地址，通常为 `http://127.0.0.1:4321`。初始账号和密码都是 `fubao`，可以在设置中修改。初始化命令只在没有用户时创建账号，重复执行不会重置密码。

地图已随代码保存，不必重复下载。首次地点导入约 15 万城市，本机验证约需 20 分钟，实际时间取决于网络和存储。**先完成导入，再启动开发/预览服务器**，避免多个本地 Workers 进程同时写 SQLite 导致锁库。

## 使用

- 健身 → 新建训练：快速打卡只填名称和时间；详细记录支持动作、逐组记录、保存进行中的训练。
- 动作库支持中英文搜索、肌群和器械筛选、收藏、最近和常用；模板可直接开始训练。
- 旅行 → 添加足迹：选择地点并上传 1–6 张照片。浏览器优化图片，支持排序和可确认的 EXIF 建议。
- 记录默认私人。主动公开后，访客才可看到记录、照片及相关统计。
- 设置 → 数据与备份：导出带 `schemaVersion` 的 JSON；导入先预览，已有 ID 默认跳过。
- JSON 不包含照片文件；只有当前 R2 存在对应照片时才能恢复旅行。

## 配置

`wrangler.jsonc` binds the production D1 and private R2 bucket `fubao`. Forks must create their own resources and replace the database ID and bucket bindings.

`FUBAO_USERNAME` / `FUBAO_PASSWORD` 仅供 `pnpm db:init` 初始化时读取，可通过终端环境变量提供。不会写入前端，也不会在部署中自动创建用户。

默认偏好为简体中文、跟随系统、kg、km、周一、每周 3 次、`Asia/Shanghai`。本人偏好保存至 D1，访客显示偏好保存在设备与 Cookie。

## 数据同步

```sh
pnpm data:sync:fitness --dry-run
pnpm data:sync:locations --dry-run
pnpm data:sync:map --dry-run

# 写入已配置的远程 D1
pnpm data:sync:fitness --remote
pnpm data:sync:locations --country=CN --remote
pnpm data:sync:scenic --remote
pnpm data:sync:scenery
```

来源 commit 固定在 `data/sources.lock.json`。下载和 SQL 缓存位于忽略提交的 `data/cache`、`data/generated`；导入版本、SHA-256、数量和许可写入 D1。

更新来源时先修改锁定 commit，执行 dry-run，补齐新增动作中文名称，再导入。重复同步使用 upsert，旧动作停用但不删除历史引用。构建不会自动同步数据。

动作媒体没有随 MIT 文字许可导入。详情提供文字及肌群示意；图片/GIF 必须获得独立授权。参见 [第三方声明](THIRD_PARTY_NOTICES.md)。

地点源没有完整的全球城市中文译名；保留其原生/英文名称，并通过 `data/location-names.zh-CN.json` 补充常用城市搜索。国家和省州优先使用来源翻译。About 可单独下载派生地点数据，不包含个人记录。

## 开发与验证

```sh
pnpm check
pnpm test
pnpm build
pnpm preview

# 在另一个终端，预览服务器运行于 4321 端口
pnpm exec playwright install chromium
pnpm exec playwright test
```

浏览器测试使用本地默认账号，创建临时记录并清理；不要对生产运行。报告位于 `output/playwright/report`。

Astro 的开发/预览命令可以后台运行：

```sh
pnpm exec astro dev status
pnpm exec astro dev logs
pnpm exec astro dev stop
pnpm exec astro preview stop
```

领域代码在 `src/features`，服务端逻辑在 `src/server`，数据库迁移在 `migrations`，双语文案在 `src/locales`。禁止在请求处理期间自动改表。

## 常见问题

**数据库不可用**：停止开发/预览服务器，执行 `pnpm db:migrate` 和 `pnpm db:init`，再启动。

**同步或代理超时**：可重新运行，已完成的 upsert 不会重复创建记录。Node 24 可使用 `NODE_USE_ENV_PROXY=1 pnpm data:sync:locations` 跟随已有代理。

**照片上传**：支持 JPEG、PNG、WebP、HEIC/HEIF，以及浏览器可解码的 AVIF、GIF、BMP；原图每张最多 80MB、1 亿像素。照片自动缩小并去除元数据，WebP 编码不可用时自动使用 JPEG。每张失败照片会显示原因，可单独重试；RAW/TIFF 需先导出 JPEG。每条旅行仍为 1–6 张，GIF 只保存静态画面。

**R2 删除延迟**：记录访问立即失效，对象进入持久化清理队列，每日执行并自动重试。本人可调用 `POST /api/travel/cleanup` 手动清理一批。

**离线无法查看历史**：PWA 仅缓存静态 App Shell，私人记录、API 和照片不会进入 Service Worker 缓存。

## Cloudflare

已上线：https://fubao.mraz2766.workers.dev 。发布链路已连接为 GitHub `main` → Cloudflare Workers Builds → 测试与 Astro Build → D1 migrations → Worker 部署。首次验证提交为 `804d6fd`。GitHub Actions 另行运行检查，不承担部署。详见 [部署说明](docs/DEPLOYMENT.md) 和 [实施记录](docs/IMPLEMENTATION.md)。

Workers uses the Free plan. R2 Standard includes a free monthly allowance but may bill usage beyond it. No paid Workers upgrade was enabled. Production imports all countries and China regions/cities to stay within D1 Free daily write limits; the complete global catalog remains available locally.

## Design and destinations

Graphite/violet theme adapted from tweakcn, Tremor progress components, BoardUI labels, and destination-first travel workflows. See [design references and licenses](docs/DESIGN.md).

The scenic catalog includes 12 domestic destinations with licensed real photographs, province/type/personal-status filters, wishlist and visit links, plus custom place names. Catalog photos do not count as personal visits. Metadata and credits live in `src/data/scenic-spots.json`, images in `public/scenery`; About shows attribution.
