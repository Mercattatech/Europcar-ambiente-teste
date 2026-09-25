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

  const inputCls = "bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-green-600";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-white">📑 Relatórios & Exportação</h1>

      {/* Report type selection */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {reportTypes.map(r => (
          <button key={r.value} onClick={() => { setType(r.value); setPreview(null); }}
            className={`p-4 rounded-xl text-left transition-all ${type === r.value ? "bg-green-600/20 border border-green-600/40" : "bg-gray-900 border border-gray-800 hover:border-gray-700"}`}>
            <span className="text-2xl block mb-1">{r.icon}</span>
            <p className={`text-sm font-bold ${type === r.value ? "text-green-400" : "text-white"}`}>{r.label}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{r.desc}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div>
          <label className="text-sm font-bold text-gray-400 block mb-1">De</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="text-sm font-bold text-gray-400 block mb-1">Até</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inputCls} />
        </div>
        <button onClick={handlePreview} disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">
          {loading ? "Carregando..." : "🔍 Visualizar"}
        </button>
        <button onClick={handleExportCSV}
          className="bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors">
          📥 Exportar CSV
        </button>
      </div>

      {/* Preview */}
      {preview && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">{reportTypes.find(r => r.value === type)?.icon} {preview.total} registros</h2>
            <button onClick={handleExportCSV} className="text-xs text-green-400 font-bold hover:underline">📥 Baixar CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-gray-500 uppercase border-b border-gray-800">
                  {preview.data.length > 0 && Object.keys(preview.data[0]).map((key: string) => (
                    <th key={key} className="text-left py-2 px-2">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.data.slice(0, 50).map((row: any, i: number) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    {Object.values(row).map((val: any, j: number) => (
                      <td key={j} className="py-2 px-2 text-gray-300 text-xs max-w-[200px] truncate">{String(val)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.data.length > 50 && (
              <p className="text-xs text-gray-500 text-center py-3">Mostrando 50 de {preview.total} registros. Exporte o CSV para ver todos.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
