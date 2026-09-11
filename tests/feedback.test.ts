import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { claimGoalFeedback, consumeSaveFeedback, queueSaveFeedback } from '../src/lib/feedback';
import { greetingAt, dashboardLayout } from '../src/features/dashboard/presentation';
import { defaultWidgets } from '../src/types/domain';
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('presentation state does not change saved data', () => {
  it('consumes a save receipt only once, only on its matching detail page', () => {
    queueSaveFeedback('workout', 'w1');
    expect(consumeSaveFeedback('/fitness/w1')).toBe('workout');
    expect(consumeSaveFeedback('/fitness/w1')).toBeNull();
    queueSaveFeedback('travel', 't1');
    expect(consumeSaveFeedback('/travel/t2')).toBeNull();
    expect(consumeSaveFeedback('/travel/t1')).toBeNull();
  });
  it('expires receipts instead of celebrating old saves on later visits', () => {
    vi.useFakeTimers();
    queueSaveFeedback('travel', 't1');
    vi.advanceTimersByTime(16000);
    expect(consumeSaveFeedback('/travel/t1')).toBeNull();
  });
  it('deduplicates goal feedback by viewer and week', () => {
    expect(claimGoalFeedback('u1', '2026-09-07')).toBe(true);
    expect(claimGoalFeedback('u1', '2026-09-07')).toBe(false);
    expect(claimGoalFeedback('public', '2026-09-07')).toBe(true);
    expect(claimGoalFeedback('u1', '2026-09-14')).toBe(true);
  });
  it('degrades to static confirmation when browser storage is blocked', () => {
    vi.stubGlobal('sessionStorage', {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    });
    expect(() => queueSaveFeedback('workout', 'w1')).not.toThrow();
    expect(consumeSaveFeedback('/fitness/w1')).toBeNull();
    expect(claimGoalFeedback('u1', '2026-09-07')).toBe(false);
  });
  it('uses the configured timezone for greeting, including midnight', () => {
    const now = new Date('2026-09-10T00:00:00Z');
    expect(greetingAt(now, 'Asia/Shanghai')).toBe('morning');
    expect(greetingAt(now, 'America/Los_Angeles')).toBe('afternoon');
    expect(greetingAt(now, 'UTC')).toBe('evening');
  });
  it('preserves order and visibility while ignoring legacy sizes for layout', () => {
    expect(dashboardLayout(defaultWidgets).editorial).toBe(true);
    expect(dashboardLayout(defaultWidgets.map((w) => ({ ...w, size: 'large' }))).editorial).toBe(
      true,
    );
    expect(dashboardLayout(defaultWidgets.filter((w) => w.key !== 'recent')).editorial).toBe(true);
    const custom = defaultWidgets.map((w, i) => ({
      ...w,
      order: 3 - i,
      visible: w.key !== 'weekly',
      size: 'small' as const,
    }));
    expect(dashboardLayout(custom).visible.map((w) => w.key)).toEqual([
      'recent',
      'travel',
      'fitness',
    ]);
    expect(dashboardLayout(custom).editorial).toBe(false);
    expect(custom[0]!.order).toBe(3);
  });
});
