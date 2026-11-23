/**
 * Healthy runs on Pi MAINNET. Anything other than an explicit "testnet" means mainnet, so a missing variable can never
 * silently enable test payments. Test payments exist only for a separate staging copy that sets ALLOW_TESTNET_PAYMENTS=true.
 */
export const piNetwork = (): "mainnet" | "testnet" => ((process.env.NEXT_PUBLIC_PI_NETWORK ?? "mainnet") === "testnet" ? "testnet" : "mainnet");
export const paymentsAllowed = () => piNetwork() === "mainnet" || process.env.ALLOW_TESTNET_PAYMENTS === "true";
