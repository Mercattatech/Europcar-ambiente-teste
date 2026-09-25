"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

const partnerTypes: Record<string, string> = {
  INFLUENCER: "Influenciador", COMPANY: "Empresa", INDIVIDUAL: "Pessoa Física",
  AFFILIATE: "Afiliado", EMPLOYEE: "Colaborador", CLIENT: "Cliente",
  AMBASSADOR: "Embaixador", REPRESENTATIVE: "Representante", OTHER: "Outro",
};
const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const fmtDate = (d: string) => d ? new Date(d).toLocaleString("pt-BR") : "—";

export default function DetalheParceiro() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [partner, setPartner] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "coupons" | "sales" | "commissions">("overview");

  useEffect(() => {
    fetch(`/api/partners/${id}`).then(r => r.json()).then(setPartner).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!partner) return <div className="text-center py-20 text-gray-500">Parceiro não encontrado.</div>;

  const referralLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/parceiro/${partner.referralToken}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-white mb-1">← Voltar</button>
          <h1 className="text-2xl font-black text-white">{partner.name}</h1>
          <p className="text-sm text-gray-400">{partnerTypes[partner.type] || partner.type} {partner.company ? `· ${partner.company}` : ""}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold w-fit ${partner.status === "ACTIVE" ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"}`}>
          {partner.status === "ACTIVE" ? "Ativo" : partner.status === "BLOCKED" ? "Bloqueado" : "Inativo"}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Cupons", value: partner.stats?.totalCoupons || 0, color: "text-indigo-400" },
          { label: "Vendas", value: partner.stats?.totalSales || 0, color: "text-cyan-400" },
          { label: "Receita", value: fmtBRL(partner.stats?.revenue || 0), color: "text-green-400" },
          { label: "Comissão Total", value: fmtBRL(partner.stats?.commissionTotal || 0), color: "text-pink-400" },
          { label: "Comissão Pendente", value: fmtBRL(partner.stats?.commissionPending || 0), color: "text-amber-400" },
        ].map((k, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-[11px] text-gray-500 font-bold uppercase mb-1">{k.label}</p>
            <p className={`text-xl font-black ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Contact & Link */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-2">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Contato</h3>
          {[
            { l: "E-mail", v: partner.email },
            { l: "WhatsApp", v: partner.whatsapp },
            { l: "Telefone", v: partner.phone },
            { l: "Cidade", v: partner.city ? `${partner.city}/${partner.state}` : null },
            { l: "Instagram", v: partner.instagram },
            { l: "Website", v: partner.website },
          ].filter(i => i.v).map((item, i) => (
            <div key={i} className="flex justify-between py-1 border-b border-gray-800/50">
              <span className="text-sm text-gray-500">{item.l}</span>
              <span className="text-sm font-bold text-white">{item.v}</span>
            </div>
          ))}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Portal do Parceiro</h3>
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-[11px] text-gray-500 uppercase font-bold mb-1">Link seguro</p>
            <p className="text-xs font-mono text-blue-400 break-all">{referralLink}</p>
            <button onClick={() => navigator.clipboard.writeText(referralLink)} className="mt-2 text-xs text-green-400 font-bold hover:underline">📋 Copiar</button>
          </div>
          {partner.commissionEnabled && (
            <div className="text-sm text-gray-400">
              <p>Comissão: <span className="text-white font-bold">{partner.commissionType === "PERCENTAGE" ? `${partner.commissionValue}%` : fmtBRL(partner.commissionValue || 0)}</span></p>
              <p>Base: <span className="text-white">{partner.commissionBase}</span> · Delay: <span className="text-white">{partner.commissionReleaseDelayDays || 7} dias</span></p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {([["overview", "📊 Visão Geral"], ["coupons", "🎟️ Cupons"], ["sales", "📋 Vendas"], ["commissions", "💸 Comissões"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-4 py-2.5 text-sm font-bold ${tab === key ? "text-green-400 border-b-2 border-green-500" : "text-gray-500 hover:text-white"}`}>{label}</button>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        {tab === "coupons" && (
          <div className="space-y-3">
            {(partner.coupons || []).map((c: any) => (
              <Link key={c.id} href={`/painel/cupons/${c.id}`} className="flex items-center justify-between p-3 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition-colors">
                <div>
                  <p className="text-sm font-mono font-bold text-green-400">{c.code}</p>
                  <p className="text-[11px] text-gray-500">{c.name}</p>
                </div>
                <span className="text-[11px] font-bold text-gray-400">{c.status}</span>
              </Link>
            ))}
            {(!partner.coupons || partner.coupons.length === 0) && <p className="text-gray-500 text-center py-8">Nenhum cupom vinculado.</p>}
          </div>
        )}

        {tab === "sales" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-gray-500 uppercase border-b border-gray-800">
                  <th className="text-left py-2 px-2">Data</th>
                  <th className="text-left py-2 px-2">Cupom</th>
                  <th className="text-left py-2 px-2">Original</th>
                  <th className="text-left py-2 px-2">Desconto</th>
                  <th className="text-left py-2 px-2">Pago</th>
                  <th className="text-left py-2 px-2">Comissão</th>
                  <th className="text-left py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(partner.couponUsages || []).map((u: any) => (
                  <tr key={u.id} className="border-b border-gray-800/50">
                    <td className="py-2 px-2 text-gray-400">{fmtDate(u.usedAt)}</td>
                    <td className="py-2 px-2 text-green-400 font-mono">{u.couponCodeSnapshot}</td>
                    <td className="py-2 px-2">{fmtBRL(u.originalValue)}</td>
                    <td className="py-2 px-2 text-amber-400">-{fmtBRL(u.discountAmount)}</td>
                    <td className="py-2 px-2 text-green-400 font-bold">{fmtBRL(u.finalValue)}</td>
                    <td className="py-2 px-2 text-pink-400">{fmtBRL(u.commissionAmount || 0)}</td>
                    <td className="py-2 px-2 text-[11px] font-bold">{u.status}</td>
                  </tr>
                ))}
                {(!partner.couponUsages || partner.couponUsages.length === 0) && <tr><td colSpan={7} className="py-8 text-center text-gray-500">Nenhuma venda registrada.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "commissions" && (
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
                {(partner.commissions || []).map((c: any) => (
                  <tr key={c.id} className="border-b border-gray-800/50">
                    <td className="py-2 px-2 text-gray-400">{fmtDate(c.createdAt)}</td>
                    <td className="py-2 px-2 text-green-400 font-bold">{fmtBRL(c.amount)}</td>
                    <td className="py-2 px-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${c.status === "PAID" ? "bg-green-600/20 text-green-400" : c.status === "RELEASED" ? "bg-blue-600/20 text-blue-400" : c.status === "CANCELLED" ? "bg-red-600/20 text-red-400" : "bg-gray-600/20 text-gray-400"}`}>{c.status}</span>
                    </td>
                    <td className="py-2 px-2 text-gray-400">{fmtDate(c.availableAt)}</td>
                    <td className="py-2 px-2 text-gray-400">{fmtDate(c.paidAt)}</td>
                  </tr>
                ))}
                {(!partner.commissions || partner.commissions.length === 0) && <tr><td colSpan={5} className="py-8 text-center text-gray-500">Nenhuma comissão registrada.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "overview" && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { l: "Total vendido", v: fmtBRL(partner.stats?.revenue || 0) },
              { l: "Descontos dados", v: fmtBRL(partner.stats?.discount || 0) },
              { l: "Ticket médio", v: fmtBRL(partner.stats?.ticketMedio || 0) },
              { l: "Comissão paga", v: fmtBRL(partner.stats?.commissionPaid || 0) },
              { l: "Comissão pendente", v: fmtBRL(partner.stats?.commissionPending || 0) },
              { l: "Membro desde", v: fmtDate(partner.createdAt) },
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
