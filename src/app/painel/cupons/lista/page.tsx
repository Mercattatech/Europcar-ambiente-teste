"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: "bg-green-600/20", text: "text-green-400", label: "Ativo" },
  DRAFT: { bg: "bg-gray-600/20", text: "text-gray-400", label: "Rascunho" },
  SCHEDULED: { bg: "bg-blue-600/20", text: "text-blue-400", label: "Agendado" },
  PAUSED: { bg: "bg-amber-600/20", text: "text-amber-400", label: "Pausado" },
  EXPIRED: { bg: "bg-red-600/20", text: "text-red-400", label: "Expirado" },
  BLOCKED: { bg: "bg-red-800/20", text: "text-red-500", label: "Bloqueado" },
  CLOSED: { bg: "bg-gray-800/20", text: "text-gray-500", label: "Encerrado" },
};

const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

export default function ListaCupons() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const fetchCoupons = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (typeFilter !== "ALL") params.set("couponType", typeFilter);

    const res = await fetch(`/api/coupons?${params}`);
    const data = await res.json();
    setCoupons(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchCoupons(); }, [statusFilter, typeFilter]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchCoupons(); };

  const handleAction = async (id: string, action: string) => {
    const statusMap: Record<string, string> = {
      activate: "ACTIVE", pause: "PAUSED", close: "CLOSED",
    };
    if (action === "delete") {
      if (!confirm("Tem certeza que deseja encerrar este cupom?")) return;
      await fetch(`/api/coupons/${id}`, { method: "DELETE" });
    } else if (action === "duplicate") {
      const coupon = coupons.find(c => c.id === id);
      if (!coupon) return;
      await fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...coupon, code: coupon.code + "_COPIA", name: coupon.name + " (Cópia)", status: "DRAFT", id: undefined }),
      });
    } else {
      await fetch(`/api/coupons/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusMap[action] }),
      });
    }
    fetchCoupons();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-black text-white">🎟️ Todos os Cupons</h1>
        <Link href="/painel/cupons/novo" className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors w-fit">+ Novo Cupom</Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
          <input type="text" placeholder="Buscar por código, nome, parceiro..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-green-600" />
        </form>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none">
          <option value="ALL">Todos os status</option>
          {Object.entries(statusBadge).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none">
          <option value="ALL">Todos os tipos</option>
          <option value="PROMOTIONAL">Promocional</option>
          <option value="INFLUENCER">Influenciador</option>
          <option value="COMPANY">Empresa</option>
          <option value="INDIVIDUAL">Pessoa Física</option>
          <option value="AFFILIATE">Afiliado</option>
          <option value="COURTESY">Cortesia</option>
          <option value="FREE">Gratuidade</option>
          <option value="CAMPAIGN">Campanha</option>
        </select>
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
                  <th className="text-left py-3 px-4">Código</th>
                  <th className="text-left py-3 px-2">Nome</th>
                  <th className="text-left py-3 px-2">Parceiro</th>
                  <th className="text-left py-3 px-2">Desconto</th>
                  <th className="text-left py-3 px-2">Usos</th>
                  <th className="text-left py-3 px-2">Receita</th>
                  <th className="text-left py-3 px-2">Comissão</th>
                  <th className="text-left py-3 px-2">Status</th>
                  <th className="text-left py-3 px-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map(c => {
                  const badge = statusBadge[c.status] || statusBadge.CLOSED;
                  const dl = c.discountType === "PERCENTAGE" ? `${c.discountValue}%` : c.discountType === "FIXED_VALUE" ? fmtBRL(c.discountValue || 0) : "100%";
                  return (
                    <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-3 px-4"><Link href={`/painel/cupons/${c.id}`} className="font-mono font-bold text-green-400 hover:underline">{c.code}</Link></td>
                      <td className="py-3 px-2 text-white">{c.name}</td>
                      <td className="py-3 px-2 text-gray-400">{c.partner?.name || "—"}</td>
                      <td className="py-3 px-2 font-bold text-amber-400">{dl}</td>
                      <td className="py-3 px-2 text-gray-300">{c.stats?.uses || 0}{c.maxUses ? `/${c.maxUses}` : ""}</td>
                      <td className="py-3 px-2 text-gray-300">{fmtBRL(c.stats?.revenue || 0)}</td>
                      <td className="py-3 px-2 text-gray-300">{fmtBRL(c.stats?.commission || 0)}</td>
                      <td className="py-3 px-2"><span className={`${badge.bg} ${badge.text} px-2 py-0.5 rounded-full text-[11px] font-bold`}>{badge.label}</span></td>
                      <td className="py-3 px-2">
                        <div className="flex gap-1">
                          {c.status === "DRAFT" && <button onClick={() => handleAction(c.id, "activate")} className="text-[11px] font-bold text-green-400 hover:text-green-300 px-1.5 py-0.5 rounded bg-green-600/10">Ativar</button>}
                          {c.status === "ACTIVE" && <button onClick={() => handleAction(c.id, "pause")} className="text-[11px] font-bold text-amber-400 hover:text-amber-300 px-1.5 py-0.5 rounded bg-amber-600/10">Pausar</button>}
                          {c.status === "PAUSED" && <button onClick={() => handleAction(c.id, "activate")} className="text-[11px] font-bold text-green-400 hover:text-green-300 px-1.5 py-0.5 rounded bg-green-600/10">Reativar</button>}
                          <button onClick={() => handleAction(c.id, "duplicate")} className="text-[11px] font-bold text-blue-400 hover:text-blue-300 px-1.5 py-0.5 rounded bg-blue-600/10">Duplicar</button>
                          <button onClick={() => handleAction(c.id, "delete")} className="text-[11px] font-bold text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded bg-red-600/10">Encerrar</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {coupons.length === 0 && (
                  <tr><td colSpan={9} className="py-12 text-center text-gray-500">Nenhum cupom encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
