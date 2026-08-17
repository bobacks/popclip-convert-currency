export function formatMoney(amount: number, currency: string): string {
  const smallNonZero = amount !== 0 && Math.abs(amount) < 0.01;
  const wholeGbp = currency === "GBP" && Number.isInteger(amount);

  return Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    ...(smallNonZero
      ? { minimumFractionDigits: 2, maximumFractionDigits: 6 }
      : wholeGbp
        ? { minimumFractionDigits: 0, maximumFractionDigits: 2 }
        : {}),
  }).format(amount);
}

export function formatConvertedResult(amount: number, currency: string): string {
  const formatted = formatMoney(amount, currency);
  return currency === "GBP" ? formatted : `${formatted} ${currency}`;
}
