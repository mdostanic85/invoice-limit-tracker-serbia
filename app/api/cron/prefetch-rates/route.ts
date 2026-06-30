import { NextRequest, NextResponse } from "next/server";
import { getExchangeRateProvider } from "@/lib/exchange-rate";
import { SUPPORTED_CURRENCIES } from "@/lib/exchange-rate/types";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Cron route: prefetch today's and tomorrow's NBS rates for all supported currencies.
 * Should be called daily at 09:00 Europe/Belgrade.
 * Secured by CRON_SECRET header.
 *
 * Example Vercel cron config (vercel.json):
 * { "crons": [{ "path": "/api/cron/prefetch-rates", "schedule": "0 7 * * *" }] }
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provider = getExchangeRateProvider();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dates = [today, tomorrow];
  const currencies = SUPPORTED_CURRENCIES.slice(0, 10); // Top 10 currencies for prefetch

  const results: Array<{ date: string; currency: string; status: string }> = [];

  for (const date of dates) {
    for (const currency of currencies) {
      try {
        await provider.getMiddleRate({ currency, date });
        results.push({
          date: date.toISOString().split("T")[0],
          currency,
          status: "ok",
        });
      } catch (err) {
        results.push({
          date: date.toISOString().split("T")[0],
          currency,
          status: `error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  return NextResponse.json({ prefetched: results.length, results });
}

// Also allow GET for easy testing
export async function GET(req: NextRequest) {
  return POST(req);
}
