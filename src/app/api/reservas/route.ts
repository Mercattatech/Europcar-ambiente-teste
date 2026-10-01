import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import prisma from '@/lib/prisma';
import { callXRS, DEFAULT_POA_CID } from '@/lib/europcar/xrsClient';
import { sendBookingConfirmation } from '@/lib/email/sendBookingConfirmation';
import { sendWelcomeWithCredentials } from '@/lib/email/sendWelcomeWithCredentials';
import { consultarBin, guessBrandByFirstDigit, mapBrandToCardIssuer, zeroAuthCard, voidCieloPayment } from '@/lib/cielo/cieloClient';
import { buildReservationPaymentAttrs, buildCreateVoucherXml, CID_TO_BA } from '@/lib/europcar/paymentMapping';
import { calculateRentalDays } from '@/lib/europcar/rentalDuration';
import { getReservationErrorMessage } from '@/lib/cms/reservationErrors';
import { escapeXml } from '@/lib/europcar/xmlEscape';
import { registerFailedTransaction } from '@/lib/rejectionService';
import bcrypt from 'bcryptjs';

/** Gera senha aleatória legível de 12 caracteres */
function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
   let customerEmail = '';
   let customerName = '';
   // Declarados fora do try para serem visíveis no catch (auto-void Cielo)
   let cieloConfig: any = null;
   let isSandboxMode = false;
   let cieloPaymentId: string | undefined;
   try {
      const { bookingData, customerData, paymentData, voucherData, xrsEquipment, xrsInsurances, couponData } = await request.json();
      customerEmail = customerData?.email || '';
      customerName = customerData?.nome || '';

      const forwardedFor = request.headers.get("x-forwarded-for");
      const ip = forwardedFor ? forwardedFor.split(',')[0] : 'Desconhecido';
      const session = await getServerSession(authOptions);
      const username = session?.user?.name || session?.user?.email || 'Visitante/Deslogado';
      const logOrigem = `Usuário: ${username} | IP: ${ip}`;

      // Cartão de crédito autentica o 3DS no cliente ANTES de chamar esta rota, usando um
      // MerchantOrderId próprio (bpmpi_ordernumber). Reaproveita o mesmo valor na cobrança
      // Cielo — se vierem diferentes, o banco emissor pode recusar por inconsistência entre
      // a autenticação e a venda. Sanitiza para não injetar valor arbitrário no payload Cielo/XRS.
      const clientOrderId = typeof paymentData?.merchantOrderId === 'string'
        ? paymentData.merchantOrderId.replace(/[^A-Za-z0-9]/g, '').slice(0, 40)
        : '';
      const merchantOrderId = clientOrderId || ("ORD" + Date.now());
      
      try {
        cieloConfig = await prisma.cieloConfig.findFirst();
      } catch (dbErr: any) {
        console.warn('[reservas] Prisma findFirst falhou (migration pendente?):', dbErr.message);
        // Fallback: busca apenas as colunas base via query SQL raw para não crashar se 3DS columns não existem
        try {
          const rows = await prisma.$queryRaw<any[]>`SELECT "id", "merchantId", "merchantKey", "isSandbox", "clientId3ds", "clientSecret3ds", "updatedAt" FROM "CieloConfig" LIMIT 1`;
          if (rows.length > 0) cieloConfig = rows[0];
        } catch (rawErr: any) {
          console.warn('[reservas] Raw query também falhou:', rawErr.message);
        }
      }

      // Fallback para .env caso não tenha sido configurado no painel ou o banco falhe
      if (!cieloConfig || !cieloConfig.merchantId) {
        const envMerchantId = process.env.CIELO_MERCHANT_ID;
        const envMerchantKey = process.env.CIELO_MERCHANT_KEY;
        const envSandbox = process.env.CIELO_SANDBOX !== 'false';
        
        if (envMerchantId && envMerchantKey) {
          cieloConfig = { merchantId: envMerchantId, merchantKey: envMerchantKey, isSandbox: envSandbox };
        }
      }

      if ((paymentData.method === 'PIX' || paymentData.method === 'CREDIT') && (!cieloConfig || !cieloConfig.merchantId || !cieloConfig.merchantKey)) {
         return NextResponse.json({ error: 'Chaves da Cielo não configuradas no Admin e nem no .env.' }, { status: 400 });
      }

      // ─────────────────────────────────────────────────────────────────────────────
      // PRE-FLIGHT AVAILABILITY CHECK (XRS GreenWay)
      // Validação obrigatória ANTES de cobrar o cartão ou gerar o QR Code do PIX.
      // Evita cobrar o cliente quando a estação não tem o veículo na frota ou a rota
      // não é permitida (ex: rental.vehiclenotavailable, rental.onewaynotallowed).
      // ─────────────────────────────────────────────────────────────────────────────
      const checkCar = bookingData?.car || {};
      const checkCategory = checkCar.carCategoryCode || checkCar.category || bookingData?.carCategory;
      const checkPickupStation = bookingData?.pickupStation || bookingData?.pickupLocation;
      const checkReturnStation = bookingData?.returnStation || bookingData?.returnLocation || checkPickupStation;
      const checkPickupDate = bookingData?.pickupDate;
      const checkReturnDate = bookingData?.returnDate;
      const checkPickupTime = bookingData?.pickupTime || '1000';
      const checkReturnTime = bookingData?.returnTime || '1000';
      const checkContractID = bookingData?.contractID || checkCar.contractID;
      const checkRateId = checkCar.rateId || checkCar.$?.rateId || bookingData?.rateId;

      if (checkCategory && checkPickupStation && checkPickupDate && checkReturnDate) {
        try {
          const preflightXml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getQuote">
    <serviceContext language="pt_PT"/>
    <caller/>
    <serviceParameters>
      <reservation chargesDetail="TRE" rateDetails="Y" prepaidMode="${paymentData.method === 'CREDIT' ? 'PP' : 'NP'}" carCategory="${escapeXml(checkCategory)}"${checkContractID ? ` contractID="${escapeXml(checkContractID)}" type="C"` : ''}${checkRateId ? ` rateId="${escapeXml(checkRateId)}"` : ''}>
        <checkout stationID="${escapeXml(checkPickupStation)}" date="${escapeXml(checkPickupDate)}" time="${escapeXml(checkPickupTime)}"/>
        <checkin stationID="${escapeXml(checkReturnStation)}" date="${escapeXml(checkReturnDate)}" time="${escapeXml(checkReturnTime)}"/>
      </reservation>
      <driver countryOfResidence="BR"${customerData?.idade || bookingData?.driverAge ? ` age="${escapeXml(String(customerData?.idade || bookingData?.driverAge))}"` : ''}/>
    </serviceParameters>
  </serviceRequest>
</message>`;

          const preflightRes = await callXRS(preflightXml, {
            callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
            password:   process.env.XRS_PASSWORD    || 'DEMO',
            action:     'preflightGetQuote',
            sourceFile: 'reservas/route.ts',
          });

          const sr = preflightRes?.message?.serviceResponse || preflightRes?.serviceResponse;
          const srStatus = sr?.status?.$ || sr?.status;
          const retCode = sr?.$?.returnCode || sr?.returnCode || srStatus?.returnCode;
          const errCode = sr?.$?.errorCode || sr?.errorCode;
          const reservation = sr?.reservation;

          if (retCode === 'KO' || errCode || !reservation) {
            console.warn(`[reservas] ❌ Pre-flight check falhou! retCode=${retCode}, errCode=${errCode}`);
            let friendlyMsg = 'Este veículo não está disponível para confirmação na estação e datas selecionadas. Por favor, retorne e escolha outro modelo da frota.';
            if (errCode === 'rental.onewaynotallowed') {
              friendlyMsg = 'A Europcar não permite devolução deste modelo na estação de retorno selecionada (One-Way não permitido para este veículo). Por favor, escolha outro veículo.';
            } else if (errCode === 'rental.vehiclenotavailable') {
              friendlyMsg = 'Veículo indisponível na estação para as datas selecionadas (frota esgotada ou não operada neste local). Por favor, escolha outro modelo da nossa frota.';
            }
            return NextResponse.json({
              error: friendlyMsg,
              code: 'VEHICLE_NOT_AVAILABLE',
              xrsErrorCode: errCode || 'rental.vehiclenotavailable',
            }, { status: 422 });
          }
          console.log(`[reservas] ✅ Pre-flight availability check aprovado para ${checkCategory} em ${checkPickupStation}`);
        } catch (pfErr: any) {
          console.warn('[reservas] ⚠️ Erro no pre-flight check (prosseguindo com cautela):', pfErr.message);
        }
      }

      // 1. Iniciar transação CIELO baseada no paymentData.method
      let cieloLog = "Não enviou para Cielo";
      let pixData: any = null;

      // CRITICAL: força coerção explícita de boolean para isSandbox
      // Evita bugs onde raw SQL retorna tipo inesperado ou migration não rodou
      isSandboxMode = cieloConfig?.isSandbox === true;
      
      const CIELO_API_URL = isSandboxMode
          ? "https://apisandbox.cieloecommerce.cielo.com.br/1/sales/"
          : "https://api.cieloecommerce.cielo.com.br/1/sales/";
          
      console.log(`[reservas] Modo: ${isSandboxMode ? '🧪 SANDBOX' : '🚀 PRODUÇÃO'} | URL: ${CIELO_API_URL} | MerchantId: ${cieloConfig?.merchantId?.substring(0,8)}...`);
          
      // .trim() defensivo: dados já salvos no banco podem ter espaço/quebra de linha
      // invisível de um copiar-colar antigo, o que a Cielo tolera em /1/card mas rejeita
      // com 401 em /1/sales — sintoma de "teste OK, pagamento real recusado".
      const cieloHeaders = {
         "Content-Type": "application/json",
         "MerchantId": String(cieloConfig?.merchantId || '').trim(),
         "MerchantKey": String(cieloConfig?.merchantKey || '').trim()
      };

      // Campos de identificação do lojista para 3DS 2.2 (Erros 605, 606, 607)
      const merchantName      = cieloConfig?.merchantName      || 'Europcar Brasil';
      const establishmentCode = cieloConfig?.establishmentCode || '';
      const mcc               = cieloConfig?.mcc               || '7512';

      let paymentApproved = false;
      // Preenchido no fluxo CREDIT — usado depois para decidir prepaidMode="PP" (cobrado
      // agora) e, se algum dia existir um fluxo de garantia sem captura, o nó meanOfPayment CC.
      let capturedCreditCard: { number: string; holderName: string; validity: string; cardIssuer: string; captured: boolean } | undefined;
      // PaymentId da Cielo (CREDIT) — guardado no registro local para permitir estorno (void) em caso de cancelamento.
      // (declarado fora do try para ser visível no catch — auto-void em caso de falha XRS)

      if (paymentData.method === 'PIX') {
         const pixPayload = {
             "MerchantOrderId": merchantOrderId,
             // Campos de identificação do lojista — obrigatórios para 3DS 2.2 (Erros 605/606/607)
             ...(establishmentCode && { "EstablishmentCode": establishmentCode }),
             ...(merchantName      && { "MerchantName":      merchantName }),
             "MerchantCategoryCode": mcc,
             "Customer": { "Name": customerData.nome + " " + customerData.sobrenome, "Identity": customerData.cpf },
             "Payment": { "Type": "Pix", "Amount": paymentData.amountInCents }
         };

         const resCielo = await fetch(CIELO_API_URL, {
             method: 'POST',
             headers: cieloHeaders,
             body: JSON.stringify(pixPayload)
         });
         
         const rawPixText = await resCielo.text();
         
         prisma.logCielo.create({
             data: {
                 endpoint: CIELO_API_URL,
                 payload: JSON.stringify(pixPayload),
                 response: rawPixText || `[Resposta Vazia] HTTP ${resCielo.status}`
             }
         }).catch(console.error);

         let cieloResponseJson: any = {};
         try {
             cieloResponseJson = rawPixText ? JSON.parse(rawPixText) : {};
         } catch (parseErr) {
             let msg = `Erro de Comunicação com a Cielo PIX (HTTP ${resCielo.status}).`;
             if (resCielo.status === 401) {
                 msg = "Erro 401 (Não Autorizado) na Cielo PIX. Verifique se o MerchantId e MerchantKey estão corretos. Se estiver usando chaves de Produção, o 'Modo Sandbox' deve estar DESMARCADO.";
             }
             await registerFailedTransaction({
               provider: 'Cielo',
               paymentMethod: 'PIX',
               amount: (paymentData?.amountInCents || 0) / 100,
               customerName: `${customerData?.nome || ''} ${customerData?.sobrenome || ''}`.trim(),
               customerEmail: customerData?.email,
               customerPhone: customerData?.telefone,
               merchantOrderId,
               httpStatus: resCielo.status,
               endpoint: CIELO_API_URL,
               rawPayload: { error: msg, rawPixText },
               returnCode: resCielo.status === 401 ? '401' : 'PARSE_ERROR',
               returnMessage: msg
             }).catch(console.error);
             throw new Error(msg);
         }
         
         if (!resCielo.ok || !cieloResponseJson.Payment || !cieloResponseJson.Payment.QrCodeString) {
             let errorMsg = cieloResponseJson.Payment?.ReturnMessage;
             if (!errorMsg && Array.isArray(cieloResponseJson) && cieloResponseJson[0]?.Message) {
                 errorMsg = cieloResponseJson.map((e: any) => e.Message).join(', ');
             }
             // Mapeamento CMS: se a Cielo retornar um ReturnCode conhecido, busca a mensagem
             // amigável em ContentBlock["reservation.error.<code>"] antes de cair no fallback técnico.
             const pixReturnCode = cieloResponseJson.Payment?.ReturnCode ?? (Array.isArray(cieloResponseJson) ? cieloResponseJson[0]?.Code : undefined);
             if (!errorMsg) {
                 // Sem shape reconhecido (nem Payment.ReturnMessage, nem array de erros) —
                 // repassa o corpo bruto retornado pela Cielo para diagnóstico, em vez de
                 // adivinhar a causa. Ver também /painel/logs (LogCielo) para o histórico completo.
                 errorMsg = `Código HTTP ${resCielo.status}. Resposta Cielo: ${rawPixText.slice(0, 300) || '[vazia]'}`;
             }
             await registerFailedTransaction({
               provider: 'Cielo',
               paymentMethod: 'PIX',
               amount: (paymentData?.amountInCents || 0) / 100,
               customerName: `${customerData?.nome || ''} ${customerData?.sobrenome || ''}`.trim(),
               customerEmail: customerData?.email,
               customerPhone: customerData?.telefone,
               merchantOrderId,
               paymentId: cieloResponseJson?.Payment?.PaymentId,
               httpStatus: resCielo.status,
               endpoint: CIELO_API_URL,
               rawPayload: cieloResponseJson || rawPixText,
               returnCode: pixReturnCode || `HTTP_${resCielo.status}`,
               returnMessage: errorMsg
             }).catch(console.error);
             errorMsg = await getReservationErrorMessage(pixReturnCode, errorMsg);
             throw new Error("Transação PIX Recusada: " + errorMsg);
         }

         cieloLog = "Sucesso PIX Cielo.";
         pixData = {
            qrCodeBase64: cieloResponseJson.Payment.QrCodeBase64Image,
            qrCodeString: cieloResponseJson.Payment.QrCodeString,
            paymentId: cieloResponseJson.Payment.PaymentId
         };
         // PIX is not approved yet, reservation will be created later by status webhook/polling
      } else if (paymentData.method === 'CREDIT') {
         let validityFormatted = paymentData.creditCard.validity;
         if (validityFormatted.length === 5 && validityFormatted.includes('/')) {
             const [mm, yy] = validityFormatted.split('/');
             validityFormatted = `${mm}/20${yy}`;
         }

         const threeDsAuth = paymentData.creditCard?.threeDsAuth;
         const cardNumClean = paymentData.creditCard.number.replace(/\D/g, '');
         // SEGURANÇA: nunca loga o PAN completo — apenas os 4 últimos dígitos
         const cardMasked = `**** **** **** ${cardNumClean.slice(-4)}`;

         // Consulta BIN — identifica a bandeira real pelos 6 primeiros dígitos (mais
         // preciso que adivinhar pelo primeiro dígito, essencial para Elo x Master x Visa).
         const binInfo = await consultarBin(cardNumClean, cieloHeaders.MerchantId, cieloHeaders.MerchantKey, isSandboxMode);
         const brand = binInfo?.brand || guessBrandByFirstDigit(cardNumClean);
         const cardIssuer = binInfo?.cardIssuer || mapBrandToCardIssuer(brand);

         // Zero Auth — valida se o cartão é funcional ANTES de autorizar, evitando
         // processar uma reserva no XRS para um cartão que nem passa na validação básica.
         const zeroAuth = await zeroAuthCard(
           { number: cardNumClean, holder: paymentData.creditCard.name, expirationDate: validityFormatted, brand },
           cieloHeaders.MerchantId, cieloHeaders.MerchantKey, isSandboxMode
         );
         if (!zeroAuth.valid) {
           await registerFailedTransaction({
             provider: 'Cielo',
             cardBrand: brand,
             paymentMethod: 'CREDIT',
             amount: (paymentData?.amountInCents || 0) / 100,
             customerName: `${customerData?.nome || ''} ${customerData?.sobrenome || ''}`.trim(),
             customerEmail: customerData?.email,
             customerPhone: customerData?.telefone,
             merchantOrderId,
             endpoint: 'ZeroAuth',
             rawPayload: { zeroAuth, brand },
             returnCode: 'ZERO_AUTH',
             returnMessage: zeroAuth.message || 'Cartão inválido ou não autorizado pelo emissor.'
           }).catch(console.error);
           const msg = await getReservationErrorMessage('ZERO_AUTH', zeroAuth.message || 'Cartão inválido ou não autorizado pelo emissor.');
           throw new Error("Transação Recusada pela Operadora: " + msg);
         }

         const cieloPaymentNode: any = {
             "Type": "CreditCard",
             "Amount": paymentData.amountInCents,
             "Installments": Math.min(Math.max(paymentData.installments || 1, 1), 6),
             "Capture": true,
             "SoftDescriptor": "EUROPCAR",
             "CreditCard": {
                 "CardNumber": cardNumClean,
                 "Holder": paymentData.creditCard.name,
                 "ExpirationDate": validityFormatted,
                 "SecurityCode": paymentData.creditCard.cvv,
                 "Brand": brand
             }
         };

         // Adiciona nó 3DS quando autenticação foi realizada pelo script Braspag MPI
         if (threeDsAuth?.cavv && threeDsAuth?.eci) {
             cieloPaymentNode.ExternalAuthentication = {
                 Cavv: threeDsAuth.cavv,
                 Xid: threeDsAuth.xid,
                 Eci: threeDsAuth.eci,
                 Version: threeDsAuth.version || '2',
                 ReferenceID: threeDsAuth.referenceId || '',
             };
             console.log(`[Cielo] Cartão ${cardMasked} | 3DS ECI=${threeDsAuth.eci} | LiabilityShift=${['02','05','2','5'].includes(threeDsAuth.eci) ? 'SIM' : 'NÃO'}`);
         } else {
             console.warn(`[Cielo] Cartão ${cardMasked} | SEM 3DS — processando sem Liability Shift`);
         }

         const cieloPayload = {
             "MerchantOrderId": merchantOrderId,
             // Campos de identificação do lojista — obrigatórios para 3DS 2.2 (Erros 605/606/607)
             ...(establishmentCode && { "EstablishmentCode": establishmentCode }),
             ...(merchantName      && { "MerchantName":      merchantName }),
             "MerchantCategoryCode": mcc,
             "Customer": { "Name": customerData.nome + " " + customerData.sobrenome, "Identity": customerData.cpf.replace(/\D/g, '') },
             "Payment": cieloPaymentNode
         };

         // Log seguro: substitui CardNumber pelo valor mascarado
         const safePayload = JSON.parse(JSON.stringify(cieloPayload));
         safePayload.Payment.CreditCard.CardNumber = cardMasked;
         safePayload.Payment.CreditCard.SecurityCode = '***';

         const resCielo = await fetch(CIELO_API_URL, {
             method: 'POST',
             headers: cieloHeaders,
             body: JSON.stringify(cieloPayload)
         });
         
         const rawText = await resCielo.text();
         
         // Salva log no banco com dados mascarados
         prisma.logCielo.create({
             data: {
                 endpoint: CIELO_API_URL,
                 payload: JSON.stringify(safePayload),
                 response: rawText || `[Resposta Vazia] HTTP ${resCielo.status}`
             }
         }).catch(console.error);


         let cieloResponseJson: any = {};
         try {
             cieloResponseJson = rawText ? JSON.parse(rawText) : {};
         } catch (parseErr) {
             let msg = `Erro de Comunicação com a Cielo (HTTP ${resCielo.status}).`;
             if (resCielo.status === 401) {
                 msg = "Erro 401 (Não Autorizado) na Cielo. Verifique se o MerchantId e MerchantKey estão corretos. Se estiver usando chaves de Produção, verifique se o botão 'Modo Sandbox' está DESMARCADO no painel. Chaves reais não funcionam no Sandbox.";
             }
             await registerFailedTransaction({
               provider: 'Cielo',
               cardBrand: brand,
               paymentMethod: 'CREDIT',
               amount: (paymentData?.amountInCents || 0) / 100,
               customerName: `${customerData?.nome || ''} ${customerData?.sobrenome || ''}`.trim(),
               customerEmail: customerData?.email,
               customerPhone: customerData?.telefone,
               merchantOrderId,
               httpStatus: resCielo.status,
               endpoint: CIELO_API_URL,
               rawPayload: { error: msg, rawText },
               returnCode: resCielo.status === 401 ? '401' : 'PARSE_ERROR',
               returnMessage: msg
             }).catch(console.error);
             throw new Error(msg);
         }

         if (!resCielo.ok || (cieloResponseJson.Payment?.Status !== 1 && cieloResponseJson.Payment?.Status !== 2)) {
             let errorMsg = cieloResponseJson.Payment?.ReturnMessage;
             const returnCode = cieloResponseJson.Payment?.ReturnCode ?? (Array.isArray(cieloResponseJson) ? cieloResponseJson[0]?.Code : undefined);

             // Fallback técnico padrão — o mapeamento CMS (reservation.error.<code>) abaixo
             // tem prioridade quando o admin cadastrar uma mensagem para o código específico.
             if (returnCode === "002" || returnCode === "2") {
                 errorMsg = `A sua conta Cielo não está habilitada para processar esta bandeira de cartão (${brand}), ou o seu cadastro na Cielo ainda não foi ativado (Credenciais Inválidas - 002). Contate o suporte da Cielo.`;
             } else if (!errorMsg && Array.isArray(cieloResponseJson) && cieloResponseJson[0]?.Message) {
                 errorMsg = cieloResponseJson.map((e: any) => e.Message).join(', ');
             }
             if (!errorMsg) {
                 // Sem shape reconhecido (nem Payment.ReturnMessage, nem array de erros) —
                 // repassa o corpo bruto retornado pela Cielo para diagnóstico, em vez de
                 // adivinhar a causa. Ver também /painel/logs (LogCielo) para o histórico completo.
                 errorMsg = `Código HTTP ${resCielo.status}. Resposta Cielo: ${rawText.slice(0, 300) || '[vazia]'}`;
             }

             await registerFailedTransaction({
               provider: 'Cielo',
               cardBrand: brand,
               paymentMethod: 'CREDIT',
               amount: (paymentData?.amountInCents || 0) / 100,
               customerName: `${customerData?.nome || ''} ${customerData?.sobrenome || ''}`.trim(),
               customerEmail: customerData?.email,
               customerPhone: customerData?.telefone,
               merchantOrderId,
               paymentId: cieloResponseJson?.Payment?.PaymentId,
               httpStatus: resCielo.status,
               endpoint: CIELO_API_URL,
               rawPayload: safePayload ? { request: safePayload, response: cieloResponseJson || rawText } : (cieloResponseJson || rawText),
               returnCode: returnCode || `HTTP_${resCielo.status}`,
               returnMessage: errorMsg,
               fraudAnalysis: cieloResponseJson?.Payment?.FraudAnalysis
             }).catch(console.error);

             // CMS: reservation.error.<ReturnCode> — mensagem amigável editável pelo admin,
             // sem nomes fixos no código (ex: ReturnCode 129 = "Affiliation not found").
             errorMsg = await getReservationErrorMessage(returnCode, errorMsg);

             throw new Error("Transação Recusada pela Operadora: " + errorMsg);
         }

         cieloLog = "Sucesso Cartão Cielo: " + cieloResponseJson.Payment.ReturnMessage;
         paymentApproved = true;
         // Cartão cobrado agora pela Cielo (Capture:true) → XRS recebe prepaidMode="PP".
         capturedCreditCard = { number: cardNumClean, holderName: paymentData.creditCard.name, validity: validityFormatted, cardIssuer, captured: true };
         // Guarda o PaymentId da Cielo — necessário para estornar (void) se a reserva for cancelada depois.
         cieloPaymentId = cieloResponseJson.Payment.PaymentId;
      } else if (paymentData.method === 'BALCAO' || paymentData.method === 'VOUCHER') {
         paymentApproved = true;
      }

      // 2. Chamar Europcar XRS bookReservation se o pagamento estiver aprovado (ou for Balcão/Voucher)
      let resNumber: string | null = null;
      let isOnRequest = false;
      let onRequestItems: any[] = [];
      let xrsStatusCode: string = 'S';
      let xrsWarnings: any[] = [];
      if (paymentApproved) {
        const car = bookingData.car || {};
        const pickupDate = bookingData.pickupDate;
        const returnDate = bookingData.returnDate;
        const pickupStation = bookingData.pickupStation;
        const returnStation = bookingData.returnStation || pickupStation;
        const contractID = bookingData.contractID || DEFAULT_POA_CID;
        const carCategory = car.carCategoryCode;
        let rateId = car.rateId;
        let productDataAttr = '';

        // Atributos de pagamento (prepaidMode/prepaidPercentage/prepaidAmount + meanOfPayment)
        // calculados uma vez e reaproveitados no getQuote (só o meanOfPayment importa lá,
        // para precificação de voucher) e no bookReservation final.
        const paymentAttrs = buildReservationPaymentAttrs({
          method: paymentData.method,
          captured: paymentData.method === 'PIX' || !!capturedCreditCard?.captured,
          amountBRL: (paymentData.amountInCents || 0) / 100,
          // Passa os dados do cartão para QUALQUER fluxo CREDIT (capturado ou não),
          // para que o paymentMapping envie o nó CC correto ao XRS.
          // Antes disso, a condição !capturedCreditCard?.captured excluía o cartão
          // exatamente quando captured=true, deixando o XRS sem meanOfPayment válido.
          creditCardGuarantee: (paymentData.method === 'CREDIT' && capturedCreditCard)
            ? { number: capturedCreditCard.number, holderName: capturedCreditCard.holderName, validity: capturedCreditCard.validity, cardIssuer: capturedCreditCard.cardIssuer }
            : undefined,
          voucherData: paymentData.method === 'VOUCHER' ? voucherData : undefined,
          contractID,
          carCategory,
          pickupDate,
          returnDate,
          pickupTime: bookingData.pickupTime || '1000',
          returnTime: bookingData.returnTime || '1000',
          station: pickupStation,
          country: bookingData.stationCountry || customerData.pais,
          duration: bookingData.duration || bookingData.car?.duration,
          merchantOrderId,
        });

        // rateId vem do getMultipleRates (Step 2) e é válido para a sessão.
        // ⚠️ O refresh via getQuote foi removido — adicionava 10-20s ao fluxo,
        // causando timeout no cliente APÓS a Cielo já ter capturado o pagamento.
        // Resultado: cliente cobrado sem reserva. O rateId do Step 2 é suficiente.

        const contractAttr = contractID ? ` contractID="${escapeXml(contractID)}" type="C"` : '';

        // Build equipment XML — merge both sources into a Map to avoid duplicates.
        // bookingData.extras (Step 2 quick-add) and xrsEquipment (Step 3 detail selector)
        // can contain overlapping codes. We keep the highest qty per code.
        const equipmentMap = new Map<string, number>();
        // INTERIOR e PREMPLUS são seguros (não equipamentos) — confirmado pela Europcar (Antonio)
        const insuranceCodes = ['TPL','LDW','CDW','THW','SCDW','SPCDW','STHW','SPTHW','MEDIUM','PREMIUM','PREMPRE','PREMUP','RSA','APP','PAI','PEP','SLDW','WWI','SPAI','INTERIOR','PREMPLUS'];

        // Source 1: bookingData.extras (non-insurance codes only)
        const extras = bookingData.extras || {};
        Object.entries(extras).forEach(([code, qty]: any) => {
          if (!insuranceCodes.includes(code) && qty > 0) {
            equipmentMap.set(code, Math.max(equipmentMap.get(code) || 0, qty));
          }
        });

        // Source 2: xrsEquipment from Step 3 — overwrites/updates qty for same code
        if (Array.isArray(xrsEquipment)) {
          xrsEquipment.forEach((eq: any) => {
            if (eq.code && eq.qty > 0) {
              equipmentMap.set(eq.code, Math.max(equipmentMap.get(eq.code) || 0, eq.qty));
            }
          });
        }

        const equipmentXml = [...equipmentMap.entries()]
          .map(([code, qty]) => `\n          <equipment code="${escapeXml(code)}" qty="${escapeXml(qty)}"/>`)
          .join('');

        const extraKeys = Object.keys(extras).filter(k => extras[k] > 0);

        // Build insurance XML from extras map + xrsInsurances
        let insuranceXml = '';
        const selectedInsKeys = extraKeys.filter(k => insuranceCodes.includes(k));
        const allInsCodes = new Set<string>([
          ...selectedInsKeys,
          ...(Array.isArray(xrsInsurances) ? xrsInsurances.map((ins: any) => ins.code || ins).filter(Boolean) : []),
        ]);
        if (allInsCodes.size > 0) {
          insuranceXml = [...allInsCodes].map(code => `\n          <insurance code="${escapeXml(code)}"/>`).join('');
        }

        const { loyaltyProgramId, loyaltyId, flightNumber } = customerData;
        let loyaltyXml = '';
        if (loyaltyProgramId && loyaltyId) {
          loyaltyXml = `\n        <loyaltyProgram memberID="${escapeXml(loyaltyId)}" loyaltyID="${escapeXml(loyaltyProgramId)}"/>`;
        }

        const flightAttr = flightNumber
          ? ` flightNumber="${escapeXml(flightNumber.trim())}"`
          : '';

        const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="bookReservation">
    <serviceParameters>
      <reservation carCategory="${escapeXml(carCategory)}" rateId="${escapeXml(rateId)}"${paymentAttrs.prepaidAttrs}${contractAttr}${productDataAttr} chargesDetail="TRE" preferredLanguage="${escapeXml(bookingData.xrsLanguage || 'pt_BR')}" email="${escapeXml(customerData.email.trim())}"${flightAttr}>
        <checkout stationID="${escapeXml(pickupStation)}" date="${escapeXml(pickupDate)}" time="${escapeXml(bookingData.pickupTime || '1000')}"/>
        <checkin stationID="${escapeXml(returnStation)}" date="${escapeXml(returnDate)}" time="${escapeXml(bookingData.returnTime || '1000')}"/>
        <equipmentList>${equipmentXml}</equipmentList>${insuranceXml ? `\n        <insuranceList>${insuranceXml}\n        </insuranceList>` : ''}${paymentAttrs.meanOfPaymentXml}${loyaltyXml}
      </reservation>
      <driver countryOfResidence="BR"${bookingData.driverAge ? ` age="${escapeXml(String(bookingData.driverAge))}"` : ''}
              firstName="${escapeXml(customerData.nome.trim())}"
              lastName="${escapeXml(customerData.sobrenome.trim())}"
              title="MR"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

        const xrsConfig = {
          callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
          password: process.env.XRS_PASSWORD || 'DEMO',
          action: 'bookReservation',
          sourceFile: 'reservas/route.ts'
        };

        const xrsResponse = await callXRS(xmlRequest, xrsConfig);
        const bookResNode = xrsResponse?.message?.serviceResponse?.reservation || xrsResponse?.serviceResponse?.reservation;
        resNumber = bookResNode?.$?.resNumber || null;

        if (!resNumber) {
          // Extrair mensagem de erro real retornada pelo XRS para diagnóstico
          const errNode = xrsResponse?.message?.serviceResponse?.errors
            || xrsResponse?.message?.errors
            || xrsResponse?.serviceResponse?.errors
            || xrsResponse?.errors;
          const errArr  = errNode ? (Array.isArray(errNode.error) ? errNode.error : [errNode.error]).filter(Boolean) : [];
          const xrsMsg  = errArr.map((e: any) => {
            const a = e.$ || e;
            return [a.errorCode, a.description || a.text || a.message].filter(Boolean).join(': ');
          }).join(' | ');
          const xrsStatusMsg = bookResNode?.$?.statusCode
            ? `XRS statusCode=${bookResNode.$.statusCode}`
            : '';
          const detail = [xrsMsg, xrsStatusMsg].filter(Boolean).join(' | ');
          const firstErrCode = errArr?.[0]?.$?.errorCode || errArr?.[0]?.errorCode || bookResNode?.$?.statusCode || 'XRS_BOOK_FAIL';

          await registerFailedTransaction({
            provider: 'Europcar XRS',
            paymentMethod: paymentData?.method || 'UNKNOWN',
            amount: (paymentData?.amountInCents || 0) / 100,
            customerName: `${customerData?.nome || ''} ${customerData?.sobrenome || ''}`.trim(),
            customerEmail: customerData?.email,
            customerPhone: customerData?.telefone,
            merchantOrderId,
            paymentId: cieloPaymentId,
            endpoint: 'XRS bookReservation',
            rawPayload: xrsResponse,
            returnCode: firstErrCode,
            returnMessage: detail || 'Europcar não retornou número de reserva.'
          }).catch(console.error);

          throw new Error(`Europcar não retornou número de reserva.${detail ? ' Motivo: ' + detail : ' Verifique os logs XRS.'}`);
        }

        xrsStatusCode = bookResNode?.$?.statusCode || 'S';
        isOnRequest = xrsStatusCode === 'R';
        if (isOnRequest) {
          const raw = bookResNode?.onRequestItemList?.onRequestItem;
          if (Array.isArray(raw)) {
            onRequestItems = raw.map((i: any) => i.$ || i);
          } else if (raw) {
            onRequestItems = [raw.$ || raw];
          }

          // Auto-aprendizado: salva automaticamente categorias de veículo on-request no banco
          // para que o badge LIMITED apareça automaticamente nas próximas pesquisas
          const vcItems = onRequestItems.filter((i: any) => (i.type || '').toUpperCase() === 'VC');
          for (const item of vcItems) {
            const carCode = (item.code || '').toUpperCase();
            if (carCode) {
              try {
                await prisma.carCategoryOverride.upsert({
                  where: { carCode },
                  update: { onRequest: true },
                  create: { carCode, friendlyName: item.description || carCode, onRequest: true },
                });
                console.log(`[reservas] Auto-marcado on-request: ${carCode}`);
              } catch (e) {
                console.warn(`[reservas] Falha ao auto-marcar ${carCode}:`, e);
              }
            }
          }
        }

        // ── Extrai cotação real e avisos (ex: rateIDNotApplied) do bookReservation ──
        const quoteNode = bookResNode?.quote?.$ || bookResNode?.quote;
        const rawWarnings = xrsResponse?.message?.serviceResponse?.warningList?.warning
          || xrsResponse?.serviceResponse?.warningList?.warning
          || bookResNode?.warningList?.warning;
        xrsWarnings = Array.isArray(rawWarnings)
          ? rawWarnings.map((w: any) => w.$ || w)
          : rawWarnings ? [rawWarnings.$ || rawWarnings] : [];

        const hasRateNotApplied = xrsWarnings.some((w: any) =>
          (w?.warningDesc || '').toLowerCase().includes('rateidnotapplied') ||
          (w?.warningCode || '').toLowerCase().includes('rateidnotapplied')
        );

        if (hasRateNotApplied) {
          console.warn(`[reservas] ⚠️ XRS retornou aviso xrs.rateIDNotApplied para reserva ${resNumber}. A tarifa foi recalculada pelo Greenway.`);
        }

        if (quoteNode) {
          const xrsTotalRateBRL = parseFloat(quoteNode.totalRateEstimateInBookingCurrency || quoteNode.totalRateEstimate || '0');
          const xrsTotalRateOrig = parseFloat(quoteNode.totalRateEstimate || '0');

          if (xrsTotalRateBRL > 0) {
            console.log(`[reservas] ℹ️ Cotação confirmada pelo Greenway para ${resNumber}: totalRate=${xrsTotalRateOrig}, totalRateBRL=${xrsTotalRateBRL}`);
            if (!bookingData.car) bookingData.car = {};
            bookingData.car.totalRateEstimate = String(quoteNode.totalRateEstimate || xrsTotalRateOrig);
            bookingData.car.totalRateEstimateInBookingCurrency = String(quoteNode.totalRateEstimateInBookingCurrency || xrsTotalRateBRL);
            if (quoteNode.basePrice) bookingData.car.basePrice = String(quoteNode.basePrice);
            if (quoteNode.currency) bookingData.car.currency = String(quoteNode.currency);
            if (quoteNode.bookingCurrency) bookingData.car.bookingCurrency = String(quoteNode.bookingCurrency);

            // Para BALCÃO (POA): o valor total registrado deve ser exatamente
            // a tarifa confirmada pelo Greenway + opcionais selecionados
            if (paymentData.method === 'BALCAO') {
              const bookingDays = calculateRentalDays({
                pickupDate: bookingData.pickupDate,
                pickupTime: bookingData.pickupTime || '1000',
                returnDate: bookingData.returnDate,
                returnTime: bookingData.returnTime || '1000',
                station: bookingData.pickupStation,
                country: bookingData.stationCountry || bookingData.driverCountry || customerData.pais,
                apiDuration: bookingData.duration || bookingData.car?.duration,
              });
              const confirmedInsBRL = (Array.isArray(xrsInsurances) ? xrsInsurances : [])
                .reduce((s: number, ins: any) => s + parseFloat(ins.priceBRL || 0), 0);
              const confirmedEquipBRL = (Array.isArray(xrsEquipment) ? xrsEquipment : [])
                .reduce((s: number, eq: any) => {
                  const t = parseFloat(eq.totalBRL || 0);
                  const d = parseFloat(eq.priceBRL || 0);
                  return s + (t > 0 ? t : d * bookingDays) * (eq.qty || 1);
                }, 0);

              const fullBalcaoBRL = xrsTotalRateBRL + confirmedInsBRL + confirmedEquipBRL;
              paymentData.amountInCents = Math.round(fullBalcaoBRL * 100);
              console.log(`[reservas] 💰 Valor Balcão sincronizado com cotação real do GW: R$ ${fullBalcaoBRL.toFixed(2)} (${paymentData.amountInCents} centavos)`);
            }
          }
        }

        if (resNumber) {
          try {
            const dFirstName = customerData.nome.trim();
            const dLastName = customerData.sobrenome.trim();
            const dEmail = customerData.email.trim();
            const dPhone = customerData.telefone || '';
            const dCpf = customerData.cpf.replace(/\D/g, '').slice(0, 11);
            const dCountry = customerData.paisEmissao || bookingData?.country || 'BR';

            // Build licenseList XML if CNH data is available
            let licenseListXml = '';
            if (customerData.cnhNumero || customerData.cnhValidade) {
              let expirationDate = '';
              if (customerData.cnhValidade) {
                const parts = customerData.cnhValidade.replace(/\D/g, '/').split('/');
                if (parts.length === 2) {
                  const [mm, yyyy] = parts;
                  const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
                  expirationDate = `${year}${mm.padStart(2, '0')}01`;
                }
              }
              licenseListXml = `
        <licenseList>
          <license licenseNumber="${escapeXml(customerData.cnhNumero || '')}"${expirationDate ? ` expirationDate="${escapeXml(expirationDate)}"` : ''}${customerData.cnhCidade ? ` cityOfIssuance="${escapeXml(customerData.cnhCidade)}"` : ''} countryOfIssuance="${escapeXml(dCountry)}"/>
        </licenseList>`;
            }

            const createDriverXml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="createDriver">
    <serviceParameters>
      <reservation resNumber="${escapeXml(resNumber)}"/>
      <driver isoLanguage="pt_BR" firstName="${escapeXml(dFirstName)}" lastName="${escapeXml(dLastName)}" title="MR">
        <addressList>
          <address addressType="P" addressKind="D" addressCountry="${escapeXml(dCountry)}">
            <emails>
              <email emailAddress="${escapeXml(dEmail)}" type="M"/>
            </emails>
            <phones>
              <phone phoneNumber="${escapeXml(dPhone)}" phoneType="M"/>
            </phones>
          </address>
        </addressList>
        <legalIdList>
          <legalId idTy="P" docNumber="${escapeXml(dCpf)}" country="${escapeXml(dCountry)}"/>
        </legalIdList>${licenseListXml}
      </driver>
    </serviceParameters>
  </serviceRequest>
</message>`;

            await callXRS(createDriverXml, {
              callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
              password: process.env.XRS_PASSWORD || 'DEMO',
              action: 'createDriver',
              sourceFile: 'reservas/route.ts'
            });
            console.log(`[reservas] createDriver enviado com sucesso para a reserva ${resNumber}`);
          } catch (driverErr: any) {
            console.error(`[reservas] Erro ao criar driver para ${resNumber}:`, driverErr.message);
          }
        }

        // ── createVoucher: registra split ETO ou EXO no GreenWay ──────────────
        // Fluxo em 2 etapas: bookReservation (prepaidMode=NP) → createVoucher
        // Rafael: "VCH must have the complete data: ETO, EXO, etc."
        //
        // Dispara para:
        //   - Pagamentos online (CREDIT capturado / PIX) em QUALQUER contrato
        //   - Voucher manual EXO
        const isPrepaidOnline = paymentData.method === 'PIX' || (paymentData.method === 'CREDIT' && !!capturedCreditCard?.captured);
        const isETO = contractID === '56935466' || contractID === '56935495';
        // ETO: meanOfPayment vai direto no bookReservationRQ — createVoucher NÃO é suportado (Antonio/Europcar).
        const isOnlineEXO = isPrepaidOnline && !isETO;
        const isManualEXO = paymentData.method === 'VOUCHER' && voucherData?.type === 'EXO';

        if (resNumber && (isOnlineEXO || isManualEXO)) {
          try {
            const voucherAmount = car.totalRateEstimate || car.total || '0';
            const voucherCurrency = car.bookingCurrencyOfTotalRateEstimate || car.currency || 'EUR';

            let vData: any;
            if (isManualEXO) {
              // EXO manual: usa dados do voucher enviado pelo usuário
              vData = voucherData;
            } else {
              // EXO online (POA): Europcar Brasil como agência IATA
              vData = { type: 'EXO', iataNumber: '02170722' };
            }

            const createVoucherXml = buildCreateVoucherXml(resNumber, vData, voucherAmount, voucherCurrency, carCategory, pickupDate, returnDate);

            await callXRS(createVoucherXml, {
              callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
              password: process.env.XRS_PASSWORD || 'DEMO',
              action: 'createVoucher',
              sourceFile: 'reservas/route.ts'
            });
            console.log(`[reservas] createVoucher (${vData.type}) enviado com sucesso para a reserva ${resNumber}`);
          } catch (voucherErr: any) {
            // createVoucher falhar NÃO deve abortar a reserva — o resNumber já existe.
            // Log para diagnóstico e acompanhamento manual pelo admin.
            console.error(`[reservas] ⚠️ Erro ao criar voucher para ${resNumber}:`, voucherErr.message);
          }
        }

      }

      // 3. Salvar no Banco de Dados local
      const { creditCard: _cc, cvv: _cvv, cardNumber: _cn, ...safeCustomerData } = customerData as any;
      const cardLastFour = paymentData.creditCard?.number
        ? '**** **** **** ' + String(paymentData.creditCard.number.replace(/\D/g, '')).slice(-4)
        : undefined;

      let finalResNumber = resNumber;
      let finalMerchantOrderId = merchantOrderId;
      try {
        const localRes = await prisma.localReservation.create({
           data: {
              resNumber: resNumber,
              merchantOrderId,
              amountInCents: paymentData.amountInCents || 0,
              status: paymentData.method === 'PIX' ? 'PENDING_PIX' : (isOnRequest ? 'ON_REQUEST' : (paymentData.method === 'BALCAO' ? 'CONFIRMED_NON_PREPAID' : 'CONFIRMED_PREPAID')),
              operationalStatus: xrsStatusCode || (isOnRequest ? 'R' : 'S'),
              customerData: JSON.stringify({
                ...safeCustomerData,      // sem creditCard, cvv, cardNumber
                booking: bookingData,
                xrsInsurances: Array.isArray(xrsInsurances) ? xrsInsurances : [],
                xrsEquipment:  Array.isArray(xrsEquipment)  ? xrsEquipment  : [],
                paymentId: pixData?.paymentId || cieloPaymentId,
                // Metadados de pagamento — usados pelo painel admin para exibição
                // NÃO afeta lógica de cobrança (estrutura de pagamento inalterada)
                paymentMethod: paymentData.method,  // 'PIX' | 'CREDIT' | 'BALCAO' | 'VOUCHER'
                cieloPaymentId: pixData?.paymentId || cieloPaymentId || null,
                systemLogOrigem: logOrigem,
                ...(cardLastFour && { cardLastFour }), // apenas **** **** **** 1234
                // Split de pagamento XRS (payerList) — auditoria do que foi cobrado online
                ...(bookingData?.payerSplit && { payerSplit: bookingData.payerSplit }),
                // Cupom de desconto aplicado
                ...(couponData && { couponData }),
                ...(xrsWarnings.length > 0 && { xrsWarnings }),
              })
           }
        });
        finalResNumber = localRes.resNumber;
        finalMerchantOrderId = localRes.merchantOrderId;
      } catch (dbSaveErr: any) {
        // DB save failed — for BALCÃO, we still confirm with local ID
        // PIX/CREDIT would already have been charged, so log and continue
        console.error('DB save failed:', dbSaveErr.message);
        if (paymentData.method !== 'BALCAO') {
          throw new Error('Pagamento processado mas falha ao salvar reserva: ' + dbSaveErr.message);
        }
        // BALCÃO: use in-memory generated resNumber
      }

      // 4. Send Email Confirmation
      if (finalResNumber && paymentData.method !== 'PIX') {
        // Send HTML confirmation email with booking details
        try {
          const xrsInsArr: any[] = Array.isArray(xrsInsurances) ? xrsInsurances : [];
          const extrasMap = bookingData.extras || {};
          const extrasArr = Object.entries(extrasMap)
            .filter(([, v]: any) => v > 0)
            .map(([code, qty]: any) => {
              const qi = xrsInsArr.find((i: any) => i.code === code);
              return { code, name: qi?.name || code, qty, priceBRL: qi?.priceBRL || 0 };
            });

          // Formata datas XRS (YYYYMMDD → DD/MM/YYYY)
          const fmtDate = (d: string) => d && d.length >= 8 ? `${d.slice(6,8)}/${d.slice(4,6)}/${d.slice(0,4)}` : d || '';
          // Extrai horário se presente (YYYYMMDDTHHMM → HH:MM ou HHMM → HH:MM)
          const fmtTime = (d: string) => {
            if (!d) return '';
            const tIdx = d.indexOf('T');
            if (tIdx >= 0) { const t = d.slice(tIdx+1); return t.length >= 4 ? `${t.slice(0,2)}:${t.slice(2,4)}` : t; }
            return '';
          };

          // Monta listas HTML de proteções e extras para o template
          const listaProtecoes = extrasArr.length > 0
            ? extrasArr.map(ex => `• ${ex.name || ex.code} ×${ex.qty}${ex.priceBRL > 0 ? ` — R$ ${ex.priceBRL.toFixed(2).replace('.', ',')}` : ''}`).join('<br/>')
            : 'Nenhuma proteção adicional selecionada';

          const equipArr: any[] = Array.isArray(xrsEquipment) ? xrsEquipment : [];
          const listaExtras = equipArr.length > 0
            ? equipArr.map(eq => `• ${eq.icon || '📦'} ${eq.name || eq.code} ×${eq.qty || 1}${eq.priceBRL ? ` — R$ ${parseFloat(eq.priceBRL).toFixed(2).replace('.', ',')} /dia` : ''}`).join('<br/>')
            : 'Nenhum acessório selecionado';

          const fmtPagamento: Record<string, string> = { BALCAO: 'Pagamento no Balcão', PIX: 'PIX', CREDIT: 'Cartão de Crédito', VOUCHER: 'Voucher ETO (Faturado)' };
          const pickupDateRaw = bookingData.pickupDate || '';
          const returnDateRaw = bookingData.returnDate || '';

          // ── Moeda do e-mail: usa a moeda da estação de retirada ──────────────
          // Para TODOS os métodos de pagamento em estações internacionais:
          // o e-mail mostra o TOTAL COMPLETO na moeda de destino + estimativa BRL.
          // (Para CREDIT/PIX o cliente paga parte online e parte no balcão —
          //  o total de referência é sempre veículo + proteções + equipamentos)
          const { buildEmailCurrencyVars } = await import('@/lib/receiptLocales');
          const _exchangeRate  = parseFloat(bookingData.car?.exchangeRate || '0');
          const _carCurrency   = bookingData.car?.currency || null;

          // Veículo BRL (total do período, inclui sobretaxa de aeroporto)
          const _vehicleBRL = parseFloat(
            bookingData.car?.totalRateEstimateInBookingCurrency ||
            bookingData.car?.totalRateEstimate || '0'
          );
          // Proteções selecionadas
          const _insBRL = (Array.isArray(xrsInsurances) ? xrsInsurances : [])
            .reduce((s: number, ins: any) => s + parseFloat(ins.priceBRL || 0), 0);
          // Equipamentos selecionados
          const _bookingDays = calculateRentalDays({
            pickupDate: bookingData.pickupDate,
            pickupTime: bookingData.pickupTime || '1000',
            returnDate: bookingData.returnDate,
            returnTime: bookingData.returnTime || '1000',
            station: bookingData.pickupStation,
            country: bookingData.stationCountry || bookingData.driverCountry || customerData.pais,
            apiDuration: bookingData.duration || bookingData.car?.duration,
          });
          const _equipBRL = (Array.isArray(xrsEquipment) ? xrsEquipment : [])
            .reduce((s: number, eq: any) => {
              const t = parseFloat(eq.totalBRL || 0);
              const d = parseFloat(eq.priceBRL || 0);
              return s + (t > 0 ? t : d * _bookingDays) * (eq.qty || 1);
            }, 0);
          // Total completo (fallback para amountInCents se não tiver dados do booking)
          const _totalBRLForEmail = (_vehicleBRL + _insBRL + _equipBRL) ||
            ((paymentData.amountInCents || 0) / 100);

          const _currencyVars = buildEmailCurrencyVars(
            _totalBRLForEmail,
            bookingData.pickupStation,
            _exchangeRate,
            _carCurrency,
          );
          const valorTotalEmail = _currencyVars.VALOR_TOTAL;

          // Monta dicionário completo de variáveis para o template do painel
          const emailVars: Record<string, string> = {
            NOME: customerData.nome || '',
            SOBRENOME: customerData.sobrenome || '',
            EMAIL: customerData.email || '',
            TELEFONE: customerData.telefone || '',
            CPF: customerData.cpf || '',
            NUMERO_RESERVA: finalResNumber,
            VALOR_TOTAL:   _currencyVars.VALOR_TOTAL,
            VALOR_LOCAL:   _currencyVars.VALOR_LOCAL,
            VALOR_BRL:     _currencyVars.VALOR_BRL,
            MOEDA:         _currencyVars.MOEDA,
            FORMA_PAGAMENTO: fmtPagamento[paymentData.method] || paymentData.method || '',
            CARRO: bookingData.car?.carCategoryName || bookingData.car?.name || '',
            CATEGORIA_CARRO: bookingData.car?.acrissCode || bookingData.carCategory || '',
            DATA_RETIRADA: fmtDate(pickupDateRaw),
            HORARIO_RETIRADA: fmtTime(pickupDateRaw) || bookingData.pickupTime || '',
            LOCAL_RETIRADA: bookingData.pickupStation || '',
            DATA_DEVOLUCAO: fmtDate(returnDateRaw),
            HORARIO_DEVOLUCAO: fmtTime(returnDateRaw) || bookingData.returnTime || '',
            LOCAL_DEVOLUCAO: bookingData.returnStation || bookingData.pickupStation || '',
            LISTA_PROTECOES: listaProtecoes,
            LISTA_EXTRAS: listaExtras,
            ITENS_SOB_CONSULTA: onRequestItems.map((i: any) => i.description || i.code).join(', ') || '',
          };

          // Tenta enviar usando o template do painel
          // On-request → RESERVA_SOB_SOLICITACAO; BALCÃO ou pré-pago → RESERVA_SUCESSO
          const trigger = isOnRequest ? 'RESERVA_SOB_SOLICITACAO' : 'RESERVA_SUCESSO';
          const { sendTransactionalEmail } = await import('@/lib/emailService');
          const tplResult = await sendTransactionalEmail(customerData.email, trigger, emailVars);
          console.log(`[reservas] Email trigger=${trigger} isOnRequest=${isOnRequest} result=`, tplResult.success);

          if (!tplResult.success && tplResult.error === 'Template não encontrado') {
            // Fallback: nenhum template cadastrado no painel → usa template hardcoded
            console.warn('[reservas] Template do painel não encontrado para RESERVA_SUCESSO — usando fallback hardcoded.');
            sendBookingConfirmation({
              toEmail: customerData.email,
              customerName: `${customerData.nome} ${customerData.sobrenome}`,
              resNumber: finalResNumber,
              carName: bookingData.car?.carCategoryName || bookingData.car?.name || '',
              pickupStation: bookingData.pickupStation || '',
              returnStation: bookingData.returnStation || bookingData.pickupStation || '',
              pickupDate: bookingData.pickupDate || '',
              returnDate: bookingData.returnDate || '',
              paymentMethod: paymentData.method,
              totalBRL: (paymentData.amountInCents || 0) / 100,
              isOnRequest,
              xrsEquipment: Array.isArray(xrsEquipment) ? xrsEquipment : [],
              extras: extrasArr,
            });
          }
        } catch (emailErr) {
          console.error('[reservas] Error sending booking confirmation:', emailErr);
        }

        // WhatsApp: disparo para o cliente + números internos (fire-and-forget)
        // Usa RESERVA_BALCAO para pagamento no balcão (loja) e RESERVA_SUCESSO para pré-pagos
        import('@/lib/whatsapp/whatsappService').then(({ sendWhatsappTrigger }) => {
          // On-request usa trigger diferente
          const waTrigger = isOnRequest ? 'RESERVA_SOB_SOLICITACAO' : (paymentData.method === 'BALCAO' ? 'RESERVA_BALCAO' : 'RESERVA_SUCESSO');
          sendWhatsappTrigger(
            waTrigger,
            {
              NOME: customerData.nome || '',
              SOBRENOME: customerData.sobrenome || '',
              NUMERO_RESERVA: finalResNumber || '',
              TELEFONE_CLIENTE: customerData.telefone || '',
              CARRO: bookingData.car?.carCategoryName || bookingData.car?.name || '',
              DATA_RETIRADA: bookingData.pickupDate || '',
              DATA_DEVOLUCAO: bookingData.returnDate || '',
              LOCAL_RETIRADA: bookingData.pickupStation || '',
              LOCAL_DEVOLUCAO: bookingData.returnStation || bookingData.pickupStation || '',
              VALOR_TOTAL: paymentData.amountInCents ? `R$ ${(paymentData.amountInCents / 100).toFixed(2).replace('.', ',')}` : '',
              FORMA_PAGAMENTO: paymentData.method || '',
            },
            customerData.telefone || undefined,
          );
        }).catch(err => console.error('[reservas] WhatsApp trigger falhou:', err));
      }

      // 5. Auto-criação de conta para clientes sem login (guest checkout)
      // Cria uma conta se o e-mail informado ainda não existe no banco.
      // Nunca bloqueia a reserva — erros são apenas logados.
      let accountCreated = false;
      if (customerData.email?.trim()) {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: customerData.email.trim().toLowerCase() },
            select: { id: true },
          });

          if (!existingUser) {
            const tempPassword = generateTemporaryPassword();
            const hashedPassword = await bcrypt.hash(tempPassword, 10);
            const fullName = `${customerData.nome || ''} ${customerData.sobrenome || ''}`.trim();

            await prisma.user.create({
              data: {
                name: fullName,
                email: customerData.email.trim().toLowerCase(),
                password: hashedPassword,
                phone: customerData.telefone || null,
                cpf: customerData.cpf?.replace(/\D/g, '').slice(0, 11) || null,
                role: 'USER',
                status: 'ACTIVE',
              },
            });

            accountCreated = true;
            console.log(`[reservas] ✅ Conta criada automaticamente para ${customerData.email} (reserva ${finalResNumber})`);

            // Envia e-mail de boas-vindas com credenciais (não bloqueia em caso de falha)
            sendWelcomeWithCredentials({
              toEmail: customerData.email.trim(),
              firstName: customerData.nome || fullName,
              password: tempPassword,
              resNumber: finalResNumber || undefined,
            }).catch(err => console.error('[reservas] Falha ao enviar e-mail de boas-vindas:', err));
          }
        } catch (accountErr: any) {
          console.error('[reservas] Falha ao criar conta automática:', accountErr.message);
        }
      }

      return NextResponse.json({
         success: true,
         resNumber: finalResNumber,
         merchantOrderId: finalMerchantOrderId,
         pixData,
         onRequest: isOnRequest,
         onRequestItems,
         accountCreated,
         cieloLog: `${cieloLog} | ${logOrigem}`
      });

   } catch (error: any) {
      console.error(error);

      // ── AUTO-VOID: se a Cielo já cobrou mas o XRS falhou, estorna automaticamente ──
      // Evita que o cliente pague sem ter reserva criada.
      if (cieloPaymentId && cieloConfig?.merchantId && cieloConfig?.merchantKey) {
        try {
          console.warn(`[reservas] XRS falhou após cobrança Cielo (${cieloPaymentId}) — iniciando void automático.`);
          const voidResult = await voidCieloPayment(
            cieloPaymentId,
            cieloConfig.merchantId,
            cieloConfig.merchantKey,
            isSandboxMode
          );
          if (voidResult.voided) {
            console.log(`[reservas] ✅ Void automático bem-sucedido: PaymentId ${cieloPaymentId}`);
            error.message = error.message + ` | Cobrança estornada automaticamente (PaymentId: ${cieloPaymentId}).`;
          } else {
            console.error(`[reservas] ❌ Void automático FALHOU: ${voidResult.message} — PaymentId ${cieloPaymentId} precisa de estorno manual!`);
            error.message = error.message + ` | ATENÇÃO: estorno automático falhou — PaymentId ${cieloPaymentId} precisa ser estornado manualmente na Cielo.`;
          }
        } catch (voidErr: any) {
          console.error(`[reservas] ❌ Exceção no void automático — PaymentId ${cieloPaymentId} precisa de estorno manual:`, voidErr.message);
          error.message = error.message + ` | ATENÇÃO: estorno automático falhou — PaymentId ${cieloPaymentId} precisa ser estornado manualmente na Cielo.`;
        }
      }

      // Trigger Falha Pagamento — envia para QUALQUER erro no processamento
      if (customerEmail) {
        try {
           import('@/lib/emailService').then(({ sendTransactionalEmail }) => {
              sendTransactionalEmail(customerEmail, 'FALHA_PAGAMENTO', {
                NOME: customerName,
                NUMERO_RESERVA: '',
                ERRO: (error.message || 'Erro desconhecido').slice(0, 200)
              }).catch(console.error);
           });
        } catch(e){}
      }
      return NextResponse.json({ error: 'Erro ao processar reserva: ' + error.message }, { status: 500 });
   }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resNumber = searchParams.get('resNumber');

  if (!resNumber) {
     return NextResponse.json({ error: 'resNumber is required' }, { status: 400 });
  }

  try {
     const reservaLocal = await prisma.localReservation.findUnique({
         where: { resNumber }
     });

     if (!reservaLocal) {
         return NextResponse.json({ error: 'Reserva não encontrada no banco local' }, { status: 404 });
     }

     return NextResponse.json(reservaLocal);
  } catch (error: any) {
     return NextResponse.json({ error: 'Erro ao buscar reserva local' }, { status: 500 });
  }
}
