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
- **Optional profit calculator** — enter your turnip quantity and choose an observed price to see investment, break-even price, and a hypothetical sale
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
- **Comprehensive test suite** — tests covering prediction logic, expected values, pattern detection, profit calculations, UI functions, and accessibility
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

## Profit calculator

Enter the purchase price in the existing Sunday field and your optional quantity
in **Profit & investment** below the weekly prices. Choose any valid Monday
through Saturday AM/PM selling price you've entered. The default is the latest
slot in the weekly schedule. Your choice stays selected while that slot has a
valid price. With no valid selling prices, you can still see investment and
break-even. The sale figures assume you hypothetically sell the entire quantity
at the selected price.

Quantity is saved locally under `turnip_quantity`, separately from price data,
and is not included in shared URLs. The selling-price choice lasts until reload
or reset. Reset clears the quantity, displayed prices, and price URL. If you
opened a shared link, your separately saved week remains available on reload.
New labels use i18next's English fallback
until translated; numbers use the selected language's formatting.

To check it locally, run `npm start` (`npm.cmd start` in PowerShell if script
execution is disabled) and open the address printed by the server.
Enter a purchase price of **108**, quantity **920**, and **169** in any
selling slot. Select that slot. Expect **99,360 Bells** invested, **155,480 Bells** revenue,
**+56,120 Bells** profit, **+56.48%** return, and **108 Bells** break-even.
Then clear the selling price, try a lower price and an invalid quantity, reload,
and use Reset. For a phone check, open the server's network address from a phone
on the same Wi-Fi network; check both themes, high contrast, and the numeric keyboard.

## Contributing

See the [contributors](https://github.com/leopic/ac-nh-turnip-prices/graphs/contributors) to this fork.
