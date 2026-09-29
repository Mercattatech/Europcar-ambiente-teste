"use client";

import { useState } from "react";

const reportTypes = [
  { value: "coupons", label: "Cupons", icon: "🎟️", desc: "Todos os cupons com estatísticas" },
  { value: "partners", label: "Parceiros", icon: "🤝", desc: "Parceiros com vendas e comissões" },
  { value: "sales", label: "Vendas por Cupom", icon: "📋", desc: "Histórico de utilizações de cupom" },
  { value: "commissions", label: "Comissões", icon: "💸", desc: "Comissões por parceiro" },
];

export default function RelatoriosPage() {
  const [type, setType] = useState("coupons");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const buildUrl = (format: string) => {
    const params = new URLSearchParams({ type, format });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/coupons/reports?${params}`;
  };

  const handlePreview = async () => {
    setLoading(true);
    try {
      const res = await fetch(buildUrl("json"));
      const data = await res.json();
      setPreview(data);
    } catch { setPreview(null); }
    setLoading(false);
  };

  const handleExportCSV = () => {
    window.open(buildUrl("csv"), "_blank");
  };

  const setDatePreset = (preset: "today" | "7d" | "thisMonth" | "lastMonth" | "all") => {
    const now = new Date();
    if (preset === "today") {
      const d = now.toISOString().slice(0, 10);
      setFrom(d);
      setTo(d);
    } else if (preset === "7d") {
      const past = new Date();
      past.setDate(past.getDate() - 7);
      setFrom(past.toISOString().slice(0, 10));
      setTo(now.toISOString().slice(0, 10));
    } else if (preset === "thisMonth") {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFrom(first.toISOString().slice(0, 10));
      setTo(last.toISOString().slice(0, 10));
    } else if (preset === "lastMonth") {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      setFrom(first.toISOString().slice(0, 10));
      setTo(last.toISOString().slice(0, 10));
    } else if (preset === "all") {
      setFrom("");
      setTo("");
    }
  };

  const inputCls = "bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-green-600 [color-scheme:dark]";

  const sum = preview?.summary || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">📑 Relatórios & Exportação</h1>
          <p className="text-gray-400 text-sm mt-1">Gere relatórios de cupons, parceiros, vendas e comissões com totais dinâmicos</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all flex items-center gap-2 shadow-lg shadow-green-900/30 hover:shadow-green-900/50"
        >
          📥 Baixar CSV
        </button>
      </div>

      {/* Report type selection */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {reportTypes.map(r => (
          <button key={r.value} onClick={() => { setType(r.value); setPreview(null); }}
            className={`p-4 rounded-xl text-left transition-all ${type === r.value ? "bg-green-600/20 border border-green-600/40 scale-[1.02]" : "bg-gray-900 border border-gray-800 hover:border-gray-700"}`}>
            <span className="text-2xl block mb-1">{r.icon}</span>
            <p className={`text-sm font-bold ${type === r.value ? "text-green-400" : "text-white"}`}>{r.label}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{r.desc}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 pb-3">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Período de Análise</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-gray-500 self-center mr-1">Atalhos:</span>
            <button onClick={() => setDatePreset("today")} className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[11px] text-gray-300 font-medium">Hoje</button>
            <button onClick={() => setDatePreset("7d")} className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[11px] text-gray-300 font-medium">7 dias</button>
            <button onClick={() => setDatePreset("thisMonth")} className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[11px] text-gray-300 font-medium">Mês Atual</button>
            <button onClick={() => setDatePreset("lastMonth")} className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[11px] text-gray-300 font-medium">Mês Anterior</button>
            <button onClick={() => setDatePreset("all")} className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[11px] text-gray-300 font-medium">Tudo</button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1">De</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 block mb-1">Até</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inputCls} />
          </div>
          <button onClick={handlePreview} disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center gap-2">
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Carregando...
              </>
            ) : (
              "🔍 Visualizar Relatório"
            )}
          </button>
          {(from || to) && (
            <button onClick={() => { setFrom(""); setTo(""); }}
              className="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold">
              Limpar Datas
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards when preview is loaded */}
      {preview && (
        <>
          {type === "sales" && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Total Vendas</p>
                <p className="text-2xl font-black text-white mt-1">{sum.totalUsages || 0}</p>
                <p className="text-[10px] text-gray-500 mt-1">{sum.activeUsages || 0} ativas · {sum.cancelledUsages || 0} canceladas</p>
              </div>
              <div className="bg-gray-900 border border-emerald-900/40 rounded-xl p-4">
                <p className="text-[10px] font-bold text-emerald-400 uppercase">Receita Líquida (Ativa)</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">
                  R$ {(sum.sumFinal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Exclui canceladas</p>
              </div>
              <div className="bg-gray-900 border border-purple-900/40 rounded-xl p-4">
                <p className="text-[10px] font-bold text-purple-400 uppercase">Descontos Concedidos</p>
                <p className="text-2xl font-black text-purple-400 mt-1">
                  R$ {(sum.sumDesconto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Valor Original: R$ {(sum.sumOriginal || 0).toFixed(2)}</p>
              </div>
              <div className="bg-gray-900 border border-blue-900/40 rounded-xl p-4">
                <p className="text-[10px] font-bold text-blue-400 uppercase">Comissões Devidas</p>
                <p className="text-2xl font-black text-blue-400 mt-1">
                  R$ {(sum.sumComissao || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">Apenas vendas ativas</p>
              </div>
              <div className="bg-gray-900 border border-red-900/40 rounded-xl p-4">
                <p className="text-[10px] font-bold text-red-400 uppercase">Vendas Canceladas</p>
                <p className="text-2xl font-black text-red-400 mt-1">{sum.cancelledUsages || 0}</p>
                <p className="text-[10px] text-red-400/80 mt-1">R$ {(sum.sumCancelledFinal || 0).toFixed(2)} não somado</p>
              </div>
            </div>
          )}

          {type === "commissions" && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Total Ativo</p>
                <p className="text-2xl font-black text-white mt-1">
                  R$ {(sum.sumTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">{sum.activeComms || 0} comissões</p>
              </div>
              <div className="bg-gray-900 border border-emerald-900/40 rounded-xl p-4">
                <p className="text-[10px] font-bold text-emerald-400 uppercase">Total Pago</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">
                  R$ {(sum.sumPaid || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-emerald-400/80 mt-1">Status: PAID</p>
              </div>
              <div className="bg-gray-900 border border-amber-900/40 rounded-xl p-4">
                <p className="text-[10px] font-bold text-amber-400 uppercase">Pendente / Disponível</p>
                <p className="text-2xl font-black text-amber-400 mt-1">
                  R$ {(sum.sumPending || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-amber-400/80 mt-1">Aguardando pagamento</p>
              </div>
              <div className="bg-gray-900 border border-red-900/40 rounded-xl p-4">
                <p className="text-[10px] font-bold text-red-400 uppercase">Canceladas</p>
                <p className="text-2xl font-black text-red-400 mt-1">{sum.cancelledComms || 0}</p>
                <p className="text-[10px] text-red-400/80 mt-1">R$ {(sum.sumCancelled || 0).toFixed(2)} canceladas</p>
              </div>
            </div>
          )}

          {type === "partners" && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Total Parceiros</p>
                <p className="text-2xl font-black text-white mt-1">{sum.totalPartners || 0}</p>
              </div>
              <div className="bg-gray-900 border border-indigo-900/40 rounded-xl p-4">
                <p className="text-[10px] font-bold text-indigo-400 uppercase">Total Vendas</p>
                <p className="text-2xl font-black text-indigo-400 mt-1">{sum.totalVendas || 0}</p>
              </div>
              <div className="bg-gray-900 border border-emerald-900/40 rounded-xl p-4">
                <p className="text-[10px] font-bold text-emerald-400 uppercase">Receita Gerada</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">
                  R$ {(sum.totalReceita || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-gray-900 border border-blue-900/40 rounded-xl p-4">
                <p className="text-[10px] font-bold text-blue-400 uppercase">Comissões Acumuladas</p>
                <p className="text-2xl font-black text-blue-400 mt-1">
                  R$ {(sum.totalComissao || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          )}

          {type === "coupons" && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Total Cupons</p>
                <p className="text-2xl font-black text-white mt-1">{sum.totalCoupons || 0}</p>
              </div>
              <div className="bg-gray-900 border border-emerald-900/40 rounded-xl p-4">
                <p className="text-[10px] font-bold text-emerald-400 uppercase">Cupons Ativos</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">{sum.activeCoupons || 0}</p>
              </div>
              <div className="bg-gray-900 border border-blue-900/40 rounded-xl p-4">
                <p className="text-[10px] font-bold text-blue-400 uppercase">Total de Utilizações</p>
                <p className="text-2xl font-black text-blue-400 mt-1">{sum.totalUsages || 0}</p>
              </div>
            </div>
          )}

          {/* Table Preview */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {reportTypes.find(r => r.value === type)?.icon} {preview.total} registros encontrados
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Preview com totais consolidados</p>
              </div>
              <button onClick={handleExportCSV} className="text-xs text-green-400 font-bold hover:underline flex items-center gap-1">
                📥 Baixar Planilha Completa (CSV)
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-gray-500 uppercase border-b border-gray-800">
                    {preview.data.length > 0 && Object.keys(preview.data[0]).map((key: string) => (
                      <th key={key} className="text-left py-2 px-3">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {preview.data.slice(0, 50).map((row: any, i: number) => {
                    const isCancelled = row.Status === "CANCELLED" || row.Status === "REFUNDED";
                    return (
                      <tr key={i} className={`hover:bg-gray-800/30 transition-colors ${isCancelled ? "bg-red-950/15 opacity-70" : ""}`}>
                        {Object.entries(row).map(([k, val]: [string, any], j: number) => (
                          <td key={j} className="py-2.5 px-3 text-gray-300 text-xs max-w-[200px] truncate">
                            {isCancelled && (k.includes("Valor") || k.includes("Comissao")) ? (
                              <span className="line-through text-red-400">{String(val)}</span>
                            ) : k === "Status" && isCancelled ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                                {String(val)}
                              </span>
                            ) : (
                              String(val)
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>

                {/* Footer Totals */}
                {type === "sales" && sum.activeUsages !== undefined && (
                  <tfoot className="bg-gray-800/90 border-t-2 border-gray-700 text-white font-bold text-xs">
                    <tr>
                      <td className="py-3 px-3 uppercase text-gray-400" colSpan={4}>
                        TOTAL ATIVO ({sum.activeUsages} vendas ativas)
                      </td>
                      <td className="py-3 px-3 text-gray-300">
                        R$ {(sum.sumOriginal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-purple-400">
                        R$ {(sum.sumDesconto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-emerald-400 font-black">
                        R$ {(sum.sumFinal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-blue-400">
                        R$ {(sum.sumComissao || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-[10px] text-gray-400">
                        {sum.cancelledUsages > 0 ? (
                          <span className="text-red-400 font-normal">
                            * {sum.cancelledUsages} cancelada(s) (R$ {(sum.sumCancelledFinal || 0).toFixed(2)}) excluídas
                          </span>
                        ) : "100% ativas"}
                      </td>
                    </tr>
                  </tfoot>
                )}

                {type === "commissions" && sum.sumTotal !== undefined && (
                  <tfoot className="bg-gray-800/90 border-t-2 border-gray-700 text-white font-bold text-xs">
                    <tr>
                      <td className="py-3 px-3 uppercase text-gray-400" colSpan={3}>
                        TOTAL ATIVO ({sum.activeComms} comissões)
                      </td>
                      <td className="py-3 px-3 text-emerald-400 font-black">
                        R$ {(sum.sumTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-gray-400" colSpan={4}>
                        Pago: R$ {(sum.sumPaid || 0).toFixed(2)} · Pendente: R$ {(sum.sumPending || 0).toFixed(2)}
                        {sum.cancelledComms > 0 && ` · Cancelado: R$ ${(sum.sumCancelled || 0).toFixed(2)}`}
                      </td>
                    </tr>
                  </tfoot>
                )}

                {type === "partners" && sum.totalVendas !== undefined && (
                  <tfoot className="bg-gray-800/90 border-t-2 border-gray-700 text-white font-bold text-xs">
                    <tr>
                      <td className="py-3 px-3 uppercase text-gray-400" colSpan={5}>
                        TOTAL PARCEIROS ({sum.totalPartners})
                      </td>
                      <td className="py-3 px-3 text-indigo-400">
                        {sum.totalVendas} vendas
                      </td>
                      <td className="py-3 px-3 text-emerald-400 font-black">
                        R$ {(sum.totalReceita || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-blue-400">
                        R$ {(sum.totalComissao || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3" colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
              {preview.data.length > 50 && (
                <p className="text-xs text-gray-500 text-center py-3">Mostrando as primeiras 50 de {preview.total} linhas. Exporte o CSV para visualizar todos os registros.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
