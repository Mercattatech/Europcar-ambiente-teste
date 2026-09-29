/**
 * Utilitário para cálculo de duração e diárias de locação no padrão Europcar / XRS.
 *
 * Regras de negócio de locação de veículos:
 * 1. Diária = ciclo de 24 horas contadas a partir do horário de retirada (pickupTime).
 * 2. Carência / Tolerância de devolução (Grace period):
 *    - Brasil (estações BR): 59 minutos de tolerância após as 24h.
 *    - Internacional (Europa e outros países): 29 minutos de tolerância (padrão mundial Europcar).
 * 3. Se o horário de devolução ultrapassar a tolerância do último ciclo de 24h,
 *    uma diária completa adicional é cobrada.
 * 4. Precedência absoluta da API: Se o XRS Europcar já retornou o atributo de duração
 *    (ex: <reservation duration="5">), esse valor oficial é sempre respeitado.
 */

export interface RentalDurationOptions {
  pickupDate?: string;     // YYYYMMDD, YYYY-MM-DD ou ISO
  pickupTime?: string;     // HHMM, HH:MM (padrão '1000')
  returnDate?: string;     // YYYYMMDD, YYYY-MM-DD ou ISO
  returnTime?: string;     // HHMM, HH:MM (padrão '1000')
  station?: string;        // Código da estação (ex: 'GRUO02', 'CDG')
  country?: string;        // País da estação ou residência (ex: 'BR', 'BRA', 'FR')
  apiDuration?: number | string | null; // Duração oficial retornada pela API XRS
}

const BRAZIL_STATION_PREFIXES = [
  'BR', 'GRU', 'CGH', 'GIG', 'SDU', 'BSB', 'CNF', 'POA', 'SSA',
  'REC', 'FOR', 'CWB', 'FLN', 'VCP', 'NAT', 'MCZ', 'NVT', 'VIX',
  'GYN', 'CGB', 'MAO', 'BEL', 'IGU', 'AJU', 'JPA', 'SLZ', 'THE'
];

/**
 * Identifica se a estação ou país pertence ao Brasil para aplicar a regra de 59 minutos.
 */
export function isBrazilStationOrCountry(station?: string, country?: string): boolean {
  if (country) {
    const c = country.trim().toUpperCase();
    if (c === 'BR' || c === 'BRA' || c === 'BRASIL' || c === 'BRAZIL') return true;
  }
  if (station) {
    const s = station.trim().toUpperCase();
    if (BRAZIL_STATION_PREFIXES.some(prefix => s.startsWith(prefix))) return true;
  }
  return false;
}

/**
 * Converte data e hora para objeto Date seguro (UTC ou local).
 */
function parseDateTime(dateStr?: string, timeStr?: string): Date | null {
  if (!dateStr || dateStr.length < 8) return null;

  let year = 0;
  let month = 0;
  let day = 0;

  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length >= 3) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2].slice(0, 2), 10);
    }
  } else {
    // Formato YYYYMMDD
    year = parseInt(dateStr.slice(0, 4), 10);
    month = parseInt(dateStr.slice(4, 6), 10) - 1;
    day = parseInt(dateStr.slice(6, 8), 10);
  }

  if (isNaN(year) || isNaN(month) || isNaN(day) || year === 0) return null;

  // Normaliza horário (ex: "08:00" -> "0800", "800" -> "0800", default "1000")
  const cleanTime = (timeStr || '1000').replace(/\D/g, '').padStart(4, '0');
  const hour = Math.min(23, Math.max(0, parseInt(cleanTime.slice(0, 2), 10) || 0));
  const minute = Math.min(59, Math.max(0, parseInt(cleanTime.slice(2, 4), 10) || 0));

  return new Date(year, month, day, hour, minute, 0, 0);
}

/**
 * Calcula o número de diárias de forma exata respeitando:
 * 1. Duração vinda da API Europcar XRS (se existir).
 * 2. Ciclos de 24 horas a partir do horário de retirada.
 * 3. Tolerância de 59 minutos no Brasil e 29 minutos internacional.
 */
export function calculateRentalDays(opts: RentalDurationOptions): number {
  // 1. Precedência absoluta da API XRS
  if (opts.apiDuration !== undefined && opts.apiDuration !== null) {
    const parsedApi = typeof opts.apiDuration === 'number' 
      ? opts.apiDuration 
      : parseInt(String(opts.apiDuration).trim(), 10);
    if (!isNaN(parsedApi) && parsedApi > 0) {
      return parsedApi;
    }
  }

  const startDate = parseDateTime(opts.pickupDate, opts.pickupTime);
  const endDate = parseDateTime(opts.returnDate, opts.returnTime);

  if (!startDate || !endDate) return 1;

  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs <= 0) return 1;

  const DAY_MS = 24 * 60 * 60 * 1000; // 86.400.000 ms
  const fullDays = Math.floor(diffMs / DAY_MS);
  const remainingMs = diffMs % DAY_MS;

  // Tolerância: 59 min no Brasil, 29 min internacional
  const isBR = isBrazilStationOrCountry(opts.station, opts.country);
  const toleranceMinutes = isBR ? 59 : 29;
  const toleranceMs = toleranceMinutes * 60 * 1000;

  const extraDay = remainingMs > toleranceMs ? 1 : 0;
  return Math.max(1, fullDays + extraDay);
}

/**
 * Retorna o texto formatado para diárias no padrão brasileiro ("1 diária", "5 diárias").
 */
export function formatRentalDays(days: number): string {
  const d = Math.max(1, Math.round(days || 1));
  return `${d} ${d === 1 ? 'diária' : 'diárias'}`;
}
