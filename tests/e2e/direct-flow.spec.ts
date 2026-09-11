import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const headers = { Origin: 'http://127.0.0.1:4321', 'X-Fubao-CSRF': '1' };
test.beforeEach(async ({ page }) => {
  expect(
    (
      await page.request.post('/api/auth/login', {
        headers,
        data: { username: 'fubao', password: 'fubao' },
      })
    ).ok(),
  ).toBe(true);
});
test('day scope and partial revisions preserve exercises, privacy, timestamps and idempotency', async ({
  page,
  request,
}) => {
  const id = crypto.randomUUID(),
    date = '2024-02-11';
  try {
    const create = await page.request.post('/api/fitness/checkin', {
      headers,
      data: { id, mutation_id: crypto.randomUUID(), date, part: 'back' },
    });
    const w = await create.json();
    expect(create.ok()).toBe(true);
    const full = await page.request.put(`/api/fitness/sessions/${id}`, {
      headers,
      data: {
        ...w,
        title: 'Keep my custom title',
        note: 'Keep this note',
        mode: 'detailed',
        exercises: [
          {
            id: crypto.randomUUID(),
            exercise_id: '0032',
            recording_type: 'weight',
            sets: [
              {
                id: crypto.randomUUID(),
                weight: 80,
                reps: null,
                duration: null,
                distance: null,
                rpe: null,
                note: '',
                completed: true,
              },
            ],
          },
        ],
      },
    });
    const original = await full.json();
    expect(full.ok()).toBe(true);
    const data = {
      revision: original.revision,
      mutation_id: crypto.randomUUID(),
      body_parts: ['back', 'arms'],
      duration_seconds: 1800,
    };
    const results = await Promise.all([
      page.request.patch(`/api/fitness/sessions/${id}`, { headers, data }),
      page.request.patch(`/api/fitness/sessions/${id}`, { headers, data }),
    ]);
    for (const r of results) expect(r.ok()).toBe(true);
    const saved = await (await page.request.get(`/api/fitness/sessions/${id}`)).json();
    expect(saved.exercises).toEqual(original.exercises);
    expect(saved.start_at).toBe(original.start_at);
    expect(saved.end_at).toBeNull();
    expect(saved.title).toBe(original.title);
    expect(saved.note).toBe(original.note);
    expect(saved.revision).toBe(original.revision + 1);
    expect(
      (
        await page.request.patch(`/api/fitness/sessions/${id}`, {
          headers,
          data: { ...data, mutation_id: crypto.randomUUID() },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await page.request.patch(`/api/fitness/sessions/${id}`, {
          headers,
          data: {
            ...data,
            revision: saved.revision,
            mutation_id: crypto.randomUUID(),
            body_parts: [],
          },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await page.request.patch(`/api/fitness/sessions/${id}`, {
          headers,
          data: {
            ...data,
            revision: saved.revision,
            mutation_id: crypto.randomUUID(),
            note: 'overwrite',
          },
        })
      ).status(),
    ).toBe(400);
    const day = await (await page.request.get(`/api/fitness/day?date=${date}`)).json();
    expect(day.items.some((w: any) => w.id === id)).toBe(true);
    expect(day.current.id).toBe(id);
    expect(day.items[0].exercises).toEqual([]);
    expect((await request.get(`/api/fitness/day?date=${date}`)).status()).toBe(401);
    expect((await request.patch(`/api/fitness/sessions/${id}`, { headers, data })).status()).toBe(
      401,
    );
    expect(
      (
        await page.request.patch(`/api/fitness/sessions/${crypto.randomUUID()}`, { headers, data })
      ).status(),
    ).toBe(404);
    const listed = await (await page.request.get('/api/fitness/sessions')).json();
    const fromList = listed.items.find((w: any) => w.id === id);
    if (fromList) expect(fromList.exercises).toEqual(original.exercises);
  } finally {
    await page.request.delete(`/api/fitness/sessions/${id}`, { headers });
  }
});
test('photo-first picker, optional date, folded location, compact controls and private lightbox', async ({
  page,
  request,
}) => {
  let id = '';
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/travel');
    const picker = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '记录旅行', exact: true }).click();
    await (await picker).setFiles('tests/fixtures/photo.jpg');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('.upload-photo img')).toHaveCount(1);
    await expect(page.getByText('请选择地点', { exact: true })).toBeVisible();
    expect(await page.locator('input[type=date]:visible').count()).toBe(0);
    await page.getByLabel('地点', { exact: true }).fill('shanghai');
    await page
      .getByRole('button')
      .filter({ has: page.getByText('上海', { exact: true }) })
      .first()
      .click();
    await expect(page.getByPlaceholder('搜索城市、省州或国家')).toHaveCount(0);
    await expect(page.locator('.selected-location')).toContainText('上海');
    expect(await page.locator('.upload-controls').count()).toBe(0);
    await page.locator('.form-details > summary').filter({ hasText: '补充信息' }).click();
    await page.getByLabel('景点 / 地点名称（可选）', { exact: true }).fill('江边散步');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page).toHaveURL(/\/travel\/[a-f0-9-]+$/);
    id = new URL(page.url()).pathname.split('/').at(-1)!;
    await expect(page.getByRole('heading', { name: '江边散步', exact: true })).toBeVisible();
    const trip = await (await page.request.get(`/api/travel/entries/${id}`)).json();
    expect(trip.start_date).toBeNull();
    expect(trip.photos).toHaveLength(1);
    expect((await request.get(`/api/media/${trip.photos[0].id}/large`)).status()).toBe(404);
    await page.locator('.wall-photo').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await page.getByRole('link', { name: '查看旅行' }).count()).toBe(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('.wall-photo')).toBeFocused();
  } finally {
    if (id) await page.request.delete(`/api/travel/entries/${id}`, { headers });
    await page.request.post('/api/travel/cleanup', { headers, data: {} });
  }
});

test('two tabs keep local choices on conflict, and a lost creation receipt retries the same ID', async ({
  page,
  context,
}) => {
  const ids: string[] = [];
  const date = '2024-03-13';
  const panel = page.locator('.quick-checkin');
  try {
    const id = crypto.randomUUID();
    ids.push(id);
    await page.request.post('/api/fitness/checkin', {
      headers,
      data: { id, mutation_id: crypto.randomUUID(), date, part: 'back' },
    });
    await page.goto('/fitness');
    await panel.getByRole('button', { name: '选择日期', exact: true }).click();
    await panel.getByLabel('选择日期', { exact: true }).fill(date);
    await expect(panel.getByRole('button', { name: '背部', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const other = await context.newPage();
    await other.goto('/fitness');
    const second = other.locator('.quick-checkin');
    await second.getByRole('button', { name: '选择日期', exact: true }).click();
    await second.getByLabel('选择日期', { exact: true }).fill(date);
    await expect(second.getByRole('button', { name: '背部', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await panel.getByRole('button', { name: '胸部', exact: true }).click();
    await expect(panel.locator('.checkin-save')).toHaveText('已保存');
    await second.getByRole('button', { name: '腿部', exact: true }).click();
    await expect(second.getByRole('alert')).toBeVisible();
    await expect(second.getByRole('button', { name: '腿部', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const stored = await (await page.request.get(`/api/fitness/sessions/${id}`)).json();
    expect(stored.body_parts).toEqual(['back', 'chest']);
    other.once('dialog', (d) => d.accept());
    await second.getByRole('button', { name: '读取最新记录', exact: true }).click();
    await expect(second.getByRole('button', { name: '胸部', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(second.getByRole('button', { name: '腿部', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await other.close();
    await panel.locator('.checkin-more > summary').click();
    await panel.getByRole('button', { name: '再记一次', exact: true }).click();
    let dropped = false;
    let mutation = '';
    await page.route('**/api/fitness/checkin', async (route) => {
      const body = route.request().postDataJSON();
      if (!dropped) {
        dropped = true;
        ids.push(body.id);
        mutation = body.mutation_id;
        const response = await route.fetch();
        expect(response.ok()).toBe(true);
        await route.abort();
      } else {
        expect(body.id).toBe(ids[1]);
        expect(body.mutation_id).toBe(mutation);
        await route.continue();
      }
    });
    await panel.getByRole('button', { name: '有氧', exact: true }).click();
    await expect(panel.getByRole('alert')).toBeVisible();
    await panel.getByRole('button', { name: '重试保存', exact: true }).click();
    await expect(panel.locator('.checkin-save')).toHaveText('已保存');
    const day = await (await page.request.get(`/api/fitness/day?date=${date}`)).json();
    expect(day.items.filter((w: any) => ids.includes(w.id))).toHaveLength(2);
  } finally {
    for (const id of ids) await page.request.delete(`/api/fitness/sessions/${id}`, { headers });
  }
});
