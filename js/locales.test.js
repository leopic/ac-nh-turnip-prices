import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const localesDir = path.join(root, 'locales');
const read = file => fs.readFileSync(path.join(root, file), 'utf-8');

// Flattens nested translation objects to { 'output.chart.input': '...' }.
function flatten(obj, prefix = '') {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    const name = prefix + key;
    if (value && typeof value === 'object') Object.assign(acc, flatten(value, name + '.'));
    else acc[name] = value;
    return acc;
  }, {});
}

const placeholders = text => (text.match(/{{\s*[^}]+?\s*}}/g) || []).map(p => p.replace(/\s/g, '')).sort();
const tags = text => (text.match(/<[^>]+>/g) || []).sort();

// Strings that are correct when they stay the same as the English text.
// Add a key here only with a reason; anything else must be translated.
// Strings that are only placeholders and punctuation are skipped automatically.
const SAME_AS_ENGLISH = {
  'ca': [
    'first-time.no',     // same word
    'times.morning',     // file uses AM/PM
    'times.afternoon',   // file uses AM/PM
  ],
  'cs': [
    'general.daisy-mae', // no Czech localisation of the game
    'profit.bells',      // no Czech localisation; players say Bells
  ],
  'es': [
    'first-time.no',     // same word
    'times.morning',     // file uses AM/PM
    'times.afternoon',   // file uses AM/PM
  ],
  'fr': [
    'times.morning',     // file uses AM/PM
    'times.afternoon',   // file uses AM/PM
  ],
  'hu': [
    'general.daisy-mae', // no Hungarian localisation of the game
  ],
  'id': [
    'general.daisy-mae', // no Indonesian localisation of the game
    'prices.reset',      // 'Reset' is the loanword the file uses
    'times.morning',     // file uses AM/PM
    'times.afternoon',   // file uses AM/PM
  ],
  'it': [
    'first-time.no',     // same word
  ],
  'nl': [
    'general.daisy-mae', // official Dutch name
  ],
  'ph': [
    'general.daisy-mae', // no Filipino localisation of the game
    'patterns.pattern',  // file uses 'pattern' as the Filipino term
    'profit.bells',      // no Filipino localisation; players say Bells
    'times.morning',     // AM/PM is standard
    'times.afternoon',   // AM/PM is standard
  ],
  'pl': [
    'general.daisy-mae', // no Polish localisation of the game
    'profit.bells',      // no Polish localisation; undeclined Bells
  ],
  'pt-BR': [
    'general.daisy-mae', // no Portuguese localisation of the game
    'profit.bells',      // no Portuguese localisation; players say Bells
    'times.morning',     // file uses AM/PM
    'times.afternoon',   // file uses AM/PM
  ],
  'th': [
    'general.daisy-mae', // file keeps character names in Latin script
  ],
};

const en = flatten(JSON.parse(read('locales/en.json')));

// i18next plural variants (`profit.bells_few`) stand for their en.json key (`profit.bells`).
const PLURAL = /_(zero|one|two|few|many|other)$/;
const baseKey = key => (PLURAL.test(key) && key.replace(PLURAL, '') in en ? key.replace(PLURAL, '') : key);
const codes = fs.readdirSync(localesDir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
const others = codes.filter(code => code !== 'en');

describe('Locales', () => {
  it('has a locale file for every language in the menu, and no others', () => {
    const block = read('js/translations.js').match(/const LANGUAGES = \{([\s\S]*?)\};/)[1];
    const menu = [...block.matchAll(/'([\w-]+)':/g)].map(m => m[1]).sort();
    expect(codes).toEqual(menu);
  });

  it('precaches exactly the locale files in the service worker', () => {
    const precached = [...read('service-worker.js').matchAll(/locales\/([\w-]+)\.json/g)].map(m => m[1]);
    expect([...new Set(precached)].sort()).toEqual(codes);
  });

  for (const code of others) {
    describe(code, () => {
      const locale = flatten(JSON.parse(read(`locales/${code}.json`)));

      it('has every key from en.json and no extra keys', () => {
        expect([...new Set(Object.keys(locale).map(baseKey))].sort()).toEqual(Object.keys(en).sort());
      });

      it('has an _other form for every plural key', () => {
        const plural = Object.keys(locale).filter(key => baseKey(key) !== key).map(baseKey);
        for (const key of new Set(plural)) expect(locale, `${code} ${key}_other`).toHaveProperty([`${key}_other`]);
      });

      it('keeps the placeholders and HTML tags of en.json', () => {
        for (const key of Object.keys(locale).filter(k => baseKey(k) in en)) {
          const source = en[baseKey(key)];
          expect(placeholders(locale[key]), `${code} ${key} placeholders`).toEqual(placeholders(source));
          expect(tags(locale[key]), `${code} ${key} tags`).toEqual(tags(source));
        }
      });

      it('has no empty strings', () => {
        const empty = Object.keys(locale).filter(key => typeof locale[key] !== 'string' || !locale[key].trim());
        expect(empty).toEqual([]);
      });

      it('lists only keys in SAME_AS_ENGLISH that are still the English text', () => {
        const stale = (SAME_AS_ENGLISH[code] || []).filter(key => locale[key] !== en[key]);
        expect(stale).toEqual([]);
      });

      it('has no strings left in English', () => {
        const untranslated = Object.keys(en).filter(key =>
          locale[key] === en[key] && /\p{L}/u.test(en[key].replace(/{{[^}]*}}/g, '')) && !(SAME_AS_ENGLISH[code] || []).includes(key));
        expect(untranslated).toEqual([]);
      });
    });
  }
});
