"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

type FilterType = 'ALL' | 'PIX' | 'CREDIT_CARD' | 'BALCAO' | 'PIX_PENDING';
type CommissionBase = 'VENDA' | 'MARKUP' | 'NET';

const FILTER_OPTIONS: { key: FilterType; label: string; emoji: string; color: string; active: string }[] = [
   { key: 'ALL',         label: 'Todos',           emoji: '📋', color: 'text-gray-400  border-gray-700 bg-gray-800/50',         active: 'text-white    border-white      bg-gray-700' },
   { key: 'PIX',         label: 'PIX (Efetivado)', emoji: '📱', color: 'text-emerald-400 border-emerald-800 bg-emerald-900/20', active: 'text-white    border-emerald-500 bg-emerald-700' },
   { key: 'CREDIT_CARD', label: 'Cartão Crédito',  emoji: '💳', color: 'text-blue-400  border-blue-800  bg-blue-900/20',         active: 'text-white    border-blue-500   bg-blue-700' },
   { key: 'BALCAO',      label: 'Pagto. Balcão',   emoji: '🏢', color: 'text-yellow-400 border-yellow-800 bg-yellow-900/20',    active: 'text-white    border-yellow-500 bg-yellow-700' },
   { key: 'PIX_PENDING', label: 'PIX Pendente',    emoji: '⏳', color: 'text-amber-400 border-amber-800 bg-amber-900/20',        active: 'text-white    border-amber-500  bg-amber-700' },
];

const BASE_OPTIONS: { key: CommissionBase; label: string; hint: string }[] = [
   { key: 'VENDA',  label: 'Valor da venda (pago)', hint: 'Percentual sobre o valor cobrado do cliente' },
   { key: 'MARKUP', label: 'Markup aplicado',       hint: 'Percentual sobre o markup (lucro acima do NET)' },
   { key: 'NET',    label: 'Tarifa NET (API)',      hint: 'Percentual sobre a tarifa NET capturada do XRS' },
];

function fmt(v: number) {
   return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function toISODate(d: Date) {
   const p = (n: number) => String(n).padStart(2, '0');
   return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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
   const [base, setBase]           = useState<CommissionBase>('VENDA');

   useEffect(() => {
      try {
         const saved = localStorage.getItem('comissoes_base') as CommissionBase | null;
         if (saved && BASE_OPTIONS.some(o => o.key === saved)) setBase(saved);
      } catch { /* ignore */ }
   }, []);

   const changeBase = (b: CommissionBase) => {
      setBase(b);
      try { localStorage.setItem('comissoes_base', b); } catch { /* ignore */ }
   };

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
            else          { setData(d); setRateInput(prev => prev === "" ? String(d.rate) : prev); }
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
         if (!res.ok) alert("Erro ao salvar taxa");
      } catch { alert("Erro de conexão"); }
      finally { setSavingRate(false); }
   };

   const setPreset = (preset: 'today' | '7d' | '30d' | 'month' | 'clear') => {
      const now = new Date();
      if (preset === 'clear') { setStartDate(""); setEndDate(""); return; }
      const start = new Date(now);
      if (preset === '7d') start.setDate(now.getDate() - 6);
      if (preset === '30d') start.setDate(now.getDate() - 29);
      if (preset === 'month') start.setDate(1);
      setStartDate(toISODate(start));
      setEndDate(toISODate(now));
   };

   // ── Comissão calculada ao vivo (percentual digitado × base escolhida) ──
   const rateNum = useMemo(() => {
      const n = parseFloat(String(rateInput).replace(',', '.'));
      return isNaN(n) || n < 0 ? 0 : n;
   }, [rateInput]);

   const baseValue = useCallback((r: any): number => {
      if (base === 'MARKUP') return r.markupBRL || 0;
      if (base === 'NET')    return r.netBRL || 0;
      return r.valorCalculado || 0;
   }, [base]);

   const commissionOf = useCallback((r: any) => baseValue(r) * (rateNum / 100), [baseValue, rateNum]);

   // ── Filtragem e totais derivados ────────────────────────────────────
   const filtered = useMemo(() => {
      if (!data?.reservations) return [];
      if (filter === 'ALL') return data.reservations;
      return data.reservations.filter((r: any) => r.tipoPagamento === filter);
   }, [data, filter]);

   // Totais consideram só vendas efetivadas (PIX pendente fica de fora)
   const filteredTotals = useMemo(() => {
      return filtered.reduce(
         (acc: { vendas: number; net: number; markup: number; desconto: number; markupLiq: number; comissao: number; count: number; estimadas: number }, r: any) => {
            if (!r.isEfetivada) return acc;
            return {
               vendas:    acc.vendas   + (r.valorCalculado || 0),
               net:       acc.net      + (r.netBRL || 0),
               markup:    acc.markup   + (r.markupBRL || 0),
               desconto:  acc.desconto + (r.descontoCupom || 0),
               markupLiq: acc.markupLiq + (r.markupLiquidoBRL || 0),
               comissao:  acc.comissao + commissionOf(r),
               count:     acc.count + 1,
               estimadas: acc.estimadas + (r.netSource === 'ESTIMADO' ? 1 : 0),
            };
         },
         { vendas: 0, net: 0, markup: 0, desconto: 0, markupLiq: 0, comissao: 0, count: 0, estimadas: 0 }
      );
   }, [filtered, commissionOf]);

   const exportCsv = () => {
      const header = ['Reserva', 'Data', 'Cliente', 'Tipo', 'Valor Venda (BRL)', 'NET (BRL)', 'NET (moeda local)', 'Moeda', 'Markup %', 'Markup (BRL)', 'Cupom', 'Desconto cupom (BRL)', 'Markup liquido (BRL)', `Comissao (${rateNum}% s/ ${base})`, 'Origem NET/Markup'];
      const lines = filtered.map((r: any) => {
         let p: any = {};
         try { p = JSON.parse(r.customerData); } catch { /* ignore */ }
         const n = (v: number | null | undefined) => (v == null ? '' : v.toFixed(2).replace('.', ','));
         return [
            r.resNumber || '', new Date(r.createdAt).toLocaleDateString('pt-BR'), `${p?.nome || ''} ${p?.sobrenome || ''}`.trim(),
            r.tipoPagamento, n(r.valorCalculado), n(r.netBRL), n(r.netLocal), r.netCurrency || '',
            r.markupPercent == null ? '' : String(r.markupPercent).replace('.', ','), n(r.markupBRL), r.cupom || '', n(r.descontoCupom), n(r.markupLiquidoBRL), n(commissionOf(r)),
            r.netSource === 'XRS_QUOTE' ? 'API (registrado)' : r.netSource === 'ESTIMADO' ? 'Estimado' : '',
         ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';');
      });
      const blob = new Blob(['\uFEFF' + [header.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comissoes_${startDate || 'inicio'}_${endDate || 'hoje'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
   };

   const baseLabel = BASE_OPTIONS.find(o => o.key === base)?.label;

   return (
      <div className="space-y-8">
         {/* Header */}
         <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div>
               <h1 className="text-2xl font-black text-white flex items-center gap-2">💰 Relatório de Comissões</h1>
               <p className="text-gray-400 text-sm mt-1">Vendas com tarifa NET (capturada da API), markup aplicado e comissão (reservas canceladas não são contabilizadas)</p>
            </div>
            <button
               onClick={exportCsv}
               disabled={!data || filtered.length === 0}
               className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 border border-gray-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors self-start xl:self-auto"
            >
               ⬇️ Exportar CSV
            </button>
         </div>

         {/* Controles: Comissão e Período */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
               <h2 className="text-sm font-bold text-white">Cálculo da Comissão</h2>
               <form onSubmit={handleSaveRate} className="flex gap-3">
                  <div className="relative flex-1">
                     <input
                        type="number" step="0.01" min="0" value={rateInput}
                        onChange={e => setRateInput(e.target.value)} placeholder="Ex: 10.5"
                        className="bg-gray-800 border border-gray-700 rounded-lg pl-4 pr-9 py-2 text-white text-sm focus:outline-none focus:border-green-600 w-full"
                     />
                     <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                  </div>
                  <button type="submit" disabled={savingRate} className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-lg text-sm transition-colors">
                     {savingRate ? "Salvando..." : "Salvar como padrão"}
                  </button>
               </form>
               <div>
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">Calcular a comissão sobre</p>
                  <div className="flex flex-wrap gap-2">
                     {BASE_OPTIONS.map(o => (
                        <button
                           key={o.key}
                           type="button"
                           title={o.hint}
                           onClick={() => changeBase(o.key)}
                           className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${base === o.key ? 'bg-emerald-700 border-emerald-500 text-white' : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:text-white'}`}
                        >
                           {o.label}
                        </button>
                     ))}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-2">O cálculo é atualizado na hora enquanto você digita. &quot;Salvar como padrão&quot; só guarda o percentual para a próxima visita.</p>
               </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
               <h2 className="text-sm font-bold text-white">Período de Vendas</h2>
               <div className="flex gap-3">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-green-600 flex-1" />
                  <input type="date" value={endDate}   onChange={e => setEndDate(e.target.value)}   className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-green-600 flex-1" />
               </div>
               <div className="flex flex-wrap gap-2">
                  {([['today', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias'], ['month', 'Este mês'], ['clear', 'Tudo']] as const).map(([k, label]) => (
                     <button key={k} type="button" onClick={() => setPreset(k)} className="px-3 py-1 rounded-lg border border-gray-700 bg-gray-800/60 text-gray-300 hover:text-white text-xs font-bold transition-colors">
                        {label}
                     </button>
                  ))}
               </div>
               <p className="text-[11px] text-gray-500">Filtra pela data em que a venda foi realizada (horário de Brasília).</p>
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

               {/* ── Somatória ───────────────────────────────────────── */}
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
                     <div className="absolute top-3 right-3 text-2xl opacity-30">💵</div>
                     <p className="text-white/70 text-xs font-bold uppercase tracking-wide">
                        Total em Vendas {filter !== 'ALL' && <span className="normal-case">(filtrado)</span>}
                     </p>
                     <p className="text-2xl font-black text-white mt-2">{fmt(filteredTotals.vendas)}</p>
                     <p className="text-[11px] text-indigo-200 mt-1">{filteredTotals.count} reservas efetivadas</p>
                  </div>
                  <div className="bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
                     <div className="absolute top-3 right-3 text-2xl opacity-30">🧾</div>
                     <p className="text-white/70 text-xs font-bold uppercase tracking-wide">Total NET (API)</p>
                     <p className="text-2xl font-black text-white mt-2">{fmt(filteredTotals.net)}</p>
                     <p className="text-[11px] text-slate-300 mt-1">Tarifa do veículo capturada do XRS</p>
                  </div>
                  <div className="bg-gradient-to-br from-fuchsia-600 to-purple-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
                     <div className="absolute top-3 right-3 text-2xl opacity-30">📈</div>
                     <p className="text-white/70 text-xs font-bold uppercase tracking-wide">Total Markup</p>
                     <p className="text-2xl font-black text-white mt-2">{fmt(filteredTotals.markup)}</p>
                     <p className="text-[11px] text-purple-200 mt-1">
                        {filteredTotals.net > 0 ? `${((filteredTotals.markup / filteredTotals.net) * 100).toFixed(2).replace('.', ',')}% médio sobre o NET` : 'Sem NET registrado'}
                     </p>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
                     <div className="absolute top-3 right-3 text-2xl opacity-30">🤑</div>
                     <p className="text-white/70 text-xs font-bold uppercase tracking-wide">
                        Comissão {filter !== 'ALL' && <span className="normal-case">(filtrado)</span>}
                     </p>
                     <p className="text-2xl font-black text-white mt-2">{fmt(filteredTotals.comissao)}</p>
                     <p className="text-[11px] text-emerald-200 mt-1">{rateNum}% sobre {baseLabel?.toLowerCase()}</p>
                  </div>
               </div>

               {filteredTotals.estimadas > 0 && (
                  <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-4 text-xs text-sky-200">
                     ℹ️ {filteredTotals.estimadas} reserva(s) são anteriores ao registro automático de NET/markup. Para elas o valor aparece com <strong>~</strong> e é uma
                     estimativa (calculada a partir da cotação salva e do valor cobrado). As novas vendas gravam o NET e o markup reais no momento da reserva.
                  </div>
               )}

               {/* Resumo por tipo de pagamento */}
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-emerald-950/80 to-gray-900 border border-emerald-800/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
                     <div className="absolute top-3 right-3 text-2xl opacity-40">📱</div>
                     <p className="text-emerald-400 text-xs font-bold uppercase tracking-wide">PIX Efetivado ({data.grouped.PIX?.count || 0})</p>
                     <p className="text-xl font-black text-emerald-300 mt-2">{fmt(data.grouped.PIX?.vendas || 0)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-950/80 to-gray-900 border border-blue-800/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
                     <div className="absolute top-3 right-3 text-2xl opacity-40">💳</div>
                     <p className="text-blue-400 text-xs font-bold uppercase tracking-wide">Cartão ({data.grouped.CREDIT_CARD?.count || 0})</p>
                     <p className="text-xl font-black text-blue-300 mt-2">{fmt(data.grouped.CREDIT_CARD?.vendas || 0)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-950/80 to-gray-900 border border-amber-800/50 rounded-xl p-5 shadow-lg relative overflow-hidden">
                     <div className="absolute top-3 right-3 text-2xl opacity-40">🏢</div>
                     <p className="text-amber-400 text-xs font-bold uppercase tracking-wide">Balcão ({data.grouped.BALCAO?.count || 0})</p>
                     <p className="text-xl font-black text-amber-300 mt-2">{fmt(data.grouped.BALCAO?.vendas || 0)}</p>
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
                              Volume potencial: {fmt(data.grouped.PIX_PENDING.vendas)} (não entra nas somatórias)
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
                              <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tipo</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Valor Venda</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tarifa</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-slate-300 uppercase tracking-wider text-right">NET (API)</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-purple-300 uppercase tracking-wider text-right">Markup %</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-purple-300 uppercase tracking-wider text-right">Markup R$</th>
                               <th className="px-5 py-4 text-[10px] font-bold text-orange-300 uppercase tracking-wider text-right">Desc. Cupom</th>
                               <th className="px-5 py-4 text-[10px] font-bold text-purple-200 uppercase tracking-wider text-right">Markup Líq.</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-emerald-400 uppercase tracking-wider text-right">Comissão ({rateNum}%)</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                           {filtered.length === 0 ? (
                              <tr><td colSpan={11} className="text-center py-10 text-gray-500">Nenhuma reserva para este filtro.</td></tr>
                           ) : (
                              filtered.map((res: any) => {
                                 let parsed: any = {};
                                 try { parsed = JSON.parse(res.customerData); } catch(e){}
                                 const est = res.netSource === 'ESTIMADO';
                                 const pending = res.tipoPagamento === 'PIX_PENDING';
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
                                          <div className="font-bold text-gray-300">{fmt(res.valorCalculado)}</div>
                                       </td>
                                       <td className="px-5 py-4">
                                          {res.tarifa ? (
                                             <>
                                                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${res.tarifa === 'POA' ? 'bg-gray-500/20 text-gray-300 border-gray-500/30' : 'bg-purple-500/20 text-purple-300 border-purple-500/30'}`}>
                                                   {res.tarifa === 'POA' ? 'POA · sem markup' : res.tarifa === 'ETO_ZERO' ? 'ETO franquia zero' : 'ETO · pagar agora'}
                                                </span>
                                                {res.tarifa !== 'POA' && res.markupBRL === 0 && (
                                                   <div className="text-[9px] text-red-400 font-bold mt-1">⚠️ ETO sem markup</div>
                                                )}
                                             </>
                                          ) : <span className="text-gray-600">—</span>}
                                          <div className="text-[10px] text-gray-500 mt-1">{res.estacao || ''}{res.cupom ? ` · cupom ${res.cupom}` : ''}</div>
                                       </td>
                                       <td className="px-5 py-4 text-right" title={est ? 'Estimado: reserva anterior ao registro automático do NET' : 'NET capturado da API no momento da reserva'}>
                                          {res.netBRL == null ? (
                                             <span className="text-gray-600">—</span>
                                          ) : (
                                             <>
                                                <div className="font-bold text-slate-200">{est && '~'}{fmt(res.netBRL)}</div>
                                                {res.netLocal != null && res.netCurrency && res.netCurrency !== 'BRL' && (
                                                   <div className="text-[10px] text-gray-500">{res.netCurrency} {res.netLocal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                                )}
                                             </>
                                          )}
                                       </td>
                                       <td className="px-5 py-4 text-right">
                                          {res.markupPercent == null ? <span className="text-gray-600">—</span> : (
                                             <span className="font-bold text-purple-300">{est && res.markupPercent > 0 && '~'}{res.markupPercent.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</span>
                                          )}
                                       </td>
                                       <td className="px-5 py-4 text-right">
                                          {res.markupBRL == null ? <span className="text-gray-600">—</span> : (
                                             <span className="font-bold text-purple-300">{est && res.markupBRL > 0 && '~'}{fmt(res.markupBRL)}</span>
                                       )}
                                       </td>
                                       <td className="px-5 py-4 text-right" title={res.cupomLabel || ''}>
                                          {res.cupom ? (
                                             <>
                                                <div className="font-bold text-orange-300">{res.descontoCupom != null ? `− ${fmt(res.descontoCupom)}` : 'valor n/d'}</div>
                                                <div className="text-[10px] text-gray-500">{res.cupom}{res.cupomLabel ? ` · ${res.cupomLabel}` : ''}</div>
                                             </>
                                          ) : <span className="text-gray-600">—</span>}
                                       </td>
                                       <td className="px-5 py-4 text-right">
                                          {res.markupLiquidoBRL == null ? <span className="text-gray-600">—</span> : (
                                             <span className="font-bold text-purple-200">{est && res.markupLiquidoBRL > 0 && '~'}{fmt(res.markupLiquidoBRL)}</span>
                                          )}
                                       </td>
                                       <td className="px-5 py-4 text-right">
                                          <div className={`font-bold ${pending ? 'text-amber-400/80 text-xs italic' : 'text-emerald-400'}`}>
                                             {fmt(commissionOf(res))}
                                             {pending && <span className="block text-[9px] uppercase tracking-wider not-italic text-amber-500 font-semibold">Aguardando Pagto</span>}
                                          </div>
                                       </td>
                                    </tr>
                                 );
                              })
                           )}
                        </tbody>
                        {filtered.length > 0 && (
                           <tfoot className="bg-gray-800/60 border-t-2 border-gray-700">
                              <tr>
                                 <td className="px-5 py-4 text-xs font-black text-white uppercase" colSpan={3}>Total ({filteredTotals.count} efetivadas)</td>
                                 <td className="px-5 py-4 text-right font-black text-white">{fmt(filteredTotals.vendas)}</td>
                                 <td />
                                 <td className="px-5 py-4 text-right font-black text-slate-200">{fmt(filteredTotals.net)}</td>
                                 <td className="px-5 py-4 text-right font-black text-purple-300">
                                    {filteredTotals.net > 0 ? `${((filteredTotals.markup / filteredTotals.net) * 100).toFixed(2).replace('.', ',')}%` : '—'}
                                 </td>
                                 <td className="px-5 py-4 text-right font-black text-purple-300">{fmt(filteredTotals.markup)}</td>
                                  <td className="px-5 py-4 text-right font-black text-orange-300">{filteredTotals.desconto > 0 ? `− ${fmt(filteredTotals.desconto)}` : '—'}</td>
                                  <td className="px-5 py-4 text-right font-black text-purple-200">{fmt(filteredTotals.markupLiq)}</td>
                                 <td className="px-5 py-4 text-right font-black text-emerald-400">{fmt(filteredTotals.comissao)}</td>
                              </tr>
                           </tfoot>
                        )}
                     </table>
                  </div>
               </div>
            </>
         )}
      </div>
   );
}
