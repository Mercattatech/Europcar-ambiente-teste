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

const partnerTypes: Record<string, string> = {
  INFLUENCER: "Influenciador", COMPANY: "Empresa", INDIVIDUAL: "Pessoa Física",
  AFFILIATE: "Afiliado", EMPLOYEE: "Colaborador", CLIENT: "Cliente",
  AMBASSADOR: "Embaixador", REPRESENTATIVE: "Representante", OTHER: "Outro",
};

export default function CuponsDashboard() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/coupons").then(r => r.json()),
      fetch("/api/partners").then(r => r.json()),
    ]).then(([c, p]) => {
      setCoupons(Array.isArray(c) ? c : []);
      setPartners(Array.isArray(p) ? p : []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // KPIs
  const activeCoupons = coupons.filter(c => c.status === "ACTIVE").length;
  const expiredCoupons = coupons.filter(c => c.status === "EXPIRED").length;
  const pausedCoupons = coupons.filter(c => c.status === "PAUSED").length;
  const totalUses = coupons.reduce((s, c) => s + (c.stats?.uses || 0), 0);
  const totalRevenue = coupons.reduce((s, c) => s + (c.stats?.revenue || 0), 0);
  const totalDiscount = coupons.reduce((s, c) => s + (c.stats?.discount || 0), 0);
  const totalCommission = coupons.reduce((s, c) => s + (c.stats?.commission || 0), 0);
  const activePartners = partners.filter(p => p.status === "ACTIVE").length;
  const ticketMedio = totalUses > 0 ? totalRevenue / totalUses : 0;

  const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  const kpis = [
    { label: "Cupons Ativos", value: activeCoupons, icon: "✅", color: "text-green-400" },
    { label: "Cupons Pausados", value: pausedCoupons, icon: "⏸️", color: "text-amber-400" },
    { label: "Cupons Expirados", value: expiredCoupons, icon: "⏰", color: "text-red-400" },
    { label: "Total de Cupons", value: coupons.length, icon: "🎟️", color: "text-indigo-400" },
    { label: "Utilizações", value: totalUses, icon: "📊", color: "text-cyan-400" },
    { label: "Parceiros Ativos", value: activePartners, icon: "🤝", color: "text-purple-400" },
    { label: "Faturamento Bruto", value: fmtBRL(totalRevenue + totalDiscount), icon: "💰", color: "text-emerald-400" },
    { label: "Descontos Concedidos", value: fmtBRL(totalDiscount), icon: "🏷️", color: "text-orange-400" },
    { label: "Faturamento Líquido", value: fmtBRL(totalRevenue), icon: "💵", color: "text-green-400" },
    { label: "Ticket Médio", value: fmtBRL(ticketMedio), icon: "🎯", color: "text-blue-400" },
    { label: "Comissão Gerada", value: fmtBRL(totalCommission), icon: "💸", color: "text-pink-400" },
  ];

  // Top cupons
  const topCoupons = [...coupons].sort((a, b) => (b.stats?.uses || 0) - (a.stats?.uses || 0)).slice(0, 5);
  // Top parceiros
  const topPartners = [...partners].sort((a, b) => (b.stats?.revenue || 0) - (a.stats?.revenue || 0)).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">🎟️ Cupons & Parceiros</h1>
          <p className="text-sm text-gray-400 mt-1">Central de cupons, afiliados e acompanhamento de vendas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/painel/cupons/novo" className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors">
            + Novo Cupom
          </Link>
          <Link href="/painel/cupons/parceiros/novo" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors">
            + Novo Parceiro
          </Link>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-2 flex-wrap">
        {[
          { href: "/painel/cupons", label: "Dashboard", icon: "📊" },
          { href: "/painel/cupons/lista", label: "Cupons", icon: "🎟️" },
          { href: "/painel/cupons/parceiros", label: "Parceiros", icon: "🤝" },
          { href: "/painel/cupons/comissoes", label: "Comissões", icon: "💸" },
          { href: "/painel/cupons/relatorios", label: "Relatórios", icon: "📑" },
        ].map(link => (
          <Link key={link.href} href={link.href} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition-colors">
            {link.icon} {link.label}
          </Link>
        ))}
      </div>

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{kpi.icon}</span>
              <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wide">{kpi.label}</p>
            </div>
            <p className={`text-xl font-black ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Cupons */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">🏆 Top Cupons</h2>
            <Link href="/painel/cupons/lista" className="text-xs text-green-400 hover:underline font-bold">Ver todos →</Link>
          </div>
          {topCoupons.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhum cupom criado ainda.</p>
          ) : (
            <div className="space-y-3">
              {topCoupons.map((c, i) => {
                const badge = statusBadge[c.status] || statusBadge.CLOSED;
                return (
                  <Link key={c.id} href={`/painel/cupons/${c.id}`} className="flex items-center justify-between p-3 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-black text-gray-600">#{i + 1}</span>
                      <div>
                        <p className="text-sm font-bold text-white">{c.code}</p>
                        <p className="text-[11px] text-gray-500">{c.name} {c.partner ? `· ${c.partner.name}` : ""}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-400">{c.stats?.uses || 0} usos</p>
                      <p className="text-[11px] text-gray-500">{fmtBRL(c.stats?.revenue || 0)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Parceiros */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">🏆 Top Parceiros</h2>
            <Link href="/painel/cupons/parceiros" className="text-xs text-green-400 hover:underline font-bold">Ver todos →</Link>
          </div>
          {topPartners.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhum parceiro cadastrado ainda.</p>
          ) : (
            <div className="space-y-3">
              {topPartners.map((p, i) => (
                <Link key={p.id} href={`/painel/cupons/parceiros/${p.id}`} className="flex items-center justify-between p-3 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-gray-600">#{i + 1}</span>
                    <div>
                      <p className="text-sm font-bold text-white">{p.name}</p>
                      <p className="text-[11px] text-gray-500">{partnerTypes[p.type] || p.type} · {p.stats?.coupons || 0} cupons</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-400">{p.stats?.sales || 0} vendas</p>
                    <p className="text-[11px] text-gray-500">{fmtBRL(p.stats?.revenue || 0)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Coupons Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">📋 Cupons Recentes</h2>
          <Link href="/painel/cupons/novo" className="text-xs bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors">+ Novo</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-800">
                <th className="text-left py-3 px-2">Código</th>
                <th className="text-left py-3 px-2">Nome</th>
                <th className="text-left py-3 px-2">Tipo</th>
                <th className="text-left py-3 px-2">Desconto</th>
                <th className="text-left py-3 px-2">Usos</th>
                <th className="text-left py-3 px-2">Receita</th>
                <th className="text-left py-3 px-2">Status</th>
                <th className="text-left py-3 px-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {coupons.slice(0, 10).map(c => {
                const badge = statusBadge[c.status] || statusBadge.CLOSED;
                const discountLabel = c.discountType === "PERCENTAGE" ? `${c.discountValue}%`
                  : c.discountType === "FIXED_VALUE" ? fmtBRL(c.discountValue || 0)
                  : "Grátis";
                return (
                  <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-3 px-2 font-mono font-bold text-green-400">{c.code}</td>
                    <td className="py-3 px-2 text-white">{c.name}</td>
                    <td className="py-3 px-2 text-gray-400">{c.partner?.name || "—"}</td>
                    <td className="py-3 px-2 font-bold text-amber-400">{discountLabel}</td>
                    <td className="py-3 px-2 text-gray-300">{c.stats?.uses || 0}{c.maxUses ? `/${c.maxUses}` : ""}</td>
                    <td className="py-3 px-2 text-gray-300">{fmtBRL(c.stats?.revenue || 0)}</td>
                    <td className="py-3 px-2">
                      <span className={`${badge.bg} ${badge.text} px-2 py-0.5 rounded-full text-[11px] font-bold`}>{badge.label}</span>
                    </td>
                    <td className="py-3 px-2">
                      <Link href={`/painel/cupons/${c.id}`} className="text-blue-400 hover:text-blue-300 text-xs font-bold">Detalhes</Link>
                    </td>
                  </tr>
                );
              })}
              {coupons.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-gray-500">Nenhum cupom criado. <Link href="/painel/cupons/novo" className="text-green-400 hover:underline">Criar primeiro cupom →</Link></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
