"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
const fmtDate = (d: string) => d ? new Date(d).toLocaleString("pt-BR") : "—";

const auditActions: Record<string, string> = {
  CREATED: "Criado", UPDATED: "Editado", ACTIVATED: "Ativado", PAUSED: "Pausado",
  CLOSED: "Encerrado", BLOCKED: "Bloqueado", DUPLICATED: "Duplicado", USED: "Utilizado", CANCELLED: "Cancelado",
};

export default function DetalheCupom() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [coupon, setCoupon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"stats" | "usages" | "history">("stats");

  const fetchCoupon = async () => {
    setLoading(true);
    const res = await fetch(`/api/coupons/${id}`);
    if (res.ok) setCoupon(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchCoupon(); }, [id]);

  const handleAction = async (action: string) => {
    const statusMap: Record<string, string> = { activate: "ACTIVE", pause: "PAUSED", close: "CLOSED" };
    if (action === "close" && !confirm("Encerrar este cupom?")) return;
    await fetch(`/api/coupons/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: statusMap[action] }),
    });
    fetchCoupon();
  };

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!coupon) return <div className="text-center py-20 text-gray-500">Cupom não encontrado. <button onClick={() => router.back()} className="text-green-400">Voltar</button></div>;

  const badge = statusBadge[coupon.status] || statusBadge.CLOSED;
  const dl = coupon.discountType === "PERCENTAGE" ? `${coupon.discountValue}%` : coupon.discountType === "FIXED_VALUE" ? fmtBRL(coupon.discountValue || 0) : "100% Grátis";
  const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${coupon.code}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-white mb-1">← Voltar</button>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <span className="font-mono text-green-400">{coupon.code}</span>
            <span className={`${badge.bg} ${badge.text} px-3 py-1 rounded-full text-xs font-bold`}>{badge.label}</span>
          </h1>
          <p className="text-sm text-gray-400">{coupon.name}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {coupon.status === "DRAFT" && <button onClick={() => handleAction("activate")} className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-xl text-sm">✅ Ativar</button>}
          {coupon.status === "ACTIVE" && <button onClick={() => handleAction("pause")} className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-xl text-sm">⏸️ Pausar</button>}
          {coupon.status === "PAUSED" && <button onClick={() => handleAction("activate")} className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-xl text-sm">▶ Reativar</button>}
          {coupon.status !== "CLOSED" && <button onClick={() => handleAction("close")} className="bg-red-700 hover:bg-red-600 text-white font-bold px-4 py-2 rounded-xl text-sm">🛑 Encerrar</button>}
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Desconto", value: dl, color: "text-amber-400" },
          { label: "Utilizações", value: `${coupon.currentUses}${coupon.maxUses ? '/' + coupon.maxUses : ''}`, color: "text-cyan-400" },
          { label: "Receita", value: fmtBRL(coupon.stats?.revenue || 0), color: "text-green-400" },
          { label: "Descontos", value: fmtBRL(coupon.stats?.discount || 0), color: "text-orange-400" },
          { label: "Comissão", value: fmtBRL(coupon.stats?.commission || 0), color: "text-pink-400" },
        ].map((k, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-[11px] text-gray-500 font-bold uppercase mb-1">{k.label}</p>
            <p className={`text-xl font-black ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-gray-400 uppercase">Detalhes</h3>
          {[
            { l: "Tipo", v: coupon.couponType },
            { l: "Parceiro", v: coupon.partner?.name || "Nenhum" },
            { l: "Campanha", v: coupon.campaign || "—" },
            { l: "Acumula", v: coupon.stackable ? "Sim" : "Não" },
            { l: "Val. mínimo", v: coupon.minimumOrderValue ? fmtBRL(coupon.minimumOrderValue) : "—" },
            { l: "Desc. máximo", v: coupon.maxDiscount ? fmtBRL(coupon.maxDiscount) : "—" },
            { l: "Ticket Médio", v: fmtBRL(coupon.stats?.ticketMedio || 0) },
          ].map((item, i) => (
            <div key={i} className="flex justify-between py-1 border-b border-gray-800/50">
              <span className="text-sm text-gray-500">{item.l}</span>
              <span className="text-sm font-bold text-white">{item.v}</span>
            </div>
          ))}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-gray-400 uppercase">Período & Link</h3>
          {[
            { l: "Início", v: fmtDate(coupon.startsAt) },
            { l: "Expiração", v: coupon.hasExpiration ? fmtDate(coupon.expiresAt) : "Sem validade" },
            { l: "Criado em", v: fmtDate(coupon.createdAt) },
          ].map((item, i) => (
            <div key={i} className="flex justify-between py-1 border-b border-gray-800/50">
              <span className="text-sm text-gray-500">{item.l}</span>
              <span className="text-sm font-bold text-white">{item.v}</span>
            </div>
          ))}
          <div className="bg-gray-800 rounded-lg p-3 mt-2">
            <p className="text-[11px] text-gray-500 uppercase font-bold mb-1">Link de indicação</p>
            <p className="text-xs font-mono text-blue-400 break-all">{link}</p>
            <button onClick={() => navigator.clipboard.writeText(link)} className="mt-2 text-xs text-green-400 font-bold hover:underline">📋 Copiar link</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {([["stats", "📊 Estatísticas"], ["usages", "📋 Utilizações"], ["history", "📜 Histórico"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-4 py-2.5 text-sm font-bold transition-colors ${tab === key ? "text-green-400 border-b-2 border-green-500" : "text-gray-500 hover:text-white"}`}>{label}</button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        {tab === "usages" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-gray-500 uppercase border-b border-gray-800">
                  <th className="text-left py-2 px-2">Data</th>
                  <th className="text-left py-2 px-2">Reserva</th>
                  <th className="text-left py-2 px-2">Original</th>
                  <th className="text-left py-2 px-2">Desconto</th>
                  <th className="text-left py-2 px-2">Final</th>
                  <th className="text-left py-2 px-2">Comissão</th>
                  <th className="text-left py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(coupon.usages || []).map((u: any) => (
                  <tr key={u.id} className="border-b border-gray-800/50">
                    <td className="py-2 px-2 text-gray-400">{fmtDate(u.usedAt)}</td>
                    <td className="py-2 px-2 text-white font-mono">{u.resNumber || "—"}</td>
                    <td className="py-2 px-2 text-gray-400">{fmtBRL(u.originalValue)}</td>
                    <td className="py-2 px-2 text-amber-400">-{fmtBRL(u.discountAmount)}</td>
                    <td className="py-2 px-2 text-green-400 font-bold">{fmtBRL(u.finalValue)}</td>
                    <td className="py-2 px-2 text-pink-400">{fmtBRL(u.commissionAmount || 0)}</td>
                    <td className="py-2 px-2"><span className="text-[11px] font-bold">{u.status}</span></td>
                  </tr>
                ))}
                {(!coupon.usages || coupon.usages.length === 0) && <tr><td colSpan={7} className="py-8 text-center text-gray-500">Nenhuma utilização registrada.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-3">
            {(coupon.auditLogs || []).map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-gray-800/50">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-2 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-white">{auditActions[log.action] || log.action}</p>
                  <p className="text-[11px] text-gray-500">{fmtDate(log.createdAt)}</p>
                </div>
              </div>
            ))}
            {(!coupon.auditLogs || coupon.auditLogs.length === 0) && <p className="text-gray-500 text-center py-8">Nenhum registro de auditoria.</p>}
          </div>
        )}

        {tab === "stats" && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { l: "Total de utilizações", v: coupon.stats?.totalUses || 0 },
              { l: "Receita gerada", v: fmtBRL(coupon.stats?.revenue || 0) },
              { l: "Descontos concedidos", v: fmtBRL(coupon.stats?.discount || 0) },
              { l: "Comissão gerada", v: fmtBRL(coupon.stats?.commission || 0) },
              { l: "Ticket médio", v: fmtBRL(coupon.stats?.ticketMedio || 0) },
              { l: "Usos restantes", v: coupon.maxUses ? coupon.maxUses - coupon.currentUses : "∞" },
            ].map((item, i) => (
              <div key={i} className="bg-gray-800 rounded-xl p-4">
                <p className="text-[11px] text-gray-500 uppercase font-bold mb-1">{item.l}</p>
                <p className="text-lg font-black text-white">{item.v}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
