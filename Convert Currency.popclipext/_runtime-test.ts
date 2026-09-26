import { action } from "./currency.ts";

export async function test(): Promise<string> {
  await (action.code as Function)(
    { text: "100 USD" },
    {
      targetCurrency: "GBP",
      output: "display",
      includeDetails: false,
    },
  );
  return pasteboard.text;
}

export async function testSentence(): Promise<string> {
  await (action.code as Function)(
    { text: "Budget: $210 to $225, plus a €50 fee." },
    {
      targetCurrency: "GBP",
      output: "display",
      includeDetails: false,
    },
  );
  return pasteboard.text;
}
