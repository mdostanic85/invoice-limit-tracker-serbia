import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";
import type { Organization } from "@prisma/client";
import { cache } from "react";

export interface OrgContext {
  userId: string;
  organizationId: string;
  organization: Organization;
}

/**
 * Resolves the authenticated user's organization context.
 * Throws if unauthenticated or no organization exists.
 * Every server action and API route must call this first.
 */
export const getOrgContext = cache(async (): Promise<OrgContext> => {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("UNAUTHENTICATED");
  }

  const org = await prisma.organization.findUnique({
    where: { clerkUserId: userId },
  });

  if (!org) {
    throw new Error("NO_ORGANIZATION");
  }

  return {
    userId,
    organizationId: org.id,
    organization: org,
  };
});

/**
 * Same as getOrgContext but returns null instead of throwing.
 * Use in layouts/middleware to check org existence without crashing.
 */
export const getOrgContextSafe = cache(async (): Promise<OrgContext | null> => {
  try {
    return await getOrgContext();
  } catch {
    return null;
  }
});
