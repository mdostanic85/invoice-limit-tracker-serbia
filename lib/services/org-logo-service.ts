import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/db/prisma";
import { validateLogoFile } from "@/lib/constants/org-logo";

export { MAX_LOGO_BYTES } from "@/lib/constants/org-logo";

function sanitizeLogoFilename(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 80) || "logo";
}

async function deleteStoredLogo(url: string | null | undefined) {
  if (!url || !process.env.BLOB_READ_WRITE_TOKEN) return;

  try {
    await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch {
    // Best-effort cleanup — old blob may already be gone.
  }
}

export async function uploadOrganizationLogo(
  organizationId: string,
  file: File
): Promise<{ logoUrl: string }> {
  const validationError = validateLogoFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Logo upload is not configured. Set BLOB_READ_WRITE_TOKEN.");
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { logoUrl: true },
  });

  if (!org) {
    throw new Error("Organization not found.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = sanitizeLogoFilename(file.name);
  const blob = await put(`orgs/${organizationId}/logo/${Date.now()}-${safeName}`, buffer, {
    access: "public",
    contentType: file.type || "image/png",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  await prisma.organization.update({
    where: { id: organizationId },
    data: { logoUrl: blob.url },
  });

  if (org.logoUrl && org.logoUrl !== blob.url) {
    await deleteStoredLogo(org.logoUrl);
  }

  return { logoUrl: blob.url };
}

export async function removeOrganizationLogo(organizationId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { logoUrl: true },
  });

  if (!org?.logoUrl) return;

  await prisma.organization.update({
    where: { id: organizationId },
    data: { logoUrl: null },
  });

  await deleteStoredLogo(org.logoUrl);
}

export async function fetchOrganizationLogoBuffer(
  logoUrl: string | null | undefined
): Promise<Buffer | null> {
  if (!logoUrl) return null;

  try {
    const response = await fetch(logoUrl, { cache: "no-store" });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}
