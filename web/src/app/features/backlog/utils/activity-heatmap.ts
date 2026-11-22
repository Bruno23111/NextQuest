export type HeatmapLevel = 0 | 1 | 2 | 3;

export interface HeatmapDay {
  dateKey: string;
  label: string;
  count: number;
  level: HeatmapLevel;
}

export function buildActivityHeatmap(
  timestamps: readonly (string | null | undefined)[],
  referenceDate = new Date(),
): HeatmapDay[] {
  const counts = new Map<string, number>();

  for (const raw of timestamps) {
    if (!raw) continue;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) continue;
    const key = formatDateKey(parsed);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Encontra o domingo da semana de referenceDate para alinhar as 4 semanas (Seg -> Dom).
  const refDay = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const dayOfWeek = refDay.getDay(); // 0 = Dom, 1 = Seg, ...
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const endSunday = new Date(refDay);
  endSunday.setDate(refDay.getDate() + daysUntilSunday);

  const startMonday = new Date(endSunday);
  startMonday.setDate(endSunday.getDate() - 27);

  const days: HeatmapDay[] = [];
  for (let i = 0; i < 28; i++) {
    const current = new Date(startMonday);
    current.setDate(startMonday.getDate() + i);
    const dateKey = formatDateKey(current);
    const count = counts.get(dateKey) ?? 0;

    days.push({
      dateKey,
      label: formatDisplayLabel(current),
      count,
      level: toLevel(count),
    });
  }

  return days;
}

function toLevel(count: number): HeatmapLevel {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  return 3;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayLabel(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}
