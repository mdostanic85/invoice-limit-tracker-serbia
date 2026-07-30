"use server";

import { revalidatePath } from "next/cache";
import { getOrgContext } from "@/lib/auth/get-org-context";
import { writeAuditEvent } from "@/lib/services/audit-service";
import {
  removeOrganizationLogo,
  uploadOrganizationLogo,
} from "@/lib/services/org-logo-service";
import { serializeForClient } from "@/lib/utils/serialize";

export async function uploadOrganizationLogoAction(formData: FormData) {
  const ctx = await getOrgContext();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "No image file uploaded." };
  }

  try {
    const result = await uploadOrganizationLogo(ctx.organizationId, file);

    await writeAuditEvent({
      organizationId: ctx.organizationId,
      entityType: "Organization",
      entityId: ctx.organizationId,
      action: "ORG_SETTINGS_UPDATED",
      actorUserId: ctx.userId,
      payload: { event: "LOGO_UPLOADED", logoUrl: result.logoUrl },
    });

    revalidatePath("/settings");
    revalidatePath("/onboarding");

    return { data: serializeForClient(result) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to upload logo";
    return { error: message };
  }
}

export async function removeOrganizationLogoAction() {
  const ctx = await getOrgContext();

  try {
    await removeOrganizationLogo(ctx.organizationId);

    await writeAuditEvent({
      organizationId: ctx.organizationId,
      entityType: "Organization",
      entityId: ctx.organizationId,
      action: "ORG_SETTINGS_UPDATED",
      actorUserId: ctx.userId,
      payload: { event: "LOGO_REMOVED" },
    });

    revalidatePath("/settings");
    revalidatePath("/onboarding");

    return { data: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove logo";
    return { error: message };
  }
}
