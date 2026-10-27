"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  type EmailSummaryConfig,
  DEFAULT_EMAIL_SUMMARY_CONFIG,
  normalizeEmailSummaryConfig,
  filterEmailHtmlByConfig,
} from "@/lib/email/emailSummaryConfig";
import { renderCashSummaryHtml } from "@/lib/email/cashSummaryHtml";

export default function PainelResumoEmail() {
  const [config, setConfig] = useState<EmailSummaryConfig>(DEFAULT_EMAIL_SUMMARY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Controles do simulador (Preview)
  const [simType, setSimType] = useState<"CONFIRMADA" | "SOB_SOLICITACAO" | "CANCELAMENTO">("CONFIRMADA");
  const [simZeroExcess, setSimZeroExcess] = useState(true);
  const [simHasCounter, setSimHasCounter] = useState(true);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/config?key=EMAIL_SUMMARY_CONFIG");
      if (res.ok) {
        const data = await res.json();
        if (data.value) {
          const parsed = JSON.parse(data.value);
          setConfig(normalizeEmailSummaryConfig(parsed));
        } else {
          setConfig(DEFAULT_EMAIL_SUMMARY_CONFIG);
        }
      }
    } catch (err: any) {
      console.error("Erro ao carregar configurações de e-mail:", err);
      showToast("Falha ao carregar configurações salvas.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "EMAIL_SUMMARY_CONFIG",
          value: JSON.stringify(config),
        }),
      });

      if (!res.ok) throw new Error("Erro ao salvar no servidor");
      showToast("Configurações dos e-mails salvas com sucesso!", "success");
    } catch (err: any) {
      console.error("Erro ao salvar:", err);
      showToast("Erro ao salvar configurações.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm("Deseja restaurar as configurações padrão dos e-mails?")) {
      setConfig(DEFAULT_EMAIL_SUMMARY_CONFIG);
      showToast("Configurações padrão restauradas na tela. Clique em Salvar para persistir.");
    }
  };

  // Helper para atualizar campos aninhados do config
  const updateCashOnline = (field: keyof EmailSummaryConfig["cashSummary"]["online"], val: any) => {
    setConfig((prev) => ({
      ...prev,
      cashSummary: {
        ...prev.cashSummary,
        online: { ...prev.cashSummary.online, [field]: val },
      },
    }));
  };

  const updateCashCounter = (field: keyof EmailSummaryConfig["cashSummary"]["counter"], val: any) => {
    setConfig((prev) => ({
      ...prev,
      cashSummary: {
        ...prev.cashSummary,
        counter: { ...prev.cashSummary.counter, [field]: val },
      },
    }));
  };

  const updateCashTotal = (field: keyof EmailSummaryConfig["cashSummary"]["total"], val: any) => {
    setConfig((prev) => ({
      ...prev,
      cashSummary: {
        ...prev.cashSummary,
        total: { ...prev.cashSummary.total, [field]: val },
      },
    }));
  };

  const updateSection = (field: keyof EmailSummaryConfig["sections"], val: boolean) => {
    setConfig((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [field]: val,
      },
    }));
  };

  // Gera o HTML do e-mail simulado com base nas escolhas e configurações
  const previewHtml = useMemo(() => {
    // 1. Gera o Resumo de Caixa simulado respeitando as variáveis e filtros
    const cfgOn = config.cashSummary.online;
    const isOnlineItemVisible = (label: string) => {
      if (/diária|diarias|rental/i.test(label)) return cfgOn.showDailyRental;
      if (/franquia zero|premium/i.test(label)) return cfgOn.showZeroExcess;
      if (/básica|basica|roubo|danos|basic|theft|damage/i.test(label)) return cfgOn.showBasicProtections;
      if (/aeroporto|airport/i.test(label)) return cfgOn.showAirportSurcharge;
      if (/devolução em outra|one way|one-way/i.test(label)) return cfgOn.showOneWayCharge;
      if (/alta temporada|estação|season/i.test(label)) return cfgOn.showHighSeasonSurcharge;
      if (/licenciamento|taxa de circulação|fee|license/i.test(label)) return cfgOn.showLicensesAndFees;
      return cfgOn.showOtherItems;
    };

    const onlineItemsRaw = [
      { label: "Diárias do veículo (7 dias)", value: "" },
      ...(simZeroExcess ? [{ label: "Proteção Premium — Franquia Zero", value: "Incluso", isIncluded: true }] : []),
      ...(!simZeroExcess
        ? [
            { label: "Proteção contra roubo (franquia € 1.800,00)", value: "Incluso", isIncluded: true },
            { label: "Proteção contra danos (franquia € 1.300,00)", value: "Incluso", isIncluded: true },
          ]
        : []),
      { label: "Sobretaxa de alta temporada", value: "Incluso", isIncluded: true },
      { label: "Taxas e licenças de circulação", value: "Incluso", isIncluded: true },
      { label: "Quilometragem: ilimitada", value: "Incluso", isIncluded: true },
    ];

    const onlineItems = onlineItemsRaw.filter((i) => isOnlineItemVisible(i.label));

    const counterItemsRaw = simHasCounter
      ? [{ label: "Taxa de devolução em outra loja (One-way)", value: "" }]
      : [];

    const cashSummaryModel = {
      online: {
        title: config.cashSummary.online.title || "Pagar on-line",
        main: "R$ 539,48",
        sub: "(€ 92,73)",
        items: onlineItems,
      },
      counter: {
        title: config.cashSummary.counter.title || "A pagar no balcão",
        main: simHasCounter ? "R$ 709,79" : "€ 0,00",
        sub: simHasCounter ? "(€ 122,00)" : undefined,
        items: counterItemsRaw,
        note: simHasCounter
          ? "Este valor será cobrado na moeda local da estação (€ 122,00). O valor em reais é apenas uma estimativa sujeita à cotação do câmbio na data da retirada."
          : "Nenhum valor adicional a pagar no balcão (apenas a caução temporária no cartão de crédito).",
      },
      included: [],
      total: {
        title: config.cashSummary.total.title || "Valor total",
        main: simHasCounter ? "R$ 1.249,27" : "R$ 539,48",
        sub: simHasCounter ? "(€ 214,73)" : "(€ 92,73)",
        note: "",
      },
    };

    const cashSummaryHtml = renderCashSummaryHtml(cashSummaryModel, config.cashSummary);

    // Banners e textos por tipo de e-mail
    const statusBanners = {
      CONFIRMADA: {
        color: "#006b29",
        textColor: "#ffffff",
        subColor: "#b3dfc0",
        title: "✅ Sua reserva está confirmada!",
        subtitle: "Apresente este e-mail na estação de retirada junto com a CNH física ou PID.",
        intro: "Boa notícia: a sua reserva foi <strong>confirmada</strong> pela Europcar e a sua locação está garantida.",
        titleTop: "Confirmação de reserva",
      },
      SOB_SOLICITACAO: {
        color: "#0369a1",
        textColor: "#ffffff",
        subColor: "#bae6fd",
        title: "⏳ Reserva sob solicitação",
        subtitle: "Estamos processando a confirmação com a estação de locação em até 48 horas úteis.",
        intro: "Recebemos o seu pedido de reserva com sucesso! A confirmação final está sendo concluída.",
        titleTop: "Reserva sob solicitação",
      },
      CANCELAMENTO: {
        color: "#991b1b",
        textColor: "#ffffff",
        subColor: "#fecaca",
        title: "❌ Reserva cancelada",
        subtitle: "A sua reserva foi cancelada com sucesso conforme solicitado.",
        intro: "Confirmamos o cancelamento da reserva abaixo sem nenhum custo adicional.",
        titleTop: "Cancelamento de reserva",
      },
    };

    const b = statusBanners[simType];

    const franchiseListContent = simZeroExcess
      ? "• Franquia Zero contratada: franquia zero para roubo e danos."
      : "• Cobertura básica incluída na tarifa: franquia de € 2.300,00.";

    // Monta o esqueleto base de e-mail HTML idêntico ao template de produção
    const baseEmailHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reserva 1208583229 — Europcar Brasil</title>
<style>
body, table, td, p, a { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif !important; }
@media only screen and (max-width:620px){
  .col{display:block !important;width:100% !important;max-width:100% !important;}
  .px{padding-left:16px !important;padding-right:16px !important;}
}
</style>
</head>
<body style="margin:0;padding:0;background-color:#eef1ed;-webkit-text-size-adjust:100%;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#eef1ed;">
<tr><td align="center" style="padding:20px 8px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #dfe4dd;border-radius:10px;overflow:hidden;">

<!-- HEADER -->
<tr>
  <td style="background-color:#008d36;padding:20px 24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="left" style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:1px;">EUROPCAR</td>
        <td align="right" style="font-size:12px;color:#b3dfc0;">${b.titleTop}</td>
      </tr>
    </table>
  </td>
</tr>

<!-- STATUS BANNER -->
<tr>
  <td style="background-color:${b.color};padding:18px 24px;text-align:center;">
    <p style="margin:0;font-size:17px;color:${b.textColor};font-weight:bold;">${b.title}</p>
    <p style="margin:6px 0 0 0;font-size:13px;color:${b.subColor};">${b.subtitle}</p>
  </td>
</tr>

<!-- INTRO -->
<tr>
  <td class="px" style="padding:22px 28px 8px 28px;">
    <p style="margin:0 0 6px 0;font-size:22px;line-height:28px;color:#1f2421;font-weight:bold;">Olá, Matheus Conti!</p>
    <p style="margin:0;font-size:14px;line-height:22px;color:#525c54;">${b.intro}</p>
  </td>
</tr>

<!-- CARD RESUMO -->
<tr>
  <td class="px" style="padding:16px 28px 4px 28px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #dfe4dd;border-radius:10px;background-color:#f7f9f6;">
      <tr>
        <td colspan="2" style="padding:14px 20px;border-bottom:1px solid #dfe4dd;text-align:center;background-color:#f0faf2;">
          <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:1.2px;color:#6d7a70;font-weight:bold;">NÚMERO DA RESERVA</p>
          <p style="margin:0;font-size:26px;color:#008d36;font-weight:900;letter-spacing:2px;">1208583229</p>
        </td>
      </tr>
      <tr>
        <td class="col" width="272" valign="top" style="padding:14px 18px;border-bottom:1px solid #dfe4dd;border-right:1px solid #dfe4dd;">
          <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:1px;color:#008d36;font-weight:bold;">RETIRADA</p>
          <p style="margin:0;font-size:14px;color:#1f2421;font-weight:bold;">15/11/2026 &middot; 10:00</p>
          <p style="margin:2px 0 0 0;font-size:12px;color:#6d7a70;">Aeroporto de Lisboa (LIS)</p>
        </td>
        <td class="col" width="272" valign="top" style="padding:14px 18px;border-bottom:1px solid #dfe4dd;">
          <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:1px;color:#008d36;font-weight:bold;">DEVOLUÇÃO</p>
          <p style="margin:0;font-size:14px;color:#1f2421;font-weight:bold;">22/11/2026 &middot; 10:00</p>
          <p style="margin:2px 0 0 0;font-size:12px;color:#6d7a70;">Aeroporto de Porto (OPO)</p>
        </td>
      </tr>
      <tr>
        <td class="col" width="272" valign="top" style="padding:14px 18px;">
          <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:1px;color:#6d7a70;font-weight:bold;">VEÍCULO</p>
          <p style="margin:0;font-size:14px;color:#1f2421;font-weight:bold;">Renault Clio ou similar</p>
          <p style="margin:2px 0 0 0;font-size:12px;color:#6d7a70;">Econômico &bull; EDMR</p>
        </td>
        <td class="col" width="272" valign="top" bgcolor="#008d36" style="padding:14px 18px;background-color:#008d36;">
          <p style="margin:0 0 4px 0;font-size:11px;letter-spacing:1px;color:#b3dfc0;font-weight:bold;">VALOR TOTAL</p>
          <p style="margin:0;font-size:19px;color:#ffffff;font-weight:bold;">${simHasCounter ? "R$ 1.249,27" : "R$ 539,48"}</p>
          <p style="margin:2px 0 0 0;font-size:12px;color:#b3dfc0;">(&asymp; ${simHasCounter ? "€ 214,73" : "€ 92,73"})</p>
        </td>
      </tr>
    </table>
  </td>
</tr>

<!-- PREÇO / RESUMO DE CAIXA -->
<tr>
  <td class="px" style="padding:24px 28px 0 28px;">
    <p style="margin:0 0 12px 0;font-size:13px;letter-spacing:1px;color:#008d36;font-weight:bold;text-transform:uppercase;">Resumo de caixa</p>
    ${cashSummaryHtml}
  </td>
</tr>

<!-- FRANQUIA, CAUÇÃO E COBRANÇAS -->
<tr>
  <td class="px" style="padding:24px 28px 0 28px;">
    <p style="margin:0 0 12px 0;font-size:13px;letter-spacing:1px;color:#008d36;font-weight:bold;text-transform:uppercase;">Franquia, caução e cobranças</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f7f9f6;border:1px solid #dfe4dd;border-radius:8px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 6px 0;font-size:13px;font-weight:bold;color:#1f2421;">Franquia das proteções contratadas</p>
        <p style="margin:0 0 14px 0;font-size:13px;line-height:22px;color:#3d463f;">${franchiseListContent}</p>
        <p style="margin:0 0 6px 0;font-size:13px;font-weight:bold;color:#1f2421;">O que a proteção não cobre</p>
        <p style="margin:0 0 14px 0;font-size:13px;line-height:21px;color:#3d463f;">As exclusões variam conforme a proteção contratada e o país de retirada e constam no <strong>Contrato de Locação</strong>. Itens como vidros, faróis, pneus, chaves, interior, fundo e teto do veículo podem ter regras próprias ou ser excluídos — confirme com a estação, antes de assinar, o que a sua proteção cobre. Eventuais taxas administrativas ou de uso da cobertura em caso de dano também seguem o contrato do país de retirada.</p>
        <p style="margin:0 0 6px 0;font-size:13px;font-weight:bold;color:#1f2421;">Caução (pré-autorização no cartão de crédito)</p>
        <p style="margin:0 0 14px 0;font-size:13px;line-height:21px;color:#3d463f;">O valor da caução <strong>não é definido nem informado na reserva</strong>: ele é determinado pela estação no momento da retirada, conforme a categoria do veículo e as proteções contratadas, e fica bloqueado no limite do cartão de crédito do condutor principal. Após a devolução e a vistoria do veículo, o bloqueio é liberado; o prazo para o limite voltar a ficar disponível depende do banco emissor do cartão. Para saber o valor antes da viagem, consulte a estação de retirada ou a nossa Central de Atendimento.</p>
        <p style="margin:0 0 6px 0;font-size:13px;font-weight:bold;color:#1f2421;">Outras cobranças no balcão ou após a devolução</p>
        <p style="margin:0 0 14px 0;font-size:13px;line-height:21px;color:#3d463f;">Além dos valores informados neste e-mail, podem ser cobrados, conforme o uso e o contrato: combustível, pedágios e multas, diárias adicionais por atraso, serviços e acessórios opcionais contratados no balcão e danos não cobertos pela proteção.</p>
        <p style="margin:0 0 6px 0;font-size:13px;font-weight:bold;color:#1f2421;">Devolução e tolerância</p>
        <p style="margin:0 0 0 0;font-size:13px;line-height:21px;color:#3d463f;">A devolução está prevista para <strong>22/11/2026 às 10:00</strong>. Há uma tolerância de atraso na devolução de até 59 minutos em estações no Brasil e de até 29 minutos em estações no exterior; após esse período, pode ser cobrada uma diária adicional, conforme o contrato.</p>
      </td></tr>
    </table>
  </td>
</tr>

<!-- ALERTA DOCUMENTOS -->
<tr>
  <td class="px" style="padding:22px 28px 0 28px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-left:3px solid #008d36;background-color:#f2f7f2;">
      <tr><td style="padding:14px 16px;font-size:13px;line-height:20px;color:#3d463f;">
        Na retirada apresente este e-mail (reserva <strong>1208583229</strong>), documento de identidade, carteira de habilitação válida e cartão de crédito em nome do condutor principal.
      </td></tr>
    </table>
  </td>
</tr>

<!-- ORIENTAÇÕES PARA RETIRADA -->
<tr>
  <td class="px" style="padding:24px 28px 2px 28px;">
    <p style="margin:0 0 12px 0;padding:12px 16px;background-color:#008d36;border-radius:6px;font-size:15px;line-height:21px;font-weight:bold;color:#ffffff;">01   Sua reserva</p>
    <p style="margin:0 0 10px 0;font-size:15px;line-height:22px;font-weight:bold;color:#1f2421;">Informações importantes</p>
    <p style="margin:0 0 10px 0;font-size:13px;line-height:21px;color:#3d463f;">Os itens incluídos nesta reserva são suficientes para a retirada do veículo. No entanto, a EUROPCAR poderá oferecer serviços opcionais adicionais, como upgrades de categoria, proteções complementares e acessórios. A contratação desses serviços é totalmente opcional e não constitui requisito para a retirada do veículo.</p>
  </td>
</tr>

<tr>
  <td class="px" style="padding:24px 28px 2px 28px;">
    <p style="margin:0 0 12px 0;padding:12px 16px;background-color:#008d36;border-radius:6px;font-size:15px;line-height:21px;font-weight:bold;color:#ffffff;">02   Horário e comparecimento</p>
    <p style="margin:0 0 10px 0;font-size:15px;line-height:22px;font-weight:bold;color:#1f2421;">Prazo para retirada do veículo</p>
    <p style="margin:0 0 10px 0;font-size:13px;line-height:21px;color:#3d463f;"><strong>Tolerância para retirada:</strong> A tolerância para retirada do veículo poderá variar de 29 a 59 minutos, conforme o país e estação de locação.</p>
  </td>
</tr>

<tr>
  <td class="px" style="padding:24px 28px 2px 28px;">
    <p style="margin:0 0 12px 0;padding:12px 16px;background-color:#008d36;border-radius:6px;font-size:15px;line-height:21px;font-weight:bold;color:#ffffff;">03   Checklist</p>
    <p style="margin:0 0 10px 0;font-size:15px;line-height:22px;font-weight:bold;color:#1f2421;">Principais itens para retirada</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:2px 0 10px 0;background-color:#f2f7f2;border-left:3px solid #008d36;"><tr><td style="padding:12px 14px;font-size:13px;line-height:20px;color:#3d463f;"><strong>Carteira de Habilitação &amp; Cartão de Crédito Físico</strong><br>Apresente os documentos originais válidos em nome do motorista principal.</td></tr></table>
  </td>
</tr>

<tr>
  <td class="px" style="padding:24px 28px 2px 28px;">
    <p style="margin:0 0 12px 0;padding:12px 16px;background-color:#008d36;border-radius:6px;font-size:15px;line-height:21px;font-weight:bold;color:#ffffff;">04   Regras aplicáveis</p>
    <p style="margin:0 0 10px 0;font-size:15px;line-height:22px;font-weight:bold;color:#1f2421;">Termos, condições e responsabilidades</p>
    <p style="margin:0 0 10px 0;font-size:13px;line-height:21px;color:#3d463f;">Este voucher reúne as principais informações relacionadas à sua reserva e tem caráter informativo, regido pelos Termos e Condições da locação.</p>
  </td>
</tr>

<!-- SUPORTE -->
<tr>
  <td class="px" style="padding:20px 28px 24px 28px;font-size:13px;line-height:20px;color:#525c54;">
    Dúvidas? Acesse <a href="https://europcar.com.br/reservas" style="color:#008d36;text-decoration:underline;">europcar.com.br/reservas</a> para gerenciar sua reserva.
  </td>
</tr>

<!-- FOOTER -->
<tr>
  <td style="background-color:#1f2421;padding:20px 24px;text-align:center;font-size:11px;line-height:18px;color:#b6bfb8;">
    Europcar Brasil &mdash; europcar.com.br<br>
    Você recebeu este e-mail porque efetuou uma reserva em nosso site.
  </td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    // 2. Aplica o filtro de seções ativadas/desativadas
    return filterEmailHtmlByConfig(baseEmailHtml, config);
  }, [config, simType, simZeroExcess, simHasCounter]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-xl text-white font-medium text-sm transition-all duration-300 transform translate-y-0 ${
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📧</span>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">
                Editor de Variáveis e Resumo dos E-mails
              </h1>
            </div>
            <p className="text-slate-500 text-sm mt-1">
              Controle 100% das seções, textos e variáveis exibidos nos e-mails transacionais (Confirmação, Sob Solicitação e Cancelamento).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              disabled={loading || saving}
              className="px-4 py-2 border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 rounded-lg text-sm font-medium transition-all shadow-sm"
            >
              Restaurar Padrões
            </button>
            <button
              onClick={handleSave}
              disabled={loading || saving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-all shadow-md flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Salvando...
                </>
              ) : (
                <>
                  <span>💾</span> Salvar Alterações
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="max-w-7xl mx-auto flex items-center justify-center p-16">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-600 border-t-transparent" />
            <p className="text-slate-500 text-sm">Carregando configurações...</p>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Coluna Esquerda: Controles de Configuração (7 colunas) */}
          <div className="lg:col-span-6 space-y-6">
            {/* Bloco 1: Pagar on-line */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-emerald-50/60 border-b border-emerald-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💳</span>
                  <h2 className="font-bold text-slate-800 text-base">
                    Resumo de Caixa &mdash; Pagar on-line
                  </h2>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.cashSummary.online.enabled}
                    onChange={(e) => updateCashOnline("enabled", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {config.cashSummary.online.enabled && (
                <div className="p-5 space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                      Título do bloco
                    </label>
                    <input
                      type="text"
                      value={config.cashSummary.online.title}
                      onChange={(e) => updateCashOnline("title", e.target.value)}
                      placeholder="Pagar on-line"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <ToggleItem
                      label="Subtotal em R$ (BRL)"
                      checked={config.cashSummary.online.showSubtotalBRL}
                      onChange={(v) => updateCashOnline("showSubtotalBRL", v)}
                    />
                    <ToggleItem
                      label="Subtotal em Moeda Local"
                      checked={config.cashSummary.online.showSubtotalLocal}
                      onChange={(v) => updateCashOnline("showSubtotalLocal", v)}
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                      Itens discriminados no bloco on-line:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <ToggleItem
                        label="Diárias do veículo"
                        checked={config.cashSummary.online.showDailyRental}
                        onChange={(v) => updateCashOnline("showDailyRental", v)}
                      />
                      <ToggleItem
                        label="Franquia Zero / Premium"
                        checked={config.cashSummary.online.showZeroExcess}
                        onChange={(v) => updateCashOnline("showZeroExcess", v)}
                      />
                      <ToggleItem
                        label="Proteções básicas incluídas"
                        checked={config.cashSummary.online.showBasicProtections}
                        onChange={(v) => updateCashOnline("showBasicProtections", v)}
                      />
                      <ToggleItem
                        label="Sobretaxa de aeroporto"
                        checked={config.cashSummary.online.showAirportSurcharge}
                        onChange={(v) => updateCashOnline("showAirportSurcharge", v)}
                      />
                      <ToggleItem
                        label="Taxa devolução outra loja"
                        checked={config.cashSummary.online.showOneWayCharge}
                        onChange={(v) => updateCashOnline("showOneWayCharge", v)}
                      />
                      <ToggleItem
                        label="Alta temporada"
                        checked={config.cashSummary.online.showHighSeasonSurcharge}
                        onChange={(v) => updateCashOnline("showHighSeasonSurcharge", v)}
                      />
                      <ToggleItem
                        label="Taxas e licenças"
                        checked={config.cashSummary.online.showLicensesAndFees}
                        onChange={(v) => updateCashOnline("showLicensesAndFees", v)}
                      />
                      <ToggleItem
                        label="Outros itens / Quilometragem"
                        checked={config.cashSummary.online.showOtherItems}
                        onChange={(v) => updateCashOnline("showOtherItems", v)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bloco 2: A pagar no balcão */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-amber-50/60 border-b border-amber-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏪</span>
                  <h2 className="font-bold text-slate-800 text-base">
                    Resumo de Caixa &mdash; A pagar no balcão
                  </h2>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.cashSummary.counter.enabled}
                    onChange={(e) => updateCashCounter("enabled", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {config.cashSummary.counter.enabled && (
                <div className="p-5 space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                      Título do bloco
                    </label>
                    <input
                      type="text"
                      value={config.cashSummary.counter.title}
                      onChange={(e) => updateCashCounter("title", e.target.value)}
                      placeholder="A pagar no balcão"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <ToggleItem
                      label="Subtotal em R$ (BRL)"
                      checked={config.cashSummary.counter.showSubtotalBRL}
                      onChange={(v) => updateCashCounter("showSubtotalBRL", v)}
                    />
                    <ToggleItem
                      label="Subtotal em Moeda Local"
                      checked={config.cashSummary.counter.showSubtotalLocal}
                      onChange={(v) => updateCashCounter("showSubtotalLocal", v)}
                    />
                    <ToggleItem
                      label="Lista de cobranças no balcão"
                      checked={config.cashSummary.counter.showItemsList}
                      onChange={(v) => updateCashCounter("showItemsList", v)}
                    />
                    <ToggleItem
                      label="Aviso de câmbio / conversão"
                      checked={config.cashSummary.counter.showNotice}
                      onChange={(v) => updateCashCounter("showNotice", v)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bloco 3: Valor Total */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-emerald-50/60 border-b border-emerald-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🟢</span>
                  <h2 className="font-bold text-slate-800 text-base">
                    Resumo de Caixa &mdash; Valor total
                  </h2>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.cashSummary.total.enabled}
                    onChange={(e) => updateCashTotal("enabled", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {config.cashSummary.total.enabled && (
                <div className="p-5 space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
                      Título do bloco
                    </label>
                    <input
                      type="text"
                      value={config.cashSummary.total.title}
                      onChange={(e) => updateCashTotal("title", e.target.value)}
                      placeholder="Valor total"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <ToggleItem
                      label="Total em R$ (BRL)"
                      checked={config.cashSummary.total.showBRL}
                      onChange={(v) => updateCashTotal("showBRL", v)}
                    />
                    <ToggleItem
                      label="Total em Moeda Local"
                      checked={config.cashSummary.total.showLocal}
                      onChange={(v) => updateCashTotal("showLocal", v)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bloco 4: Franquia, Caução e Cobranças */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🛡️</span>
                  <h2 className="font-bold text-slate-800 text-base">
                    Franquia, caução e cobranças
                  </h2>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.sections.franchiseBlock}
                    onChange={(e) => updateSection("franchiseBlock", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {config.sections.franchiseBlock && (
                <div className="p-5 space-y-3">
                  <p className="text-xs text-slate-500 mb-2">
                    Controle individual de cada parágrafo informativo do bloco de franquia:
                  </p>
                  <ToggleItem
                    label="Franquia das proteções contratadas"
                    checked={config.sections.franchiseList}
                    onChange={(v) => updateSection("franchiseList", v)}
                  />
                  <ToggleItem
                    label="O que a proteção não cobre (exclusões contratuais)"
                    checked={config.sections.whatIsNotCovered}
                    onChange={(v) => updateSection("whatIsNotCovered", v)}
                  />
                  <ToggleItem
                    label="Caução (pré-autorização no cartão de crédito)"
                    checked={config.sections.depositNotice}
                    onChange={(v) => updateSection("depositNotice", v)}
                  />
                  <ToggleItem
                    label="Outras cobranças no balcão ou após devolução"
                    checked={config.sections.otherChargesNotice}
                    onChange={(v) => updateSection("otherChargesNotice", v)}
                  />
                  <ToggleItem
                    label="Devolução e tolerância de horário"
                    checked={config.sections.returnNotice}
                    onChange={(v) => updateSection("returnNotice", v)}
                  />
                </div>
              )}
            </div>

            {/* Bloco 5: Blocos Regulatórios e Suporte */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-100/70 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📜</span>
                  <h2 className="font-bold text-slate-800 text-base">
                    Blocos Regulatórios &amp; Suporte
                  </h2>
                </div>
              </div>

              <div className="p-5 space-y-3">
                <ToggleItem
                  label="Alerta de Documentos na retirada (CNH, PID, Cartão Físico)"
                  checked={config.sections.documentAlert}
                  onChange={(v) => updateSection("documentAlert", v)}
                />
                <ToggleItem
                  label="01 Sua reserva — Informações importantes"
                  checked={config.sections.section01}
                  onChange={(v) => updateSection("section01", v)}
                />
                <ToggleItem
                  label="02 Horário e comparecimento — Prazo para retirada"
                  checked={config.sections.section02}
                  onChange={(v) => updateSection("section02", v)}
                />
                <ToggleItem
                  label="03 Checklist — Principais itens para retirada"
                  checked={config.sections.section03}
                  onChange={(v) => updateSection("section03", v)}
                />
                <ToggleItem
                  label="04 Regras aplicáveis — Termos, condições e voucher"
                  checked={config.sections.section04}
                  onChange={(v) => updateSection("section04", v)}
                />
                <ToggleItem
                  label="Bloco de Suporte (link para europcar.com.br/reservas)"
                  checked={config.sections.supportLink}
                  onChange={(v) => updateSection("supportLink", v)}
                />
              </div>
            </div>
          </div>

          {/* Coluna Direita: Live Preview com Simulador (5 colunas) */}
          <div className="lg:col-span-6 sticky top-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Toolbar do Simulador */}
              <div className="p-4 bg-slate-800 text-white border-b border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-sm">Visualização em Tempo Real</span>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-700 p-1 rounded-lg text-xs">
                    <button
                      onClick={() => setPreviewDevice("desktop")}
                      className={`px-2 py-1 rounded transition-colors ${
                        previewDevice === "desktop" ? "bg-slate-900 text-white font-bold" : "text-slate-300"
                      }`}
                    >
                      🖥️ Desktop
                    </button>
                    <button
                      onClick={() => setPreviewDevice("mobile")}
                      className={`px-2 py-1 rounded transition-colors ${
                        previewDevice === "mobile" ? "bg-slate-900 text-white font-bold" : "text-slate-300"
                      }`}
                    >
                      📱 Mobile
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-700/60 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Tipo de E-mail:</label>
                    <select
                      value={simType}
                      onChange={(e) => setSimType(e.target.value as any)}
                      className="w-full bg-slate-900 text-white border border-slate-600 rounded px-2 py-1.5 focus:outline-none"
                    >
                      <option value="CONFIRMADA">Reserva Confirmada</option>
                      <option value="SOB_SOLICITACAO">Sob Solicitação</option>
                      <option value="CANCELAMENTO">Cancelamento</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Franquia Zero:</label>
                    <button
                      onClick={() => setSimZeroExcess(!simZeroExcess)}
                      className={`w-full py-1.5 px-2 rounded font-semibold transition-colors border ${
                        simZeroExcess
                          ? "bg-emerald-600/80 border-emerald-500 text-white"
                          : "bg-slate-700 border-slate-600 text-slate-300"
                      }`}
                    >
                      {simZeroExcess ? "✓ Contratada" : "✕ Não inclusa"}
                    </button>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Itens no Balcão:</label>
                    <button
                      onClick={() => setSimHasCounter(!simHasCounter)}
                      className={`w-full py-1.5 px-2 rounded font-semibold transition-colors border ${
                        simHasCounter
                          ? "bg-amber-600/80 border-amber-500 text-white"
                          : "bg-slate-700 border-slate-600 text-slate-300"
                      }`}
                    >
                      {simHasCounter ? "✓ Possui (One-way)" : "✕ Nada a pagar"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Iframe com Preview renderizado */}
              <div
                className={`bg-slate-200 p-2 sm:p-4 transition-all flex justify-center overflow-x-auto`}
                style={{ minHeight: "680px" }}
              >
                <div
                  className="bg-white shadow-lg transition-all rounded overflow-hidden"
                  style={{
                    width: previewDevice === "desktop" ? "100%" : "380px",
                    maxWidth: previewDevice === "desktop" ? "620px" : "380px",
                    height: "720px",
                  }}
                >
                  <iframe
                    srcDoc={previewHtml}
                    title="Live Email Preview"
                    className="w-full h-full border-0"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponente reutilizável para Toggles
function ToggleItem({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
      <span className="text-xs font-medium text-slate-700 pr-2">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
      />
    </label>
  );
}
