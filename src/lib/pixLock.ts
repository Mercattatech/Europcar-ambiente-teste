/**
 * pixLock
 *
 * Lock em memória (por processo) para impedir que a MESMA reserva PIX seja processada
 * (bookReservation no XRS + e-mails) por duas requisições ao mesmo tempo.
 *
 * Quem disputa: polling do checkout (a cada 5s), pix-retry/admin e o cron sync-pix.
 * Como o XRS leva vários segundos, sem o lock a segunda requisição enxergava a reserva ainda
 * como PENDING_PIX e criava uma reserva duplicada + e-mails repetidos.
 *
 * Usa globalThis porque o Next empacota cada rota separadamente — um Set de módulo
 * não seria compartilhado entre pix-status e cron/sync-pix.
 */
const g = globalThis as unknown as { __pixProcessingLocks?: Set<string> };
const locks: Set<string> = g.__pixProcessingLocks || (g.__pixProcessingLocks = new Set<string>());

/** Retorna true se conseguiu o lock; false se outra requisição já está processando. */
export function acquirePixLock(key: string): boolean {
  if (locks.has(key)) return false;
  locks.add(key);
  return true;
}

export function releasePixLock(key: string): void {
  locks.delete(key);
}
