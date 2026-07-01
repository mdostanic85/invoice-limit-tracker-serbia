import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getOrgContextSafe } from "@/lib/auth/get-org-context";
import {
  generateInvoicePdfBuffer,
  invoicePdfFilename,
} from "@/lib/services/invoice-pdf-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const ctx = await getOrgContextSafe();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      organization: true,
    },
  });

  if (!invoice || invoice.organizationId !== ctx.organizationId) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  try {
    const pdf = await generateInvoicePdfBuffer({
      organization: invoice.organization,
      invoice,
      client: invoice.client,
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoicePdfFilename(invoice.invoiceNumber)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF generation failed";
    console.error("[invoice-pdf]", message, err);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
