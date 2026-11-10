import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { calcCommission } from '@/lib/sellerCommission';

const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com", "admin@mercatta.com.br"];

export type SessionActor =
  | { kind: 'ADMIN'; id: string | null; email: string }
  | { kind: 'VENDEDOR'; id: string; email: string; name: string | null; commissionType: string | null; commissionValue: number | null }
  | null;

/** Identifica quem está logado: admin, vendedor ativo ou ninguém. Sempre confere no banco. */
export async function getActor(): Promise<SessionActor> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;
  const dbUser = await prisma.user.findUnique({ where: { email } });
  if (ADMIN_EMAILS.includes(email) || dbUser?.role === 'ADMIN') {
    return { kind: 'ADMIN', id: dbUser?.id ?? null, email };
  }
  if (dbUser?.role === 'VENDEDOR' && dbUser.status !== 'BLOCKED') {
    return {
      kind: 'VENDEDOR', id: dbUser.id, email, name: dbUser.name,
      commissionType: dbUser.commissionType, commissionValue: dbUser.commissionValue,
    };
  }
  return null;
}

export { calcCommission };

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
  if (link.expiresAt.getTime() < Date.now()) return { link: null as any, error: 'Este link de pagamento expirou. Solicite um novo ao seu consultor.' };
  return { link, error: null as string | null };
}

/**
 * Depois da reserva gravada: vincula a venda ao vendedor e calcula a comissão sugerida.
 * - Venda via link do cliente: marca o link como USED.
 * - Venda direta feita por vendedor logado: cria registro já USED (sem link compartilhável).
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
      await prisma.paymentLink.update({
        where: { id: opts.link.id },
        data: {
          ...common,
          amountInCents: opts.amountInCents || opts.link.amountInCents,
          commissionAmount: calcCommission(opts.link.commissionType, opts.link.commissionRate, totalBRL),
        },
      });
    } else if (opts.actor?.kind === 'VENDEDOR') {
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
