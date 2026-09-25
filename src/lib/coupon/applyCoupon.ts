/**
 * applyCoupon() — Função central de aplicação de cupom.
 *
 * Após validação, registra o uso do cupom, atualiza contadores
 * e gera comissão se aplicável.
 * Usa transação atômica para evitar race conditions.
 */

import prisma from '@/lib/prisma';
import { validateCoupon, ValidateCouponResult } from './validateCoupon';

export interface ApplyCouponInput {
  code: string;
  customerEmail: string;
  customerName?: string;
  reservationId?: string;
  resNumber?: string;
  orderValue: number;
  carCategory?: string;
}

export interface ApplyCouponResult extends ValidateCouponResult {
  usageId?: string;
  commissionId?: string;
}

/** Mascara nome para LGPD: "Matheus Conti" → "Mat*** C***" */
function maskName(name: string): string {
  return name.split(' ').map(part => {
    if (part.length <= 2) return part;
    return part.substring(0, 3) + '***';
  }).join(' ');
}

export async function applyCoupon(input: ApplyCouponInput): Promise<ApplyCouponResult> {
  const { code, customerEmail, customerName, reservationId, resNumber, orderValue, carCategory } = input;

  // 1. Validar primeiro
  const validation = await validateCoupon({
    code,
    customerEmail,
    orderValue,
    carCategory,
  });

  if (!validation.valid) {
    return { ...validation };
  }

  const coupon = validation.coupon!;
  const partner = validation.partner;

  // 2. Aplicar em transação atômica (evita race condition)
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-verificar limite dentro da transação (lock)
      const freshCoupon = await tx.coupon.findUnique({ where: { id: coupon.id } });
      if (!freshCoupon) throw new Error('Cupom não encontrado');
      if (freshCoupon.maxUses !== null && freshCoupon.maxUses !== undefined && freshCoupon.currentUses >= freshCoupon.maxUses) {
        throw new Error('LIMIT_REACHED');
      }

      // Incrementar contador
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { currentUses: { increment: 1 } },
      });

      // Calcular comissão
      let commissionAmount = 0;
      if (partner?.commissionEnabled && partner.commissionValue) {
        const base = partner.commissionBase === 'GROSS' ? orderValue
          : partner.commissionBase === 'NET' ? validation.finalValue
          : partner.commissionBase === 'PAID' ? validation.finalValue
          : partner.commissionValue; // FIXED

        if (partner.commissionType === 'PERCENTAGE') {
          commissionAmount = Math.round(base * (partner.commissionValue / 100) * 100) / 100;
        } else {
          commissionAmount = partner.commissionValue;
        }
      }

      // Criar CouponUsage
      const usage = await tx.couponUsage.create({
        data: {
          couponId: coupon.id,
          partnerId: partner?.id || null,
          reservationId: reservationId || null,
          resNumber: resNumber || null,
          couponCodeSnapshot: coupon.code,
          discountTypeSnapshot: coupon.discountType,
          discountValueSnapshot: coupon.discountValue,
          originalValue: orderValue,
          discountAmount: validation.discountAmount,
          finalValue: validation.finalValue,
          customerEmail: customerEmail?.toLowerCase() || null,
          customerNamePartial: customerName ? maskName(customerName) : null,
          commissionAmount,
          status: coupon.discountType === 'FREE' ? 'COURTESY' : 'CONFIRMED',
        },
      });

      // Criar comissão se aplicável
      let commissionRecord = null;
      if (partner?.commissionEnabled && commissionAmount > 0) {
        const releaseDelay = partner.commissionReleaseDelayDays || 7;
        const availableAt = new Date();
        availableAt.setDate(availableAt.getDate() + releaseDelay);

        commissionRecord = await tx.commission.create({
          data: {
            partnerId: partner.id,
            couponId: coupon.id,
            couponUsageId: usage.id,
            amount: commissionAmount,
            status: 'FORECAST',
            availableAt,
          },
        });
      }

      // Registrar evento de auditoria
      await tx.couponAuditLog.create({
        data: {
          couponId: coupon.id,
          action: 'USED',
          newData: {
            usageId: usage.id,
            customerEmail: customerEmail?.toLowerCase(),
            orderValue,
            discountAmount: validation.discountAmount,
            finalValue: validation.finalValue,
            resNumber,
          },
        },
      });

      return { usage, commissionRecord };
    });

    return {
      ...validation,
      usageId: result.usage.id,
      commissionId: result.commissionRecord?.id,
    };
  } catch (err: any) {
    if (err.message === 'LIMIT_REACHED') {
      return {
        valid: false,
        originalValue: orderValue,
        discountAmount: 0,
        finalValue: orderValue,
        discountLabel: '',
        message: 'Este cupom acabou de atingir o limite de utilizações.',
        errorCode: 'RACE_CONDITION_LIMIT',
      };
    }
    console.error('[applyCoupon] Erro:', err);
    return {
      valid: false,
      originalValue: orderValue,
      discountAmount: 0,
      finalValue: orderValue,
      discountLabel: '',
      message: 'Erro ao aplicar cupom. Tente novamente.',
      errorCode: 'INTERNAL_ERROR',
    };
  }
}

/**
 * revokeUsage() — Estorno / cancelamento de uso de cupom.
 * Reverte o contador e cancela comissão associada.
 */
export async function revokeUsage(usageId: string): Promise<{ success: boolean; message: string }> {
  try {
    const usage = await prisma.couponUsage.findUnique({
      where: { id: usageId },
      include: { commissions: true },
    });

    if (!usage) return { success: false, message: 'Utilização não encontrada.' };
    if (usage.status === 'CANCELLED' || usage.status === 'REFUNDED') {
      return { success: false, message: 'Esta utilização já foi cancelada/estornada.' };
    }

    await prisma.$transaction(async (tx) => {
      // Atualizar status do usage
      await tx.couponUsage.update({
        where: { id: usageId },
        data: { status: 'CANCELLED' },
      });

      // Decrementar contador do cupom
      await tx.coupon.update({
        where: { id: usage.couponId },
        data: { currentUses: { decrement: 1 } },
      });

      // Cancelar comissões associadas
      if (usage.commissions.length > 0) {
        await tx.commission.updateMany({
          where: { couponUsageId: usageId, status: { notIn: ['PAID'] } },
          data: { status: 'CANCELLED' },
        });
      }

      // Registrar auditoria
      await tx.couponAuditLog.create({
        data: {
          couponId: usage.couponId,
          action: 'CANCELLED',
          oldData: { usageId, status: usage.status },
          newData: { usageId, status: 'CANCELLED', reason: 'revoke' },
        },
      });
    });

    return { success: true, message: 'Utilização cancelada e cupom restaurado.' };
  } catch (err: any) {
    console.error('[revokeUsage] Erro:', err);
    return { success: false, message: 'Erro ao estornar utilização.' };
  }
}
