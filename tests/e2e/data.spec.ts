import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
const headers = { Origin: 'http://127.0.0.1:4321', 'X-Fubao-CSRF': '1' };
test('authorization, template copy, completed sets, PR recalculation and JSON restore', async ({
  page,
  request,
}) => {
  expect((await request.post('/api/fitness/sessions', { headers, data: {} })).status()).toBe(401);
  expect(
    (
      await page.request.post('/api/auth/login', {
        headers,
        data: { username: 'fubao', password: 'fubao' },
      })
    ).ok(),
  ).toBe(true);
  expect((await page.request.post('/api/fitness/sessions', { data: {} })).status()).toBe(403);
  const search = await (await request.get('/api/fitness/exercises?q=deadlift&limit=2')).json();
  expect(search.items.length).toBeGreaterThan(0);
  expect(search.items.length).toBeLessThanOrEqual(2);
  const exercise = search.items[0];
  expect(exercise.name_zh).toBeTruthy();
  const template = {
    id: randomUUID(),
    name: 'E2E Back A',
    exercises: [
      {
        id: randomUUID(),
        exercise_id: exercise.id,
        sets: [
          {
            id: randomUUID(),
            reps: 8,
            weight: 100,
            duration: null,
            distance: null,
            rpe: 8,
            note: 'planned',
            completed: false,
          },
        ],
      },
    ],
  };
  const ids: string[] = [];
  try {
    expect(
      (await page.request.post('/api/fitness/templates', { headers, data: template })).ok(),
    ).toBe(true);
    const started = await (
      await page.request.post(`/api/fitness/templates/${template.id}/start`, { headers, data: {} })
    ).json();
    ids.push(started.id);
    expect(started.status).toBe('active');
    expect(started.exercises[0].sets[0].weight).toBe(100);
    expect(started.exercises[0].id).not.toBe(template.exercises[0].id);
    expect((await request.get(`/api/fitness/sessions/${started.id}`)).status()).toBe(404);
    template.exercises[0].sets[0].weight = 200;
    await page.request.put(`/api/fitness/templates/${template.id}`, { headers, data: template });
    expect(
      (await (await page.request.get(`/api/fitness/sessions/${started.id}`)).json()).exercises[0]
        .sets[0].weight,
    ).toBe(100);
    const done = {
      ...started,
      status: 'completed',
      end_at: new Date(Date.parse(started.start_at) + 3600000).toISOString(),
      exercises: started.exercises.map((e: any) => ({
        ...e,
        sets: e.sets.map((s: any) => ({ ...s, completed: true })),
      })),
    };
    const savedResponse = await page.request.put(`/api/fitness/sessions/${started.id}`, {
      headers,
      data: done,
    });
    expect(savedResponse.ok()).toBe(true);
    const saved = await savedResponse.json();
    let analytics = await (await page.request.get('/api/fitness/analytics')).json();
    expect(analytics.records.find((r: any) => r.exerciseId === exercise.id).weight).toBe(100);
    expect(analytics.summary.totalVolume).toBeGreaterThanOrEqual(800);
    const backup = await (await page.request.get('/api/data/export')).json();
    expect(backup.schemaVersion).toBe(1);
    expect(JSON.stringify(backup)).not.toMatch(/password_hash|auth_sessions/);
    const preview = await (
      await page.request.post('/api/data/preview', { headers, data: backup })
    ).json();
    expect(preview.sessions.skip).toBeGreaterThan(0);
    expect(
      (
        await (
          await page.request.post('/api/data/import', {
            headers,
            data: { kind: 'session', value: saved },
          })
        ).json()
      ).status,
    ).toBe('skipped');
    await page.request.delete(`/api/fitness/sessions/${started.id}`, { headers });
    analytics = await (await page.request.get('/api/fitness/analytics')).json();
    expect(analytics.records.find((r: any) => r.exerciseId === exercise.id)).toBeUndefined();
    expect(
      (
        await (
          await page.request.post('/api/data/import', {
            headers,
            data: { kind: 'session', value: saved },
          })
        ).json()
      ).status,
    ).toBe('imported');
    expect((await request.get(`/api/fitness/sessions/${started.id}`)).status()).toBe(404);
    expect(
      (
        await page.request.post('/api/data/preview', {
          headers,
          data: { ...backup, schemaVersion: 99 },
        })
      ).status(),
    ).toBe(400);
    const badPhoto = {
      name: 'fake.webp',
      mimeType: 'image/webp',
      buffer: Buffer.from('not a webp'),
    };
    expect(
      (
        await page.request.post('/api/travel/photos', {
          headers,
          multipart: {
            id: randomUUID(),
            travelId: randomUUID(),
            large: badPhoto,
            thumbnail: badPhoto,
          },
        })
      ).status(),
    ).toBe(400);
    const location = (await (await request.get('/api/locations?q=shanghai&limit=500')).json())
      .items;
    expect(location.length).toBeLessThanOrEqual(50);
    expect(location.some((l: any) => l.kind === 'city' && l.name_zh === '上海')).toBe(true);
    expect(
      (
        await page.request.post('/api/travel/entries', {
          headers,
          data: {
            id: randomUUID(),
            location_id: location[0].id,
            start_date: null,
            end_date: null,
            description: '',
            tags: [],
            rating: null,
            visibility: 'private',
            photo_ids: [],
          },
        })
      ).status(),
    ).toBe(400);
  } finally {
    for (const id of ids) await page.request.delete(`/api/fitness/sessions/${id}`, { headers });
    await page.request.delete(`/api/fitness/templates/${template.id}`, { headers });
  }
});
