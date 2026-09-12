import { cn } from '@/lib/utils';

export type WeeklyBar = {
  start: string;
  completedMinutes: number;
  scheduledMinutes: number;
};

export function WeeklyChart({ weeks }: { weeks: WeeklyBar[] }) {
  const max = Math.max(1, ...weeks.map((week) => week.completedMinutes + week.scheduledMinutes));

  if (weeks.length === 0) {
    return (
      <div className="flex h-44 items-end gap-3">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="flex-1 rounded-2xl bg-[var(--admin-track)]"
            style={{ height: `${18 + (index % 4) * 8}%` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-44 items-end gap-2.5 sm:gap-3.5">
      {weeks.map((week) => {
        const total = week.completedMinutes + week.scheduledMinutes;
        const height = total === 0 ? 14 : Math.max(18, (total / max) * 100);
        const completedShare = total === 0 ? 0 : (week.completedMinutes / total) * 100;
        const scheduledShare = total === 0 ? 0 : (week.scheduledMinutes / total) * 100;

        return (
          <div
            key={week.start}
            className="flex min-w-0 flex-1 flex-col justify-end"
            style={{ height: `${height}%` }}
            title={`${Math.round(total / 60)}h na semana`}
          >
            <div
              className={cn(
                'flex h-full flex-col overflow-hidden rounded-2xl',
                total === 0 && 'bg-[var(--admin-track)]',
              )}
            >
              {total > 0 ? (
                <>
                  <div
                    className="admin-bar-striped min-h-0"
                    style={{ height: `${scheduledShare}%` }}
                  />
                  <div
                    className="min-h-0 bg-[var(--admin-accent)]"
                    style={{ height: `${completedShare}%` }}
                  />
                </>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
