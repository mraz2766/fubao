import { z } from 'zod';
import { preferencesSchema } from './schemas';

const widgetKey = z.enum(['fitness', 'travel', 'weekly', 'recent']);
export const settingsPatchSchema = z
  .object({
    preferences: preferencesSchema.omit({ mapStyle: true }).partial().strict().optional(),
    widgets: z
      .array(
        z
          .object({
            key: widgetKey,
            visible: z.boolean().optional(),
            size: z.enum(['small', 'medium', 'large']).optional(),
          })
          .strict(),
      )
      .max(4)
      .refine((items) => new Set(items.map((w) => w.key)).size === items.length)
      .optional(),
    order: z
      .array(widgetKey)
      .length(4)
      .refine((keys) => new Set(keys).size === 4)
      .optional(),
  })
  .strict();
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

/** Later choices replace only matching fields, never unrelated pending choices. */
export function mergeSettingsPatch(a: SettingsPatch, b: SettingsPatch): SettingsPatch {
  const widgets = new Map((a.widgets ?? []).map((w) => [w.key, w]));
  for (const w of b.widgets ?? []) widgets.set(w.key, { ...widgets.get(w.key), ...w });
  return {
    ...((a.preferences || b.preferences) && {
      preferences: { ...a.preferences, ...b.preferences },
    }),
    ...(widgets.size && { widgets: [...widgets.values()] }),
    ...((b.order || a.order) && { order: b.order ?? a.order }),
  };
}

export class SettingsSaveQueue {
  private pending: SettingsPatch = {};
  private running = false;
  constructor(
    private send: (patch: SettingsPatch) => Promise<void>,
    private state: (state: 'saving' | 'saved' | 'error', error?: unknown) => void,
    private settled: () => void,
  ) {}
  enqueue(patch: SettingsPatch) {
    this.pending = mergeSettingsPatch(this.pending, patch);
    void this.flush();
  }
  async flush() {
    if (this.running || !Object.keys(this.pending).length) return;
    this.running = true;
    this.state('saving');
    while (Object.keys(this.pending).length) {
      const sending = this.pending;
      this.pending = {};
      try {
        await this.send(sending);
      } catch (error) {
        this.pending = mergeSettingsPatch(sending, this.pending);
        this.running = false;
        this.state('error', error);
        return;
      }
    }
    this.running = false;
    this.state('saved');
    this.settled();
  }
}
