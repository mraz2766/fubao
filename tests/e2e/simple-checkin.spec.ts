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
test('persistent one-tap choices, rapid additions, retry, refresh, date changes and explicit new session', async ({
  page,
  request,
}) => {
  const ids: string[] = [];
  const panel = page.locator('.quick-checkin');
  try {
    await page.goto('/fitness');
    if (await panel.getByRole('heading', { name: '已打卡', exact: true }).isVisible()) {
      await panel.locator('.checkin-more > summary').click();
      await panel.getByRole('button', { name: '再记一次', exact: true }).click();
    }
    expect(await panel.locator('input:visible').count()).toBe(0);
    const receipt = page.waitForResponse(
      (r) => r.url().endsWith('/api/fitness/checkin') && r.request().method() === 'POST',
    );
    await panel.getByRole('button', { name: '背部', exact: true }).dblclick();
    const w = await (await receipt).json();
    ids.push(w.id);
    expect(w).toMatchObject({
      status: 'completed',
      end_at: null,
      duration_seconds: null,
      exercises: [],
    });
    await expect(panel.locator('.checkin-save')).toHaveText('已保存');
    await expect(panel.getByRole('button', { name: '背部', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('.daily-recent')).toContainText('背部');
    expect((await request.get(`/api/fitness/sessions/${w.id}`)).status()).toBe(404);
    await panel.getByRole('button', { name: '有氧', exact: true }).click();
    await expect(panel.locator('.checkin-save')).toHaveText('已保存');
    await panel.locator('.checkin-more > summary').click();
    await panel.getByRole('button', { name: '45 分钟', exact: true }).click();
    await expect(panel.locator('.checkin-save')).toHaveText('已保存');
    await page.reload();
    await expect(panel.getByRole('button', { name: '背部', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(panel.getByRole('button', { name: '有氧', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const updated = await (await page.request.get(`/api/fitness/sessions/${w.id}`)).json();
    expect(updated.body_parts).toEqual(['back', 'cardio']);
    expect(updated.duration_seconds).toBe(2700);
    let failed = false;
    await page.route('**/api/fitness/sessions/*', (route) => {
      if (route.request().method() === 'PATCH' && !failed) {
        failed = true;
        return route.abort();
      }
      return route.continue();
    });
    await panel.getByRole('button', { name: '胸部', exact: true }).click();
    await expect(panel.getByRole('alert')).toBeVisible();
    await expect(panel.getByRole('button', { name: '胸部', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await panel.getByRole('button', { name: '腿部', exact: true }).click();
    await panel.getByRole('button', { name: '重试保存', exact: true }).click();
    await expect(panel.locator('.checkin-save')).toHaveText('已保存');
    const merged = await (await page.request.get(`/api/fitness/sessions/${w.id}`)).json();
    expect(merged.body_parts).toEqual(['back', 'cardio', 'chest', 'legs']);
    await panel.getByRole('button', { name: '昨天', exact: true }).click();
    await panel.getByRole('button', { name: '今天', exact: true }).click();
    await expect(panel.getByRole('button', { name: '胸部', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await panel.locator('.checkin-more > summary').click();
    await panel.getByRole('button', { name: '再记一次', exact: true }).click();
    const next = page.waitForResponse(
      (r) => r.url().endsWith('/api/fitness/checkin') && r.request().method() === 'POST',
    );
    await panel.getByRole('button', { name: '有氧', exact: true }).click();
    const second = await (await next).json();
    ids.push(second.id);
    expect(second.id).not.toBe(w.id);
    await expect(panel.locator('.checkin-save')).toHaveText('已保存');
    await panel.locator('.checkin-more > summary').click();
    page.once('dialog', (d) => d.accept());
    await panel.getByRole('button', { name: '撤销', exact: true }).click();
    await expect(panel.getByRole('button', { name: '胸部', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect((await page.request.get(`/api/fitness/sessions/${second.id}`)).status()).toBe(404);
  } finally {
    for (const id of ids) await page.request.delete(`/api/fitness/sessions/${id}`, { headers });
  }
});
test('D1 check-in idempotency, completed empty metrics and old backup compatibility', async ({
  page,
  request,
}) => {
  const id = crypto.randomUUID(),
    mutation_id = crypto.randomUUID();
  try {
    const data = { id, mutation_id, date: '2026-09-09', part: 'back' };
    const [a, b] = await Promise.all([
      page.request.post('/api/fitness/checkin', { headers, data }),
      page.request.post('/api/fitness/checkin', { headers, data }),
    ]);
    expect(a.ok()).toBe(true);
    expect(b.ok()).toBe(true);
    expect((await a.json()).revision).toBe((await b.json()).revision);
    const w = await (await page.request.get(`/api/fitness/sessions/${id}`)).json();
    const group = {
      id: crypto.randomUUID(),
      exercise_id: '0032',
      recording_type: 'weight',
      sets: [
        {
          id: crypto.randomUUID(),
          weight: null,
          reps: null,
          duration: null,
          distance: null,
          rpe: null,
          note: '',
          completed: true,
        },
      ],
    };
    const saved = await page.request.put(`/api/fitness/sessions/${id}`, {
      headers,
      data: { ...w, mode: 'detailed', body_parts: [], exercises: [group] },
    });
    expect(saved.ok()).toBe(true);
    const result = await saved.json();
    expect(result.exercises[0].sets[0].completed).toBe(true);
    expect(result.body_parts.length).toBeGreaterThan(0);
    expect((await request.get('/api/fitness/exercises/0032/last-set')).status()).toBe(401);
    const incomplete = await page.request.put(`/api/fitness/sessions/${id}`, {
      headers,
      data: { ...result, mode: 'quick', body_parts: [], exercises: [] },
    });
    expect(incomplete.status()).toBe(400);
    const exported = await (await page.request.get('/api/data/export')).json();
    expect(exported.fitness.sessions.find((s: any) => s.id === id).workout_date).toBe('2026-09-09');
    await page.request.delete(`/api/fitness/sessions/${id}`, { headers });
    const legacy = {
      ...w,
      body_parts: [],
      time_precision: undefined,
      duration_seconds: undefined,
      workout_date: undefined,
      end_at: '2026-09-09T05:00:00.000Z',
    };
    expect(
      (
        await page.request.post('/api/data/import', {
          headers,
          data: { kind: 'session', value: legacy },
        })
      ).ok(),
    ).toBe(true);
  } finally {
    await page.request.delete(`/api/fitness/sessions/${id}`, { headers });
  }
});
test('daily screen is accessible in both languages, themes and responsive sizes', async ({
  page,
  context,
}) => {
  for (const locale of ['zh-CN', 'en-US']) {
    await context.addCookies([
      { name: 'fubao.locale', value: locale, url: 'http://127.0.0.1:4321' },
    ]);
    await page.goto('/fitness');
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([]);
    }
  }
});
