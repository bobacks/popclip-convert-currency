import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { formatConvertedResult } from "./format.ts";
import {
  NON_FIAT_CODES,
  findCurrencyAmounts,
  parseCurrencyAmount,
} from "./parser.ts";

const [currenciesPath, ratesPath, ...pairPaths] = process.argv.slice(2);
if (!currenciesPath || !ratesPath) {
  throw new Error("Pass currencies.json, rates.json, and optionally pair response paths.");
}

const currencies = JSON.parse(await readFile(currenciesPath, "utf8"));
const rateRows = JSON.parse(await readFile(ratesPath, "utf8"));
const fiatCurrencies = currencies.filter(
  (currency) => !NON_FIAT_CODES.has(currency.iso_code),
);
const fiatCodes = new Set(fiatCurrencies.map((currency) => currency.iso_code));
const failures = [];
let parserAssertions = 0;
let formatterAssertions = 0;
let symbolAssertions = 0;
let pairAssertions = 0;

function check(label, test) {
  try {
    test();
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
  }
}

const codesByName = new Map();
for (const currency of fiatCurrencies) {
  const codes = codesByName.get(currency.name) ?? [];
  codes.push(currency.iso_code);
  codesByName.set(currency.name, codes);
}

for (const currency of fiatCurrencies) {
  const codeForms = [
    `1 ${currency.iso_code}`,
    `${currency.iso_code} 1`,
    `1${currency.iso_code}`,
    `${currency.iso_code}1`,
  ];
  for (const input of codeForms) {
    parserAssertions += 1;
    check(`${currency.iso_code} code form “${input}”`, () => {
      assert.equal(parseCurrencyAmount(input, currencies)?.currency.iso_code, currency.iso_code);
    });
  }

  for (const input of [`1 ${currency.name}`, `${currency.name} 1`]) {
    parserAssertions += 1;
    check(`${currency.iso_code} official name form “${input}”`, () => {
      const parsedCode = parseCurrencyAmount(input, currencies)?.currency.iso_code;
      assert.ok(codesByName.get(currency.name).includes(parsedCode));
    });
  }

  parserAssertions += 1;
  check(`${currency.iso_code} repeated sentence amounts`, () => {
    const found = findCurrencyAmounts(
      `The range is 1 ${currency.iso_code} to 2 ${currency.iso_code}.`,
      currencies,
    );
    assert.equal(found.length, 2);
    assert.ok(found.every((match) => match.currency.iso_code === currency.iso_code));
  });

  formatterAssertions += 1;
  check(`${currency.iso_code} result formatting`, () => {
    const formatted = formatConvertedResult(1234.56, currency.iso_code);
    assert.ok(formatted.length > 0);
    if (currency.iso_code !== "GBP") assert.ok(formatted.endsWith(currency.iso_code));
  });
}

const symbolCounts = new Map();
for (const currency of fiatCurrencies) {
  const symbol = currency.symbol.trim();
  if (symbol) symbolCounts.set(symbol, (symbolCounts.get(symbol) ?? 0) + 1);
}
for (const currency of fiatCurrencies) {
  const symbol = currency.symbol.trim();
  if (!symbol || symbolCounts.get(symbol) !== 1) continue;
  for (const input of [`${symbol} 12.5`, `12.5 ${symbol}`]) {
    symbolAssertions += 1;
    check(`${currency.iso_code} unique symbol “${input}”`, () => {
      assert.equal(parseCurrencyAmount(input, currencies)?.currency.iso_code, currency.iso_code);
    });
  }
}

const internationalFormats = [
  ["$1,234.56", 1234.56],
  ["$1.234,56", 1234.56],
  ["$1 234,56", 1234.56],
  ["$1\u00a0234,56", 1234.56],
  ["$1\u202f234,56", 1234.56],
  ["$1'234.56", 1234.56],
  ["$1’234.56", 1234.56],
];
for (const [input, expected] of internationalFormats) {
  parserAssertions += 1;
  check(`international number format “${input}”`, () => {
    const parsed = parseCurrencyAmount(input, currencies);
    assert.equal(parsed?.currency.iso_code, "USD");
    assert.equal(parsed?.amount, expected);
  });
}

const multilingualForms = [
  ["50 美金", "USD"],
  ["50 美元", "USD"],
  ["50 歐元", "EUR"],
  ["50 英鎊", "GBP"],
  ["50 港幣", "HKD"],
  ["50 人民幣", "CNY"],
  ["50 人民币", "CNY"],
  ["50 韓元", "KRW"],
  ["50 泰銖", "THB"],
  ["1000 日圓", "JPY"],
  ["1000 円", "JPY"],
  ["100 元", "CNY"],
];
for (const [input, expectedCode] of multilingualForms) {
  parserAssertions += 1;
  check(`multilingual form “${input}”`, () => {
    assert.equal(parseCurrencyAmount(input, currencies)?.currency.iso_code, expectedCode);
  });
}

const referenceBase = rateRows[0]?.base;
const ratesByCode = new Map([[referenceBase, 1]]);
for (const row of rateRows) {
  if (fiatCodes.has(row.quote)) ratesByCode.set(row.quote, row.rate);
}
const unavailableRateCodes = fiatCurrencies
  .filter((currency) => {
    const rate = ratesByCode.get(currency.iso_code);
    return !Number.isFinite(rate) || rate <= 0;
  })
  .map((currency) => currency.iso_code);
const convertibleCurrencies = fiatCurrencies.filter(
  (currency) => !unavailableRateCodes.includes(currency.iso_code),
);

for (const source of convertibleCurrencies) {
  for (const target of convertibleCurrencies) {
    if (source.iso_code === target.iso_code) continue;
    pairAssertions += 1;
    check(`${source.iso_code}→${target.iso_code} cross-rate`, () => {
      const rate = ratesByCode.get(target.iso_code) / ratesByCode.get(source.iso_code);
      assert.ok(Number.isFinite(rate) && rate > 0);
      const reciprocal = ratesByCode.get(source.iso_code) / ratesByCode.get(target.iso_code);
      assert.ok(Math.abs(rate * reciprocal - 1) < 1e-12);
    });
  }
}

for (const pairPath of pairPaths) {
  const pair = JSON.parse(await readFile(pairPath, "utf8"));
  check(`live pair ${pair.base}→${pair.quote}`, () => {
    assert.ok(fiatCodes.has(pair.base));
    assert.ok(fiatCodes.has(pair.quote));
    assert.ok(Number.isFinite(pair.rate) && pair.rate > 0);
    assert.match(pair.date, /^\d{4}-\d{2}-\d{2}$/u);
  });
}

const ambiguousNames = [...codesByName]
  .filter(([, codes]) => codes.length > 1)
  .map(([name, codes]) => ({ name, codes }));
const sharedSymbols = [...symbolCounts]
  .filter(([, count]) => count > 1)
  .map(([symbol, count]) => ({ symbol, currencies: count }));

const report = {
  fiatCurrencies: fiatCurrencies.length,
  parserAssertions,
  formatterAssertions,
  uniqueSymbolAssertions: symbolAssertions,
  directedCurrencyPairs: pairAssertions,
  unavailableDirectedPairs:
    fiatCurrencies.length * (fiatCurrencies.length - 1) - pairAssertions,
  unavailableRateCodes,
  liveEdgePairs: pairPaths.length,
  ambiguousNames,
  sharedSymbolCount: sharedSymbols.length,
  failures,
};

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exitCode = 1;
