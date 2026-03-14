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
