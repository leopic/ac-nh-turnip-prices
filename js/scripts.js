//Reusable Fields
const getSellFields = function () {
  let fields = [];
  var now = new Date();
  for (var i = 2; i < 14; i++) {
    fields.push($("#sell_" + i)[0]);
    if (i == now.getDay() * 2 + (now.getHours() >= 12 ? 1 : 0)) {
      fields[fields.length - 1].classList.add("now");
    }
  }
  if (now.getDay() == 0) {
    buy_input[0].classList.add("now");
  }
  return fields;
};

const getFirstBuyRadios = function () {
  return [
    $("#first-time-radio-no")[0],
    $("#first-time-radio-yes")[0]
  ];
};

const getPreviousPatternRadios = function () {
  return [
    $("#pattern-radio-unknown")[0],
    $("#pattern-radio-fluctuating")[0],
    $("#pattern-radio-small-spike")[0],
    $("#pattern-radio-large-spike")[0],
    $("#pattern-radio-decreasing")[0]
  ];
};

const getCheckedRadio = function (radio_array) {
  return radio_array.find(radio => radio.checked === true).value;
};

const checkRadioByValue = function (radio_array, value) {
  if (value === null) {
    return;
  }
  value = value.toString();
  radio_array.find(radio => radio.value == value).checked = true;
};

const isElementInViewport = function (el) {
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
};

const scrollToCurrentField = function () {
  const currentField = document.querySelector("input.now:placeholder-shown");
  if (!currentField || isElementInViewport(currentField)) {
    return;
  }
  currentField.scrollIntoView({ behavior: "smooth", block: "center" });
  currentField.focus();
};

const state = {
  initialized: false,
  scrolled: false,
};

const buy_input = $("#buy");
const sell_inputs = getSellFields();
const first_buy_radios = getFirstBuyRadios();
const previous_pattern_radios = getPreviousPatternRadios();
const permalink_input = $('#permalink-input');
const permalink_button = $('#permalink-btn');
const snackbar = $('#snackbar');
const profitSellPrice = document.getElementById('profit-sell-price');
let preferredProfitSlot = '';

const updateProfitSellOptions = function (formatBells) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const entries = sell_inputs.flatMap((input, index) => {
    const price = parsePositiveInteger(input.value);
    if (price === null) return [];
    const label = i18next.t('profit.price-option', {
      day: i18next.t('weekdays.' + days[Math.floor(index / 2)]),
      time: i18next.t(index % 2 ? 'times.afternoon' : 'times.morning'),
      price: formatBells(price),
    });
    return [{ id: input.id, label, price }];
  });

  const options = entries.length ? entries : [{ id: '', label: i18next.t('profit.no-prices') }];
  if (profitSellPrice.options.length !== options.length || options.some(({ id, label }, index) => {
    const option = profitSellPrice.options[index];
    return option.value !== id || option.text !== label;
  })) {
    profitSellPrice.replaceChildren(...options.map(({ id, label }) => new Option(label, id)));
  }

  const preferred = entries.find(({ id }) => id === preferredProfitSlot);
  if (!preferred) preferredProfitSlot = '';
  const selected = preferred || entries[entries.length - 1];
  profitSellPrice.disabled = !selected;
  profitSellPrice.value = selected ? selected.id : '';
  return selected ? selected.price : null;
};

const saveTurnipQuantity = function () {
  const quantity = parsePositiveInteger(document.getElementById('turnip-quantity').value);
  try {
    if (quantity === null) localStorage.removeItem('turnip_quantity');
    else localStorage.setItem('turnip_quantity', String(quantity));
  } catch (e) {
    console.error(e);
  }
};

const updateProfitCalculator = function () {
  const input = document.getElementById('turnip-quantity');
  const quantity = parsePositiveInteger(input.value);
  const invalid = input.validity.badInput || (input.value !== '' && quantity === null);
  input.setAttribute('aria-invalid', String(invalid));
  input.setCustomValidity(invalid ? i18next.t('profit.invalid-quantity') : '');
  document.getElementById('quantity-error').hidden = !invalid;

  // Only change live-region text when its value changes.
  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element.textContent !== value) element.textContent = value;
  };
  const language = i18next.resolvedLanguage || i18next.language || 'en';
  const locale = { ua: 'uk', ph: 'fil' }[language] || language;
  const formatBells = (value, signed = false) => i18next.t('profit.bells', {
    amount: new Intl.NumberFormat(locale, { signDisplay: signed ? 'exceptZero' : 'auto' }).format(value),
  });
  const sellingPrice = updateProfitSellOptions(formatBells);
  const purchasePrice = parsePositiveInteger(buy_input.val());
  const result = calculateProfit(quantity, purchasePrice, sellingPrice);
  const unknown = i18next.t('profit.unknown');

  let message = 'scenario';
  if (invalid) message = 'invalid-quantity';
  else if (quantity === null) message = 'empty';
  else if (purchasePrice === null) message = 'missing-buy';
  else if (result === null) message = 'too-large';
  else if (sellingPrice === null) message = 'missing-sell';
  else if (result.revenue === null) message = 'too-large';
  setText('profit-message', i18next.t('profit.' + message));
  document.getElementById('profit-values').hidden = result === null || invalid;

  const profit = result ? result.profit : null;
  const outcome = profit === null ? 'net' : profit > 0 ? 'gain' : profit < 0 ? 'loss' : 'even';
  document.getElementById('profit-net-row').className = 'profit-' + outcome;
  setText('profit-net-label', i18next.t('profit.' + outcome));
  setText('profit-investment', result ? formatBells(result.investment) : unknown);
  setText('profit-break-even', result ? formatBells(result.breakEven) : unknown);
  setText('profit-revenue', result && result.revenue !== null ? formatBells(result.revenue) : unknown);
  setText('profit-net', profit !== null ? formatBells(profit, true) : unknown);
  setText('profit-roi', result && result.roi !== null ? new Intl.NumberFormat(locale, {
    style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero',
  }).format(result.roi / 100) : unknown);
};

//Functions
const fillFields = function (prices, first_buy, previous_pattern) {
  checkRadioByValue(first_buy_radios, first_buy);
  checkRadioByValue(previous_pattern_radios, previous_pattern);

  buy_input.focus();
  buy_input.val(prices[0] || '');
  buy_input.blur();
  const sell_prices = prices.slice(2);

  sell_prices.forEach((price, index) => {
    if (!price) {
      return;
    } else {
      const element = $("#sell_" + (index + 2));
      element.focus();
      element.val(price);
      element.blur();
    }
  });
};

const initialize = function () {
  const quantityInput = document.getElementById('turnip-quantity');
  try {
    quantityInput.value = parsePositiveInteger(localStorage.getItem('turnip_quantity')) || '';
  } catch (e) {
    console.error(e);
  }
  quantityInput.addEventListener('input', function () {
    saveTurnipQuantity();
    updateProfitCalculator();
  });
  profitSellPrice.addEventListener('change', function () {
    preferredProfitSlot = profitSellPrice.value;
    updateProfitCalculator();
  });

  try {
    const previous = getPrevious();
    const first_buy = previous[0];
    const previous_pattern = previous[1];
    const prices = previous[2];
    if (prices === null) {
      fillFields([], first_buy, previous_pattern);
    } else {
      fillFields(prices, first_buy, previous_pattern);
    }
  } catch (e) {
    console.error(e);
  }

  updateProfitCalculator();
  $(document).trigger("input");

  var welcomeBox = document.getElementById("welcome-box");
  if (welcomeBox && localStorage.getItem("welcome_dismissed")) {
    welcomeBox.style.display = "none";
  }

  $("#dismiss-welcome").on("click", function () {
    localStorage.setItem("welcome_dismissed", "1");
    if (welcomeBox) welcomeBox.style.display = "none";
  });

  $("#permalink-btn").on("click", copyPermalink);

  $("#reset").on("click", function () {
    if (window.confirm(i18next.t("prices.reset-warning"))) {
      sell_inputs.forEach(input => input.value = '');
      fillFields([], false, -1);
      quantityInput.value = '';
      preferredProfitSlot = '';
      saveTurnipQuantity();
      // Remove the shared URL while keeping its prices isolated from the saved week.
      window.history.replaceState({}, null, window.location.pathname + window.location.hash);
      localStorage.removeItem("welcome_dismissed");
      if (welcomeBox) welcomeBox.style.display = "";
      update();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  console.log('finished initializing');
  state.initialized = true;
};

const updateLocalStorage = function (prices, first_buy, previous_pattern) {
  try {
    if (prices.length !== 14) throw "The data array needs exactly 14 elements to be valid";
    localStorage.setItem("sell_prices", JSON.stringify(prices));
    localStorage.setItem("first_buy", JSON.stringify(first_buy));
    localStorage.setItem("previous_pattern", JSON.stringify(previous_pattern));
  } catch (e) {
    console.error(e);
  }
};

const isEmpty = function (arr) {
  const filtered = arr.filter(value => value !== null && value !== '' && !isNaN(value));
  return filtered.length == 0;
};

const getFirstBuyStateFromQuery = function (param) {
  try {
    const params = new URLSearchParams(window.location.search.substr(1));
    const firstbuy_str = params.get(param);

    if (firstbuy_str == null) {
      return null;
    }

    firstbuy = null;
    if (firstbuy_str == "1" || firstbuy_str == "yes" || firstbuy_str == "true") {
      firstbuy = true;
    } else if (firstbuy_str == "0" || firstbuy_str == "no" || firstbuy_str == "false") {
      firstbuy = false;
    }

    return firstbuy;

  } catch (e) {
    return null;
  }
};

const getFirstBuyStateFromLocalstorage = function () {
  return JSON.parse(localStorage.getItem('first_buy'));
};

const getPreviousPatternStateFromLocalstorage = function () {
  return JSON.parse(localStorage.getItem('previous_pattern'));
};

const getPreviousPatternStateFromQuery = function (param) {
  try {
    const params = new URLSearchParams(window.location.search.substr(1));
    const pattern_str = params.get(param);

    if (pattern_str == null) {
      return null;
    }

    if (pattern_str == "0" || pattern_str == "fluctuating") {
      pattern = 0;
    } else if (pattern_str == "1" || pattern_str == "large-spike") {
      pattern = 1;
    } else if (pattern_str == "2" || pattern_str == "decreasing") {
      pattern = 2;
    } else if (pattern_str == "3" || pattern_str == "small-spike") {
      pattern = 3;
    } else {
      pattern = -1;
    }

    return pattern;

  } catch (e) {
    return null;
  }
};

const getPricesFromLocalstorage = function () {
  try {
    const sell_prices = JSON.parse(localStorage.getItem("sell_prices"));

    if (!Array.isArray(sell_prices) || sell_prices.length !== 14) {
      return null;
    }

    return sell_prices;
  } catch (e) {
    return null;
  }
};

const getPricesFromQuery = function (param) {
  try {
    const params = new URLSearchParams(window.location.search.substr(1));
    const sell_prices = params.get(param).split(".").map((x) => parseInt(x, 10));

    if (!Array.isArray(sell_prices)) {
      return null;
    }

    // Parse the array which is formatted like: [price, M-AM, M-PM, T-AM, T-PM, W-AM, W-PM, Th-AM, Th-PM, F-AM, F-PM, S-AM, S-PM, Su-AM, Su-PM]
    // due to the format of local storage we need to double up the price at the start of the array.
    sell_prices.unshift(sell_prices[0]);

    // This allows us to fill out the missing fields at the end of the array
    for (let i = sell_prices.length; i < 14; i++) {
      sell_prices.push(0);
    }

    return sell_prices;
  } catch (e) {
    return null;
  }
};

const getPreviousFromQuery = function () {
  /* Check if valid prices are entered. Exit immediately if not. */
  const prices = getPricesFromQuery("prices");
  if (prices == null) {
    return null;
  }

  console.log("Using data from query.");
  window.populated_from_query = true;
  return [
    getFirstBuyStateFromQuery("first"),
    getPreviousPatternStateFromQuery("pattern"),
    prices
  ];
};

const getPreviousFromLocalstorage = function () {
  return [
    getFirstBuyStateFromLocalstorage(),
    getPreviousPatternStateFromLocalstorage(),
    getPricesFromLocalstorage()
  ];
};


/**
 * Gets previous values. First tries to parse parameters,
 * if none of them match then it looks in local storage.
 * @return {[first time, previous pattern, prices]}
 */
const getPrevious = function () {
  return getPreviousFromQuery() || getPreviousFromLocalstorage();
};

const getSellPrices = function () {
  //Checks all sell inputs and returns an array with their values
  return res = sell_inputs.map(function (input) {
    return parseInt(input.value || '');
  });
};

const getPriceClass = function(buy_price, max) {
  const priceBrackets = [200, 30, 0, -30, -99];
  let diff = max - buy_price;
  for(var i=0; i<priceBrackets.length; i++) {
    if(diff >= priceBrackets[i]) {
      return "range" + i;
    }
  }
  return "";
};

const displayPercentage = function(fraction) {
  if (Number.isFinite(fraction)) {
    let percent = fraction * 100;
    if (percent >= 1) {
      return percent.toPrecision(3) + '%';
    } else if (percent >= 0.01) {
      return percent.toFixed(2) + '%';
    } else {
      return '<0.01%';
    }
  } else {
    return '—';
  }
};

const hideChart = function() {
  $("#output").html("");
  $(".chart-wrapper").hide();
  $(".table-wrapper").hide();
};

const announceResults = function (count) {
  var liveRegion = document.getElementById("results-live");
  if (liveRegion) {
    liveRegion.textContent = count + " pattern" + (count !== 1 ? "s" : "") + " found";
  }
};

const calculateOutput = function (data, first_buy, previous_pattern) {
  $("#decision").empty();
  if (isEmpty(data)) {
    hideChart();
    announceResults(0);
    return;
  }
  let pat_desc = {0:"fluctuating", 1:"large-spike", 2:"decreasing", 3:"small-spike", 4:"all"};
  let output_possibilities = "";
  let predictor = new Predictor(data, first_buy, previous_pattern);
  let analyzed_possibilities = predictor.analyze_possibilities();
  if (analyzed_possibilities[0].weekGuaranteedMinimum === Number.POSITIVE_INFINITY) {
    hideChart();
    $(".error:hidden").show();
    return;
  }
  $(".error:visible").hide();
  $(".chart-wrapper:hidden").show();
  $(".table-wrapper:hidden").show();
  let buy_price = parseInt(buy_input.val());
  previous_pattern_number = "";

  let expected_values = compute_expected_values(analyzed_possibilities);
  for (let poss of analyzed_possibilities) {
    var out_line = "<tr><td class='table-pattern'>" + i18next.t("patterns." + pat_desc[poss.pattern_number])  + "</td>";
    const style_price = buy_price || poss.prices[0].min;
    if (previous_pattern_number != poss.pattern_number) {
      previous_pattern_number = poss.pattern_number;
      pattern_count = analyzed_possibilities
        .filter(val => val.pattern_number == poss.pattern_number)
        .length;
      out_line += `<td rowspan=${pattern_count}>${displayPercentage(poss.category_total_probability)}</td>`;
    }
    out_line += `<td>${displayPercentage(poss.probability)}</td>`;
    for (let day of poss.prices.slice(2)) {
      let price_class = getPriceClass(style_price, day.max);
      if (day.min !== day.max) {
        out_line += `<td class='${price_class}'>${day.min} ${i18next.t("output.to")} ${day.max}</td>`;
      } else {
        out_line += `<td class='${price_class}'>${day.min}</td>`;
      }
    }

    var min_class = getPriceClass(style_price, poss.weekGuaranteedMinimum);
    var max_class = getPriceClass(style_price, poss.weekMax);
    out_line += `<td class='${min_class}'>${poss.weekGuaranteedMinimum}</td><td class='${max_class}'>${poss.weekMax}</td></tr>`;
    output_possibilities += out_line;
  }

  let curr_time = new Date().getDay() * 2 - 2 + (new Date().getHours() >= 12 ? 1 : 0);
  let curr_price = data[curr_time + 2];
  const { expected_maximum, expected_argmax } = find_expected_maximum(expected_values, curr_time + 1);

  $("#output").html(output_possibilities);
  announceResults(analyzed_possibilities.length);

  const labels = [i18next.t("weekdays.sunday")].concat(
    ...[
      i18next.t("weekdays.abr.monday"),
      i18next.t("weekdays.abr.tuesday"),
      i18next.t("weekdays.abr.wednesday"),
      i18next.t("weekdays.abr.thursday"),
      i18next.t("weekdays.abr.friday"),
      i18next.t("weekdays.abr.saturday"),
    ].map(day =>
      [i18next.t("times.morning"), i18next.t("times.afternoon")].map(
        time => `${day} ${time}`
      )
    )
  );

  update_chart(data, analyzed_possibilities, expected_values, labels);

  const pattern_probs = get_pattern_probabilities(analyzed_possibilities);
  if (pattern_probs.length > 0 && pattern_probs[0].probability < 1) {
    const top = pattern_probs[0];
    $("#decision").append(
      `<p>${i18next.t("output.likely-pattern", [
        i18next.t("patterns." + pat_desc[top.pattern_number]),
        displayPercentage(top.probability)
      ])}</p>`
    );
  }

  const decision = get_sell_buy_decision(curr_price, curr_time, expected_maximum, data.length);
  if (decision && decision.type === "sell") {
    $("#decision").append(
      `<h2>${i18next.t("output.sell-now-title")}</h2>
      <p>${i18next.t("output." + decision.action)}
      ${i18next.t("output.sell-advice", [expected_maximum.toFixed(0), labels[expected_argmax + 1]])}</p>`
    );
  } else if (decision && decision.type === "buy") {
    $("#decision").append(
      `<h2>${i18next.t("output.should-buy-title")}</h2>
      <p>${i18next.t("output." + decision.action)}
      ${i18next.t("output.buy-advice", [expected_maximum.toFixed(0)])}</p>`
    );
  }
};

const generatePermalink = function (buy_price, sell_prices, first_buy, previous_pattern) {
  let searchParams = new URLSearchParams();
  let pricesParam = buy_price ? buy_price.toString() : '';

  if (!isEmpty(sell_prices)) {
    const filtered = sell_prices.map(price => isNaN(price) ? '' : price).join('.');
    pricesParam = pricesParam.concat('.', filtered);
  }

  if (pricesParam) {
    searchParams.append('prices', pricesParam);
  }

  if (first_buy) {
    searchParams.append('first', true);
  }

  if (previous_pattern !== -1) {
    searchParams.append('pattern', previous_pattern);
  }

  return searchParams.toString() && window.location.origin.concat('?', searchParams.toString());
};

const copyPermalink = function () {
  let text = permalink_input[0];

  permalink_input.show();
  text.select();
  text.setSelectionRange(0, 99999); /* for mobile devices */

  document.execCommand('copy');
  permalink_input.hide();

  flashMessage(i18next.t("prices.permalink-copied"));
};

const flashMessage = function(message) {
  snackbar.text(message);
  snackbar.addClass('show');

  setTimeout(function () {
    snackbar.removeClass('show');
    snackbar.text('');
  }, 3000);
};

const update = function () {
  if(!state.initialized){
    console.log('update function called before initial data load');
    // calls to update before the previous data has been initialized / loaded will reset the data.
    return;
  }
  const sell_prices = getSellPrices();
  const buy_price = parseInt(buy_input.val());
  const first_buy = getCheckedRadio(first_buy_radios) == 'true';
  const previous_pattern = parseInt(getCheckedRadio(previous_pattern_radios));

  const permalink = generatePermalink(buy_price, sell_prices, first_buy, previous_pattern);
  if (permalink) {
    permalink_button.show();
  } else {
    permalink_button.hide();
  }
  permalink_input.val(permalink);

  if (permalink && window.history.replaceState) {
    window.history.replaceState({}, null, permalink);
  }

  const prices = [buy_price, buy_price, ...sell_prices];

  if (!window.populated_from_query) {
    updateLocalStorage(prices, first_buy, previous_pattern);
  }

  updateProfitCalculator();
  calculateOutput(prices, first_buy, previous_pattern);

  if (!state.scrolled) {
    state.scrolled = true;
    requestAnimationFrame(scrollToCurrentField);
  }
};

// Install prompt
let deferredInstallPrompt = null;
const installSection = document.getElementById("install-section");
const installBtn = document.getElementById("install-btn");

window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (installSection) installSection.style.display = "block";
});

window.addEventListener("appinstalled", function () {
  deferredInstallPrompt = null;
  if (installSection) installSection.style.display = "none";
});

if (installBtn) {
  installBtn.addEventListener("click", async function () {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (installSection) installSection.style.display = "none";
  });
}
