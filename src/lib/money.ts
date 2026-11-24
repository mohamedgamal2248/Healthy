/** "≈ $2.00": the dollar equivalent shown next to every Pi price (prices are set in USD and converted at the live rate). */
export const usdLabel = (usd?: number) => (typeof usd === "number" ? `≈ $${usd.toFixed(2)}` : "");
