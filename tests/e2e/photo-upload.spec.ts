import { test, expect, webkit, type Page, type APIRequestContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
const base = 'http://127.0.0.1:4321';
const headers = { Origin: base, 'X-Fubao-CSRF': '1' };
async function login(request: APIRequestContext) {
  expect(
    (
      await request.post('/api/auth/login', {
        headers,
        data: { username: 'fubao', password: 'fubao' },
      })
    ).ok(),
  ).toBe(true);
}
async function openForm(page: Page) {
  await page.goto('/travel?new=1');
  await page.getByLabel('地点', { exact: true }).fill('shanghai');
  await page
    .getByRole('button')
    .filter({ has: page.getByText('上海', { exact: true }) })
    .first()
    .click();
}
async function saveTrip(page: Page) {
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled({
    timeout: 30000,
  });
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page).toHaveURL(/\/travel\/[a-f0-9-]+$/);
  return new URL(page.url()).pathname.split('/').at(-1)!;
}
async function clean(page: Page, id?: string) {
  if (id) await page.request.delete('/api/travel/entries/' + id, { headers });
  await page.request.post('/api/travel/cleanup', { headers, data: {} });
}

test('mixed batch accepts HEIC, AVIF, unknown MIME and >30MB originals; failed photo does not stop the next', async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  await login(page.request);
  await page.setViewportSize({ width: 390, height: 844 });
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  const uploads: any[] = [];
  const sharp = (await import('sharp')).default;
  page.on('response', async (r) => {
    if (r.url().endsWith('/api/travel/photos') && r.ok()) uploads.push(await r.json());
  });
  let id = '';
  try {
    await openForm(page);
    await page.waitForLoadState('networkidle');
    expect(requests.some((url) => /heic[.-](worker|decoder)/.test(url))).toBe(false);
    await page
      .getByRole('dialog')
      .locator('input[type=file]')
      .setInputFiles([
        {
          name: 'broken-camera.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('not a photograph'),
        },
        {
          name: 'camera-export.bin',
          mimeType: 'application/octet-stream',
          buffer: await sharp('tests/fixtures/photo.jpg').resize(8000, 6000).jpeg().toBuffer(),
        },
        {
          name: 'large-original.jpg',
          mimeType: 'image/jpg',
          buffer: Buffer.concat([
            await readFile('tests/fixtures/photo.jpg'),
            Buffer.alloc(31 * 1024 * 1024),
          ]),
        },
        {
          name: 'phone.heic',
          mimeType: 'image/heic',
          buffer: await readFile('tests/fixtures/photo.heic'),
        },
        {
          name: 'image.avif',
          mimeType: 'image/avif',
          buffer: await readFile('tests/fixtures/photo.avif'),
        },
        {
          name: 'rotated.jpg',
          mimeType: 'image/jpeg',
          buffer: await readFile('tests/fixtures/rotated-exif.jpg'),
        },
      ]);
    await expect.poll(() => uploads.length, { timeout: 90000 }).toBe(5);
    const failed = page.locator('.upload-photo').filter({ hasText: 'broken-camera.jpg' });
    await expect(failed.getByRole('alert')).toContainText('暂不支持此文件格式');
    await expect(failed.getByRole('button', { name: '重试', exact: true })).toBeEnabled();
    expect(requests.some((url) => url.includes('heic.worker'))).toBe(true);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.evaluate(async () => {
      await Promise.all(
        document.getAnimations().map((animation) => animation.finished.catch(() => {})),
      );
    });
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: 'output/playwright/photo-mixed-batch.png',
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: '整理照片', exact: true }).click();
    page.once('dialog', (d) => d.accept());
    await failed.getByRole('button', { name: '删除照片' }).click();
    id = await saveTrip(page);
    const trip = await (await page.request.get('/api/travel/entries/' + id)).json();
    expect(trip.photos).toHaveLength(5);
    expect(trip.photos[0]).toMatchObject({ width: 1920, height: 1440 });
    expect(trip.photos[4]).toMatchObject({ width: 480, height: 640 });
    expect((await request.get('/api/media/' + trip.photos[0].id + '/large')).status()).toBe(404);
    for (const photo of trip.photos) {
      expect(photo.size).toBeLessThanOrEqual(4 * 1024 * 1024);
      expect(Math.max(photo.width, photo.height)).toBeLessThanOrEqual(1920);
    }
  } finally {
    await clean(page, id);
  }
});

test('JPEG fallback and image-element decoding work; network retry keeps optimized file', async ({
  page,
}) => {
  await login(page.request);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'createImageBitmap', { value: undefined });
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      return original.call(this, callback, type === 'image/webp' ? 'image/png' : type, quality);
    };
  });
  let id = '',
    upload: any;
  try {
    await openForm(page);
    let failed = false;
    await page.route('**/api/travel/photos', (route) => {
      if (!failed) {
        failed = true;
        return route.abort();
      }
      return route.continue();
    });
    await page
      .getByRole('dialog')
      .locator('input[type=file]')
      .setInputFiles('tests/fixtures/photo.png');
    await expect(page.locator('.upload-photo').getByRole('alert')).toBeVisible();
    const receipt = page.waitForResponse((r) => r.url().endsWith('/api/travel/photos') && r.ok());
    await page.getByRole('button', { name: '重试', exact: true }).click();
    upload = await (await receipt).json();
    expect(upload.large_key).toMatch(/\/large\.jpg$/);
    expect(upload.thumbnail_key).toMatch(/\/thumbnail\.jpg$/);
    id = await saveTrip(page);
    const large = await page.request.get('/api/media/' + upload.id + '/large');
    expect(large.headers()['content-type']).toBe('image/jpeg');
    const bytes = await large.body();
    expect([...bytes.subarray(0, 3)]).toEqual([255, 216, 255]);
    expect((await page.request.get('/api/data/export')).ok()).toBe(true);
  } finally {
    await clean(page, id);
  }
});

test('server verifies JPEG metadata, dimensions and ownership; JPEG photo references restore through JSON', async ({
  page,
  request,
}) => {
  await login(page.request);
  const id = crypto.randomUUID(),
    photoId = crypto.randomUUID();
  const jpeg = await readFile('tests/fixtures/photo.jpg');
  const sharp = (await import('sharp')).default;
  const thumb = await sharp(jpeg).resize({ width: 480 }).jpeg().toBuffer();
  const file = (buffer: Buffer, mimeType = 'image/jpeg') => ({
    name: 'photo.jpg',
    mimeType,
    buffer,
  });
  try {
    const malformed = await page.request.post('/api/travel/photos', {
      headers,
      multipart: {
        id: photoId,
        travelId: id,
        large: file(await readFile('tests/fixtures/rotated-exif.jpg')),
        thumbnail: file(thumb),
      },
    });
    expect(malformed.status()).toBe(400);
    expect((await malformed.json()).error.code).toBe('PHOTO_UPLOAD_FORMAT');
    const dimensions = await page.request.post('/api/travel/photos', {
      headers,
      multipart: {
        id: photoId,
        travelId: id,
        large: file(await sharp(jpeg).resize(2000, 1000).jpeg().toBuffer()),
        thumbnail: file(thumb),
      },
    });
    expect((await dimensions.json()).error.code).toBe('PHOTO_UPLOAD_DIMENSIONS');
    const spoof = await page.request.post('/api/travel/photos', {
      headers,
      multipart: {
        id: photoId,
        travelId: id,
        large: file(jpeg, 'image/webp'),
        thumbnail: file(thumb),
      },
    });
    expect(spoof.status()).toBe(400);
    const response = await page.request.post('/api/travel/photos', {
      headers,
      multipart: {
        id: photoId,
        travelId: id,
        large: file(jpeg),
        thumbnail: file(thumb),
      },
    });
    expect(response.ok()).toBe(true);
    const photo = await response.json();
    const location = (await (await page.request.get('/api/locations?q=shanghai')).json()).items[0];
    const imported = await page.request.post('/api/data/import', {
      headers,
      data: {
        kind: 'trip',
        value: {
          id,
          location_id: location.id,
          start_date: null,
          end_date: null,
          description: '',
          tags: [],
          rating: null,
          visibility: 'private',
          photos: [{ ...photo, position: 0 }],
        },
      },
    });
    expect(imported.ok()).toBe(true);
    const trip = await (await page.request.get('/api/travel/entries/' + id)).json();
    expect(trip.photos[0].large_key).toBe(photo.large_key);
    expect((await request.get('/api/media/' + photoId + '/large')).status()).toBe(404);
  } finally {
    await clean(page, id);
  }
});

test('WebKit uploads camera photos through native decoding and canvas fallback', async () => {
  test.setTimeout(120000);
  const browser = await webkit.launch();
  const context = await browser.newContext({
    baseURL: base,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  let id = '';
  try {
    await login(page.request);
    await openForm(page);
    await page
      .locator('input[type=file]')
      .setInputFiles(['tests/fixtures/photo.heic', 'tests/fixtures/rotated-exif.jpg']);
    await expect
      .poll(async () => page.locator('.upload-photo').allTextContents(), { timeout: 90000 })
      .not.toEqual(expect.arrayContaining([expect.stringMatching(/处理中|等待处理|上传中/)]));
    await page.screenshot({ path: 'output/playwright/photo-webkit.png', fullPage: true });
    await expect(page.locator('.upload-photo').getByRole('alert')).toHaveCount(0);
    id = await saveTrip(page);
    const trip = await (await page.request.get('/api/travel/entries/' + id)).json();
    expect(trip.photos).toHaveLength(2);
    expect(trip.photos[1]).toMatchObject({ width: 480, height: 640 });
    for (const photo of trip.photos) {
      const response = await page.request.get('/api/media/' + photo.id + '/large');
      expect(response.ok()).toBe(true);
      expect(response.headers()['content-type']).toBe(
        photo.large_key.endsWith('.jpg') ? 'image/jpeg' : 'image/webp',
      );
    }
  } finally {
    await clean(page, id);
    await browser.close();
  }
});
