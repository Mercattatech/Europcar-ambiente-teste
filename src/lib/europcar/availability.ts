/**
 * availability
 *
 * Consulta de disponibilidade e preço por categoria (ACRISS) — usada pela ferramenta MCP
 * `consultar_disponibilidade`. Reproduz o que a tela /reservation/vehicles faz:
 *   1. getCarCategories  → categorias que a estação de retirada opera para o trecho/período
 *   2. getMultipleRates  → tarifas POA (CIDs 57269673 + 55138134 promocional) e, em estações
 *                          fora do Brasil, ETO "Pagar agora" (56935466) e ETO franquia zero (56935495)
 *   3. Markup (eto_margin_percent do painel) aplicado SOMENTE nas tarifas ETO — igual ao site.
 *
 * Estado por categoria:
 *   - disponivel      → tarifa retornada (statusCode ≠ R/U)
 *   - sob_requisicao  → XRS statusCode R, ou categoria marcada "on request" no painel
 *   - ausente         → estação não opera a categoria, XRS não devolveu tarifa ou statusCode U
 */
import prisma from '@/lib/prisma';
import {
  callXRS,
  getStation,
  DEFAULT_POA_CID,
  SECONDARY_POA_CID,
  ETO_CID_LIQUIDO,
  ETO_CID_INTERNACIONAL,
} from '@/lib/europcar/xrsClient';
import { isValidXRSDate, isValidXRSTime } from '@/lib/europcar/validate';
import { escapeXml } from '@/lib/europcar/xmlEscape';
import { calculateRentalDays, isBrazilStationOrCountry } from '@/lib/europcar/rentalDuration';
import { computeEtoPricing, normalizeMinDiscountPercent, ETO_MIN_DISCOUNT_KEY } from '@/lib/pricing/etoPricing';

export type EstadoCategoria = 'disponivel' | 'sob_requisicao' | 'ausente';

export interface DisponibilidadeParams {
  lojaRetirada: string;
  lojaDevolucao?: string;
  dataRetirada: string;
  horaRetirada?: string;
  dataDevolucao: string;
  horaDevolucao?: string;
  /** Códigos ACRISS (ex.: CDMR). Se vazio, consulta todas as categorias da estação. */
  categorias?: string[];
  idadeCondutor?: number;
  /** País de residência do condutor (ISO-2). Padrão: BR */
  paisResidencia?: string;
  /** Inclui o preço NET (sem markup) das tarifas ETO — uso interno. */
  incluirPrecoLiquido?: boolean;
}

const num = (v: any): number => {
  const n = parseFloat(String(v ?? '0'));
  return isNaN(n) ? 0 : n;
};
const arr = (v: any): any[] => (Array.isArray(v) ? v : v ? [v] : []);
const round2 = (v: number) => Math.round(v * 100) / 100;
const rank: Record<EstadoCategoria, number> = { disponivel: 0, sob_requisicao: 1, ausente: 2 };

// ── Normalização de entrada ──────────────────────────────────

/** Aceita YYYYMMDD, YYYY-MM-DD ou DD/MM/YYYY → YYYYMMDD */
export function normalizeDate(value: string): string {
  const v = String(value || '').trim();
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}${m[2]}${m[1]}`;
  return v;
}

/** Aceita HHMM, HH:MM ou H:MM → HHMM */
export function normalizeTime(value: string | undefined, fallback = '1000'): string {
  const v = String(value || '').trim();
  if (!v) return fallback;
  const m = v.match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return v;
  return `${m[1].padStart(2, '0')}${m[2]}`;
}

const fmtDateBR = (d: string) => `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}`;
const fmtTimeBR = (t: string) => `${t.slice(0, 2)}:${t.slice(2, 4)}`;

async function readMarkupPercent(): Promise<{ percent: number; minDiscountPercent: number; failed: boolean }> {
  try {
    const cfg = await prisma.contentBlock.findUnique({ where: { key: 'eto_margin_percent' } });
    const minCfg = await prisma.contentBlock.findUnique({ where: { key: ETO_MIN_DISCOUNT_KEY } });
    const p = parseFloat(cfg?.value_ptBR || '0');
    return { percent: isNaN(p) || p < 0 ? 0 : p, minDiscountPercent: normalizeMinDiscountPercent(minCfg?.value_ptBR), failed: false };
  } catch {
    // mesmo comportamento de /api/admin/margin quando o banco está fora (markup 0), mas sinalizado
    return { percent: 0, minDiscountPercent: normalizeMinDiscountPercent(undefined), failed: true };
  }
}

async function readOnRequestOverrides(): Promise<{ onRequest: Set<string>; names: Record<string, string> }> {
  try {
    const rows = await prisma.carCategoryOverride.findMany();
    return {
      onRequest: new Set(rows.filter((r) => r.onRequest).map((r) => r.carCode.toUpperCase())),
      names: Object.fromEntries(rows.map((r) => [r.carCode.toUpperCase(), r.friendlyName])),
    };
  } catch {
    return { onRequest: new Set(), names: {} };
  }
}

// ── XRS ───────────────────────────────────────────────────────

const XRS_CFG = {
  callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
  password: process.env.XRS_PASSWORD || 'DEMO',
};

interface Ctx {
  pickupStation: string;
  returnStation: string;
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  returnTime: string;
  driverAge?: number;
  residence: string;
}

const serviceResponseOf = (parsed: any) => parsed?.message?.serviceResponse || parsed?.serviceResponse;

/** Extrai texto de erro de negócio (KO / errorCode) de um serviceResponse. */
function businessError(parsed: any): string | null {
  const sr = serviceResponseOf(parsed);
  if (!sr) return null;
  const errorCode = sr.$?.errorCode || sr.errorCode || '';
  const returnCode = sr.$?.returnCode || sr.returnCode || sr.status?.$?.returnCode || sr.status?.returnCode || '';
  if (errorCode) return String(errorCode);
  if (returnCode === 'KO') {
    const raw = JSON.stringify(sr.errorList || sr.status || {});
    return raw.length > 300 ? raw.slice(0, 300) + '…' : raw;
  }
  return null;
}

async function fetchCategoryCodes(ctx: Ctx): Promise<{ codes: string[]; names: Record<string, string>; error?: string }> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getCarCategories">
    <serviceContext language="pt_PT"/>
    <serviceParameters>
      <reservation contractID="${DEFAULT_POA_CID}" type="C">
        <checkout stationID="${escapeXml(ctx.pickupStation)}" date="${ctx.pickupDate}" time="${ctx.pickupTime}"/>
        <checkin stationID="${escapeXml(ctx.returnStation)}" date="${ctx.returnDate}" time="${ctx.returnTime}"/>
      </reservation>
    </serviceParameters>
  </serviceRequest>
</message>`;
  const parsed = await callXRS(xml, { ...XRS_CFG, action: 'getCarCategories', sourceFile: 'availability.ts' });
  const error = businessError(parsed) || undefined;
  const list = arr(serviceResponseOf(parsed)?.carCategoryList?.carCategory);
  const codes: string[] = [];
  const names: Record<string, string> = {};
  for (const c of list) {
    const a = c.$ || c;
    if (a.carCategoryCode) {
      codes.push(String(a.carCategoryCode).toUpperCase());
      if (a.carCategoryName || a.carCategorySample) names[String(a.carCategoryCode).toUpperCase()] = a.carCategoryName || a.carCategorySample;
    }
  }
  return { codes, names, error };
}

interface RateRow {
  code: string;
  statusCode: string;
  currency: string;
  totalLocal: number;
  totalBRL: number;
  duration?: number;
  attrs: any;
  ageLimit: any;
}

/** getMultipleRates (chunks de 10 categorias) para um CID. Devolve linhas por categoria + avisos. */
async function fetchRates(ctx: Ctx, codes: string[], cid: string): Promise<{ rows: Map<string, RateRow>; warnings: string[] }> {
  const rows = new Map<string, RateRow>();
  const warnings: string[] = [];
  const chunks: string[][] = [];
  for (let i = 0; i < codes.length; i += 10) chunks.push(codes.slice(i, i + 10));

  await Promise.all(chunks.map(async (chunk) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getMultipleRates">
    <serviceContext language="PT"/>
    <serviceParameters>
      <reservation carCategoryPattern="${escapeXml(chunk.join(''))}" rateDetails="Y" chargesDetail="TRE" contractID="${cid}" type="C">
        <checkout stationID="${escapeXml(ctx.pickupStation)}" date="${ctx.pickupDate}" time="${ctx.pickupTime}"/>
        <checkin stationID="${escapeXml(ctx.returnStation)}" date="${ctx.returnDate}" time="${ctx.returnTime}"/>
      </reservation>
      <driver countryOfResidence="${escapeXml(ctx.residence)}"${ctx.driverAge ? ` age="${ctx.driverAge}"` : ''} />
    </serviceParameters>
  </serviceRequest>
</message>`;
    try {
      const parsed = await callXRS(xml, { ...XRS_CFG, action: 'getMultipleRates', sourceFile: 'availability.ts' });
      const err = businessError(parsed);
      if (err) warnings.push(`Contrato ${cid}: ${err}`);
      const sr = serviceResponseOf(parsed);
      const reservation = sr?.reservation;
      const duration = parseInt(String(reservation?.$?.duration || reservation?.duration || ''), 10) || undefined;
      for (const r of arr(sr?.reservationRateList?.reservationRate)) {
        const a = r.$ || r;
        const code = String(a.carCategoryCode || '').toUpperCase();
        if (!code) continue;
        rows.set(code, {
          code,
          statusCode: String(a.statusCode || '').toUpperCase(),
          currency: String(a.currency || 'BRL').toUpperCase(),
          totalLocal: num(a.totalRateEstimate),
          totalBRL: num(a.totalRateEstimateInBookingCurrency) || num(a.totalRateEstimate),
          duration,
          attrs: a,
          ageLimit: r.ageLimit?.$ || r.ageLimit || {},
        });
      }
    } catch (e: any) {
      warnings.push(`Contrato ${cid}: falha na consulta (${e?.message || 'erro'})`);
    }
  }));
  return { rows, warnings };
}

// ── Consulta principal ───────────────────────────────────────

export async function consultarDisponibilidade(p: DisponibilidadeParams) {
  const pickupStation = String(p.lojaRetirada || '').trim().toUpperCase();
  const returnStation = String(p.lojaDevolucao || '').trim().toUpperCase() || pickupStation;
  if (!pickupStation) throw new Error('lojaRetirada é obrigatória (código da estação, ex.: LIST01).');

  const pickupDate = normalizeDate(p.dataRetirada);
  const returnDate = normalizeDate(p.dataDevolucao);
  const pickupTime = normalizeTime(p.horaRetirada);
  const returnTime = normalizeTime(p.horaDevolucao, pickupTime);
  if (!isValidXRSDate(pickupDate)) throw new Error(`dataRetirada inválida: "${p.dataRetirada}". Use YYYY-MM-DD.`);
  if (!isValidXRSDate(returnDate)) throw new Error(`dataDevolucao inválida: "${p.dataDevolucao}". Use YYYY-MM-DD.`);
  if (!isValidXRSTime(pickupTime)) throw new Error(`horaRetirada inválida: "${p.horaRetirada}". Use HH:MM.`);
  if (!isValidXRSTime(returnTime)) throw new Error(`horaDevolucao inválida: "${p.horaDevolucao}". Use HH:MM.`);
  if (`${returnDate}${returnTime}` <= `${pickupDate}${pickupTime}`) throw new Error('A devolução deve ser posterior à retirada.');

  const driverAge = p.idadeCondutor && p.idadeCondutor > 0 ? Math.round(p.idadeCondutor) : undefined;
  const ctx: Ctx = {
    pickupStation, returnStation, pickupDate, pickupTime, returnDate, returnTime, driverAge,
    residence: (p.paisResidencia || 'BR').toUpperCase().slice(0, 2),
  };

  const avisos: string[] = [];

  // País da loja de retirada (decide se existem tarifas ETO e se vale markup)
  let stationCountry = '';
  let stationName = '';
  try {
    const st = await getStation(pickupStation);
    stationCountry = String(st?.countryCode || '').toUpperCase();
    stationName = [st?.stationName, st?.cityName].filter(Boolean).join(' — ');
  } catch { /* segue com o heurístico por prefixo */ }
  const isBrazil = stationCountry ? stationCountry === 'BR' : isBrazilStationOrCountry(pickupStation);

  // 1) Categorias que a estação opera
  const cat = await fetchCategoryCodes(ctx);
  if (cat.error === 'rental.onewaynotallowed') {
    throw new Error('Devolução não permitida entre essas lojas (one-way não permitido pela Europcar).');
  }
  if (cat.error) avisos.push(`getCarCategories: ${cat.error}`);
  const stationCodes = new Set(cat.codes);

  const requested = (p.categorias || []).map((c) => String(c).trim().toUpperCase()).filter(Boolean);
  const wanted = Array.from(new Set(requested.length > 0 ? requested : cat.codes));
  // Só consulta tarifa das categorias que a estação opera (igual ao site); as demais são "ausente"
  const toQuote = wanted.filter((c) => stationCodes.has(c));

  const [markupCfg, overrides] = await Promise.all([readMarkupPercent(), readOnRequestOverrides()]);
  const markup = markupCfg.percent;
  if (markupCfg.failed && !isBrazil) {
    avisos.push('Não foi possível ler o markup (eto_margin_percent) do painel — preços ETO exibidos SEM markup (equivalem ao NET).');
  }

  // 2) Tarifas
  const tariffs: { key: string; descricao: string; cid: string; markup: boolean }[] = [
    { key: 'POA', descricao: 'Pagar no balcão (tarifa pública)', cid: DEFAULT_POA_CID, markup: false },
    { key: 'POA_PROMO', descricao: 'Pagar no balcão (CID promocional, sobrepõe a pública)', cid: SECONDARY_POA_CID, markup: false },
  ];
  if (!isBrazil) {
    tariffs.push(
      { key: 'ETO', descricao: 'Pagar agora, cancelamento grátis (franquia padrão)', cid: ETO_CID_LIQUIDO, markup: true },
      { key: 'ETO_FRANQUIA_ZERO', descricao: 'Pagar agora com franquia zero', cid: ETO_CID_INTERNACIONAL, markup: true },
    );
  }

  const results: Record<string, Map<string, RateRow>> = {};
  if (toQuote.length > 0) {
    const fetched = await Promise.all(tariffs.map((t) => fetchRates(ctx, toQuote, t.cid)));
    tariffs.forEach((t, i) => {
      results[t.key] = fetched[i].rows;
      // Falhas em tarifas opcionais (ETO, promo) viram aviso; POA principal é tratada abaixo
      avisos.push(...fetched[i].warnings);
    });
    // POA promocional sobrepõe a pública (mesma regra do site)
    for (const [code, row] of results['POA_PROMO'] || []) results['POA'].set(code, row);
    delete results['POA_PROMO'];
    if (results['POA'].size === 0 && avisos.some((a) => a.includes(`Contrato ${DEFAULT_POA_CID}: falha`))) {
      throw new Error('Serviço de reservas Europcar indisponível no momento. Tente novamente em instantes.');
    }
  }

  const activeTariffs = tariffs.filter((t) => t.key !== 'POA_PROMO');

  // 3) Duração (diárias): preferência para a duração oficial do XRS
  const apiDuration = [...Object.values(results)].flatMap((m) => [...m.values()]).find((r) => r.duration)?.duration;
  const diarias = calculateRentalDays({
    pickupDate, pickupTime, returnDate, returnTime,
    station: pickupStation, country: stationCountry || undefined, apiDuration,
  });

  // 4) Monta resposta por categoria
  const categorias = wanted.map((code) => {
    const nome = overrides.names[code] || cat.names[code] || code;
    if (!stationCodes.has(code)) {
      return { codigo: code, nome, estado: 'ausente' as EstadoCategoria, motivo: 'Categoria não operada por esta loja no período/trecho informado.', tarifas: [] as any[] };
    }

    const marked = overrides.onRequest.has(code);
    const tarifas = activeTariffs.map((t) => {
      const row = results[t.key]?.get(code);
      if (!row || row.statusCode === 'U' || row.totalBRL <= 0) {
        return { tarifa: t.key, descricao: t.descricao, estado: 'ausente' as EstadoCategoria };
      }
      const estado: EstadoCategoria = row.statusCode === 'R' || marked ? 'sob_requisicao' : 'disponivel';
      // Markup ETO efetivo: o do painel, limitado pelo desconto mínimo sobre o POA (piso no NET).
      // A franquia zero usa o mesmo multiplicador da ETO padrão, igual ao site.
      const poaRow = results['POA']?.get(code);
      const etoStdRow = results['ETO']?.get(code);
      const etoPricing = poaRow && etoStdRow && poaRow.totalBRL > 0 && etoStdRow.totalBRL > 0
        ? computeEtoPricing({ etoNet: etoStdRow.totalBRL, poaTotal: poaRow.totalBRL, markupPercent: markup, minDiscountPercent: markupCfg.minDiscountPercent })
        : null;
      const mult = t.markup ? (etoPricing ? etoPricing.multiplier : 1 + markup / 100) : 1;
      const totalLocal = round2(row.totalLocal * mult);
      const totalBRL = round2(row.totalBRL * mult);
      return {
        tarifa: t.key,
        descricao: t.descricao,
        estado,
        moeda: row.currency,
        precoPorDia: round2(totalLocal / diarias),
        total: totalLocal,
        precoPorDiaBRL: round2(totalBRL / diarias),
        totalBRL,
        ...(t.markup ? { markupAplicadoPercent: round2((mult - 1) * 100) } : {}),
        ...(t.markup && p.incluirPrecoLiquido ? { totalBRLLiquidoSemMarkup: round2(row.totalBRL), totalLiquidoSemMarkup: round2(row.totalLocal) } : {}),
      };
    });

    const available = tarifas.filter((t) => t.estado !== 'ausente') as any[];
    if (available.length === 0) {
      return { codigo: code, nome, estado: 'ausente' as EstadoCategoria, motivo: 'XRS não devolveu tarifa para esta categoria no período.', tarifas };
    }
    const bestState = available.reduce<EstadoCategoria>((b, t) => (rank[t.estado as EstadoCategoria] < rank[b] ? t.estado : b), 'sob_requisicao');
    const cheapest = available
      .filter((t) => t.estado === bestState)
      .sort((a, b) => a.totalBRL - b.totalBRL)[0];

    const base = (results['POA']?.get(code) || results['ETO']?.get(code) || results['ETO_FRANQUIA_ZERO']?.get(code))!;
    const a = base.attrs;
    const minAge = parseInt(String(base.ageLimit?.minAgeForCategory || a.minAgeForCategory || '0'), 10) || 0;
    const minAgeCountry = parseInt(String(base.ageLimit?.minAgeForCountry || '0'), 10) || 0;
    const idadeMinima = Math.max(minAge, minAgeCountry);

    return {
      codigo: code,
      nome,
      exemplo: a.carCategorySample || undefined,
      estado: bestState,
      tarifaReferencia: cheapest.tarifa,
      moeda: cheapest.moeda,
      precoPorDia: cheapest.precoPorDia,
      total: cheapest.total,
      precoPorDiaBRL: cheapest.precoPorDiaBRL,
      totalBRL: cheapest.totalBRL,
      veiculo: {
        lugares: a.carCategorySeats || undefined,
        portas: a.carCategoryDoors || undefined,
        malas: a.carCategoryBaggageQuantity || undefined,
        cambioAutomatico: a.carCategoryAutomatic ? a.carCategoryAutomatic === 'Y' : undefined,
        arCondicionado: a.carCategoryAirCond ? a.carCategoryAirCond === 'Y' : undefined,
        quilometragem: ['UNLIMITED', 'ILLIMITE', 'ILIMITADO'].includes(String(a.includedKm || '').toUpperCase())
          ? 'ilimitada'
          : a.includedKm ? `${a.includedKm} ${a.includedKmUnit === 'M' ? 'milhas' : 'km'}${a.includedKmType === 'R' ? ' no período' : ' por dia'}` : undefined,
      },
      ...(idadeMinima > 0 ? { idadeMinimaCondutor: idadeMinima } : {}),
      ...(driverAge && idadeMinima > 0 && driverAge < idadeMinima
        ? { observacao: `Condutor com ${driverAge} anos abaixo da idade mínima (${idadeMinima}) — o site bloqueia a reserva.` }
        : {}),
      tarifas,
    };
  });

  const count = (s: EstadoCategoria) => categorias.filter((c) => c.estado === s).length;

  return {
    consulta: {
      retirada: { loja: pickupStation, nomeLoja: stationName || undefined, data: fmtDateBR(pickupDate), hora: fmtTimeBR(pickupTime) },
      devolucao: { loja: returnStation, data: fmtDateBR(returnDate), hora: fmtTimeBR(returnTime) },
      diarias,
      idadeCondutor: driverAge ?? 'não informada',
      paisLojaRetirada: stationCountry || (isBrazil ? 'BR (estimado)' : 'exterior (estimado)'),
      tarifasConsultadas: activeTariffs.map((t) => t.key),
      markupEtoPercent: isBrazil ? 0 : markup,
      observacao: 'Preços ETO já incluem o markup do painel. Valores "BRL" são o que o cliente paga; "moeda" é a moeda local da loja.',
    },
    resumo: { disponiveis: count('disponivel'), sobRequisicao: count('sob_requisicao'), ausentes: count('ausente') },
    categorias,
    ...(avisos.length > 0 ? { avisos } : {}),
  };
}
