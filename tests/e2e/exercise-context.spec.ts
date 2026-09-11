import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { trainingTargets, trainingParts } from '../../src/lib/fitness-recording';
const headers = { Origin: 'http://127.0.0.1:4321', 'X-Fubao-CSRF': '1' };

test('related search uses primary and secondary muscles, combines items and validates input', async ({
  request,
}) => {
  const muscles = [...trainingTargets.back, ...trainingTargets.arms];
  const first = await (
    await request.get('/api/fitness/exercises?trainingItems=back,arms&limit=50')
  ).json();
  expect(first.items.length).toBe(50);
  expect(first.hasMore).toBe(true);
  for (const exercise of first.items)
    expect(
      [exercise.target, ...exercise.secondary_muscles].some((m: string) => muscles.includes(m)),
    ).toBe(true);
  const next = await (
    await request.get('/api/fitness/exercises?trainingItems=back,arms&limit=50&page=1')
  ).json();
  expect(
    next.items.every(
      (e: { id: string }) => !first.items.some((p: { id: string }) => e.id === p.id),
    ),
  ).toBe(true);
  const deadlift = await (
    await request.get('/api/fitness/exercises?trainingItems=back&q=barbell%20deadlift')
  ).json();
  expect(deadlift.items.map((e: { id: string }) => e.id)).toContain('0032');
  expect((await request.get('/api/fitness/exercises?trainingItems=invalid')).status()).toBe(400);
  expect(
    (await request.get('/api/fitness/exercises?trainingItems=back%27%20OR%201=1')).status(),
  ).toBe(400);
  expect(
    (await request.get('/api/fitness/exercises?trainingItems=' + trainingParts.join(','))).ok(),
  ).toBe(true);
  const cardio = await (await request.get('/api/fitness/exercises?trainingItems=cardio')).json();
  expect(cardio.items.length).toBeGreaterThan(0);
  expect(cardio.items.every((e: { target: string }) => e.target === 'cardiovascular system')).toBe(
    true,
  );
});

test('training item states, single add entry, contextual multiselect and refresh stay coherent', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(10000);
  await page.request.post('/api/auth/login', {
    headers,
    data: { username: 'fubao', password: 'fubao' },
  });
  const id = crypto.randomUUID();
  try {
    expect(
      (
        await page.request.post('/api/fitness/checkin', {
          headers,
          data: { id, mutation_id: crypto.randomUUID(), date: '2026-09-09', part: 'back' },
        })
      ).ok(),
    ).toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/fitness/' + id);
    await page.getByRole('button', { name: '补充记录', exact: true }).click();
    const selected = page.getByRole('button', { name: '背部', exact: true });
    await expect(selected).toHaveAttribute('aria-pressed', 'true');
    await expect(selected.locator('.part-check')).toHaveCSS('opacity', '1');
    expect(await selected.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe(
      await page
        .getByRole('button', { name: '胸部', exact: true })
        .evaluate((e) => getComputedStyle(e).backgroundColor),
    );
    await page.getByRole('button', { name: '手臂', exact: true }).click();
    await expect(page.getByRole('button', { name: '手臂', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('.record-heading [role=status]')).toHaveText('已保存');
    await expect(page.getByRole('button', { name: '添加动作', exact: true })).toHaveCount(1);
    await page.screenshot({ path: 'output/playwright/fitness-selected-items.png', fullPage: true });
    await page.getByRole('button', { name: '添加动作', exact: true }).click();
    await expect(page.getByRole('button', { name: '相关动作', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('.exercise-context p')).toHaveText('背部 · 手臂');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('textbox', { name: '搜索', exact: true }).press('Escape');
    await expect(page.getByRole('button', { name: '添加动作', exact: true })).toBeFocused();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: '添加动作', exact: true }).click();
    await page.getByRole('button', { name: '相关动作', exact: true }).click();
    await page.getByRole('button', { name: '浏览', exact: true }).click();
    await expect(page.locator('.exercise-open').first()).toBeVisible();
    await page.getByRole('textbox', { name: '搜索', exact: true }).fill('barbell deadlift');
    await page.locator('.exercise-open').filter({ hasText: '杠铃硬拉' }).click();
    await expect(page.locator('.exercise-row[data-selected=true]')).toHaveCount(1);
    await page.getByRole('button', { name: '全部动作', exact: true }).click();
    await page.getByRole('textbox', { name: '搜索', exact: true }).fill('barbell bench press');
    await page.locator('.exercise-open').first().click();
    await expect(page.getByRole('button', { name: '添加已选动作 2' })).toBeEnabled();
    await page.screenshot({ path: 'output/playwright/fitness-related-picker.png', fullPage: true });
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
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
    }
    await page.getByRole('button', { name: '添加已选动作 2' }).click();
    await expect(page.locator('.set-exercise')).toHaveCount(2);
    await expect(page.getByRole('button', { name: '添加动作', exact: true })).toHaveCount(1);
    await expect(page.locator('.record-heading [role=status]')).toHaveText('已保存');
    await page
      .locator('.record-footer')
      .getByRole('button', { name: '完成编辑', exact: true })
      .click();
    await expect(page.locator('.workout-workspace')).toHaveCount(0);
    await page.reload();
    const saved = await (await page.request.get('/api/fitness/sessions/' + id)).json();
    expect(saved.body_parts).toEqual(expect.arrayContaining(['back', 'arms', 'legs', 'chest']));
    expect(saved.exercises).toHaveLength(2);
    await page
      .context()
      .addCookies([{ name: 'fubao.locale', value: 'en-US', url: 'http://127.0.0.1:4321' }]);
    await page.reload();
    await page.getByRole('button', { name: 'Add details', exact: true }).click();
    await page.getByRole('button', { name: 'Add exercise', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Related exercises', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.exercise-added').first()).toBeVisible();
    await expect(page.locator('.exercise-row[data-selected=true]')).toHaveCount(0);
    await page.setViewportSize({ width: 320, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.waitForFunction(() =>
      document
        .getAnimations()
        .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: 'output/playwright/fitness-related-english.png',
      fullPage: true,
    });

    expect(
      saved.exercises.every((e: { sets: { completed: boolean }[] }) =>
        e.sets.every((s) => !s.completed),
      ),
    ).toBe(true);
  } finally {
    await page.request.delete('/api/fitness/sessions/' + id, { headers });
  }
});
