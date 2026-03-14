function updateTheme(theme, highColorContrast) {
  if (theme == "auto") {
    theme = (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }

  if (highColorContrast) {
    theme = theme + "-high-color-contrast";
  }

  if (theme != "light") {
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }

  if (chart_instance && chart_options) {
    chart_instance.options = chart_options;
    chart_instance.update();
  }
}

function setupTheming() {
  const themeSelector = $("#theme");
  const contrastCheckbox = $("#high-color-contrast");
  const supportsAutoTheming = (window.matchMedia && window.matchMedia("(prefers-color-scheme)").matches);
  let preferredTheme = localStorage.getItem("theme");
  let highColorContrast = !!localStorage.getItem("highColorContrast");
  let selectorVal = preferredTheme ? preferredTheme :
                    supportsAutoTheming ? "auto" : "light";

  // Build theme option menu.
  if (supportsAutoTheming) {
    themeSelector.append(`<option value="auto">${i18next.t('textbox.theme.auto')}</option>`);
  }
  themeSelector.append(`<option value="light">${i18next.t('textbox.theme.light')}</option>`);
  themeSelector.append(`<option value="dark">${i18next.t('textbox.theme.dark')}</option>`);

  themeSelector.val(selectorVal);
  contrastCheckbox.prop("checked", highColorContrast);

  // Listen to system changes in theme
  window.matchMedia("(prefers-color-scheme: dark)").addListener(() => {
    if (preferredTheme && preferredTheme != "auto") { return; }
    updateTheme("auto", highColorContrast);
  });

  // Preference listener
  themeSelector.on('change', function () {
    preferredTheme = this.value;
    updateTheme(preferredTheme, highColorContrast);

    if ((preferredTheme != "light" && !supportsAutoTheming) ||
        (preferredTheme != "auto" && supportsAutoTheming)) {
      localStorage.setItem("theme", preferredTheme);
    } else {
      localStorage.removeItem("theme");
    }
  });

  // High color contrast listener
  contrastCheckbox.on('change', function () {
    highColorContrast = this.checked;
    updateTheme(preferredTheme || (supportsAutoTheming ? "auto" : "light"), highColorContrast);

    if (highColorContrast) {
      localStorage.setItem("highColorContrast", "1");
    } else {
      localStorage.removeItem("highColorContrast");
    }
  });
}

$(document).ready(function() {
  if (i18next.isInitialized) {
    setupTheming();
  } else {
    i18next.on('initialized', function() {
      setupTheming();
    });
  }
});