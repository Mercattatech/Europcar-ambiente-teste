import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";

export const dynamic = 'force-dynamic';

function buildResetEmailHtml(nome: string, resetLink: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Redefinição de Senha</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
    <div style="background:#008d36;padding:28px 32px;text-align:center;border-bottom:5px solid #FFD800;">
      <div style="line-height:0;font-size:0;"><img src="https://europcar.com.br/logo-email.png" width="150" height="35" alt="Europcar" style="display:inline-block;width:150px;height:35px;border:0;outline:none;text-decoration:none;"></div>
      <div style="color:rgba(255,255,255,0.75);font-size:12px;margin-top:4px;">Redefinição de Senha</div>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#111827;font-size:20px;margin:0 0 8px;">Olá${nome ? ', ' + nome : ''}!</h2>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Recebemos uma solicitação para redefinir a senha da sua conta na Europcar Brasil.
        Clique no botão abaixo para criar uma nova senha. O link é válido por <strong>1 hora</strong>.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${resetLink}" style="display:inline-block;background:#008d36;color:#fff;text-decoration:none;font-weight:900;font-size:15px;padding:14px 36px;border-radius:8px;">
          Redefinir minha senha
        </a>
      </div>
      <p style="color:#9ca3af;font-size:12px;text-align:center;margin:16px 0 0;">
        Se você não solicitou isso, ignore este e-mail.
      </p>
      <p style="color:#9ca3af;font-size:11px;text-align:center;margin:8px 0 0;">
        Link: <span style="color:#008d36;word-break:break-all;">${resetLink}</span>
      </p>
    </div>
    <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
      <p style="color:#9ca3af;font-size:11px;margin:0;">© Europcar Brasil — E-mail automático.</p>
    </div>
  </div>
</body>
</html>`;
}

function getBaseUrl(req: Request): string {
  // 1. Origin do request do cliente (ex: https://www.europcar.com.br)
  const origin = req.headers.get("origin");
  if (origin && !origin.includes("sslip.io") && !origin.includes("localhost")) {
    return origin.replace(/\/$/, "");
  }

  // 2. Host encaminhado pelo proxy
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host && !host.includes("sslip.io") && !host.includes("localhost")) {
    return `${proto}://${host}`.replace(/\/$/, "");
  }

  // 3. Referer do navegador
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const u = new URL(referer);
      if (!u.host.includes("sslip.io") && !u.host.includes("localhost")) {
        return u.origin.replace(/\/$/, "");
      }
    } catch {}
  }

  // 4. Se NEXTAUTH_URL for um domínio de produção válido (sem sslip.io ou localhost)
  const envUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  if (envUrl && !envUrl.includes("sslip.io") && !envUrl.includes("localhost")) {
    return envUrl.replace(/\/$/, "");
  }

  // 5. Fallback padrão seguro de produção
  return "https://www.europcar.com.br";
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "E-mail obrigatório" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ success: true }); // don't reveal existence

    await prisma.passwordResetToken.updateMany({ where: { email, used: false }, data: { used: true } });

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.passwordResetToken.create({ data: { email, token, expiresAt } });

    const baseUrl = getBaseUrl(req);
    const resetLink = `${baseUrl}/reset-senha?token=${token}`;
    const nome = user.name || '';
    const subject = 'Redefinição de Senha — Europcar Brasil';
    const html = buildResetEmailHtml(nome, resetLink);

    // 1. Try panel template (RESET_SENHA trigger)
    let sent = false;
    try {
      const { sendTransactionalEmail } = await import('@/lib/emailService');
      const r = await sendTransactionalEmail(email, 'RESET_SENHA', { NOME: nome, LINK_RESET: resetLink });
      if (r.success) sent = true;
    } catch (_) {}

    if (!sent) {
      // 2. Load config from DB
      const keys = ['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','SMTP_SECURE','RESEND_FROM_EMAIL','RESEND_API_KEY'];
      const blocks = await prisma.contentBlock.findMany({ where: { key: { in: keys } } });
      const cfg: Record<string,string> = {};
      for (const b of blocks) cfg[b.key] = b.value_ptBR || '';

      if (cfg.SMTP_HOST && cfg.SMTP_USER && cfg.SMTP_PASS) {
        // 3. SMTP
        const nodemailer = await import('nodemailer');
        const t = nodemailer.default.createTransport({
          host: cfg.SMTP_HOST, port: parseInt(cfg.SMTP_PORT)||587, secure: cfg.SMTP_SECURE==='true',
          auth: { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS }, tls: { rejectUnauthorized: false },
        });
        await t.sendMail({ from: `Europcar Brasil <${cfg.SMTP_USER}>`, to: email, subject, html, envelope: { from: cfg.SMTP_USER, to: email } });
        sent = true;
      }

      if (!sent) {
        // 4. Resend fallback
        const apiKey = cfg.RESEND_API_KEY || process.env.RESEND_API_KEY;
        if (apiKey) {
          const { Resend } = await import('resend');
          const fromEmail = cfg.RESEND_FROM_EMAIL || 'nao-responda@europcar.com.br';
          await new Resend(apiKey).emails.send({ from: `Europcar Brasil <${fromEmail}>`, to: email, subject, html });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[forgot-password]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
