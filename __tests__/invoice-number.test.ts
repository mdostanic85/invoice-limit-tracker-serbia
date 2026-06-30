import { describe, expect, it } from "vitest";
import { incrementInvoiceNumber, suggestNextInvoiceNumber, resolveSuggestedInvoiceNumber } from "@/lib/utils/invoice-number";

describe("incrementInvoiceNumber", () => {
  it("increments the sequence before a year suffix", () => {
    expect(incrementInvoiceNumber("002 26")).toBe("003 26");
  });

  it("increments 006 26 to 007 26", () => {
    expect(incrementInvoiceNumber("006 26")).toBe("007 26");
  });

  it("increments the trailing sequence in dashed numbers", () => {
    expect(incrementInvoiceNumber("2026-001")).toBe("2026-002");
  });

  it("increments the only numeric group", () => {
    expect(incrementInvoiceNumber("INV-42")).toBe("INV-43");
  });
});

describe("suggestNextInvoiceNumber", () => {
  it("skips numbers that already exist", () => {
    const next = suggestNextInvoiceNumber("002 26", ["002 26", "003 26"]);
    expect(next).toBe("004 26");
  });
});

describe("resolveSuggestedInvoiceNumber", () => {
  it("increments the highest number in the year sequence", () => {
    const next = resolveSuggestedInvoiceNumber(
      ["003 26", "006 26", "005 26"],
      2026,
      ["003 26", "005 26", "006 26"]
    );
    expect(next).toBe("007 26");
  });

  it("increments the latest number in dashed format", () => {
    const next = resolveSuggestedInvoiceNumber(["2026-001", "2026-004"], 2026, [
      "2026-001",
      "2026-004",
    ]);
    expect(next).toBe("2026-005");
  });

  it("starts a new year sequence when none exist yet", () => {
    const next = resolveSuggestedInvoiceNumber([], 2027, ["006 26"]);
    expect(next).toBe("001 27");
  });
});
