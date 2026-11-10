export type UserRole = 'USER' | 'VENDEDOR' | 'VENDEDOR_ADMIN' | 'ADMIN';

export const VALID_USER_ROLES: readonly UserRole[] = ['USER', 'VENDEDOR', 'VENDEDOR_ADMIN', 'ADMIN'];

export function isAdminRole(role: string | null | undefined): boolean {
  const r = String(role || '').toUpperCase();
  return r === 'ADMIN' || r === 'VENDEDOR_ADMIN';
}

export function isSellerRole(role: string | null | undefined): boolean {
  const r = String(role || '').toUpperCase();
  return r === 'VENDEDOR' || r === 'VENDEDOR_ADMIN';
}

export function isSellerOnlyRole(role: string | null | undefined): boolean {
  return String(role || '').toUpperCase() === 'VENDEDOR';
}

export function normalizeUserRole(role: string | null | undefined): UserRole {
  const r = String(role || '').toUpperCase();
  if (r === 'ADMIN' || r === 'VENDEDOR' || r === 'VENDEDOR_ADMIN') return r;
  return 'USER';
}

/** Comissão sugerida (R$) a partir da regra do vendedor e do total da reserva (R$). */
export function calcCommission(type: string | null | undefined, value: number | null | undefined, totalBRL: number): number {
  const v = Number(value) || 0;
  if (v <= 0) return 0;
  const amount = type === 'FIXED' ? v : (totalBRL * v) / 100;
  return Math.round(amount * 100) / 100;
}
