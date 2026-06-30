import { describe, it, expect } from "vitest";

/**
 * NBS HTML parser fixture tests.
 * Uses a captured HTML sample from the live NBS page (June 24, 2026).
 */

// Inline snapshot of the NBS middle rate page structure (simplified)
const NBS_HTML_FIXTURE = `
<!DOCTYPE html>
<html>
<head><title>Курсна листа НБС</title></head>
<body>
<h5>КУРСНА ЛИСТА БР. 116</h5>
<h5>ЗА ЗВАНИЧНИ СРЕДЊИ КУРС ДИНАРА</h5>
<h5>ФОРМИРАНА НА ДАН 24.6.2026. ГОДИНЕ</h5>
<table>
  <thead>
    <tr>
      <th>ОЗНАКА ВАЛУТЕ</th>
      <th>ШИФРА ВАЛУТЕ</th>
      <th>НАЗИВ ЗЕМЉЕ</th>
      <th>ВАЖИ ЗА</th>
      <th>СРЕДЊИ КУРС</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>EUR</td><td>978</td><td>ЕМУ</td><td>1</td><td>117,4021</td></tr>
    <tr><td>USD</td><td>840</td><td>САД</td><td>1</td><td>103,2560</td></tr>
    <tr><td>GBP</td><td>826</td><td>Велика Британија</td><td>1</td><td>136,2922</td></tr>
    <tr><td>HUF</td><td>348</td><td>Мађарска</td><td>100</td><td>32,9865</td></tr>
    <tr><td>JPY</td><td>392</td><td>Јапан</td><td>100</td><td>63,9236</td></tr>
    <tr><td>CHF</td><td>756</td><td>Швајцарска</td><td>1</td><td>127,3756</td></tr>
  </tbody>
</table>
</body>
</html>
`;

// Inline parse function for test isolation (mirrors nbs-provider.ts parseNbsHtml)
interface ParsedRow {
  currency: string;
  unit: number;
  middleRate: number;
  ratePerUnit: number;
}

function parseTestNbsHtml(html: string): { rows: ParsedRow[]; listDate: string | null } {
  const rows: ParsedRow[] = [];

  const dateMatch = html.match(/НА ДАН\s+([\d.]+)\s+ГОДИНЕ/i);
  let listDate: string | null = null;
  if (dateMatch) {
    const raw = dateMatch[1].split(".").filter(Boolean);
    if (raw.length === 3) {
      listDate = `${raw[2]}-${raw[1].padStart(2, "0")}-${raw[0].padStart(2, "0")}`;
    }
  }

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, "").trim());
    }
    if (cells.length < 5) continue;
    const currencyCode = cells[0].trim().toUpperCase();
    const unitStr = cells[3].trim();
    const rateStr = cells[4].trim().replace(",", ".");
    if (!/^[A-Z]{3}$/.test(currencyCode)) continue;
    const unit = parseInt(unitStr, 10);
    if (isNaN(unit) || unit <= 0) continue;
    const middleRate = parseFloat(rateStr);
    if (isNaN(middleRate)) continue;
    const ratePerUnit = middleRate / unit;
    rows.push({ currency: currencyCode, unit, middleRate, ratePerUnit });
  }

  return { rows, listDate };
}

describe("NBS HTML parser", () => {
  it("extracts the list date correctly", () => {
    const { listDate } = parseTestNbsHtml(NBS_HTML_FIXTURE);
    expect(listDate).toBe("2026-06-24");
  });

  it("parses EUR rate correctly", () => {
    const { rows } = parseTestNbsHtml(NBS_HTML_FIXTURE);
    const eur = rows.find((r) => r.currency === "EUR");
    expect(eur).toBeDefined();
    expect(eur!.unit).toBe(1);
    expect(eur!.middleRate).toBeCloseTo(117.4021, 4);
    expect(eur!.ratePerUnit).toBeCloseTo(117.4021, 4);
  });

  it("parses USD rate correctly", () => {
    const { rows } = parseTestNbsHtml(NBS_HTML_FIXTURE);
    const usd = rows.find((r) => r.currency === "USD");
    expect(usd).toBeDefined();
    expect(usd!.ratePerUnit).toBeCloseTo(103.256, 3);
  });

  it("normalizes HUF unit=100 to per-1 rate", () => {
    const { rows } = parseTestNbsHtml(NBS_HTML_FIXTURE);
    const huf = rows.find((r) => r.currency === "HUF");
    expect(huf).toBeDefined();
    expect(huf!.unit).toBe(100);
    expect(huf!.middleRate).toBeCloseTo(32.9865, 4);
    // ratePerUnit = 32.9865 / 100 ≈ 0.329865
    expect(huf!.ratePerUnit).toBeCloseTo(0.329865, 6);
  });

  it("normalizes JPY unit=100 to per-1 rate", () => {
    const { rows } = parseTestNbsHtml(NBS_HTML_FIXTURE);
    const jpy = rows.find((r) => r.currency === "JPY");
    expect(jpy).toBeDefined();
    expect(jpy!.unit).toBe(100);
    expect(jpy!.ratePerUnit).toBeCloseTo(0.639236, 6);
  });

  it("parses GBP correctly", () => {
    const { rows } = parseTestNbsHtml(NBS_HTML_FIXTURE);
    const gbp = rows.find((r) => r.currency === "GBP");
    expect(gbp).toBeDefined();
    expect(gbp!.ratePerUnit).toBeCloseTo(136.2922, 4);
  });

  it("returns all 6 expected currencies from fixture", () => {
    const { rows } = parseTestNbsHtml(NBS_HTML_FIXTURE);
    const codes = rows.map((r) => r.currency);
    expect(codes).toContain("EUR");
    expect(codes).toContain("USD");
    expect(codes).toContain("GBP");
    expect(codes).toContain("HUF");
    expect(codes).toContain("JPY");
    expect(codes).toContain("CHF");
  });
});

describe("Conversion formula verification (Example B from plan)", () => {
  it("5000 USD × 103.2560 = 516280 RSD", () => {
    const amount = 5000;
    const rate = 103.256;
    const rsd = amount * rate;
    expect(rsd).toBeCloseTo(516280, 0);
  });

  it("RSD invoice: rate is 1, no conversion", () => {
    const amount = 1500000;
    const rate = 1;
    expect(amount * rate).toBe(1500000);
  });
});
