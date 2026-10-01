"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

type FilterType = 'ALL' | 'PIX' | 'CREDIT_CARD' | 'BALCAO' | 'PIX_PENDING';

const FILTER_OPTIONS: { key: FilterType; label: string; emoji: string; color: string; active: string }[] = [
   { key: 'ALL',         label: 'Todos',           emoji: '📋', color: 'text-gray-400  border-gray-700 bg-gray-800/50',         active: 'text-white    border-white      bg-gray-700' },
   { key: 'PIX',         label: 'PIX (Efetivado)', emoji: '📱', color: 'text-emerald-400 border-emerald-800 bg-emerald-900/20', active: 'text-white    border-emerald-500 bg-emerald-700' },
   { key: 'CREDIT_CARD', label: 'Cartão Crédito',  emoji: '💳', color: 'text-blue-400  border-blue-800  bg-blue-900/20',         active: 'text-white    border-blue-500   bg-blue-700' },
   { key: 'BALCAO',      label: 'Pagto. Balcão',   emoji: '🏢', color: 'text-yellow-400 border-yellow-800 bg-yellow-900/20',    active: 'text-white    border-yellow-500 bg-yellow-700' },
   { key: 'PIX_PENDING', label: 'PIX Pendente',    emoji: '⏳', color: 'text-amber-400 border-amber-800 bg-amber-900/20',        active: 'text-white    border-amber-500  bg-amber-700' },
];

function fmt(v: number) {
   return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function PainelComissoes() {
   const [data, setData]           = useState<any>(null);
   const [loading, setLoading]     = useState(true);
   const [error, setError]         = useState("");
   const [startDate, setStartDate] = useState("");
   const [endDate, setEndDate]     = useState("");
   const [rateInput, setRateInput] = useState("");
   const [savingRate, setSavingRate] = useState(false);
   const [filter, setFilter]       = useState<FilterType>('ALL');

   const fetchReport = useCallback(() => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate)   params.set("endDate", endDate);
      fetch(`/api/admin/comissoes?${params}`)
         .then(res => res.json())
         .then(d => {
            if (d.error) { setError(d.error); }
            else          { setData(d); setRateInput(d.rate.toString()); }
            setLoading(false);
         })
         .catch(() => { setError("Erro de conexão com o servidor"); setLoading(false); });
   }, [startDate, endDate]);

   useEffect(() => { fetchReport(); }, [fetchReport]);

   const handleSaveRate = async (e: React.FormEvent) => {
      e.preventDefault();
      setSavingRate(true);
      try {
         const res = await fetch('/api/admin/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'COMMISSION_RATE', value: rateInput })
         });
         if (res.ok) fetchReport();
         else alert("Erro ao salvar taxa");
      } catch { alert("Erro de conexão"); }
      finally { setSavingRate(false); }
   };

   // ── Filtragem e totais derivados ────────────────────────────────────
   const filtered = useMemo(() => {
      if (!data?.reservations) return [];
      if (filter === 'ALL') return data.reservations;
      return data.reservations.filter((r: any) => r.tipoPagamento === filter);
   }, [data, filter]);

   const filteredTotals = useMemo(() => {
      return filtered.reduce(
         (acc: { vendas: number; comissao: number }, r: any) => ({
            vendas:   acc.vendas   + (r.valorCalculado   || 0),
            comissao: acc.comissao + (r.comissaoCalculada || 0),
         }),
         { vendas: 0, comissao: 0 }
      );
   }, [filtered]);

   return (
      <div className="space-y-8">
         {/* Header */}
         <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div>
               <h1 className="text-2xl font-black text-white flex items-center gap-2">💰 Relatório de Comissões</h1>
               <p className="text-gray-400 text-sm mt-1">Acompanhe as vendas e comissões geradas (reservas canceladas não são contabilizadas)</p>
            </div>
         </div>

         {/* Controles: Taxa e Período */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
               <h2 className="text-sm font-bold text-white mb-3">Configuração de Taxa (%)</h2>
               <form onSubmit={handleSaveRate} className="flex gap-3">
                  <input
                     type="number" step="0.01" value={rateInput}
                     onChange={e => setRateInput(e.target.value)} placeholder="Ex: 10.5"
                     className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-green-600 flex-1"
                  />
                  <button type="submit" disabled={savingRate} className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-lg text-sm transition-colors">
                     {savingRate ? "Salvando..." : "Salvar Taxa"}
                  </button>
               </form>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
               <h2 className="text-sm font-bold text-white mb-3">Período de Vendas</h2>
               <div className="flex gap-3">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-green-600 flex-1" />
                  <input type="date" value={endDate}   onChange={e => setEndDate(e.target.value)}   className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-green-600 flex-1" />
               </div>
            </div>
         </div>

         {error && (
            <div className="bg-red-500/20 border border-red-500/50 p-4 rounded-xl text-red-400">{error}</div>
         )}

         {loading && !data ? (
            <div className="flex items-center justify-center h-64">
               <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
            </div>
         ) : data && (
            <>
               {/* ── Filtros por tipo de pagamento ─────────────────────── */}
               <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-3">Filtrar por Tipo de Transação</p>
                  <div className="flex flex-wrap gap-2">
                     {FILTER_OPTIONS.map(opt => {
                        const isActive = filter === opt.key;
                        const counts = opt.key === 'ALL'
                           ? data.reservations.length
                           : data.reservations.filter((r: any) => r.tipoPagamento === opt.key).length;
                        return (
                           <button
                              key={opt.key}
                              onClick={() => setFilter(opt.key)}
                              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all ${isActive ? opt.active : opt.color} hover:opacity-90`}
                           >
                              <span>{opt.emoji}</span>
                              <span>{opt.label}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${isActive ? 'bg-white/20' : 'bg-gray-700'}`}>
                                 {counts}
                              </span>
                           </button>
                        );
                     })}
                  </div>
               </div>

               {/* ── Cards de resumo ─────────────────────────────────── */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
                     <div className="absolute top-3 right-3 text-2xl opacity-30">💵</div>
                     <p className="text-white/70 text-xs font-bold uppercase tracking-wide">
                        Total em Vendas {filter !== 'ALL' && <span className="normal-case">(filtrado)</span>}
                     </p>
                     <p className="text-2xl font-black text-white mt-2">{fmt(filteredTotals.vendas)}</p>
                     <p className="text-[11px] text-indigo-200 mt-1">{filtered.length} reservas</p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
                     <div className="absolute top-3 right-3 text-2xl opacity-30">🤑</div>
                     <p className="text-white/70 text-xs font-bold uppercase tracking-wide">
                        Total Comissões {filter !== 'ALL' && <span className="normal-case">(filtrado)</span>}
                     </p>
                     <p className="text-2xl font-black text-white mt-2">{fmt(filteredTotals.comissao)}</p>
                     <p className="text-[11px] text-emerald-200 mt-1">Taxa: {data.rate}%</p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-950/80 to-gray-900 border border-emerald-800/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
                     <div className="absolute top-3 right-3 text-2xl opacity-40">📱</div>
                     <p className="text-emerald-400 text-xs font-bold uppercase tracking-wide">
                        PIX Efetivado ({data.grouped.PIX?.count || 0})
                     </p>
                     <p className="text-xl font-black text-emerald-300 mt-2">{fmt(data.grouped.PIX?.comissao || 0)}</p>
                     <p className="text-xs text-gray-400 mt-1">Vendas: {fmt(data.grouped.PIX?.vendas || 0)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-950/80 to-gray-900 border border-blue-800/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
                     <div className="absolute top-3 right-3 text-2xl opacity-40">💳</div>
                     <p className="text-blue-400 text-xs font-bold uppercase tracking-wide">
                        Cartão ({data.grouped.CREDIT_CARD?.count || 0})
                     </p>
                     <p className="text-xl font-black text-blue-300 mt-2">{fmt(data.grouped.CREDIT_CARD?.comissao || 0)}</p>
                     <p className="text-xs text-gray-400 mt-1">Vendas: {fmt(data.grouped.CREDIT_CARD?.vendas || 0)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-950/80 to-gray-900 border border-amber-800/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
                     <div className="absolute top-3 right-3 text-2xl opacity-40">🏢</div>
                     <p className="text-amber-400 text-xs font-bold uppercase tracking-wide">
                        Balcão ({data.grouped.BALCAO?.count || 0})
                     </p>
                     <p className="text-xl font-black text-amber-300 mt-2">{fmt(data.grouped.BALCAO?.comissao || 0)}</p>
                     <p className="text-xs text-gray-400 mt-1">Vendas: {fmt(data.grouped.BALCAO?.vendas || 0)}</p>
                  </div>
               </div>

               {data.grouped.PIX_PENDING?.count > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <span className="text-xl">⏳</span>
                        <div>
                           <p className="text-sm font-bold text-amber-300">
                              {data.grouped.PIX_PENDING.count} reserva(s) com PIX Pendente (Aguardando Pagamento)
                           </p>
                           <p className="text-xs text-amber-400/80">
                              Volume potencial: {fmt(data.grouped.PIX_PENDING.vendas)} · Comissão potencial: {fmt(data.grouped.PIX_PENDING.comissao)}
                           </p>
                        </div>
                     </div>
                     <button
                        onClick={() => setFilter('PIX_PENDING')}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors"
                     >
                        Ver Pendentes
                     </button>
                  </div>
               )}

               {/* ── Tabela de reservas (filtrada) ──────────────────────── */}
               <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                     <h3 className="font-bold text-white text-sm">
                        Detalhamento de Reservas
                        {filter !== 'ALL' && (
                           <span className="ml-2 text-[10px] font-normal text-gray-500">
                              — {FILTER_OPTIONS.find(o => o.key === filter)?.emoji} {FILTER_OPTIONS.find(o => o.key === filter)?.label}
                           </span>
                        )}
                     </h3>
                     <span className="text-xs text-gray-400">{filtered.length} reservas</span>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                        <thead className="bg-gray-800/50 border-b border-gray-700">
                           <tr>
                              <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reserva / Data</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cliente</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Valor Venda</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tipo</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-emerald-400 uppercase tracking-wider text-right">Comissão ({data.rate}%)</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                           {filtered.length === 0 ? (
                              <tr><td colSpan={5} className="text-center py-10 text-gray-500">Nenhuma reserva para este filtro.</td></tr>
                           ) : (
                              filtered.map((res: any) => {
                                 let parsed: any = {};
                                 try { parsed = JSON.parse(res.customerData); } catch(e){}
                                 return (
                                    <tr key={res.id} className="hover:bg-gray-800/30 transition-colors">
                                       <td className="px-5 py-4">
                                          <div className="font-black text-white text-sm">{res.resNumber || "—"}</div>
                                          <div className="text-[10px] text-gray-500">{new Date(res.createdAt).toLocaleDateString("pt-BR")}</div>
                                       </td>
                                       <td className="px-5 py-4">
                                          <div className="font-bold text-white">{parsed?.nome} {parsed?.sobrenome}</div>
                                          <div className="text-[10px] text-gray-500">{parsed?.cpf}</div>
                                       </td>
                                       <td className="px-5 py-4 text-right">
                                          <div className="font-bold text-gray-300">{res.valorCalculado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                                       </td>
                                       <td className="px-5 py-4">
                                          <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded inline-flex items-center gap-1 ${
                                             res.tipoPagamento === 'CREDIT_CARD' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                             res.tipoPagamento === 'PIX'         ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                             res.tipoPagamento === 'PIX_PENDING' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                                                                   'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                          }`}>
                                             {res.tipoPagamento === 'CREDIT_CARD' ? '💳 Cartão' :
                                              res.tipoPagamento === 'PIX'         ? '📱 PIX (Pago)' :
                                              res.tipoPagamento === 'PIX_PENDING' ? '⏳ PIX Pendente' :
                                                                                    '🏢 Balcão'}
                                          </span>
                                       </td>
                                       <td className="px-5 py-4 text-right">
                                          <div className={`font-bold ${res.tipoPagamento === 'PIX_PENDING' ? 'text-amber-400/80 text-xs italic' : 'text-emerald-400'}`}>
                                             {res.comissaoCalculada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                             {res.tipoPagamento === 'PIX_PENDING' && <span className="block text-[9px] uppercase tracking-wider not-italic text-amber-500 font-semibold">Aguardando Pagto</span>}
                                          </div>
                                       </td>
                                    </tr>
                                 );
                              })
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            </>
         )}
      </div>
   );
}
