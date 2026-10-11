import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateInMonth,
  daysInMonth,
  formatDayHeading,
  formatShortDate,
  isValidISODate,
  parseISODate,
  startOfWeek,
  toISODate,
  todayISO,
  toYearMonth,
} from './dates';

describe('ISO dates', () => {
  it('runs in the Madrid timezone (see vite.config.ts)', () => {
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-120);
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-60);
  });

  it('uses the local calendar day, not UTC', () => {
    // 00:30 in Madrid is still the previous day in UTC.
    expect(toISODate(new Date(2026, 2, 1, 0, 30))).toBe('2026-03-01');
    expect(todayISO(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('parses to local midnight', () => {
    const d = parseISODate('2026-10-11');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 11, 0]);
  });

  it('validates dates', () => {
    expect(isValidISODate('2026-02-28')).toBe(true);
    expect(isValidISODate('2028-02-29')).toBe(true);
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('2026-1-01')).toBe(false);
    expect(isValidISODate('')).toBe(false);
  });

  it('adds days across months, years and daylight saving changes', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    // Clocks change in Spain on 29 March and 25 October 2026.
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-10-24', 7)).toBe('2026-10-31');
  });
});

describe('months', () => {
  it('extracts the month', () => {
    expect(toYearMonth('2026-10-11')).toBe('2026-10');
  });

  it('knows the length of each month', () => {
    expect(daysInMonth('2026-01')).toBe(31);
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2026-04')).toBe(30);
  });

  it('uses the last day when the month is shorter', () => {
    expect(dateInMonth('2026-02', 31)).toBe('2026-02-28');
    expect(dateInMonth('2028-02', 30)).toBe('2028-02-29');
    expect(dateInMonth('2026-04', 31)).toBe('2026-04-30');
    expect(dateInMonth('2026-10', 5)).toBe('2026-10-05');
  });
});

describe('weeks', () => {
  it('start on Monday', () => {
    expect(startOfWeek('2026-10-12')).toBe('2026-10-12'); // Monday
    expect(startOfWeek('2026-10-14')).toBe('2026-10-12'); // Wednesday
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12'); // Sunday
    expect(startOfWeek('2026-10-11')).toBe('2026-10-05'); // Sunday of the previous week
  });

  it('can span two months or years', () => {
    expect(startOfWeek('2026-03-01')).toBe('2026-02-23');
    expect(startOfWeek('2027-01-01')).toBe('2026-12-28');
  });
});

describe('labels', () => {
  const today = '2026-10-11';

  it('uses Hoy, Ayer and Mañana', () => {
    expect(formatDayHeading('2026-10-11', today)).toBe('Hoy');
    expect(formatDayHeading('2026-10-10', today)).toBe('Ayer');
    expect(formatDayHeading('2026-10-12', today)).toBe('Mañana');
    expect(formatShortDate('2026-10-10', today)).toBe('Ayer');
  });

  it('writes other days in Spanish', () => {
    expect(formatDayHeading('2026-10-06', today)).toBe('Martes, 6 de octubre');
    expect(formatDayHeading('2025-01-03', today)).toBe('Viernes, 3 de enero de 2025');
    expect(formatShortDate('2026-10-06', today)).toMatch(/^Mar 6 oct/);
    expect(formatShortDate('2025-01-03', today)).toMatch(/2025$/);
  });
});
