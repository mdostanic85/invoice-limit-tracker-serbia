import { describe, it, expect } from "vitest";
import {
  getCountryFormDefaults,
  getCountryTaxProfile,
  validateAnnualThreshold,
} from "@/lib/domain/country-tax-rules";

describe("country tax rules", () => {
  it("returns Serbia statutory flat-rate limit", () => {
    const defaults = getCountryFormDefaults("RS");
    expect(defaults.annualThresholdRsd).toBe("6000000");
    expect(defaults.primaryCurrency).toBe("RSD");
    expect(defaults.limitCurrency).toBe("RSD");
  });

  it("returns Argentina Monotributo defaults with category K", () => {
    const defaults = getCountryFormDefaults("AR");
    expect(defaults.primaryCurrency).toBe("ARS");
    expect(defaults.taxLimitTierId).toBe("K");
    expect(defaults.annualThresholdRsd).toBe("108357084.05");
  });

  it("syncs Argentina tier selection to tier limit", () => {
    const defaults = getCountryFormDefaults("AR", "H");
    expect(defaults.annualThresholdRsd).toBe("70113407.00");
    expect(defaults.taxLimitTierId).toBe("H");
  });

  it("rejects threshold above Serbian statutory maximum", () => {
    const result = validateAnnualThreshold("RS", "6000001");
    expect(result.ok).toBe(false);
  });

  it("accepts exact Serbian statutory limit", () => {
    const result = validateAnnualThreshold("RS", "6000000");
    expect(result.ok).toBe(true);
  });

  it("accepts Serbian limit below statutory maximum", () => {
    const result = validateAnnualThreshold("RS", "5500000");
    expect(result.ok).toBe(true);
  });

  it("rejects Argentina threshold that does not match selected tier", () => {
    const result = validateAnnualThreshold("AR", "70113407.00", "H");
    expect(result.ok).toBe(true);

    const bad = validateAnnualThreshold("AR", "60000000", "H");
    expect(bad.ok).toBe(false);
  });

  it("allows custom threshold for countries without statutory limit", () => {
    const profile = getCountryTaxProfile("US");
    expect(profile.customThresholdAllowed).toBe(true);
    const result = validateAnnualThreshold("US", "250000");
    expect(result.ok).toBe(true);
  });
});
