# Convert Currency

Convert individual fiat amounts—or every currency amount in an entire selected sentence—to your chosen currency using the latest available daily exchange rates. All surrounding words and punctuation are preserved.

Created and maintained by Boback Shahsafdari.

## Convert complete selections

Unlike a converter that accepts only one amount, Convert Currency can process every recognised currency value in the selected text at once. It also supports mixed source currencies.

For example:

```text
Sell $225.60, buy $225.63, with a €50 fee.
```

When converting to GBP, the result keeps the sentence intact and replaces all three amounts:

```text
Sell £…, buy £…, with a £… fee.
```

The converted text is displayed in PopClip and copied to the clipboard, or it can replace the original selection according to the extension's settings.

Examples include `£25`, `25 GBP`, `GBP 25`, `25 Pounds Sterling`, `1,234.56 USD`, `1.234,56 EUR`, `50ISK`, `¢1000`, and `62,700 円`.

Magnitude suffixes and words are expanded before conversion. For example, `$2K` means `2,000 USD`, `$1.2 million` means `1,200,000 USD`, and `EUR 3bn` means `3,000,000,000 EUR`. Thousand, million, billion, and trillion forms are supported.

Selections may contain more than one currency amount. The extension converts each recognised amount while preserving the surrounding text, so `$210 to $225` becomes a converted range in the chosen target currency. Mixed-currency sentences are supported too.

Common AED forms such as `Dh 50`, `50 Dhs`, `50 dirham`, and `50 dirhams` are recognised. Common Chinese currency names are also supported, including `日圓`, `台幣`, `美金`, `美元`, `歐元`, `英鎊`, `港幣`, `人民幣`, `人民币`, `韓元`, and `泰銖`.

## Settings

- **Convert to:** Choose a target from the fixed list of three-letter ISO currency codes. Flags are deliberately omitted because currencies do not always map to a single country.
- **Result action:** Display the result in PopClip and copy it simultaneously, copy it without displaying, or replace the selected text.
- **Include rate details:** Add the source amount, exchange rate, and rate date to the result.

You can duplicate the action in PopClip and give each instance a different target currency.

## Currency recognition

All supported fiat currencies can be specified with their three-letter codes. Official English names, plurals, common aliases, and unique currency symbols are also recognised.

Some symbols are shared by several currencies. The following defaults are used:

- `$` → USD
- `£` → GBP
- `¥` → JPY
- `￥` and `円` → JPY
- `元` → CNY
- `₩` → KRW
- `kr` → SEK

Use an explicit code to remove ambiguity, such as `25 CAD`, `25 CNY`, or `25 NOK`. Qualified symbols including `CA$`, `A$`, `HK$`, `NZ$`, `S$`, `R$`, `NT$`, `JP¥`, and `CN¥` are also supported.

The cent sign and the words `cent` or `cents` default to US cents, so `¢1000` is interpreted as `10 USD`.

GBP results use the unambiguous pound sign without repeating the ISO code—for example, `£25` rather than `£25 GBP`. Currency codes are retained where a displayed symbol may be ambiguous.

## Known limitations

- Cryptocurrencies, precious metals, and Special Drawing Rights are not supported.
- Exchange-rate availability depends on Frankfurter's central-bank data. Frankfurter currently lists KPW but provides no current rate, so conversions to or from KPW are unavailable.
- Three-letter ISO codes work regardless of language. Translated currency names are limited to the aliases explicitly documented above; use an ISO code when a local-language name is not recognised.
- Some currency symbols are shared by several currencies and therefore use the documented defaults. Use an explicit ISO code whenever the symbol could be ambiguous.

## Rates and privacy

Rates and currency metadata come from the free, open-source [Frankfurter API](https://frankfurter.dev/), which aggregates daily reference rates from central banks.

Currency metadata is downloaded once and kept in memory while PopClip has the extension loaded. Subsequent conversions normally require only the exchange-rate request.

The selected text is parsed locally and is not transmitted. Requests to Frankfurter contain only the detected source and configured target ISO currency codes. Rates are indicative reference rates and may differ from the rate offered by a bank, card provider, or exchange service.

## Changelog

- 2026-08-17: Initial release.
