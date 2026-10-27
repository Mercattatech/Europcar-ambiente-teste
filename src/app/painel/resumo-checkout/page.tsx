"use client";

import React, { useState, useEffect, useCallback } from "react";
import PaymentSplitBlocks from "@/components/checkout/PaymentSplitBlocks";
import {
  type CheckoutSummaryConfig,
  DEFAULT_CHECKOUT_SUMMARY_CONFIG,
  normalizeCheckoutSummaryConfig,
} from "@/lib/checkout/summaryConfig";
import type { PaymentSplit } from "@/lib/europcar/paymentSplit";

// Amostra para o Live Preview (reserva real simulada com split e sem split)
const SAMPLE_SPLIT_WITH_COUNTER: PaymentSplit = {
  version: 1,
  resNumber: "1208583229",
  localCurrency: "EUR",
  bookingCurrency: "BRL",
  isPriceSecret: false,
  isZeroExcess: true,
  onlineMarkupPercent: 0,
  online: {
    side: "online",
    subtotalBRL: 539.48,
    subtotalLocal: 92.73,
    netSubtotalBRL: 539.48,
    netSubtotalLocal: 92.73,
    linesSumBRL: 539.48,
    linesSumLocal: 92.73,
    payerListBRL: 539.48,
    payerListLocal: 92.73,
    mismatch: false,
    lines: [
      {
        chrgTy: "00001",
        auxK: "",
        label: "Diárias",
        originalDesc: "Basic Rental",
        mapped: true,
        side: "online",
        priceBRL: 539.48,
        priceLocal: 92.73,
      },
    ],
    included: [
      {
        code: "ZERO_EXCESS",
        chrgTy: "ZERO_EXCESS",
        label: "Proteção Premium — Franquia Zero",
        side: "online",
        excessLocal: null,
        excessBRL: null,
      },
      {
        code: "STHW",
        chrgTy: "00021",
        label: "SUPER THEFT WAIVER CHARGE",
        side: "online",
        excessLocal: null,
        excessBRL: null,
      },
      {
        code: "CDW",
        chrgTy: "00020",
        label: "Proteção contra Danos / Colisão (CDW)",
        side: "online",
        excessLocal: 1500.0,
        excessBRL: 8700.0,
      },
      {
        code: "WWI",
        chrgTy: "00022",
        label: "Proteção de Vidros e Pneus (WWI)",
        side: "online",
        excessLocal: null,
        excessBRL: null,
      },
      {
        code: "PAI",
        chrgTy: "00023",
        label: "Proteção de Acidentes Pessoais (PAI)",
        side: "online",
        excessLocal: null,
        excessBRL: null,
      },
      {
        code: "RSA",
        chrgTy: "00024",
        label: "Assistência 24h em Viagem (RSA)",
        side: "online",
        excessLocal: null,
        excessBRL: null,
      },
      {
        code: "HSS",
        chrgTy: "00030",
        label: "Sobretaxa de alta temporada",
        side: "online",
        excessLocal: null,
        excessBRL: null,
      },
      {
        code: "LAF",
        chrgTy: "00090",
        label: "Taxas e licenças",
        side: "online",
        excessLocal: null,
        excessBRL: null,
      },
    ],
  },
  counter: {
    side: "counter",
    subtotalBRL: 709.79,
    subtotalLocal: 122.0,
    netSubtotalBRL: 709.79,
    netSubtotalLocal: 122.0,
    linesSumBRL: 709.79,
    linesSumLocal: 122.0,
    payerListBRL: 709.79,
    payerListLocal: 122.0,
    mismatch: false,
    lines: [
      {
        chrgTy: "00010",
        auxK: "",
        label: "Taxa de devolução em outra loja",
        originalDesc: "One-Way Charge",
        mapped: true,
        side: "counter",
        priceBRL: 709.79,
        priceLocal: 122.0,
      },
    ],
    included: [],
  },
  included: [],
  totalBRL: 1249.27,
  totalLocal: 214.73,
  netTotalBRL: 1249.27,
  netTotalLocal: 214.73,
  totalRateEstimateBRL: 1249.27,
  totalRateEstimateLocal: 214.73,
  totalMatches: true,
  alerts: [],
  unmappedDescriptions: [],
};

const SAMPLE_SPLIT_ALL_ONLINE: PaymentSplit = {
  ...SAMPLE_SPLIT_WITH_COUNTER,
  counter: null,
  totalBRL: 539.48,
  totalLocal: 92.73,
  netTotalBRL: 539.48,
  netTotalLocal: 92.73,
};

export default function PainelResumoCheckout() {
  const [config, setConfig] = useState<CheckoutSummaryConfig>(DEFAULT_CHECKOUT_SUMMARY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Controles do simulador (Preview)
  const [simZeroExcess, setSimZeroExcess] = useState(true);
  const [simHasCounter, setSimHasCounter] = useState(true);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/config?key=CHECKOUT_SUMMARY_CONFIG");
      if (res.ok) {
        const data = await res.json();
        if (data.value) {
          const parsed = JSON.parse(data.value);
          setConfig(normalizeCheckoutSummaryConfig(parsed));
        }
      }
    } catch (e: any) {
      console.error(e);
      showToast("Erro ao carregar configurações", "error");
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
          key: "CHECKOUT_SUMMARY_CONFIG",
          value: JSON.stringify(config),
        }),
      });
      if (res.ok) {
        showToast("Configuração salva com sucesso!");
      } else {
        showToast("Falha ao salvar configuração", "error");
      }
    } catch (e: any) {
      showToast(e?.message || "Erro de rede ao salvar", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (confirm("Deseja restaurar as configurações padrão atuais do checkout?")) {
      setConfig(DEFAULT_CHECKOUT_SUMMARY_CONFIG);
      showToast("Padrões restaurados (clique em Salvar para persistir)");
    }
  };

  // Toggle switch helper
  const Toggle = ({
    checked,
    onChange,
    label,
    desc,
    badge,
  }: {
    checked: boolean;
    onChange: (val: boolean) => void;
    label: string;
    desc?: string;
    badge?: string;
  }) => (
    <label className="flex items-start justify-between gap-3 py-2 cursor-pointer group">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">
            {label}
          </span>
          {badge && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
              {badge}
            </span>
          )}
        </div>
        {desc && <p className="text-xs text-gray-400 mt-0.5 leading-snug">{desc}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? "bg-emerald-600" : "bg-gray-700"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );

  const previewSplit = simHasCounter ? SAMPLE_SPLIT_WITH_COUNTER : SAMPLE_SPLIT_ALL_ONLINE;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-bold border transition-all ${
            toast.type === "success"
              ? "bg-emerald-900/90 text-emerald-200 border-emerald-600"
              : "bg-red-900/90 text-red-200 border-red-600"
          }`}
        >
          <span>{toast.type === "success" ? "✅" : "⚠️"}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white">Resumo do Checkout</h1>
            <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
              Personalização Total
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Controle 100% as variáveis, títulos e blocos que aparecem no checkout. Respeita automaticamente
            a regra de split (BA = On-line | sem BA = Balcão).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetDefaults}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-300 bg-gray-800 hover:bg-gray-700 hover:text-white transition-colors"
          >
            Restaurar Padrão
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-black text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-emerald-950"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <span>💾 Salvar Alterações</span>
              </>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Carregando configurações...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Coluna da esquerda: Formulário de Controles (7 colunas) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Bloco Pagar On-line */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 md:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💳</span>
                  <div>
                    <h2 className="text-base font-bold text-white">Bloco Pagar On-line (Com BA)</h2>
                    <p className="text-xs text-gray-400">Cobranças faturadas pela Europcar Brasil no site</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      online: { ...c.online, enabled: !c.online.enabled },
                    }))
                  }
                  className={`text-xs px-2.5 py-1 rounded-md font-bold transition-colors ${
                    config.online.enabled
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                      : "bg-gray-800 text-gray-400"
                  }`}
                >
                  {config.online.enabled ? "Ativado" : "Desativado"}
                </button>
              </div>

              {config.online.enabled && (
                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      Título do Bloco
                    </label>
                    <input
                      type="text"
                      value={config.online.title}
                      onChange={(e) =>
                        setConfig((c) => ({
                          ...c,
                          online: { ...c.online, title: e.target.value },
                        }))
                      }
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                      placeholder="Pagar on-line"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <Toggle
                      label="Subtotal em Reais (R$)"
                      checked={config.online.showSubtotalBRL}
                      onChange={(val) =>
                        setConfig((c) => ({
                          ...c,
                          online: { ...c.online, showSubtotalBRL: val },
                        }))
                      }
                    />
                    <Toggle
                      label="Subtotal na Moeda Local"
                      desc="Ex: (€ 92,73)"
                      checked={config.online.showSubtotalLocal}
                      onChange={(val) =>
                        setConfig((c) => ({
                          ...c,
                          online: { ...c.online, showSubtotalLocal: val },
                        }))
                      }
                    />
                  </div>

                  <div className="border-t border-gray-800 pt-3 space-y-4">
                    {/* Grupo de Proteções & Seguros */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-sm">🛡️</span>
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                          Proteções & Coberturas Extras
                        </p>
                      </div>
                      <p className="text-[11px] text-gray-400 mb-2 leading-relaxed">
                        Quando a <strong>Franquia Zero</strong> é contratada, as proteções básicas e super proteções são automaticamente unificadas nela. Quando não for Franquia Zero, você pode ativar/desativar cada cobertura individualmente:
                      </p>
                      <div className="divide-y divide-gray-800/60 bg-gray-950/40 rounded-xl px-3 border border-gray-800/60">
                        <Toggle
                          label="Proteção Premium — Franquia Zero"
                          desc="Exibida como 'Incluso' quando o cliente seleciona Franquia Zero"
                          badge="Franquia Zero"
                          checked={config.online.showZeroExcess}
                          onChange={(val) =>
                            setConfig((c) => ({
                              ...c,
                              online: { ...c.online, showZeroExcess: val },
                            }))
                          }
                        />
                        <Toggle
                          label="Super Proteção contra Roubo (Super Theft Waiver / STHW)"
                          desc="SUPER THEFT WAIVER CHARGE / Cobertura reforçada de roubo e furto"
                          checked={config.online.showSuperTheftWaiver}
                          onChange={(val) =>
                            setConfig((c) => ({
                              ...c,
                              online: { ...c.online, showSuperTheftWaiver: val },
                            }))
                          }
                        />
                        <Toggle
                          label="Proteção contra Roubo (Theft Waiver / THW)"
                          desc="Proteção padrão contra roubo e furto do veículo"
                          checked={config.online.showTheftWaiver}
                          onChange={(val) =>
                            setConfig((c) => ({
                              ...c,
                              online: { ...c.online, showTheftWaiver: val },
                            }))
                          }
                        />
                        <Toggle
                          label="Proteção contra Danos / Colisão (Damage Waiver / CDW / SCDW)"
                          desc="Cobertura de avarias, colisões e sinistros do veículo"
                          checked={config.online.showCollisionDamageWaiver}
                          onChange={(val) =>
                            setConfig((c) => ({
                              ...c,
                              online: { ...c.online, showCollisionDamageWaiver: val },
                            }))
                          }
                        />
                        <Toggle
                          label="Proteções Básicas Genéricas (Roubo e Danos)"
                          desc="Exibidas com o valor da franquia quando NÃO for Franquia Zero"
                          checked={config.online.showBasicProtections}
                          onChange={(val) =>
                            setConfig((c) => ({
                              ...c,
                              online: { ...c.online, showBasicProtections: val },
                            }))
                          }
                        />
                        <Toggle
                          label="Vidros e Pneus (Wheels & Windscreen / WWI)"
                          desc="Cobertura para quebra de vidros, retrovisores e furos de pneus"
                          checked={config.online.showGlassAndTyres}
                          onChange={(val) =>
                            setConfig((c) => ({
                              ...c,
                              online: { ...c.online, showGlassAndTyres: val },
                            }))
                          }
                        />
                        <Toggle
                          label="Acidentes Pessoais (Personal Accident / PAI / SPPAI)"
                          desc="Cobertura para condutor e passageiros em caso de acidente"
                          checked={config.online.showPersonalAccident}
                          onChange={(val) =>
                            setConfig((c) => ({
                              ...c,
                              online: { ...c.online, showPersonalAccident: val },
                            }))
                          }
                        />
                        <Toggle
                          label="Assistência 24h em Viagem (Roadside Assistance / RSA)"
                          desc="Guincho, reboque e suporte emergencial na estrada"
                          checked={config.online.showRoadsideAssistance}
                          onChange={(val) =>
                            setConfig((c) => ({
                              ...c,
                              online: { ...c.online, showRoadsideAssistance: val },
                            }))
                          }
                        />
                      </div>
                    </div>

                    {/* Grupo de Diárias, Taxas & Licenças */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-sm">📋</span>
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                          Diárias, Taxas Obrigatórias & Opcionais
                        </p>
                      </div>
                      <div className="divide-y divide-gray-800/60 bg-gray-950/40 rounded-xl px-3 border border-gray-800/60">
                        <Toggle
                          label="Diárias"
                          desc="Linha com o aluguel base do veículo"
                          checked={config.online.showDailyRental}
                          onChange={(val) =>
                            setConfig((c) => ({
                              ...c,
                              online: { ...c.online, showDailyRental: val },
                            }))
                          }
                        />
                        <Toggle
                          label="Taxas e Licenças"
                          checked={config.online.showLicensesAndFees}
                          onChange={(val) =>
                            setConfig((c) => ({
                              ...c,
                              online: { ...c.online, showLicensesAndFees: val },
                            }))
                          }
                        />
                        <Toggle
                          label="Sobretaxa de Alta Temporada"
                          checked={config.online.showHighSeasonSurcharge}
                          onChange={(val) =>
                            setConfig((c) => ({
                              ...c,
                              online: { ...c.online, showHighSeasonSurcharge: val },
                            }))
                          }
                        />
                        <Toggle
                          label="Taxa de Aeroporto"
                          checked={config.online.showAirportSurcharge}
                          onChange={(val) =>
                            setConfig((c) => ({
                              ...c,
                              online: { ...c.online, showAirportSurcharge: val },
                            }))
                          }
                        />
                        <Toggle
                          label="Taxa de Devolução em Outra Loja (One-Way)"
                          checked={config.online.showOneWayCharge}
                          onChange={(val) =>
                            setConfig((c) => ({
                              ...c,
                              online: { ...c.online, showOneWayCharge: val },
                            }))
                          }
                        />
                        <Toggle
                          label="Demais Taxas e Acessórios Opcionais"
                          checked={config.online.showOtherItems}
                          onChange={(val) =>
                            setConfig((c) => ({
                              ...c,
                              online: { ...c.online, showOtherItems: val },
                            }))
                          }
                        />
                        <Toggle
                          label="Aviso de Parcelamento Sem Juros"
                          desc="Exibe a faixa 'Nx de R$ ... sem juros' para cartão de crédito"
                          checked={config.online.showInstallmentsNotice}
                          onChange={(val) =>
                            setConfig((c) => ({
                              ...c,
                              online: { ...c.online, showInstallmentsNotice: val },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Bloco A Pagar no Balcão */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 md:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏪</span>
                  <div>
                    <h2 className="text-base font-bold text-white">Bloco A Pagar no Balcão (Sem BA)</h2>
                    <p className="text-xs text-gray-400">Cobranças feitas diretamente na loja de retirada</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      counter: { ...c.counter, enabled: !c.counter.enabled },
                    }))
                  }
                  className={`text-xs px-2.5 py-1 rounded-md font-bold transition-colors ${
                    config.counter.enabled
                      ? "bg-amber-950 text-amber-400 border border-amber-800"
                      : "bg-gray-800 text-gray-400"
                  }`}
                >
                  {config.counter.enabled ? "Ativado" : "Desativado"}
                </button>
              </div>

              {config.counter.enabled && (
                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      Título do Bloco
                    </label>
                    <input
                      type="text"
                      value={config.counter.title}
                      onChange={(e) =>
                        setConfig((c) => ({
                          ...c,
                          counter: { ...c.counter, title: e.target.value },
                        }))
                      }
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                      placeholder="A pagar no balcão"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <Toggle
                      label="Subtotal em Reais (R$)"
                      checked={config.counter.showSubtotalBRL}
                      onChange={(val) =>
                        setConfig((c) => ({
                          ...c,
                          counter: { ...c.counter, showSubtotalBRL: val },
                        }))
                      }
                    />
                    <Toggle
                      label="Subtotal na Moeda Local"
                      desc="Ex: (€ 122,00)"
                      checked={config.counter.showSubtotalLocal}
                      onChange={(val) =>
                        setConfig((c) => ({
                          ...c,
                          counter: { ...c.counter, showSubtotalLocal: val },
                        }))
                      }
                    />
                  </div>

                  <div className="border-t border-gray-800 pt-3 divide-y divide-gray-800/60">
                    <Toggle
                      label="Lista de Itens a Pagar no Balcão"
                      desc="Exibe as linhas das taxas cobradas no balcão"
                      checked={config.counter.showItemsList}
                      onChange={(val) =>
                        setConfig((c) => ({
                          ...c,
                          counter: { ...c.counter, showItemsList: val },
                        }))
                      }
                    />
                    <Toggle
                      label="Aviso Explicativo de Pagamento na Loja"
                      desc="Texto informativo sobre cobrança no cartão do condutor na moeda local"
                      checked={config.counter.showNotice}
                      onChange={(val) =>
                        setConfig((c) => ({
                          ...c,
                          counter: { ...c.counter, showNotice: val },
                        }))
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3. Bloco Valor Total */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 md:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🟢</span>
                  <div>
                    <h2 className="text-base font-bold text-white">Bloco Valor Total</h2>
                    <p className="text-xs text-gray-400">Total geral (On-line + Balcão)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      total: { ...c.total, enabled: !c.total.enabled },
                    }))
                  }
                  className={`text-xs px-2.5 py-1 rounded-md font-bold transition-colors ${
                    config.total.enabled
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                      : "bg-gray-800 text-gray-400"
                  }`}
                >
                  {config.total.enabled ? "Ativado" : "Desativado"}
                </button>
              </div>

              {config.total.enabled && (
                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                      Título do Bloco
                    </label>
                    <input
                      type="text"
                      value={config.total.title}
                      onChange={(e) =>
                        setConfig((c) => ({
                          ...c,
                          total: { ...c.total, title: e.target.value },
                        }))
                      }
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                      placeholder="Valor total"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <Toggle
                      label="Total em Reais (R$)"
                      checked={config.total.showBRL}
                      onChange={(val) =>
                        setConfig((c) => ({
                          ...c,
                          total: { ...c.total, showBRL: val },
                        }))
                      }
                    />
                    <Toggle
                      label="Total na Moeda Local"
                      desc="Ex: (€ 214,73)"
                      checked={config.total.showLocal}
                      onChange={(val) =>
                        setConfig((c) => ({
                          ...c,
                          total: { ...c.total, showLocal: val },
                        }))
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Coluna da direita: Live Preview Interativo (5 colunas) */}
          <div className="lg:col-span-5 sticky top-6 space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">Visualização em Tempo Real</span>
                  <span className="text-[10px] bg-indigo-950 text-indigo-400 border border-indigo-800/80 px-1.5 py-0.5 rounded font-bold">
                    Ao Vivo
                  </span>
                </div>
              </div>

              {/* Controles de Simulação */}
              <div className="bg-gray-950 rounded-xl p-3 border border-gray-800/80 mb-4 space-y-2">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Simulador de Cenários:
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSimZeroExcess(!simZeroExcess)}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition-colors ${
                      simZeroExcess
                        ? "bg-emerald-900/40 text-emerald-300 border-emerald-700/60"
                        : "bg-gray-800 text-gray-400 border-gray-700"
                    }`}
                  >
                    {simZeroExcess ? "✓ Com Franquia Zero" : "Sem Franquia Zero"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimHasCounter(!simHasCounter)}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition-colors ${
                      simHasCounter
                        ? "bg-amber-900/40 text-amber-300 border-amber-700/60"
                        : "bg-gray-800 text-gray-400 border-gray-700"
                    }`}
                  >
                    {simHasCounter ? "✓ Com itens no Balcão" : "100% On-line"}
                  </button>
                </div>
              </div>

              {/* Renderização real do componente com o estado atual */}
              <div className="bg-gray-100 p-4 rounded-xl border border-gray-300">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Espelho do Checkout
                </p>
                <PaymentSplitBlocks
                  split={previewSplit}
                  isZeroExcess={simZeroExcess}
                  installments={6}
                  summaryConfig={config}
                />
              </div>

              <p className="text-[11px] text-gray-500 text-center mt-3">
                Qualquer interruptor ativado ou desativado reflete instantaneamente acima.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
