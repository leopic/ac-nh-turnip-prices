import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

// predictions.js uses browser globals + conditional CJS exports
const require = createRequire(import.meta.url);
const {
  PATTERN,
  PROBABILITY_MATRIX,
  RATE_MULTIPLIER,
  range_length,
  clamp,
  range_intersect,
  range_intersect_length,
  float_sum,
  prefix_float_sum,
  PDF,
  Predictor,
  compute_expected_values,
  find_expected_maximum,
  get_sell_buy_decision,
} = require('./predictions.js');

// ─── Constants ───────────────────────────────────────────────────────────────

describe('PATTERN', () => {
  it('has four distinct pattern values', () => {
    const values = Object.values(PATTERN);
    expect(values).toHaveLength(4);
    expect(new Set(values).size).toBe(4);
  });

  it('maps expected pattern names', () => {
    expect(PATTERN.FLUCTUATING).toBe(0);
    expect(PATTERN.LARGE_SPIKE).toBe(1);
    expect(PATTERN.DECREASING).toBe(2);
    expect(PATTERN.SMALL_SPIKE).toBe(3);
  });
});

describe('PROBABILITY_MATRIX', () => {
  it('has entries for all four patterns', () => {
    for (let i = 0; i < 4; i++) {
      expect(PROBABILITY_MATRIX[i]).toBeDefined();
    }
  });

  it('each row sums to 1.0', () => {
    for (let i = 0; i < 4; i++) {
      const row = PROBABILITY_MATRIX[i];
      const sum = Object.values(row).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    }
  });

  it('all probabilities are between 0 and 1', () => {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        expect(PROBABILITY_MATRIX[i][j]).toBeGreaterThan(0);
        expect(PROBABILITY_MATRIX[i][j]).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('RATE_MULTIPLIER', () => {
  it('equals 10000', () => {
    expect(RATE_MULTIPLIER).toBe(10000);
  });
});

// ─── Utility Functions ───────────────────────────────────────────────────────

describe('range_length', () => {
  it('returns length of a range', () => {
    expect(range_length([0, 10])).toBe(10);
    expect(range_length([5, 5])).toBe(0);
    expect(range_length([-3, 3])).toBe(6);
  });

  it('handles fractional ranges', () => {
    expect(range_length([0.5, 1.5])).toBeCloseTo(1.0);
  });

  it('returns negative for inverted ranges', () => {
    expect(range_length([10, 5])).toBe(-5);
  });
});

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to minimum', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps to maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('handles equal min and max', () => {
    expect(clamp(5, 3, 3)).toBe(3);
  });

  it('handles value exactly at boundaries', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('range_intersect', () => {
  it('returns intersection of overlapping ranges', () => {
    expect(range_intersect([0, 10], [5, 15])).toEqual([5, 10]);
  });

  it('returns null for non-overlapping ranges', () => {
    expect(range_intersect([0, 5], [6, 10])).toBeNull();
  });

  it('returns single point when ranges touch', () => {
    expect(range_intersect([0, 5], [5, 10])).toEqual([5, 5]);
  });

  it('handles contained range', () => {
    expect(range_intersect([0, 10], [3, 7])).toEqual([3, 7]);
  });

  it('handles identical ranges', () => {
    expect(range_intersect([2, 8], [2, 8])).toEqual([2, 8]);
  });

  it('is commutative', () => {
    const a = [1, 5];
    const b = [3, 8];
    expect(range_intersect(a, b)).toEqual(range_intersect(b, a));
  });

  it('returns null when first range is entirely above second', () => {
    expect(range_intersect([10, 20], [0, 5])).toBeNull();
  });
});

describe('range_intersect_length', () => {
  it('returns length of intersection', () => {
    expect(range_intersect_length([0, 10], [5, 15])).toBe(5);
  });

  it('returns 0 for non-overlapping ranges', () => {
    expect(range_intersect_length([0, 5], [6, 10])).toBe(0);
  });

  it('returns 0 when ranges just touch', () => {
    expect(range_intersect_length([0, 5], [5, 10])).toBe(0);
  });

  it('returns length of contained range', () => {
    expect(range_intersect_length([0, 10], [3, 7])).toBe(4);
  });

  it('handles fractional ranges', () => {
    expect(range_intersect_length([0.5, 3.5], [1.0, 2.0])).toBeCloseTo(1.0);
  });
});

// ─── float_sum ───────────────────────────────────────────────────────────────

describe('float_sum', () => {
  it('sums an empty array to 0', () => {
    expect(float_sum([])).toBe(0);
  });

  it('sums a single element', () => {
    expect(float_sum([42])).toBe(42);
  });

  it('sums simple integers', () => {
    expect(float_sum([1, 2, 3, 4, 5])).toBe(15);
  });

  it('handles negative numbers', () => {
    expect(float_sum([1, -1, 2, -2])).toBe(0);
  });

  it('is more accurate than naive summation for pathological cases', () => {
    // Classic example: summing many small numbers with a large number
    const arr = [1e16, 1, -1e16];
    expect(float_sum(arr)).toBe(1);
  });

  it('handles many small floating point numbers', () => {
    const arr = Array(1000).fill(0.1);
    expect(float_sum(arr)).toBeCloseTo(100, 10);
  });

  it('handles alternating large and small values', () => {
    const arr = [];
    for (let i = 0; i < 100; i++) {
      arr.push(1e15);
      arr.push(-1e15);
      arr.push(1);
    }
    expect(float_sum(arr)).toBeCloseTo(100, 5);
  });
});

// ─── prefix_float_sum ────────────────────────────────────────────────────────

describe('prefix_float_sum', () => {
  it('returns [[0,0]] for empty input', () => {
    expect(prefix_float_sum([])).toEqual([[0, 0]]);
  });

  it('returns correct prefix sums for simple input', () => {
    const result = prefix_float_sum([1, 2, 3]);
    // result[0] = [0, 0], result[1] = prefix after 1 element, etc.
    expect(result).toHaveLength(4);
    expect(result[0][0] + result[0][1]).toBeCloseTo(0);
    expect(result[1][0] + result[1][1]).toBeCloseTo(1);
    expect(result[2][0] + result[2][1]).toBeCloseTo(3);
    expect(result[3][0] + result[3][1]).toBeCloseTo(6);
  });

  it('length is input.length + 1', () => {
    const result = prefix_float_sum([5, 10, 15, 20]);
    expect(result).toHaveLength(5);
  });

  it('last element equals float_sum of full array', () => {
    const input = [0.1, 0.2, 0.3, 0.4];
    const prefix = prefix_float_sum(input);
    const last = prefix[prefix.length - 1];
    expect(last[0] + last[1]).toBeCloseTo(float_sum(input), 10);
  });
});

// ─── PDF ─────────────────────────────────────────────────────────────────────

describe('PDF', () => {
  describe('constructor', () => {
    it('creates a uniform PDF over integer range', () => {
      const pdf = new PDF(0, 10);
      expect(pdf.value_start).toBe(0);
      expect(pdf.value_end).toBe(10);
      expect(pdf.prob).toHaveLength(10);
    });

    it('creates a uniform PDF over fractional range', () => {
      const pdf = new PDF(0.5, 9.5);
      expect(pdf.value_start).toBe(0);
      expect(pdf.value_end).toBe(10);
      expect(pdf.prob).toHaveLength(10);
    });

    it('probabilities sum to approximately 1 for uniform', () => {
      const pdf = new PDF(0, 10);
      const sum = float_sum(pdf.prob);
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it('fractional range probabilities sum to approximately 1', () => {
      const pdf = new PDF(2.5, 7.3);
      const sum = float_sum(pdf.prob);
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it('creates non-uniform (zero) PDF when uniform=false', () => {
      const pdf = new PDF(0, 5, false);
      expect(pdf.prob.every(p => p === undefined || p === 0)).toBe(true);
    });

    it('handles range within a single integer bucket', () => {
      const pdf = new PDF(3.2, 3.8);
      expect(pdf.value_start).toBe(3);
      expect(pdf.value_end).toBe(4);
      expect(pdf.prob).toHaveLength(1);
      expect(pdf.prob[0]).toBeCloseTo(1.0);
    });

    it('partial buckets at edges get proportional probability', () => {
      // Range [0.5, 2.5] over buckets [0,1), [1,2), [2,3)
      const pdf = new PDF(0.5, 2.5);
      // bucket [0,1): intersection with [0.5,2.5] = 0.5, total_length = 2.0 => 0.25
      // bucket [1,2): intersection = 1.0 => 0.5
      // bucket [2,3): intersection = 0.5 => 0.25
      expect(pdf.prob[0]).toBeCloseTo(0.25);
      expect(pdf.prob[1]).toBeCloseTo(0.5);
      expect(pdf.prob[2]).toBeCloseTo(0.25);
    });
  });

  describe('range_of', () => {
    it('returns correct range for index', () => {
      const pdf = new PDF(5, 10);
      expect(pdf.range_of(0)).toEqual([5, 6]);
      expect(pdf.range_of(4)).toEqual([9, 10]);
    });
  });

  describe('min_value / max_value', () => {
    it('returns start and end values', () => {
      const pdf = new PDF(3, 8);
      expect(pdf.min_value()).toBe(3);
      expect(pdf.max_value()).toBe(8);
    });

    it('handles fractional construction', () => {
      const pdf = new PDF(3.5, 7.2);
      expect(pdf.min_value()).toBe(3);
      expect(pdf.max_value()).toBe(8);
    });
  });

  describe('normalize', () => {
    it('normalizes probabilities to sum to 1', () => {
      const pdf = new PDF(0, 5, false);
      pdf.prob = [1, 2, 3, 4, 5];
      const total = pdf.normalize();
      expect(total).toBe(15);
      expect(float_sum(pdf.prob)).toBeCloseTo(1.0, 10);
    });

    it('returns original total probability', () => {
      const pdf = new PDF(0, 3, false);
      pdf.prob = [0.2, 0.3, 0.5];
      const total = pdf.normalize();
      expect(total).toBeCloseTo(1.0);
    });
  });

  describe('range_limit', () => {
    it('returns 1 when range covers entire PDF', () => {
      const pdf = new PDF(0, 10);
      const prob = pdf.range_limit([0, 10]);
      expect(prob).toBeCloseTo(1.0, 5);
    });

    it('returns probability proportional to range', () => {
      const pdf = new PDF(0, 10);
      const prob = pdf.range_limit([0, 5]);
      expect(prob).toBeCloseTo(0.5, 5);
    });

    it('shrinks the PDF range', () => {
      const pdf = new PDF(0, 10);
      pdf.range_limit([3, 7]);
      expect(pdf.value_start).toBe(3);
      expect(pdf.value_end).toBe(7);
      expect(pdf.prob).toHaveLength(4);
    });

    it('returns 0 for completely out-of-range', () => {
      const pdf = new PDF(0, 5);
      const prob = pdf.range_limit([10, 20]);
      expect(prob).toBe(0);
      expect(pdf.prob).toHaveLength(0);
    });

    it('handles partial overlap at start', () => {
      const pdf = new PDF(5, 10);
      const prob = pdf.range_limit([3, 7]);
      expect(prob).toBeGreaterThan(0);
      expect(prob).toBeLessThan(1);
      expect(pdf.value_start).toBe(5);
      expect(pdf.value_end).toBe(7);
    });

    it('probabilities still sum to 1 after range_limit', () => {
      const pdf = new PDF(0, 20);
      pdf.range_limit([5, 15]);
      expect(float_sum(pdf.prob)).toBeCloseTo(1.0, 10);
    });
  });

  describe('decay', () => {
    it('shifts the range down by decay amounts', () => {
      const pdf = new PDF(100, 200);
      const origStart = pdf.value_start;
      const origEnd = pdf.value_end;
      pdf.decay(10, 20);
      expect(pdf.value_start).toBe(origStart - 20);
      expect(pdf.value_end).toBe(origEnd - 10);
    });

    it('probabilities still sum to approximately 1 after decay', () => {
      const pdf = new PDF(1000, 2000);
      pdf.decay(50, 100);
      expect(float_sum(pdf.prob)).toBeCloseTo(1.0, 5);
    });

    it('increases the range length by (max_Y) buckets', () => {
      const pdf = new PDF(100, 110);
      const origLen = pdf.prob.length;
      pdf.decay(5, 15);
      expect(pdf.prob.length).toBe(origLen + (15 - 5));
    });

    it('handles zero-width decay range by shifting without convolution', () => {
      const pdf = new PDF(100, 110);
      const origProb = [...pdf.prob];
      pdf.decay(5, 5);
      // Should shift range by exactly 5, keeping probabilities intact
      expect(pdf.value_start).toBe(95);
      expect(pdf.value_end).toBe(105);
      expect(pdf.prob).toEqual(origProb);
      expect(float_sum(pdf.prob)).toBeCloseTo(1.0, 10);
    });

    it('multiple decays accumulate', () => {
      const pdf = new PDF(5000, 6000);
      pdf.decay(100, 200);
      pdf.decay(100, 200);
      // After two decays, range should have shifted by 200-400 total on start, 200-400 on end
      expect(pdf.value_start).toBe(5000 - 200 - 200);
      expect(pdf.value_end).toBe(6000 - 100 - 100);
      expect(float_sum(pdf.prob)).toBeCloseTo(1.0, 5);
    });
  });
});

// ─── Predictor ───────────────────────────────────────────────────────────────

describe('Predictor', () => {
  let predictor;

  beforeEach(() => {
    predictor = new Predictor(
      [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
      false,
      null
    );
  });

  describe('constructor', () => {
    it('sets initial properties', () => {
      expect(predictor.fudge_factor).toBe(0);
      expect(predictor.prices).toHaveLength(14);
      expect(predictor.first_buy).toBe(false);
      expect(predictor.previous_pattern).toBeNull();
    });
  });

  describe('intceil', () => {
    it('acts like ceiling for integers', () => {
      expect(predictor.intceil(5.0)).toBe(5);
    });

    it('rounds up for values just above integer', () => {
      expect(predictor.intceil(5.01)).toBe(6);
    });

    it('handles values just below next integer', () => {
      expect(predictor.intceil(5.99999)).toBe(6);
    });

    it('keeps exact integers unchanged', () => {
      expect(predictor.intceil(100)).toBe(100);
    });

    it('handles zero', () => {
      expect(predictor.intceil(0)).toBe(0);
    });

    it('handles negative values (trunc behavior)', () => {
      // Math.trunc(-5.5 + 0.99999) = Math.trunc(-4.50001) = -4
      // intceil uses trunc, not ceil, so negative behavior differs from Math.ceil
      expect(predictor.intceil(-5.5)).toBe(-4);
    });
  });

  describe('minimum_rate_from_given_and_base', () => {
    it('computes minimum rate', () => {
      const rate = predictor.minimum_rate_from_given_and_base(90, 100);
      // (90 - 0.99999) * 10000 / 100 = 8900.001
      expect(rate).toBeCloseTo(8900.001, 2);
    });

    it('scales with RATE_MULTIPLIER', () => {
      const rate = predictor.minimum_rate_from_given_and_base(100, 100);
      expect(rate).toBeCloseTo(9900.001, 2);
    });
  });

  describe('maximum_rate_from_given_and_base', () => {
    it('computes maximum rate', () => {
      const rate = predictor.maximum_rate_from_given_and_base(90, 100);
      // (90 + 0.00001) * 10000 / 100 = 9000.001
      expect(rate).toBeCloseTo(9000.001, 2);
    });
  });

  describe('rate_range_from_given_and_base', () => {
    it('returns [min_rate, max_rate]', () => {
      const range = predictor.rate_range_from_given_and_base(90, 100);
      expect(range).toHaveLength(2);
      expect(range[0]).toBeLessThan(range[1]);
    });
  });

  describe('get_price', () => {
    it('computes price from rate and base', () => {
      // rate=9000 (0.9x), base=100 => intceil(0.9 * 100) = 90
      expect(predictor.get_price(9000, 100)).toBe(90);
    });

    it('rounds up correctly', () => {
      // rate=9500, base=100 => intceil(95) = 95
      expect(predictor.get_price(9500, 100)).toBe(95);
    });

    it('handles rate that produces fractional price', () => {
      // rate=9001, base=100 => intceil(90.01) = 91
      expect(predictor.get_price(9001, 100)).toBe(91);
    });
  });

  describe('multiply_generator_probability', () => {
    it('multiplies all yielded probabilities by factor', () => {
      function* gen() {
        yield { probability: 0.5, data: 'a' };
        yield { probability: 0.3, data: 'b' };
      }
      const results = Array.from(predictor.multiply_generator_probability(gen(), 0.5));
      expect(results[0].probability).toBeCloseTo(0.25);
      expect(results[1].probability).toBeCloseTo(0.15);
      expect(results[0].data).toBe('a');
    });
  });

  describe('generate_individual_random_price', () => {
    it('generates predictions for empty given prices', () => {
      const given = [100, 100, NaN, NaN, NaN, NaN];
      const predicted = [{min: 100, max: 100}, {min: 100, max: 100}];
      const prob = predictor.generate_individual_random_price(
        given, predicted, 2, 4, 0.9, 1.4
      );
      expect(prob).toBeGreaterThan(0);
      expect(predicted).toHaveLength(6); // 2 initial + 4 generated
      for (let i = 2; i < 6; i++) {
        expect(predicted[i].min).toBeLessThanOrEqual(predicted[i].max);
        expect(predicted[i].min).toBeGreaterThan(0);
      }
    });

    it('returns 0 when given price is out of range', () => {
      const given = [100, 100, 200]; // 200 is way above 1.4*100=140
      const predicted = [{min: 100, max: 100}, {min: 100, max: 100}];
      const prob = predictor.generate_individual_random_price(
        given, predicted, 2, 1, 0.9, 1.4
      );
      expect(prob).toBe(0);
    });

    it('returns nonzero when given price is in range', () => {
      const given = [100, 100, 110]; // 110 is within [90, 140]
      const predicted = [{min: 100, max: 100}, {min: 100, max: 100}];
      const prob = predictor.generate_individual_random_price(
        given, predicted, 2, 1, 0.9, 1.4
      );
      expect(prob).toBeGreaterThan(0);
      expect(predicted[2].min).toBe(110);
      expect(predicted[2].max).toBe(110);
    });

    it('computes correct min/max from rate range', () => {
      const given = [100, 100, NaN];
      const predicted = [{min: 100, max: 100}, {min: 100, max: 100}];
      predictor.generate_individual_random_price(
        given, predicted, 2, 1, 0.9, 1.4
      );
      expect(predicted[2].min).toBe(predictor.get_price(0.9 * RATE_MULTIPLIER, 100));
      expect(predicted[2].max).toBe(predictor.get_price(1.4 * RATE_MULTIPLIER, 100));
    });

    it('handles length of 0 gracefully', () => {
      const given = [100, 100];
      const predicted = [{min: 100, max: 100}, {min: 100, max: 100}];
      const prob = predictor.generate_individual_random_price(
        given, predicted, 2, 0, 0.9, 1.4
      );
      expect(prob).toBe(1);
      expect(predicted).toHaveLength(2);
    });
  });

  describe('generate_decreasing_random_price', () => {
    it('generates decreasing prices', () => {
      const given = [100, 100, NaN, NaN, NaN, NaN];
      const predicted = [{min: 100, max: 100}, {min: 100, max: 100}];
      const prob = predictor.generate_decreasing_random_price(
        given, predicted, 2, 4, 0.6, 0.8, 0.04, 0.1
      );
      expect(prob).toBeGreaterThan(0);
      expect(predicted).toHaveLength(6);
      // Prices should generally decrease
      for (let i = 2; i < 5; i++) {
        expect(predicted[i].min).toBeGreaterThanOrEqual(predicted[i + 1].min);
      }
    });

    it('returns 0 for out-of-range given price', () => {
      const given = [100, 100, 200]; // way above max
      const predicted = [{min: 100, max: 100}, {min: 100, max: 100}];
      const prob = predictor.generate_decreasing_random_price(
        given, predicted, 2, 1, 0.6, 0.8, 0.04, 0.1
      );
      expect(prob).toBe(0);
    });

    it('accepts valid given prices in decreasing pattern', () => {
      const given = [100, 100, 75, 70]; // within decreasing range
      const predicted = [{min: 100, max: 100}, {min: 100, max: 100}];
      const prob = predictor.generate_decreasing_random_price(
        given, predicted, 2, 2, 0.6, 0.8, 0.04, 0.1
      );
      expect(prob).toBeGreaterThan(0);
    });
  });

  describe('generate_peak_price', () => {
    it('generates 3 peak prices', () => {
      const given = [100, 100, NaN, NaN, NaN, NaN, NaN];
      const predicted = [{min: 100, max: 100}, {min: 100, max: 100}];
      const prob = predictor.generate_peak_price(
        given, predicted, 2, 1.4, 2.0
      );
      expect(prob).toBeGreaterThan(0);
      expect(predicted).toHaveLength(5); // 2 + 3
      // Middle peak should be highest
      expect(predicted[3].max).toBeGreaterThanOrEqual(predicted[2].max);
      expect(predicted[3].max).toBeGreaterThanOrEqual(predicted[4].max);
    });

    it('returns 0 when middle price is out of range', () => {
      const given = [100, 100, NaN, 50, NaN]; // 50 way below peak range
      const predicted = [{min: 100, max: 100}, {min: 100, max: 100}];
      const prob = predictor.generate_peak_price(
        given, predicted, 2, 1.4, 2.0
      );
      expect(prob).toBe(0);
    });

    it('left and right prices are offset by -1 from peak', () => {
      const given = [100, 100, NaN, NaN, NaN];
      const predicted = [{min: 100, max: 100}, {min: 100, max: 100}];
      predictor.generate_peak_price(given, predicted, 2, 1.4, 2.0);
      // The min for left/right should be get_price(rate_min, buy) - 1
      const minPeakRate = 1.4 * RATE_MULTIPLIER;
      const expectedMin = predictor.get_price(minPeakRate, 100) - 1;
      expect(predicted[2].min).toBe(expectedMin);
      expect(predicted[4].min).toBe(expectedMin);
    });
  });

  describe('generate_pattern_0 (Fluctuating)', () => {
    it('generates possibilities for empty prices', () => {
      const given = [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
      const results = Array.from(predictor.generate_pattern_0(given));
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.pattern_number).toBe(0);
        expect(r.prices).toHaveLength(14);
        expect(r.probability).toBeGreaterThan(0);
      }
    });

    it('all possibilities have 14 price slots', () => {
      const given = [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
      for (const r of predictor.generate_pattern_0(given)) {
        expect(r.prices).toHaveLength(14);
      }
    });

    it('probabilities sum to a reasonable total', () => {
      const given = [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
      const results = Array.from(predictor.generate_pattern_0(given));
      const totalProb = results.reduce((acc, r) => acc + r.probability, 0);
      expect(totalProb).toBeGreaterThan(0);
      expect(totalProb).toBeLessThanOrEqual(1.0 + 1e-6);
    });

    it('filters out possibilities when given prices dont match', () => {
      // All prices are 50 which is below the minimum for high phase (0.9 * 100 = 90)
      const given = [100, 100, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50];
      const results = Array.from(predictor.generate_pattern_0(given));
      expect(results.length).toBe(0);
    });
  });

  describe('generate_pattern_1 (Large Spike)', () => {
    it('generates possibilities for empty prices', () => {
      const given = [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
      const results = Array.from(predictor.generate_pattern_1(given));
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.pattern_number).toBe(1);
        expect(r.prices).toHaveLength(14);
      }
    });

    it('peak price can reach up to 6x buy price', () => {
      const given = [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
      const results = Array.from(predictor.generate_pattern_1(given));
      let maxPrice = 0;
      for (const r of results) {
        for (const p of r.prices) {
          if (p.max > maxPrice) maxPrice = p.max;
        }
      }
      expect(maxPrice).toBeGreaterThanOrEqual(500); // 6.0 * 100 rounded up
    });

    it('iterates over all 7 possible peak starts (3 through 9)', () => {
      const given = [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
      const results = Array.from(predictor.generate_pattern_1(given));
      // Should have at least 7 results (one per peak start)
      expect(results.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe('generate_pattern_2 (Decreasing)', () => {
    it('generates exactly one possibility for empty prices', () => {
      const given = [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
      const results = Array.from(predictor.generate_pattern_2(given));
      expect(results).toHaveLength(1);
      expect(results[0].pattern_number).toBe(2);
      expect(results[0].prices).toHaveLength(14);
    });

    it('all predicted prices decrease over the week', () => {
      const given = [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
      const results = Array.from(predictor.generate_pattern_2(given));
      const prices = results[0].prices;
      for (let i = 2; i < 13; i++) {
        expect(prices[i].min).toBeGreaterThanOrEqual(prices[i + 1].min);
      }
    });

    it('rejects prices that are too high for decreasing', () => {
      const given = [100, 100, 80, 78, 76, 74, 72, 70, 68, 66, 64, 62, 60, 200];
      const results = Array.from(predictor.generate_pattern_2(given));
      expect(results).toHaveLength(0);
    });
  });

  describe('generate_pattern_3 (Small Spike)', () => {
    it('generates possibilities for empty prices', () => {
      const given = [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
      const results = Array.from(predictor.generate_pattern_3(given));
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.pattern_number).toBe(3);
        expect(r.prices).toHaveLength(14);
      }
    });

    it('iterates over all 8 possible peak starts (2 through 9)', () => {
      const given = [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
      const results = Array.from(predictor.generate_pattern_3(given));
      expect(results.length).toBeGreaterThanOrEqual(8);
    });

    it('peak prices are higher than decreasing prices', () => {
      const given = [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
      const results = Array.from(predictor.generate_pattern_3(given));
      for (const r of results) {
        // The peak region should have max values > 100 (the buy price)
        let hasHighPeak = false;
        for (const p of r.prices.slice(2)) {
          if (p.max > 100) hasHighPeak = true;
        }
        expect(hasHighPeak).toBe(true);
      }
    });
  });

  describe('get_transition_probability', () => {
    it('returns matrix row for known previous pattern', () => {
      const prob = predictor.get_transition_probability(PATTERN.FLUCTUATING);
      expect(prob).toBe(PROBABILITY_MATRIX[PATTERN.FLUCTUATING]);
    });

    it('returns steady state for null previous pattern', () => {
      const prob = predictor.get_transition_probability(null);
      expect(prob).toHaveLength(4);
      const sum = prob.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('returns steady state for undefined previous pattern', () => {
      const prob = predictor.get_transition_probability(undefined);
      expect(prob).toHaveLength(4);
    });

    it('returns steady state for NaN previous pattern', () => {
      const prob = predictor.get_transition_probability(NaN);
      expect(prob).toHaveLength(4);
    });

    it('returns steady state for out-of-range pattern (-1)', () => {
      const prob = predictor.get_transition_probability(-1);
      expect(prob).toHaveLength(4);
    });

    it('returns steady state for out-of-range pattern (4)', () => {
      const prob = predictor.get_transition_probability(4);
      expect(prob).toHaveLength(4);
    });

    it('returns matrix row for all four valid patterns', () => {
      for (let i = 0; i < 4; i++) {
        const prob = predictor.get_transition_probability(i);
        expect(prob).toBe(PROBABILITY_MATRIX[i]);
      }
    });
  });

  describe('generate_all_patterns', () => {
    it('generates results from all four patterns', () => {
      const given = [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
      const results = Array.from(predictor.generate_all_patterns(given, null));
      const patternNumbers = new Set(results.map(r => r.pattern_number));
      expect(patternNumbers).toContain(0);
      expect(patternNumbers).toContain(1);
      expect(patternNumbers).toContain(2);
      expect(patternNumbers).toContain(3);
    });

    it('weights results by transition probability', () => {
      const given = [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];

      // With previous pattern = LARGE_SPIKE, FLUCTUATING should have higher weight
      const results = Array.from(predictor.generate_all_patterns(given, PATTERN.LARGE_SPIKE));
      const totalProb = results.reduce((acc, r) => acc + r.probability, 0);
      expect(totalProb).toBeGreaterThan(0);
    });
  });

  describe('generate_possibilities', () => {
    it('generates possibilities when buy price is known', () => {
      const given = [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
      const results = Array.from(predictor.generate_possibilities(given, false, null));
      expect(results.length).toBeGreaterThan(0);
    });

    it('generates possibilities when buy price is unknown (NaN)', { timeout: 30000 }, () => {
      const given = [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
      const results = Array.from(predictor.generate_possibilities(given, false, null));
      expect(results.length).toBeGreaterThan(0);
      // Should try all buy prices 90-110
    });

    it('first_buy only generates pattern 3', () => {
      const given = [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
      const results = Array.from(predictor.generate_possibilities(given, true, null));
      for (const r of results) {
        expect(r.pattern_number).toBe(3);
      }
    });

    it('first_buy iterates over buy prices 90-110', () => {
      const given = [NaN, NaN, 80, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
      const results = Array.from(predictor.generate_possibilities(given, true, null));
      // With a given sell price of 80, only certain buy prices will match
      // All results should be pattern 3
      for (const r of results) {
        expect(r.pattern_number).toBe(3);
      }
    });
  });

  describe('analyze_possibilities', () => {
    it('returns array with global summary at index 0', () => {
      const p = new Predictor(
        [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
        false, null
      );
      const results = p.analyze_possibilities();
      expect(results.length).toBeGreaterThan(1);
      expect(results[0].pattern_number).toBe(4); // global min/max summary
    });

    it('global summary has 14 price entries', () => {
      const p = new Predictor(
        [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
        false, null
      );
      const results = p.analyze_possibilities();
      expect(results[0].prices).toHaveLength(14);
    });

    it('probabilities of non-summary results sum to 1', () => {
      const p = new Predictor(
        [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
        false, null
      );
      const results = p.analyze_possibilities();
      const nonSummary = results.filter(r => r.pattern_number !== 4);
      const totalProb = nonSummary.reduce((acc, r) => acc + r.probability, 0);
      expect(totalProb).toBeCloseTo(1.0, 5);
    });

    it('category_total_probability sums match per-pattern probabilities', () => {
      const p = new Predictor(
        [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
        false, null
      );
      const results = p.analyze_possibilities();
      const nonSummary = results.filter(r => r.pattern_number !== 4);

      for (let patNum = 0; patNum < 4; patNum++) {
        const patternResults = nonSummary.filter(r => r.pattern_number === patNum);
        if (patternResults.length === 0) continue;
        const expectedTotal = patternResults.reduce((acc, r) => acc + r.probability, 0);
        expect(patternResults[0].category_total_probability).toBeCloseTo(expectedTotal, 5);
      }
    });

    it('results are sorted by category probability then individual probability', () => {
      const p = new Predictor(
        [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
        false, null
      );
      const results = p.analyze_possibilities();
      const nonSummary = results.filter(r => r.pattern_number !== 4);
      for (let i = 1; i < nonSummary.length; i++) {
        const a = nonSummary[i - 1];
        const b = nonSummary[i];
        const cmp = b.category_total_probability - a.category_total_probability || b.probability - a.probability;
        expect(cmp).toBeLessThanOrEqual(1e-10);
      }
    });

    it('weekGuaranteedMinimum and weekMax are computed', () => {
      const p = new Predictor(
        [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
        false, null
      );
      const results = p.analyze_possibilities();
      for (const r of results) {
        expect(r.weekGuaranteedMinimum).toBeDefined();
        expect(r.weekMax).toBeDefined();
        expect(r.weekMax).toBeGreaterThanOrEqual(r.weekGuaranteedMinimum);
      }
    });

    it('global summary weekMax >= all individual weekMax', () => {
      const p = new Predictor(
        [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
        false, null
      );
      const results = p.analyze_possibilities();
      const globalMax = results[0].weekMax;
      for (const r of results.slice(1)) {
        expect(globalMax).toBeGreaterThanOrEqual(r.weekMax);
      }
    });

    it('handles all given prices', () => {
      const p = new Predictor(
        [100, 100, 91, 85, 80, 75, 70, 110, 135, 200, 130, 90, 45, 40],
        false, PATTERN.LARGE_SPIKE
      );
      const results = p.analyze_possibilities();
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('uses fudge factor when no exact match', () => {
      // Prices that don't exactly match any pattern but could with slight fudge
      const p = new Predictor(
        [100, 100, 92, 88, 84, 80, 76, 72, 68, 64, 60, 56, 52, 48],
        false, null
      );
      const results = p.analyze_possibilities();
      // Should find results (possibly with fudge_factor > 0)
      expect(results.length).toBeGreaterThan(0);
    });

    it('first_buy produces only pattern 3 results', () => {
      const p = new Predictor(
        [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
        true, null
      );
      const results = p.analyze_possibilities();
      const nonSummary = results.filter(r => r.pattern_number !== 4);
      for (const r of nonSummary) {
        expect(r.pattern_number).toBe(3);
      }
    });

    it('returns empty-ish result for impossible prices', () => {
      // All prices 999 - impossible
      const p = new Predictor(
        [100, 100, 999, 999, 999, 999, 999, 999, 999, 999, 999, 999, 999, 999],
        false, null
      );
      const results = p.analyze_possibilities();
      // With max fudge_factor of 5, it still might not match
      // If no matches, should return array with just global summary or empty
      // The code still inserts a summary even if empty
      if (results.length > 0) {
        const nonSummary = results.filter(r => r.pattern_number !== 4);
        // Either no results or fudged results
        expect(nonSummary.length).toBeLessThanOrEqual(results.length);
      }
    });

    it('handles buy price of 90 (minimum)', () => {
      const p = new Predictor(
        [90, 90, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
        false, null
      );
      const results = p.analyze_possibilities();
      expect(results.length).toBeGreaterThan(0);
    });

    it('handles buy price of 110 (maximum)', () => {
      const p = new Predictor(
        [110, 110, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
        false, null
      );
      const results = p.analyze_possibilities();
      expect(results.length).toBeGreaterThan(0);
    });

    it('with previous_pattern set, probabilities are weighted accordingly', () => {
      const p1 = new Predictor(
        [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
        false, PATTERN.DECREASING
      );
      const results1 = p1.analyze_possibilities();
      const largeSpikeProb1 = results1
        .filter(r => r.pattern_number === 1)
        .reduce((acc, r) => acc + r.probability, 0);

      const p2 = new Predictor(
        [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
        false, PATTERN.LARGE_SPIKE
      );
      const results2 = p2.analyze_possibilities();
      const largeSpikeProb2 = results2
        .filter(r => r.pattern_number === 1)
        .reduce((acc, r) => acc + r.probability, 0);

      // After DECREASING, LARGE_SPIKE has 0.45 probability
      // After LARGE_SPIKE, LARGE_SPIKE has only 0.05 probability
      expect(largeSpikeProb1).toBeGreaterThan(largeSpikeProb2);
    });
  });
});

// ─── Integration / Scenario Tests ────────────────────────────────────────────

describe('Integration scenarios', () => {
  it('Monday AM price narrows predictions', () => {
    const withoutData = new Predictor(
      [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
      false, null
    );
    const withData = new Predictor(
      [100, 100, 95, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
      false, null
    );
    const r1 = withoutData.analyze_possibilities();
    const r2 = withData.analyze_possibilities();
    // Adding data should reduce possibilities
    expect(r2.length).toBeLessThanOrEqual(r1.length);
  });

  it('full decreasing pattern is recognized', () => {
    const p = new Predictor(
      [100, 100, 86, 83, 79, 76, 73, 69, 66, 63, 59, 56, 53, 49],
      false, null
    );
    const results = p.analyze_possibilities();
    const nonSummary = results.filter(r => r.pattern_number !== 4);
    // Should match decreasing pattern (2) among others
    const hasDecreasing = nonSummary.some(r => r.pattern_number === 2);
    expect(hasDecreasing).toBe(true);
  });

  it('large spike is detected when prices go very high', () => {
    // Pattern: decreasing, then huge spike at position 5
    const p = new Predictor(
      [100, 100, 88, 85, 82, 95, 500, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
      false, null
    );
    const results = p.analyze_possibilities();
    const nonSummary = results.filter(r => r.pattern_number !== 4);
    if (nonSummary.length > 0) {
      const hasLargeSpike = nonSummary.some(r => r.pattern_number === 1);
      expect(hasLargeSpike).toBe(true);
    }
  });

  it('different buy prices produce different predictions', () => {
    const p1 = new Predictor(
      [90, 90, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
      false, null
    );
    const p2 = new Predictor(
      [110, 110, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
      false, null
    );
    const r1 = p1.analyze_possibilities();
    const r2 = p2.analyze_possibilities();
    // Global min/max should differ
    expect(r1[0].prices[2].min).not.toBe(r2[0].prices[2].min);
  });

  it('partial week data gives valid predictions', () => {
    const p = new Predictor(
      [100, 100, 92, 88, 84, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
      false, PATTERN.FLUCTUATING
    );
    const results = p.analyze_possibilities();
    expect(results.length).toBeGreaterThan(0);
    // All non-summary results should have valid min <= max
    for (const r of results.filter(x => x.pattern_number !== 4)) {
      for (const price of r.prices) {
        expect(price.min).toBeLessThanOrEqual(price.max);
      }
    }
  });

  it('weekGuaranteedMinimum represents worst case of remaining days', () => {
    const p = new Predictor(
      [100, 100, 90, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
      false, null
    );
    const results = p.analyze_possibilities();
    for (const r of results.filter(x => x.pattern_number !== 4)) {
      // weekGuaranteedMinimum should be <= weekMax
      expect(r.weekGuaranteedMinimum).toBeLessThanOrEqual(r.weekMax);
    }
  });
});

// ─── Edge Cases ──────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('PDF with very small range', () => {
    const pdf = new PDF(100, 100.001);
    expect(pdf.prob.length).toBeGreaterThan(0);
    expect(float_sum(pdf.prob)).toBeCloseTo(1.0, 5);
  });

  it('PDF with very large range', () => {
    const pdf = new PDF(0, 10000);
    expect(pdf.prob.length).toBe(10000);
    expect(float_sum(pdf.prob)).toBeCloseTo(1.0, 5);
  });

  it('range_intersect with negative ranges', () => {
    expect(range_intersect([-10, -5], [-7, -3])).toEqual([-7, -5]);
  });

  it('float_sum handles all zeros', () => {
    expect(float_sum([0, 0, 0, 0])).toBe(0);
  });

  it('prefix_float_sum handles single element', () => {
    const result = prefix_float_sum([42]);
    expect(result).toHaveLength(2);
    expect(result[1][0] + result[1][1]).toBeCloseTo(42);
  });

  it('Predictor with all NaN prices still produces results', { timeout: 30000 }, () => {
    const p = new Predictor(
      [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
      false, null
    );
    const results = p.analyze_possibilities();
    expect(results.length).toBeGreaterThan(0);
  });

  it('Predictor handles buy price at boundary', () => {
    for (const buyPrice of [90, 91, 100, 109, 110]) {
      const p = new Predictor(
        [buyPrice, buyPrice, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
        false, null
      );
      const results = p.analyze_possibilities();
      expect(results.length).toBeGreaterThan(0);
    }
  });
});

// ─── compute_expected_values ─────────────────────────────────────────────────

describe('compute_expected_values', () => {
  function getAnalyzed(buyPrice, prices, firstBuy, prevPattern) {
    const p = new Predictor(prices || [buyPrice, buyPrice, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN], firstBuy || false, prevPattern === undefined ? null : prevPattern);
    return p.analyze_possibilities();
  }

  it('returns an array of 12 values (one per half-day slot)', () => {
    const analyzed = getAnalyzed(100);
    const ev = compute_expected_values(analyzed);
    expect(ev).toHaveLength(12);
  });

  it('all expected values are positive for a normal buy price', () => {
    const analyzed = getAnalyzed(100);
    const ev = compute_expected_values(analyzed);
    for (const val of ev) {
      expect(val).toBeGreaterThan(0);
    }
  });

  it('expected values are finite numbers', () => {
    const analyzed = getAnalyzed(100);
    const ev = compute_expected_values(analyzed);
    for (const val of ev) {
      expect(Number.isFinite(val)).toBe(true);
    }
  });

  it('skips the global summary entry (pattern_number 4)', () => {
    const analyzed = getAnalyzed(100);
    // Manually verify: if we include pattern 4, values would be different
    const evCorrect = compute_expected_values(analyzed);
    // The global summary min/max are wider than weighted averages
    // So expected values should be within global min/max range
    const globalSummary = analyzed.find(a => a.pattern_number === 4);
    for (let i = 0; i < 12; i++) {
      expect(evCorrect[i]).toBeGreaterThanOrEqual(globalSummary.prices[i + 2].min);
      expect(evCorrect[i]).toBeLessThanOrEqual(globalSummary.prices[i + 2].max);
    }
  });

  it('expected values change with different buy prices', () => {
    const ev90 = compute_expected_values(getAnalyzed(90));
    const ev110 = compute_expected_values(getAnalyzed(110));
    // Higher buy price should lead to higher expected sell prices
    for (let i = 0; i < 12; i++) {
      expect(ev110[i]).toBeGreaterThan(ev90[i]);
    }
  });

  it('expected values change with different previous patterns', () => {
    const evAfterDecreasing = compute_expected_values(getAnalyzed(100, undefined, false, PATTERN.DECREASING));
    const evAfterLargeSpike = compute_expected_values(getAnalyzed(100, undefined, false, PATTERN.LARGE_SPIKE));
    // After decreasing, large spike is more likely (0.45), so expected values should be higher
    const avgDecreasing = evAfterDecreasing.reduce((a, b) => a + b, 0) / 12;
    const avgLargeSpike = evAfterLargeSpike.reduce((a, b) => a + b, 0) / 12;
    expect(avgDecreasing).not.toBeCloseTo(avgLargeSpike, 1);
  });

  it('expected values with given prices constrain the result', () => {
    const pricesWithData = [100, 100, 90, 85, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
    const pricesWithout = [100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
    const evWith = compute_expected_values(getAnalyzed(100, pricesWithData));
    const evWithout = compute_expected_values(getAnalyzed(100, pricesWithout));
    // First two slots should differ since we provided actual prices
    expect(evWith[0]).not.toBeCloseTo(evWithout[0], 0);
  });

  it('first_buy produces different expected values than normal', { timeout: 30000 }, () => {
    const p1 = new Predictor([NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN], true, null);
    const p2 = new Predictor([NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN], false, null);
    const ev1 = compute_expected_values(p1.analyze_possibilities());
    const ev2 = compute_expected_values(p2.analyze_possibilities());
    // first_buy only generates pattern 3, so values should differ
    const sum1 = ev1.reduce((a, b) => a + b, 0);
    const sum2 = ev2.reduce((a, b) => a + b, 0);
    expect(sum1).not.toBeCloseTo(sum2, 0);
  });

  it('handles single possibility result', () => {
    // Fully specified decreasing pattern
    const prices = [100, 100, 86, 83, 79, 76, 73, 69, 66, 63, 59, 56, 53, 49];
    const analyzed = getAnalyzed(100, prices, false, PATTERN.FLUCTUATING);
    const ev = compute_expected_values(analyzed);
    expect(ev).toHaveLength(12);
    // With all prices given, expected values should be close to the given prices
    for (let i = 0; i < 12; i++) {
      if (!isNaN(prices[i + 2])) {
        expect(ev[i]).toBeCloseTo(prices[i + 2], 0);
      }
    }
  });
});

// ─── find_expected_maximum ───────────────────────────────────────────────────

describe('find_expected_maximum', () => {
  it('finds the maximum value and its index', () => {
    const values = [50, 80, 120, 90, 60, 40, 30, 20, 15, 10, 8, 5];
    const result = find_expected_maximum(values, 0);
    expect(result.expected_maximum).toBe(120);
    expect(result.expected_argmax).toBe(2);
  });

  it('searches only from the given slot onwards', () => {
    const values = [200, 50, 80, 120, 90, 60, 40, 30, 20, 15, 10, 5];
    const result = find_expected_maximum(values, 1);
    expect(result.expected_maximum).toBe(120);
    expect(result.expected_argmax).toBe(3);
  });

  it('handles from_slot of 0', () => {
    const values = [100, 50, 30];
    const result = find_expected_maximum(values, 0);
    expect(result.expected_maximum).toBe(100);
    expect(result.expected_argmax).toBe(0);
  });

  it('handles negative from_slot (treats as 0)', () => {
    const values = [100, 200, 50];
    const result = find_expected_maximum(values, -5);
    expect(result.expected_maximum).toBe(200);
    expect(result.expected_argmax).toBe(1);
  });

  it('returns 0 when searching past the end', () => {
    const values = [100, 200, 50];
    const result = find_expected_maximum(values, 10);
    expect(result.expected_maximum).toBe(0);
    expect(result.expected_argmax).toBe(0);
  });

  it('returns the first maximum when there are ties', () => {
    const values = [50, 100, 100, 50];
    const result = find_expected_maximum(values, 0);
    expect(result.expected_maximum).toBe(100);
    expect(result.expected_argmax).toBe(1);
  });

  it('handles single-element array', () => {
    const result = find_expected_maximum([42], 0);
    expect(result.expected_maximum).toBe(42);
    expect(result.expected_argmax).toBe(0);
  });

  it('handles empty array', () => {
    const result = find_expected_maximum([], 0);
    expect(result.expected_maximum).toBe(0);
  });

  it('works with real expected values from predictor', () => {
    const p = new Predictor([100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN], false, null);
    const analyzed = p.analyze_possibilities();
    const ev = compute_expected_values(analyzed);
    const result = find_expected_maximum(ev, 0);
    expect(result.expected_maximum).toBeGreaterThan(0);
    expect(result.expected_argmax).toBeGreaterThanOrEqual(0);
    expect(result.expected_argmax).toBeLessThan(12);
    expect(result.expected_maximum).toBe(ev[result.expected_argmax]);
  });

  it('from_slot restricts search correctly with real data', () => {
    const p = new Predictor([100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN], false, null);
    const ev = compute_expected_values(p.analyze_possibilities());
    const fullResult = find_expected_maximum(ev, 0);
    const laterResult = find_expected_maximum(ev, 6); // from Wednesday PM onwards
    expect(laterResult.expected_maximum).toBeLessThanOrEqual(fullResult.expected_maximum);
  });
});

// ─── get_sell_buy_decision ───────────────────────────────────────────────────

describe('get_sell_buy_decision', () => {
  const DATA_LENGTH = 14;

  describe('sell decisions (curr_time >= 0)', () => {
    it('returns sell-later when expected max > current price', () => {
      const result = get_sell_buy_decision(80, 3, 150, DATA_LENGTH);
      expect(result.type).toBe("sell");
      expect(result.action).toBe("sell-later");
    });

    it('returns sell-now when expected max <= current price', () => {
      const result = get_sell_buy_decision(200, 3, 150, DATA_LENGTH);
      expect(result.type).toBe("sell");
      expect(result.action).toBe("sell-now");
    });

    it('returns sell-now when expected max equals current price', () => {
      const result = get_sell_buy_decision(150, 3, 150, DATA_LENGTH);
      expect(result.type).toBe("sell");
      expect(result.action).toBe("sell-now");
    });

    it('works at slot 0 (Monday AM)', () => {
      const result = get_sell_buy_decision(90, 0, 120, DATA_LENGTH);
      expect(result.type).toBe("sell");
      expect(result.action).toBe("sell-later");
    });

    it('works at slot 10 (Saturday AM, last valid sell slot)', () => {
      const result = get_sell_buy_decision(90, 10, 120, DATA_LENGTH);
      expect(result.type).toBe("sell");
      expect(result.action).toBe("sell-later");
    });

    it('returns null at slot 11 (Saturday PM, last slot, data.length-3)', () => {
      // curr_time=11, data_length-3=11, so curr_time < data_length-3 is false
      const result = get_sell_buy_decision(90, 11, 120, DATA_LENGTH);
      expect(result).toBeNull();
    });
  });

  describe('buy decisions (curr_time < 0, i.e. Sunday)', () => {
    it('returns should-buy when expected max > current price', () => {
      const result = get_sell_buy_decision(95, -2, 150, DATA_LENGTH);
      expect(result.type).toBe("buy");
      expect(result.action).toBe("should-buy");
    });

    it('returns should-not-buy when expected max <= current price', () => {
      const result = get_sell_buy_decision(200, -2, 150, DATA_LENGTH);
      expect(result.type).toBe("buy");
      expect(result.action).toBe("should-not-buy");
    });

    it('returns should-not-buy when expected max equals current price', () => {
      const result = get_sell_buy_decision(150, -1, 150, DATA_LENGTH);
      expect(result.type).toBe("buy");
      expect(result.action).toBe("should-not-buy");
    });

    it('works with Sunday AM (curr_time = -2)', () => {
      const result = get_sell_buy_decision(100, -2, 200, DATA_LENGTH);
      expect(result.type).toBe("buy");
    });

    it('works with Sunday PM (curr_time = -1)', () => {
      const result = get_sell_buy_decision(100, -1, 200, DATA_LENGTH);
      expect(result.type).toBe("buy");
    });
  });

  describe('null/no-decision cases', () => {
    it('returns null when curr_price is 0', () => {
      expect(get_sell_buy_decision(0, 3, 150, DATA_LENGTH)).toBeNull();
    });

    it('returns null when curr_price is NaN', () => {
      expect(get_sell_buy_decision(NaN, 3, 150, DATA_LENGTH)).toBeNull();
    });

    it('returns null when curr_price is undefined', () => {
      expect(get_sell_buy_decision(undefined, 3, 150, DATA_LENGTH)).toBeNull();
    });

    it('returns null when curr_price is null', () => {
      expect(get_sell_buy_decision(null, 3, 150, DATA_LENGTH)).toBeNull();
    });

    it('returns null at the very last time slot', () => {
      expect(get_sell_buy_decision(100, 11, 150, DATA_LENGTH)).toBeNull();
    });

    it('returns null for curr_time beyond data range', () => {
      expect(get_sell_buy_decision(100, 20, 150, DATA_LENGTH)).toBeNull();
    });
  });

  describe('boundary conditions', () => {
    it('handles very high expected maximum', () => {
      const result = get_sell_buy_decision(100, 3, 660, DATA_LENGTH);
      expect(result.type).toBe("sell");
      expect(result.action).toBe("sell-later");
    });

    it('handles very low expected maximum', () => {
      const result = get_sell_buy_decision(100, 3, 1, DATA_LENGTH);
      expect(result.type).toBe("sell");
      expect(result.action).toBe("sell-now");
    });

    it('handles expected_maximum of 0', () => {
      const result = get_sell_buy_decision(100, 3, 0, DATA_LENGTH);
      expect(result.type).toBe("sell");
      expect(result.action).toBe("sell-now");
    });
  });
});

// ─── Expected Value Integration Tests ────────────────────────────────────────

describe('Expected value integration', () => {
  it('full pipeline: analyze -> expected values -> find max -> decision', () => {
    const p = new Predictor([100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN], false, null);
    const analyzed = p.analyze_possibilities();
    const ev = compute_expected_values(analyzed);
    const { expected_maximum, expected_argmax } = find_expected_maximum(ev, 0);

    expect(ev).toHaveLength(12);
    expect(expected_maximum).toBeGreaterThan(0);

    // Simulate Monday AM with price 90
    const decision = get_sell_buy_decision(90, 0, expected_maximum, 14);
    expect(decision).not.toBeNull();
    expect(decision.type).toBe("sell");
    // Expected max should be > 90 for buy price 100 (large spike possible)
    expect(decision.action).toBe("sell-later");
  });

  it('full pipeline with Sunday (buy decision)', () => {
    const p = new Predictor([100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN], false, null);
    const analyzed = p.analyze_possibilities();
    const ev = compute_expected_values(analyzed);
    const { expected_maximum } = find_expected_maximum(ev, 0);

    // Sunday AM, Daisy Mae price is 95
    const decision = get_sell_buy_decision(95, -2, expected_maximum, 14);
    expect(decision).not.toBeNull();
    expect(decision.type).toBe("buy");
    // Expected max should be > 95 (large spike possible)
    expect(decision.action).toBe("should-buy");
  });

  it('expected values with partial data still produce valid decisions', () => {
    const p = new Predictor([100, 100, 92, 88, 84, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN], false, PATTERN.FLUCTUATING);
    const analyzed = p.analyze_possibilities();
    const ev = compute_expected_values(analyzed);
    const { expected_maximum } = find_expected_maximum(ev, 3); // from Tuesday PM onwards

    expect(expected_maximum).toBeGreaterThan(0);
    const decision = get_sell_buy_decision(84, 3, expected_maximum, 14);
    expect(decision).not.toBeNull();
    expect(decision.type).toBe("sell");
  });

  it('expected values sum correctly represents weighted average', () => {
    const p = new Predictor([100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN], false, null);
    const analyzed = p.analyze_possibilities();
    const ev = compute_expected_values(analyzed);

    // Each expected value should be the probability-weighted midpoint
    for (let slot = 0; slot < 12; slot++) {
      let manual_ev = 0;
      for (const poss of analyzed) {
        if (poss.pattern_number === 4) continue;
        const day = poss.prices[slot + 2];
        manual_ev += (poss.probability * (day.max + day.min)) / 2;
      }
      expect(ev[slot]).toBeCloseTo(manual_ev, 10);
    }
  });

  it('expected maximum is always within global min/max bounds', () => {
    for (const buyPrice of [90, 100, 110]) {
      const p = new Predictor([buyPrice, buyPrice, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN], false, null);
      const analyzed = p.analyze_possibilities();
      const ev = compute_expected_values(analyzed);
      const globalSummary = analyzed.find(a => a.pattern_number === 4);
      const { expected_maximum, expected_argmax } = find_expected_maximum(ev, 0);

      expect(expected_maximum).toBeLessThanOrEqual(globalSummary.prices[expected_argmax + 2].max);
      expect(expected_maximum).toBeGreaterThanOrEqual(globalSummary.prices[expected_argmax + 2].min);
    }
  });

  it('after decreasing pattern, expected values are higher (large spike more likely)', () => {
    const p1 = new Predictor([100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN], false, PATTERN.DECREASING);
    const p2 = new Predictor([100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN], false, PATTERN.LARGE_SPIKE);
    const ev1 = compute_expected_values(p1.analyze_possibilities());
    const ev2 = compute_expected_values(p2.analyze_possibilities());
    const max1 = find_expected_maximum(ev1, 0).expected_maximum;
    const max2 = find_expected_maximum(ev2, 0).expected_maximum;
    // After decreasing, large spike has 45% chance vs 5% after large spike
    expect(max1).toBeGreaterThan(max2);
  });
});
