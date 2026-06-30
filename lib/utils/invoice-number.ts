function incrementDigitGroup(source: string, groupIndex: number): string {
  const parts = [...source.matchAll(/\d+/g)];
  if (parts.length === 0) return `${source}-2`;

  let targetIndex = groupIndex;
  if (targetIndex < 0 || targetIndex >= parts.length) {
    targetIndex = parts.length - 1;
  }

  const match = parts[targetIndex];
  const digits = match[0];
  const next = parseInt(digits, 10) + 1;
  const padded = String(next).padStart(digits.length, "0");
  const start = match.index ?? 0;
  return source.slice(0, start) + padded + source.slice(start + digits.length);
}

/** Pick which digit group to increment (e.g. 002 26 → first group, 2026-001 → last). */
function pickIncrementGroup(source: string): number {
  const parts = [...source.matchAll(/\d+/g)];
  if (parts.length <= 1) return 0;

  const last = parts[parts.length - 1][0];
  const lastIndex = parts[parts.length - 1].index ?? 0;
  const afterLast = source.slice(lastIndex + last.length).trim();
  const looksLikeYearSuffix =
    afterLast === "" && (last.length === 2 || last.length === 4);

  return looksLikeYearSuffix ? 0 : parts.length - 1;
}

export function incrementInvoiceNumber(source: string): string {
  if (!source?.trim()) return "1";
  return incrementDigitGroup(source, pickIncrementGroup(source));
}

function sequenceValue(invoiceNumber: string): number {
  const parts = [...invoiceNumber.matchAll(/\d+/g)];
  if (parts.length === 0) return 0;
  const groupIndex = pickIncrementGroup(invoiceNumber);
  return parseInt(parts[groupIndex][0], 10);
}

export function pickLatestInvoiceNumberInYear(
  invoiceNumbers: string[],
  year: number
): string | null {
  if (invoiceNumbers.length === 0) return null;

  const yy = String(year).slice(-2);
  const yyyy = String(year);

  const inYear = invoiceNumbers.filter((num) => {
    const trimmed = num.trim();
    if (trimmed.endsWith(` ${yy}`) || trimmed.endsWith(`-${yy}`)) return true;
    if (trimmed.startsWith(`${yyyy}-`) || trimmed.startsWith(`${yyyy}/`)) return true;
    return false;
  });

  const pool = inYear.length > 0 ? inYear : invoiceNumbers;

  return pool.reduce<string | null>((best, current) => {
    if (!best) return current;
    const diff = sequenceValue(current) - sequenceValue(best);
    if (diff !== 0) return diff > 0 ? current : best;
    return current.localeCompare(best) > 0 ? current : best;
  }, null);
}

export function defaultInvoiceNumberSeed(year: number): string {
  const yy = String(year).slice(-2);
  return `000 ${yy}`;
}

export function suggestNextInvoiceNumber(
  source: string,
  existingNumbers: Iterable<string>
): string {
  const taken = new Set(existingNumbers);
  let candidate = incrementInvoiceNumber(source);
  let guard = 0;

  while (taken.has(candidate) && guard < 10_000) {
    candidate = incrementInvoiceNumber(candidate);
    guard += 1;
  }

  return candidate;
}

export function resolveSuggestedInvoiceNumber(
  numbersInYear: string[],
  year: number,
  existingNumbers: Iterable<string>
): string {
  const source =
    pickLatestInvoiceNumberInYear(numbersInYear, year) ?? defaultInvoiceNumberSeed(year);
  return suggestNextInvoiceNumber(source, existingNumbers);
}
