export function getInvoicePdfDownloadUrl(invoiceId: string): string {
  return `/api/invoices/${invoiceId}/pdf`;
}

export async function downloadInvoicePdf(invoiceId: string): Promise<void> {
  const url = getInvoicePdfDownloadUrl(invoiceId);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("PDF download failed");
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition");
  const filenameMatch = disposition?.match(/filename="([^"]+)"/);
  const filename = filenameMatch?.[1] ?? `invoice-${invoiceId}.pdf`;

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
