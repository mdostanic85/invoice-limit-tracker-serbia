import { prisma } from "@/lib/db/prisma";

interface RecordHourlyRateInput {
  organizationId: string;
  clientId: string;
  ratePerHour: string;
  currency: string;
  changedBy: string;
  note?: string | null;
}

export async function recordClientHourlyRate(input: RecordHourlyRateInput) {
  return prisma.clientHourlyRateHistory.create({
    data: {
      organizationId: input.organizationId,
      clientId: input.clientId,
      ratePerHour: input.ratePerHour,
      currency: input.currency,
      note: input.note ?? null,
      changedBy: input.changedBy,
    },
  });
}

export { hasHourlyRateChanged, calculateHourlyAmount } from "@/lib/utils/hourly-billing";
