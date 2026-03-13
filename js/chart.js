let chart_instance = null;

Chart.defaults.font.family = "'Varela Round', sans-serif";

const chart_options = {
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: "index",
  },
  elements: {
    line: {
      cubicInterpolationMode: "monotone",
    },
  },
};

function getChartColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    fill: style.getPropertyValue('--chart-fill-color'),
    line: style.getPropertyValue('--chart-line-color'),
    point: style.getPropertyValue('--chart-point-color'),
  };
}

function update_chart(input_data, possibilities, expected_values, labels) {
  let ctx = $("#chart"),
  colors = getChartColors(),
  datasets = [{
      label: i18next.t("output.chart.input"),
      pointBorderColor: colors.point,
      borderColor: colors.line,
      backgroundColor: colors.fill,
      data: input_data.slice(1),
      fill: false,
    }, {
      label: i18next.t("output.chart.expected"),
      pointBorderColor: colors.point,
      borderColor: colors.line,
      backgroundColor: colors.fill,
      data: [input_data[0], ...expected_values].map(price => price.toFixed(2)),
      fill: false,
    }, {
      label: i18next.t("output.chart.minimum"),
      pointBorderColor: colors.point,
      borderColor: colors.line,
      backgroundColor: colors.fill,
      data: possibilities[0].prices.slice(1).map(day => day.min),
      fill: false,
    }, {
      label: i18next.t("output.chart.maximum"),
      pointBorderColor: colors.point,
      borderColor: colors.line,
      backgroundColor: colors.fill,
      data: possibilities[0].prices.slice(1).map(day => day.max),
      fill: "-1",
    },
  ];

  if (chart_instance) {
    chart_instance.data.datasets = datasets;
    chart_instance.data.labels = labels;
    chart_instance.options = chart_options;
    chart_instance.update();
  } else {
    chart_instance = new Chart(ctx, {
      data: {
        datasets: datasets,
        labels: labels,
      },
      options: chart_options,
      type: "line",
    });
  }
}
