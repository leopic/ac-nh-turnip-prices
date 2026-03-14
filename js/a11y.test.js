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
