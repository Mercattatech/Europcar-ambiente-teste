/**
 * Gera URL do QR Code via API pública (sem dependências extras).
 * Usado no detalhe do cupom para gerar QR de divulgação.
 */

export function getQRCodeUrl(text: string, size: number = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&format=png&margin=10`;
}

export function getCouponShareUrl(code: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://europcar.com.br');
  return `${base}/?ref=${code}`;
}

export function getCouponQRUrl(code: string, size: number = 300, baseUrl?: string): string {
  const shareUrl = getCouponShareUrl(code, baseUrl);
  return getQRCodeUrl(shareUrl, size);
}
