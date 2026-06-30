export const INVOICE_CURRENCIES = [
  "RSD",
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "CAD",
  "AUD",
  "ARS",
  "NOK",
  "SEK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
] as const;

export const PLANNING_CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "CAD",
  "AUD",
  "ARS",
  "NOK",
  "SEK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
] as const;

export const FORECAST_CURRENCIES = [
  "RSD",
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "CAD",
  "ARS",
] as const;

export const CLIENT_DEFAULT_CURRENCIES = INVOICE_CURRENCIES;

export const PRIMARY_CURRENCY_OPTIONS = [
  { value: "RSD", label: "RSD — Serbian Dinar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "ARS", label: "ARS — Argentine Peso" },
];

export const COUNTRY_OPTIONS = [
  { value: "RS", label: "Serbia (RS)" },
  { value: "AR", label: "Argentina (AR)" },
  { value: "US", label: "United States (US)" },
  { value: "DE", label: "Germany (DE)" },
  { value: "GB", label: "United Kingdom (GB)" },
];

export const TIMEZONE_OPTIONS = [
  { value: "Europe/Belgrade", label: "Europe/Belgrade (CET/CEST)" },
  { value: "America/Argentina/Buenos_Aires", label: "America/Argentina/Buenos Aires" },
  { value: "UTC", label: "UTC" },
];

export function currencySelectOptions(currencies: readonly string[]) {
  return currencies.map((c) => ({ value: c, label: c }));
}
