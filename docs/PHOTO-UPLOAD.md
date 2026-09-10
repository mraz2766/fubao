# 旅行照片兼容性

原图在浏览器逐张处理，不发送到第三方转换服务。每条旅行保持 1–6 张照片。

- 原图最多 80 MiB、1 亿像素。按文件签名识别格式，不依赖扩展名或 File.type。
- JPEG、PNG、WebP、HEIC/HEIF、AVIF、GIF、BMP 可选；AVIF 等格式依赖浏览器解码能力，GIF 保存静态画面。RAW/TIFF 需先导出 JPEG。
- 优先使用原生 ImageBitmap / Image 解码；HEIC 原生解码失败时按需加载固定版本 heic-to 1.5.2 Worker。每张处理后释放 Worker、位图和 canvas 内存。普通页面和普通照片不加载该转换器。
- 大图最长边 1920px、最多 4 MiB；缩略图最长边 480px、最多 300 KiB。压缩先降低质量，再降低分辨率。
- 默认 WebP；浏览器不支持该编码时使用 JPEG。Safari canvas 添加的 EXIF/IPTC 在上传前移除，旋转方向已写入像素。服务端再次校验格式、尺寸和敏感元数据。
- R2 对象按实际格式使用 `.webp` / `.jpg`。读取响应匹配格式且保留权限检查、`private, no-store`；备份导入兼容两类引用，无数据库迁移。
- 一张失败不阻塞同批其他照片。失败行显示文件名、原因及重试。网络失败保留已优化图片；解码失败保留原文件。失败照片需重试或移除后才能保存旅行。

验证：`pnpm test`、`pnpm exec playwright test tests/e2e/photo-upload.spec.ts`、`pnpm build`。
浏览器测试需要 Chromium 和 WebKit：`pnpm exec playwright install chromium webkit`。
合成测试图片位于 `tests/fixtures`，涵盖 48MP、超过旧 30MB 上限、HEIC、AVIF、EXIF 旋转、Safari JPEG、坏图继续、网络重试和私有照片访问。

本次放宽原图输入，不增加 R2 单张输出上限，不新增付费服务。转换器来源和许可证见 About 及 `THIRD_PARTY_NOTICES.md`。
