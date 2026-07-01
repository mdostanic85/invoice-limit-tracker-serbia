import { z } from "zod";
import { validateAnnualThreshold } from "@/lib/domain/country-tax-rules";

// ─── Shared ───────────────────────────────────────────────────────────────────

export const currencySchema = z
  .string()
  .length(3)
  .toUpperCase()
  .describe("ISO 4217 currency code");

export const positiveDecimalSchema = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, "Must be a positive number with up to 4 decimal places")
  .refine((v) => parseFloat(v) > 0, "Must be greater than 0");

// ─── Organization ─────────────────────────────────────────────────────────────

const createOrganizationBaseSchema = z.object({
  name: z.string().min(1).max(100),
  timezone: z.string().min(1).default("Europe/Belgrade"),
  countryCode: z.string().length(2).toUpperCase().default("RS"),
  primaryCurrency: currencySchema.default("RSD"),
  taxLimitTierId: z.string().optional().nullable(),
  annualThresholdRsd: positiveDecimalSchema.default("6000000"),
});

function withThresholdValidation<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((data, ctx) => {
    const record = data as {
      countryCode?: string;
      annualThresholdRsd?: string;
      taxLimitTierId?: string | null;
    };
    const countryCode = record.countryCode ?? "RS";
    const amount = record.annualThresholdRsd;
    if (!amount) return;

    const result = validateAnnualThreshold(countryCode, amount, record.taxLimitTierId);
    if (!result.ok) {
      ctx.addIssue({
        code: "custom",
        path: ["annualThresholdRsd"],
        message: result.message,
      });
    }
  });
}

export const createOrganizationSchema = withThresholdValidation(createOrganizationBaseSchema);

const optionalOrgText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v === "" || v === undefined ? null : v));

export const updateOrganizationSchema = withThresholdValidation(
  createOrganizationBaseSchema.partial().extend({
    preferredLocale: z.enum(["EN", "SR"]).optional(),
    issuerLegalName: optionalOrgText(200),
    issuerAddress: optionalOrgText(500),
    issuerTaxId: optionalOrgText(50),
    issuerRegistrationNumber: optionalOrgText(50),
    issuerBankAccount: optionalOrgText(120),
    issuerEmail: z
      .string()
      .email()
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((v) => (v === "" || v === undefined ? null : v)),
    issuerPhone: optionalOrgText(40),
    invoicePdfTemplate: z.enum(["MINIMAL", "AGENCY"]).optional(),
  })
);

export const updateThresholdSchema = z.object({
  annualThresholdRsd: positiveDecimalSchema,
  taxLimitTierId: z.string().optional().nullable(),
  reason: z.string().min(5).max(500).optional(),
});

// ─── Client ───────────────────────────────────────────────────────────────────

const createClientBaseSchema = z.object({
  displayName: z.string().min(1).max(200),
  legalName: z.string().max(200).optional().nullable(),
  countryCode: z.string().length(2).toUpperCase().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  taxId: z.string().max(50).optional().nullable(),
  defaultCurrency: currencySchema.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  billingModel: z.enum(["FIXED", "HOURLY"]).default("FIXED"),
  hourlyRate: positiveDecimalSchema.optional().nullable(),
  hourlyCurrency: currencySchema.optional().nullable(),
  hourlyRateNote: z.string().max(500).optional().nullable(),
});

function refineHourlyClient(
  data: {
    billingModel?: "FIXED" | "HOURLY";
    hourlyRate?: string | null;
    hourlyCurrency?: string | null;
  },
  ctx: z.RefinementCtx
) {
  if (data.billingModel === "HOURLY") {
    if (!data.hourlyRate) {
      ctx.addIssue({
        code: "custom",
        path: ["hourlyRate"],
        message: "Hourly rate is required for hourly clients",
      });
    }
    if (!data.hourlyCurrency) {
      ctx.addIssue({
        code: "custom",
        path: ["hourlyCurrency"],
        message: "Currency is required for hourly rate",
      });
    }
  }
}

export const createClientSchema = createClientBaseSchema.superRefine(refineHourlyClient);

export const updateClientSchema = createClientBaseSchema
  .partial()
  .superRefine(refineHourlyClient);

// ─── Invoice ──────────────────────────────────────────────────────────────────

export const invoiceStatusValues = [
  "DRAFT",
  "ISSUED",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;

const createInvoiceBaseSchema = z.object({
  invoiceNumber: z.string().min(1).max(50),
  clientId: z.string().cuid(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD"),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  originalAmount: positiveDecimalSchema,
  currency: currencySchema,
  // Rate fields — set by server from NBS fetch or manual override
  appliedMiddleRate: z.string().optional(),
  rateEffectiveDate: z.string().optional(),
  rateSource: z.enum(["NBS_MIDDLE", "FALLBACK_PRIOR", "MANUAL_OVERRIDE"]).optional(),
  rateSourceUrl: z.string().optional().nullable(),
  rateFetchedAt: z.string().optional().nullable(),
  isFallbackRate: z.boolean().optional(),
  fallbackReason: z.string().optional().nullable(),
  manualOverride: z.boolean().optional(),
  overrideReason: z
    .string()
    .min(10, "Reason must be at least 10 characters")
    .max(500)
    .optional()
    .nullable(),
  status: z.enum(invoiceStatusValues).default("DRAFT"),
  includeInLimit: z.boolean().default(true),
  notes: z.string().max(2000).optional().nullable(),
  billableHours: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Up to 4 decimal places")
    .optional()
    .nullable(),
});

export const createInvoiceSchema = createInvoiceBaseSchema
  .refine(
    (d) => {
      if (d.dueDate && d.issueDate && d.dueDate < d.issueDate) return false;
      return true;
    },
    { message: "Due date must be on or after issue date", path: ["dueDate"] }
  )
  .refine(
    (d) => {
      if (d.paymentDate && d.issueDate && d.paymentDate < d.issueDate)
        return false;
      return true;
    },
    {
      message: "Payment date must be on or after issue date",
      path: ["paymentDate"],
    }
  );

export const updateInvoiceSchema = createInvoiceBaseSchema.partial();

// ─── Forecast ─────────────────────────────────────────────────────────────────

const createForecastBaseSchema = z.object({
  clientId: z.string().cuid().optional().nullable(),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  billingModel: z.enum(["FIXED", "HOURLY"]).default("FIXED"),
  billableHours: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "Up to 4 decimal places")
    .optional()
    .nullable(),
  originalAmount: positiveDecimalSchema,
  currency: currencySchema,
  scenario: z.enum(["CONSERVATIVE", "EXPECTED", "OPTIMISTIC"]).default("EXPECTED"),
  confidence: z.enum(["PLANNED", "LIKELY", "CONFIRMED"]).default("PLANNED"),
  recurrence: z.enum(["ONE_TIME", "MONTHLY", "QUARTERLY"]).default("ONE_TIME"),
  recurrenceEndDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

function refineHourlyForecast(
  data: {
    billingModel?: "FIXED" | "HOURLY";
    billableHours?: string | null;
    clientId?: string | null;
  },
  ctx: z.RefinementCtx
) {
  if (data.billingModel === "HOURLY") {
    if (!data.billableHours || parseFloat(data.billableHours) <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["billableHours"],
        message: "Billable hours are required for hourly forecasts",
      });
    }
    if (!data.clientId) {
      ctx.addIssue({
        code: "custom",
        path: ["clientId"],
        message: "Select an hourly client for hourly forecasts",
      });
    }
  }
}

export const createForecastSchema = createForecastBaseSchema.superRefine(refineHourlyForecast);

export const updateForecastSchema = createForecastBaseSchema
  .partial()
  .superRefine(refineHourlyForecast);

// ─── Planning Exchange Rate ───────────────────────────────────────────────────

export const upsertPlanningRateSchema = z.object({
  currency: currencySchema,
  ratePerUnit: positiveDecimalSchema,
  label: z.string().max(100).optional().nullable(),
});

// ─── Exchange Rate Preview ────────────────────────────────────────────────────

export const ratePreviewSchema = z.object({
  currency: currencySchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const manualRateOverrideSchema = z.object({
  currency: currencySchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  overrideRate: positiveDecimalSchema,
  overrideReason: z
    .string()
    .min(10, "Reason must be at least 10 characters")
    .max(500),
});

// ─── Filter schemas ───────────────────────────────────────────────────────────

// ─── PDF Import ───────────────────────────────────────────────────────────────

export const importInvoiceConfirmSchema = z
  .object({
    invoiceNumber: z.string().min(1).max(50),
    clientId: z.string().cuid().optional(),
    createClient: z.boolean().default(false),
    newClient: createClientSchema.optional(),
    issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    paymentDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    originalAmount: positiveDecimalSchema,
    currency: currencySchema,
    status: z.enum(invoiceStatusValues).default("ISSUED"),
    includeInLimit: z.boolean().default(true),
    notes: z.string().max(2000).optional().nullable(),
  })
  .refine(
    (d) => !d.createClient || (d.newClient?.displayName?.length ?? 0) > 0,
    { message: "Client name is required when creating a new client", path: ["newClient"] }
  )
  .refine((d) => d.createClient || !!d.clientId, {
    message: "Select an existing client or create a new one",
    path: ["clientId"],
  });

export const invoiceFilterSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  clientId: z.string().optional(),
  currency: z.string().optional(),
  status: z.enum(invoiceStatusValues).optional(),
  includeInLimit: z.boolean().optional(),
  search: z.string().max(200).optional(),
  basis: z.enum(["ISSUE_DATE", "PAYMENT_DATE"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  sortField: z.string().optional(),
  sortOrder: z.enum(["ascend", "descend"]).optional(),
});
