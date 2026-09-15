import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';
import { getReceiptLocale, formatDate, formatTime } from '@/lib/receiptLocales';
import { sendEmail } from '@/lib/emailService';
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: { resNumber: string } }
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { resNumber } = params;

  const reservation = await prisma.localReservation.findFirst({
    where: {
      OR: [
        { resNumber },
        { merchantOrderId: resNumber },
      ],
    },
  });

  if (!reservation) {
    return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 });
  }

  let cd: any = {};
  try {
    cd = typeof reservation.customerData === 'string'
      ? JSON.parse(reservation.customerData)
      : reservation.customerData || {};
  } catch { /* mantém {} */ }

  const booking = cd?.booking || {};
  const car     = booking?.car || {};

  const country    = booking?.country || cd?.country || 'BR';
  const lc         = getReceiptLocale(country);
  const L          = lc.labels;

  const toEmail       = cd?.email || '';
  if (!toEmail) {
    return NextResponse.json({ error: 'E-mail do cliente não encontrado na reserva' }, { status: 400 });
  }

  const customerName  = `${cd?.nome || ''} ${cd?.sobrenome || ''}`.trim() || 'Cliente';
  const resNum        = reservation.resNumber || reservation.merchantOrderId;
  const carName       = car?.carCategorySample || car?.carCategoryName || '—';
  const carCategory   = car?.carCategoryCode || '—';
  const pickupStation = booking?.pickupStation || '—';
  const returnStation = booking?.returnStation || booking?.pickupStation || '—';
  const pickupDate    = formatDate(booking?.pickupDate || '', lc.locale);
  const returnDate    = formatDate(booking?.returnDate || '', lc.locale);
  const pickupTime    = formatTime(booking?.pickupTime || '1000');
  const returnTime    = formatTime(booking?.returnTime || '1000');
  const paymentMethod = cd?.paymentMethod || 'CREDIT';
  const payLabel      = L.paymentMethods[paymentMethod as keyof typeof L.paymentMethods] || paymentMethod;

  // Valor local
  const voucherAmount   = parseFloat(car?.totalRateEstimate || car?.total || '0');
  const voucherCurrency = car?.bookingCurrencyOfTotalRateEstimate || car?.currency || lc.currency;
  let localTotalStr = '—';
  if (voucherAmount > 0) {
    try {
      localTotalStr = new Intl.NumberFormat(lc.locale, {
        style: 'currency',
        currency: voucherCurrency,
        minimumFractionDigits: voucherCurrency === 'JPY' ? 0 : 2,
      }).format(voucherAmount);
    } catch {
      localTotalStr = `${voucherCurrency} ${voucherAmount.toFixed(2)}`;
    }
  }

  // Valor BRL (quando houver cobrança local)
  const amountBRL = reservation.amountInCents ? reservation.amountInCents / 100 : 0;
  const brlStr = amountBRL > 0 && country !== 'BR'
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amountBRL)
    : null;

  // ── Busca from email ──────────────────────────────────────
  let fromEmail = 'nao-responda@europcar.com.br';
  try {
    const block = await prisma.contentBlock.findUnique({ where: { key: 'RESEND_FROM_EMAIL' } });
    if (block?.value_ptBR) fromEmail = block.value_ptBR;
  } catch { /* usa default */ }

  // ── Extrai link do recibo ─────────────────────────────────
  let siteUrl = 'https://europcar.com.br';
  try {
    const siteBlock = await prisma.contentBlock.findUnique({ where: { key: 'SITE_URL' } });
    if (siteBlock?.value_ptBR) siteUrl = siteBlock.value_ptBR.replace(/\/$/, '');
  } catch { /* usa default */ }

  // ── Gera HTML do e-mail localizado ───────────────────────
  const isConfirmed = reservation.status === 'CONFIRMED' || reservation.status === 'PAID';

  const subject = lc.lang === 'pt'
    ? `✅ ${L.confirmed} — Europcar · ${resNum}`
    : `✅ ${L.confirmed} — Europcar · ${resNum}`;

  const html = `<!DOCTYPE html>
<html lang="${lc.lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:#008d36;padding:28px 32px;text-align:center;">
    <div style="font-size:32px;font-weight:900;font-style:italic;color:#fff;letter-spacing:-1px;">Europcar</div>
    <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px;">europcar.com.br</div>
    <div style="display:inline-block;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:100px;padding:6px 20px;font-size:13px;font-weight:700;color:#fff;margin-top:12px;">
      ✓ ${L.confirmed}
    </div>
  </div>

  <!-- Body -->
  <div style="padding:32px;">
    <p style="font-size:16px;color:#333;margin-bottom:20px;">
      ${lc.lang === 'pt' ? `Olá, <strong>${customerName}</strong>!` :
        lc.lang === 'fr' ? `Bonjour, <strong>${customerName}</strong> !` :
        lc.lang === 'de' ? `Guten Tag, <strong>${customerName}</strong>!` :
        lc.lang === 'it' ? `Salve, <strong>${customerName}</strong>!` :
        lc.lang === 'es' ? `Hola, <strong>${customerName}</strong>!` :
        lc.lang === 'ja' ? `${customerName} 様` :
        `Dear <strong>${customerName}</strong>,`}
    </p>

    <!-- Res Number -->
    <div style="background:#f8fafb;border-left:4px solid #008d36;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">${L.reservationNo}</div>
      <div style="font-size:28px;font-weight:900;color:#008d36;font-family:'Courier New',monospace;margin-top:4px;">${resNum}</div>
    </div>

    <!-- Vehicle -->
    <table style="width:100%;margin-bottom:24px;border-collapse:collapse;">
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;">
          <span style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">${L.category}</span><br>
          <strong style="font-size:15px;">${carCategory} · ${carName}</strong>
        </td>
      </tr>
    </table>

    <!-- Trip -->
    <table style="width:100%;margin-bottom:24px;border-collapse:collapse;">
      <tr>
        <td style="width:45%;background:#f8fafb;border-radius:8px;padding:14px;vertical-align:top;">
          <div style="font-size:10px;color:#008d36;font-weight:800;text-transform:uppercase;letter-spacing:1px;">${L.pickup}</div>
          <div style="font-size:20px;font-weight:900;font-family:'Courier New',monospace;margin:4px 0;">${pickupStation}</div>
          <div style="font-size:12px;color:#555;">${pickupDate} · ${pickupTime}</div>
        </td>
        <td style="width:10%;text-align:center;font-size:20px;color:#008d36;">→</td>
        <td style="width:45%;background:#f8fafb;border-radius:8px;padding:14px;vertical-align:top;">
          <div style="font-size:10px;color:#008d36;font-weight:800;text-transform:uppercase;letter-spacing:1px;">${L.return}</div>
          <div style="font-size:20px;font-weight:900;font-family:'Courier New',monospace;margin:4px 0;">${returnStation}</div>
          <div style="font-size:12px;color:#555;">${returnDate} · ${returnTime}</div>
        </td>
      </tr>
    </table>

    <!-- Payment -->
    <div style="background:linear-gradient(135deg,#f8fafb,#eef5ee);border:1px solid #d4edda;border-radius:10px;padding:20px;margin-bottom:24px;">
      <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">${L.payment}</div>
      <div style="font-size:14px;font-weight:700;margin-top:6px;">💳 ${payLabel}</div>
      <div style="font-size:26px;font-weight:900;color:#008d36;margin-top:10px;">${localTotalStr}</div>
      ${brlStr ? `<div style="font-size:13px;color:#666;margin-top:4px;">BRL: ${brlStr}</div>` : ''}
    </div>

    <!-- Footer text -->
    <p style="font-size:13px;color:#666;line-height:1.6;">${L.footer}</p>
  </div>

  <!-- Footer -->
  <div style="background:#1a1a2e;color:rgba(255,255,255,0.6);text-align:center;padding:18px;font-size:12px;">
    Europcar Brasil · europcar.com.br
  </div>
</div>
</body>
</html>`;

  await sendEmail(fromEmail, toEmail, subject, html);

  console.log(`[Receipt] E-mail reenviado para ${toEmail} | Reserva ${resNum} | País: ${country} | Idioma: ${lc.lang} | Moeda: ${lc.currency}`);

  return NextResponse.json({
    ok: true,
    sentTo: toEmail,
    country,
    lang: lc.lang,
    currency: lc.currency,
    resNumber: resNum,
  });
}
