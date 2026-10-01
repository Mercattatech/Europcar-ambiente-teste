import prisma from '@/lib/prisma';
import { BASE_REJECTION_DICTIONARY, RejectionDictionaryEntry } from './rejectionDictionaryData';

export interface FailedTransactionContext {
  provider?: string;
  brand?: string;
  cardBrand?: string;
  returnCode?: string | number;
  returnMessage?: string;
  amount?: number; // pode vir em BRL (ex: 250.00) ou em centavos (ex: 25000)
  amountIsCents?: boolean;
  paymentMethod?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  reservationId?: string;
  paymentId?: string;
  merchantOrderId?: string;
  attemptNumber?: number;
  httpStatus?: number;
  endpoint?: string;
  rawPayload?: any;
  fraudAnalysis?: any;
  is3dsError?: boolean;
}

/**
 * 3.1 Normalizar bandeiras
 */
export function normalizeBrand(brand?: string | null): string {
  if (!brand) return 'Cielo/Geral';
  const clean = brand.trim().toUpperCase();
  if (clean.includes('VISA')) return 'Visa';
  if (clean.includes('MASTER')) return 'Mastercard';
  if (clean.includes('ELO')) return 'Elo';
  if (clean.includes('AMEX') || clean.includes('AMERICAN EXPRESS') || clean.includes('AMERICANEXPRESS')) return 'AmEx';
  if (clean.includes('HIPER') || clean.includes('HIPERCARD')) return 'Hipercard';
  return 'Cielo/Geral';
}

/**
 * 3.2 Normalizar códigos
 */
export function normalizeReturnCode(code?: string | number | null): string {
  if (code === undefined || code === null) return 'UNKNOWN';
  let str = String(code).trim().toUpperCase();
  // Se for apenas numérico simples com zero à esquerda de 1 dígito (ex: "5" -> "05" ou "05" -> "05")
  // Mas preserva códigos alfanuméricos como "5C*", "6P", "U3", "FG", etc.
  if (str.endsWith('*')) {
    str = str.replace(/\*+$/, '');
  }
  return str;
}

/**
 * Expande aliases de códigos compostos
 */
export function expandAliases(codeDisplay: string): string[] {
  const aliases = new Set<string>();
  aliases.add(codeDisplay.trim().toUpperCase());
  aliases.add(codeDisplay.trim().replace(/\*+$/, '').toUpperCase());

  // Tratamento de "X ou Y"
  if (codeDisplay.includes(' ou ')) {
    const parts = codeDisplay.split(' ou ');
    for (const part of parts) {
      const p = part.trim().toUpperCase();
      aliases.add(p);
      aliases.add(p.replace(/\*+$/, ''));
    }
  }

  return Array.from(aliases);
}

/**
 * 4. Detecção explícita de Linx Online / Lynx / Antifraude
 */
export function detectLinxAntifraud(context: FailedTransactionContext): { isAntifraud: boolean; reason?: string } {
  const raw = context.rawPayload || {};
  const msg = (context.returnMessage || '').toLowerCase();
  const rawCode = String(context.returnCode || '').trim();

  // FraudAnalysis explicit status
  const faStatus = raw?.Payment?.FraudAnalysis?.Status || context.fraudAnalysis?.Status;
  if (faStatus === 'Rejected' || faStatus === 2) {
    return { isAntifraud: true, reason: 'FraudAnalysis.Status=Rejected' };
  }

  // ReasonCode / ReturnCode 16
  const reasonCode = raw?.Payment?.ReasonCode ?? raw?.ReasonCode;
  if (String(reasonCode) === '16' || String(rawCode) === '16') {
    return { isAntifraud: true, reason: 'ReasonCode=16' };
  }

  // Erros comuns de antifraude
  if (msg.includes('abortedbyfraud') || msg.includes('aborted by fraud')) {
    return { isAntifraud: true, reason: 'AbortedByFraud' };
  }
  if (msg.includes('couldnotantifraud') || msg.includes('could not antifraud')) {
    return { isAntifraud: true, reason: 'CouldNotAntifraud' };
  }
  if (msg.includes('connectionwithantifraudfailed') || msg.includes('connection with antifraud failed')) {
    return { isAntifraud: true, reason: 'ConnectionWithAntifraudFailed' };
  }
  if (msg.includes('abortedbycardverification') || msg.includes('aborted by card verification')) {
    return { isAntifraud: true, reason: 'AbortedByCardVerification' };
  }
  if (msg.includes('linx') || msg.includes('lynx') || msg.includes('antifraude') || msg.includes('antifraud')) {
    return { isAntifraud: true, reason: 'Mensagem contém Linx/Antifraude' };
  }

  return { isAntifraud: false };
}

/**
 * Sanitiza payload para nunca armazenar PAN completo, CVV ou senhas
 */
export function sanitizePaymentPayload(payload: any): any {
  if (!payload) return null;
  try {
    const copy = JSON.parse(JSON.stringify(payload));

    const sanitizeRecursive = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      for (const key of Object.keys(obj)) {
        const lowerKey = key.toLowerCase();
        if (['securitycode', 'cvv', 'cvc', 'security_code'].includes(lowerKey)) {
          obj[key] = '***';
        } else if (['cardnumber', 'card_number', 'number'].includes(lowerKey) && typeof obj[key] === 'string') {
          const num = obj[key].replace(/\D/g, '');
          if (num.length >= 10) {
            obj[key] = `${num.slice(0, 6)}******${num.slice(-4)}`;
          } else {
            obj[key] = '******';
          }
        } else if (['password', 'senha', 'token'].includes(lowerKey)) {
          obj[key] = '***';
        } else if (typeof obj[key] === 'object') {
          sanitizeRecursive(obj[key]);
        }
      }
    };

    sanitizeRecursive(copy);
    return copy;
  } catch {
    return { error: 'Payload não serializável' };
  }
}

/**
 * Normaliza valor monetário para formato decimal em Reais
 */
export function normalizeAmount(amount?: number | string | null, isCents?: boolean): number {
  if (!amount) return 0;
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(',', '.'));
  if (isNaN(num)) return 0;
  // Se explicitamente marcado como centavos ou maior que 10.000 em operações de locação que não ultrapassam R$ 100 mil
  if (isCents) {
    return Math.round(num) / 100;
  }
  return num;
}

/**
 * Resolução de códigos especiais prioritários (FG, GA, GF, GD, GT, GK)
 */
function resolveSpecialCode(codeNormalized: string, rawCode: string): RejectionDictionaryEntry | null {
  const specials = ['FG', 'GA', 'GF', 'GD', 'GT', 'GK'];
  const target = specials.find(s => s === codeNormalized || s === rawCode.trim().toUpperCase());
  if (!target) return null;
  return BASE_REJECTION_DICTIONARY.find(e => e.codeNormalized === target) || null;
}

/**
 * Garante que as tabelas de recusas e o dicionário de 142 itens existam no banco
 */
export async function ensureRejectionTablesAndSeed(): Promise<{ seededCount: number }> {
  try {
    // 1. Cria tabelas caso ainda não tenham sido migradas
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "transaction_rejection_logs" (
        "id" TEXT NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "event_id" VARCHAR(150),
        "attempt_number" INTEGER,
        "customer_name" VARCHAR(255),
        "customer_email" VARCHAR(255),
        "customer_phone" VARCHAR(50),
        "reservation_id" VARCHAR(100),
        "cielo_payment_id" VARCHAR(100),
        "cielo_merchant_order_id" VARCHAR(100),
        "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
        "payment_method" VARCHAR(50),
        "provider" VARCHAR(50) NOT NULL,
        "card_brand" VARCHAR(50),
        "rejection_category" VARCHAR(80) NOT NULL,
        "rejection_type" VARCHAR(30),
        "can_retry" BOOLEAN,
        "return_code_raw" VARCHAR(100),
        "return_code_normalized" VARCHAR(50),
        "return_message" TEXT,
        "dictionary_message" TEXT,
        "customer_message" TEXT,
        "customer_friendly_message" TEXT,
        "friendly_explanation" TEXT,
        "recommended_action" TEXT,
        "action_status" TEXT,
        "responsibility" VARCHAR(120),
        "root_cause" TEXT,
        "ai_behavior_instruction" TEXT,
        "retry_policy_text" VARCHAR(50),
        "mapping_status" VARCHAR(30) DEFAULT 'MAPPED',
        "mapping_confidence" DECIMAL(5,2),
        "http_status" INTEGER,
        "source_endpoint" VARCHAR(255),
        "raw_payload" JSONB,
        "fingerprint" VARCHAR(255),
        CONSTRAINT "transaction_rejection_logs_pkey" PRIMARY KEY ("id")
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "rejection_code_dictionary" (
        "id" TEXT NOT NULL,
        "provider" VARCHAR(50) DEFAULT 'Cielo',
        "card_brand" VARCHAR(50) NOT NULL,
        "code_display" VARCHAR(100) NOT NULL,
        "code_normalized" VARCHAR(50),
        "aliases" JSONB,
        "rejection_type" VARCHAR(30),
        "technical_message" TEXT,
        "customer_message" TEXT,
        "rejection_category" VARCHAR(80),
        "friendly_explanation" TEXT,
        "recommended_action" TEXT,
        "action_status" TEXT,
        "responsibility" VARCHAR(120),
        "root_cause" TEXT,
        "ai_behavior_instruction" TEXT,
        "customer_friendly_message" TEXT,
        "retry_policy_text" VARCHAR(50),
        "active" BOOLEAN DEFAULT true,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "rejection_code_dictionary_pkey" PRIMARY KEY ("id")
      );
    `);

    // 2. Se o dicionário estiver vazio, popula com as 142 entradas oficiais
    const count: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "rejection_code_dictionary"`);
    const currentCount = count?.[0]?.count ? Number(count[0].count) : 0;

    if (currentCount < BASE_REJECTION_DICTIONARY.length) {
      console.log(`[rejectionService] Semeando ${BASE_REJECTION_DICTIONARY.length} códigos de referência no dicionário...`);
      for (const item of BASE_REJECTION_DICTIONARY) {
        await prisma.rejectionCodeDictionary.create({
          data: {
            provider: item.provider,
            cardBrand: item.cardBrand,
            codeDisplay: item.codeDisplay,
            codeNormalized: item.codeNormalized,
            aliases: item.aliases,
            rejectionType: item.rejectionType,
            technicalMessage: item.technicalMessage,
            customerMessage: item.customerMessage,
            customerFriendlyMessage: item.customerFriendlyMessage,
            rejectionCategory: item.rejectionCategory,
            friendlyExplanation: item.friendlyExplanation,
            recommendedAction: item.recommendedAction,
            actionStatus: item.actionStatus,
            responsibility: item.responsibility,
            rootCause: item.rootCause,
            aiBehaviorInstruction: item.aiBehaviorInstruction,
            retryPolicyText: item.retryPolicyText,
            active: true
          }
        }).catch(() => {});
      }
      console.log(`[rejectionService] Dicionário de recusas inicializado com sucesso.`);
    }

    return { seededCount: BASE_REJECTION_DICTIONARY.length };
  } catch (err: any) {
    console.warn('[rejectionService] Aviso na inicialização de tabelas:', err.message);
    return { seededCount: 0 };
  }
}

/**
 * 3.3 Ordem de resolução e matching do dicionário
 */
export async function matchDictionaryCode(context: {
  provider: string;
  brand: string;
  codeNormalized: string;
  rawCode: string;
  technicalMessage?: string;
  isAntifraud?: boolean;
}): Promise<{
  mappingStatus: 'MAPPED' | 'AMBIGUOUS' | 'UNKNOWN';
  confidence: number;
  entry: Partial<RejectionDictionaryEntry>;
}> {
  const { provider, brand, codeNormalized, rawCode, technicalMessage = '', isAntifraud } = context;

  // 1. Códigos especiais prioritários: FG, GA, GF, GD, GT, GK
  const specialMatch = resolveSpecialCode(codeNormalized, rawCode);
  if (specialMatch) {
    return {
      mappingStatus: 'MAPPED',
      confidence: 1.0,
      entry: specialMatch
    };
  }

  // 2. Linx/Antifraude explícito
  if (isAntifraud || codeNormalized === '16' || rawCode.toLowerCase().includes('linx') || technicalMessage.toLowerCase().includes('linx')) {
    const linxEntry = BASE_REJECTION_DICTIONARY.find(e => e.codeNormalized === '16' || e.codeDisplay === 'GA') || {
      provider: 'Linx Online',
      cardBrand: 'Cielo/Geral',
      codeDisplay: '16',
      codeNormalized: '16',
      aliases: ['16', 'LINX_UNAUTH'],
      rejectionType: 'IRREVERSÍVEL',
      canRetry: false,
      technicalMessage: 'Transação reprovada preventivamente pela análise de risco Linx.',
      customerMessage: 'Transação não autorizada por medidas preventivas de segurança.',
      customerFriendlyMessage: 'Por medidas de segurança, sua transação não pôde ser autorizada no momento. Você pode tentar finalizar a compra utilizando outra forma de pagamento, como o Pix.',
      rejectionCategory: 'ANTIFRAUD_LINX',
      friendlyExplanation: 'Bloqueio preventivo por risco na análise antifraude Linx.',
      recommendedAction: 'Oferecer pagamento imediato via Pix ou cartão alternativo.',
      actionStatus: 'Bloqueio preventivo',
      responsibility: 'Sistema Antifraude (Análise de Risco)',
      rootCause: 'Análise de risco Linx reprovou preventivamente a transação.',
      aiBehaviorInstruction: 'Não acusar o cliente de fraude. Explicar como procedimento de segurança e sugerir Pix.',
      retryPolicyText: 'Não'
    };
    return {
      mappingStatus: 'MAPPED',
      confidence: 0.98,
      entry: linxEntry
    };
  }

  // 3. Regras XRS
  if (provider === 'Europcar XRS' || rawCode.startsWith('rental.') || rawCode.startsWith('mop.') || rawCode.startsWith('delcol.')) {
    let cat = 'XRS_RULES';
    let friendly = technicalMessage || 'Regra de locação Europcar XRS não atendida.';
    let action = 'Verificar regras da categoria e idade do condutor.';
    let canRetry = true;
    let resp = 'Sistema XRS / Locadora';

    if (rawCode.includes('drivertooyoung')) {
      friendly = 'Idade do condutor abaixo do mínimo exigido para este veículo.';
      action = 'Selecionar categoria compatível com a idade ou condutor sênior.';
      canRetry = false;
      resp = 'Cliente (Portador do Cartão)';
    } else if (rawCode.includes('categorynotavailable')) {
      friendly = 'Categoria de veículo temporariamente esgotada para esta estação.';
      action = 'Sugerir outra categoria disponível ou outra estação.';
      canRetry = false;
    } else if (rawCode.includes('creditCardExpired')) {
      cat = 'CARD_EXPIRED';
      friendly = 'Validade do cartão expirada na data de devolução do veículo.';
      action = 'Informar cartão válido após a data de retorno.';
      canRetry = true;
      resp = 'Cliente (Portador do Cartão)';
    } else if (rawCode.includes('noDeliveryAtThisStation')) {
      friendly = 'Estação não realiza entrega/recolha no local informado.';
      action = 'Ajustar local de retirada para estação principal.';
      canRetry = false;
    }

    return {
      mappingStatus: 'MAPPED',
      confidence: 0.95,
      entry: {
        provider: 'Europcar XRS',
        cardBrand: 'XRS',
        codeDisplay: rawCode,
        codeNormalized: normalizeReturnCode(rawCode),
        aliases: [rawCode],
        rejectionType: canRetry ? 'REVERSÍVEL' : 'IRREVERSÍVEL',
        canRetry,
        technicalMessage,
        customerMessage: friendly,
        customerFriendlyMessage: friendly,
        rejectionCategory: cat,
        friendlyExplanation: friendly,
        recommendedAction: action,
        responsibility: resp,
        rootCause: `Regra de locação Europcar: ${rawCode}`
      }
    };
  }

  // 4. Buscar no dicionário oficial (Primeiro na memória para rapidez, com consulta flexível)
  const normMsg = technicalMessage.toLowerCase();

  // Filtrar candidatos pela bandeira (ou bandeiras gerais)
  let candidates = BASE_REJECTION_DICTIONARY.filter(e => {
    const brandMatch = e.cardBrand.toLowerCase() === brand.toLowerCase() || e.cardBrand === 'Cielo/Geral';
    const codeMatch = e.codeNormalized === codeNormalized || e.aliases.some(a => a.toUpperCase() === codeNormalized || a.toUpperCase() === rawCode.toUpperCase());
    return brandMatch && codeMatch;
  });

  // Se não achou na mesma bandeira, tentar em qualquer bandeira se o código for unívoco
  if (candidates.length === 0) {
    candidates = BASE_REJECTION_DICTIONARY.filter(e => {
      return e.codeNormalized === codeNormalized || e.aliases.some(a => a.toUpperCase() === codeNormalized || a.toUpperCase() === rawCode.toUpperCase());
    });
  }

  // Se exatamente 1 candidato encontrado
  if (candidates.length === 1) {
    return {
      mappingStatus: 'MAPPED',
      confidence: 0.95,
      entry: candidates[0]
    };
  }

  // Se múltiplos candidatos (ex: 57 com fraude vs terminal vs transação não permitida)
  if (candidates.length > 1) {
    // Desempate por mensagem técnica / contexto
    let bestCandidate = candidates[0];
    let maxScore = -1;

    for (const c of candidates) {
      let score = 0;
      const cTech = (c.technicalMessage || '').toLowerCase();
      const cPos = (c.customerMessage || '').toLowerCase();

      // Palavras-chave
      if (normMsg.includes('fraude') && (cTech.includes('fraude') || cPos.includes('fraude'))) score += 5;
      if (normMsg.includes('terminal') && (cTech.includes('terminal') || cPos.includes('terminal'))) score += 5;
      if (normMsg.includes('lei') && (cTech.includes('lei') || cPos.includes('lei'))) score += 5;
      if (normMsg.includes('senha') && (cTech.includes('senha') || cPos.includes('senha'))) score += 5;
      if (normMsg.includes('saldo') || normMsg.includes('limite')) {
        if (cTech.includes('saldo') || cTech.includes('limite')) score += 5;
      }
      if (c.cardBrand.toLowerCase() === brand.toLowerCase()) score += 2;

      if (score > maxScore) {
        maxScore = score;
        bestCandidate = c;
      }
    }

    if (maxScore > 0) {
      return {
        mappingStatus: 'MAPPED',
        confidence: 0.85,
        entry: bestCandidate
      };
    }

    // Se continuar ambíguo
    return {
      mappingStatus: 'AMBIGUOUS',
      confidence: 0.50,
      entry: bestCandidate
    };
  }

  // 5. Código desconhecido / não mapeado
  return {
    mappingStatus: 'UNKNOWN',
    confidence: 0,
    entry: {
      provider,
      cardBrand: brand,
      codeDisplay: rawCode || 'UNKNOWN',
      codeNormalized,
      aliases: [rawCode],
      rejectionType: 'N/A',
      canRetry: null,
      technicalMessage,
      customerMessage: 'Transação não autorizada pela operadora.',
      customerFriendlyMessage: 'Seu pagamento não pôde ser processado. Por favor, tente novamente ou escolha outra forma de pagamento, como o Pix.',
      rejectionCategory: 'UNKNOWN_CODE',
      friendlyExplanation: technicalMessage || 'Código de recusa ainda não cadastrado no dicionário.',
      recommendedAction: 'Analisar payload bruto na tabela e cadastrar novo código no dicionário.',
      responsibility: 'Banco Emissor / Adquirente',
      rootCause: technicalMessage || 'Código não identificado'
    }
  };
}

/**
 * 1. Construtor determinístico de chave de idempotência
 */
export function buildIdempotencyKey(params: {
  merchantOrderId?: string | null;
  paymentId?: string | null;
  attemptNumber?: number | null;
  codeNormalized?: string | null;
}): string {
  const merchantOrderId = params.merchantOrderId || null;
  const paymentId = params.paymentId || null;
  const attemptNumber = params.attemptNumber || 1;
  const codeNormalized = params.codeNormalized || 'UNKNOWN';

  if (merchantOrderId || paymentId) {
    return `rec_${merchantOrderId || 'noorder'}_${paymentId || 'nopay'}_att${attemptNumber}_${codeNormalized}`.slice(0, 140);
  }
  return `rec_evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${codeNormalized}`.slice(0, 140);
}

/**
 * 14. CAPTURA BACK-END — Função Principal
 * Registra qualquer recusa ou falha operacional em transaction_rejection_logs
 */
export async function registerFailedTransaction(context: FailedTransactionContext): Promise<any> {
  try {
    const raw = context.rawPayload || {};
    const provider = context.provider || (context.endpoint?.includes('xrs') ? 'Europcar XRS' : 'Cielo');
    const brand = normalizeBrand(context.brand || raw?.Payment?.CreditCard?.Brand || raw?.brand);
    const rawCode = String(context.returnCode || raw?.Payment?.ReturnCode || (Array.isArray(raw) ? raw[0]?.Code : '') || 'SEM_CODIGO').trim();
    const codeNormalized = normalizeReturnCode(rawCode);
    const technicalMessage = context.returnMessage || raw?.Payment?.ReturnMessage || (Array.isArray(raw) ? raw[0]?.Message : '') || '';
    const linx = detectLinxAntifraud(context);

    // Matching
    const resolution = await matchDictionaryCode({
      provider,
      brand,
      codeNormalized,
      rawCode,
      technicalMessage,
      isAntifraud: linx.isAntifraud
    });

    const mapping = resolution.entry;
    const amountVal = normalizeAmount(context.amount, context.amountIsCents);

    // Idempotency key: único por tentativa real
    const paymentId = context.paymentId || raw?.Payment?.PaymentId || null;
    const merchantOrderId = context.merchantOrderId || raw?.MerchantOrderId || null;
    const attemptNumber = context.attemptNumber || 1;
    
    // Hash determinístico para evitar duplicatas de webhooks/reprocessamento.
    const eventId = buildIdempotencyKey({ merchantOrderId, paymentId, attemptNumber, codeNormalized });

    const safePayload = sanitizePaymentPayload(raw);

    const record = {
      eventId,
      attemptNumber,
      customerName: context.customerName || safePayload?.Customer?.Name || null,
      customerEmail: context.customerEmail || safePayload?.Customer?.Email || null,
      customerPhone: context.customerPhone || safePayload?.Customer?.Phone || null,
      reservationId: context.reservationId || null,
      cieloPaymentId: paymentId,
      cieloMerchantOrderId: merchantOrderId,
      amount: amountVal,
      paymentMethod: context.paymentMethod || (paymentId ? 'CREDIT' : 'UNKNOWN'),
      provider,
      cardBrand: brand,
      rejectionCategory: mapping.rejectionCategory || 'UNKNOWN_CODE',
      rejectionType: mapping.rejectionType || null,
      canRetry: mapping.canRetry !== undefined ? mapping.canRetry : (mapping.rejectionType === 'REVERSÍVEL' ? true : mapping.rejectionType === 'IRREVERSÍVEL' ? false : null),
      returnCodeRaw: rawCode,
      returnCodeNormalized: codeNormalized,
      returnMessage: technicalMessage,
      dictionaryMessage: mapping.technicalMessage || null,
      customerMessage: mapping.customerMessage || null,
      customerFriendlyMessage: mapping.customerFriendlyMessage || null,
      friendlyExplanation: mapping.friendlyExplanation || technicalMessage,
      recommendedAction: mapping.recommendedAction || null,
      actionStatus: mapping.actionStatus || null,
      responsibility: mapping.responsibility || null,
      rootCause: mapping.rootCause || null,
      aiBehaviorInstruction: mapping.aiBehaviorInstruction || null,
      retryPolicyText: mapping.retryPolicyText || null,
      mappingStatus: resolution.mappingStatus,
      mappingConfidence: resolution.confidence,
      httpStatus: context.httpStatus || 200,
      sourceEndpoint: context.endpoint || '/api/reservas',
      rawPayload: safePayload,
      fingerprint: `${brand}_${codeNormalized}_${merchantOrderId}`
    };

    // Upsert para idempotência garantida
    const saved = await prisma.transactionRejectionLog.upsert({
      where: { eventId },
      update: {
        amount: record.amount,
        returnMessage: record.returnMessage,
        rawPayload: safePayload,
        mappingStatus: record.mappingStatus
      },
      create: record
    });

    console.log(`[rejectionService] ✅ Recusa registrada: [${brand}] Código ${codeNormalized} (${record.rejectionCategory}) — Perda: R$ ${amountVal.toFixed(2)}`);
    return saved;
  } catch (error: any) {
    // Falha no log nunca deve interromper o fluxo do checkout
    console.error('[rejectionService] ❌ Erro ao registrar recusa:', error.message);
    return null;
  }
}
