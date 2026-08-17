export interface CurrencyInfo {
  iso_code: string;
  name: string;
  symbol: string;
}

export interface ParsedAmount {
  amount: number;
  currency: CurrencyInfo;
}

export interface ParsedAmountMatch extends ParsedAmount {
  start: number;
  end: number;
  text: string;
}

// Frankfurter also publishes precious metals and Special Drawing Rights. They
// are deliberately excluded because this extension is for fiat currencies.
export const NON_FIAT_CODES = new Set(["XAG", "XAU", "XDR", "XPD", "XPT"]);

export const currencySelectionPattern =
  /^(?=.{1,2000}$)(?=.*\d)(?=.*(?:B\/\.|[¢£$€¥￥円元₹₩₽₺₴₪₫฿₱₦₵₡₲₭₮₸₼₾៛৳]|日圓|台幣|美金|美元|歐元|英鎊|港幣|人民幣|人民币|韓元|泰銖|(?:^|[^\p{L}])[a-z]{3}(?:[^\p{L}]|$)|\d[a-z]{3}(?:[^\p{L}]|$)|(?:^|[^\p{L}])[a-z]{3}\d|\b(?:dhs?|dhirams?|cents?|dollars?|pounds?|sterling|euros?|yen|yuan|renminbi|rupees?|francs?|pesos?|dinars?|dirhams?|riyals?|rials?|kron(?:a|e)|kroner|kronor|rubles?|roubles?|shillings?|rand|reais|real|lira|won|baht|zloty|zlote|forint|shekels?)\b)).*$/isu;

const magnitudeScales: Record<string, number> = {
  k: 1_000,
  thousand: 1_000,
  thousands: 1_000,
  m: 1_000_000,
  mn: 1_000_000,
  million: 1_000_000,
  millions: 1_000_000,
  b: 1_000_000_000,
  bn: 1_000_000_000,
  billion: 1_000_000_000,
  billions: 1_000_000_000,
  t: 1_000_000_000_000,
  tn: 1_000_000_000_000,
  trillion: 1_000_000_000_000,
  trillions: 1_000_000_000_000,
};

const magnitudeSource =
  "(?:thousands?|millions?|billions?|trillions?|k|mn?|bn?|tn?)";

const aliases: Record<string, string[]> = {
  GBP: [
    "pound",
    "pounds",
    "pound sterling",
    "pounds sterling",
    "sterling",
    "british pounds",
    "quid",
    "英鎊",
  ],
  USD: [
    "dollar",
    "dollars",
    "us dollar",
    "us dollars",
    "u.s. dollar",
    "u.s. dollars",
    "american dollar",
    "american dollars",
    "buck",
    "bucks",
    "美金",
    "美元",
  ],
  EUR: ["euro", "euros", "歐元"],
  JPY: ["yen", "japanese yen", "円", "日圓"],
  CNY: ["yuan", "chinese yuan", "renminbi", "rmb", "元", "人民币", "人民幣"],
  INR: ["rupee", "rupees", "indian rupee", "indian rupees"],
  KRW: ["won", "south korean won", "korean won", "韓元"],
  CHF: ["swiss franc", "swiss francs"],
  CAD: ["canadian dollar", "canadian dollars"],
  AUD: ["australian dollar", "australian dollars", "aussie dollar", "aussie dollars"],
  NZD: ["new zealand dollar", "new zealand dollars", "kiwi dollar", "kiwi dollars"],
  HKD: ["hong kong dollar", "hong kong dollars"],
  SGD: ["singapore dollar", "singapore dollars"],
  BRL: ["brazilian real", "brazilian reais"],
  MXN: ["mexican peso", "mexican pesos"],
  AED: [
    "dh",
    "dhs",
    "dirham",
    "dirhams",
    "dhiram",
    "dhirams",
    "uae dirham",
    "uae dirhams",
    "emirati dirham",
    "emirati dirhams",
  ],
  ZAR: ["south african rand"],
  TWD: ["台幣"],
  HKD: ["港幣"],
  THB: ["泰銖"],
};

// A bare shared symbol must have a deterministic meaning. Users can always use
// an explicit ISO code (for example CAD or CNY) to override these defaults.
const symbolDefaults: Record<string, string> = {
  "$": "USD",
  "US$": "USD",
  "A$": "AUD",
  "AU$": "AUD",
  "CA$": "CAD",
  "HK$": "HKD",
  "NZ$": "NZD",
  "S$": "SGD",
  "R$": "BRL",
  "NT$": "TWD",
  "Mex$": "MXN",
  "£": "GBP",
  "¥": "JPY",
  "￥": "JPY",
  "円": "JPY",
  "JP¥": "JPY",
  "CN¥": "CNY",
  "元": "CNY",
  "₹": "INR",
  "₩": "KRW",
  "€": "EUR",
  "kr": "SEK",
};

function normalizeWords(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[’']/gu, "'")
    .replace(/[._-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("en");
}

function pluralizeName(name: string): string {
  if (/[^aeiou]y$/iu.test(name)) return `${name.slice(0, -1)}ies`;
  if (/(?:s|x|z|ch|sh)$/iu.test(name)) return `${name}es`;
  return `${name}s`;
}

function currencyLookup(currencies: CurrencyInfo[]): Map<string, CurrencyInfo> {
  const active = currencies.filter((currency) => !NON_FIAT_CODES.has(currency.iso_code));
  const byCode = new Map(active.map((currency) => [currency.iso_code, currency]));
  const lookup = new Map<string, CurrencyInfo>();

  for (const currency of active) {
    lookup.set(normalizeWords(currency.iso_code), currency);
    lookup.set(normalizeWords(currency.name), currency);
    lookup.set(normalizeWords(pluralizeName(currency.name)), currency);
  }

  for (const [code, names] of Object.entries(aliases)) {
    const currency = byCode.get(code);
    if (currency) {
      for (const name of names) lookup.set(normalizeWords(name), currency);
    }
  }

  // Provider symbols are accepted only when unique. Shared symbols are handled
  // by the explicit defaults above instead of depending on provider list order.
  const symbolCounts = new Map<string, number>();
  for (const currency of active) {
    const symbol = currency.symbol.trim();
    if (symbol) symbolCounts.set(symbol, (symbolCounts.get(symbol) ?? 0) + 1);
  }
  for (const currency of active) {
    const symbol = currency.symbol.trim();
    if (symbol && symbolCounts.get(symbol) === 1) lookup.set(symbol, currency);
  }
  for (const [symbol, code] of Object.entries(symbolDefaults)) {
    const currency = byCode.get(code);
    if (currency) {
      lookup.set(symbol, currency);
      lookup.set(symbol.toLocaleLowerCase("en"), currency);
    }
  }

  return lookup;
}

function currencyTokenValues(currencies: CurrencyInfo[]): string[] {
  const active = currencies.filter((currency) => !NON_FIAT_CODES.has(currency.iso_code));
  const byCode = new Map(active.map((currency) => [currency.iso_code, currency]));
  const tokens = new Set<string>();

  for (const currency of active) {
    tokens.add(currency.iso_code);
    tokens.add(currency.name);
    tokens.add(pluralizeName(currency.name));
  }
  for (const [code, names] of Object.entries(aliases)) {
    if (byCode.has(code)) names.forEach((name) => tokens.add(name));
  }

  const symbolCounts = new Map<string, number>();
  for (const currency of active) {
    const symbol = currency.symbol.trim();
    if (symbol) symbolCounts.set(symbol, (symbolCounts.get(symbol) ?? 0) + 1);
  }
  for (const currency of active) {
    const symbol = currency.symbol.trim();
    if (symbol && symbolCounts.get(symbol) === 1) tokens.add(symbol);
  }
  for (const [symbol, code] of Object.entries(symbolDefaults)) {
    if (byCode.has(code)) tokens.add(symbol);
  }

  return [...tokens].filter(Boolean).sort((a, b) => b.length - a.length);
}

function currencyTokenPattern(token: string): string {
  const escaped = token
    .replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
    .replace(/\s+/gu, "\\s+");
  const beginsWithLetter = /^\p{L}/u.test(token);
  const endsWithLetter = /\p{L}$/u.test(token);
  return `${beginsWithLetter ? "(?<!\\p{L})" : ""}${escaped}${
    endsWithLetter ? "(?!\\p{L})" : ""
  }`;
}

export function parseNumber(value: string): number | null {
  let text = value.replace(/[\s\u00a0\u202f'’]/gu, "");
  const sign = text.startsWith("-") ? -1 : 1;
  text = text.replace(/^[+-]/u, "");
  if (!/^\d[\d.,]*$/u.test(text)) return null;

  const lastDot = text.lastIndexOf(".");
  const lastComma = text.lastIndexOf(",");
  let decimalSeparator = "";

  if (lastDot >= 0 && lastComma >= 0) {
    decimalSeparator = lastDot > lastComma ? "." : ",";
  } else {
    const separator = lastDot >= 0 ? "." : lastComma >= 0 ? "," : "";
    if (separator) {
      const occurrences = text.split(separator).length - 1;
      const trailingDigits = text.length - text.lastIndexOf(separator) - 1;
      if (occurrences === 1 && (trailingDigits !== 3 || text.startsWith("0"))) {
        decimalSeparator = separator;
      } else if (occurrences > 1 && trailingDigits > 0 && trailingDigits < 3) {
        decimalSeparator = separator;
      }
    }
  }

  if (decimalSeparator) {
    const thousandsSeparator = decimalSeparator === "." ? "," : ".";
    text = text.split(thousandsSeparator).join("");
    const decimalIndex = text.lastIndexOf(decimalSeparator);
    text =
      text.slice(0, decimalIndex).split(decimalSeparator).join("") +
      "." +
      text.slice(decimalIndex + 1);
  } else {
    text = text.replace(/[.,]/gu, "");
  }

  const result = Number(text) * sign;
  return Number.isFinite(result) ? result : null;
}

export function parseCurrencyAmount(
  input: string,
  currencies: CurrencyInfo[],
): ParsedAmount | null {
  let text = input.trim();
  const parenthesized = /^\(.*\)$/su.test(text);
  if (parenthesized) text = text.slice(1, -1).trim();

  const numberMatch = /[-+]?(?:\d[\d\s\u00a0\u202f,.'’]*\d|\d)/u.exec(text);
  if (!numberMatch) return null;

  const rawNumber = numberMatch[0];
  let amount = parseNumber(rawNumber);
  if (amount === null) return null;

  const before = text.slice(0, numberMatch.index);
  let after = text.slice(numberMatch.index + rawNumber.length);
  if ((parenthesized || /^\s*-/u.test(input)) && amount > 0) amount *= -1;

  const lookup = currencyLookup(currencies);
  const cleanCurrencyText = (afterNumber: string): string =>
    `${before} ${afterNumber}`
      .replace(/[()]/gu, "")
      .replace(/^\s*[+-]\s*/u, "")
      .replace(/\s*[+-]\s*$/u, "")
      .replace(/^[\s"“”'‘’`*•·●◦▪︎:;=\[\]{}]+/u, "")
      .replace(/[\s"“”'‘’`*•·●◦▪︎:;=\[\]{}]+$/u, "")
      .trim();
  const resolveCurrency = (
    currencyText: string,
    candidateAmount: number,
  ): ParsedAmount | null => {
    if (!currencyText) return null;
    const normalizedCurrency = normalizeWords(currencyText);
    const meansUsdCents =
      currencyText === "¢" ||
      ["cent", "cents", "us cent", "us cents", "u s cent", "u s cents"].includes(
        normalizedCurrency,
      );
    if (meansUsdCents) {
      const currency = lookup.get("usd");
      return currency ? { amount: candidateAmount / 100, currency } : null;
    }

    const exactSymbol =
      lookup.get(currencyText) ?? lookup.get(currencyText.toLocaleLowerCase("en"));
    const currency = exactSymbol ?? lookup.get(normalizedCurrency);
    return currency ? { amount: candidateAmount, currency } : null;
  };

  // Exact symbols take precedence over one-letter magnitude suffixes. For
  // example, trailing "m" is the Turkmenistani manat symbol and "T$" is the
  // Tongan paʻanga symbol, while "$2m" still means two million US dollars.
  const directCurrency = resolveCurrency(cleanCurrencyText(after), amount);
  if (directCurrency) return directCurrency;

  const magnitudeMatch = new RegExp(
    `^\\s*(${magnitudeSource})(?!\\p{L})`,
    "iu",
  ).exec(after);
  if (magnitudeMatch) {
    const scale = magnitudeScales[magnitudeMatch[1].toLocaleLowerCase("en")];
    amount *= scale;
    if (!Number.isFinite(amount)) return null;
    after = after.slice(magnitudeMatch[0].length);
  }

  return resolveCurrency(cleanCurrencyText(after), amount);
}

export function findCurrencyAmounts(
  input: string,
  currencies: CurrencyInfo[],
): ParsedAmountMatch[] {
  const currencySource = currencyTokenValues(currencies)
    .map(currencyTokenPattern)
    .join("|");
  if (!currencySource) return [];

  const numberSource = "[-+]?(?:\\d(?:[\\d\\s\\u00a0\\u202f,.'’]*\\d)?)";
  const scaledNumberSource = `${numberSource}(?:\\s*${magnitudeSource}(?!\\p{L}))?`;
  const candidatePattern = new RegExp(
    `(?:${currencySource})\\s*${scaledNumberSource}|${scaledNumberSource}\\s*(?:${currencySource})`,
    "giu",
  );

  const matches: ParsedAmountMatch[] = [];
  for (const candidate of input.matchAll(candidatePattern)) {
    const parsed = parseCurrencyAmount(candidate[0], currencies);
    if (!parsed || candidate.index === undefined) continue;
    matches.push({
      ...parsed,
      start: candidate.index,
      end: candidate.index + candidate[0].length,
      text: candidate[0],
    });
  }
  return matches;
}
