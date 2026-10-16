"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import ImportNetPanel from "./ImportNetPanel";

type FilterType = 'ALL' | 'ONLINE' | 'PIX' | 'CREDIT_CARD' | 'BALCAO' | 'PIX_PENDING';

// Regra: comissão = % × markup líquido (NET × margem do /painel/margem − cupom),
// gerada SOMENTE em vendas pagas no Cartão de Crédito ou PIX efetivado.
const geraComissao = (r: any) => r.tipoPagamento === 'CREDIT_CARD' || r.tipoPagamento === 'PIX';

const matchPagamento = (r: any, f: FilterType) =>
   f === 'ALL' ? true : f === 'ONLINE' ? geraComissao(r) : r.tipoPagamento === f;

const FILTER_OPTIONS: { key: FilterType; label: string; emoji: string; color: string; active: string }[] = [
   { key: 'ALL',         label: 'Todos',           emoji: '📋', color: 'text-gray-400  border-gray-700 bg-gray-800/50',         active: 'text-white    border-white      bg-gray-700' },
   { key: 'ONLINE',      label: 'Cartão + PIX (comissionáveis)', emoji: '🤑', color: 'text-teal-300 border-teal-800 bg-teal-900/20', active: 'text-white    border-teal-400   bg-teal-700' },
   { key: 'PIX',         label: 'PIX (Efetivado)', emoji: '📱', color: 'text-emerald-400 border-emerald-800 bg-emerald-900/20', active: 'text-white    border-emerald-500 bg-emerald-700' },
   { key: 'CREDIT_CARD', label: 'Cartão Crédito',  emoji: '💳', color: 'text-blue-400  border-blue-800  bg-blue-900/20',         active: 'text-white    border-blue-500   bg-blue-700' },
   { key: 'BALCAO',      label: 'Pagto. Balcão',   emoji: '🏢', color: 'text-yellow-400 border-yellow-800 bg-yellow-900/20',    active: 'text-white    border-yellow-500 bg-yellow-700' },
   { key: 'PIX_PENDING', label: 'PIX Pendente',    emoji: '⏳', color: 'text-amber-400 border-amber-800 bg-amber-900/20',        active: 'text-white    border-amber-500  bg-amber-700' },
];

// Status operacional (mesmos códigos da Gestão de Reservas). Sem status gravado = R.
const OP_STATUS: Record<string, { label: string; color: string }> = {
   R:  { label: 'On Request',        color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' },
   S:  { label: 'Sold',              color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
   CF: { label: 'Confirmed',         color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
   CC: { label: 'Cancelled',         color: 'bg-red-500/20 text-red-400 border-red-500/40' },
   CP: { label: 'Cancelled Prepaid', color: 'bg-orange-500/20 text-orange-400 border-orange-500/40' },
   CO: { label: 'Checked Out',       color: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
   TD: { label: 'Turn Down',         color: 'bg-gray-600/30 text-gray-400 border-gray-500/40' },
   NS: { label: 'No Show',           color: 'bg-gray-500/20 text-gray-500 border-gray-500/40' },
};
const opOf = (r: any): string => r.operationalStatus || 'R';

const OP_FILTER_OPTIONS: { value: string; label: string }[] = [
   { value: 'ALL', label: 'Todos' },
   { value: 'ACTIVE', label: 'Momentâneos' },
   { value: 'R',  label: 'R - On Request' },
   { value: 'S',  label: 'S - Sold' },
   { value: 'CF', label: 'CF - Confirmed' },
   { value: 'DONE', label: 'Concluídos' },
   { value: 'CC', label: 'CC - Cancelled' },
   { value: 'CP', label: 'CP - Cancelled Prepaid' },
   { value: 'CO', label: 'CO - Checked Out' },
   { value: 'TD', label: 'TD - Turn Down' },
   { value: 'NS', label: 'NS - No Show' },
];

const matchOp = (r: any, f: string) => {
   const op = opOf(r);
   if (f === 'ALL') return true;
   if (f === 'ACTIVE') return ['R', 'S', 'CF'].includes(op);
   if (f === 'DONE') return ['CC', 'CP', 'CO', 'TD', 'NS'].includes(op);
   return op === f;
};

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
   const [opFilter, setOpFilter]   = useState('ALL');
   const [backfilling, setBackfilling] = useState(false);
   const [backfillMsg, setBackfillMsg] = useState("");
   const [backfillFails, setBackfillFails] = useState<{ resNumber: string; detail: string }[]>([]);

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

   // Reconsulta no XRS o NET real das reservas antigas (em lotes) e grava NET/markup exatos
   const runBackfill = async (retry = false) => {
      setBackfilling(true);
      setBackfillFails([]);
      let updated = 0, failed = 0;
      const fails: { resNumber: string; detail: string }[] = [];
      try {
         for (let i = 0; i < 100; i++) {
            setBackfillMsg(`Consultando o XRS... ${updated} atualizadas, ${failed} com falha`);
            const res = await fetch('/api/admin/comissoes/backfill', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ retry }),
            });
            const d = await res.json();
            if (!res.ok || d.error) { setBackfillMsg(`Erro: ${d.error || res.status}`); break; }
            updated += d.updated; failed += d.failed;
            for (const r of d.results || []) if (!r.ok) fails.push({ resNumber: r.resNumber, detail: r.detail });
            if (d.remaining <= 0 || d.processed === 0) { setBackfillMsg(`Concluído: ${updated} atualizadas com valor real, ${failed} não puderam ser calculadas.`); break; }
         }
      } catch { setBackfillMsg('Erro de conexão durante o reprocessamento'); }
      setBackfillFails(fails);
      setBackfilling(false);
      fetchReport();
   };

   // Aplica a margem nominal (25%) para destravar reservas sem NET real com 1 clique
   const [applyingNominal, setApplyingNominal] = useState<string | boolean>(false);
   const handleApplyNominalMargin = async (resNumber?: string) => {
      const confirmMsg = resNumber
         ? `Deseja aplicar a margem nominal (25%) na reserva ${resNumber} para destravar o cálculo?`
         : `Deseja aplicar a margem nominal (25%) em todas as reservas sem NET real pendentes?`;
      if (!confirm(confirmMsg)) return;

      setApplyingNominal(resNumber || true);
      try {
         const res = await fetch('/api/admin/comissoes/apply-nominal-margin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(resNumber ? { resNumber } : { applyAllSemNet: true }),
         });
         const d = await res.json();
         if (!res.ok || d.error) {
            alert(`Erro: ${d.error || 'Falha ao aplicar margem'}`);
         } else {
            fetchReport();
         }
      } catch (err: any) {
         alert(`Erro de conexão: ${err.message}`);
      } finally {
         setApplyingNominal(false);
      }
   };

   // Ao abrir a tela, busca automaticamente no XRS o NET real das reservas que ainda não têm (uma vez por visita)
   const autoBackfillDone = useRef(false);
   useEffect(() => {
      if (autoBackfillDone.current || !data?.reservations) return;
      autoBackfillDone.current = true;
      if (data.reservations.some((r: any) => r.semNetReal && !r.netErro)) runBackfill(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [data]);

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

   // ── Comissão calculada ao vivo (percentual digitado × markup líquido, só Cartão/PIX) ──
   const rateNum = useMemo(() => {
      const n = parseFloat(String(rateInput).replace(',', '.'));
      return isNaN(n) || n < 0 ? 0 : n;
   }, [rateInput]);

   const commissionOf = useCallback(
      (r: any) => (geraComissao(r) ? Math.max(0, r.markupLiquidoBRL || 0) * (rateNum / 100) : 0),
      [rateNum]
   );

   // ── Filtragem e totais derivados ────────────────────────────────────
   const filtered = useMemo(() => {
      if (!data?.reservations) return [];
      return data.reservations.filter((r: any) => matchPagamento(r, filter) && matchOp(r, opFilter));
   }, [data, filter, opFilter]);

   // Totais consideram só vendas efetivadas (PIX pendente fica de fora)
   const filteredTotals = useMemo(() => {
      return filtered.reduce(
         (acc: { vendas: number; net: number; markup: number; desconto: number; markupLiq: number; comissao: number; count: number; semNet: number }, r: any) => {
            if (!r.isEfetivada) return acc;
            return {
               vendas:    acc.vendas   + (r.valorCalculado || 0),
               net:       acc.net      + (r.netBRL || 0),
               markup:    acc.markup   + (r.markupBRL || 0),
               desconto:  acc.desconto + (r.descontoCupom || 0),
               markupLiq: acc.markupLiq + (r.markupLiquidoBRL || 0),
               comissao:  acc.comissao + commissionOf(r),
               count:     acc.count + 1,
               semNet:    acc.semNet + (r.semNetReal ? 1 : 0),
            };
         },
         { vendas: 0, net: 0, markup: 0, desconto: 0, markupLiq: 0, comissao: 0, count: 0, semNet: 0 }
      );
   }, [filtered, commissionOf]);

   const exportCsv = () => {
      const header = ['Reserva', 'Data', 'Cliente', 'Tipo', 'Status operacional', 'Valor Venda (BRL)', 'NET (BRL)', 'NET (moeda local)', 'Moeda', 'Markup %', 'Markup (BRL)', 'Cupom', 'Desconto cupom (BRL)', 'Markup liquido (BRL)', `Comissao (${rateNum}% do markup liquido - so Cartao/PIX)`, 'Origem NET/Markup'];
      const lines = filtered.map((r: any) => {
         let p: any = {};
         try { p = JSON.parse(r.customerData); } catch { /* ignore */ }
         const n = (v: number | null | undefined) => (v == null ? '' : v.toFixed(2).replace('.', ','));
         return [
            r.resNumber || '', new Date(r.createdAt).toLocaleDateString('pt-BR'), `${p?.nome || ''} ${p?.sobrenome || ''}`.trim(),
            r.tipoPagamento, `${opOf(r)} - ${OP_STATUS[opOf(r)]?.label || ''}`, n(r.valorCalculado), n(r.netBRL), n(r.netLocal), r.netCurrency || '',
            r.markupPercent == null ? '' : String(r.markupPercent).replace('.', ','), n(r.markupBRL), r.cupom || '', n(r.descontoCupom), n(r.markupLiquidoBRL), n(commissionOf(r)),
            r.semNetReal ? `SEM NET REAL${r.netErro ? ` (${r.netErro})` : ''}` : r.netSource === 'XRS_QUOTE' ? 'API (registrado na venda)' : r.netSource === 'XRS_BACKFILL' ? 'API (reconsultado no XRS)' : r.netSource === 'EUROPCAR_EXTRATO' ? 'Europcar (extrato oficial)' : r.netSource === 'NOMINAL_FALLBACK' ? 'Margem Nominal (25%)' : r.netSource === 'SEM_MARKUP' ? 'Tarifa sem markup (POA)' : '',
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

   return (
      <div className="space-y-8">
         {/* Header */}
         <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div>
               <h1 className="text-2xl font-black text-white flex items-center gap-2">💰 Relatório de Comissões</h1>
               <p className="text-gray-400 text-sm mt-1">Comissão = % sobre o markup líquido (NET da API × margem do painel − cupom), somente em vendas no Cartão e PIX pago. Balcão não gera comissão; canceladas não são contabilizadas.</p>
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
                  <ul className="text-[11px] text-gray-400 space-y-1 list-disc pl-4">
                     <li>Base: <strong className="text-gray-200">markup líquido</strong> = NET (API) × margem definida em <a href="/painel/margem" className="text-emerald-400 underline">/painel/margem</a> − desconto de cupom.</li>
                     <li>Gera comissão <strong className="text-gray-200">somente Cartão de Crédito e PIX pago</strong>. Balcão e PIX pendente = R$ 0,00.</li>
                  </ul>
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
                        const counts = data.reservations.filter((r: any) => matchOp(r, opFilter) && matchPagamento(r, opt.key)).length;
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

                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mt-5 mb-3">Status Operacional</p>
                  <div className="flex flex-wrap gap-2">
                     {OP_FILTER_OPTIONS.map(opt => {
                        const isActive = opFilter === opt.value;
                        const count = data.reservations.filter((r: any) => matchPagamento(r, filter) && matchOp(r, opt.value)).length;
                        return (
                           <button
                              key={opt.value}
                              onClick={() => setOpFilter(opt.value)}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${isActive ? 'bg-purple-700/40 border-purple-400 text-white' : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:text-white'}`}
                           >
                              {opt.label} <span className="font-mono opacity-70">({count})</span>
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
                        Total em Vendas {(filter !== 'ALL' || opFilter !== 'ALL') && <span className="normal-case">(filtrado)</span>}
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
                        Comissão {(filter !== 'ALL' || opFilter !== 'ALL') && <span className="normal-case">(filtrado)</span>}
                     </p>
                     <p className="text-2xl font-black text-white mt-2">{fmt(filteredTotals.comissao)}</p>
                     <p className="text-[11px] text-emerald-200 mt-1">{rateNum}% do markup líquido · só Cartão e PIX</p>
                  </div>
               </div>

               <ImportNetPanel
                  onImported={fetchReport}
                  pendentes={(data.reservations || [])
                     .filter((r: any) => r.semNetReal && (r.tipoPagamento === 'CREDIT_CARD' || r.tipoPagamento === 'PIX'))
                     .map((r: any) => {
                        let p: any = {};
                        try { p = typeof r.customerData === 'string' ? JSON.parse(r.customerData) : (r.customerData || {}); } catch { /* ignore */ }
                        return {
                           resNumber: r.resNumber || '',
                           data: new Date(r.createdAt).toLocaleDateString('pt-BR'),
                           cliente: `${p?.nome || ''} ${p?.sobrenome || ''}`.trim(),
                           valor: r.valorCalculado || 0,
                           tipo: r.tipoPagamento,
                        };
                     })}
               />

               {(filteredTotals.semNet > 0 || backfillMsg) && (
                  <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-4 text-xs text-sky-200 space-y-3">
                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                           {filteredTotals.semNet > 0 && (
                              <p>⚠️ {filteredTotals.semNet} reserva(s) ainda <strong>sem NET real</strong>: não entram no markup nem na comissão até o NET ser obtido no XRS (Greenway).
                              A consulta roda automaticamente ao abrir esta tela; as que o XRS não responder mostram o motivo e precisam de conferência manual.</p>
                           )}
                           {backfillMsg && <p className="font-bold text-sky-100 mt-1">{backfillMsg}</p>}
                        </div>
                        <div className="flex gap-2 shrink-0">
                           <button
                              onClick={() => runBackfill(false)}
                              disabled={backfilling}
                              className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors"
                           >
                              {backfilling ? '⏳ Consultando XRS...' : '🔄 Buscar NET real no XRS'}
                           </button>
                           {backfillFails.length > 0 && !backfilling && (
                              <button onClick={() => runBackfill(true)} className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-bold px-3 py-2 rounded-lg text-xs transition-colors">
                                 Tentar de novo as falhas
                              </button>
                           )}
                           <button
                              onClick={() => handleApplyNominalMargin()}
                              disabled={!!applyingNominal || backfilling}
                              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                              title="Aplica a margem nominal (25%) em todas as reservas sem NET real para destravar a comissão"
                           >
                              {applyingNominal === true ? '⏳ Aplicando...' : '⚡ Aplicar margem nominal (25%) em lote'}
                           </button>
                        </div>
                     </div>
                     {backfillFails.length > 0 && (
                        <ul className="text-[11px] text-amber-300 list-disc pl-5 space-y-0.5">
                           {backfillFails.slice(0, 15).map(f => <li key={f.resNumber}><strong>{f.resNumber}</strong>: {f.detail}</li>)}
                           {backfillFails.length > 15 && <li>… e mais {backfillFails.length - 15}</li>}
                        </ul>
                     )}
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
                              <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status Op.</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Valor Venda</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tarifa</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-slate-300 uppercase tracking-wider text-right">NET (API)</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-purple-300 uppercase tracking-wider text-right">Markup %</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-purple-300 uppercase tracking-wider text-right">Markup R$</th>
                               <th className="px-5 py-4 text-[10px] font-bold text-orange-300 uppercase tracking-wider text-right">Desc. Cupom</th>
                               <th className="px-5 py-4 text-[10px] font-bold text-purple-200 uppercase tracking-wider text-right">Markup Líq.</th>
                              <th className="px-5 py-4 text-[10px] font-bold text-emerald-400 uppercase tracking-wider text-right">Comissão ({rateNum}% markup líq.)</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                           {filtered.length === 0 ? (
                              <tr><td colSpan={12} className="text-center py-10 text-gray-500">Nenhuma reserva para este filtro.</td></tr>
                           ) : (
                              filtered.map((res: any) => {
                                 let parsed: any = {};
                                 try { parsed = JSON.parse(res.customerData); } catch(e){}
                                 const semNet = !!res.semNetReal;
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
                                       <td className="px-5 py-4">
                                          <span className={`text-[10px] font-bold px-2 py-1 rounded border whitespace-nowrap ${OP_STATUS[opOf(res)]?.color || 'bg-gray-700 text-gray-300 border-gray-600'}`} title={OP_STATUS[opOf(res)]?.label || ''}>
                                             {opOf(res)} · {OP_STATUS[opOf(res)]?.label || 'Desconhecido'}
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
                                       <td className="px-5 py-4 text-right" title={res.netSource === 'EUROPCAR_EXTRATO' ? 'NET oficial informado pela Europcar' : res.netSource === 'XRS_BACKFILL' ? 'NET real reconsultado no XRS' : res.netSource === 'XRS_QUOTE' ? 'NET capturado da API no momento da reserva' : ''}>
                                          {semNet ? (
                                             <div className="text-[10px] font-bold text-red-400 uppercase" title={res.netErro || ''}>
                                                Sem NET real
                                                {res.netErro && <div className="normal-case font-normal text-red-300/80 max-w-[180px] ml-auto">{res.netErro}</div>}
                                                <button
                                                   type="button"
                                                   onClick={() => handleApplyNominalMargin(res.resNumber)}
                                                   disabled={applyingNominal === res.resNumber || !!applyingNominal}
                                                   className="mt-1.5 inline-block bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-2 py-0.5 rounded text-[9px] normal-case tracking-normal transition-colors cursor-pointer shadow-sm"
                                                   title="Aplica a margem nominal de 25% para calcular o NET e destravar a comissão desta reserva"
                                                >
                                                   {applyingNominal === res.resNumber ? '⏳ Aplicando...' : '⚡ Aplicar margem 25%'}
                                                </button>
                                             </div>
                                          ) : res.netBRL == null ? (
                                             <span className="text-gray-600">—</span>
                                          ) : (
                                             <>
                                                <div className="font-bold text-slate-200">
                                                   {fmt(res.netBRL)}
                                                   {res.netSource === 'NOMINAL_FALLBACK' && (
                                                      <span className="ml-1 text-[9px] font-normal text-emerald-400 bg-emerald-950/60 border border-emerald-700/50 px-1 py-0.5 rounded" title="NET calculado com margem nominal de 25%">nominal</span>
                                                   )}
                                                </div>
                                                {res.netLocal != null && res.netCurrency && res.netCurrency !== 'BRL' && (
                                                   <div className="text-[10px] text-gray-500">{res.netCurrency} {res.netLocal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                                )}
                                             </>
                                          )}
                                       </td>
                                       <td className="px-5 py-4 text-right">
                                          {res.markupPercent == null ? <span className="text-gray-600">—</span> : (
                                             <span className="font-bold text-purple-300">{res.markupPercent.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</span>
                                          )}
                                       </td>
                                       <td className="px-5 py-4 text-right">
                                          {res.markupBRL == null ? <span className="text-gray-600">—</span> : (
                                             <span className="font-bold text-purple-300">{fmt(res.markupBRL)}</span>
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
                                             <span className="font-bold text-purple-200">{fmt(res.markupLiquidoBRL)}</span>
                                          )}
                                       </td>
                                       <td className="px-5 py-4 text-right">
                                          <div className={`font-bold ${pending ? 'text-amber-400/80 text-xs italic' : geraComissao(res) ? 'text-emerald-400' : 'text-gray-500'}`}>
                                             {fmt(commissionOf(res))}
                                             {pending && <span className="block text-[9px] uppercase tracking-wider not-italic text-amber-500 font-semibold">Aguardando Pagto</span>}
                                             {res.tipoPagamento === 'BALCAO' && <span className="block text-[9px] uppercase tracking-wider text-gray-500 font-semibold">Balcão · sem comissão</span>}
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
                                 <td className="px-5 py-4 text-xs font-black text-white uppercase" colSpan={4}>Total ({filteredTotals.count} efetivadas)</td>
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
