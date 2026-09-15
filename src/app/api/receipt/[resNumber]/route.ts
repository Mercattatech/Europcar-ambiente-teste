import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkAdmin } from '@/lib/checkAdmin';
import { getReceiptLocale, formatMoney, formatDate, formatTime } from '@/lib/receiptLocales';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { resNumber: string } }
) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { resNumber } = params;

  // Busca reserva pelo resNumber ou merchantOrderId
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

  // Parse customerData (Json do Prisma)
  let cd: any = {};
  try {
    cd = typeof reservation.customerData === 'string'
      ? JSON.parse(reservation.customerData)
      : reservation.customerData || {};
  } catch { /* mantém {} */ }

  const booking = cd?.booking || {};
  const car     = booking?.car || {};

  // ── Dados básicos ──────────────────────────────────────────
  const country    = booking?.country || cd?.country || 'BR';
  const lc         = getReceiptLocale(country);
  const L          = lc.labels;

  const customerName = `${cd?.nome || ''} ${cd?.sobrenome || ''}`.trim() || '—';
  const customerEmail = cd?.email || '—';
  const customerPhone = cd?.telefone || cd?.phone || '—';

  const pickupStation  = booking?.pickupStation || '—';
  const returnStation  = booking?.returnStation || booking?.pickupStation || '—';
  const pickupDate     = formatDate(booking?.pickupDate || '', lc.locale);
  const returnDate     = formatDate(booking?.returnDate || '', lc.locale);
  const pickupTime     = formatTime(booking?.pickupTime || '1000');
  const returnTime     = formatTime(booking?.returnTime || '1000');

  const carName      = car?.carCategorySample || car?.carCategoryName || '—';
  const carCategory  = car?.carCategoryCode || '—';
  const paymentMethod = cd?.paymentMethod || 'CREDIT';

  // ── Valor local (moeda do país) ────────────────────────────
  const voucherAmount   = parseFloat(car?.totalRateEstimate || car?.total || '0');
  const voucherCurrency = car?.bookingCurrencyOfTotalRateEstimate || car?.currency || lc.currency;
  const localLc         = getReceiptLocale(country);

  // Formata em moeda local (se currency do car bater com o país) ou usa a do locale
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

  // Valor pago em BRL (quando aplicável)
  const amountBRL = reservation.amountInCents ? reservation.amountInCents / 100 : 0;
  const brlStr    = amountBRL > 0
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amountBRL)
    : null;

  // ── Extras ─────────────────────────────────────────────────
  const extrasMap: Record<string, number> = booking?.extras || {};
  const xrsEquipment: any[] = booking?.xrsEquipment || cd?.xrsEquipment || [];
  const extrasRows: string[] = [];

  Object.entries(extrasMap).forEach(([code, qty]) => {
    if ((qty as number) > 0) extrasRows.push(`<tr><td class="tl">${code}</td><td class="tc">×${qty}</td><td class="tr">—</td></tr>`);
  });
  xrsEquipment.forEach((eq: any) => {
    const price = eq.price ? formatMoney(parseFloat(eq.price), localLc) : '—';
    extrasRows.push(`<tr><td class="tl">${eq.icon || '📦'} ${eq.name || eq.code}</td><td class="tc">×${eq.qty || 1}</td><td class="tr">${price}/day</td></tr>`);
  });

  const issueDate = new Date().toLocaleDateString(lc.locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const payLabel  = L.paymentMethods[paymentMethod as keyof typeof L.paymentMethods] || paymentMethod;

  // ── Gera HTML ──────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="${lc.lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${L.title} — ${reservation.resNumber || reservation.merchantOrderId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; color: #1a1a2e; min-height: 100vh; padding: 24px 16px 48px; }
    .receipt { max-width: 700px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,0.12); }
    /* Header */
    .header { background: linear-gradient(135deg, #008d36 0%, #005a22 100%); padding: 32px 36px; color: #fff; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
    .logo { font-size: 28px; font-weight: 900; font-style: italic; letter-spacing: -1px; }
    .logo span { color: #ffdd00; }
    .badge { background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 100px; padding: 6px 16px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; }
    .header h1 { margin-top: 20px; font-size: 22px; font-weight: 700; }
    .header .res-num { margin-top: 6px; font-size: 30px; font-weight: 900; letter-spacing: 1px; color: #ffdd00; font-family: 'Courier New', monospace; }
    .header .meta { margin-top: 8px; font-size: 13px; opacity: 0.75; }
    /* Body */
    .body { padding: 32px 36px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #008d36; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 2px solid #e8f5ee; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .field label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #888; margin-bottom: 3px; }
    .field p { font-size: 14px; font-weight: 600; color: #1a1a2e; }
    /* Trip */
    .trip { display: grid; grid-template-columns: 1fr 40px 1fr; gap: 12px; align-items: center; }
    .trip-station { background: #f8fafb; border-radius: 10px; padding: 14px 16px; }
    .trip-station label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #008d36; }
    .trip-station .station-code { font-size: 22px; font-weight: 900; font-family: 'Courier New', monospace; color: #1a1a2e; margin: 4px 0; }
    .trip-station .station-meta { font-size: 12px; color: #555; }
    .trip-arrow { text-align: center; font-size: 20px; color: #008d36; }
    /* Table */
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    table th { background: #f8fafb; padding: 8px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #888; font-weight: 700; }
    table td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; }
    .tl { text-align: left; font-weight: 500; }
    .tc { text-align: center; color: #555; }
    .tr { text-align: right; font-weight: 600; }
    table tr:last-child td { border-bottom: none; }
    /* Payment */
    .payment-box { background: linear-gradient(135deg, #f8fafb 0%, #eef5ee 100%); border: 2px solid #d4edda; border-radius: 12px; padding: 20px 24px; }
    .payment-method { font-size: 15px; font-weight: 700; color: #1a1a2e; }
    .payment-amount { margin-top: 12px; }
    .payment-amount .local { font-size: 28px; font-weight: 900; color: #008d36; }
    .payment-amount .brl { font-size: 14px; color: #666; margin-top: 4px; }
    .payment-amount .brl-label { font-size: 11px; color: #999; }
    /* Footer */
    .footer { background: #1a1a2e; color: rgba(255,255,255,0.6); text-align: center; padding: 20px 24px; font-size: 12px; line-height: 1.6; }
    /* Print buttons */
    .print-bar { display: flex; gap: 12px; justify-content: center; margin-top: 24px; }
    .btn { padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; border: none; transition: all 0.2s; }
    .btn-primary { background: #008d36; color: #fff; }
    .btn-primary:hover { background: #006a28; }
    .btn-secondary { background: #1a1a2e; color: #fff; }
    .btn-secondary:hover { background: #0d0d1a; }
    @media print {
      body { background: #fff; padding: 0; }
      .receipt { box-shadow: none; border-radius: 0; max-width: 100%; }
      .print-bar { display: none !important; }
    }
    @media (max-width: 600px) {
      .body { padding: 20px; }
      .grid-2 { grid-template-columns: 1fr; }
      .trip { grid-template-columns: 1fr; }
      .trip-arrow { transform: rotate(90deg); }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- HEADER -->
    <div class="header">
      <div class="header-top">
        <div class="logo">Euro<span>p</span>car</div>
        <div class="badge">✓ ${L.confirmed}</div>
      </div>
      <h1>${L.title}</h1>
      <div class="res-num">${reservation.resNumber || reservation.merchantOrderId}</div>
      <div class="meta">${L.issueDate}: ${issueDate} · ${country}</div>
    </div>

    <div class="body">

      <!-- CUSTOMER -->
      <div class="section">
        <div class="section-title">${L.customer}</div>
        <div class="grid-2">
          <div class="field"><label>${L.name}</label><p>${customerName}</p></div>
          <div class="field"><label>${L.email}</label><p>${customerEmail}</p></div>
          ${customerPhone !== '—' ? `<div class="field"><label>${L.phone}</label><p>${customerPhone}</p></div>` : ''}
        </div>
      </div>

      <!-- VEHICLE -->
      <div class="section">
        <div class="section-title">${L.vehicle}</div>
        <div class="grid-2">
          <div class="field"><label>${L.category}</label><p>${carCategory}</p></div>
          <div class="field"><label>${L.model}</label><p>${carName}</p></div>
        </div>
      </div>

      <!-- TRIP -->
      <div class="section">
        <div class="section-title">${L.pickup} / ${L.return}</div>
        <div class="trip">
          <div class="trip-station">
            <label>${L.pickup}</label>
            <div class="station-code">${pickupStation}</div>
            <div class="station-meta">${pickupDate} · ${pickupTime}</div>
          </div>
          <div class="trip-arrow">→</div>
          <div class="trip-station">
            <label>${L.return}</label>
            <div class="station-code">${returnStation}</div>
            <div class="station-meta">${returnDate} · ${returnTime}</div>
          </div>
        </div>
      </div>

      <!-- EXTRAS -->
      ${extrasRows.length > 0 ? `
      <div class="section">
        <div class="section-title">${L.extras}</div>
        <table>
          <thead><tr><th>${L.extras}</th><th style="text-align:center">Qtd.</th><th style="text-align:right">${L.total}</th></tr></thead>
          <tbody>${extrasRows.join('')}</tbody>
        </table>
      </div>` : ''}

      <!-- PAYMENT -->
      <div class="section">
        <div class="section-title">${L.payment}</div>
        <div class="payment-box">
          <div class="payment-method">💳 ${payLabel}</div>
          <div class="payment-amount">
            <div class="local">${localTotalStr}</div>
            ${brlStr && country !== 'BR' ? `<div class="brl"><span class="brl-label">BRL: </span>${brlStr}</div>` : ''}
            ${brlStr && country === 'BR' ? `<div class="local">${brlStr}</div>` : ''}
          </div>
        </div>
      </div>

    </div><!-- /body -->

    <!-- FOOTER -->
    <div class="footer">${L.footer}</div>
  </div>

  <!-- PRINT BUTTONS (hidden on print) -->
  <div class="print-bar">
    <button class="btn btn-primary" onclick="window.print()">${L.printButton}</button>
  </div>

</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
