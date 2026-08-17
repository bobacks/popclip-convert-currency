import assert from "node:assert/strict";
import { formatConvertedResult } from "./format.ts";
import {
  currencySelectionPattern,
  findCurrencyAmounts,
  parseCurrencyAmount,
  parseNumber,
} from "./parser.ts";

const currencies = [
  { iso_code: "GBP", name: "British Pound", symbol: "£" },
  { iso_code: "USD", name: "United States Dollar", symbol: "$" },
  { iso_code: "EUR", name: "Euro", symbol: "€" },
  { iso_code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { iso_code: "CNY", name: "Chinese Renminbi Yuan", symbol: "¥" },
  { iso_code: "CAD", name: "Canadian Dollar", symbol: "$" },
  { iso_code: "AED", name: "United Arab Emirates Dirham", symbol: "د.إ" },
  { iso_code: "AUD", name: "Australian Dollar", symbol: "$" },
  { iso_code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { iso_code: "ISK", name: "Icelandic Króna", symbol: "kr." },
  { iso_code: "TWD", name: "New Taiwan Dollar", symbol: "$" },
  { iso_code: "HKD", name: "Hong Kong Dollar", symbol: "$" },
  { iso_code: "THB", name: "Thai Baht", symbol: "฿" },
  { iso_code: "KRW", name: "South Korean Won", symbol: "₩" },
  { iso_code: "PAB", name: "Panamanian Balboa", symbol: "B/." },
  { iso_code: "TMT", name: "Turkmenistani Manat", symbol: "m" },
  { iso_code: "TOP", name: "Tongan Paʻanga", symbol: "T$" },
  { iso_code: "WST", name: "Samoan Tala", symbol: "T" },
];

const cases = [
  ["£25", 25, "GBP"],
  ["25 GBP", 25, "GBP"],
  ["GBP 25", 25, "GBP"],
  ["25 Pounds Sterling", 25, "GBP"],
  ["£ 25", 25, "GBP"],
  ["24GBP", 24, "GBP"],
  ["$1,234.56", 1234.56, "USD"],
  ["1.234,56 EUR", 1234.56, "EUR"],
  ["1 234,56 euros", 1234.56, "EUR"],
  ["-£25", -25, "GBP"],
  ["(£25)", -25, "GBP"],
  ["JP¥5000", 5000, "JPY"],
  ["5000 CNY", 5000, "CNY"],
  ["CA$10", 10, "CAD"],
  ["25 United Arab Emirates Dirhams", 25, "AED"],
  ["120 AUD", 120, "AUD"],
  ["50 AED", 50, "AED"],
  ["¢1000", 10, "USD"],
  ["50 SEK", 50, "SEK"],
  ["50ISK", 50, "ISK"],
  ["62,700 円", 62700, "JPY"],
  ["元 1.100", 1100, "CNY"],
  ["￥500", 500, "JPY"],
  ["Dh 50", 50, "AED"],
  ["50 Dhs", 50, "AED"],
  ["50 dirhams", 50, "AED"],
  ["1000 日圓", 1000, "JPY"],
  ["100 台幣", 100, "TWD"],
  ["50 美金", 50, "USD"],
  ["50 美元", 50, "USD"],
  ["50 歐元", 50, "EUR"],
  ["50 英鎊", 50, "GBP"],
  ["50 港幣", 50, "HKD"],
  ["50 人民幣", 50, "CNY"],
  ["50 韓元", 50, "KRW"],
  ["50 泰銖", 50, "THB"],
  ["• $1,100", 1100, "USD"],
  ["• €79,00", 79, "EUR"],
  ["• £50.25", 50.25, "GBP"],
  ["• 100 USD", 100, "USD"],
  ["• ¥10,000", 10000, "JPY"],
  ["• 62,700 円", 62700, "JPY"],
  ["• AED 50", 50, "AED"],
  ["`$1,100`", 1100, "USD"],
  ["“100 USD”", 100, "USD"],
  ["226.12\nUSD", 226.12, "USD"],
  ["226.12\r\n USD", 226.12, "USD"],
  ["$1.2 million", 1_200_000, "USD"],
  ["USD 1.2 billion", 1_200_000_000, "USD"],
  ["€3 trillion", 3_000_000_000_000, "EUR"],
  ["$2K", 2_000, "USD"],
  ["GBP 4.5m", 4_500_000, "GBP"],
  ["12.5 B/.", 12.5, "PAB"],
  ["12.5 T$", 12.5, "TOP"],
];

for (const [input, expectedAmount, expectedCode] of cases) {
  assert.equal(currencySelectionPattern.test(input), true, `Filter should match “${input}”`);
  const parsed = parseCurrencyAmount(input, currencies);
  assert.ok(parsed, `Expected “${input}” to parse`);
  assert.equal(parsed.amount, expectedAmount, input);
  assert.equal(parsed.currency.iso_code, expectedCode, input);
}

assert.equal(parseCurrencyAmount("25 BTC", currencies), null);
assert.equal(parseCurrencyAmount("25 cats", currencies), null);
assert.equal(parseCurrencyAmount("12.5 m", currencies)?.currency.iso_code, "TMT");
assert.equal(parseCurrencyAmount("12.5 T", currencies)?.currency.iso_code, "WST");
assert.equal(parseNumber("0.123"), 0.123);
assert.equal(parseNumber("1,000"), 1000);
assert.equal(formatConvertedResult(25, "GBP"), "£25");
assert.equal(formatConvertedResult(25.5, "GBP"), "£25.50");
assert.match(formatConvertedResult(25, "USD"), /USD$/u);

const range = findCurrencyAmounts("$210 to $225", currencies);
assert.deepEqual(
  range.map(({ amount, currency, text }) => [amount, currency.iso_code, text]),
  [
    [210, "USD", "$210"],
    [225, "USD", "$225"],
  ],
);

const sentence = findCurrencyAmounts(
  "Revenue rose from $1.2 million to EUR 2bn, while staffing stayed flat.",
  currencies,
);
assert.deepEqual(
  sentence.map(({ amount, currency, text }) => [amount, currency.iso_code, text]),
  [
    [1_200_000, "USD", "$1.2 million"],
    [2_000_000_000, "EUR", "EUR 2bn"],
  ],
);

console.log(`Passed ${cases.length + 11} parser and formatting tests.`);
