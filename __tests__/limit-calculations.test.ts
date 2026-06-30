import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import {
  computeLimitStatus,
  computeProjection,
  expandForecastOccurrences,
  groupByMonth,
  isEligible,
  wouldExceedLimit,
  getThresholdState,
  type InvoiceSummary,
  type ForecastOccurrence,
} from "../lib/domain/limit-calculations";

// Helper to create a minimal InvoiceSummary
function makeInvoice(overrides: Partial<InvoiceSummary> = {}): InvoiceSummary {
  return {
    id: "inv-1",
    rsdAmount: "500000",
    issueDate: new Date("2026-03-15"),
    paymentDate: null,
    status: "ISSUED",
    includeInLimit: true,
    currency: "RSD",
    originalAmount: "500000",
    clientId: "client-1",
    invoiceNumber: "2026-001",
    ...overrides,
  };
}

describe("isEligible", () => {
  it("counts ISSUED invoices in the correct year by issue date", () => {
    const inv = makeInvoice({ issueDate: new Date("2026-06-01") });
    expect(isEligible(inv, "ISSUE_DATE", 2026)).toBe(true);
  });

  it("excludes DRAFT invoices", () => {
    const inv = makeInvoice({ status: "DRAFT" });
    expect(isEligible(inv, "ISSUE_DATE", 2026)).toBe(false);
  });

  it("excludes CANCELLED invoices", () => {
    const inv = makeInvoice({ status: "CANCELLED" });
    expect(isEligible(inv, "ISSUE_DATE", 2026)).toBe(false);
  });

  it("excludes invoices where includeInLimit is false", () => {
    const inv = makeInvoice({ includeInLimit: false });
    expect(isEligible(inv, "ISSUE_DATE", 2026)).toBe(false);
  });

  it("excludes invoices in wrong year", () => {
    const inv = makeInvoice({ issueDate: new Date("2025-12-31") });
    expect(isEligible(inv, "ISSUE_DATE", 2026)).toBe(false);
  });

  it("uses payment date in PAYMENT_DATE mode", () => {
    const inv = makeInvoice({
      issueDate: new Date("2025-12-28"),
      paymentDate: new Date("2026-01-10"),
    });
    expect(isEligible(inv, "PAYMENT_DATE", 2026)).toBe(true);
    expect(isEligible(inv, "ISSUE_DATE", 2026)).toBe(false);
  });

  it("excludes payment-date mode invoice without payment date", () => {
    const inv = makeInvoice({ paymentDate: null });
    expect(isEligible(inv, "PAYMENT_DATE", 2026)).toBe(false);
  });
});

describe("computeLimitStatus", () => {
  const threshold = "6000000";

  it("correctly sums eligible invoices", () => {
    const invoices = [
      makeInvoice({ id: "1", rsdAmount: "1000000", issueDate: new Date("2026-01-15") }),
      makeInvoice({ id: "2", rsdAmount: "2000000", issueDate: new Date("2026-03-20") }),
      makeInvoice({ id: "3", rsdAmount: "500000", issueDate: new Date("2026-06-24"), status: "PAID" }),
    ];

    const result = computeLimitStatus(invoices, "ISSUE_DATE", 2026, threshold);
    expect(result.actualTotal.toString()).toBe("3500000");
    expect(result.remaining.toString()).toBe("2500000");
    expect(result.percentUsed).toBeCloseTo(58.33, 1);
    expect(result.thresholdState).toBe("neutral");
  });

  it("excludes cancelled invoices", () => {
    const invoices = [
      makeInvoice({ id: "1", rsdAmount: "1000000", issueDate: new Date("2026-01-15") }),
      makeInvoice({ id: "2", rsdAmount: "999999", issueDate: new Date("2026-01-15"), status: "CANCELLED" }),
    ];
    const result = computeLimitStatus(invoices, "ISSUE_DATE", 2026, threshold);
    expect(result.actualTotal.toString()).toBe("1000000");
  });

  it("shows exceeded state when over threshold", () => {
    const invoices = [
      makeInvoice({ id: "1", rsdAmount: "6100000", issueDate: new Date("2026-06-01") }),
    ];
    const result = computeLimitStatus(invoices, "ISSUE_DATE", 2026, threshold);
    expect(result.thresholdState).toBe("exceeded");
    expect(result.remaining.toString()).toBe("0");
  });

  it("counts excluded invoices in payment-date mode without payment date", () => {
    const invoices = [
      makeInvoice({ id: "1", rsdAmount: "500000", issueDate: new Date("2026-01-10"), paymentDate: null }),
    ];
    const result = computeLimitStatus(invoices, "PAYMENT_DATE", 2026, threshold);
    expect(result.actualTotal.toString()).toBe("0");
    expect(result.excludedCount).toBe(1);
  });
});

describe("getThresholdState", () => {
  it("neutral below 80%", () => expect(getThresholdState(79.9)).toBe("neutral"));
  it("warning at 80%", () => expect(getThresholdState(80)).toBe("warning"));
  it("high_warning at 90%", () => expect(getThresholdState(90)).toBe("high_warning"));
  it("exceeded at 100%", () => expect(getThresholdState(100)).toBe("exceeded"));
  it("exceeded above 100%", () => expect(getThresholdState(115)).toBe("exceeded"));
});

describe("wouldExceedLimit", () => {
  it("detects overage correctly", () => {
    const result = wouldExceedLimit(
      new Decimal("5850000"),
      new Decimal("250000"),
      new Decimal("6000000")
    );
    expect(result.exceeds).toBe(true);
    expect(result.overage.toString()).toBe("100000");
    expect(result.newTotal.toString()).toBe("6100000");
  });

  it("no overage when under threshold", () => {
    const result = wouldExceedLimit(
      new Decimal("1000000"),
      new Decimal("500000"),
      new Decimal("6000000")
    );
    expect(result.exceeds).toBe(false);
    expect(result.overage.toString()).toBe("0");
  });
});

describe("expandForecastOccurrences", () => {
  const baseForecast = {
    id: "f-1",
    clientId: "c-1",
    expectedDate: new Date("2026-01-15"),
    originalAmount: "1000",
    currency: "EUR",
    estimatedRsdAmount: "117400",
    scenario: "EXPECTED",
    recurrence: "ONE_TIME" as const,
    recurrenceEndDate: null,
    planningRateLabel: "NBS estimate",
    status: "ACTIVE",
  };

  it("returns one occurrence for ONE_TIME", () => {
    const result = expandForecastOccurrences(baseForecast, 2026);
    expect(result).toHaveLength(1);
    expect(result[0].expectedDate.getFullYear()).toBe(2026);
  });

  it("returns no occurrences for cancelled entry", () => {
    const result = expandForecastOccurrences({ ...baseForecast, status: "CANCELLED" }, 2026);
    expect(result).toHaveLength(0);
  });

  it("returns 12 occurrences for MONTHLY recurrence spanning full year", () => {
    const monthly = {
      ...baseForecast,
      recurrence: "MONTHLY" as const,
      recurrenceEndDate: new Date("2026-12-31"),
    };
    const result = expandForecastOccurrences(monthly, 2026);
    expect(result.length).toBeGreaterThanOrEqual(11);
    expect(result.length).toBeLessThanOrEqual(12);
  });

  it("returns 4 occurrences for QUARTERLY recurrence spanning full year", () => {
    const quarterly = {
      ...baseForecast,
      recurrence: "QUARTERLY" as const,
      recurrenceEndDate: new Date("2026-12-31"),
    };
    const result = expandForecastOccurrences(quarterly, 2026);
    expect(result).toHaveLength(4);
  });

  it("excludes occurrence for ONE_TIME in wrong year", () => {
    const next = { ...baseForecast, expectedDate: new Date("2027-01-15") };
    const result = expandForecastOccurrences(next, 2026);
    expect(result).toHaveLength(0);
  });
});

describe("groupByMonth", () => {
  it("returns 12 month slots", () => {
    const invoices = [
      makeInvoice({ rsdAmount: "1000000", issueDate: new Date("2026-03-15") }),
      makeInvoice({ id: "2", rsdAmount: "500000", issueDate: new Date("2026-03-28") }),
    ];
    const result = groupByMonth(invoices, "ISSUE_DATE", 2026);
    expect(result).toHaveLength(12);
    const march = result.find((m) => m.month === "2026-03");
    expect(march?.actual).toBe(1500000);
    const jan = result.find((m) => m.month === "2026-01");
    expect(jan?.actual).toBe(0);
  });
});

describe("computeProjection crossing month", () => {
  it("identifies the crossing month correctly", () => {
    // 5M actual in Jan, 1.5M forecast in Feb → crosses in Feb
    const invoices = [
      makeInvoice({ id: "1", rsdAmount: "5000000", issueDate: new Date("2026-01-15") }),
    ];
    const forecasts: ForecastOccurrence[] = [
      {
        forecastId: "f1",
        clientId: null,
        expectedDate: new Date("2026-02-01"),
        estimatedRsdAmount: "1500000",
        scenario: "EXPECTED",
        currency: "RSD",
        originalAmount: "1500000",
        planningRateLabel: "RSD",
      },
    ];
    const result = computeProjection(
      invoices,
      forecasts,
      "ISSUE_DATE",
      2026,
      "6000000",
      "EXPECTED"
    );
    expect(result.crossingMonth).toBe("2026-02");
    expect(result.projectedTotal.toString()).toBe("6500000");
  });
});
