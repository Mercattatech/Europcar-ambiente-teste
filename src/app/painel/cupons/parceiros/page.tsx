"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const partnerTypes: Record<string, string> = {
  INFLUENCER: "Influenciador", COMPANY: "Empresa Parceira", INDIVIDUAL: "Pessoa Física",
  AFFILIATE: "Afiliado", EMPLOYEE: "Colaborador", CLIENT: "Cliente",
  AMBASSADOR: "Embaixador", REPRESENTATIVE: "Representante", OTHER: "Outro",
};
const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

export default function ListaParceiros() {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const fetchPartners = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (typeFilter !== "ALL") params.set("type", typeFilter);
    const res = await fetch(`/api/partners?${params}`);
    setPartners(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchPartners(); }, [typeFilter]);
  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchPartners(); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-black text-white">🤝 Parceiros</h1>
        <Link href="/painel/cupons/parceiros/novo" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors w-fit">+ Novo Parceiro</Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
          <input type="text" placeholder="Buscar por nome, e-mail, CPF, CNPJ..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-green-600" />
        </form>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-white outline-none">
          <option value="ALL">Todos os tipos</option>
          {Object.entries(partnerTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-800">
                  <th className="text-left py-3 px-4">Nome</th>
                  <th className="text-left py-3 px-2">Tipo</th>
                  <th className="text-left py-3 px-2">E-mail</th>
                  <th className="text-left py-3 px-2">Cupons</th>
                  <th className="text-left py-3 px-2">Vendas</th>
                  <th className="text-left py-3 px-2">Receita</th>
                  <th className="text-left py-3 px-2">Comissão</th>
                  <th className="text-left py-3 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {partners.map(p => (
                  <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-3 px-4"><Link href={`/painel/cupons/parceiros/${p.id}`} className="text-white font-bold hover:text-green-400">{p.name}</Link></td>
                    <td className="py-3 px-2 text-gray-400">{partnerTypes[p.type] || p.type}</td>
                    <td className="py-3 px-2 text-gray-400">{p.email || "—"}</td>
                    <td className="py-3 px-2 text-gray-300">{p.stats?.coupons || 0}</td>
                    <td className="py-3 px-2 text-gray-300">{p.stats?.sales || 0}</td>
                    <td className="py-3 px-2 text-gray-300">{fmtBRL(p.stats?.revenue || 0)}</td>
                    <td className="py-3 px-2 text-gray-300">{fmtBRL(p.stats?.commissionTotal || 0)}</td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${p.status === "ACTIVE" ? "bg-green-600/20 text-green-400" : p.status === "BLOCKED" ? "bg-red-600/20 text-red-400" : "bg-gray-600/20 text-gray-400"}`}>
                        {p.status === "ACTIVE" ? "Ativo" : p.status === "BLOCKED" ? "Bloqueado" : "Inativo"}
                      </span>
                    </td>
                  </tr>
                ))}
                {partners.length === 0 && <tr><td colSpan={8} className="py-12 text-center text-gray-500">Nenhum parceiro cadastrado.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
