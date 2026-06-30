"use server";

import { getOrgContext } from "@/lib/auth/get-org-context";
import { prisma } from "@/lib/db/prisma";
import { extractInvoiceFromPdf } from "@/lib/services/invoice-extract-service";
import { matchClient } from "@/lib/services/client-match-service";
import { createInvoice } from "@/lib/services/invoice-service";
import { writeAuditEvent } from "@/lib/services/audit-service";
import { importInvoiceConfirmSchema } from "@/lib/validation/schemas";
import { put } from "@vercel/blob";
import { serializeForClient } from "@/lib/utils/serialize";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export async function extractInvoiceFromPdfAction(formData: FormData) {
  const ctx = await getOrgContext();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "No PDF file uploaded." };
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { error: "Only PDF files are supported." };
  }

  if (file.size > MAX_PDF_BYTES) {
    return { error: "PDF must be 10 MB or smaller." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractInvoiceFromPdf(buffer, file.name);

    const clients = await prisma.client.findMany({
      where: { organizationId: ctx.organizationId, status: "ACTIVE" },
      select: { id: true, displayName: true, legalName: true, taxId: true },
      orderBy: { displayName: "asc" },
    });

    const clientMatch = matchClient(
      {
        displayName: extracted.clientDisplayName,
        legalName: extracted.clientLegalName,
        taxId: extracted.clientTaxId,
      },
      clients
    );

    const existingInvoice = extracted.invoiceNumber
      ? await prisma.invoice.findUnique({
          where: {
            organizationId_invoiceNumber: {
              organizationId: ctx.organizationId,
              invoiceNumber: extracted.invoiceNumber,
            },
          },
          select: { id: true, invoiceNumber: true },
        })
      : null;

    return {
      data: serializeForClient({
        extracted,
        clientMatch,
        clients,
        duplicateInvoice: existingInvoice,
        fileName: file.name,
      }),
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to extract invoice from PDF";
    return { error: message };
  }
}

export async function confirmInvoiceImportAction(formData: FormData) {
  const ctx = await getOrgContext();

  const payloadRaw = formData.get("payload");
  if (typeof payloadRaw !== "string") {
    return { error: "Missing import payload." };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    return { error: "Invalid import payload." };
  }

  const parsed = importInvoiceConfirmSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.flatten() };

  const file = formData.get("file");
  const pdfFile = file instanceof File ? file : null;

  try {
    let clientId = parsed.data.clientId;

    if (parsed.data.createClient && parsed.data.newClient) {
      const created = await prisma.client.create({
        data: {
          organizationId: ctx.organizationId,
          displayName: parsed.data.newClient.displayName,
          legalName: parsed.data.newClient.legalName ?? null,
          countryCode: parsed.data.newClient.countryCode ?? null,
          email: parsed.data.newClient.email || null,
          taxId: parsed.data.newClient.taxId ?? null,
          defaultCurrency: parsed.data.newClient.defaultCurrency ?? null,
          notes: parsed.data.newClient.notes ?? null,
        },
      });

      await writeAuditEvent({
        organizationId: ctx.organizationId,
        entityType: "Client",
        entityId: created.id,
        action: "CLIENT_CREATED",
        actorUserId: ctx.userId,
        payload: { displayName: created.displayName, source: "pdf_import" },
      });

      clientId = created.id;
    }

    if (!clientId) {
      return { error: "Client is required." };
    }

    const invoice = await createInvoice({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      invoiceNumber: parsed.data.invoiceNumber,
      clientId,
      issueDate: parsed.data.issueDate,
      dueDate: parsed.data.dueDate,
      paymentDate: parsed.data.paymentDate,
      originalAmount: parsed.data.originalAmount,
      currency: parsed.data.currency,
      status: parsed.data.status,
      includeInLimit: parsed.data.includeInLimit,
      notes: parsed.data.notes,
    });

    if (pdfFile && process.env.BLOB_READ_WRITE_TOKEN) {
      const buffer = Buffer.from(await pdfFile.arrayBuffer());
      const blob = await put(
        `orgs/${ctx.organizationId}/invoices/${invoice.id}/${pdfFile.name}`,
        buffer,
        {
          access: "public",
          contentType: "application/pdf",
          token: process.env.BLOB_READ_WRITE_TOKEN,
        }
      );

      await prisma.invoiceAttachment.create({
        data: {
          invoiceId: invoice.id,
          organizationId: ctx.organizationId,
          fileName: pdfFile.name,
          mimeType: "application/pdf",
          storageKey: blob.url,
          sizeBytes: pdfFile.size,
        },
      });
    }

    await writeAuditEvent({
      organizationId: ctx.organizationId,
      entityType: "Invoice",
      entityId: invoice.id,
      action: "INVOICE_CREATED",
      actorUserId: ctx.userId,
      payload: {
        source: "pdf_import",
        invoiceNumber: invoice.invoiceNumber,
        pdfAttached: Boolean(pdfFile && process.env.BLOB_READ_WRITE_TOKEN),
      },
    });

    return { data: serializeForClient(invoice) };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to import invoice";
    return { error: message };
  }
}
