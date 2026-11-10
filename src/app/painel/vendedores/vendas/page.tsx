"use client";

import { useState, useEffect, useCallback } from "react";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const STATUS: Record<string, { label: string; cls: string }> = {
   PENDING: { label: "Pendente", cls: "bg-yellow-500/20 text-yellow-400" },
   APPROVED: { label: "Aprovada", cls: "bg-blue-500/20 text-blue-400" },
   PAID: { label: "Paga", cls: "bg-green-500/20 text-green-400" },
   CANCELLED: { label: "Cancelada", cls: "bg-red-500/20 text-red-400" },
};

export default function VendasVendedores() {
   const [data, setData] = useState<any>(null);
   const [loading, setLoading] = useState(true);
   const [sellers, setSellers] = useState<any[]>([]);
   const [sellerId, setSellerId] = useState("");
   const [commissionStatus, setCommissionStatus] = useState("");
   const [startDate, setStartDate] = useState("");
   const [endDate, setEndDate] = useState("");
   const [edits, setEdits] = useState<Record<string, string>>({});
   const [savingId, setSavingId] = useState<string | null>(null);
   const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

   const isAdmin = data?.role === "ADMIN";
   const showToast = (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
   };

   const load = useCallback(async () => {
      setLoading(true);
      const p = new URLSearchParams();
      if (sellerId) p.set("sellerId", sellerId);
      if (commissionStatus) p.set("commissionStatus", commissionStatus);
      if (startDate) p.set("startDate", startDate);
      if (endDate) p.set("endDate", endDate);
      try {
         const res = await fetch(`/api/vendedor/vendas?${p}`);
         const d = await res.json();
         if (res.ok) { setData(d); setEdits({}); }
      } finally {
         setLoading(false);
      }
   }, [sellerId, commissionStatus, startDate, endDate]);

   useEffect(() => { load(); }, [load]);
   useEffect(() => {
      fetch("/api/admin/vendedores").then((r) => (r.ok ? r.json() : [])).then((d) => setSellers(Array.isArray(d) ? d : [])).catch(() => {});
   }, []);

   const patch = async (id: string, body: any, okMsg: string) => {
      setSavingId(id);
      try {
         const res = await fetch(`/api/vendedor/vendas/${id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
         });
         const d = await res.json();
         if (!res.ok) { showToast(d.error || "Erro ao salvar", "error"); return; }
         showToast(okMsg);
         load();
      } finally {
         setSavingId(null);
      }
   };

   const saveCommission = (r: any) => {
      const raw = edits[r.id];
      const v = Number(String(raw).replace(",", "."));
      if (!isFinite(v) || v < 0) { showToast("Valor inválido", "error"); return; }
      patch(r.id, { commissionAmount: v }, "Comissão atualizada!");
   };

   const rows: any[] = data?.rows || [];
   const t = data?.totals;
   const input = "bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-green-600";

   return (
      <div className="space-y-6">
         {toast && <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-xl text-sm font-bold shadow-xl ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>{toast.message}</div>}
         <div>
            <h1 className="text-2xl font-black text-white">🧾 {isAdmin ? "Vendas & Comissões dos Vendedores" : "Minhas Vendas"}</h1>
            <p className="text-sm text-gray-400 mt-1">
               {isAdmin ? "Vendas concluídas por vendedores. Edite o valor da comissão de cada venda e controle o pagamento." : "Acompanhe suas vendas e comissões."}
            </p>
         </div>

         <div className="flex flex-wrap gap-3">
            {isAdmin && (
               <select className={input} value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
                  <option value="">Todos os vendedores</option>
                  {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
               </select>
            )}
            <select className={input} value={commissionStatus} onChange={(e) => setCommissionStatus(e.target.value)}>
               <option value="">Toda comissão</option>
               {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input type="date" className={input} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <input type="date" className={input} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
         </div>

         {t && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
               {[
                  { l: "Vendas concluídas", v: String(t.salesCount), c: "text-white" },
                  { l: "Total vendido", v: fmt(t.salesTotal), c: "text-green-400" },
                  { l: "Comissão a pagar", v: fmt(t.commissionPending), c: "text-yellow-400" },
                  { l: "Comissão paga", v: fmt(t.commissionPaid), c: "text-blue-400" },
               ].map((c) => (
                  <div key={c.l} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                     <p className="text-[11px] uppercase text-gray-500 font-bold">{c.l}</p>
                     <p className={`text-xl font-black mt-1 ${c.c}`}>{c.v}</p>
                  </div>
               ))}
            </div>
         )}

         <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
               <thead>
                  <tr className="text-left text-[11px] uppercase text-gray-500 border-b border-gray-800">
                     <th className="p-4">Data</th>{isAdmin && <th className="p-4">Vendedor</th>}<th className="p-4">Reserva</th>
                     <th className="p-4">Cliente</th><th className="p-4">Total</th><th className="p-4">Comissão (R$)</th><th className="p-4">Status</th>
                  </tr>
               </thead>
               <tbody>
                  {loading && <tr><td colSpan={7} className="p-6 text-center text-gray-500">Carregando...</td></tr>}
                  {!loading && rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-gray-500">Nenhuma venda encontrada.</td></tr>}
                  {rows.map((r) => {
                     const st = STATUS[r.commissionStatus] || STATUS.PENDING;
                     const edited = edits[r.id] !== undefined;
                     return (
                        <tr key={r.id} className="border-b border-gray-800/60 text-gray-300 align-top">
                           <td className="p-4 text-xs whitespace-nowrap">{r.usedAt ? new Date(r.usedAt).toLocaleString("pt-BR") : "—"}</td>
                           {isAdmin && <td className="p-4 text-xs font-bold text-white">{r.seller?.name}</td>}
                           <td className="p-4">
                              <p className="font-mono font-bold text-white">{r.resNumber || "—"}</p>
                              <p className="text-[11px] text-gray-500">{r.paymentMethod || ""}</p>
                              {!r.sold && <p className="text-[11px] text-amber-400 font-bold">{r.reservationStatus === "PENDING_PIX" ? "Aguardando PIX" : "Sem comissão (não efetivada)"}</p>}
                           </td>
                           <td className="p-4 text-xs">{r.customerName}</td>
                           <td className="p-4 font-bold text-white whitespace-nowrap">{fmt(r.totalBRL)}</td>
                           <td className="p-4">
                              {isAdmin ? (
                                 <div className="flex items-center gap-2">
                                    <input
                                       className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-green-500"
                                       inputMode="decimal"
                                       value={edited ? edits[r.id] : r.commissionAmount.toFixed(2).replace(".", ",")}
                                       onChange={(e) => setEdits({ ...edits, [r.id]: e.target.value })}
                                    />
                                    {edited && (
                                       <button onClick={() => saveCommission(r)} disabled={savingId === r.id} className="text-xs font-bold bg-green-600 hover:bg-green-700 text-white px-2.5 py-1.5 rounded-lg">Salvar</button>
                                    )}
                                 </div>
                              ) : (
                                 <span className="font-bold text-green-400">{fmt(r.commissionAmount)}</span>
                              )}
                              {r.commissionRate != null && <p className="text-[10px] text-gray-500 mt-1">Regra: {r.commissionType === "FIXED" ? fmt(r.commissionRate) : `${r.commissionRate}%`}</p>}
                           </td>
                           <td className="p-4">
                              {isAdmin ? (
                                 <select
                                    value={r.commissionStatus}
                                    onChange={(e) => patch(r.id, { commissionStatus: e.target.value }, "Status atualizado!")}
                                    className={`text-[11px] font-bold px-2 py-1.5 rounded-lg border-0 outline-none ${st.cls}`}
                                 >
                                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k} className="bg-gray-900 text-white">{v.label}</option>)}
                                 </select>
                              ) : (
                                 <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${st.cls}`}>{st.label}</span>
                              )}
                              {r.commissionPaidAt && <p className="text-[10px] text-gray-500 mt-1">Pago em {new Date(r.commissionPaidAt).toLocaleDateString("pt-BR")}</p>}
                           </td>
                        </tr>
                     );
                  })}
               </tbody>
            </table>
         </div>
      </div>
   );
}

