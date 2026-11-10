import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { calcCommission, isAdminRole, isSellerRole } from '@/lib/sellerCommission';
import { ADMIN_EMAILS } from '@/lib/checkAdmin';

export type SessionActor = {
  kind: 'ADMIN' | 'VENDEDOR_ADMIN' | 'VENDEDOR';
  isAdmin: boolean;
  isSeller: boolean;
  id: string | null;
  email: string;
  name: string | null;
  commissionType: string | null;
  commissionValue: number | null;
} | null;

/** Identifica quem está logado: admin, vendedor+admin, apenas vendedor ou nenhum. Sempre confere no banco. */
export async function getActor(): Promise<SessionActor> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;
  const dbUser = await prisma.user.findUnique({ where: { email } });
  const isBlocked = dbUser?.status === 'BLOCKED';
  const isAdmin = ADMIN_EMAILS.includes(email) || (!isBlocked && isAdminRole(dbUser?.role));
  const isSeller = !isBlocked && isSellerRole(dbUser?.role) && !!dbUser?.id;

  if (isAdmin && isSeller && dbUser) {
    return {
      kind: 'VENDEDOR_ADMIN',
      isAdmin: true,
      isSeller: true,
      id: dbUser.id,
      email,
      name: dbUser.name,
      commissionType: dbUser.commissionType,
      commissionValue: dbUser.commissionValue,
    };
  }
  if (isAdmin) {
    return {
      kind: 'ADMIN',
      isAdmin: true,
      isSeller: false,
      id: dbUser?.id ?? null,
      email,
      name: dbUser?.name ?? null,
      commissionType: null,
      commissionValue: null,
    };
  }
  if (isSeller && dbUser) {
    return {
      kind: 'VENDEDOR',
      isAdmin: false,
      isSeller: true,
      id: dbUser.id,
      email,
      name: dbUser.name,
      commissionType: dbUser.commissionType,
      commissionValue: dbUser.commissionValue,
    };
  }
  return null;
}

export { calcCommission, isAdminRole, isSellerRole };

/** Link com validade padrão de 24h. */
export const PAYMENT_LINK_TTL_MS = 24 * 60 * 60 * 1000;

/** Status de LocalReservation que NÃO representam venda concluída. */
export const NOT_SOLD_STATUSES = ['PENDING_PIX', 'CANCELLED', 'CANCELLED_GREENWAY', 'ON_REQUEST_REJECTED'];

/**
 * Antes de cobrar: valida o link de pagamento informado pelo cliente.
 * Retorna { error } se o link não puder mais ser usado.
 */
export async function validatePaymentLinkForSale(token: string | undefined | null) {
  if (!token) return { link: null as any, error: null as string | null };
  const link = await prisma.paymentLink.findUnique({ where: { token: String(token) } });
  if (!link) return { link: null as any, error: 'Link de pagamento inválido.' };
  if (link.status !== 'PENDING') return { link: null as any, error: 'Este link de pagamento já foi utilizado ou cancelado.' };
  if (link.expiresAt.getTime() < Date.now()) return { link: null as any, error: 'Este link de pagamento expirou. Solicite um novo link.' };
  return { link, error: null as string | null };
}

/**
 * Depois da reserva gravada:
 * - Se veio de um link de pagamento: marca o link como USED. Só calcula comissão se o link pertencer a um vendedor (sellerId != null).
 * - Se foi venda direta feita por vendedor logado (VENDEDOR ou VENDEDOR_ADMIN): cria registro já USED vinculado ao vendedor.
 * - Usuário comum ou admin puro sem link: não gera registro nem comissão.
 * Nunca lança erro — falha aqui não pode afetar a reserva já paga.
 */
export async function registerSellerSale(opts: {
  link: any | null;
  actor: SessionActor;
  resNumber: string | null | undefined;
  merchantOrderId: string;
  paymentMethod: string;
  amountInCents: number;
  bookingData: any;
  customerData: any;
}) {
  try {
    const totalBRL = (opts.amountInCents || 0) / 100;
    const common = {
      resNumber: opts.resNumber || null,
      merchantOrderId: opts.merchantOrderId,
      paymentMethod: opts.paymentMethod,
      status: 'USED',
      usedAt: new Date(),
    };
    if (opts.link) {
      const hasSeller = !!opts.link.sellerId;
      await prisma.paymentLink.update({
        where: { id: opts.link.id },
        data: {
          ...common,
          amountInCents: opts.amountInCents || opts.link.amountInCents,
          commissionAmount: hasSeller
            ? calcCommission(opts.link.commissionType, opts.link.commissionRate, totalBRL)
            : null,
        },
      });
    } else if (opts.actor?.isSeller && opts.actor.id) {
      const { creditCard: _cc, cvv: _cvv, cardNumber: _cn, ...safe } = opts.customerData || {};
      await prisma.paymentLink.create({
        data: {
          token: 'direct_' + crypto.randomBytes(12).toString('base64url'),
          sellerId: opts.actor.id,
          customerName: `${safe.nome || ''} ${safe.sobrenome || ''}`.trim() || '—',
          customerEmail: safe.email || '',
          customerPhone: safe.telefone || null,
          bookingData: opts.bookingData || {},
          customerData: safe,
          amountInCents: opts.amountInCents || 0,
          expiresAt: new Date(),
          commissionType: opts.actor.commissionType,
          commissionRate: opts.actor.commissionValue,
          commissionAmount: calcCommission(opts.actor.commissionType, opts.actor.commissionValue, totalBRL),
          ...common,
        },
      });
    }
  } catch (e: any) {
    console.error('[sellers] Falha ao registrar venda do vendedor:', e?.message);
  }
}
