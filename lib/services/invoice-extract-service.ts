/**
 * Extracts structured invoice fields from a PDF using a vision-capable LLM.
 * Prefers Google Gemini (free tier), falls back to OpenAI when configured.
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { INVOICE_CURRENCIES } from "@/lib/constants/currencies";

const extractionSchema = z.object({
  invoiceNumber: z.string().nullable().describe("Invoice / document number"),
  issueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .describe("Issue date in YYYY-MM-DD"),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .describe("Due date in YYYY-MM-DD"),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .describe("Payment date in YYYY-MM-DD if paid"),
  originalAmount: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/)
    .nullable()
    .describe("Total amount as decimal string, no currency symbol"),
  currency: z
    .enum(INVOICE_CURRENCIES)
    .nullable()
    .describe("ISO 4217 currency code"),
  status: z
    .enum(["DRAFT", "ISSUED", "PAID", "OVERDUE", "CANCELLED"])
    .nullable()
    .describe("Best guess based on document wording"),
  clientDisplayName: z
    .string()
    .nullable()
    .describe("Buyer / client company or person name"),
  clientLegalName: z.string().nullable(),
  clientTaxId: z.string().nullable().describe("PIB / VAT / tax ID of buyer"),
  clientEmail: z.string().nullable(),
  clientCountryCode: z
    .string()
    .length(2)
    .nullable()
    .describe("ISO 3166-1 alpha-2 country code of buyer"),
  notes: z.string().nullable().describe("Short summary or line-item description"),
  confidence: z.enum(["high", "medium", "low"]),
  extractionNotes: z
    .string()
    .nullable()
    .describe("Fields that were unclear or assumptions made"),
});

export type ExtractedInvoice = z.infer<typeof extractionSchema>;

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

type ExtractionProvider = {
  name: string;
  model: LanguageModel;
};

function getExtractionProviders(): ExtractionProvider[] {
  const providers: ExtractionProvider[] = [];

  const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (geminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });
    const modelId = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    providers.push({ name: "Gemini", model: google(modelId) });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const openai = createOpenAI({ apiKey: openaiKey });
    const modelId = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    providers.push({ name: "OpenAI", model: openai(modelId) });
  }

  return providers;
}

function buildExtractionPrompt(fileName: string) {
  return `You extract invoice data for a Serbian flat-rate taxpayer's bookkeeping app.

Read this PDF invoice (${fileName}) and return structured fields.

Rules:
- Dates must be YYYY-MM-DD. Serbian dates like 15.03.2026 → 2026-03-15.
- Amount is the invoice TOTAL (gross if both net and gross appear).
- Currency must be one of: ${INVOICE_CURRENCIES.join(", ")}.
- clientDisplayName is the BUYER (kupac), not the issuer/seller.
- If a field is missing or unreadable, return null for that field.
- status: use ISSUED for normal outgoing invoices; PAID only if explicitly marked paid.
- Set confidence to low if key fields (number, date, amount, client) are uncertain.
- extractionNotes: briefly note ambiguities in English or Serbian.`;
}

function isProviderFallbackError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const msg = error.message.toLowerCase();
  return (
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("billing") ||
    msg.includes("insufficient") ||
    msg.includes("overloaded") ||
    msg.includes("unavailable") ||
    msg.includes("failed after")
  );
}

async function extractWithProvider(
  provider: ExtractionProvider,
  pdfBuffer: Buffer,
  fileName: string
): Promise<ExtractedInvoice> {
  const { object } = await generateObject({
    model: provider.model,
    schema: extractionSchema,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: buildExtractionPrompt(fileName),
          },
          {
            type: "file",
            data: pdfBuffer,
            mediaType: "application/pdf",
            filename: fileName,
          },
        ],
      },
    ],
  });

  return object;
}

export async function extractInvoiceFromPdf(
  pdfBuffer: Buffer,
  fileName: string
): Promise<ExtractedInvoice> {
  if (pdfBuffer.byteLength > MAX_PDF_BYTES) {
    throw new Error("PDF must be 10 MB or smaller.");
  }

  if (pdfBuffer.byteLength < 100) {
    throw new Error("The uploaded file appears to be empty or invalid.");
  }

  const providers = getExtractionProviders();
  if (providers.length === 0) {
    throw new Error(
      "No AI provider configured. Add GOOGLE_GENERATIVE_AI_API_KEY (free at aistudio.google.com) or OPENAI_API_KEY to .env.local."
    );
  }

  let lastError: Error | undefined;

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const hasFallback = i < providers.length - 1;

    try {
      return await extractWithProvider(provider, pdfBuffer, fileName);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;

      if (hasFallback && isProviderFallbackError(error)) {
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new Error("Failed to extract invoice from PDF.");
}
