/**
 * guestAccount
 *
 * Cria (se ainda não existir) a conta do cliente que reservou sem login (guest checkout)
 * e envia o e-mail com a senha temporária.
 *
 * IMPORTANTE: deve ser chamado DEPOIS do e-mail de confirmação da reserva — assim o cliente
 * nunca recebe a senha sem antes receber (ou ao menos tentar receber) a confirmação.
 * Para PIX, só é chamado quando o pagamento é confirmado (antes disso não há reserva confirmada).
 */
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { sendWelcomeWithCredentials } from '@/lib/email/sendWelcomeWithCredentials';

/** Gera senha aleatória legível de 12 caracteres */
function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/** Retorna true se uma conta nova foi criada. Nunca lança exceção. */
export async function ensureGuestAccountAndWelcome(params: {
  customerData: any;
  resNumber?: string | null;
}): Promise<boolean> {
  const cd = params.customerData || {};
  const email = (cd.email || '').trim().toLowerCase();
  if (!email) return false;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) return false;

    const tempPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const fullName = `${cd.nome || ''} ${cd.sobrenome || ''}`.trim();

    await prisma.user.create({
      data: {
        name: fullName,
        email,
        password: hashedPassword,
        phone: cd.telefone || null,
        cpf: cd.cpf?.replace(/\D/g, '').slice(0, 11) || null,
        role: 'USER',
        status: 'ACTIVE',
      },
    });

    console.log(`[guestAccount] ✅ Conta criada automaticamente para ${email} (reserva ${params.resNumber})`);

    await sendWelcomeWithCredentials({
      toEmail: (cd.email || '').trim(),
      firstName: cd.nome || fullName,
      password: tempPassword,
      resNumber: params.resNumber || undefined,
    });
    return true;
  } catch (err: any) {
    console.error('[guestAccount] Falha ao criar conta automática:', err?.message || err);
    return false;
  }
}
