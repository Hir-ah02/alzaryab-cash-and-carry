const wholePriceFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const decimalPriceFormatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1800 → "Rs. 1,800", 1250.5 → "Rs. 1,250.50" */
export function formatPrice(value) {
  const amount = Number(value) || 0;
  const formatter = Number.isInteger(amount) ? wholePriceFormatter : decimalPriceFormatter;
  return `Rs. ${formatter.format(amount)}`;
}

/** Price for an input field: 1800 → "1800", 1250.5 → "1250.50" */
export function formatPriceInput(value) {
  const amount = Number(value) || 0;
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

/** 1536 → "1.5 KB" */
export function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(/\.0$/, '')} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

export function formatCount(value) {
  return new Intl.NumberFormat('en-US').format(value);
}
