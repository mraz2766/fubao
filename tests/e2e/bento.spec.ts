import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const headers = { Origin: 'http://127.0.0.1:4321', 'X-Fubao-CSRF': '1' };

test('Bento entry is immediate, ordered, and does not replay on restore or reduced motion', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__entries = [];
    document.addEventListener(
      'animationstart',
      (event) => {
        if (event.animationName !== 'bento-arrive') return;
        const target = event.target as HTMLElement;
        const style = getComputedStyle(target);
        (window as any).__entries.push({
          key: target.getAttribute('aria-labelledby'),
          delay: style.animationDelay,
          duration: style.animationDuration,
          opacity: style.opacity,
        });
      },
      true,
    );
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const entries = await page.evaluate(() => (window as any).__entries);
  expect(entries).toHaveLength(3);
  expect(entries.map((e: any) => e.delay)).toEqual(['0s', '0.04s', '0.08s']);
  expect(entries.every((e: any) => e.opacity === '1' && e.duration === '0.2s')).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.dashboard-weekly').scrollIntoViewIfNeeded();
  await expect(page.locator('.dashboard-recent')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__entries.length)).toBe(3);
  await page.goto('/fitness');
  await page.goBack();
  await page.waitForLoadState('networkidle');
  expect(await page.locator('html').getAttribute('data-bento-motion')).toBeNull();
  expect(
    await page
      .locator('.home-bento > .card')
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe('none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.waitForLoadState('networkidle');
  expect(await page.evaluate(() => (window as any).__entries)).toEqual([]);
  expect(
    await page
      .locator('.home-bento > .card')
      .first()
      .evaluate((e) => getComputedStyle(e).transform),
  ).toBe('none');
});

test('populated Bento keeps the first screen compact, honors widgets and records entry videos', async ({
  page,
  browser,
  context,
  request,
}) => {
  test.setTimeout(150000);
  await page.request.post('/api/auth/login', {
    headers,
    data: { username: 'fubao', password: 'fubao' },
  });
  const settings = await (await page.request.get('/api/settings')).json();
  const ids: string[] = [];
  let tripId = '';
  try {
    await page.request.put('/api/settings', {
      headers,
      data: {
        ...settings,
        preferences: { ...settings.preferences, theme: 'light', language: 'zh-CN', weeklyGoal: 1 },
        widgets: ['fitness', 'travel', 'weekly', 'recent'].map((key, order) => ({
          key,
          order,
          visible: true,
          size: 'medium',
        })),
      },
    });
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: settings.preferences.timezone,
    }).format(new Date());
    const id = crypto.randomUUID();
    ids.push(id);
    expect(
      (
        await page.request.post('/api/fitness/checkin', {
          headers,
          data: { id, mutation_id: crypto.randomUUID(), date, part: 'back' },
        })
      ).ok(),
    ).toBe(true);
    const olderId = crypto.randomUUID();
    ids.push(olderId);
    const yesterday = new Date(date + 'T12:00:00Z');
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    expect(
      (
        await page.request.post('/api/fitness/checkin', {
          headers,
          data: {
            id: olderId,
            mutation_id: crypto.randomUUID(),
            date: yesterday.toISOString().slice(0, 10),
            part: 'chest',
          },
        })
      ).ok(),
    ).toBe(true);
    await page.goto('/fitness');
    await page.getByRole('button', { name: '开始训练', exact: true }).click();
    const launch = page.getByRole('dialog');
    await expect(launch).toBeVisible();
    await launch.getByRole('button', { name: /^(开始训练|开始另一场训练)$/ }).click();
    await expect(page).toHaveURL(/\/fitness\/[\w-]+$/);
    ids.push(new URL(page.url()).pathname.split('/').at(-1)!);
    await page.goto('/travel?new=1');
    await page.getByLabel('地点', { exact: true }).fill('guilin');
    await page
      .getByRole('button')
      .filter({ has: page.getByText('桂林', { exact: true }) })
      .first()
      .click();
    await page
      .getByRole('dialog')
      .locator('input[type=file]')
      .setInputFiles('public/scenery/li-river-small.webp');
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/\/travel\/[a-f0-9-]+$/);
    tripId = new URL(page.url()).pathname.split('/').at(-1)!;
    await expect(page.locator('[data-save-feedback]')).toBeVisible();
    await expect(page.locator('[data-save-feedback] [role=status]')).toHaveText('这一站，记下了');
    await page.reload();
    await expect(page.locator('[data-save-feedback]')).toBeHidden();
    expect((await request.get('/api/travel/entries/' + tripId)).status()).toBe(404);

    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1440, height: 1000 },
    ]) {
      const name = viewport.width === 390 ? 'mobile' : 'desktop';
      const videoContext = await browser.newContext({
        baseURL: 'http://127.0.0.1:4321',
        storageState: await context.storageState(),
        viewport,
        recordVideo: { dir: 'output/playwright/bento-videos', size: viewport },
      });
      const videoPage = await videoContext.newPage();
      await videoPage.goto('/');
      await videoPage.waitForLoadState('networkidle');
      await expect(videoPage.locator('.dashboard-resume')).toBeVisible();
      await expect(videoPage.locator('.mobile-header > a')).toHaveCount(1);
      await expect(videoPage.locator('.sidebar-bottom a[href="/settings"]')).toHaveCount(0);
      await expect(videoPage.locator('.week-day[aria-current="date"]')).toHaveCount(1);
      await expect(videoPage.locator('.dashboard-photo')).not.toContainText('日期未设置');

      await expect(videoPage.locator('[data-goal-week] .success-mark')).toHaveAttribute(
        'data-celebrate',
        'true',
      );
      if (viewport.width === 390) {
        const nav = await videoPage.locator('.mobile-nav').boundingBox();
        for (const key of ['fitness', 'travel', 'weekly']) {
          const card = await videoPage.locator('.dashboard-' + key).boundingBox();
          expect(card!.y + card!.height, key).toBeLessThanOrEqual(nav!.y);
        }
      } else {
        const fitness = await videoPage.locator('.dashboard-fitness').boundingBox();
        const travel = await videoPage.locator('.dashboard-travel').boundingBox();
        const weekly = await videoPage.locator('.dashboard-weekly').boundingBox();
        expect(travel!.x).toBeGreaterThan(fitness!.x);
        expect(weekly!.x).toBe(fitness!.x);
        expect(Math.abs(travel!.y + travel!.height - weekly!.y - weekly!.height)).toBeLessThan(2);
      }
      await videoPage.screenshot({ path: `output/playwright/bento-${name}.png`, fullPage: true });
      await videoPage.waitForTimeout(1800); // Keep a short, usable recording of entry + settled state.
      const video = videoPage.video();
      await videoContext.close();
      await video?.saveAs(`output/playwright/bento-entry-${name}.webm`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // This tab already acknowledged the weekly goal on the fitness page.
    await expect(page.locator('[data-goal-week] .success-mark')).not.toHaveAttribute(
      'data-celebrate',
    );
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-goal-week] .success-mark')).not.toHaveAttribute(
      'data-celebrate',
    );
    // A slow photo cannot postpone the cards or keep the UI from responding.
    await page.route('**/api/media/*/thumbnail', async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      await route.continue();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.dashboard-fitness')).toBeVisible();
    await page.waitForLoadState('networkidle');
    await page.unroute('**/api/media/*/thumbnail');

    for (const locale of ['zh-CN', 'en-US']) {
      await context.addCookies([
        { name: 'fubao.locale', value: locale, url: 'http://127.0.0.1:4321' },
      ]);
      for (const theme of ['light', 'dark']) {
        await page.request.patch('/api/settings', { headers, data: { preferences: { theme } } });
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        for (const width of [320, 390, 768, 1440]) {
          await page.setViewportSize({ width, height: 844 });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
        }
        expect(
          (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
            .violations,
        ).toEqual([]);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({
          path: `output/playwright/bento-${locale}-${theme}.png`,
          fullPage: true,
        });
      }
    }
    await page.request.patch('/api/settings', {
      headers,
      data: {
        order: ['recent', 'travel', 'weekly', 'fitness'],
        widgets: [
          { key: 'weekly', visible: false },
          { key: 'travel', size: 'large' },
          { key: 'fitness', size: 'small' },
        ],
      },
    });
    await page.goto('/');
    await page.setViewportSize({ width: 1440, height: 1000 });
    expect(
      await page
        .locator('.home-bento > section')
        .evaluateAll((cards) => cards.map((e) => e.getAttribute('aria-labelledby'))),
    ).toEqual(['widget-recent', 'widget-travel', 'widget-fitness']);
    await expect(page.locator('.bento-editorial')).toHaveCount(0);
    await expect
      .poll(() => page.locator('.dashboard-travel').evaluate((e) => getComputedStyle(e).transform))
      .toBe('none');
    const travel = await page.locator('.dashboard-travel').boundingBox();
    const grid = await page.locator('.home-bento').boundingBox();
    expect(travel!.width).toBeCloseTo((grid!.width - 16) / 2, 0);
    await page.request.patch('/api/settings', {
      headers,
      data: {
        widgets: ['fitness', 'travel', 'weekly', 'recent'].map((key) => ({
          key,
          visible: true,
          size: 'small',
        })),
      },
    });
    await page.setViewportSize({ width: 768, height: 1000 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    for (const key of ['fitness', 'travel', 'weekly', 'recent']) {
      expect(
        await page.locator('.dashboard-' + key).evaluate((el) => el.scrollWidth <= el.clientWidth),
        key + ' small',
      ).toBe(true);
    }
  } finally {
    for (const id of ids) await page.request.delete('/api/fitness/sessions/' + id, { headers });
    if (tripId) await page.request.delete('/api/travel/entries/' + tripId, { headers });
    await page.request.post('/api/travel/cleanup', { headers, data: {} });
    await page.request.put('/api/settings', { headers, data: settings });
  }
});
