import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { parsePositiveInteger, calculateProfit } = require('./profit.js');

describe('parsePositiveInteger', () => {
  it.each([null, undefined, '', ' ', 0, '0', -1, '-2', 1.5, '2.5', 'abc', '12abc', NaN, Infinity, true, [], {}, Number.MAX_SAFE_INTEGER + 1])('rejects %j', (value) => {
    expect(parsePositiveInteger(value)).toBeNull();
  });

  it.each([1, '920', ' 108 ', Number.MAX_SAFE_INTEGER])('accepts %j', (value) => {
    expect(parsePositiveInteger(value)).toBe(Number(value));
  });
});

describe('calculateProfit', () => {
  it('calculates the supplied example without rounding the underlying ROI', () => {
    const result = calculateProfit(920, 108, 169);
    expect(result).toMatchObject({ investment: 99360, revenue: 155480, profit: 56120, breakEven: 108 });
    expect(result.roi).toBeCloseTo(56.48148148, 8);
  });

  it('calculates loss and break-even', () => {
    expect(calculateProfit(100, 100, 80)).toEqual({ investment: 10000, revenue: 8000, profit: -2000, roi: -20, breakEven: 100 });
    expect(calculateProfit('100', '100', '100')).toEqual({ investment: 10000, revenue: 10000, profit: 0, roi: 0, breakEven: 100 });
  });

  it.each(['', null, undefined, 0, -1, 2.5, 'invalid'])('rejects missing or invalid quantity and purchase price: %j', (value) => {
    expect(calculateProfit(value, 108, 169)).toBeNull();
    expect(calculateProfit(920, value, 169)).toBeNull();
  });

  it.each(['', null, undefined, 0, -1, 2.5, 'invalid'])('keeps investment but no invented sale for %j', (value) => {
    expect(calculateProfit(920, 108, value)).toEqual({ investment: 99360, breakEven: 108, revenue: null, profit: null, roi: null });
  });

  it('rejects unsafe totals without losing a valid investment', () => {
    expect(calculateProfit(Number.MAX_SAFE_INTEGER, 2, 3)).toBeNull();
    expect(calculateProfit(2, 100, Number.MAX_SAFE_INTEGER)).toEqual({ investment: 200, breakEven: 100, revenue: null, profit: null, roi: null });
  });
});
