/**
 * sendBookingConfirmation
 *
 * Usa o provedor configurado no painel (/painel/config-email):
 * SMTP (Nodemailer) ou Resend — via sendEmail() do emailService.
 *
 * Antes usava process.env.RESEND_API_KEY diretamente, o que
 * causava falha silenciosa em produção (token salvo no banco, não no .env).
 */
import { sendEmail } from '@/lib/emailService';
import prisma from '@/lib/prisma';
import { getStationInfo } from '@/lib/europcar/stationInfo';

interface BookingConfirmationData {
  toEmail: string;
  customerName: string;
  resNumber: string;
  carName: string;
  pickupStation: string;
  returnStation: string;
  pickupStationName?: string;
  returnStationName?: string;
  pickupStationAddress?: string;
  returnStationAddress?: string;
  pickupStationPhone?: string;
  returnStationPhone?: string;
  pickupDate: string;
  returnDate: string;
  paymentMethod: string;
  totalBRL?: number;
  isOnRequest?: boolean;
  xrsEquipment?: Array<{ code: string; name?: string; icon?: string; qty: number; price?: number; priceBRL?: number; currency?: string }>;
  extras?: Array<{ code: string; name?: string; qty: number; priceBRL?: number }>;
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

export async function sendBookingConfirmation(data: BookingConfirmationData): Promise<boolean> {
  const fromEmail = await getFromEmail();

  let {
    toEmail, customerName, resNumber, carName,
    pickupStation, returnStation, pickupDate, returnDate,
    pickupStationName, returnStationName,
    pickupStationAddress, returnStationAddress,
    pickupStationPhone, returnStationPhone,
    paymentMethod, totalBRL, isOnRequest,
  } = data;

  // Resolve endereços das estações se não vierem preenchidos
  try {
    const [pInfo, rInfo] = await Promise.all([
      (!pickupStationAddress && pickupStation) ? getStationInfo(pickupStation, 3000) : null,
      (!returnStationAddress && returnStation && returnStation !== pickupStation) ? getStationInfo(returnStation, 3000) : null,
    ]);
    if (pInfo) {
      if (!pickupStationName || pickupStationName === pickupStation) pickupStationName = pInfo.name;
      if (!pickupStationAddress) pickupStationAddress = pInfo.fullAddress;
      if (!pickupStationPhone) pickupStationPhone = pInfo.phone;
    }
    if (rInfo) {
      if (!returnStationName || returnStationName === returnStation) returnStationName = rInfo.name;
      if (!returnStationAddress) returnStationAddress = rInfo.fullAddress;
      if (!returnStationPhone) returnStationPhone = rInfo.phone;
    } else if (!returnStationAddress && (!returnStation || returnStation === pickupStation)) {
      returnStationName = returnStationName || pickupStationName;
      returnStationAddress = pickupStationAddress;
      returnStationPhone = returnStationPhone || pickupStationPhone;
    }
  } catch { /* mantém os dados fornecidos */ }

  const statusColor = isOnRequest ? '#f59e0b' : '#008d36';
  const statusLabel = isOnRequest ? 'Aguardando Confirmação' : 'Confirmada ✓';
  const title = isOnRequest ? 'Sua solicitação foi recebida!' : 'Reserva Confirmada!';
  const subtitle = isOnRequest
    ? 'Sua reserva está em análise. Você receberá uma confirmação em até 8 horas úteis.'
    : 'Obrigado por escolher a Europcar. Apresente o número abaixo no balcão de retirada.';

  const subject = `${isOnRequest ? '🕐 Reserva em análise' : '✅ Reserva confirmada'} — Europcar Brasil`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<style>
* { box-sizing: border-box; }
@media only screen and (max-width: 620px) {
  .body-wrap { margin: 12px auto !important; width: 100% !important; border-radius: 8px !important; }
  .content-pad { padding: 18px 14px !important; }
  .res-num-hero { font-size: 26px !important; letter-spacing: 2px !important; }
  .hdr-pad { padding: 20px 14px !important; }
  .hero-pad { padding: 16px 14px !important; }
  .detail-label { width: 38% !important; font-size: 12px !important; padding: 10px 6px 10px 0 !important; }
  .detail-val { width: 62% !important; font-size: 13px !important; padding: 10px 0 !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
  <div class="body-wrap" style="width:100%;max-width:600px;margin:24px auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);box-sizing:border-box;">

    <!-- Header -->
    <div class="hdr-pad" style="background:#008d36;padding:26px 28px;text-align:center;border-bottom:5px solid #FFD800;">
      <div style="line-height:0;font-size:0;"><img src="https://europcar.com.br/logo-email.png" width="150" height="35" alt="Europcar" style="display:inline-block;width:150px;height:35px;border:0;outline:none;text-decoration:none;"></div>
      <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px;">europcar.com.br</div>
    </div>

    <!-- Hero -->
    <div class="hero-pad" style="background:${statusColor};padding:20px 28px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:900;">${title}</h1>
      <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">${subtitle}</p>
    </div>

    <!-- Body -->
    <div class="content-pad" style="padding:28px 28px;">

      <p style="color:#374151;font-size:15px;margin-top:0;">Olá, <strong>${customerName}</strong>!</p>

      <!-- Reservation Number -->
      <div style="background:#f9fafb;border:2px solid ${statusColor};border-radius:10px;padding:18px;text-align:center;margin:18px 0;">
        <div style="font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Número da Reserva</div>
        <div class="res-num-hero" style="font-size:34px;font-weight:900;color:${statusColor};letter-spacing:3px;word-break:break-all;">${resNumber}</div>
        <div style="display:inline-block;margin-top:8px;background:${statusColor};color:#fff;font-size:11px;font-weight:700;padding:3px 12px;border-radius:20px;">${statusLabel}</div>
      </div>

      <!-- Details Table -->
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tbody>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td class="detail-label" style="padding:12px 0;color:#6b7280;font-size:13px;font-weight:700;width:130px;">Veículo</td>
            <td class="detail-val" style="padding:12px 0;color:#111827;font-size:13px;font-weight:bold;word-break:break-word;">${carName}</td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td class="detail-label" style="padding:12px 0;color:#6b7280;font-size:13px;font-weight:700;vertical-align:top;width:130px;">Retirada</td>
            <td class="detail-val" style="padding:12px 0;color:#111827;font-size:13px;word-break:break-word;">
              <strong>${pickupStationName || pickupStation}</strong>${pickupStation && pickupStation !== pickupStationName ? ` <span style="color:#6b7280;font-weight:normal;">(${pickupStation})</span>` : ''} · ${formatXRSDate(pickupDate)}
              ${pickupStationAddress ? `<div style="margin-top:4px;color:#4b5563;font-size:12px;line-height:1.4;">📍 ${pickupStationAddress}</div>` : ''}
              ${pickupStationPhone ? `<div style="margin-top:2px;color:#6b7280;font-size:11px;">Tel: ${pickupStationPhone}</div>` : ''}
            </td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td class="detail-label" style="padding:12px 0;color:#6b7280;font-size:13px;font-weight:700;vertical-align:top;width:130px;">Devolução</td>
            <td class="detail-val" style="padding:12px 0;color:#111827;font-size:13px;word-break:break-word;">
              <strong>${returnStationName || returnStation}</strong>${returnStation && returnStation !== returnStationName ? ` <span style="color:#6b7280;font-weight:normal;">(${returnStation})</span>` : ''} · ${formatXRSDate(returnDate)}
              ${returnStationAddress ? `<div style="margin-top:4px;color:#4b5563;font-size:12px;line-height:1.4;">📍 ${returnStationAddress}</div>` : ''}
              ${returnStationPhone ? `<div style="margin-top:2px;color:#6b7280;font-size:11px;">Tel: ${returnStationPhone}</div>` : ''}
            </td>
          </tr>
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td class="detail-label" style="padding:12px 0;color:#6b7280;font-size:13px;font-weight:700;width:130px;">Pagamento</td>
            <td class="detail-val" style="padding:12px 0;color:#111827;font-size:13px;word-break:break-word;">${paymentLabel(paymentMethod)}</td>
          </tr>
          ${totalBRL && totalBRL > 0 ? `
          <tr>
            <td class="detail-label" style="padding:12px 0;color:#6b7280;font-size:13px;font-weight:700;width:130px;">Total</td>
            <td class="detail-val" style="padding:12px 0;color:#008d36;font-size:15px;font-weight:900;">R$ ${totalBRL.toFixed(2).replace('.', ',')}</td>
          </tr>
          ` : ''}
        </tbody>
      </table>

      ${data.xrsEquipment && data.xrsEquipment.length > 0 ? `
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 16px;margin:12px 0;">
        <strong style="color:#9a3412;font-size:13px;">🧳 Acessórios Inclusos</strong>
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          ${data.xrsEquipment.map(eq => {
            const pBRL = eq.priceBRL || 0;
            return `<tr>
              <td style="padding:4px 0;color:#374151;font-size:13px;">${eq.icon || '📦'} ${eq.name || eq.code} ×${eq.qty}</td>
              <td style="padding:4px 0;color:#374151;font-size:13px;text-align:right;font-weight:bold;">${pBRL > 0 ? `R$ ${pBRL.toFixed(2).replace('.', ',')} /dia` : ''}</td>
            </tr>`;
          }).join('')}
        </table>
      </div>
      ` : ''}

      ${data.extras && data.extras.length > 0 ? `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;margin:12px 0;">
        <strong style="color:#166534;font-size:13px;">🛡️ Proteções Adicionais</strong>
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          ${data.extras.map(ex => {
            const pBRL = ex.priceBRL || 0;
            return `<tr>
              <td style="padding:4px 0;color:#374151;font-size:13px;">🛡️ ${ex.name || ex.code} ×${ex.qty}</td>
              <td style="padding:4px 0;color:#374151;font-size:13px;text-align:right;font-weight:bold;">${pBRL > 0 ? `R$ ${pBRL.toFixed(2).replace('.', ',')}` : ''}</td>
            </tr>`;
          }).join('')}
        </table>
      </div>
      ` : ''}

      ${isOnRequest ? `
      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:14px 16px;margin:20px 0;">
        <strong style="color:#92400e;font-size:13px;">⏳ Reserva Sob Consulta</strong>
        <p style="color:#92400e;font-size:13px;margin:4px 0 0;">
          Um ou mais itens desta reserva precisam de confirmação pela estação Europcar. 
          Você será contatado em até 8 horas úteis.
        </p>
      </div>
      ` : `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;margin:20px 0;">
        <strong style="color:#166534;font-size:13px;">📋 Lembre-se</strong>
        <p style="color:#166534;font-size:13px;margin:4px 0 0;">
          Apresente o número da reserva no balcão de retirada. 
          Traga também seu documento de identidade e CNH válida.
        </p>
      </div>
      `}

      <p style="color:#6b7280;font-size:13px;">
        Você pode visualizar e gerenciar sua reserva em <a href="https://europcar.com.br/reservas" style="color:#008d36;font-weight:bold;">europcar.com.br/reservas</a>.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 24px;text-align:center;">
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
      console.log(`[email] ✅ Confirmação de reserva enviada via ${result.provider} para ${toEmail} — resNumber: ${resNumber}`);
    } else {
      console.error(`[email] ❌ Falha ao enviar confirmação para ${toEmail}: ${result.error}`);
    }
    return !!result.success;
  } catch (error: any) {
    // Non-blocking: log but don't throw — reservation is already confirmed
    console.error(`[email] Exceção ao enviar confirmação para ${toEmail}:`, error.message);
    return false;
  }
}
