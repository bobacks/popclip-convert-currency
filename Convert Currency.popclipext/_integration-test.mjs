import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { NON_FIAT_CODES, parseCurrencyAmount } from "./parser.ts";

const [currenciesPath, ratePath] = process.argv.slice(2);
if (!currenciesPath || !ratePath) {
  throw new Error("Pass downloaded currencies.json and rate.json paths.");
}

const currencies = JSON.parse(await readFile(currenciesPath, "utf8"));
const fiatCurrencies = currencies.filter(
  (currency) => !NON_FIAT_CODES.has(currency.iso_code),
);
const codesByName = new Map();
for (const currency of fiatCurrencies) {
  const codes = codesByName.get(currency.name) ?? [];
  codes.push(currency.iso_code);
  codesByName.set(currency.name, codes);
}

for (const currency of fiatCurrencies) {
  const byCode = parseCurrencyAmount(`1 ${currency.iso_code}`, currencies);
  assert.equal(byCode?.currency.iso_code, currency.iso_code, currency.iso_code);

  const byName = parseCurrencyAmount(`1 ${currency.name}`, currencies);
  assert.ok(
    codesByName.get(currency.name).includes(byName?.currency.iso_code),
    currency.name,
  );
}

const rate = JSON.parse(await readFile(ratePath, "utf8"));
assert.equal(rate.base, "GBP");
assert.equal(rate.quote, "USD");
assert.equal(typeof rate.rate, "number");

console.log(
  `Verified ${fiatCurrencies.length} fiat currency codes and names; live GBP/USD rate dated ${rate.date}.`,
);
