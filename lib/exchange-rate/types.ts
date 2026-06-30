import Decimal from "decimal.js";

export type RateSourceType = "NBS_MIDDLE" | "FALLBACK_PRIOR" | "MANUAL_OVERRIDE";

export interface RateResult {
  currency: string;
  requestedDate: string;    // ISO date YYYY-MM-DD
  effectiveDate: string;    // date of actual published list
  middleRate: Decimal;      // as published (e.g. 3294 for HUF 100)
  unit: number;             // NBS "Važi za" — 1 or 100
  ratePerUnit: Decimal;     // normalized per 1 unit = middleRate / unit
  source: RateSourceType;
  sourceUrl: string;
  fetchedAt: Date;
  rawPayload?: unknown;
  isFallback: boolean;
  fallbackReason?: string;
}

export interface ExchangeRateProvider {
  getMiddleRate(params: {
    currency: string;
    date: Date;
  }): Promise<RateResult>;

  getSupportedCurrencies(): string[];
}

export const NBS_MIDDLE_RATE_URL =
  "https://webappcenter.nbs.rs/ExchangeRateWebApp/ExchangeRate/IndexByDate";

export const NBS_LIST_TYPE_ID = 3; // Middle rate list

export const FALLBACK_LOOKBACK_DAYS = 10;

export const SUPPORTED_CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "CAD",
  "AUD",
  "JPY",
  "NOK",
  "SEK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
  "RON",
  "TRY",
  "AED",
  "CNY",
  "INR",
  "BAM",
  "MKD",
  "RUB",
  "ARS",
];
