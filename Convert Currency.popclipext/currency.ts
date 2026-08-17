import axios from "axios";
import { formatConvertedResult } from "./format.ts";
import {
  NON_FIAT_CODES,
  currencySelectionPattern,
  findCurrencyAmounts,
  parseCurrencyAmount,
  type CurrencyInfo,
  type ParsedAmount,
} from "./parser.ts";

interface RateResponse {
  date: string;
  base: string;
  quote: string;
  rate: number;
}

interface RateInfo {
  rate: number;
  date: string;
}

let cachedCurrencies: CurrencyInfo[] | undefined;

function formatPlain(amount: number): string {
  return Intl.NumberFormat(undefined, {
    useGrouping: true,
    maximumFractionDigits: 6,
  }).format(amount);
}

async function loadCurrencies(): Promise<CurrencyInfo[]> {
  if (cachedCurrencies) return cachedCurrencies;

  const response = await axios.get<CurrencyInfo[]>(
    "https://api.frankfurter.dev/v2/currencies",
  );
  cachedCurrencies = response.data.filter(
    (currency) => !NON_FIAT_CODES.has(currency.iso_code),
  );
  return cachedCurrencies;
}

function deliverResult(result: string, output: string): void {
  switch (output) {
    case "copy":
      popclip.copyText(result);
      break;
    case "replace":
      popclip.pasteText(result);
      break;
    default:
      pasteboard.text = result;
      popclip.showText(result);
  }
}

export const action: Action = {
  title: "Convert Currency",
  requirements: ["text"],
  regex: currencySelectionPattern,
  code: async (input, options) => {
    let currencies: CurrencyInfo[];
    try {
      currencies = await loadCurrencies();
    } catch {
      popclip.showText(
        "Could not retrieve exchange-rate data. Check your internet connection and try again.",
      );
      return;
    }

    const parsed = parseCurrencyAmount(input.text, currencies);
    const matches = parsed ? [] : findCurrencyAmounts(input.text, currencies);
    if (!parsed && matches.length === 0) {
      popclip.showText(
        "Currency not recognised. Try an ISO code, for example 25 GBP or USD 10.50.",
      );
      return;
    }

    const targetCode = String(options.targetCurrency ?? "GBP").trim().toUpperCase();
    const target = currencies.find((currency) => currency.iso_code === targetCode);
    if (!target) {
      popclip.showText(`“${targetCode}” is not a supported fiat currency code.`);
      return;
    }

    const amounts: ParsedAmount[] = parsed ? [parsed] : matches;
    const sourceCodes = [...new Set(amounts.map((amount) => amount.currency.iso_code))];
    const rates = new Map<string, RateInfo>();
    rates.set(targetCode, { rate: 1, date: "" });

    try {
      await Promise.all(
        sourceCodes
          .filter((sourceCode) => sourceCode !== targetCode)
          .map(async (sourceCode) => {
            const response = await axios.get<RateResponse>(
              `https://api.frankfurter.dev/v2/rate/${sourceCode}/${targetCode}`,
            );
            rates.set(sourceCode, {
              rate: response.data.rate,
              date: response.data.date,
            });
          }),
      );
    } catch {
      popclip.showText(`A current conversion rate to ${targetCode} is unavailable.`);
      return;
    }

    let result: string;
    if (parsed) {
      const sourceCode = parsed.currency.iso_code;
      const rateInfo = rates.get(sourceCode)!;
      result = formatConvertedResult(parsed.amount * rateInfo.rate, targetCode);
      if (Boolean(options.includeDetails)) {
        const source = `${formatPlain(parsed.amount)} ${sourceCode}`;
        result += sourceCode === targetCode
          ? ` (from ${source}; same currency)`
          : ` (from ${source}; rate ${formatPlain(rateInfo.rate)}; ${rateInfo.date})`;
      }
    } else {
      let cursor = 0;
      const pieces: string[] = [];
      for (const match of matches) {
        const rateInfo = rates.get(match.currency.iso_code)!;
        pieces.push(input.text.slice(cursor, match.start));
        pieces.push(formatConvertedResult(match.amount * rateInfo.rate, targetCode));
        cursor = match.end;
      }
      pieces.push(input.text.slice(cursor));
      result = pieces.join("");

      if (Boolean(options.includeDetails)) {
        const details = sourceCodes.map((sourceCode) => {
          const rateInfo = rates.get(sourceCode)!;
          return sourceCode === targetCode
            ? `${sourceCode}: same currency`
            : `${sourceCode}→${targetCode}: ${formatPlain(rateInfo.rate)}; ${rateInfo.date}`;
        });
        result += ` (rates: ${details.join("; ")})`;
      }
    }

    deliverResult(result, String(options.output ?? "display"));
  },
};
