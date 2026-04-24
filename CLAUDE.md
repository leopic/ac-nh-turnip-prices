# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Turnip Prophet is a static single-page app that predicts Animal Crossing: New Horizons turnip price patterns. It implements Ninji's reverse-engineered pricing algorithm in vanilla JavaScript with no build step. Users enter a buy price and up to 12 half-day sell prices; the app outputs probability-weighted predictions and buy/sell advice.

## Commands

```bash
npm test              # run full Vitest suite (jsdom environment)
npm run test:watch    # watch mode
npm run test:coverage # coverage report
npm start             # serve locally via `npx serve`
npm run deploy        # rsync to DreamHost (requires SSH access)
```

Run a single test file:
```bash
npx vitest run js/predictions.test.js
```

Commitlint enforces conventional commits and runs on CI. A pre-push hook runs the test suite — never bypass it.

## Architecture

**No bundler.** All JS is loaded directly via `<script>` tags in `index.html`. CommonJS-style modules are used only in test files (Vitest handles this via jsdom).

### Key files

| File | Role |
|---|---|
| `js/predictions.js` | Core algorithm: pattern detection, Markov-style price transitions, probability matrix, expected value calculations |
| `js/scripts.js` | DOM wiring: form state, URL ↔ input sync, table rendering, decision output |
| `js/chart.js` | Chart.js wrapper for price range visualization |
| `js/translations.js` | i18next setup (23+ locales, loaded at runtime from `locales/`) |
| `js/themes.js` | Light/dark/high-contrast theme switching |
| `js/menu.js` | Settings drawer (theme, language) |
| `service-worker.js` | PWA precache — version string must be bumped when assets change |

### Data flow

1. User fills form → `scripts.js` reads DOM values and encodes them into the URL hash
2. URL change triggers `calculate()` → calls `predictions.js` functions
3. `predictions.js` returns probability-weighted min/max/avg price arrays per pattern
4. `scripts.js` renders the results table and buy/sell decision; `chart.js` draws the graph

### Testing

Tests live alongside their source files (`predictions.test.js`, `scripts.test.js`, `a11y.test.js`). The test suite is extensive (300+ tests) and covers the algorithm, DOM behavior, and accessibility. When changing prediction logic, run the full suite — many edge cases are encoded there.

`HOW-IT-WORKS.md` documents the game's pricing mechanics; read it before modifying `predictions.js`.

## CI/CD

GitHub Actions runs on PRs and pushes to `main`:
- `ci.yml` — `npm test` on Node 18 (pinned via `.nvmrc`)
- `commitlint.yml` — conventional commit format check
- `deploy.yml` — production rsync deploy to DreamHost
- `release.yml` — auto-incrementing releases after successful deploys
