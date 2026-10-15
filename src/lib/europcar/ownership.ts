import prisma from '@/lib/prisma';

const norm = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

function parseCustomerData(raw: unknown): any {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

/** All e-mails tied to a reservation (top-level + nested customer/driver/booking), normalized. */
function collectEmails(cd: any): string[] {
  if (!cd || typeof cd !== 'object') return [];
  return [
    cd.email, cd.customer?.email, cd.driver?.email,
    cd.booking?.email, cd.booking?.customer?.email, cd.booking?.driver?.email,
  ].map(norm).filter(Boolean);
}

/** Returns the customer email tied to a local reservation, or null if not found. */
export async function getReservationOwnerEmail(resNumber: string): Promise<string | null> {
  const reservation = await prisma.localReservation.findUnique({ where: { resNumber: String(resNumber).trim() } });
  const cd = parseCustomerData(reservation?.customerData);
  return collectEmails(cd)[0] || null;
}

/**
 * Verifica se quem está pedindo pode acessar a reserva.
 * Aceita o e-mail da sessão (cliente logado) OU o e-mail informado manualmente
 * (cliente sem login que chegou pelo link do e-mail: nº da reserva + e-mail).
 * Comparação tolerante: ignora espaços/maiúsculas e olha campos aninhados.
 */
export async function checkReservationAccess(
  resNumber: string,
  opts: { sessionEmail?: string | null; guestEmail?: string | null }
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const candidates = [norm(opts.sessionEmail), norm(opts.guestEmail)].filter(Boolean);
  if (candidates.length === 0) {
    return { ok: false, status: 401, error: 'Informe o e-mail usado na reserva ou faça login.' };
  }

  const reservation = await prisma.localReservation.findUnique({ where: { resNumber: String(resNumber).trim() } });
  if (!reservation) {
    return { ok: false, status: 404, error: 'Reserva não encontrada. Confira o número ou fale com nossa central de atendimento.' };
  }

  const owners = collectEmails(parseCustomerData(reservation.customerData));
  if (!candidates.some(e => owners.includes(e))) {
    return { ok: false, status: 403, error: 'O e-mail informado não corresponde a esta reserva. Use o mesmo e-mail utilizado na compra.' };
  }
  return { ok: true };
}
