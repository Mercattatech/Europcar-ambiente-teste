"use client";

import { useState, useEffect } from "react";

type CountryTab = "GLOBAL" | "PT" | "IT";

interface MarginState {
  percent: number;
  savedPercent: number;
  zeroMargin: number;
  savedZeroMargin: number;
  custom?: boolean;
}

export default function MargemPage() {
  const [activeTab, setActiveTab] = useState<CountryTab>("GLOBAL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const [margins, setMargins] = useState<Record<CountryTab, MarginState>>({
    GLOBAL: { percent: 0, savedPercent: 0, zeroMargin: 0, savedZeroMargin: 0 },
    PT: { percent: 0, savedPercent: 0, zeroMargin: 0, savedZeroMargin: 0, custom: false },
    IT: { percent: 0, savedPercent: 0, zeroMargin: 0, savedZeroMargin: 0, custom: false },
  });

  useEffect(() => {
    fetch("/api/admin/margin")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.percent !== "number") {
          setToast("⚠️ Não foi possível ler a margem salva. Recarregue antes de salvar.");
          return;
        }

        const globalPercent = d.global?.percent ?? d.percent ?? 0;
        const globalZero = d.global?.zeroExcessPercent ?? d.zeroExcessPercent ?? globalPercent;

        const ptData = d.countries?.PT || {};
        const ptPercent = typeof ptData.percent === "number" ? ptData.percent : globalPercent;
        const ptZero = typeof ptData.zeroExcessPercent === "number" ? ptData.zeroExcessPercent : globalZero;

        const itData = d.countries?.IT || {};
        const itPercent = typeof itData.percent === "number" ? itData.percent : globalPercent;
        const itZero = typeof itData.zeroExcessPercent === "number" ? itData.zeroExcessPercent : globalZero;

        setMargins({
          GLOBAL: {
            percent: globalPercent,
            savedPercent: globalPercent,
            zeroMargin: globalZero,
            savedZeroMargin: globalZero,
          },
          PT: {
            percent: ptPercent,
            savedPercent: ptPercent,
            zeroMargin: ptZero,
            savedZeroMargin: ptZero,
            custom: !!ptData.custom,
          },
          IT: {
            percent: itPercent,
            savedPercent: itPercent,
            zeroMargin: itZero,
            savedZeroMargin: itZero,
            custom: !!itData.custom,
          },
        });
      })
      .catch(() => setToast("⚠️ Não foi possível ler a margem salva. Recarregue antes de salvar."))
      .finally(() => setLoading(false));
  }, []);

  const current = margins[activeTab];

  const updateCurrent = (updater: (prev: MarginState) => MarginState) => {
    setMargins((prev) => ({
      ...prev,
      [activeTab]: updater(prev[activeTab]),
    }));
  };

  const handleSave = async (scope: "all" | "eto" | "zero" = "all") => {
    setSaving(true);
    try {
      const payload: any = { country: activeTab };
      if (scope === "all" || scope === "eto") payload.percent = current.percent;
      if (scope === "all" || scope === "zero") payload.zeroExcessPercent = current.zeroMargin;

      const res = await fetch("/api/admin/margin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        updateCurrent((prev) => ({
          ...prev,
          savedPercent: data.percent !== undefined ? data.percent : prev.savedPercent,
          savedZeroMargin: data.zeroExcessPercent !== undefined ? data.zeroExcessPercent : prev.savedZeroMargin,
          custom: activeTab !== "GLOBAL" ? true : prev.custom,
        }));
        const countryLabel = activeTab === "GLOBAL" ? "Global" : activeTab === "PT" ? "Portugal" : "Itália";
        setToast(`✅ Margem de ${countryLabel} salva com sucesso!`);
        setTimeout(() => setToast(""), 3000);
      } else {
        setToast("❌ Erro ao salvar: " + (data.error || ""));
        setTimeout(() => setToast(""), 5000);
      }
    } catch (e: any) {
      setToast("❌ Erro: " + e.message);
      setTimeout(() => setToast(""), 5000);
    } finally {
      setSaving(false);
    }
  };

  const hasTopChanges = current.percent !== current.savedPercent;
  const hasZeroChanges = current.zeroMargin !== current.savedZeroMargin;

  // Escala dinâmica para a barra de Proteção Premium (permite quanto % o usuário quiser)
  const sliderZeroMax = Math.max(100, Math.ceil((current.zeroMargin || 0) / 50) * 50);
  const zeroFillPct = sliderZeroMax > 0 ? Math.min(100, Math.max(0, (current.zeroMargin / sliderZeroMax) * 100)) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 px-6 py-3 rounded-xl shadow-2xl font-bold text-sm animate-pulse ${
            toast.startsWith("✅") ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          💹 Controlador de Margem ETO
        </h1>
        <p className="text-gray-400 mt-2">
          Defina as margens de lucro sobre as tarifas corporativas Europcar (ETO). Você pode configurar um markup global ou markups individuais específicos para Portugal e Itália.
        </p>
      </div>

      {/* Country Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-gray-900/90 border border-gray-800 rounded-2xl mb-6">
        <button
          type="button"
          onClick={() => setActiveTab("GLOBAL")}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === "GLOBAL"
              ? "bg-[#e67e00] text-white shadow-lg shadow-[#e67e00]/25"
              : "text-gray-400 hover:text-white hover:bg-gray-800/60"
          }`}
        >
          <span className="text-base">🌍</span>
          <span>Global / Padrão</span>
          <span className="text-[11px] opacity-80 font-normal hidden sm:inline">(Espanha, França, etc.)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PT")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === "PT"
              ? "bg-[#e67e00] text-white shadow-lg shadow-[#e67e00]/25"
              : "text-gray-400 hover:text-white hover:bg-gray-800/60"
          }`}
        >
          <span className="text-base">🇵🇹</span>
          <span>Portugal</span>
          {margins.PT.custom && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" title="Markup individual ativo" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("IT")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === "IT"
              ? "bg-[#e67e00] text-white shadow-lg shadow-[#e67e00]/25"
              : "text-gray-400 hover:text-white hover:bg-gray-800/60"
          }`}
        >
          <span className="text-base">🇮🇹</span>
          <span>Itália</span>
          {margins.IT.custom && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" title="Markup individual ativo" />
          )}
        </button>
      </div>

      {/* Scope Banner */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl px-4 py-3 mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-xs text-gray-300">
          <span className="text-base">
            {activeTab === "GLOBAL" ? "🌐" : activeTab === "PT" ? "🇵🇹" : "🇮🇹"}
          </span>
          {activeTab === "GLOBAL" ? (
            <span>
              <strong>Escopo Global:</strong> Aplica-se a todas as estações internacionais (Espanha, França, etc.), exceto onde houver markup individual configurado.
            </span>
          ) : activeTab === "PT" ? (
            <span>
              <strong>Escopo Portugal:</strong> Aplica-se <strong>exclusivamente</strong> a todas as estações de Portugal (ex: Lisboa, Porto, Faro, Funchal). Demais países não são afetados.
            </span>
          ) : (
            <span>
              <strong>Escopo Itália:</strong> Aplica-se <strong>exclusivamente</strong> a todas as estações da Itália (ex: Roma, Milão, Florença, Veneza). Demais países não são afetados.
            </span>
          )}
        </div>
        {activeTab !== "GLOBAL" && (
          <span className="text-[11px] font-semibold text-gray-400 shrink-0">
            {current.custom ? "✓ Markup individual ativo" : "Usando padrão global"}
          </span>
        )}
      </div>

      {/* Card 1: Tarifa ETO (Carro) */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-7 mb-6 shadow-xl">
        <label className="block text-base font-bold text-white mb-4">
          Margem de lucro (%) — Tarifa ETO (Carro) {activeTab === "PT" ? "• Portugal" : activeTab === "IT" ? "• Itália" : "• Geral"}
        </label>

        {/* Slider */}
        <div className="mb-6">
          <input
            type="range"
            min="0"
            max="50"
            step="0.5"
            value={current.percent}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              updateCurrent((prev) => ({ ...prev, percent: val }));
            }}
            className="w-full h-3 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #e67e00 0%, #e67e00 ${current.percent * 2}%, #374151 ${current.percent * 2}%, #374151 100%)`,
            }}
          />
          <div className="flex justify-between text-[11px] text-gray-500 font-bold mt-1.5">
            <span>0%</span>
            <span>10%</span>
            <span>20%</span>
            <span>30%</span>
            <span>40%</span>
            <span>50%</span>
          </div>
        </div>

        {/* Numeric input & Save */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.5"
              value={current.percent}
              onChange={(e) => {
                const val = Math.max(0, parseFloat(e.target.value) || 0);
                updateCurrent((prev) => ({ ...prev, percent: val }));
              }}
              className="w-36 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-2xl font-black text-white text-center outline-none focus:border-[#e67e00] transition-colors"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold">%</span>
          </div>
          <button
            onClick={() => handleSave("eto")}
            disabled={saving || !hasTopChanges}
            className={`px-8 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              hasTopChanges
                ? "bg-[#e67e00] hover:bg-[#cc6f00] text-white shadow-lg shadow-[#e67e00]/25 cursor-pointer"
                : "bg-gray-800 text-gray-600 cursor-not-allowed"
            }`}
          >
            {saving ? "Salvando..." : hasTopChanges ? "Salvar" : "Salvo ✓"}
          </button>
        </div>

        {/* Saved info */}
        <p className="text-xs text-gray-500 mt-4">
          Margem atual salva: <span className="text-[#e67e00] font-bold">{current.savedPercent}%</span>
          {activeTab !== "GLOBAL" && !current.custom && (
            <span className="text-gray-400 ml-2">(Herdado da margem Global)</span>
          )}
        </p>
      </div>

      {/* Card 2: Proteção Premium (Franquia Zero — CID 56935495) */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-7 mb-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="bg-blue-500/20 text-blue-400 text-xs font-bold px-2.5 py-1 rounded-md">CID 56935495</span>
            <h2 className="text-base font-black text-white">
              Markup da Proteção Premium (Franquia Zero) {activeTab === "PT" ? "• Portugal" : activeTab === "IT" ? "• Itália" : "• Geral"}
            </h2>
          </div>

          {/* Botão Deixar Valor NET (Habilitar / Desabilitar) */}
          <button
            type="button"
            onClick={() => {
              if (current.zeroMargin === 0) {
                const fallback = current.savedZeroMargin > 0 ? current.savedZeroMargin : 25;
                updateCurrent((prev) => ({ ...prev, zeroMargin: fallback }));
              } else {
                updateCurrent((prev) => ({ ...prev, zeroMargin: 0 }));
              }
            }}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              current.zeroMargin === 0
                ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950"
                : "bg-gray-800 border-gray-700 text-gray-300 hover:text-white hover:border-gray-500"
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                current.zeroMargin === 0 ? "bg-emerald-400 shadow-sm shadow-emerald-400" : "bg-gray-500"
              }`}
            />
            {current.zeroMargin === 0 ? "✓ Valor NET Ativo (0% de margem)" : "Deixar valor NET (custo XRS)"}
          </button>
        </div>

        <p className="text-xs text-gray-400 mb-4">
          O valor da franquia premium é obtido em tempo real da Europcar XRS. Você pode definir <strong>livremente a porcentagem de markup que desejar</strong> (ex.: 15%, 50%, 100%, 200%) ou ativar <strong>Deixar valor NET</strong> para repassar a franquia zero a preço de custo XRS.
        </p>

        {/* Atalhos rápidos de markup */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-[11px] text-gray-500 font-bold uppercase mr-1">Atalhos rápidos:</span>
          {[
            { label: "0% (NET)", val: 0 },
            { label: "15%", val: 15 },
            { label: "25%", val: 25 },
            { label: "50%", val: 50 },
            { label: "75%", val: 75 },
            { label: "100%", val: 100 },
            { label: "150%", val: 150 },
            { label: "200%", val: 200 },
          ].map((preset) => (
            <button
              key={preset.val}
              type="button"
              onClick={() => updateCurrent((prev) => ({ ...prev, zeroMargin: preset.val }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                current.zeroMargin === preset.val
                  ? "bg-[#e67e00] text-white border-[#e67e00] shadow-sm"
                  : "bg-gray-800/80 text-gray-400 border-gray-700 hover:text-white hover:border-gray-600"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Slider com escala dinâmica */}
        <div className="flex items-center justify-between mb-4">
          <label className="block text-sm font-bold text-gray-300">
            Margem sobre a Proteção Premium (%)
          </label>
          {current.zeroMargin === 0 ? (
            <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-0.5 rounded">
              Modo NET (Custo XRS)
            </span>
          ) : (
            <span className="text-[11px] font-bold text-[#e67e00] bg-[#e67e00]/10 border border-[#e67e00]/30 px-2.5 py-0.5 rounded">
              + {current.zeroMargin}% sobre a franquia
            </span>
          )}
        </div>

        <div className="mb-6">
          <input
            type="range"
            min="0"
            max={sliderZeroMax}
            step="0.5"
            value={current.zeroMargin}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              updateCurrent((prev) => ({ ...prev, zeroMargin: val }));
            }}
            className="w-full h-3 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #e67e00 0%, #e67e00 ${zeroFillPct}%, #374151 ${zeroFillPct}%, #374151 100%)`,
            }}
          />
          <div className="flex justify-between text-[11px] text-gray-500 font-bold mt-1.5">
            <span>0% (NET)</span>
            <span>{Math.round(sliderZeroMax * 0.25)}%</span>
            <span>{Math.round(sliderZeroMax * 0.5)}%</span>
            <span>{Math.round(sliderZeroMax * 0.75)}%</span>
            <span>{sliderZeroMax}%</span>
          </div>
        </div>

        {/* Numeric input & Save */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.5"
              value={current.zeroMargin}
              onChange={(e) => {
                const val = Math.max(0, parseFloat(e.target.value) || 0);
                updateCurrent((prev) => ({ ...prev, zeroMargin: val }));
              }}
              placeholder="0"
              className="w-36 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-2xl font-black text-white text-center outline-none focus:border-[#e67e00] transition-colors"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold">%</span>
          </div>
          <button
            onClick={() => handleSave("zero")}
            disabled={saving || !hasZeroChanges}
            className={`px-8 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              hasZeroChanges
                ? "bg-[#e67e00] hover:bg-[#cc6f00] text-white shadow-lg shadow-[#e67e00]/25 cursor-pointer"
                : "bg-gray-800 text-gray-600 cursor-not-allowed"
            }`}
          >
            {saving ? "Salvando..." : hasZeroChanges ? "Salvar" : "Salvo ✓"}
          </button>
        </div>

        {/* Saved info */}
        <p className="text-xs text-gray-500 mt-4">
          Margem atual salva: <span className="text-[#e67e00] font-bold">{current.savedZeroMargin}%</span>
          {current.savedZeroMargin === 0 && (
            <span className="text-emerald-400 font-semibold ml-2">(Tarifa NET — Preço de custo XRS)</span>
          )}
          {activeTab !== "GLOBAL" && !current.custom && (
            <span className="text-gray-400 ml-2">(Herdado da margem Global)</span>
          )}
        </p>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-2xl mb-2">🏷️</div>
          <h3 className="font-bold text-white text-sm mb-1">Tarifa POA</h3>
          <p className="text-xs text-gray-400">Tarifa pública. Mesmo preço que o site oficial. Aceita PIX, Cartão e Balcão.</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-2xl mb-2">📊</div>
          <h3 className="font-bold text-white text-sm mb-1">Tarifa ETO</h3>
          <p className="text-xs text-gray-400">Tarifa corporativa com desconto. Margem aplicada sobre o preço base. Aceita PIX e Cartão.</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-2xl mb-2">🛡️</div>
          <h3 className="font-bold text-white text-sm mb-1">Proteção Premium</h3>
          <p className="text-xs text-gray-400">Isenção total de franquia. Pode ser repassada a preço de custo (NET) ou com qualquer % de markup desejado.</p>
        </div>
      </div>
    </div>
  );
}
