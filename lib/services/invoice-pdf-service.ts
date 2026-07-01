import PDFDocument from "pdfkit";
import path from "path";
import type { Client, Invoice, Organization, InvoicePdfTemplate } from "@prisma/client";
import { getInvoicePdfMessages } from "@/lib/i18n/messages/pdf";
import { dbLocaleToLocale } from "@/lib/i18n/types";
import { formatCurrency, formatDate, formatRate } from "@/lib/utils/format";

const FONT_DIR = path.join(process.cwd(), "node_modules/dejavu-fonts-ttf/ttf");
const FONT_REGULAR = path.join(FONT_DIR, "DejaVuSans.ttf");
const FONT_BOLD = path.join(FONT_DIR, "DejaVuSans-Bold.ttf");

const PAGE_MARGIN = 50;
const CONTENT_WIDTH = 495; // A4 width minus margins

export interface InvoicePdfInput {
  organization: Organization;
  invoice: Invoice;
  client: Client;
}

function statusLabel(
  status: Invoice["status"],
  labels: ReturnType<typeof getInvoicePdfMessages>
): string {
  switch (status) {
    case "DRAFT":
      return labels.statusDraft;
    case "ISSUED":
      return labels.statusIssued;
    case "PAID":
      return labels.statusPaid;
    case "OVERDUE":
      return labels.statusOverdue;
    case "CANCELLED":
      return labels.statusCancelled;
    default:
      return status;
  }
}

function rateSourceLabel(source: string): string {
  switch (source) {
    case "NBS_MIDDLE":
      return "NBS";
    case "FALLBACK_PRIOR":
      return "NBS (fallback)";
    case "MANUAL_OVERRIDE":
      return "Manual";
    default:
      return source;
  }
}

function drawLabelValue(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  value: string,
  width: number,
  boldValue = false
): number {
  doc.font(FONT_REGULAR).fontSize(8).fillColor("#666666").text(label, x, y, { width });
  const labelHeight = doc.heightOfString(label, { width });
  doc
    .font(boldValue ? FONT_BOLD : FONT_REGULAR)
    .fontSize(10)
    .fillColor("#111111")
    .text(value, x, y + labelHeight + 2, { width });
  return y + labelHeight + 2 + doc.heightOfString(value, { width }) + 8;
}

function drawPartyBlock(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  heading: string,
  lines: string[]
): number {
  doc.font(FONT_BOLD).fontSize(9).fillColor("#444444").text(heading.toUpperCase(), x, y, { width });
  let cursor = y + 14;
  for (const line of lines.filter(Boolean)) {
    doc.font(FONT_REGULAR).fontSize(10).fillColor("#111111").text(line, x, cursor, { width });
    cursor += doc.heightOfString(line, { width }) + 2;
  }
  return cursor + 6;
}

function drawLineItemsTable(
  doc: PDFKit.PDFDocument,
  y: number,
  labels: ReturnType<typeof getInvoicePdfMessages>,
  invoice: Invoice,
  showHours: boolean
): number {
  const colDesc = showHours ? 240 : 300;
  const colHours = 55;
  const colAmount = CONTENT_WIDTH - colDesc - (showHours ? colHours : 0);

  doc
    .rect(PAGE_MARGIN, y, CONTENT_WIDTH, 22)
    .fill("#f5f5f5");
  doc.fillColor("#333333").font(FONT_BOLD).fontSize(9);
  doc.text(labels.description, PAGE_MARGIN + 8, y + 6, { width: colDesc - 16 });
  if (showHours) {
    doc.text(labels.hours, PAGE_MARGIN + colDesc, y + 6, { width: colHours, align: "right" });
  }
  doc.text(labels.amount, PAGE_MARGIN + colDesc + (showHours ? colHours : 0), y + 6, {
    width: colAmount - 8,
    align: "right",
  });

  const rowY = y + 22;
  const description =
    invoice.billableHours != null
      ? labels.hourlyDescription
      : labels.serviceDescription;
  const amount = formatCurrency(
    invoice.originalAmount.toString(),
    invoice.currency
  );
  const hours =
    invoice.billableHours != null ? invoice.billableHours.toString() : "";

  doc
    .rect(PAGE_MARGIN, rowY, CONTENT_WIDTH, 28)
    .strokeColor("#e8e8e8")
    .lineWidth(0.5)
    .stroke();
  doc.font(FONT_REGULAR).fontSize(10).fillColor("#111111");
  doc.text(description, PAGE_MARGIN + 8, rowY + 8, { width: colDesc - 16 });
  if (showHours) {
    doc.text(hours, PAGE_MARGIN + colDesc, rowY + 8, { width: colHours, align: "right" });
  }
  doc.text(amount, PAGE_MARGIN + colDesc + (showHours ? colHours : 0), rowY + 8, {
    width: colAmount - 8,
    align: "right",
  });

  return rowY + 36;
}

function drawTotalBlock(
  doc: PDFKit.PDFDocument,
  y: number,
  labels: ReturnType<typeof getInvoicePdfMessages>,
  invoice: Invoice
): number {
  const totalX = PAGE_MARGIN + CONTENT_WIDTH - 180;
  doc.font(FONT_REGULAR).fontSize(10).fillColor("#666666").text(labels.total, totalX, y, {
    width: 80,
    align: "right",
  });
  doc
    .font(FONT_BOLD)
    .fontSize(12)
    .fillColor("#111111")
    .text(formatCurrency(invoice.originalAmount.toString(), invoice.currency), totalX + 85, y - 1, {
      width: 95,
      align: "right",
    });
  return y + 28;
}

function drawNbsFooter(
  doc: PDFKit.PDFDocument,
  y: number,
  labels: ReturnType<typeof getInvoicePdfMessages>,
  invoice: Invoice,
  locale: string
): number {
  if (invoice.currency === "RSD") return y;

  const boxY = y + 8;
  doc
    .roundedRect(PAGE_MARGIN, boxY, CONTENT_WIDTH, 72, 4)
    .fillAndStroke("#f9fafb", "#e5e7eb");

  let innerY = boxY + 10;
  const colW = CONTENT_WIDTH / 2 - 16;

  innerY = drawLabelValue(
    doc,
    PAGE_MARGIN + 12,
    innerY,
    labels.nbsRate,
    `1 ${invoice.currency} = ${formatRate(invoice.appliedMiddleRate.toString(), 4)} RSD`,
    colW,
    true
  );
  drawLabelValue(
    doc,
    PAGE_MARGIN + CONTENT_WIDTH / 2,
    boxY + 10,
    labels.nbsRateEffective,
    formatDate(invoice.rateEffectiveDate, locale),
    colW
  );

  doc
    .font(FONT_BOLD)
    .fontSize(10)
    .fillColor("#111111")
    .text(
      `${labels.rsdEquivalent}: ${formatCurrency(invoice.rsdAmount.toString(), "RSD")}`,
      PAGE_MARGIN + 12,
      boxY + 48,
      { width: CONTENT_WIDTH - 24 }
    );

  const sourceBits = [rateSourceLabel(invoice.rateSource)];
  if (invoice.isFallbackRate) sourceBits.push("fallback");
  if (invoice.manualOverride) sourceBits.push("manual override");
  doc
    .font(FONT_REGULAR)
    .fontSize(8)
    .fillColor("#666666")
    .text(`${labels.rateSource}: ${sourceBits.join(" · ")}`, PAGE_MARGIN + 12, boxY + 62, {
      width: CONTENT_WIDTH - 24,
    });

  return boxY + 84;
}

function issuerLines(org: Organization): string[] {
  const name = org.issuerLegalName?.trim() || org.name;
  return [
    name,
    org.issuerAddress?.trim() ?? "",
    org.issuerTaxId ? `PIB: ${org.issuerTaxId}` : "",
    org.issuerRegistrationNumber ? `MB: ${org.issuerRegistrationNumber}` : "",
    org.issuerEmail?.trim() ?? "",
    org.issuerPhone?.trim() ?? "",
  ];
}

function clientLines(client: Client): string[] {
  return [
    client.legalName?.trim() || client.displayName,
    client.displayName !== client.legalName ? client.displayName : "",
    client.taxId ? `PIB: ${client.taxId}` : "",
    client.email?.trim() ?? "",
    client.countryCode ?? "",
  ];
}

function renderMinimal(
  doc: PDFKit.PDFDocument,
  input: InvoicePdfInput,
  labels: ReturnType<typeof getInvoicePdfMessages>,
  locale: string
) {
  const { organization, invoice, client } = input;
  let y = PAGE_MARGIN;

  doc.font(FONT_BOLD).fontSize(22).fillColor("#111111").text(labels.title, PAGE_MARGIN, y);
  y += 34;

  const metaX = PAGE_MARGIN + 280;
  y = drawLabelValue(doc, metaX, y - 34, labels.invoiceNumber, invoice.invoiceNumber, 215, true);
  if (invoice.dueDate) {
    drawLabelValue(doc, metaX, y, labels.dueDate, formatDate(invoice.dueDate, locale), 215);
  }
  drawLabelValue(
    doc,
    metaX,
    y + (invoice.dueDate ? 36 : 0),
    labels.issueDate,
    formatDate(invoice.issueDate, locale),
    215
  );

  y = Math.max(y, PAGE_MARGIN + 70);
  doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, y).strokeColor("#e8e8e8").stroke();
  y += 16;

  const half = CONTENT_WIDTH / 2 - 12;
  const leftBottom = drawPartyBlock(doc, PAGE_MARGIN, y, half, labels.from, issuerLines(organization));
  const rightBottom = drawPartyBlock(
    doc,
    PAGE_MARGIN + half + 24,
    y,
    half,
    labels.billTo,
    clientLines(client)
  );
  y = Math.max(leftBottom, rightBottom) + 8;

  const showHours = invoice.billableHours != null;
  y = drawLineItemsTable(doc, y, labels, invoice, showHours);
  y = drawTotalBlock(doc, y, labels, invoice);
  y = drawNbsFooter(doc, y, labels, invoice, locale);

  if (organization.issuerBankAccount?.trim()) {
    y += 8;
    drawLabelValue(
      doc,
      PAGE_MARGIN,
      y,
      labels.bankAccount,
      organization.issuerBankAccount.trim(),
      CONTENT_WIDTH
    );
    y += 28;
  }

  if (invoice.notes?.trim()) {
    y += 4;
    doc.font(FONT_BOLD).fontSize(9).fillColor("#444444").text(labels.notes, PAGE_MARGIN, y);
    y += 14;
    doc.font(FONT_REGULAR).fontSize(10).fillColor("#111111").text(invoice.notes.trim(), PAGE_MARGIN, y, {
      width: CONTENT_WIDTH,
    });
    y += doc.heightOfString(invoice.notes.trim(), { width: CONTENT_WIDTH }) + 8;
  }

  doc
    .font(FONT_REGULAR)
    .fontSize(7.5)
    .fillColor("#888888")
    .text(labels.disclaimer, PAGE_MARGIN, 760, { width: CONTENT_WIDTH, align: "center" });
}

function renderAgency(
  doc: PDFKit.PDFDocument,
  input: InvoicePdfInput,
  labels: ReturnType<typeof getInvoicePdfMessages>,
  locale: string
) {
  const { organization, invoice, client } = input;
  let y = PAGE_MARGIN;

  doc
    .rect(PAGE_MARGIN, y, CONTENT_WIDTH, 56)
    .fill("#1a1a2e");
  const headerName = organization.issuerLegalName?.trim() || organization.name;
  doc.font(FONT_BOLD).fontSize(16).fillColor("#ffffff").text(headerName, PAGE_MARGIN + 16, y + 12, {
    width: CONTENT_WIDTH - 32,
  });
  doc
    .font(FONT_REGULAR)
    .fontSize(9)
    .fillColor("#c7d2fe")
    .text(labels.title, PAGE_MARGIN + 16, y + 34, { width: 200 });
  doc
    .font(FONT_BOLD)
    .fontSize(11)
    .fillColor("#ffffff")
    .text(invoice.invoiceNumber, PAGE_MARGIN + CONTENT_WIDTH - 160, y + 20, {
      width: 144,
      align: "right",
    });
  y += 72;

  const boxHeight = 108;
  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH / 2 - 8, boxHeight, 4).strokeColor("#e5e7eb").stroke();
  doc.roundedRect(PAGE_MARGIN + CONTENT_WIDTH / 2 + 8, y, CONTENT_WIDTH / 2 - 8, boxHeight, 4).strokeColor("#e5e7eb").stroke();

  drawPartyBlock(doc, PAGE_MARGIN + 12, y + 10, CONTENT_WIDTH / 2 - 32, labels.from, issuerLines(organization));
  drawPartyBlock(
    doc,
    PAGE_MARGIN + CONTENT_WIDTH / 2 + 20,
    y + 10,
    CONTENT_WIDTH / 2 - 32,
    labels.billTo,
    clientLines(client)
  );
  y += boxHeight + 16;

  const metaY = y;
  const metaCol = CONTENT_WIDTH / 3;
  drawLabelValue(doc, PAGE_MARGIN, metaY, labels.issueDate, formatDate(invoice.issueDate, locale), metaCol);
  drawLabelValue(
    doc,
    PAGE_MARGIN + metaCol,
    metaY,
    labels.status,
    statusLabel(invoice.status, labels),
    metaCol
  );
  if (invoice.dueDate) {
    drawLabelValue(
      doc,
      PAGE_MARGIN + metaCol * 2,
      metaY,
      labels.dueDate,
      formatDate(invoice.dueDate, locale),
      metaCol
    );
  }
  y = metaY + 52;

  const showHours = invoice.billableHours != null;
  y = drawLineItemsTable(doc, y, labels, invoice, showHours);
  y = drawTotalBlock(doc, y + 4, labels, invoice);
  y = drawNbsFooter(doc, y, labels, invoice, locale);

  if (organization.issuerBankAccount?.trim()) {
    y += 12;
    doc
      .roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 40, 4)
      .fillAndStroke("#fffbeb", "#fcd34d");
    doc
      .font(FONT_BOLD)
      .fontSize(9)
      .fillColor("#92400e")
      .text(labels.bankAccount, PAGE_MARGIN + 12, y + 8);
    doc
      .font(FONT_REGULAR)
      .fontSize(10)
      .fillColor("#111111")
      .text(organization.issuerBankAccount.trim(), PAGE_MARGIN + 12, y + 22, {
        width: CONTENT_WIDTH - 24,
      });
    y += 52;
  }

  if (invoice.notes?.trim()) {
    doc.font(FONT_BOLD).fontSize(9).fillColor("#444444").text(labels.notes, PAGE_MARGIN, y);
    y += 14;
    doc.font(FONT_REGULAR).fontSize(10).fillColor("#111111").text(invoice.notes.trim(), PAGE_MARGIN, y, {
      width: CONTENT_WIDTH,
    });
  }

  doc
    .font(FONT_REGULAR)
    .fontSize(7.5)
    .fillColor("#888888")
    .text(labels.disclaimer, PAGE_MARGIN, 760, { width: CONTENT_WIDTH, align: "center" });
}

function renderInvoicePdf(
  doc: PDFKit.PDFDocument,
  input: InvoicePdfInput,
  template: InvoicePdfTemplate
) {
  const locale = dbLocaleToLocale(input.organization.preferredLocale) === "sr" ? "sr-RS" : "en-GB";
  const labels = getInvoicePdfMessages(dbLocaleToLocale(input.organization.preferredLocale));

  if (template === "AGENCY") {
    renderAgency(doc, input, labels, locale);
  } else {
    renderMinimal(doc, input, labels, locale);
  }
}

export async function generateInvoicePdfBuffer(input: InvoicePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    renderInvoicePdf(doc, input, input.organization.invoicePdfTemplate);
    doc.end();
  });
}

export function invoicePdfFilename(invoiceNumber: string): string {
  const safe = invoiceNumber.replace(/[^\w.-]+/g, "_").slice(0, 80);
  return `invoice-${safe}.pdf`;
}
