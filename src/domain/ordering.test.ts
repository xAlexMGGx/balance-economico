import { describe, expect, it } from 'vitest';
import { moveId } from './ordering';
import { nextColor, PALETTE } from './palette';

describe('moveId', () => {
  it('moves up and down', () => {
    expect(moveId(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveId(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
  });

  it('returns null at the edges or for unknown ids', () => {
    expect(moveId(['a', 'b'], 'a', -1)).toBeNull();
    expect(moveId(['a', 'b'], 'b', 1)).toBeNull();
    expect(moveId(['a', 'b'], 'x', 1)).toBeNull();
  });
});

describe('nextColor', () => {
  it('picks the first unused colour', () => {
    expect(nextColor([])).toBe(PALETTE[0]);
    expect(nextColor([PALETTE[0], PALETTE[1].toUpperCase()])).toBe(PALETTE[2]);
  });

  it('cycles when every colour is used', () => {
    expect(nextColor([...PALETTE])).toBe(PALETTE[0]);
  });
});
