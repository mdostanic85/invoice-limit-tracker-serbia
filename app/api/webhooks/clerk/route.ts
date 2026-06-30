import { NextRequest, NextResponse } from "next/server";

/**
 * Clerk webhook endpoint.
 * Currently used for future multi-user org sync.
 * MVP: organization is created during onboarding, not via webhook.
 */
export async function POST(req: NextRequest) {
  // Verify webhook signature in production (requires svix package)
  // For MVP, org provisioning is handled in the onboarding flow

  const body = await req.json();
  const eventType = body.type;

  // Log events for future implementation
  console.log(`[Clerk Webhook] Event: ${eventType}`);

  return NextResponse.json({ received: true });
}
