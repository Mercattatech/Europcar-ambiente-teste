"use client";

import { useState, useEffect, useCallback } from "react";

const STEP_LABELS: Record<number, { label: string; icon: string; color: string }> = {
  1: { label: "Pesquisa", icon: "🔍", color: "bg-blue-500" },
  2: { label: "Veículo", icon: "🚗", color: "bg-yellow-500" },
  3: { label: "Extras", icon: "🛡️", color: "bg-orange-500" },
  4: { label: "Checkout", icon: "💳", color: "bg-purple-500" },
  5: { label: "Concluída", icon: "✅", color: "bg-green-500" },
};


// ─── Sales Comparison Component ────────────────────────────────────────────
type CompTab = "monthly" | "quarterly" | "yearly";
type CompItem = { label: string; vendas: number; count: number };

function SalesComparisonSection() {
  const [tab, setTab]   = useState<CompTab>("monthly");
  const [compData, setCompData] = useState<{ monthly: CompItem[]; quarterly: CompItem[]; yearly: CompItem[] } | null>(null);
  const [compLoading, setCompLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/reservations/sales-comparison")
      .then(r => r.json())
      .then(d => { setCompData(d); setCompLoading(false); })
      .catch(() => setCompLoading(false));
  }, []);

  const items = compData?.[tab] || [];
  const maxVal = items.reduce((m: number, i: CompItem) => Math.max(m, i.vendas), 1);
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h3 className="text-white font-bold flex items-center gap-2">📊 Comparativo de Vendas</h3>
        <div className="flex bg-gray-800 rounded-lg p-0.5 gap-0.5">
          {(["monthly","quarterly","yearly"] as CompTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${tab === t ? "bg-indigo-700 text-white" : "text-gray-400 hover:text-white"}`}>
              {t === "monthly" ? "Mensal" : t === "quarterly" ? "Trimestral" : "Anual"}
            </button>
          ))}
        </div>
      </div>

      {compLoading ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"/></div>
      ) : items.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">Sem dados suficientes.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item: CompItem, i: number) => (
            <div key={i} className="group">
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-xs font-bold w-12 shrink-0 text-right font-mono">{item.label}</span>
                <div className="flex-1 h-7 bg-gray-800 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-700 to-indigo-500 rounded-lg transition-all duration-700 ease-out"
                    style={{ width: maxVal > 0 ? `${Math.max((item.vendas / maxVal) * 100, item.vendas > 0 ? 2 : 0)}%` : "0%" }}
                  />
                </div>
                <div className="flex flex-col items-end shrink-0 w-28">
                  <span className="text-white text-xs font-bold">{fmt(item.vendas)}</span>
                  <span className="text-gray-500 text-[10px]">{item.count} reserva{item.count !== 1 ? "s" : ""}</span>
                </div>
              </div>
            </div>
          ))}
          <div className="border-t border-gray-800 pt-3 flex justify-between items-center mt-2">
            <span className="text-gray-500 text-xs">Total do período</span>
            <div className="text-right">
              <p className="text-white font-black">{fmt(items.reduce((s: number, i: CompItem) => s + i.vendas, 0))}</p>
              <p className="text-gray-500 text-[10px]">{items.reduce((s: number, i: CompItem) => s + i.count, 0)} reservas</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RankingCard({ title, icon, items, valueLabel }: { title: string; icon: string; items: { name: string; code?: string; count: number }[]; valueLabel?: string }) {
  const maxCount = items.length > 0 ? items[0].count : 1;
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-white font-bold flex items-center gap-2 mb-4">{icon} {title}</h3>
      {items.length === 0 ? (
        <p className="text-gray-500 text-sm">Sem dados suficientes.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="relative">
              <div className="flex items-center gap-2 relative z-10 py-1.5 px-2">
                <span className="text-gray-500 text-xs font-bold w-5 text-right">{i + 1}.</span>
                <span className="text-white text-sm font-medium flex-1 truncate">{item.name}</span>
                {item.code && item.code !== item.name && (
                  <span className="text-gray-600 text-[10px] font-mono">{item.code}</span>
                )}
                <span className="text-emerald-400 text-xs font-bold">{item.count} {valueLabel || ""}</span>
              </div>
              <div
                className="absolute inset-0 bg-emerald-500/10 rounded"
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    try {
      const res = await fetch(`/api/admin/journey/analytics?${params}`);
      const d = await res.json();
      setData(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">📊 Analytics & Insights</h1>
          <p className="text-gray-400 text-sm mt-1">Entenda o comportamento dos clientes e otimize conversões.</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500" />
          <span className="text-gray-600">—</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500" />
          <button onClick={fetchData} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors">Filtrar</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : data ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
              <p className="text-3xl font-black text-white">{data.totalSessions?.toLocaleString() || 0}</p>
              <p className="text-xs text-gray-500 font-bold mt-1">Total de Sessões</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
              <p className="text-3xl font-black text-emerald-400">{data.completedCount?.toLocaleString() || 0}</p>
              <p className="text-xs text-gray-500 font-bold mt-1">Reservas Concluídas</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
              <p className="text-3xl font-black text-red-400">{data.abandonedCount?.toLocaleString() || 0}</p>
              <p className="text-xs text-gray-500 font-bold mt-1">Abandonos</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
              <p className="text-3xl font-black text-blue-400">{data.conversionRate}%</p>
              <p className="text-xs text-gray-500 font-bold mt-1">Taxa de Conversão</p>
            </div>
          </div>

          {/* Funnel */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-bold flex items-center gap-2 mb-4">📈 Funil de Conversão</h3>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((step) => {
                const s = STEP_LABELS[step];
                const count = data.funnel?.[`step${step}`] || 0;
                const maxCount = data.funnel?.step1 || 1;
                const pct = maxCount > 0 ? ((count / maxCount) * 100).toFixed(1) : "0";
                return (
                  <div key={step} className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 w-28 shrink-0">
                      <span className="text-lg">{s.icon}</span>
                      <span className="text-xs text-gray-400 font-bold">{s.label}</span>
                    </div>
                    <div className="flex-1 bg-gray-800 rounded-full h-7 relative overflow-hidden">
                      <div
                        className={`${s.color} h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2`}
                        style={{ width: `${Math.max(2, parseFloat(pct))}%` }}
                      >
                        <span className="text-white text-[10px] font-black">{count}</span>
                      </div>
                    </div>
                    <span className="text-gray-400 text-xs font-bold w-14 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rankings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RankingCard title="Destinos Mais Pesquisados" icon="📍" items={data.topDestinations || []} valueLabel="pesquisas" />
            <RankingCard title="Veículos Mais Selecionados" icon="🚗" items={data.topCars || []} valueLabel="seleções" />
          </div>

          <RankingCard title="Extras & Proteções Mais Populares" icon="🛡️" items={data.topExtras || []} valueLabel="seleções" />

          {/* Abandonment Analysis */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-white font-bold flex items-center gap-2 mb-4">📉 Análise de Desistência</h3>
            <p className="text-xs text-gray-500 mb-4">Onde os clientes desistem e possíveis motivos.</p>
            <div className="space-y-4">
              {(data.abandonReasons || []).map((reason: any, i: number) => (
                <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{STEP_LABELS[reason.step]?.icon}</span>
                      <span className="text-white font-bold text-sm">{reason.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-red-400 font-black text-lg">{reason.count}</span>
                      <span className="text-gray-500 text-xs font-bold bg-gray-800 px-2 py-0.5 rounded">{reason.percent}%</span>
                    </div>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed">{reason.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Methods Distribution */}
          {data.paymentMethods && Object.keys(data.paymentMethods).length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-white font-bold flex items-center gap-2 mb-4">💳 Meios de Pagamento (Concluídas)</h3>
              <div className="flex flex-wrap gap-4">
                {Object.entries(data.paymentMethods).map(([method, count]) => {
                  const icons: Record<string, string> = { CREDIT: "💳", PIX: "📱", BALCAO: "🏪" };
                  const labels: Record<string, string> = { CREDIT: "Cartão de Crédito", PIX: "PIX", BALCAO: "Pagar no Balcão" };
                  return (
                    <div key={method} className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 text-center min-w-[120px]">
                      <p className="text-2xl mb-1">{icons[method] || "💰"}</p>
                      <p className="text-white font-black text-lg">{count as number}</p>
                      <p className="text-gray-500 text-xs font-bold">{labels[method] || method}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <SalesComparisonSection />
        </>
      ) : (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
          <p className="text-red-400 font-bold">Erro ao carregar dados.</p>
        </div>
      )}
    </div>
  );
}
