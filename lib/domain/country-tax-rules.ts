/**
 * Statutory annual revenue limits by country / tax regime.
 * Values are informational defaults — not legal advice. Verify with a qualified advisor.
 */

export interface TaxLimitTier {
  id: string;
  label: string;
  annualLimit: string;
  description?: string;
}

export interface CountryTaxProfile {
  countryCode: string;
  name: string;
  primaryCurrency: string;
  defaultTimezone: string;
  limitCurrency: string;
  regimeName: string;
  legalReference: string;
  effectiveFrom: string;
  /** When true, threshold must match a tier or stay within statutory maximum */
  hasStatutoryLimit: boolean;
  /** When true, user picks from tiers instead of typing a custom amount */
  useTierSelector: boolean;
  tiers: TaxLimitTier[];
  defaultTierId: string;
  /** Custom threshold allowed (no statutory cap) */
  customThresholdAllowed: boolean;
}

/** Serbia — flat-rate (paušal) gross revenue ceiling, 2024–2026 cycle */
const RS_PROFILE: CountryTaxProfile = {
  countryCode: "RS",
  name: "Serbia",
  primaryCurrency: "RSD",
  defaultTimezone: "Europe/Belgrade",
  limitCurrency: "RSD",
  regimeName: "Flat-rate taxpayer (paušal)",
  legalReference:
    "Serbian flat-rate regime annual gross revenue ceiling (6,000,000 RSD). Verify with your accountant.",
  effectiveFrom: "2024-01-01",
  hasStatutoryLimit: true,
  useTierSelector: false,
  tiers: [
    {
      id: "PAUSAL_MAX",
      label: "Statutory maximum",
      annualLimit: "6000000",
      description: "6,000,000 RSD gross invoiced revenue",
    },
  ],
  defaultTierId: "PAUSAL_MAX",
  customThresholdAllowed: true,
};

/**
 * Argentina — Monotributo gross income limits (ARCA).
 * Effective from 1 Feb 2026 (semiannual update).
 */
const AR_MONOTRIBUTO_TIERS: TaxLimitTier[] = [
  { id: "A", label: "Category A", annualLimit: "10277988.13" },
  { id: "B", label: "Category B", annualLimit: "15058447.71" },
  { id: "C", label: "Category C", annualLimit: "21113865.00" },
  { id: "D", label: "Category D", annualLimit: "26212853.00" },
  { id: "E", label: "Category E", annualLimit: "30840480.00" },
  { id: "F", label: "Category F", annualLimit: "38624048.00" },
  { id: "G", label: "Category G", annualLimit: "46277093.00" },
  { id: "H", label: "Category H", annualLimit: "70113407.00" },
  { id: "I", label: "Category I", annualLimit: "78479216.00" },
  { id: "J", label: "Category J", annualLimit: "89872640.00" },
  {
    id: "K",
    label: "Category K (maximum)",
    annualLimit: "108357084.05",
    description: "Highest Monotributo category — gross income ceiling",
  },
];

const AR_PROFILE: CountryTaxProfile = {
  countryCode: "AR",
  name: "Argentina",
  primaryCurrency: "ARS",
  defaultTimezone: "America/Argentina/Buenos_Aires",
  limitCurrency: "ARS",
  regimeName: "Monotributo",
  legalReference:
    "ARCA Monotributo annual gross income limits (updated Feb 2026). Select your registered category.",
  effectiveFrom: "2026-02-01",
  hasStatutoryLimit: true,
  useTierSelector: true,
  tiers: AR_MONOTRIBUTO_TIERS,
  defaultTierId: "K",
  customThresholdAllowed: false,
};

const GENERIC_PROFILE = (countryCode: string, name: string): CountryTaxProfile => ({
  countryCode,
  name,
  primaryCurrency: "USD",
  defaultTimezone: "UTC",
  limitCurrency: "USD",
  regimeName: "Custom annual target",
  legalReference: "No statutory limit configured for this country. Set your own planning threshold.",
  effectiveFrom: "2026-01-01",
  hasStatutoryLimit: false,
  useTierSelector: false,
  tiers: [],
  defaultTierId: "",
  customThresholdAllowed: true,
});

const COUNTRY_PROFILES: Record<string, CountryTaxProfile> = {
  RS: RS_PROFILE,
  AR: AR_PROFILE,
  US: { ...GENERIC_PROFILE("US", "United States"), primaryCurrency: "USD", limitCurrency: "USD" },
  DE: { ...GENERIC_PROFILE("DE", "Germany"), primaryCurrency: "EUR", limitCurrency: "EUR" },
  GB: { ...GENERIC_PROFILE("GB", "United Kingdom"), primaryCurrency: "GBP", limitCurrency: "GBP" },
};

export function getCountryTaxProfile(countryCode: string): CountryTaxProfile {
  return COUNTRY_PROFILES[countryCode.toUpperCase()] ?? GENERIC_PROFILE(countryCode, countryCode);
}

export function getLimitCurrency(countryCode: string): string {
  return getCountryTaxProfile(countryCode).limitCurrency;
}

export function getTaxTier(profile: CountryTaxProfile, tierId?: string | null): TaxLimitTier | null {
  if (!profile.tiers.length) return null;
  const id = tierId ?? profile.defaultTierId;
  return profile.tiers.find((t) => t.id === id) ?? profile.tiers[profile.tiers.length - 1];
}

export function getCountryFormDefaults(countryCode: string, tierId?: string | null) {
  const profile = getCountryTaxProfile(countryCode);
  const tier = getTaxTier(profile, tierId ?? profile.defaultTierId);

  return {
    countryCode: profile.countryCode,
    primaryCurrency: profile.primaryCurrency,
    timezone: profile.defaultTimezone,
    taxLimitTierId: tier?.id ?? null,
    annualThresholdRsd: tier?.annualLimit ?? "1000000",
    limitCurrency: profile.limitCurrency,
    profile,
  };
}

export function getStatutoryMaximum(profile: CountryTaxProfile): string | null {
  if (!profile.hasStatutoryLimit || !profile.tiers.length) return null;
  const limits = profile.tiers.map((t) => parseFloat(t.annualLimit));
  return String(Math.max(...limits));
}

export type ThresholdValidationResult =
  | { ok: true; tierId: string | null }
  | { ok: false; message: string };

export function validateAnnualThreshold(
  countryCode: string,
  amount: string,
  tierId?: string | null
): ThresholdValidationResult {
  const profile = getCountryTaxProfile(countryCode);
  const value = parseFloat(amount);

  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, message: "Threshold must be a positive number" };
  }

  if (!profile.hasStatutoryLimit) {
    return { ok: true, tierId: tierId ?? null };
  }

  const max = getStatutoryMaximum(profile);
  if (max && value > parseFloat(max) + 0.0001) {
    return {
      ok: false,
      message: `Exceeds the statutory maximum of ${max} ${profile.limitCurrency} for ${profile.regimeName}`,
    };
  }

  if (profile.useTierSelector) {
    const tier = profile.tiers.find((t) => t.id === tierId);
    if (!tier) {
      return { ok: false, message: "Select a valid tax category" };
    }
    const tierLimit = parseFloat(tier.annualLimit);
    if (Math.abs(value - tierLimit) > 0.01) {
      return {
        ok: false,
        message: `${tier.label} limit is ${tier.annualLimit} ${profile.limitCurrency}`,
      };
    }
    return { ok: true, tierId: tier.id };
  }

  // Planning threshold may be set below the statutory ceiling
  const statutory = profile.tiers[0];
  return { ok: true, tierId: statutory?.id ?? tierId ?? null };
}

/**
 * Amount that counts toward the annual limit for an invoice.
 * RSD limits use converted rsdAmount; local-currency limits use originalAmount when currencies match.
 */
export function getInvoiceLimitAmount(
  invoice: { rsdAmount: string; originalAmount: string; currency: string },
  limitCurrency: string
): string {
  if (limitCurrency === "RSD") {
    return invoice.rsdAmount;
  }
  if (invoice.currency === limitCurrency) {
    return invoice.originalAmount;
  }
  return invoice.rsdAmount;
}

export function getForecastLimitAmount(
  entry: { estimatedRsdAmount: string; originalAmount: string; currency: string },
  limitCurrency: string
): string {
  if (limitCurrency === "RSD") {
    return entry.estimatedRsdAmount;
  }
  if (entry.currency === limitCurrency) {
    return entry.originalAmount;
  }
  return entry.estimatedRsdAmount;
}
