import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf-8');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));

describe('CDN scripts', () => {
  // Tests load i18next from node_modules; the page loads it from cdnjs. Keep them on one version.
  it('loads the same i18next version in the page as the tests use', () => {
    const cdn = indexHtml.match(/cdnjs\.cloudflare\.com\/ajax\/libs\/i18next\/([^/]+)\/i18next\.min\.js/);
    expect(cdn).not.toBeNull();
    expect(cdn[1]).toBe(pkg.devDependencies.i18next);
  });
});
