"use client";

import { useState, useEffect } from "react";

const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const fmtDate = (d: string) => d ? new Date(d).toLocaleString("pt-BR") : "—";

const statusColors: Record<string, { bg: string; text: string }> = {
  FORECAST: { bg: "bg-gray-600/20", text: "text-gray-400" },
  PENDING: { bg: "bg-amber-600/20", text: "text-amber-400" },
  RELEASED: { bg: "bg-blue-600/20", text: "text-blue-400" },
  PAID: { bg: "bg-green-600/20", text: "text-green-400" },
  CANCELLED: { bg: "bg-red-600/20", text: "text-red-400" },
  REFUNDED: { bg: "bg-red-800/20", text: "text-red-500" },
};
const statusLabels: Record<string, string> = {
  FORECAST: "Prevista", PENDING: "Pendente", RELEASED: "Liberada",
  PAID: "Paga", CANCELLED: "Cancelada", REFUNDED: "Estornada",
};

export default function ComissoesPage() {
  const [data, setData] = useState<{ commissions: any[]; totals: any[] }>({ commissions: [], totals: [] });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  const fetchData = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== "ALL") params.set("status", filter);
    const res = await fetch(`/api/commissions?${params}`);
    setData(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [filter]);

  const handleAction = async (id: string, action: string) => {
    const body: any = { action };
    if (action === "pay") {
      const ref = prompt("Referência do pagamento (comprovante, nº transação):");
      if (!ref) return;
      body.paymentReference = ref;
    }
    await fetch(`/api/commissions/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    fetchData();
  };

  // Totais
  const totalByStatus = (status: string) => {
    const t = data.totals.find((t: any) => t.status === status);
    return { count: t?._count || 0, amount: t?._sum?.amount || 0 };
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-white">💸 Comissões</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Previstas", status: "FORECAST", color: "text-gray-400" },
          { label: "Pendentes", status: "PENDING", color: "text-amber-400" },
          { label: "Liberadas", status: "RELEASED", color: "text-blue-400" },
          { label: "Pagas", status: "PAID", color: "text-green-400" },
          { label: "Canceladas", status: "CANCELLED", color: "text-red-400" },
        ].map(k => {
          const t = totalByStatus(k.status);
          return (
            <div key={k.status} className="bg-gray-900 border border-gray-800 rounded-xl p-4 cursor-pointer hover:border-gray-700" onClick={() => setFilter(filter === k.status ? "ALL" : k.status)}>
              <p className="text-[11px] text-gray-500 font-bold uppercase">{k.label}</p>
              <p className={`text-lg font-black ${k.color}`}>{fmtBRL(t.amount)}</p>
              <p className="text-[11px] text-gray-500">{t.count} registros</p>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-800">
                  <th className="text-left py-3 px-4">Parceiro</th>
                  <th className="text-left py-3 px-2">Cupom</th>
                  <th className="text-left py-3 px-2">Reserva</th>
                  <th className="text-left py-3 px-2">Valor</th>
                  <th className="text-left py-3 px-2">Status</th>
                  <th className="text-left py-3 px-2">Liberação</th>
                  <th className="text-left py-3 px-2">Pagamento</th>
                  <th className="text-left py-3 px-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.commissions.map((c: any) => {
                  const sc = statusColors[c.status] || statusColors.FORECAST;
                  return (
                    <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-3 px-4 text-white font-bold">{c.partner?.name || "—"}</td>
                      <td className="py-3 px-2 text-green-400 font-mono">{c.coupon?.code || "—"}</td>
                      <td className="py-3 px-2 text-gray-400">{c.couponUsage?.resNumber || "—"}</td>
                      <td className="py-3 px-2 text-green-400 font-bold">{fmtBRL(c.amount)}</td>
                      <td className="py-3 px-2">
                        <span className={`${sc.bg} ${sc.text} px-2 py-0.5 rounded-full text-[11px] font-bold`}>{statusLabels[c.status] || c.status}</span>
                      </td>
                      <td className="py-3 px-2 text-gray-400 text-xs">{fmtDate(c.availableAt)}</td>
                      <td className="py-3 px-2 text-gray-400 text-xs">{fmtDate(c.paidAt)}</td>
                      <td className="py-3 px-2">
                        <div className="flex gap-1">
                          {(c.status === "FORECAST" || c.status === "PENDING") && (
                            <button onClick={() => handleAction(c.id, "release")} className="text-[11px] font-bold text-blue-400 px-1.5 py-0.5 rounded bg-blue-600/10">Liberar</button>
                          )}
                          {c.status === "RELEASED" && (
                            <button onClick={() => handleAction(c.id, "pay")} className="text-[11px] font-bold text-green-400 px-1.5 py-0.5 rounded bg-green-600/10">Pagar</button>
                          )}
                          {c.status !== "PAID" && c.status !== "CANCELLED" && (
                            <button onClick={() => handleAction(c.id, "cancel")} className="text-[11px] font-bold text-red-400 px-1.5 py-0.5 rounded bg-red-600/10">Cancelar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {data.commissions.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-gray-500">Nenhuma comissão registrada.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
