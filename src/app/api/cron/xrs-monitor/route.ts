import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { callXRS } from '@/lib/europcar/xrsClient';
import { escapeXml } from '@/lib/europcar/xmlEscape';
export const dynamic = 'force-dynamic';

/**
 * XRS Health Check Cron — verifica a API XRS periodicamente.
 * GET /api/cron/xrs-monitor
 *
 * Lógica de transição de estado:
 *   OK → ERROR:  envia alerta WhatsApp (1x)
 *   ERROR → OK:  envia mensagem de recuperação (1x)
 *   OK → OK:     nada
 *   ERROR → ERROR: nada (já alertou)
 */
export async function GET() {
  try {
    // 1. Ler config
    let config = await prisma.xrsMonitorConfig.findFirst();
    if (!config) {
      config = await prisma.xrsMonitorConfig.create({ data: {} });
    }

    if (!config.enabled) {
      return NextResponse.json({ skipped: true, reason: 'Monitor desabilitado' });
    }

    // 2. Verificar intervalo mínimo (evitar execuções duplicadas)
    if (config.lastCheckAt) {
      const msSinceLastCheck = Date.now() - config.lastCheckAt.getTime();
      const minInterval = (config.intervalMinutes - 1) * 60 * 1000; // 1 min de tolerância
      if (msSinceLastCheck < minInterval) {
        return NextResponse.json({ skipped: true, reason: `Último check há ${Math.round(msSinceLastCheck / 1000)}s, intervalo mínimo: ${config.intervalMinutes} min` });
      }
    }

    // 3. Health check XRS — tenta getCarCategories com a estação configurada
    const now = new Date();
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 dias
    const pickupDate = futureDate.toISOString().replace(/-/g, '').slice(0, 8);
    const returnDate = new Date(futureDate.getTime() + 24 * 60 * 60 * 1000).toISOString().replace(/-/g, '').slice(0, 8);

    let isHealthy = false;
    let errorDetail = '';

    try {
      const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getCarCategories">
    <serviceContext language="pt_PT"/>
    <serviceParameters>
      <reservation>
        <checkout stationID="${escapeXml(config.testStation)}" date="${pickupDate}" time="1000"/>
        <checkin stationID="${escapeXml(config.testStation)}" date="${returnDate}" time="1000"/>
      </reservation>
    </serviceParameters>
  </serviceRequest>
</message>`;

      // Buscar credenciais XRS do banco
      const xrsConfig = await prisma.xRSConfig.findFirst();
      if (!xrsConfig) {
        errorDetail = 'Credenciais XRS não configuradas no banco de dados';
      } else {
        const xrsResponse = await callXRS(xmlRequest, {
          callerCode: xrsConfig.callerCode,
          password: xrsConfig.password,
          action: 'getCarCategories',
          sourceFile: 'xrs-monitor',
        });

        const returnCode = xrsResponse?.message?.serviceResponse?.$?.returnCode;
        const errorCode = xrsResponse?.message?.serviceResponse?.$?.errorCode;

        if (returnCode === 'OK') {
          isHealthy = true;
        } else {
          errorDetail = `returnCode=${returnCode}, errorCode=${errorCode || 'N/A'}`;
        }
      }
    } catch (err: any) {
      errorDetail = err.message || 'Erro de conexão com XRS';
    }

    console.log(`[xrs-monitor] Health check: ${isHealthy ? '✅ OK' : `❌ ERROR (${errorDetail})`} | lastStatus=${config.lastStatus}`);

    // 4. Lógica de transição de estado
    const previousStatus = config.lastStatus;
    const newStatus = isHealthy ? 'OK' : 'ERROR';

    const updateData: any = {
      lastStatus: newStatus,
      lastCheckAt: now,
    };

    if (!isHealthy) {
      updateData.lastErrorAt = now;
      updateData.lastErrorMessage = errorDetail;
    } else if (previousStatus === 'ERROR') {
      updateData.lastRecoveryAt = now;
    }

    await prisma.xrsMonitorConfig.update({
      where: { id: config.id },
      data: updateData,
    });

    // 5. Enviar alertas WhatsApp nas transições
    const numbers: string[] = JSON.parse(config.whatsappNumbers || '[]');
    let alertSent = false;

    if (numbers.length > 0) {
      const formatDate = (d: Date) => d.toLocaleDateString('pt-BR');
      const formatTime = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      // Transição OK/UNKNOWN → ERROR: alerta de queda
      if (!isHealthy && previousStatus !== 'ERROR') {
        const message = config.errorMessageTemplate
          .replace(/{DATA}/g, formatDate(now))
          .replace(/{HORA}/g, formatTime(now))
          .replace(/{ERRO}/g, errorDetail);

        alertSent = true;
        await sendSequentialWhatsApp(numbers, message, config.messagingIntervalSeconds);
      }

      // Transição ERROR → OK: alerta de recuperação
      if (isHealthy && previousStatus === 'ERROR') {
        const message = config.recoveryMessageTemplate
          .replace(/{DATA}/g, formatDate(now))
          .replace(/{HORA}/g, formatTime(now));

        alertSent = true;
        await sendSequentialWhatsApp(numbers, message, config.messagingIntervalSeconds);
      }
    }

    return NextResponse.json({
      status: newStatus,
      previousStatus,
      transition: previousStatus !== newStatus ? `${previousStatus} → ${newStatus}` : 'sem mudança',
      alertSent,
      checkedAt: now.toISOString(),
      error: errorDetail || undefined,
    });
  } catch (error: any) {
    console.error('[xrs-monitor] Erro geral:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Envia mensagens WhatsApp sequencialmente com delay entre cada número.
 */
async function sendSequentialWhatsApp(numbers: string[], message: string, delaySeconds: number) {
  const { sendWhatsappDirect } = await import('@/lib/whatsapp/whatsappService');

  for (let i = 0; i < numbers.length; i++) {
    const phone = numbers[i].replace(/\D/g, '');
    if (!phone) continue;

    try {
      await sendWhatsappDirect(phone, message);
      console.log(`[xrs-monitor] WhatsApp enviado para ${phone}`);
    } catch (err: any) {
      console.error(`[xrs-monitor] Falha ao enviar WhatsApp para ${phone}:`, err.message);
    }

    // Delay entre mensagens (exceto após a última)
    if (i < numbers.length - 1 && delaySeconds > 0) {
      await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
    }
  }
}
