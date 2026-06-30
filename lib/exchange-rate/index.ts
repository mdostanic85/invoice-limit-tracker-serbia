/**
 * Exchange rate provider singleton.
 * The NbsHtmlExchangeRateProvider is wrapped with DB caching.
 * To swap to a different provider (e.g. official NBS API), update this module only.
 */

export { NbsHtmlExchangeRateProvider } from "./nbs-provider";
export type { ExchangeRateProvider, RateResult, RateSourceType } from "./types";
export {
  SUPPORTED_CURRENCIES,
  NBS_LIST_TYPE_ID,
  FALLBACK_LOOKBACK_DAYS,
} from "./types";

import { NbsHtmlExchangeRateProvider } from "./nbs-provider";

let _provider: NbsHtmlExchangeRateProvider | null = null;

export function getExchangeRateProvider(): NbsHtmlExchangeRateProvider {
  if (!_provider) {
    _provider = new NbsHtmlExchangeRateProvider();
  }
  return _provider;
}
