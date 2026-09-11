import type { Widget } from '../../types/domain';

export function greetingAt(now: Date, timezone: string) {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(now),
  );
  return hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'evening';
}

export function dashboardLayout(widgets: Widget[]) {
  const visible = widgets.filter((widget) => widget.visible).toSorted((a, b) => a.order - b.order);
  // Legacy size preferences are backup-only. Content and viewport determine card sizes.
  const editorial = ['fitness,travel,weekly', 'fitness,travel,weekly,recent'].includes(
    visible.map((w) => w.key).join(','),
  );
  return { visible, editorial };
}
