/** Comissão sugerida (R$) a partir da regra do vendedor e do total da reserva (R$). */
export function calcCommission(type: string | null | undefined, value: number | null | undefined, totalBRL: number): number {
  const v = Number(value) || 0;
  if (v <= 0) return 0;
  const amount = type === 'FIXED' ? v : (totalBRL * v) / 100;
  return Math.round(amount * 100) / 100;
}
