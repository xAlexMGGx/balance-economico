import type { Cents } from './types';

const NBSP = String.fromCharCode(0xa0);
const MINUS = String.fromCharCode(0x2212);

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * 123456 → "1.234,56 €".
 * Formatted by hand because Intl's es-ES locale does not group 4-digit numbers ("1234,56 €").
 */
export function formatCents(cents: Cents, { signDisplay = 'auto' }: { signDisplay?: 'auto' | 'always' } = {}): string {
  const abs = Math.abs(Math.round(cents));
  const euros = Math.floor(abs / 100);
  const rest = abs % 100;
  let sign = '';
  if (cents < 0 && abs > 0) sign = MINUS;
  else if (signDisplay === 'always' && abs > 0) sign = '+';
  return `${sign}${groupThousands(String(euros))},${String(rest).padStart(2, '0')}${NBSP}€`;
}

/** One decimal with comma and thousands dots, with an explicit sign when asked. Avoids "−0,0". */
function formatTenths(value: number, signDisplay: 'auto' | 'always'): string {
  const tenths = Math.round(value * 10);
  const abs = Math.abs(tenths);
  let sign = '';
  if (tenths < 0) sign = MINUS;
  else if (signDisplay === 'always' && tenths > 0) sign = '+';
  return `${sign}${groupThousands(String(Math.floor(abs / 10)))},${abs % 10}`;
}

/** 0.2345 → "23,5 %". */
export function formatPercent(ratio: number, { signDisplay = 'auto' }: { signDisplay?: 'auto' | 'always' } = {}): string {
  return `${formatTenths(ratio * 100, signDisplay)}${NBSP}%`;
}

/** Difference between two ratios in percentage points: 0.032 → "+3,2 pp". */
export function formatPercentagePoints(deltaRatio: number): string {
  return `${formatTenths(deltaRatio * 100, 'always')}${NBSP}pp`;
}

// --- On-screen keypad -------------------------------------------------------
// The keypad edits a string such as "1234,5": digits, an optional comma and up to two decimals.

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | 'backspace' | 'clear';

const MAX_INTEGER_DIGITS = 7;

export function applyKeypadKey(input: string, key: KeypadKey): string {
  if (key === 'clear') return '';
  if (key === 'backspace') return input.slice(0, -1);
  if (key === ',') {
    if (input.includes(',')) return input;
    return input === '' ? '0,' : `${input},`;
  }
  const [integerPart, decimalPart] = input.split(',');
  if (decimalPart !== undefined) {
    return decimalPart.length >= 2 ? input : input + key;
  }
  if (integerPart === '0') return key;
  if (integerPart.length >= MAX_INTEGER_DIGITS) return input;
  return input + key;
}

export function keypadInputToCents(input: string): Cents {
  if (input === '') return 0;
  const [integerPart, decimalPart = ''] = input.split(',');
  return Number(integerPart || '0') * 100 + Number(`${decimalPart}00`.slice(0, 2));
}

export function centsToKeypadInput(cents: Cents): string {
  if (cents <= 0) return '';
  const euros = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(euros) : `${euros},${String(rest).padStart(2, '0')}`;
}

/** "1234,5" → "1.234,5 €". Shows exactly what has been typed so far. */
export function formatKeypadInput(input: string): string {
  const [integerPart, decimalPart] = input.split(',');
  const integer = groupThousands(integerPart || '0');
  return `${decimalPart === undefined ? integer : `${integer},${decimalPart}`}${NBSP}€`;
}

// --- Free text ---------------------------------------------------------------

/**
 * Parses what a person types in a regular text field: "1.234,56", "1234,56", "1234.56", "-50", "12 €".
 * Returns null when the text is not a valid amount or has more than two decimals.
 */
export function parseAmountText(text: string): Cents | null {
  let s = text.replace(/[\s€]/g, '').replace(MINUS, '-');
  if (s === '') return null;
  let negative = false;
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s)) return null;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let integerPart: string;
  let decimalPart = '';

  if (lastComma >= 0 && lastDot >= 0) {
    // Both present: the last one is the decimal separator, the other one groups thousands.
    const decimalIndex = Math.max(lastComma, lastDot);
    const thousandsSeparator = decimalIndex === lastComma ? '.' : ',';
    integerPart = s.slice(0, decimalIndex);
    decimalPart = s.slice(decimalIndex + 1);
    if (!isGroupedInteger(integerPart, thousandsSeparator)) return null;
    integerPart = integerPart.split(thousandsSeparator).join('');
  } else if (lastComma >= 0) {
    if (s.indexOf(',') !== lastComma) return null;
    integerPart = s.slice(0, lastComma);
    decimalPart = s.slice(lastComma + 1);
  } else if (lastDot >= 0) {
    // Only dots: "1.234" and "1.234.567" group thousands, "12.5" is a decimal.
    if (isGroupedInteger(s, '.')) {
      integerPart = s.split('.').join('');
    } else {
      if (s.indexOf('.') !== lastDot) return null;
      integerPart = s.slice(0, lastDot);
      decimalPart = s.slice(lastDot + 1);
    }
  } else {
    integerPart = s;
  }

  if (!/^\d*$/.test(integerPart) || !/^\d*$/.test(decimalPart)) return null;
  if (integerPart === '' && decimalPart === '') return null;
  if (decimalPart.length > 2) return null;

  const cents = Number(integerPart || '0') * 100 + Number(`${decimalPart}00`.slice(0, 2));
  return negative ? -cents : cents;
}

function isGroupedInteger(s: string, separator: string): boolean {
  const parts = s.split(separator);
  if (parts.length < 2) return /^\d+$/.test(s);
  return /^\d{1,3}$/.test(parts[0]) && parts.slice(1).every((p) => /^\d{3}$/.test(p));
}

/** Value to prefill a text field with: -123456 → "-1234,56". */
export function centsToText(cents: Cents): string {
  const abs = Math.abs(cents);
  const text = `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
  return cents < 0 ? `-${text}` : text;
}
