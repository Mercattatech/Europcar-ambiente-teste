"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const fmtDate = (d: string) => d ? new Date(d).toLocaleString("pt-BR") : "—";

const statusLabels: Record<string, string> = {
  FORECAST: "Prevista", PENDING: "Pendente", RELEASED: "Liberada",
  PAID: "Paga", CANCELLED: "Cancelada", CONFIRMED: "Confirmada",
  COURTESY: "Cortesia",
};

export default function PortalParceiro() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"dashboard" | "sales" | "commissions" | "coupons">("dashboard");

  useEffect(() => {
    fetch(`/api/partner-portal?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Erro ao carregar dados."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md text-center">
          <span className="text-4xl mb-4 block">🚫</span>
          <h1 className="text-xl font-black text-white mb-2">Acesso Negado</h1>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const { partner, coupons, sales, commissions, stats } = data;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤝</span>
            <div>
              <h1 className="text-lg font-black text-white">Portal do Parceiro</h1>
              <p className="text-sm text-gray-400">{partner.name} {partner.tradeName ? `(${partner.tradeName})` : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-green-600/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold">Ativo</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Vendas", value: stats.totalSales, color: "text-cyan-400", icon: "📊" },
            { label: "Receita Gerada", value: fmtBRL(stats.revenue), color: "text-green-400", icon: "💰" },
            { label: "Descontos", value: fmtBRL(stats.discount), color: "text-amber-400", icon: "🏷️" },
            { label: "Comissão Total", value: fmtBRL(stats.commissionTotal), color: "text-pink-400", icon: "💸" },
            { label: "Comissão Paga", value: fmtBRL(stats.commissionPaid), color: "text-green-400", icon: "✅" },
            { label: "Comissão Pendente", value: fmtBRL(stats.commissionPending), color: "text-amber-400", icon: "⏳" },
          ].map((k, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{k.icon}</span>
                <p className="text-[10px] text-gray-500 font-bold uppercase">{k.label}</p>
              </div>
              <p className={`text-lg font-black ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-800">
          {([
            ["dashboard", "📊 Visão Geral"],
            ["coupons", "🎟️ Meus Cupons"],
            ["sales", "📋 Vendas"],
            ["commissions", "💸 Comissões"],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-bold transition-colors ${tab === key ? "text-green-400 border-b-2 border-green-500" : "text-gray-500 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">

          {/* Dashboard */}
          {tab === "dashboard" && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-white">Seus Cupons Ativos</h2>
              {coupons.length === 0 ? (
                <p className="text-gray-500 text-sm">Nenhum cupom ativo.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {coupons.map((c: any) => (
                    <div key={c.id} className="bg-gray-800 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-black text-green-400 text-lg">{c.code}</span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${c.status === "ACTIVE" ? "bg-green-600/20 text-green-400" : c.status === "PAUSED" ? "bg-amber-600/20 text-amber-400" : "bg-red-600/20 text-red-400"}`}>{c.status === "ACTIVE" ? "Ativo" : c.status === "PAUSED" ? "Pausado" : "Expirado"}</span>
                      </div>
                      <p className="text-sm text-gray-400">{c.name}</p>
                      <p className="text-sm text-white font-bold mt-1">
                        {c.discountType === "PERCENTAGE" ? `${c.discountValue}% OFF` : c.discountType === "FIXED_VALUE" ? `R$ ${c.discountValue} OFF` : "100% GRÁTIS"}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1">{c.currentUses}{c.maxUses ? `/${c.maxUses}` : ""} utilizações</p>
                    </div>
                  ))}
                </div>
              )}

              {partner.commissionEnabled && (
                <div className="bg-gray-800 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">Sua Comissão</h3>
                  <p className="text-white">
                    {partner.commissionType === "PERCENTAGE" ? `${partner.commissionValue}% por venda` : `R$ ${partner.commissionValue} por venda`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Cupons */}
          {tab === "coupons" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white">Meus Cupons</h2>
              {coupons.map((c: any) => {
                const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${c.code}`;
                return (
                  <div key={c.id} className="bg-gray-800 rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-green-400 text-xl">{c.code}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${c.status === "ACTIVE" ? "bg-green-600/20 text-green-400" : "bg-gray-600/20 text-gray-400"}`}>{c.status}</span>
                    </div>
                    <p className="text-sm text-gray-400">{c.name}</p>
                    <div className="bg-gray-900 rounded-lg p-3">
                      <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Seu link de indicação</p>
                      <p className="text-xs font-mono text-blue-400 break-all">{link}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => navigator.clipboard.writeText(c.code)} className="bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold px-3 py-2 rounded-lg">📋 Copiar Cupom</button>
                      <button onClick={() => navigator.clipboard.writeText(link)} className="bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold px-3 py-2 rounded-lg">🔗 Copiar Link</button>
                      <button onClick={() => window.open(`https://wa.me/?text=Use%20o%20cupom%20${c.code}%20no%20site%20${encodeURIComponent(link)}`, '_blank')} className="bg-green-700 hover:bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-lg">💬 WhatsApp</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sales */}
          {tab === "sales" && (
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Minhas Vendas</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-gray-500 uppercase border-b border-gray-800">
                      <th className="text-left py-2 px-2">Data</th>
                      <th className="text-left py-2 px-2">Cupom</th>
                      <th className="text-left py-2 px-2">Cliente</th>
                      <th className="text-left py-2 px-2">Original</th>
                      <th className="text-left py-2 px-2">Desconto</th>
                      <th className="text-left py-2 px-2">Pago</th>
                      <th className="text-left py-2 px-2">Comissão</th>
                      <th className="text-left py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((s: any) => (
                      <tr key={s.id} className="border-b border-gray-800/50">
                        <td className="py-2 px-2 text-gray-400">{fmtDate(s.usedAt)}</td>
                        <td className="py-2 px-2 text-green-400 font-mono">{s.couponCodeSnapshot}</td>
                        <td className="py-2 px-2 text-gray-400">{s.customerNamePartial || "—"}</td>
                        <td className="py-2 px-2">{fmtBRL(s.originalValue)}</td>
                        <td className="py-2 px-2 text-amber-400">-{fmtBRL(s.discountAmount)}</td>
                        <td className="py-2 px-2 text-green-400 font-bold">{fmtBRL(s.finalValue)}</td>
                        <td className="py-2 px-2 text-pink-400">{fmtBRL(s.commissionAmount || 0)}</td>
                        <td className="py-2 px-2 text-[11px] font-bold">{statusLabels[s.status] || s.status}</td>
                      </tr>
                    ))}
                    {sales.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-gray-500">Nenhuma venda registrada.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Commissions */}
          {tab === "commissions" && (
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Minhas Comissões</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-gray-500 uppercase border-b border-gray-800">
                      <th className="text-left py-2 px-2">Data</th>
                      <th className="text-left py-2 px-2">Valor</th>
                      <th className="text-left py-2 px-2">Status</th>
                      <th className="text-left py-2 px-2">Liberação</th>
                      <th className="text-left py-2 px-2">Pagamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((c: any) => (
                      <tr key={c.id} className="border-b border-gray-800/50">
                        <td className="py-2 px-2 text-gray-400">{fmtDate(c.createdAt)}</td>
                        <td className="py-2 px-2 text-green-400 font-bold">{fmtBRL(c.amount)}</td>
                        <td className="py-2 px-2">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${c.status === "PAID" ? "bg-green-600/20 text-green-400" : c.status === "RELEASED" ? "bg-blue-600/20 text-blue-400" : c.status === "CANCELLED" ? "bg-red-600/20 text-red-400" : "bg-gray-600/20 text-gray-400"}`}>{statusLabels[c.status] || c.status}</span>
                        </td>
                        <td className="py-2 px-2 text-gray-400">{fmtDate(c.availableAt)}</td>
                        <td className="py-2 px-2 text-gray-400">{fmtDate(c.paidAt)}</td>
                      </tr>
                    ))}
                    {commissions.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-gray-500">Nenhuma comissão registrada.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center py-6">
          <p className="text-[11px] text-gray-600">Europcar Brasil · Portal do Parceiro</p>
        </div>
      </main>
    </div>
  );
}
