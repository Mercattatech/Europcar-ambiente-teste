/**
 * validateCoupon() — Função central de validação de cupom.
 *
 * Verifica todas as condições ANTES de permitir o uso:
 * 1. Cupom existe?
 * 2. Está ativo?
 * 3. Já iniciou?
 * 4. Expirou?
 * 5. Atingiu limite total?
 * 6. Cliente já utilizou (limite por cliente)?
 * 7. Limite diário atingido?
 * 8. Limite mensal atingido?
 * 9. Valor mínimo do pedido atendido?
 * 10. Categoria permitida?
 * 11. Requer aprovação admin?
 */

import prisma from '@/lib/prisma';

export interface ValidateCouponInput {
  code: string;
  customerEmail?: string;
  orderValue?: number;
  carCategory?: string;
}

export interface ValidateCouponResult {
  valid: boolean;
  coupon?: any;
  partner?: any;
  originalValue: number;
  discountAmount: number;
  finalValue: number;
  discountLabel: string;
  message: string;
  errorCode?: string;
}

export async function validateCoupon(input: ValidateCouponInput): Promise<ValidateCouponResult> {
  const { code, customerEmail, orderValue = 0, carCategory } = input;
  const fail = (message: string, errorCode: string): ValidateCouponResult => ({
    valid: false, originalValue: orderValue, discountAmount: 0, finalValue: orderValue,
    discountLabel: '', message, errorCode,
  });

  if (!code || code.trim().length === 0) {
    return fail('Código do cupom é obrigatório.', 'EMPTY_CODE');
  }

  // 1. Cupom existe?
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase().trim() },
    include: { partner: true },
  });

  if (!coupon) {
    return fail('Cupom não encontrado.', 'NOT_FOUND');
  }

  // 2. Está ativo?
  if (coupon.status !== 'ACTIVE') {
    const statusMessages: Record<string, string> = {
      DRAFT: 'Este cupom ainda não foi publicado.',
      SCHEDULED: 'Este cupom ainda não está disponível.',
      PAUSED: 'Este cupom está temporariamente pausado.',
      EXPIRED: 'Este cupom expirou.',
      BLOCKED: 'Este cupom foi bloqueado.',
      CLOSED: 'Este cupom foi encerrado.',
    };
    return fail(statusMessages[coupon.status] || 'Cupom indisponível.', 'INACTIVE');
  }

  const now = new Date();

  // 3. Já iniciou?
  if (coupon.startsAt && now < coupon.startsAt) {
    return fail('Este cupom ainda não está disponível.', 'NOT_STARTED');
  }

  // 4. Expirou?
  if (coupon.hasExpiration && coupon.expiresAt && now > coupon.expiresAt) {
    // Auto-expirar
    await prisma.coupon.update({ where: { id: coupon.id }, data: { status: 'EXPIRED' } });
    return fail('Este cupom expirou.', 'EXPIRED');
  }

  // 5. Atingiu limite total?
  if (coupon.maxUses !== null && coupon.maxUses !== undefined && coupon.currentUses >= coupon.maxUses) {
    return fail('Este cupom atingiu o limite máximo de utilizações.', 'MAX_USES_REACHED');
  }

  // 6. Limite por cliente?
  if (customerEmail && coupon.maxUsesPerCustomer) {
    const customerUses = await prisma.couponUsage.count({
      where: {
        couponId: coupon.id,
        customerEmail: customerEmail.toLowerCase(),
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
    });
    if (customerUses >= coupon.maxUsesPerCustomer) {
      return fail('Você já utilizou este cupom o número máximo de vezes.', 'MAX_USES_PER_CUSTOMER');
    }
  }

  // 7. Limite diário?
  if (coupon.maxUsesPerDay) {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const dailyUses = await prisma.couponUsage.count({
      where: {
        couponId: coupon.id,
        usedAt: { gte: startOfDay },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
    });
    if (dailyUses >= coupon.maxUsesPerDay) {
      return fail('Este cupom atingiu o limite de uso para hoje.', 'MAX_DAILY_USES');
    }
  }

  // 8. Limite mensal?
  if (coupon.maxUsesPerMonth) {
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const monthlyUses = await prisma.couponUsage.count({
      where: {
        couponId: coupon.id,
        usedAt: { gte: startOfMonth },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
    });
    if (monthlyUses >= coupon.maxUsesPerMonth) {
      return fail('Este cupom atingiu o limite de uso para este mês.', 'MAX_MONTHLY_USES');
    }
  }

  // 9. Valor mínimo?
  if (coupon.minimumOrderValue && orderValue < coupon.minimumOrderValue) {
    return fail(
      `Valor mínimo do pedido para este cupom: R$ ${coupon.minimumOrderValue.toFixed(2).replace('.', ',')}`,
      'MIN_ORDER_VALUE'
    );
  }

  // 10. Categoria permitida?
  if (carCategory && coupon.allowedCategories) {
    try {
      const allowed: string[] = JSON.parse(coupon.allowedCategories);
      if (allowed.length > 0 && !allowed.includes(carCategory)) {
        return fail('Este cupom não é válido para a categoria selecionada.', 'CATEGORY_NOT_ALLOWED');
      }
    } catch { /* parse error — ignorar filtro */ }
  }
  if (carCategory && coupon.excludedCategories) {
    try {
      const excluded: string[] = JSON.parse(coupon.excludedCategories);
      if (excluded.includes(carCategory)) {
        return fail('Este cupom não é válido para a categoria selecionada.', 'CATEGORY_EXCLUDED');
      }
    } catch { /* parse error — ignorar filtro */ }
  }

  // 11. Requer aprovação?
  if (coupon.requiresApproval) {
    return fail('Este cupom requer autorização administrativa para uso.', 'REQUIRES_APPROVAL');
  }

  // ── Calcular desconto ──
  let discountAmount = 0;
  let discountLabel = '';

  switch (coupon.discountType) {
    case 'PERCENTAGE': {
      const pct = coupon.discountValue || 0;
      discountAmount = orderValue * (pct / 100);
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
      discountLabel = `${pct}% de desconto`;
      break;
    }
    case 'FIXED_VALUE': {
      discountAmount = Math.min(coupon.discountValue || 0, orderValue);
      discountLabel = `R$ ${discountAmount.toFixed(2).replace('.', ',')} de desconto`;
      break;
    }
    case 'FREE': {
      discountAmount = orderValue;
      discountLabel = 'Cortesia (100% grátis)';
      break;
    }
  }

  discountAmount = Math.round(discountAmount * 100) / 100;
  const finalValue = Math.max(0, Math.round((orderValue - discountAmount) * 100) / 100);

  return {
    valid: true,
    coupon,
    partner: coupon.partner || undefined,
    originalValue: orderValue,
    discountAmount,
    finalValue,
    discountLabel,
    message: `Cupom "${coupon.code}" aplicado! ${discountLabel}`,
  };
}
