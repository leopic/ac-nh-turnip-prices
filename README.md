# Turnip Prophet

A turnip price predictor for Animal Crossing: New Horizons.

This is a fork of [mikebryant/ac-nh-turnip-prices](https://github.com/mikebryant/ac-nh-turnip-prices) — huge thanks to Mike Bryant and all the [original contributors](https://github.com/mikebryant/ac-nh-turnip-prices/graphs/contributors) for building the foundation of this project. The prediction logic is based on [Ninji's reverse engineering](https://twitter.com/_Ninji/status/1244818665851289602) of the game's turnip pricing algorithm.

## What's changed in this fork

- **Expected value calculations** — shows the probability-weighted expected price for each time slot, so you can see what a "typical" outcome looks like rather than just the min/max range
- **Sell/buy decision advice** — compares your current price against the expected future maximum and tells you whether to sell now or wait
- **Pattern likelihood indicator** — as you enter prices throughout the week, shows which pattern you're most likely on and how confident the prediction is
- **Dismissable welcome message** — the intro dialog can be closed and won't reappear until you reset
- **Hamburger menu** — language, theme, and credits moved to a slide-out drawer to reduce clutter
- **Bug fix: Pattern 3 middle peak** — the minimum prediction for Small Spike's middle peak slot was off by 1 bell vs the game code
- **Bug fix: PDF.decay() division by zero** — equal min/max decay rates no longer produce NaN
- **Updated dependencies** — jQuery 3.7.1, Chart.js 4.5.0, i18next 25, replaced deprecated i18next-xhr-backend with i18next-http-backend
- **Removed Google Analytics** — the UA tracking tag was deprecated
- **Improved PWA setup** — complete precache file list, proper cache versioning, manifest fields
- **Comprehensive test suite** — 300 tests covering prediction logic, expected values, pattern detection, and UI functions
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
