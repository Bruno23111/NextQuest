import { buildActivityHeatmap } from './activity-heatmap';

describe('buildActivityHeatmap', () => {
  it('always builds 28 days aligned from Monday to Sunday', () => {
    const ref = new Date(2026, 10, 18); // Quarta-feira, 18/11/2026
    const days = buildActivityHeatmap([], ref);

    expect(days).toHaveLength(28);

    const [firstYear, firstMonth, firstDay] = days[0].dateKey.split('-').map(Number);
    const [lastYear, lastMonth, lastDay] = days[27].dateKey.split('-').map(Number);
    const firstDate = new Date(firstYear, firstMonth - 1, firstDay);
    const lastDate = new Date(lastYear, lastMonth - 1, lastDay);

    expect(firstDate.getDay()).toBe(1); // Segunda-feira
    expect(lastDate.getDay()).toBe(0); // Domingo
    expect(days.every((d) => d.count === 0 && d.level === 0)).toBe(true);
  });

  it('aggregates timestamps per day and maps levels 0, 1, 2 and 3', () => {
    const ref = new Date(2026, 10, 22); // Domingo, 22/11/2026
    const d1 = new Date(2026, 10, 19, 10, 0).toISOString();
    const d2a = new Date(2026, 10, 20, 9, 0).toISOString();
    const d2b = new Date(2026, 10, 20, 18, 0).toISOString();
    const d3a = new Date(2026, 10, 21, 8, 0).toISOString();
    const d3b = new Date(2026, 10, 21, 14, 0).toISOString();
    const d3c = new Date(2026, 10, 21, 21, 0).toISOString();

    const days = buildActivityHeatmap([d1, d2a, d2b, d3a, d3b, d3c, 'invalid-date', null], ref);
    const byKey = new Map(days.map((d) => [d.dateKey, d]));

    expect(byKey.get('2026-11-18')).toMatchObject({ count: 0, level: 0 });
    expect(byKey.get('2026-11-19')).toMatchObject({ count: 1, level: 1 });
    expect(byKey.get('2026-11-20')).toMatchObject({ count: 2, level: 2 });
    expect(byKey.get('2026-11-21')).toMatchObject({ count: 3, level: 3 });
  });
});
