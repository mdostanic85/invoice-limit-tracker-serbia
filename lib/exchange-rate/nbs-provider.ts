/**
 * NBS HTML Exchange Rate Provider
 *
 * Fetches the official NBS middle exchange rate list by date.
 * URL: https://webappcenter.nbs.rs/ExchangeRateWebApp/ExchangeRate/IndexByDate?isSearchExecuted=true&Date=DD.MM.YYYY.&ExchangeRateListTypeID=3
 *
 * Implements 3-retry with exponential backoff and 10-day backward fallback.
 */

import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import {
  ExchangeRateProvider,
  RateResult,
  NBS_MIDDLE_RATE_URL,
  NBS_LIST_TYPE_ID,
  FALLBACK_LOOKBACK_DAYS,
  SUPPORTED_CURRENCIES,
} from "./types";

function formatNbsDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}.${m}.${y}.`;
}

function toIsoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function buildNbsUrl(date: Date): string {
  return `${NBS_MIDDLE_RATE_URL}?isSearchExecuted=true&Date=${formatNbsDate(date)}&ExchangeRateListTypeID=${NBS_LIST_TYPE_ID}`;
}

interface ParsedRow {
  currency: string;
  unit: number;
  middleRate: Decimal;
  ratePerUnit: Decimal;
}

/**
 * Parse the HTML table returned by the NBS middle rate page.
 * The table has columns: currency code | currency number | country name | unit | middle rate
 * We only care about columns 0 (code), 3 (unit), 4 (middle rate).
 */
function parseNbsHtml(html: string): { rows: ParsedRow[]; listDate: string | null } {
  const rows: ParsedRow[] = [];

  // Extract the list date from the heading text, e.g. "ФОРМИРАНА НА ДАН 24.6.2026. ГОДИНЕ"
  const dateMatch = html.match(/НА ДАН\s+([\d.]+)\s+ГОДИНЕ/i);
  let listDate: string | null = null;
  if (dateMatch) {
    const parts = dateMatch[1].replace(/\./g, "").match(/(\d+)(\d{2})(\d{4})/);
    if (parts) {
      listDate = `${parts[3]}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
    } else {
      // Try alternative: "24.6.2026"
      const raw = dateMatch[1].split(".").filter(Boolean);
      if (raw.length === 3) {
        listDate = `${raw[2]}-${raw[1].padStart(2, "0")}-${raw[0].padStart(2, "0")}`;
      }
    }
  }

  // Match all <tr> rows — each data row has 5 <td> cells
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
    const unitStr = cells[3].trim().replace(/\s/g, "");
    const rateStr = cells[4].trim().replace(/\s/g, "").replace(",", ".");

    if (!currencyCode || !unitStr || !rateStr) continue;
    if (!/^[A-Z]{3}$/.test(currencyCode)) continue;

    const unit = parseInt(unitStr, 10);
    if (isNaN(unit) || unit <= 0) continue;

    let middleRate: Decimal;
    try {
      middleRate = new Decimal(rateStr);
    } catch {
      continue;
    }

    const ratePerUnit = middleRate.div(unit);
    rows.push({ currency: currencyCode, unit, middleRate, ratePerUnit });
  }

  return { rows, listDate };
}

async function fetchWithRetry(url: string, maxAttempts = 3): Promise<string> {
  const delays = [1000, 3000, 9000];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "Accept-Language": "en-US,en;q=0.9" },
        next: { revalidate: 0 }, // always fresh from server
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from NBS`);
      }

      return await res.text();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
    }
  }

  throw lastError ?? new Error("NBS fetch failed after all retries");
}

/**
 * Fetch rates for a single date from NBS and store all parsed rows in cache.
 * Returns the parsed rows for the given date.
 */
async function fetchAndCacheDate(date: Date): Promise<ParsedRow[] | null> {
  const url = buildNbsUrl(date);
  const rateDate = toIsoDate(date);

  let html: string;
  try {
    html = await fetchWithRetry(url);
  } catch {
    return null;
  }

  const { rows, listDate } = parseNbsHtml(html);

  if (rows.length === 0) {
    return null; // No publication for this date
  }

  const effectiveDateStr = listDate ?? rateDate;
  const effectiveDate = new Date(effectiveDateStr);

  // Persist all rows to cache in a single transaction
  await Promise.all(
    rows.map((row) =>
      prisma.exchangeRateCache.upsert({
        where: {
          currency_rateDate_listTypeId: {
            currency: row.currency,
            rateDate: new Date(rateDate),
            listTypeId: NBS_LIST_TYPE_ID,
          },
        },
        update: {
          effectiveDate,
          middleRate: row.middleRate.toFixed(6),
          unit: row.unit,
          ratePerUnit: row.ratePerUnit.toFixed(6),
          sourceUrl: url,
          fetchedAt: new Date(),
        },
        create: {
          currency: row.currency,
          rateDate: new Date(rateDate),
          effectiveDate,
          middleRate: row.middleRate.toFixed(6),
          unit: row.unit,
          ratePerUnit: row.ratePerUnit.toFixed(6),
          sourceUrl: url,
          listTypeId: NBS_LIST_TYPE_ID,
          fetchedAt: new Date(),
        },
      })
    )
  );

  return rows;
}

export class NbsHtmlExchangeRateProvider implements ExchangeRateProvider {
  getSupportedCurrencies(): string[] {
    return SUPPORTED_CURRENCIES;
  }

  async getMiddleRate(params: {
    currency: string;
    date: Date;
  }): Promise<RateResult> {
    const { currency, date } = params;
    const requestedDateStr = toIsoDate(date);

    // 1. Check DB cache for exact date
    const cached = await prisma.exchangeRateCache.findUnique({
      where: {
        currency_rateDate_listTypeId: {
          currency,
          rateDate: new Date(requestedDateStr),
          listTypeId: NBS_LIST_TYPE_ID,
        },
      },
    });

    if (cached) {
      return {
        currency,
        requestedDate: requestedDateStr,
        effectiveDate: toIsoDate(cached.effectiveDate),
        middleRate: new Decimal(cached.middleRate.toString()),
        unit: cached.unit,
        ratePerUnit: new Decimal(cached.ratePerUnit.toString()),
        source: cached.isFallback ? "FALLBACK_PRIOR" : "NBS_MIDDLE",
        sourceUrl: cached.sourceUrl,
        fetchedAt: cached.fetchedAt,
        isFallback: cached.isFallback,
        fallbackReason: cached.fallbackReason ?? undefined,
      };
    }

    // 2. Fetch from NBS for exact date
    const url = buildNbsUrl(date);
    const rows = await fetchAndCacheDate(date);

    if (rows) {
      const row = rows.find((r) => r.currency === currency);
      if (row) {
        return {
          currency,
          requestedDate: requestedDateStr,
          effectiveDate: requestedDateStr,
          middleRate: row.middleRate,
          unit: row.unit,
          ratePerUnit: row.ratePerUnit,
          source: "NBS_MIDDLE",
          sourceUrl: url,
          fetchedAt: new Date(),
          isFallback: false,
        };
      }
    }

    // 3. Fallback: walk backward up to FALLBACK_LOOKBACK_DAYS
    for (let daysBack = 1; daysBack <= FALLBACK_LOOKBACK_DAYS; daysBack++) {
      const fallbackDate = new Date(date);
      fallbackDate.setDate(fallbackDate.getDate() - daysBack);
      const fallbackDateStr = toIsoDate(fallbackDate);

      // Check cache first
      const fallbackCached = await prisma.exchangeRateCache.findUnique({
        where: {
          currency_rateDate_listTypeId: {
            currency,
            rateDate: fallbackDate,
            listTypeId: NBS_LIST_TYPE_ID,
          },
        },
      });

      if (fallbackCached) {
        return buildFallbackResult(
          currency,
          requestedDateStr,
          fallbackDateStr,
          new Decimal(fallbackCached.ratePerUnit.toString()),
          new Decimal(fallbackCached.middleRate.toString()),
          fallbackCached.unit,
          fallbackCached.sourceUrl
        );
      }

      // Try fetching from NBS
      const fallbackRows = await fetchAndCacheDate(fallbackDate);
      if (fallbackRows) {
        const row = fallbackRows.find((r) => r.currency === currency);
        if (row) {
          return buildFallbackResult(
            currency,
            requestedDateStr,
            fallbackDateStr,
            row.ratePerUnit,
            row.middleRate,
            row.unit,
            buildNbsUrl(fallbackDate)
          );
        }
      }
    }

    // 4. Hard error — no rate found
    throw new Error(
      `NBS_RATE_UNAVAILABLE: No rate found for ${currency} on ${requestedDateStr} or in ${FALLBACK_LOOKBACK_DAYS} days prior. Manual override required.`
    );
  }
}

function buildFallbackResult(
  currency: string,
  requestedDate: string,
  effectiveDate: string,
  ratePerUnit: Decimal,
  middleRate: Decimal,
  unit: number,
  sourceUrl: string
): RateResult {
  return {
    currency,
    requestedDate,
    effectiveDate,
    middleRate,
    unit,
    ratePerUnit,
    source: "FALLBACK_PRIOR",
    sourceUrl,
    fetchedAt: new Date(),
    isFallback: true,
    fallbackReason: `NO_PUBLICATION_FOR_REQUESTED_DATE: ${requestedDate} — using rate from ${effectiveDate}`,
  };
}
