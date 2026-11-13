// Pure calculator helpers. Never infer purchase or selling prices from predictions.
const parsePositiveInteger = function (value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
};

const calculateProfit = function (quantity, purchasePrice, sellingPrice) {
  quantity = parsePositiveInteger(quantity);
  purchasePrice = parsePositiveInteger(purchasePrice);
  sellingPrice = parsePositiveInteger(sellingPrice);
  if (quantity === null || purchasePrice === null) return null;

  const investment = quantity * purchasePrice;
  if (!Number.isSafeInteger(investment)) return null;
  const result = { investment, breakEven: purchasePrice, revenue: null, profit: null, roi: null };
  if (sellingPrice === null) return result;

  const revenue = quantity * sellingPrice;
  if (!Number.isSafeInteger(revenue)) return result;
  result.revenue = revenue;
  result.profit = revenue - investment;
  result.roi = result.profit / investment * 100;
  return result;
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parsePositiveInteger, calculateProfit };
}
