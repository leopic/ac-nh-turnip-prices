# Turnip Prophet

A turnip price predictor for Animal Crossing: New Horizons.

This is a fork of [mikebryant/ac-nh-turnip-prices](https://github.com/mikebryant/ac-nh-turnip-prices) — huge thanks to Mike Bryant and all the [original contributors](https://github.com/mikebryant/ac-nh-turnip-prices/graphs/contributors) for building the foundation of this project. The prediction logic is based on [Ninji's reverse engineering](https://twitter.com/_Ninji/status/1244818665851289602) of the game's turnip pricing algorithm.

## What's changed in this fork

- **Expected value calculations** — shows the probability-weighted expected price for each time slot, so you can see what a "typical" outcome looks like rather than just the min/max range
- **Sell/buy decision advice** — compares your current price against the expected future maximum and tells you whether to sell now or wait
- **Pattern likelihood indicator** — as you enter prices throughout the week, shows which pattern you're most likely on and how confident the prediction is
- **Dismissable welcome message** — the intro dialog can be closed and won't reappear until you reset
- **Hamburger menu** — language, theme, and credits moved to a slide-out drawer to reduce clutter
- **High color contrast mode** — toggle for colorblind-friendly table colors, works with light and dark themes
- **Auto-updating URL** — the browser URL updates as you enter prices, making sharing easier
- **Sticky table header** — column headers stay visible when scrolling through pattern results
- **Accessibility overhaul:**
  - Skip-to-content link for keyboard navigation
  - Proper landmark elements (`<main>`, `<header>`, labeled `<nav>`)
  - Visible focus indicators on all interactive elements
  - Keyboard-accessible menu drawer with focus trapping and Escape key support
  - Screen reader announcements for dynamic results, errors, and notifications (`aria-live`, `role="alert"`)
  - Accessible chart canvas (`role="img"` with `aria-label`)
  - Radio groups wrapped in `<fieldset>`/`<legend>` for screen reader context
  - Properly associated labels on all form controls
  - Decorative SVGs hidden from screen readers
  - Keyboard-focusable permalink button
- **Bug fix: Pattern 3 middle peak** — the minimum prediction for Small Spike's middle peak slot was off by 1 bell vs the game code
- **Bug fix: PDF.decay() division by zero** — equal min/max decay rates no longer produce NaN
- **German translation fix** — corrected "large spike" and "small spike" pattern names
- **Updated dependencies** — jQuery 3.7.1, Chart.js 4.5.0, i18next 25, replaced deprecated i18next-xhr-backend with i18next-http-backend
- **Removed Google Analytics** — the UA tracking tag was deprecated
- **Improved PWA setup** — complete precache file list, proper cache versioning, manifest fields
- **Comprehensive test suite** — 324 tests covering prediction logic, expected values, pattern detection, UI functions, and accessibility
- **CI pipeline** — GitHub Actions runs tests on PRs and pushes; pre-push hook runs tests locally

## Running locally

```
npx serve
```

## Running tests

```
npm install
npm test
npm run test:coverage
```

## Contributing

See the [contributors](https://github.com/leopic/ac-nh-turnip-prices/graphs/contributors) to this fork.
