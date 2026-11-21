import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8');
const stylesCSS = fs.readFileSync(path.join(__dirname, '..', 'css', 'styles.css'), 'utf-8');

function getDOM() {
  const dom = new JSDOM(indexHtml, { url: 'http://localhost' });
  return dom.window.document;
}

describe('Accessibility: Profit calculator', () => {
  it('associates the native selling-price dropdown with its label and instructions', () => {
    const doc = getDOM();
    const select = doc.getElementById('profit-sell-price');
    expect(select.tagName).toBe('SELECT');
    expect(select.labels).toHaveLength(1);
    expect(doc.getElementById(select.getAttribute('aria-describedby'))).not.toBeNull();
  });

  it('labels the optional input and associates its help and validation message', () => {
    const doc = getDOM();
    const input = doc.getElementById('turnip-quantity');
    expect(doc.querySelector('label[for="turnip-quantity"]')).not.toBeNull();
    expect(input.required).toBe(false);
    expect(input.getAttribute('inputmode')).toBe('numeric');
    for (const id of input.getAttribute('aria-describedby').split(' ')) {
      expect(doc.getElementById(id)).not.toBeNull();
    }
  });

  it('has a named section and polite results that do not move focus', () => {
    const doc = getDOM();
    const section = doc.querySelector('.profit-calculator');
    expect(doc.getElementById(section.getAttribute('aria-labelledby'))).not.toBeNull();
    const results = doc.getElementById('profit-results');
    expect(results.getAttribute('role')).toBe('status');
    expect(results.getAttribute('aria-live')).toBe('polite');
    expect(results.getAttribute('aria-atomic')).toBe('true');
    expect(results.hasAttribute('tabindex')).toBe(false);
  });
});

// Reads custom properties from one top-level block of styles.css, e.g. ':root {'.
// The header must start the block, so '[data-theme="x"] {' does not match the
// end of a shared '[data-theme="y"],\n[data-theme="x"] {' selector list.
function cssBlockVars(header) {
  let start = -1;
  for (let i = stylesCSS.indexOf(header); i !== -1; i = stylesCSS.indexOf(header, i + 1)) {
    if (!stylesCSS.slice(0, i).trimEnd().endsWith(',')) { start = i; break; }
  }
  if (start === -1) throw new Error(`missing CSS block: ${header}`);
  const body = stylesCSS.slice(start + header.length, stylesCSS.indexOf('\n}', start));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
}

function toRGB(value) {
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map(c => c + c).join('') : hex[1];
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  }
  const hsl = value.match(/^hsl\(\s*([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\s*\)$/);
  if (hsl) {
    const [h, s, l] = [hsl[1] / 360, hsl[2] / 100, hsl[3] / 100];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = t => {
      t = (t + 1) % 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
  }
  throw new Error(`unsupported colour: ${value}`);
}

function contrast(a, b) {
  const luminance = rgb => {
    const [r, g, bl] = rgb.map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(toRGB(a)), luminance(toRGB(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('Accessibility: Profit calculator colours', () => {
  const root = cssBlockVars(':root {');
  const dark = cssBlockVars('[data-theme="dark"],\n[data-theme="dark-high-color-contrast"] {');
  const themes = {
    light: { vars: root, min: 4.5 },
    'light-high-color-contrast': { vars: { ...root, ...cssBlockVars('[data-theme="light-high-color-contrast"] {') }, min: 7 },
    dark: { vars: { ...root, ...dark }, min: 4.5 },
    'dark-high-color-contrast': { vars: { ...root, ...dark, ...cssBlockVars('[data-theme="dark-high-color-contrast"] {') }, min: 7 },
  };

  for (const [theme, { vars, min }] of Object.entries(themes)) {
    it(`keeps net gain and loss text readable on the page background in the ${theme} theme`, () => {
      for (const token of ['--profit-gain-text', '--profit-loss-text']) {
        expect(contrast(vars[token], vars['--center-bg-color'])).toBeGreaterThanOrEqual(min);
      }
    });
  }

  it('uses the body text colour for the selling-price dropdown, not the low-contrast accent blue', () => {
    // The select's own rule, not the one it shares with #turnip-quantity.
    const rule = stylesCSS.match(/\n\n#profit-sell-price \{([^}]*)\}/)[1];
    expect(rule).toMatch(/\bcolor:\s*inherit;/);
  });
});

describe('Accessibility: Skip navigation', () => {
  it('has a skip-to-content link as the first focusable element in body', () => {
    const doc = getDOM();
    const skipLink = doc.querySelector('body > a.skip-link');
    expect(skipLink).not.toBeNull();
    expect(skipLink.getAttribute('href')).toBe('#main-content');
  });

  it('skip link target exists', () => {
    const doc = getDOM();
    const target = doc.getElementById('main-content');
    expect(target).not.toBeNull();
  });
});

describe('Accessibility: Landmark elements', () => {
  it('has a <main> element', () => {
    const doc = getDOM();
    expect(doc.querySelector('main')).not.toBeNull();
  });

  it('has a <header> element', () => {
    const doc = getDOM();
    expect(doc.querySelector('header')).not.toBeNull();
  });

  it('nav element has an aria-label', () => {
    const doc = getDOM();
    const nav = doc.querySelector('nav');
    expect(nav).not.toBeNull();
    expect(nav.getAttribute('aria-label')).toBeTruthy();
  });
});

describe('Accessibility: Focus indicators', () => {
  it('does not use outline:none without a replacement focus style', () => {
    // Check that every "outline: none" in CSS has a sibling visual indicator
    // (box-shadow, border, or outline with offset)
    const outlineNonePattern = /outline:\s*none/g;
    const matches = [...stylesCSS.matchAll(outlineNonePattern)];
    // After fix, there should be no bare outline:none remaining
    expect(matches.length).toBe(0);
  });
});

describe('Accessibility: Menu drawer keyboard support', () => {
  it('hamburger trigger is a button with aria-expanded', () => {
    const doc = getDOM();
    const trigger = doc.getElementById('menu-trigger');
    expect(trigger).not.toBeNull();
    expect(trigger.tagName.toLowerCase()).toBe('button');
    expect(trigger.hasAttribute('aria-expanded')).toBe(true);
  });

  it('menu drawer has aria-hidden attribute', () => {
    const doc = getDOM();
    const drawer = doc.querySelector('.menu-drawer');
    expect(drawer.hasAttribute('aria-hidden')).toBe(true);
  });

  it('no hidden checkbox hack for menu toggle', () => {
    const doc = getDOM();
    const checkbox = doc.getElementById('menu-toggle');
    expect(checkbox).toBeNull();
  });
});

describe('Accessibility: html lang attribute', () => {
  it('html element has a lang attribute', () => {
    const doc = getDOM();
    expect(doc.documentElement.getAttribute('lang')).toBeTruthy();
  });
});

describe('Accessibility: Decorative SVGs', () => {
  it('all wave SVGs have aria-hidden="true"', () => {
    const doc = getDOM();
    const waves = doc.querySelectorAll('svg.waves');
    expect(waves.length).toBeGreaterThan(0);
    waves.forEach(svg => {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    });
  });
});

describe('Accessibility: Permalink button', () => {
  it('permalink trigger is a button element', () => {
    const doc = getDOM();
    const btn = doc.getElementById('permalink-btn');
    expect(btn.tagName.toLowerCase()).toBe('button');
  });
});

describe('Accessibility: Select labels in drawer', () => {
  it('language select has an accessible label', () => {
    const doc = getDOM();
    const sel = doc.getElementById('language');
    const hasLabel = doc.querySelector('label[for="language"]') !== null;
    const hasAriaLabel = sel.hasAttribute('aria-labelledby') || sel.hasAttribute('aria-label');
    expect(hasLabel || hasAriaLabel).toBe(true);
  });

  it('theme select has an accessible label', () => {
    const doc = getDOM();
    const sel = doc.getElementById('theme');
    const hasLabel = doc.querySelector('label[for="theme"]') !== null;
    const hasAriaLabel = sel.hasAttribute('aria-labelledby') || sel.hasAttribute('aria-label');
    expect(hasLabel || hasAriaLabel).toBe(true);
  });
});

describe('Accessibility: Radio group semantics', () => {
  it('first-time radio group is wrapped in fieldset with legend', () => {
    const doc = getDOM();
    const fieldset = doc.querySelector('fieldset:has(#first-time-radio-no)');
    expect(fieldset).not.toBeNull();
    expect(fieldset.querySelector('legend')).not.toBeNull();
  });

  it('pattern radio group is wrapped in fieldset with legend', () => {
    const doc = getDOM();
    const fieldset = doc.querySelector('fieldset:has(#pattern-radio-unknown)');
    expect(fieldset).not.toBeNull();
    expect(fieldset.querySelector('legend')).not.toBeNull();
  });
});

describe('Accessibility: Label associations', () => {
  it('no label elements have empty for attributes', () => {
    const doc = getDOM();
    const labels = doc.querySelectorAll('label[for=""]');
    expect(labels.length).toBe(0);
  });

  it('descriptive text for radio groups uses p or span, not label', () => {
    const doc = getDOM();
    // The first-time and patterns description should not be <label> without valid for
    const firstTimeDesc = doc.querySelector('[data-i18n="[html]first-time.description"]');
    const patternsDesc = doc.querySelector('[data-i18n="[html]patterns.description"]');
    if (firstTimeDesc) expect(firstTimeDesc.tagName.toLowerCase()).not.toBe('label');
    if (patternsDesc) expect(patternsDesc.tagName.toLowerCase()).not.toBe('label');
  });
});

describe('Accessibility: Radio button hiding', () => {
  it('radio buttons are not hidden with display:none or position:fixed', () => {
    // CSS should use clip-based hiding, not display:none or position:fixed
    const radioRule = stylesCSS.match(/\.input__radio-buttons input\[type=radio\]\s*\{[^}]+\}/);
    expect(radioRule).not.toBeNull();
    const rule = radioRule[0];
    expect(rule).not.toMatch(/display:\s*none/);
    expect(rule).not.toMatch(/position:\s*fixed/);
    expect(rule).toMatch(/clip/);
  });
});

describe('Accessibility: Live regions', () => {
  it('has an aria-live region for result announcements', () => {
    const doc = getDOM();
    const liveRegion = doc.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
  });

  it('error dialog has role="alert"', () => {
    const doc = getDOM();
    const error = doc.querySelector('.dialog-box.error');
    expect(error.getAttribute('role')).toBe('alert');
  });

  it('snackbar has role="status"', () => {
    const doc = getDOM();
    const snackbar = doc.getElementById('snackbar');
    expect(snackbar.getAttribute('role')).toBe('status');
    expect(snackbar.getAttribute('aria-live')).toBe('polite');
  });
});

describe('Accessibility: Chart alternative', () => {
  it('canvas has role="img"', () => {
    const doc = getDOM();
    const canvas = doc.getElementById('chart');
    expect(canvas.getAttribute('role')).toBe('img');
  });

  it('canvas has an aria-label', () => {
    const doc = getDOM();
    const canvas = doc.getElementById('chart');
    expect(canvas.getAttribute('aria-label')).toBeTruthy();
  });
});
