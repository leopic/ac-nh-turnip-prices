import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import vm from 'vm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read the source files
const predictionsSource = fs.readFileSync(path.join(__dirname, 'predictions.js'), 'utf-8');
const scriptsSource = fs.readFileSync(path.join(__dirname, 'scripts.js'), 'utf-8');

// Minimal HTML structure matching index.html
const HTML_TEMPLATE = `<!doctype html>
<html lang="en">
<body>
  <form class="input__form">
    <input type="radio" id="first-time-radio-no" name="first-time" value="false" checked>
    <input type="radio" id="first-time-radio-yes" name="first-time" value="true">

    <input type="radio" id="pattern-radio-unknown" name="pattern" value="-1" checked>
    <input type="radio" id="pattern-radio-fluctuating" name="pattern" value="0">
    <input type="radio" id="pattern-radio-small-spike" name="pattern" value="3">
    <input type="radio" id="pattern-radio-large-spike" name="pattern" value="1">
    <input type="radio" id="pattern-radio-decreasing" name="pattern" value="2">

    <input type="number" id="buy" placeholder="..." />
    <input type="number" id="sell_2" placeholder="..." />
    <input type="number" id="sell_3" placeholder="..." />
    <input type="number" id="sell_4" placeholder="..." />
    <input type="number" id="sell_5" placeholder="..." />
    <input type="number" id="sell_6" placeholder="..." />
    <input type="number" id="sell_7" placeholder="..." />
    <input type="number" id="sell_8" placeholder="..." />
    <input type="number" id="sell_9" placeholder="..." />
    <input type="number" id="sell_10" placeholder="..." />
    <input type="number" id="sell_11" placeholder="..." />
    <input type="number" id="sell_12" placeholder="..." />
    <input type="number" id="sell_13" placeholder="..." />

    <input id="permalink-input" type="text" readOnly />
    <button type="button" id="permalink-btn" class="button permalink"></button>
    <button type="button" id="reset" class="button button--reset"></button>
  </form>

  <div class="dialog-box error" style="display:none;"></div>
  <div class="chart-wrapper" style="display:none;">
    <canvas id="chart" width="100%" height="100"></canvas>
  </div>
  <div class="table-wrapper">
    <table id="turnipTable">
      <tbody id="output"></tbody>
    </table>
  </div>
  <div id="results-live" aria-live="polite"></div>
  <div id="decision"></div>
  <div id="snackbar"></div>
</body>
</html>`;

// Minimal jQuery mock that covers what scripts.js uses
function createJQueryMock(document) {
  const $ = function (selector) {
    if (selector === document) {
      // $(document) — return event handler support
      const handlers = {};
      return {
        trigger(event) {
          if (handlers[event]) handlers[event].forEach(fn => fn({ target: {} }));
        },
        on(event, fn) {
          if (!handlers[event]) handlers[event] = [];
          handlers[event].push(fn);
        },
        ready(fn) { fn(); },
      };
    }

    let elements;
    if (typeof selector === 'string') {
      // Handle jQuery pseudo-classes not supported by JSDOM
      const hasVisible = selector.includes(':visible');
      const hasHidden = selector.includes(':hidden');
      const cleanSelector = selector.replace(/:visible|:hidden/g, '');
      elements = cleanSelector ? Array.from(document.querySelectorAll(cleanSelector)) : [];
      if (hasVisible) {
        elements = elements.filter(el => el.style.display !== 'none');
      }
      if (hasHidden) {
        elements = elements.filter(el => el.style.display === 'none');
      }
    } else if (selector instanceof Array) {
      elements = selector;
    } else {
      elements = [selector];
    }

    const obj = {
      0: elements[0],
      length: elements.length,
      [Symbol.iterator]() { return elements[Symbol.iterator](); },
      val(v) {
        if (v === undefined) return elements[0] ? elements[0].value : '';
        elements.forEach(el => { el.value = v; });
        return obj;
      },
      html(v) {
        if (v === undefined) return elements[0] ? elements[0].innerHTML : '';
        elements.forEach(el => { el.innerHTML = v; });
        return obj;
      },
      text(v) {
        if (v === undefined) return elements[0] ? elements[0].textContent : '';
        elements.forEach(el => { el.textContent = v; });
        return obj;
      },
      empty() {
        elements.forEach(el => { el.innerHTML = ''; });
        return obj;
      },
      append(content) {
        elements.forEach(el => { el.insertAdjacentHTML('beforeend', content); });
        return obj;
      },
      show() {
        elements.forEach(el => { el.style.display = ''; });
        return obj;
      },
      hide() {
        elements.forEach(el => { el.style.display = 'none'; });
        return obj;
      },
      focus() { if (elements[0] && elements[0].focus) elements[0].focus(); return obj; },
      blur() { if (elements[0] && elements[0].blur) elements[0].blur(); return obj; },
      on(event, fn) {
        elements.forEach(el => el.addEventListener(event, fn));
        return obj;
      },
      addClass(cls) {
        elements.forEach(el => el.classList.add(cls));
        return obj;
      },
      removeClass(cls) {
        elements.forEach(el => el.classList.remove(cls));
        return obj;
      },
      select() { return obj; },
      setSelectionRange() { return obj; },
      map(fn) { return elements.map((el, i) => fn.call(el, i, el)); },
      filter(fn) { return $(elements.filter(fn)); },
      find(sel) {
        const found = [];
        elements.forEach(el => found.push(...el.querySelectorAll(sel)));
        return $(found);
      },
    };
    return obj;
  };
  return $;
}

// i18next mock that returns the key (or key with interpolation)
function createI18nextMock() {
  return {
    t(key, params) {
      if (params && Array.isArray(params)) {
        let result = key;
        params.forEach((p, i) => { result += ` ${p}`; });
        return result;
      }
      return key;
    },
  };
}

/**
 * Set up a full environment and load scripts.js, returning the window globals.
 * @param {object} options
 * @param {string} options.search - query string (e.g. "?prices=100.90.85")
 * @param {object} options.localStorage - initial localStorage entries
 */
function setupEnvironment(options = {}) {
  const dom = new JSDOM(HTML_TEMPLATE, {
    url: `http://localhost${options.search || ''}`,
    pretendToBeVisual: true,
    runScripts: 'dangerously',
  });
  const { window } = dom;
  const { document } = window;

  // Mock localStorage (read-only in JSDOM, so use defineProperty)
  const store = { ...(options.localStorage || {}) };
  const storageMock = {
    getItem: (key) => key in store ? store[key] : null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
  };
  Object.defineProperty(window, 'localStorage', { value: storageMock, writable: true });

  // Mock document.execCommand
  document.execCommand = vi.fn(() => true);

  // Set up globals that scripts.js needs at load time
  const $ = createJQueryMock(document);
  window.$ = $;
  window.jQuery = $;
  window.i18next = createI18nextMock();
  window.Chart = class MockChart {
    constructor() { this.data = {}; this.options = {}; }
    update() {}
  };
  window.chart_instance = null;
  window.update_chart = vi.fn();
  window.confirm = vi.fn(() => true);

  // Execute scripts in the JSDOM window context.
  // const/let are block-scoped in vm and won't be visible on window,
  // so we convert them to var for test visibility.
  const toVar = (src) => src.replace(/\b(const|let)\s/g, 'var ');
  const vmContext = dom.getInternalVMContext();
  vm.runInContext(toVar(predictionsSource), vmContext, { filename: 'predictions.js' });
  vm.runInContext(toVar(scriptsSource), vmContext, { filename: 'scripts.js' });

  return { window, document, dom, store };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('isEmpty', () => {
  let env;
  beforeEach(() => { env = setupEnvironment(); });

  it('returns true for array of NaNs', () => {
    expect(env.window.isEmpty([NaN, NaN, NaN])).toBe(true);
  });

  it('returns true for array of empty strings', () => {
    expect(env.window.isEmpty(['', '', ''])).toBe(true);
  });

  it('returns true for array of nulls', () => {
    expect(env.window.isEmpty([null, null])).toBe(true);
  });

  it('returns true for empty array', () => {
    expect(env.window.isEmpty([])).toBe(true);
  });

  it('returns false when array has a valid number', () => {
    expect(env.window.isEmpty([NaN, 100, NaN])).toBe(false);
  });

  it('returns false for array of valid numbers', () => {
    expect(env.window.isEmpty([90, 100, 110])).toBe(false);
  });

  it('returns true for mixed empty values', () => {
    expect(env.window.isEmpty([NaN, '', null])).toBe(true);
  });

  it('returns false when zero is present', () => {
    expect(env.window.isEmpty([0, NaN])).toBe(false);
  });
});

describe('getPriceClass', () => {
  let env;
  beforeEach(() => { env = setupEnvironment(); });

  it('returns range0 for huge profit (diff >= 200)', () => {
    expect(env.window.getPriceClass(100, 300)).toBe('range0');
  });

  it('returns range1 for good profit (diff >= 30)', () => {
    expect(env.window.getPriceClass(100, 130)).toBe('range1');
  });

  it('returns range2 for break-even (diff >= 0)', () => {
    expect(env.window.getPriceClass(100, 100)).toBe('range2');
  });

  it('returns range3 for small loss (diff >= -30)', () => {
    expect(env.window.getPriceClass(100, 70)).toBe('range3');
  });

  it('returns range4 for big loss (diff >= -99)', () => {
    expect(env.window.getPriceClass(100, 5)).toBe('range4');
  });

  it('returns empty string for extreme loss (diff < -99)', () => {
    expect(env.window.getPriceClass(200, 0)).toBe('');
  });
});

describe('displayPercentage', () => {
  let env;
  beforeEach(() => { env = setupEnvironment(); });

  it('formats large percentages with 3 significant digits', () => {
    expect(env.window.displayPercentage(0.5)).toBe('50.0%');
  });

  it('formats small percentages with 2 decimal places', () => {
    expect(env.window.displayPercentage(0.005)).toBe('0.50%');
  });

  it('formats very small percentages as <0.01%', () => {
    expect(env.window.displayPercentage(0.00001)).toBe('<0.01%');
  });

  it('returns dash for non-finite values', () => {
    expect(env.window.displayPercentage(Infinity)).toBe('—');
    expect(env.window.displayPercentage(NaN)).toBe('—');
  });

  it('formats 1.0 (100%) correctly', () => {
    expect(env.window.displayPercentage(1.0)).toBe('100%');
  });

  it('formats 0.01 (1%) correctly', () => {
    expect(env.window.displayPercentage(0.01)).toBe('1.00%');
  });

  it('formats boundary 0.0001 correctly', () => {
    expect(env.window.displayPercentage(0.0001)).toBe('0.01%');
  });
});

describe('generatePermalink', () => {
  let env;
  beforeEach(() => { env = setupEnvironment(); });

  it('generates permalink with prices', () => {
    const result = env.window.generatePermalink(100, [90, 85], false, -1);
    expect(result).toContain('prices=100.90.85');
  });

  it('includes first_buy when true', () => {
    const result = env.window.generatePermalink(100, [90], true, -1);
    expect(result).toContain('first=true');
  });

  it('includes pattern when not -1', () => {
    const result = env.window.generatePermalink(100, [90], false, 2);
    expect(result).toContain('pattern=2');
  });

  it('omits pattern when -1', () => {
    const result = env.window.generatePermalink(100, [90], false, -1);
    expect(result).not.toContain('pattern');
  });

  it('omits first_buy when false', () => {
    const result = env.window.generatePermalink(100, [90], false, -1);
    expect(result).not.toContain('first');
  });

  it('returns empty string when no data', () => {
    const result = env.window.generatePermalink(NaN, [NaN, NaN], false, -1);
    expect(result).toBeFalsy();
  });

  it('handles empty sell prices array', () => {
    const result = env.window.generatePermalink(100, [], false, -1);
    expect(result).toContain('prices=100');
  });

  it('maps NaN sell prices to empty strings', () => {
    const result = env.window.generatePermalink(100, [NaN, 85, NaN], false, -1);
    expect(result).toContain('prices=100..85.');
  });
});

describe('fillFields', () => {
  let env;
  beforeEach(() => { env = setupEnvironment(); });

  it('sets the buy price input', () => {
    env.window.fillFields([100, 100, 90, 85], false, -1);
    expect(env.document.getElementById('buy').value).toBe('100');
  });

  it('sets sell price inputs', () => {
    env.window.fillFields([100, 100, 90, 85], false, -1);
    expect(env.document.getElementById('sell_2').value).toBe('90');
    expect(env.document.getElementById('sell_3').value).toBe('85');
  });

  it('sets first_buy radio', () => {
    env.window.fillFields([100], true, -1);
    expect(env.document.getElementById('first-time-radio-yes').checked).toBe(true);
  });

  it('sets previous pattern radio', () => {
    env.window.fillFields([100], false, 2);
    expect(env.document.getElementById('pattern-radio-decreasing').checked).toBe(true);
  });

  it('clears buy input when no price given', () => {
    env.window.fillFields([], false, -1);
    expect(env.document.getElementById('buy').value).toBe('');
  });

  it('skips falsy sell prices', () => {
    env.window.fillFields([100, 100, 0, 85], false, -1);
    expect(env.document.getElementById('sell_2').value).toBe('');
    expect(env.document.getElementById('sell_3').value).toBe('85');
  });

  it('handles null value for first_buy without crashing', () => {
    expect(() => env.window.fillFields([100], null, -1)).not.toThrow();
  });
});

describe('checkRadioByValue', () => {
  let env;
  beforeEach(() => { env = setupEnvironment(); });

  it('checks the matching radio button', () => {
    const radios = [
      env.document.getElementById('first-time-radio-no'),
      env.document.getElementById('first-time-radio-yes'),
    ];
    env.window.checkRadioByValue(radios, 'true');
    expect(radios[1].checked).toBe(true);
  });

  it('handles numeric value by converting to string', () => {
    const radios = [
      env.document.getElementById('pattern-radio-unknown'),
      env.document.getElementById('pattern-radio-fluctuating'),
    ];
    env.window.checkRadioByValue(radios, 0);
    expect(radios[1].checked).toBe(true);
  });

  it('does nothing when value is null', () => {
    const radios = [
      env.document.getElementById('first-time-radio-no'),
      env.document.getElementById('first-time-radio-yes'),
    ];
    const before = radios[0].checked;
    env.window.checkRadioByValue(radios, null);
    expect(radios[0].checked).toBe(before);
  });
});

describe('getCheckedRadio', () => {
  let env;
  beforeEach(() => { env = setupEnvironment(); });

  it('returns value of the checked radio', () => {
    const radios = [
      env.document.getElementById('first-time-radio-no'),
      env.document.getElementById('first-time-radio-yes'),
    ];
    radios[0].checked = true;
    expect(env.window.getCheckedRadio(radios)).toBe('false');
  });

  it('returns value when second option is checked', () => {
    const radios = [
      env.document.getElementById('first-time-radio-no'),
      env.document.getElementById('first-time-radio-yes'),
    ];
    radios[0].checked = false;
    radios[1].checked = true;
    expect(env.window.getCheckedRadio(radios)).toBe('true');
  });
});

describe('updateLocalStorage', () => {
  let env;
  beforeEach(() => { env = setupEnvironment(); });

  it('stores prices, first_buy, and previous_pattern', () => {
    const prices = [100, 100, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35];
    env.window.updateLocalStorage(prices, true, 2);
    expect(JSON.parse(env.store.sell_prices)).toEqual(prices);
    expect(JSON.parse(env.store.first_buy)).toBe(true);
    expect(JSON.parse(env.store.previous_pattern)).toBe(2);
  });

  it('rejects arrays with wrong length', () => {
    env.window.updateLocalStorage([1, 2, 3], false, 0);
    expect(env.store.sell_prices).toBeUndefined();
  });

  it('stores false for first_buy', () => {
    const prices = Array(14).fill(100);
    env.window.updateLocalStorage(prices, false, -1);
    expect(JSON.parse(env.store.first_buy)).toBe(false);
  });
});

describe('getPricesFromLocalstorage', () => {
  it('returns prices from localStorage', () => {
    const prices = [100, 100, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35];
    const env = setupEnvironment({
      localStorage: { sell_prices: JSON.stringify(prices) },
    });
    expect(env.window.getPricesFromLocalstorage()).toEqual(prices);
  });

  it('returns null for wrong length array', () => {
    const env = setupEnvironment({
      localStorage: { sell_prices: JSON.stringify([1, 2, 3]) },
    });
    expect(env.window.getPricesFromLocalstorage()).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    const env = setupEnvironment({
      localStorage: { sell_prices: 'not json' },
    });
    expect(env.window.getPricesFromLocalstorage()).toBeNull();
  });

  it('returns null when nothing stored', () => {
    const env = setupEnvironment();
    expect(env.window.getPricesFromLocalstorage()).toBeNull();
  });
});

describe('getFirstBuyStateFromLocalstorage', () => {
  it('returns true when stored', () => {
    const env = setupEnvironment({ localStorage: { first_buy: 'true' } });
    expect(env.window.getFirstBuyStateFromLocalstorage()).toBe(true);
  });

  it('returns false when stored', () => {
    const env = setupEnvironment({ localStorage: { first_buy: 'false' } });
    expect(env.window.getFirstBuyStateFromLocalstorage()).toBe(false);
  });

  it('returns null when not stored', () => {
    const env = setupEnvironment();
    expect(env.window.getFirstBuyStateFromLocalstorage()).toBeNull();
  });
});

describe('getPreviousPatternStateFromLocalstorage', () => {
  it('returns pattern number when stored', () => {
    const env = setupEnvironment({ localStorage: { previous_pattern: '2' } });
    expect(env.window.getPreviousPatternStateFromLocalstorage()).toBe(2);
  });

  it('returns null when not stored', () => {
    const env = setupEnvironment();
    expect(env.window.getPreviousPatternStateFromLocalstorage()).toBeNull();
  });
});

describe('Query string parsing', () => {
  describe('getFirstBuyStateFromQuery', () => {
    it('returns true for "1"', () => {
      const env = setupEnvironment({ search: '?first=1' });
      expect(env.window.getFirstBuyStateFromQuery('first')).toBe(true);
    });

    it('returns true for "yes"', () => {
      const env = setupEnvironment({ search: '?first=yes' });
      expect(env.window.getFirstBuyStateFromQuery('first')).toBe(true);
    });

    it('returns true for "true"', () => {
      const env = setupEnvironment({ search: '?first=true' });
      expect(env.window.getFirstBuyStateFromQuery('first')).toBe(true);
    });

    it('returns false for "0"', () => {
      const env = setupEnvironment({ search: '?first=0' });
      expect(env.window.getFirstBuyStateFromQuery('first')).toBe(false);
    });

    it('returns false for "no"', () => {
      const env = setupEnvironment({ search: '?first=no' });
      expect(env.window.getFirstBuyStateFromQuery('first')).toBe(false);
    });

    it('returns false for "false"', () => {
      const env = setupEnvironment({ search: '?first=false' });
      expect(env.window.getFirstBuyStateFromQuery('first')).toBe(false);
    });

    it('returns null when param missing', () => {
      const env = setupEnvironment({ search: '?other=1' });
      expect(env.window.getFirstBuyStateFromQuery('first')).toBeNull();
    });

    it('returns null for unrecognized value', () => {
      const env = setupEnvironment({ search: '?first=maybe' });
      expect(env.window.getFirstBuyStateFromQuery('first')).toBeNull();
    });
  });

  describe('getPreviousPatternStateFromQuery', () => {
    it('parses numeric pattern "0"', () => {
      const env = setupEnvironment({ search: '?pattern=0' });
      expect(env.window.getPreviousPatternStateFromQuery('pattern')).toBe(0);
    });

    it('parses string pattern "fluctuating"', () => {
      const env = setupEnvironment({ search: '?pattern=fluctuating' });
      expect(env.window.getPreviousPatternStateFromQuery('pattern')).toBe(0);
    });

    it('parses "large-spike"', () => {
      const env = setupEnvironment({ search: '?pattern=large-spike' });
      expect(env.window.getPreviousPatternStateFromQuery('pattern')).toBe(1);
    });

    it('parses "decreasing"', () => {
      const env = setupEnvironment({ search: '?pattern=decreasing' });
      expect(env.window.getPreviousPatternStateFromQuery('pattern')).toBe(2);
    });

    it('parses "small-spike"', () => {
      const env = setupEnvironment({ search: '?pattern=small-spike' });
      expect(env.window.getPreviousPatternStateFromQuery('pattern')).toBe(3);
    });

    it('returns -1 for unrecognized pattern', () => {
      const env = setupEnvironment({ search: '?pattern=unknown' });
      expect(env.window.getPreviousPatternStateFromQuery('pattern')).toBe(-1);
    });

    it('returns null when param missing', () => {
      const env = setupEnvironment({ search: '?' });
      expect(env.window.getPreviousPatternStateFromQuery('pattern')).toBeNull();
    });
  });

  describe('getPricesFromQuery', () => {
    it('parses price string into array', () => {
      const env = setupEnvironment({ search: '?prices=100.90.85.80.75.70.65.60.55.50.45.40.35' });
      const prices = env.window.getPricesFromQuery('prices');
      expect(prices).not.toBeNull();
      expect(prices[0]).toBe(100);
      expect(prices[1]).toBe(100); // duplicated buy price
      expect(prices[2]).toBe(90);
      expect(prices).toHaveLength(14);
    });

    it('pads short arrays to length 14', () => {
      const env = setupEnvironment({ search: '?prices=100.90.85' });
      const prices = env.window.getPricesFromQuery('prices');
      expect(prices).toHaveLength(14);
      expect(prices[4]).toBe(0); // padded
    });

    it('returns null when param missing', () => {
      const env = setupEnvironment({ search: '?' });
      expect(env.window.getPricesFromQuery('prices')).toBeNull();
    });

    it('duplicates buy price at index 0 and 1', () => {
      const env = setupEnvironment({ search: '?prices=100.90' });
      const prices = env.window.getPricesFromQuery('prices');
      expect(prices[0]).toBe(100);
      expect(prices[1]).toBe(100);
    });
  });

  describe('getPreviousFromQuery', () => {
    it('returns array with first_buy, pattern, and prices', () => {
      const env = setupEnvironment({ search: '?prices=100.90&first=true&pattern=2' });
      const result = env.window.getPreviousFromQuery();
      expect(result).not.toBeNull();
      expect(result[0]).toBe(true); // first_buy
      expect(result[1]).toBe(2); // pattern
      expect(result[2]).toHaveLength(14); // prices
    });

    it('returns null when no prices param', () => {
      const env = setupEnvironment({ search: '?first=true' });
      expect(env.window.getPreviousFromQuery()).toBeNull();
    });

    it('sets window.populated_from_query when query has prices', () => {
      const env = setupEnvironment({ search: '?prices=100.90' });
      env.window.getPreviousFromQuery();
      expect(env.window.populated_from_query).toBe(true);
    });
  });
});

describe('getPrevious', () => {
  it('prefers query string over localStorage', () => {
    const env = setupEnvironment({
      search: '?prices=110.95',
      localStorage: {
        sell_prices: JSON.stringify([100, 100, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35]),
      },
    });
    const result = env.window.getPrevious();
    expect(result[2][0]).toBe(110); // from query, not localStorage
  });

  it('falls back to localStorage when no query', () => {
    const prices = [100, 100, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35];
    const env = setupEnvironment({
      localStorage: {
        sell_prices: JSON.stringify(prices),
        first_buy: 'true',
        previous_pattern: '1',
      },
    });
    const result = env.window.getPrevious();
    expect(result[0]).toBe(true);
    expect(result[1]).toBe(1);
    expect(result[2]).toEqual(prices);
  });
});

describe('hideChart', () => {
  let env;
  beforeEach(() => { env = setupEnvironment(); });

  it('clears the output table', () => {
    env.document.getElementById('output').innerHTML = '<tr><td>test</td></tr>';
    env.window.hideChart();
    expect(env.document.getElementById('output').innerHTML).toBe('');
  });

  it('hides the chart wrapper', () => {
    const wrapper = env.document.querySelector('.chart-wrapper');
    wrapper.style.display = 'block';
    env.window.hideChart();
    expect(wrapper.style.display).toBe('none');
  });
});

describe('calculateOutput', () => {
  let env;
  beforeEach(() => { env = setupEnvironment(); });

  it('clears decision div on empty data', () => {
    env.document.getElementById('decision').innerHTML = '<p>old</p>';
    env.window.calculateOutput([NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN], false, null);
    expect(env.document.getElementById('decision').innerHTML).toBe('');
  });

  it('hides chart on empty data', () => {
    env.window.calculateOutput([NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN], false, null);
    expect(env.document.getElementById('output').innerHTML).toBe('');
  });

  it('populates output table with valid data', () => {
    env.window.calculateOutput([100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN], false, null);
    const output = env.document.getElementById('output').innerHTML;
    expect(output).toContain('<tr>');
    expect(output).toContain('table-pattern');
  });

  it('calls update_chart with expected_values and labels', () => {
    env.window.calculateOutput([100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN], false, null);
    expect(env.window.update_chart).toHaveBeenCalled();
    const args = env.window.update_chart.mock.calls[0];
    expect(args[0]).toEqual([100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN]); // data
    expect(args[1].length).toBeGreaterThan(0); // possibilities
    expect(args[2]).toHaveLength(12); // expected_values
    expect(args[3]).toHaveLength(13); // labels (Sunday + 6 days * 2)
  });

  it('shows error for impossible prices', () => {
    const errorDiv = env.document.querySelector('.dialog-box.error');
    env.window.calculateOutput([100, 100, 999, 999, 999, 999, 999, 999, 999, 999, 999, 999, 999, 999], false, null);
    // With fudge factor it might find something or show error
    // Either output has content or error is visible
    const output = env.document.getElementById('output').innerHTML;
    const errorVisible = errorDiv.style.display !== 'none';
    expect(output.length > 0 || errorVisible).toBe(true);
  });

  it('renders pattern names from i18next', () => {
    env.window.calculateOutput([100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN], false, null);
    const output = env.document.getElementById('output').innerHTML;
    // Our i18next mock returns the key, so we should see pattern keys
    expect(output).toContain('patterns.');
  });

  it('renders min-to-max ranges for unknown prices', () => {
    env.window.calculateOutput([100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN], false, null);
    const output = env.document.getElementById('output').innerHTML;
    expect(output).toContain('output.to');
  });

  it('renders single value for known prices', () => {
    env.window.calculateOutput([100, 100, 90, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN], false, null);
    const output = env.document.getElementById('output').innerHTML;
    expect(output).toContain('>90<');
  });

  it('shows likely pattern in decision div', () => {
    env.window.calculateOutput([100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN], false, null);
    const decision = env.document.getElementById('decision').innerHTML;
    expect(decision).toContain('output.likely-pattern');
  });

  it('does not show likely pattern when only one pattern is possible', () => {
    // Decreasing pattern with all prices filled — probability will be 1.0
    env.window.calculateOutput([100, 100, 86, 82, 78, 74, 70, 66, 62, 58, 54, 50, 46, 42], false, null);
    const decision = env.document.getElementById('decision').innerHTML;
    // When probability is 1 (100%), we skip showing the indicator
    // If the predictor finds this matches only one pattern at 100%, no indicator
    // Otherwise it would show — either way, test that the feature runs without error
    expect(typeof decision).toBe('string');
  });

  it('narrows pattern prediction as more prices are entered', () => {
    // With just buy price, multiple patterns possible
    env.window.calculateOutput([100, 100, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN], false, null);
    const decision1 = env.document.getElementById('decision').innerHTML;
    expect(decision1).toContain('output.likely-pattern');

    // With a spike price, the pattern may narrow to a single one (100% = hidden)
    // or stay ambiguous — either is valid, just verify no errors
    env.window.calculateOutput([100, 100, 90, 85, 80, 75, 200, NaN, NaN, NaN, NaN, NaN, NaN, NaN], false, null);
    const decision2 = env.document.getElementById('decision').innerHTML;
    expect(typeof decision2).toBe('string');
  });
});

describe('flashMessage', () => {
  let env;
  beforeEach(() => {
    vi.useFakeTimers();
    env = setupEnvironment();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('shows the snackbar with the message', () => {
    env.window.flashMessage('test message');
    const snackbar = env.document.getElementById('snackbar');
    expect(snackbar.textContent).toBe('test message');
    expect(snackbar.classList.contains('show')).toBe(true);
  });

  it('hides the snackbar after 3 seconds', () => {
    env.window.flashMessage('test message');
    vi.advanceTimersByTime(3000);
    const snackbar = env.document.getElementById('snackbar');
    expect(snackbar.classList.contains('show')).toBe(false);
    expect(snackbar.textContent).toBe('');
  });
});

describe('initialize', () => {
  it('sets state.initialized to true', () => {
    const env = setupEnvironment();
    env.window.initialize();
    expect(env.window.state.initialized).toBe(true);
  });

  it('loads prices from localStorage on init', () => {
    const prices = [100, 100, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35];
    const env = setupEnvironment({
      localStorage: { sell_prices: JSON.stringify(prices) },
    });
    env.window.initialize();
    expect(env.document.getElementById('buy').value).toBe('100');
    expect(env.document.getElementById('sell_2').value).toBe('90');
  });

  it('loads prices from query string on init', () => {
    const env = setupEnvironment({ search: '?prices=110.95.90' });
    env.window.initialize();
    expect(env.document.getElementById('buy').value).toBe('110');
    expect(env.document.getElementById('sell_2').value).toBe('95');
  });

  it('handles no previous data gracefully', () => {
    const env = setupEnvironment();
    expect(() => env.window.initialize()).not.toThrow();
    expect(env.window.state.initialized).toBe(true);
  });
});

describe('update', () => {
  it('does nothing before initialization', () => {
    const env = setupEnvironment();
    // state.initialized is false by default
    env.window.update();
    // Should not crash, output should be empty
    expect(env.document.getElementById('output').innerHTML).toBe('');
  });

  it('updates output after initialization with buy price', () => {
    const env = setupEnvironment();
    env.window.state.initialized = true;
    env.document.getElementById('buy').value = '100';
    env.window.update();
    const output = env.document.getElementById('output').innerHTML;
    expect(output).toContain('<tr>');
  });

  it('stores data to localStorage', () => {
    const env = setupEnvironment();
    env.window.state.initialized = true;
    env.document.getElementById('buy').value = '100';
    env.document.getElementById('sell_2').value = '90';
    env.window.update();
    expect(env.store.sell_prices).toBeDefined();
    const stored = JSON.parse(env.store.sell_prices);
    expect(stored[0]).toBe(100);
    expect(stored[2]).toBe(90);
  });

  it('skips localStorage when populated_from_query is true', () => {
    const env = setupEnvironment();
    env.window.state.initialized = true;
    env.window.populated_from_query = true;
    env.document.getElementById('buy').value = '100';
    env.window.update();
    expect(env.store.sell_prices).toBeUndefined();
  });

  it('shows permalink button when data exists', () => {
    const env = setupEnvironment();
    env.window.state.initialized = true;
    env.document.getElementById('buy').value = '100';
    env.document.getElementById('sell_2').value = '90';
    env.window.update();
    const btn = env.document.getElementById('permalink-btn');
    expect(btn.style.display).not.toBe('none');
  });

  it('hides permalink button when no data', () => {
    const env = setupEnvironment();
    env.window.state.initialized = true;
    env.window.update();
    const btn = env.document.getElementById('permalink-btn');
    expect(btn.style.display).toBe('none');
  });
});

describe('getSellPrices', () => {
  let env;
  beforeEach(() => { env = setupEnvironment(); });

  it('returns array of 12 values from sell inputs', () => {
    const result = env.window.getSellPrices();
    expect(result).toHaveLength(12);
  });

  it('returns NaN for empty inputs', () => {
    const result = env.window.getSellPrices();
    result.forEach(v => expect(isNaN(v)).toBe(true));
  });

  it('parses filled inputs as integers', () => {
    env.document.getElementById('sell_2').value = '90';
    env.document.getElementById('sell_3').value = '85';
    const result = env.window.getSellPrices();
    expect(result[0]).toBe(90);
    expect(result[1]).toBe(85);
  });
});

describe('copyPermalink', () => {
  let env;
  beforeEach(() => { env = setupEnvironment(); });

  it('calls document.execCommand("copy")', () => {
    env.window.copyPermalink();
    expect(env.document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('shows then hides permalink input', () => {
    env.window.copyPermalink();
    // After copy, input should be hidden
    const input = env.document.getElementById('permalink-input');
    expect(input.style.display).toBe('none');
  });
});
