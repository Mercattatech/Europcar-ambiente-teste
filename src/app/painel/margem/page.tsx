"use client";

import { useState, useEffect } from "react";

export default function MargemPage() {
  const [margin, setMargin] = useState(0);
  const [savedMargin, setSavedMargin] = useState(0);
  const [zeroMargin, setZeroMargin] = useState(0);
  const [savedZeroMargin, setSavedZeroMargin] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetch("/api/admin/margin")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.percent !== "number") {
          setToast("⚠️ Não foi possível ler a margem salva. Recarregue antes de salvar.");
          return;
        }
        setMargin(d.percent);
        setSavedMargin(d.percent);
        const z = typeof d.zeroExcessPercent === "number" ? d.zeroExcessPercent : d.percent;
        setZeroMargin(z);
        setSavedZeroMargin(z);
      })
      .catch(() => setToast("⚠️ Não foi possível ler a margem salva. Recarregue antes de salvar."))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (scope: "all" | "eto" | "zero" = "all") => {
    setSaving(true);
    try {
      const payload: any = {};
      if (scope === "all" || scope === "eto") payload.percent = margin;
      if (scope === "all" || scope === "zero") payload.zeroExcessPercent = zeroMargin;

      const res = await fetch("/api/admin/margin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        if (data.percent !== undefined) setSavedMargin(data.percent);
        if (data.zeroExcessPercent !== undefined) setSavedZeroMargin(data.zeroExcessPercent);
        setToast("✅ Margem salva com sucesso!");
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

  const hasTopChanges = margin !== savedMargin;
  const hasZeroChanges = zeroMargin !== savedZeroMargin;

  // Example prices for preview (ETO Base)
  const exampleEUR = 88.26;
  const exampleBRL = 531.26;
  const examplePOA = exampleBRL;
  const exampleETO = exampleBRL * 0.75;
  const exampleETOWithMargin = exampleETO * (1 + margin / 100);
  const profitPerRental = exampleETOWithMargin - exampleETO;

  // Example prices for preview (Proteção Premium Zero Excess)
  const exampleZeroEUR = 3.74;
  const exampleZeroBRL = 23.49;
  const exampleZeroWithMarginBRL = exampleZeroBRL * (1 + zeroMargin / 100);
  const exampleZeroProfitBRL = exampleZeroWithMarginBRL - exampleZeroBRL;

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
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          💹 Controlador de Margem ETO
        </h1>
        <p className="text-gray-400 mt-2">
          Defina as margens de lucro sobre as tarifas corporativas Europcar (ETO). Os percentuais definidos aqui incidem diretamente sobre as tarifas líquidas retornadas pela XRS.
        </p>
      </div>

      {/* Main Card: Tarifa Geral ETO */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-6">
        <div className="flex items-start gap-8 flex-col lg:flex-row">
          {/* Left: Slider */}
          <div className="flex-1 w-full">
            <label className="block text-sm font-bold text-gray-300 mb-4">
              Margem de lucro (%) — Tarifa ETO (Carro)
            </label>

            {/* Slider */}
            <div className="mb-6">
              <input
                type="range"
                min="0"
                max="50"
                step="0.5"
                value={margin}
                onChange={(e) => setMargin(parseFloat(e.target.value))}
                className="w-full h-3 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #e67e00 0%, #e67e00 ${margin * 2}%, #374151 ${margin * 2}%, #374151 100%)`,
                }}
              />
              <div className="flex justify-between text-[10px] text-gray-500 font-bold mt-1">
                <span>0%</span>
                <span>10%</span>
                <span>20%</span>
                <span>30%</span>
                <span>40%</span>
                <span>50%</span>
              </div>
            </div>

            {/* Numeric input */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={margin}
                  onChange={(e) => setMargin(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                  className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-2xl font-black text-white text-center outline-none focus:border-[#e67e00] transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">%</span>
              </div>
              <button
                onClick={() => handleSave("eto")}
                disabled={saving || !hasTopChanges}
                className={`px-8 py-3 rounded-lg font-bold text-sm transition-all ${
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
              Margem atual salva: <span className="text-[#e67e00] font-bold">{savedMargin}%</span>
            </p>
          </div>

          {/* Right: Preview box */}
          <div className="w-full lg:w-80 bg-gray-950 border border-gray-800 rounded-xl p-5 shrink-0">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              📊 Simulação de Preço
            </div>

            <div className="space-y-3">
              {/* POA price */}
              <div className="bg-gray-900 rounded-lg p-3">
                <div className="text-[10px] text-gray-500 font-bold uppercase">Tarifa POA (Pública)</div>
                <div className="text-lg font-black text-white">R$ {examplePOA.toFixed(2).replace(".", ",")}</div>
                <div className="text-[10px] text-gray-500">Base: EUR {exampleEUR.toFixed(2)}</div>
              </div>

              {/* ETO price */}
              <div className="border-2 border-[#e67e00] rounded-lg p-3 bg-[#e67e00]/5 relative">
                <span className="absolute -top-2 right-2 text-[9px] bg-[#e67e00] text-white px-2 py-0.5 rounded-full font-black">
                  -{Math.round((1 - exampleETOWithMargin / examplePOA) * 100)}%
                </span>
                <div className="text-[10px] text-[#e67e00] font-bold uppercase">Tarifa ETO + Margem</div>
                <div className="text-lg font-black text-white">R$ {exampleETOWithMargin.toFixed(2).replace(".", ",")}</div>
                <div className="text-[10px] text-gray-500">
                  Base ETO: R$ {exampleETO.toFixed(2).replace(".", ",")}
                  <span className="text-[#e67e00] ml-1">+ {margin}% = R$ {(exampleETOWithMargin - exampleETO).toFixed(2).replace(".", ",")}</span>
                </div>
              </div>

              {/* Profit */}
              <div className="mt-4 bg-green-900/20 border border-green-800/30 rounded-lg p-3">
                <div className="text-[10px] text-green-400 font-bold uppercase">Seu lucro por reserva ETO</div>
                <div className="text-xl font-black text-green-400">
                  R$ {profitPerRental.toFixed(2).replace(".", ",")}
                </div>
                <div className="text-[10px] text-green-600">
                  Sobre exemplo de R$ {exampleETO.toFixed(2).replace(".", ",")} (EDMR)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: Proteção Premium (Franquia Zero — CID 56935495) */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="bg-blue-500/20 text-blue-400 text-xs font-bold px-2.5 py-1 rounded-md">CID 56935495</span>
            <h2 className="text-lg font-black text-white">Markup da Proteção Premium (Franquia Zero)</h2>
          </div>

          {/* Botão Deixar Valor NET (Habilitar / Desabilitar) */}
          <button
            type="button"
            onClick={() => {
              if (zeroMargin === 0) {
                setZeroMargin(savedZeroMargin > 0 ? savedZeroMargin : 15);
              } else {
                setZeroMargin(0);
              }
            }}
            className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              zeroMargin === 0
                ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950"
                : "bg-gray-800 border-gray-700 text-gray-300 hover:text-white hover:border-gray-500"
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                zeroMargin === 0 ? "bg-emerald-400 shadow-sm shadow-emerald-400" : "bg-gray-500"
              }`}
            />
            {zeroMargin === 0 ? "✓ Valor NET Ativo (0% de margem)" : "Deixar valor NET (custo XRS)"}
          </button>
        </div>

        <p className="text-xs text-gray-400 mb-6">
          O valor da franquia premium é obtido em tempo real da Europcar XRS. Defina abaixo o markup aplicado sobre a proteção ou ative a opção <strong>Deixar valor NET</strong> para repassar a franquia zero a preço de custo (sem acréscimo).
        </p>

        <div className="flex items-start gap-8 flex-col lg:flex-row">
          {/* Left: Slider idêntico ao de cima */}
          <div className="flex-1 w-full">
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-bold text-gray-300">
                Margem sobre a Proteção Premium (%)
              </label>
              {zeroMargin === 0 && (
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
                  Modo NET (Custo XRS)
                </span>
              )}
            </div>

            {/* Slider */}
            <div className="mb-6">
              <input
                type="range"
                min="0"
                max="50"
                step="0.5"
                value={zeroMargin}
                onChange={(e) => setZeroMargin(parseFloat(e.target.value))}
                className="w-full h-3 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #e67e00 0%, #e67e00 ${zeroMargin * 2}%, #374151 ${zeroMargin * 2}%, #374151 100%)`,
                }}
              />
              <div className="flex justify-between text-[10px] text-gray-500 font-bold mt-1">
                <span>0% (NET)</span>
                <span>10%</span>
                <span>20%</span>
                <span>30%</span>
                <span>40%</span>
                <span>50%</span>
              </div>
            </div>

            {/* Numeric input */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={zeroMargin}
                  onChange={(e) => setZeroMargin(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                  className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-2xl font-black text-white text-center outline-none focus:border-[#e67e00] transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">%</span>
              </div>
              <button
                onClick={() => handleSave("zero")}
                disabled={saving || !hasZeroChanges}
                className={`px-8 py-3 rounded-lg font-bold text-sm transition-all ${
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
              Margem atual salva: <span className="text-[#e67e00] font-bold">{savedZeroMargin}%</span>
              {savedZeroMargin === 0 && (
                <span className="text-emerald-400 font-semibold ml-2">(Tarifa NET — Preço de custo XRS)</span>
              )}
            </p>
          </div>

          {/* Right: Preview box Proteção Premium */}
          <div className="w-full lg:w-80 bg-gray-950 border border-gray-800 rounded-xl p-5 shrink-0">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              🛡️ Simulação Proteção Premium
            </div>

            <div className="space-y-3">
              {/* Base XRS */}
              <div className="bg-gray-900 rounded-lg p-3">
                <div className="text-[10px] text-gray-500 font-bold uppercase">Franquia Zero XRS (Base NET)</div>
                <div className="text-lg font-black text-white">R$ {exampleZeroBRL.toFixed(2).replace(".", ",")}</div>
                <div className="text-[10px] text-gray-500">Exemplo: EUR {exampleZeroEUR.toFixed(2)} / diária</div>
              </div>

              {/* Upgrade exibido no site */}
              <div className="border-2 border-[#e67e00] rounded-lg p-3 bg-[#e67e00]/5 relative">
                <div className="text-[10px] text-[#e67e00] font-bold uppercase">Upgrade exibido no site</div>
                <div className="text-lg font-black text-white">
                  R$ {exampleZeroWithMarginBRL.toFixed(2).replace(".", ",")}
                </div>
                <div className="text-[10px] text-gray-400">
                  {zeroMargin === 0 ? (
                    <span className="text-emerald-400 font-bold">100% Preço NET (Custo XRS)</span>
                  ) : (
                    <>
                      Base XRS: R$ {exampleZeroBRL.toFixed(2).replace(".", ",")}
                      <span className="text-[#e67e00] ml-1">
                        + {zeroMargin}% = R$ {exampleZeroProfitBRL.toFixed(2).replace(".", ",")}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Lucro Proteção */}
              <div className="mt-4 bg-emerald-900/20 border border-emerald-800/30 rounded-lg p-3">
                <div className="text-[10px] text-emerald-400 font-bold uppercase">Seu ganho na franquia zero</div>
                <div className="text-xl font-black text-emerald-400">
                  {zeroMargin === 0 ? "R$ 0,00 (NET)" : `+ R$ ${exampleZeroProfitBRL.toFixed(2).replace(".", ",")}`}
                </div>
                <div className="text-[10px] text-gray-500">
                  {zeroMargin === 0 ? "Repassado sem margem adicional" : "Margem adicional sobre a franquia"}
                </div>
              </div>
            </div>
          </div>
        </div>
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
          <p className="text-xs text-gray-400">Isenção total de franquia. Pode ser repassada a preço de custo (NET) ou com markup customizado.</p>
        </div>
      </div>
    </div>
  );
}
