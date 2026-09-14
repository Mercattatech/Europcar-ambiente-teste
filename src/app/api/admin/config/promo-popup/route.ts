import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_CONFIG = {
  active: true,
  title: "Aproveite a Promoção!",
  message: "Aproveite a promoção, pagamento no cartão de crédito ou pix com até 6% de desconto e cancelamento grátis.",
  primaryBtnText: "Garantir Desconto (Pagar Online)",
  secondaryBtnText: "Continuar sem Desconto (Pagar no Balcão)",
  badgeText: "PROMOÇÃO EXCLUSIVA",
  imageUrl: ""
};

export async function GET() {
  try {
    const block = await prisma.contentBlock.findUnique({
      where: { key: "PROMO_BALCAO_POPUP" }
    });

    if (!block) {
      return NextResponse.json(DEFAULT_CONFIG);
    }

    const parsed = JSON.parse(block.value_ptBR);
    return NextResponse.json({ ...DEFAULT_CONFIG, ...parsed });
  } catch (error) {
    return NextResponse.json(DEFAULT_CONFIG);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const jsonString = JSON.stringify(body);

    const updated = await prisma.contentBlock.upsert({
      where: { key: "PROMO_BALCAO_POPUP" },
      update: { value_ptBR: jsonString },
      create: { key: "PROMO_BALCAO_POPUP", value_ptBR: jsonString }
    });

    return NextResponse.json({ success: true, data: JSON.parse(updated.value_ptBR) });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Erro ao salvar" }, { status: 500 });
  }
}
