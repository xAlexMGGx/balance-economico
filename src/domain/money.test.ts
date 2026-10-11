import { describe, expect, it } from 'vitest';
import {
  applyKeypadKey,
  centsToKeypadInput,
  centsToText,
  formatCents,
  formatCompactEuros,
  formatKeypadInput,
  formatPercent,
  formatPercentagePoints,
  keypadInputToCents,
  parseAmountText,
  type KeypadKey,
} from './money';

const NBSP = String.fromCharCode(0xa0);
const MINUS = String.fromCharCode(0x2212);
const eur = (text: string) => text.replace(' €', `${NBSP}€`);

describe('formatCents', () => {
  it('formats with thousands dots, decimal comma and euro sign', () => {
    expect(formatCents(123456)).toBe(eur('1.234,56 €'));
    expect(formatCents(0)).toBe(eur('0,00 €'));
    expect(formatCents(5)).toBe(eur('0,05 €'));
    expect(formatCents(99)).toBe(eur('0,99 €'));
    expect(formatCents(100000000)).toBe(eur('1.000.000,00 €'));
  });

  it('groups 4-digit amounts too', () => {
    expect(formatCents(100000)).toBe(eur('1.000,00 €'));
  });

  it('shows negative amounts with a minus sign', () => {
    expect(formatCents(-123456)).toBe(eur(`${MINUS}1.234,56 €`));
  });

  it('can always show the sign', () => {
    expect(formatCents(1050, { signDisplay: 'always' })).toBe(eur('+10,50 €'));
    expect(formatCents(-1050, { signDisplay: 'always' })).toBe(eur(`${MINUS}10,50 €`));
    expect(formatCents(0, { signDisplay: 'always' })).toBe(eur('0,00 €'));
  });
});

describe('formatCompactEuros', () => {
  it('rounds to whole euros with thousands dots', () => {
    expect(formatCompactEuros(2340)).toBe(eur('23 €'));
    expect(formatCompactEuros(2350)).toBe(eur('24 €'));
    expect(formatCompactEuros(123456)).toBe(eur('1.235 €'));
    expect(formatCompactEuros(999949)).toBe(eur('9.999 €'));
  });

  it('abbreviates from 10.000 €', () => {
    expect(formatCompactEuros(1000000)).toBe(eur('10k €'));
    expect(formatCompactEuros(1234567)).toBe(eur('12k €'));
  });

  it('never shows a small amount as zero', () => {
    expect(formatCompactEuros(0)).toBe(eur('0 €'));
    expect(formatCompactEuros(45)).toBe(eur('<1 €'));
    expect(formatCompactEuros(50)).toBe(eur('1 €'));
  });
});

describe('percentages', () => {
  const pct = (text: string) => text.replace(' %', `${NBSP}%`).replace(' pp', `${NBSP}pp`);

  it('formats ratios with one decimal', () => {
    expect(formatPercent(0.2345)).toBe(pct('23,5 %'));
    expect(formatPercent(0)).toBe(pct('0,0 %'));
    expect(formatPercent(1)).toBe(pct('100,0 %'));
    expect(formatPercent(-0.125)).toBe(pct(`${MINUS}12,5 %`));
    expect(formatPercent(12.3456)).toBe(pct('1.234,6 %'));
  });

  it('never shows a negative zero', () => {
    expect(formatPercent(-0.0001)).toBe(pct('0,0 %'));
    expect(formatPercentagePoints(-0.0001)).toBe(pct('0,0 pp'));
  });

  it('can always show the sign', () => {
    expect(formatPercent(0.052, { signDisplay: 'always' })).toBe(pct('+5,2 %'));
  });

  it('formats percentage points with sign', () => {
    expect(formatPercentagePoints(0.032)).toBe(pct('+3,2 pp'));
    expect(formatPercentagePoints(-0.1)).toBe(pct(`${MINUS}10,0 pp`));
  });
});

describe('keypad', () => {
  const type = (keys: string, start = '') =>
    [...keys].reduce((input, k) => applyKeypadKey(input, (k === '<' ? 'backspace' : k) as KeypadKey), start);

  it('builds amounts digit by digit', () => {
    expect(type('1250')).toBe('1250');
    expect(type('12,5')).toBe('12,5');
    expect(type('12,50')).toBe('12,50');
  });

  it('allows at most two decimals and one comma', () => {
    expect(type('1,234')).toBe('1,23');
    expect(type('1,,2')).toBe('1,2');
  });

  it('adds a leading zero when starting with the comma', () => {
    expect(type(',5')).toBe('0,5');
  });

  it('does not keep leading zeros', () => {
    expect(type('007')).toBe('7');
    expect(type('0,07')).toBe('0,07');
  });

  it('limits the integer part to 7 digits', () => {
    expect(type('123456789')).toBe('1234567');
  });

  it('deletes with backspace and clears', () => {
    expect(type('12,5<<')).toBe('12');
    expect(type('<')).toBe('');
    expect(applyKeypadKey('123', 'clear')).toBe('');
  });

  it('converts input to cents', () => {
    expect(keypadInputToCents('')).toBe(0);
    expect(keypadInputToCents('12')).toBe(1200);
    expect(keypadInputToCents('12,')).toBe(1200);
    expect(keypadInputToCents('12,5')).toBe(1250);
    expect(keypadInputToCents('12,05')).toBe(1205);
    expect(keypadInputToCents('0,07')).toBe(7);
  });

  it('converts cents back to input for editing', () => {
    expect(centsToKeypadInput(1200)).toBe('12');
    expect(centsToKeypadInput(1250)).toBe('12,50');
    expect(centsToKeypadInput(7)).toBe('0,07');
    expect(centsToKeypadInput(0)).toBe('');
    expect(keypadInputToCents(centsToKeypadInput(123456))).toBe(123456);
  });

  it('displays the input as typed, with thousands dots', () => {
    expect(formatKeypadInput('')).toBe(eur('0 €'));
    expect(formatKeypadInput('1234')).toBe(eur('1.234 €'));
    expect(formatKeypadInput('1234,')).toBe(eur('1.234, €'));
    expect(formatKeypadInput('1234,5')).toBe(eur('1.234,5 €'));
  });
});

describe('parseAmountText', () => {
  it.each([
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['1234.56', 123456],
    ['1,234.56', 123456],
    ['1.234', 123400],
    ['1.234.567', 123456700],
    ['12.5', 1250],
    ['12,5', 1250],
    ['50', 5000],
    ['0,07', 7],
    [',5', 50],
    ['12 €', 1200],
    ['-50', -5000],
    [`${MINUS}50,25`, -5025],
    ['+3', 300],
  ])('parses %s', (text, cents) => {
    expect(parseAmountText(text)).toBe(cents);
  });

  it.each(['', 'abc', '1,2,3', '12,345', '1.23.4', '-', '1,234.5.6', '12..5'])('rejects %s', (text) => {
    expect(parseAmountText(text)).toBeNull();
  });

  it('round-trips with centsToText', () => {
    for (const cents of [0, 7, 1250, -5025, 123456]) {
      expect(parseAmountText(centsToText(cents))).toBe(cents);
    }
  });
});
