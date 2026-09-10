import { describe, it, expect, vi } from 'vitest';
import {
  SettingsSaveQueue,
  mergeSettingsPatch,
  settingsPatchSchema,
  type SettingsPatch,
} from '../src/lib/settings-patch';
import { chinaPlaces } from '../src/features/travel/china-places';
import type { Trip, Wish, Location } from '../src/types/domain';

describe('instant settings persistence', () => {
  it('coalesces fields without replacing other preferences or widget properties', () => {
    expect(
      mergeSettingsPatch(
        {
          preferences: { theme: 'dark', weightUnit: 'lb' },
          widgets: [{ key: 'fitness', visible: false }],
        },
        { preferences: { theme: 'light' }, widgets: [{ key: 'fitness', size: 'small' }] },
      ),
    ).toEqual({
      preferences: { theme: 'light', weightUnit: 'lb' },
      widgets: [{ key: 'fitness', visible: false, size: 'small' }],
    });
  });
  it('serializes in-flight choices and merges later changes', async () => {
    let release!: () => void;
    const send = vi
      .fn<(p: SettingsPatch) => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise((r) => {
            release = r;
          }),
      )
      .mockResolvedValue(undefined);
    const settled = vi.fn(),
      state = vi.fn();
    const queue = new SettingsSaveQueue(send, state, settled);
    queue.enqueue({ preferences: { theme: 'dark' } });
    queue.enqueue({ preferences: { weightUnit: 'lb' } });
    queue.enqueue({ preferences: { distanceUnit: 'mile' } });
    expect(send).toHaveBeenCalledTimes(1);
    release();
    await vi.waitFor(() => expect(settled).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[1]![0]).toEqual({
      preferences: { weightUnit: 'lb', distanceUnit: 'mile' },
    });
    expect(state).toHaveBeenLastCalledWith('saved');
  });
  it('retains failed choices but gives newer same-field input precedence on retry', async () => {
    let reject!: (e: Error) => void;
    const send = vi
      .fn<(p: SettingsPatch) => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise((_, r) => {
            reject = r;
          }),
      )
      .mockResolvedValue(undefined);
    const state = vi.fn(),
      settled = vi.fn(),
      queue = new SettingsSaveQueue(send, state, settled);
    queue.enqueue({ preferences: { theme: 'dark', weightUnit: 'lb' } });
    queue.enqueue({ preferences: { theme: 'light' } });
    reject(new Error('offline'));
    await vi.waitFor(() => expect(state).toHaveBeenLastCalledWith('error', expect.any(Error)));
    expect(settled).not.toHaveBeenCalled();
    await queue.flush();
    expect(send.mock.calls[1]![0]).toEqual({ preferences: { theme: 'light', weightUnit: 'lb' } });
    expect(settled).toHaveBeenCalledTimes(1);
  });
  it('rejects unknown settings, partial order, repeated widgets, invalid values', () => {
    for (const input of [
      { preferences: { user_id: 'other' } },
      { preferences: { weeklyGoal: 0 } },
      { preferences: { mapStyle: 'countries' } },
      { order: ['fitness', 'fitness', 'travel', 'weekly'] },
      { order: ['fitness'] },
      { widgets: [{ key: 'fitness' }, { key: 'fitness' }] },
    ])
      expect(settingsPatchSchema.safeParse(input).success).toBe(false);
    expect(settingsPatchSchema.safeParse({ preferences: { theme: 'system' } }).success).toBe(true);
  });
});
describe('actual China travel locations', () => {
  const location: Location = {
    id: 'shanghai',
    kind: 'city',
    country_code: 'CN',
    country_name: 'China',
    country_name_zh: '中国',
    region: '上海',
    city: 'Shanghai',
    name: 'Shanghai',
    name_zh: '上海',
    latitude: 31.23,
    longitude: 121.47,
  };
  const trip = (id: string, l = location): Trip => ({
    id,
    user_id: 'u',
    location_id: l.id,
    location: l,
    start_date: null,
    end_date: null,
    description: '',
    tags: [],
    rating: null,
    visibility: 'private',
    photos: [],
    updated_at: '',
  });
  it('plots a city without a scenic source id and prefers visits to matching wishes', () => {
    const wish: Wish = { id: 'wish', location_id: location.id, location, visibility: 'private' };
    const points = chinaPlaces([trip('trip-1')], [wish], 'zh-CN');
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ name: '上海', visited: true, href: '/travel/trip-1' });
    expect(points[0]!.point![0]).toBeGreaterThan(0);
    expect(points[0]!.point![0]).toBeLessThan(780);
    expect(points[0]!.point![1]).toBeGreaterThan(0);
    expect(points[0]!.point![1]).toBeLessThan(520);
  });
  it('keeps missing coordinates in the list, plots region records, excludes overseas from China only', () => {
    const entries = chinaPlaces(
      [
        trip('unknown', { ...location, id: 'unknown', latitude: null, longitude: null }),
        trip('region', { ...location, id: 'region', kind: 'region' }),
        trip('foreign', { ...location, id: 'foreign', country_code: 'TH' }),
      ],
      [],
      'en-US',
    );
    expect(entries).toHaveLength(2);
    expect(entries[0]!.point).toBeNull();
    expect(entries[1]!.point).not.toBeNull();
  });
});
