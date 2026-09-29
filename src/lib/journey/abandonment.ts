import prisma from "@/lib/prisma";

/**
 * Automatically marks inactive customer journeys as ABANDONED.
 * A journey is considered abandoned if:
 * 1. Its status is currently 'IN_PROGRESS'
 * 2. Its last update (updatedAt) was more than inactivityMinutes ago (default 30 mins)
 *
 * Sets status = 'ABANDONED' and abandonedAt = 'Etapa X' (based on currentStep).
 */
export async function markAbandonedJourneys(inactivityMinutes: number = 30): Promise<number> {
  try {
    const rawResult = await prisma.$executeRawUnsafe(`
      UPDATE "CustomerJourney"
      SET status = 'ABANDONED',
          "abandonedAt" = COALESCE("abandonedAt", CONCAT('Etapa ', "currentStep"))
      WHERE status = 'IN_PROGRESS'
        AND "updatedAt" <= NOW() - INTERVAL '${inactivityMinutes} minutes'
    `);
    return typeof rawResult === "number" ? rawResult : 0;
  } catch {
    try {
      const threshold = new Date(Date.now() - inactivityMinutes * 60 * 1000);
      const staleJourneys = await prisma.customerJourney.findMany({
        where: {
          status: "IN_PROGRESS",
          updatedAt: { lte: threshold },
        },
        select: { id: true, currentStep: true },
        take: 200,
      });

      if (staleJourneys.length > 0) {
        await Promise.all(
          staleJourneys.map((j) =>
            prisma.customerJourney.update({
              where: { id: j.id },
              data: {
                status: "ABANDONED",
                abandonedAt: `Etapa ${j.currentStep}`,
              },
            })
          )
        );
      }
      return staleJourneys.length;
    } catch (fallbackErr) {
      console.error("[markAbandonedJourneys Error]", fallbackErr);
      return 0;
    }
  }
}
