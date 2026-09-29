import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkAdmin } from "@/lib/checkAdmin";

export async function GET(req: NextRequest) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    const where: any = {};
    if (startDate) {
      where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { ...where.createdAt, lte: end };
    }

    // Fetch all journeys with the relevant fields
    const journeys = await prisma.customerJourney.findMany({
      where,
      select: {
        pickupStation: true,
        pickupStationName: true,
        selectedCar: true,
        selectedCarName: true,
        selectedExtras: true,
        currentStep: true,
        status: true,
        createdAt: true,
        paymentMethod: true,
      },
    });

    // ─── Top Destinations ──────────────────────────────
    const destCounts: Record<string, { name: string; code: string; count: number }> = {};
    journeys.forEach((j) => {
      const name = j.pickupStationName || j.pickupStation;
      if (!name) return;
      const key = j.pickupStation || name;
      if (!destCounts[key]) {
        destCounts[key] = { name, code: j.pickupStation || "", count: 0 };
      }
      destCounts[key].count++;
    });
    const topDestinations = Object.values(destCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // ─── Top Cars ──────────────────────────────────────
    const carCounts: Record<string, { name: string; code: string; count: number }> = {};
    journeys.forEach((j) => {
      if (j.currentStep < 2 || !j.selectedCarName) return;
      const key = j.selectedCar || j.selectedCarName;
      if (!carCounts[key]) {
        carCounts[key] = { name: j.selectedCarName, code: j.selectedCar || "", count: 0 };
      }
      carCounts[key].count++;
    });
    const topCars = Object.values(carCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // ─── Top Extras & Protections ──────────────────────
    const extraCounts: Record<string, { name: string; code: string; count: number }> = {};
    journeys.forEach((j) => {
      if (j.currentStep < 3 || !j.selectedExtras) return;
      try {
        const extras: any = typeof j.selectedExtras === "string"
          ? JSON.parse(j.selectedExtras as string)
          : j.selectedExtras;
        
        if (typeof extras === "object" && extras !== null) {
          if (extras.insurances || extras.equipment) {
            (extras.insurances || []).forEach((ins: any) => {
              const code = ins.code || "unknown";
              const name = ins.name || code;
              if (!extraCounts[code]) {
                extraCounts[code] = { name, code, count: 0 };
              }
              extraCounts[code].count++;
            });
            (extras.equipment || []).forEach((eq: any) => {
              const code = eq.code || "unknown";
              const name = eq.name || code;
              if (!extraCounts[code]) {
                extraCounts[code] = { name, code, count: 0 };
              }
              extraCounts[code].count += (eq.qty || 1);
            });
          } else if (Array.isArray(extras)) {
            extras.forEach((e: any) => {
              const code = typeof e === "string" ? e : (e.code || e.id || "unknown");
              const name = typeof e === "string" ? e : (e.name || code);
              if (!extraCounts[code]) {
                extraCounts[code] = { name, code, count: 0 };
              }
              extraCounts[code].count++;
            });
          } else {
            Object.entries(extras).forEach(([code, val]) => {
              const qty = typeof val === "number" ? val : (val as any)?.qty || 1;
              if (qty <= 0) return;
              const name = (val as any)?.name || code;
              if (!extraCounts[code]) {
                extraCounts[code] = { name, code, count: 0 };
              }
              extraCounts[code].count++;
            });
          }
        }
      } catch {}
    });
    const topExtras = Object.values(extraCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // ─── Abandonment Funnel ────────────────────────────
    const totalSessions = journeys.length;
    const step1 = journeys.filter((j) => j.currentStep >= 1).length;
    const step2 = journeys.filter((j) => j.currentStep >= 2).length;
    const step3 = journeys.filter((j) => j.currentStep >= 3).length;
    const step4 = journeys.filter((j) => j.currentStep >= 4).length;
    const step5 = journeys.filter((j) => j.currentStep >= 5).length;

    const abandoned = journeys.filter((j) => j.status === "ABANDONED" || j.status === "IN_PROGRESS");
    const abandonByStep: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    abandoned.forEach((j) => {
      if (j.currentStep >= 1 && j.currentStep <= 4) {
        abandonByStep[j.currentStep]++;
      }
    });

    const completedCount = journeys.filter((j) => j.status === "COMPLETED").length;
    const conversionRate = totalSessions > 0 ? ((completedCount / totalSessions) * 100).toFixed(1) : "0";

    // ─── Abandonment reasons (inferred) ────────────────
    const abandonReasons = [
      {
        step: 1,
        label: "Pesquisou → Não selecionou veículo",
        description: "Cliente pesquisou destinos mas não escolheu carro. Possíveis motivos: preços altos, destino sem disponibilidade, apenas pesquisando.",
        count: abandonByStep[1],
        percent: step1 > 0 ? ((abandonByStep[1] / step1) * 100).toFixed(1) : "0",
      },
      {
        step: 2,
        label: "Selecionou veículo → Não adicionou extras",
        description: "Cliente escolheu carro mas não avançou para extras. Possíveis motivos: preço total inesperado, comparando opções.",
        count: abandonByStep[2],
        percent: step2 > 0 ? ((abandonByStep[2] / step2) * 100).toFixed(1) : "0",
      },
      {
        step: 3,
        label: "Adicionou extras → Não foi ao checkout",
        description: "Cliente configurou extras mas não finalizou. Possíveis motivos: valor final alto, proteções caras, indecisão.",
        count: abandonByStep[3],
        percent: step3 > 0 ? ((abandonByStep[3] / step3) * 100).toFixed(1) : "0",
      },
      {
        step: 4,
        label: "Chegou ao checkout → Não pagou",
        description: "Cliente foi ao checkout mas não concluiu. Possíveis motivos: erro no pagamento, cartão recusado, PIX não pago, desistência final.",
        count: abandonByStep[4],
        percent: step4 > 0 ? ((abandonByStep[4] / step4) * 100).toFixed(1) : "0",
      },
    ];

    // ─── Payment method distribution ───────────────────
    const paymentMethods: Record<string, number> = {};
    journeys.forEach((j) => {
      if (j.status === "COMPLETED" && j.paymentMethod) {
        paymentMethods[j.paymentMethod] = (paymentMethods[j.paymentMethod] || 0) + 1;
      }
    });

    return NextResponse.json({
      topDestinations,
      topCars,
      topExtras,
      funnel: { step1, step2, step3, step4, step5 },
      abandonByStep,
      abandonReasons,
      conversionRate,
      totalSessions,
      completedCount,
      abandonedCount: abandoned.length,
      paymentMethods,
    });
  } catch (error: any) {
    console.error("[Analytics Error]", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
