import { describe, it, expect, vi } from 'vitest';
import {
  SettingsSaveQueue,
  mergeSettingsPatch,
  settingsPatchSchema,
  type SettingsPatch,
} from '../src/lib/settings-patch';

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
