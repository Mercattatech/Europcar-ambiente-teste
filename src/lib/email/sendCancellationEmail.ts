/**
 * sendCancellationEmail
 *
 * Fallback hardcoded para e-mail de cancelamento.
 * Usado quando o template CANCELAMENTO não está cadastrado no painel.
 */
import { sendEmail } from '@/lib/emailService';
import prisma from '@/lib/prisma';

interface CancellationEmailData {
  toEmail: string;
  customerName: string;
  resNumber: string;
  carName: string;
  pickupStation: string;
  returnStation: string;
  pickupDate: string;
  returnDate: string;
  paymentMethod: string;
  totalBRL?: number;
}

function formatXRSDate(d: string): string {
  if (!d || d.length < 8) return d || '—';
  return `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}`;
}

function paymentLabel(method: string): string {
  const map: Record<string, string> = {
    BALCAO: 'Pagamento no Balcão',
    PIX: 'PIX',
    CREDIT: 'Cartão de Crédito',
    VOUCHER: 'Voucher ETO (Faturado)',
  };
  return map[method] || method;
}

async function getFromEmail(): Promise<string> {
  try {
    const block = await prisma.contentBlock.findUnique({ where: { key: 'RESEND_FROM_EMAIL' } });
    if (block?.value_ptBR) return block.value_ptBR;
  } catch { /* ignora */ }
  return process.env.RESEND_FROM_EMAIL || 'nao-responda@europcar.com.br';
}

export async function sendCancellationEmail(data: CancellationEmailData) {
  const fromEmail = await getFromEmail();

  const {
    toEmail, customerName, resNumber, carName,
    pickupStation, returnStation, pickupDate, returnDate,
    paymentMethod, totalBRL,
  } = data;

  const subject = `❌ Reserva cancelada — Europcar Brasil`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#008d36;padding:28px 32px;text-align:center;">
      <div style="font-size:32px;font-weight:900;font-style:italic;color:#fff;letter-spacing:-1px;">Europcar</div>
      <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px;">europcar.com.br</div>
    </div>

    <!-- Hero -->
    <div style="background:#dc2626;padding:20px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;">Reserva Cancelada</h1>
      <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">Sua reserva foi cancelada com sucesso.</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">

      <p style="color:#374151;font-size:15px;margin-top:0;">Olá, <strong>${customerName}</strong>!</p>

      <p style="color:#6b7280;font-size:14px;">Confirmamos o cancelamento da sua reserva. Segue abaixo o resumo:</p>

      <!-- Reservation Number -->
      <div style="background:#fef2f2;border:2px solid #dc2626;border-radius:10px;padding:20px;text-align:center;margin:20px 0;">
        <div style="font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Número da Reserva</div>
        <div style="font-size:36px;font-weight:900;color:#dc2626;letter-spacing:3px;text-decoration:line-through;">${resNumber}</div>
        <div style="display:inline-block;margin-top:8px;background:#dc2626;color:#fff;font-size:11px;font-weight:700;padding:3px 12px;border-radius:20px;">Cancelada ✕</div>
      </div>

      <!-- Details Table -->
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tbody>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:12px 0;color:#6b7280;font-size:13px;font-weight:700;width:140px;">Veículo</td>
            <td style="padding:12px 0;color:#111827;font-size:13px;font-weight:bold;">${carName}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:12px 0;color:#6b7280;font-size:13px;font-weight:700;">Retirada</td>
            <td style="padding:12px 0;color:#111827;font-size:13px;">${pickupStation} · ${formatXRSDate(pickupDate)}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:12px 0;color:#6b7280;font-size:13px;font-weight:700;">Devolução</td>
            <td style="padding:12px 0;color:#111827;font-size:13px;">${returnStation} · ${formatXRSDate(returnDate)}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:12px 0;color:#6b7280;font-size:13px;font-weight:700;">Pagamento</td>
            <td style="padding:12px 0;color:#111827;font-size:13px;">${paymentLabel(paymentMethod)}</td>
          </tr>
          ${totalBRL && totalBRL > 0 ? `
          <tr>
            <td style="padding:12px 0;color:#6b7280;font-size:13px;font-weight:700;">Valor</td>
            <td style="padding:12px 0;color:#dc2626;font-size:15px;font-weight:900;text-decoration:line-through;">R$ ${totalBRL.toFixed(2).replace('.', ',')}</td>
          </tr>
          ` : ''}
        </tbody>
      </table>

      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 16px;margin:20px 0;">
        <strong style="color:#991b1b;font-size:13px;">💡 Informações importantes</strong>
        <p style="color:#991b1b;font-size:13px;margin:4px 0 0;">
          Se houve cobrança no cartão de crédito, o estorno será processado automaticamente em até 10 dias úteis. 
          Para pagamentos via PIX, o reembolso será enviado à conta de origem.
        </p>
      </div>

      <p style="color:#6b7280;font-size:13px;">
        Precisa de uma nova reserva? Acesse <a href="https://europcar.com.br" style="color:#008d36;font-weight:bold;">europcar.com.br</a>.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">
        © 2025 Europcar Brasil · Todos os direitos reservados<br/>
        Este é um e-mail automático, por favor não responda.
      </p>
    </div>

  </div>
</body>
</html>
  `;

  try {
    const result = await sendEmail(fromEmail, toEmail, subject, html);
    if (result.success) {
      console.log(`[email] ✅ Cancelamento enviado via ${result.provider} para ${toEmail} — resNumber: ${resNumber}`);
    } else {
      console.error(`[email] ❌ Falha ao enviar cancelamento para ${toEmail}: ${result.error}`);
    }
  } catch (error: any) {
    console.error(`[email] Exceção ao enviar cancelamento para ${toEmail}:`, error.message);
  }
}
