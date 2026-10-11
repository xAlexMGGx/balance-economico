import { describe, expect, it } from 'vitest';
import {
  formatComparisonLabel,
  formatPeriod,
  isInPeriod,
  isSamePeriod,
  periodContaining,
  previousPeriod,
  shiftPeriod,
} from './periods';

describe('periods', () => {
  it('builds the month of a date', () => {
    expect(periodContaining('month', '2026-10-11')).toEqual({ kind: 'month', start: '2026-10-01', end: '2026-10-31' });
    expect(periodContaining('month', '2028-02-10')).toEqual({ kind: 'month', start: '2028-02-01', end: '2028-02-29' });
  });

  it('builds the Monday-to-Sunday week of a date', () => {
    expect(periodContaining('week', '2026-10-11')).toEqual({ kind: 'week', start: '2026-10-05', end: '2026-10-11' });
    expect(periodContaining('week', '2026-10-12')).toEqual({ kind: 'week', start: '2026-10-12', end: '2026-10-18' });
  });

  it('moves between months, across years', () => {
    const october = periodContaining('month', '2026-10-11');
    expect(previousPeriod(october).start).toBe('2026-09-01');
    expect(shiftPeriod(october, 3)).toEqual({ kind: 'month', start: '2027-01-01', end: '2027-01-31' });
    expect(shiftPeriod(periodContaining('month', '2026-03-31'), -1).end).toBe('2026-02-28');
  });

  it('moves between weeks, across months and years', () => {
    const week = periodContaining('week', '2026-01-02');
    expect(week.start).toBe('2025-12-29');
    expect(previousPeriod(week)).toEqual({ kind: 'week', start: '2025-12-22', end: '2025-12-28' });
    expect(shiftPeriod(week, 1).start).toBe('2026-01-05');
  });

  it('knows which dates are inside', () => {
    const october = periodContaining('month', '2026-10-11');
    expect(isInPeriod('2026-10-01', october)).toBe(true);
    expect(isInPeriod('2026-10-31', october)).toBe(true);
    expect(isInPeriod('2026-11-01', october)).toBe(false);
    expect(isSamePeriod(october, periodContaining('month', '2026-10-30'))).toBe(true);
    expect(isSamePeriod(october, periodContaining('week', '2026-10-01'))).toBe(false);
  });
});

describe('period labels', () => {
  const today = '2026-10-11';

  it('names months with their year', () => {
    expect(formatPeriod(periodContaining('month', '2026-10-11'), today)).toBe('Octubre 2026');
  });

  it('names weeks compactly, adding the year only when needed', () => {
    expect(formatPeriod(periodContaining('week', '2026-10-07'), today)).toBe('5 – 11 oct');
    expect(formatPeriod(periodContaining('week', '2026-10-01'), today)).toMatch(/^28 sept? – 4 oct$/);
    expect(formatPeriod(periodContaining('week', '2025-10-07'), today)).toBe('6 – 12 oct 2025');
    expect(formatPeriod(periodContaining('week', '2026-01-01'), today)).toBe('29 dic 2025 – 4 ene 2026');
  });

  it('names the period it is compared with', () => {
    expect(formatComparisonLabel(periodContaining('month', '2026-10-11'))).toBe('vs septiembre');
    expect(formatComparisonLabel(periodContaining('month', '2026-01-11'))).toBe('vs diciembre');
    expect(formatComparisonLabel(periodContaining('week', '2026-10-11'))).toBe('vs semana anterior');
  });
});
