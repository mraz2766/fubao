import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const headers = { Origin: 'http://127.0.0.1:4321', 'X-Fubao-CSRF': '1' };
for (const width of [1440, 390])
  test(`clear page tasks and real saves at ${width}px`, async ({ page, request }) => {
    test.setTimeout(90000);
    page.setDefaultTimeout(12000);
    const workouts: string[] = [],
      trips: string[] = [];
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/login');
    await page.getByLabel('用户名', { exact: true }).fill('fubao');
    await page.getByLabel('密码', { exact: true }).fill('fubao');
    await page.getByRole('button', { name: '进入 Fubao', exact: true }).click();
    await page.waitForURL((u) => u.pathname === '/');
    page.on('dialog', (d) => d.accept());
    const screenshot = async (name: string) => {
      await page.waitForTimeout(300);
      return page.screenshot({
        path: `output/playwright/ia-after-${name}-${width}.png`,
        fullPage: true,
      });
    };
    const saveWorkout = async (label: string) => {
      const response = page.waitForResponse(
        (r) => r.url().includes('/api/fitness/sessions/') && r.request().method() === 'PUT',
      );
      await page.getByRole('button', { name: label, exact: true }).click();
      const res = await response;
      expect(res.ok()).toBe(true);
      const id = res.request().postDataJSON().id;
      if (!workouts.includes(id)) workouts.push(id);
      const w = await (await page.request.get(`/api/fitness/sessions/${id}`)).json();
      await page.waitForURL((u) => u.pathname === `/fitness/${w.id}`);
      return w;
    };
    try {
      await screenshot('home');
      expect(await page.locator('form').count()).toBe(0);
      await page.locator('.dashboard-fitness').click();
      await expect(page.locator('.task-tabs a')).toHaveCount(4);
      await expect(page.locator('form')).toHaveCount(0);
      await screenshot('fitness');
      await page.getByRole('link', { name: '记录今天的训练' }).click();
      await expect(page.getByRole('heading', { name: '记录训练', exact: true })).toBeVisible();
      await page.getByRole('button', { name: '背部', exact: true }).click();
      await page.getByLabel('训练时长（选填）', { exact: true }).fill('60');
      await expect(page.getByRole('button', { name: '背部', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await screenshot('workout-new');
      const quick = await saveWorkout('保存训练');
      expect(quick.duration_seconds).toBe(3600);
      expect(quick.exercises).toHaveLength(0);
      await expect(page.getByRole('heading', { name: '训练详情', exact: true })).toBeVisible();
      await expect(page.locator('form')).toHaveCount(0);
      await page.getByRole('button', { name: '编辑', exact: true }).click();
      await expect(page.getByRole('heading', { name: '编辑训练', exact: true })).toBeVisible();
      await page.getByLabel('备注', { exact: true }).fill('Discard this edit');
      await page.waitForTimeout(1100);
      expect(
        (await (await page.request.get(`/api/fitness/sessions/${quick.id}`)).json()).note,
      ).toBe('');
      await page.getByRole('button', { name: '取消', exact: true }).click();
      await page.waitForURL((u) => u.pathname === `/fitness/${quick.id}`);
      await page.getByRole('button', { name: '编辑', exact: true }).click();
      await page.getByLabel('备注', { exact: true }).fill('IA verified edit');
      const edited = await saveWorkout('保存修改');
      expect(edited.note).toBe('IA verified edit');
      expect((await request.get(`/api/fitness/sessions/${quick.id}`)).status()).toBe(404);
      await page.goto('/fitness/new');
      await page.getByRole('button', { name: '背部', exact: true }).click();
      await page.locator('.exercise-details>summary').click();
      await page.getByRole('button', { name: '添加动作', exact: true }).click();
      await expect(page.locator('.workout-picker .section-tabs button')).toHaveCount(3);
      await page.getByRole('textbox', { name: '搜索', exact: true }).fill('barbell deadlift');
      await page.locator('.exercise-open').first().click();
      await page.getByLabel('重量 (kg)', { exact: true }).first().fill('80');
      await page.getByLabel('次数', { exact: true }).first().fill('5');
      await page.getByRole('button', { name: '记一组', exact: true }).first().click();
      await screenshot('workout-exercise');
      const detailed = await saveWorkout('保存训练');
      expect(
        detailed.exercises[0].sets.some((s: any) => s.completed && s.weight === 80 && s.reps === 5),
      ).toBe(true);
      await screenshot('workout-detail');
      await page.goto('/travel');
      await expect(page.locator('form')).toHaveCount(0);
      await screenshot('travel');
      await page.getByRole('link', { name: '记录一次旅行' }).click();
      await page.getByLabel('地点', { exact: true }).fill('shanghai');
      await page
        .getByRole('button')
        .filter({ has: page.getByText('上海', { exact: true }) })
        .first()
        .click();
      await page.locator('input[type=file]').setInputFiles('tests/fixtures/photo.jpg');
      await page.getByLabel('旅行描述', { exact: true }).fill(`IA trip ${width}`);
      await expect(page.getByRole('button', { name: '保存旅行', exact: true })).toBeEnabled();
      await screenshot('travel-new');
      let response = page.waitForResponse(
        (r) => r.url().endsWith('/api/travel/entries') && r.request().method() === 'POST',
      );
      await page.getByRole('button', { name: '保存旅行', exact: true }).click();
      let res = await response;
      expect(res.ok()).toBe(true);
      const tripId = res.request().postDataJSON().id;
      trips.push(tripId);
      const trip = await (await page.request.get(`/api/travel/entries/${tripId}`)).json();
      await page.waitForURL((u) => u.pathname === `/travel/${trip.id}`);
      expect(trip.photos).toHaveLength(1);
      expect((await request.get(`/api/media/${trip.photos[0].id}/large`)).status()).toBe(404);
      await screenshot('travel-detail');
      await page.getByRole('button', { name: '编辑', exact: true }).click();
      await page.getByRole('button', { name: '更换', exact: true }).click();
      await page.route('**/api/locations?*', (route) =>
        route.fulfill({ status: 503, json: { error: { code: 'INTERNAL' } } }),
      );
      await page.getByLabel('地点', { exact: true }).fill(`Private meadow ${width}`);
      await page.getByRole('button', { name: new RegExp('使用此地点名称') }).click();
      await page.getByLabel('旅行描述', { exact: true }).fill('Edited with manual location');
      response = page.waitForResponse(
        (r) => r.url().endsWith('/api/travel/entries') && r.request().method() === 'POST',
      );
      await page.getByRole('button', { name: '保存修改', exact: true }).click();
      res = await response;
      expect(res.ok()).toBe(true);
      await page.waitForURL((u) => u.pathname === `/travel/${trip.id}`);
      await expect(
        page.getByRole('heading', { name: `Private meadow ${width}`, exact: true }),
      ).toBeVisible();
      await page.goto('/');
      await screenshot('home-with-photo');
      if (width === 390)
        expect(
          (await page.locator('.dashboard-travel').boundingBox())!.y +
            (await page.locator('.dashboard-travel').boundingBox())!.height,
        ).toBeLessThan(772);
      await page.setViewportSize({ width, height: 400 });
      await page.goto('/travel');
      await page.evaluate(() => scrollTo(0, 120));
      await page.locator('.travel-card').first().click();
      await page.locator('a[data-travel-back]').click();
      await expect
        .poll(async () =>
          page.evaluate(() =>
            Math.abs(scrollY - JSON.parse(sessionStorage.getItem('fubao.travel-scroll')!).y),
          ),
        )
        .toBeLessThan(3);
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/settings');
      await page.getByText('默认训练设置', { exact: true }).click();
      await screenshot('settings');
      for (const path of ['/', '/fitness', '/fitness/new', '/travel', '/travel/new', '/settings']) {
        await page.goto(path);
        await page.waitForTimeout(150);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        const violations = (
          await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
        ).violations;
        expect(violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
          [],
        );
      }
    } finally {
      for (const id of workouts)
        await page.request.delete(`/api/fitness/sessions/${id}`, { headers });
      for (const id of trips) await page.request.delete(`/api/travel/entries/${id}`, { headers });
    }
  });

test('stalled upload becomes recoverable; retry saves the same optimized photo', async ({
  page,
}) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(12000);
  await page.request.post('/api/auth/login', {
    headers,
    data: { username: 'fubao', password: 'fubao' },
  });
  await page.addInitScript(() => {
    let stall = true;
    const send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (body) {
      if (stall && body instanceof FormData && body.has('large')) {
        stall = false;
        this.upload.dispatchEvent(
          new ProgressEvent('progress', { lengthComputable: true, loaded: 99, total: 100 }),
        );
        return;
      }
      return send.call(this, body);
    };
  });
  await page.goto('/travel/new');
  await page.clock.install();
  await page.getByLabel('地点', { exact: true }).fill('shanghai');
  await page
    .getByRole('button')
    .filter({ has: page.getByText('上海', { exact: true }) })
    .first()
    .click();
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/photo.jpg');
  await expect(page.getByText('99%', { exact: false })).toBeVisible();
  await page.clock.fastForward(31000);
  await expect(page.getByText(/上传超时，照片已优化完成/)).toBeVisible();
  await expect(page.getByRole('button', { name: '删除照片', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByRole('button', { name: '保存旅行', exact: true })).toBeEnabled();
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/travel/entries') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '保存旅行', exact: true }).click();
  const res = await response;
  const id = res.request().postDataJSON().id;
  try {
    expect(res.ok()).toBe(true);
    await page.waitForURL((u) => u.pathname === `/travel/${id}`);
  } finally {
    await page.request.delete(`/api/travel/entries/${id}`, { headers });
  }
});

test('compact forms, narrow screens, English, dark mode and reduced motion', async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  await page.request.post('/api/auth/login', {
    headers,
    data: { username: 'fubao', password: 'fubao' },
  });
  await context.addCookies([
    { name: 'fubao.locale', value: 'en-US', url: 'http://127.0.0.1:4321' },
  ]);
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ['/', '/fitness', '/fitness/new', '/travel', '/travel/new', '/settings']) {
      await page.goto(path);
      await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
      await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (width === 390 && path === '/fitness/new') {
        const button = page.getByRole('button', { name: 'Save workout', exact: true });
        await expect(button).toBeVisible();
        const box = await button.boundingBox();
        expect(box!.y + box!.height).toBeLessThan(775);
        expect(box!.height).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: 'output/playwright/ia-after-english-dark-390.png' });
      }
    }
  }
});

test('login cannot submit before hydration on a slow connection', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/_astro/*.js', async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('input[name=username]')).toBeDisabled();
  await expect(page.locator('form')).toHaveAttribute('method', 'post');
  await expect(page.locator('button[type=submit]')).toBeDisabled();
  expect(new URL(page.url()).search).toBe('');
  release();
  await page.getByLabel('用户名', { exact: true }).fill('fubao');
  await page.getByLabel('密码', { exact: true }).fill('fubao');
  await page.getByRole('button', { name: '进入 Fubao', exact: true }).click();
  await page.waitForURL((u) => u.pathname === '/');
});

test('editing an in-progress workout does not silently complete it', async ({ page }) => {
  await page.request.post('/api/auth/login', {
    headers,
    data: { username: 'fubao', password: 'fubao' },
  });
  const id = crypto.randomUUID();
  const created = await page.request.post('/api/fitness/sessions', {
    headers,
    data: {
      id,
      title: 'In progress regression',
      mode: 'quick',
      status: 'active',
      body_parts: ['back'],
      start_at: new Date().toISOString(),
      end_at: null,
      timezone: 'Asia/Shanghai',
      note: '',
      visibility: 'private',
      exercises: [],
    },
  });
  expect(created.ok()).toBe(true);
  try {
    await page.goto(`/fitness/${id}/edit`);
    await page.getByLabel('备注', { exact: true }).fill('Still training');
    await page.getByRole('button', { name: '保存修改', exact: true }).click();
    await page.waitForURL((u) => u.pathname === `/fitness/${id}`);
    expect((await (await page.request.get(`/api/fitness/sessions/${id}`)).json()).status).toBe(
      'active',
    );
    await page.getByRole('button', { name: '编辑', exact: true }).click();
    await page.locator('.record-metadata>summary').click();
    await page.getByRole('button', { name: '完成训练', exact: true }).click();
    await page.waitForURL((u) => u.pathname === `/fitness/${id}`);
    expect((await (await page.request.get(`/api/fitness/sessions/${id}`)).json()).status).toBe(
      'completed',
    );
  } finally {
    await page.request.delete(`/api/fitness/sessions/${id}`, { headers });
  }
});
