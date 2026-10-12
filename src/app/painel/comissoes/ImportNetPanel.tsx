"use client";

import { useState } from "react";

type Pendente = { resNumber: string; data: string; cliente: string; valor: number; tipo: string };

function fmt(v: number) {
   return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Aceita "1.234,56", "1234,56", "1234.56", "R$ 1.234,56" */
function parseNumberBR(s: string): number {
   let t = String(s || '').replace(/R\$|\s/g, '');
   if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
   const n = parseFloat(t);
   return isNaN(n) ? NaN : n;
}

/** Cada linha: reserva ; NET  (separador ; ou TAB, como vem do Excel). Ignora cabeçalho e linhas vazias. */
function parseLines(text: string) {
   const rows: { resNumber: string; netBRL: number }[] = [];
   const invalid: string[] = [];
   for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const parts = line.split(/\t|;/).map(p => p.trim().replace(/^"|"$/g, ''));
      if (parts.length < 2) { invalid.push(line); continue; }
      const resNumber = parts[0];
      const net = parseNumberBR(parts[parts.length === 2 ? 1 : parts.length - 1]);
      if (!/\d/.test(resNumber) || isNaN(net)) {
         if (rows.length === 0 && invalid.length === 0) continue; // cabeçalho
         invalid.push(line);
         continue;
      }
      rows.push({ resNumber, netBRL: net });
   }
   return { rows, invalid };
}

const STATUS_STYLE: Record<string, string> = {
   OK: 'text-emerald-400', GRAVADA: 'text-emerald-400', MANTIDA: 'text-sky-300', IGNORADA: 'text-gray-400', ERRO: 'text-red-400',
};

export default function ImportNetPanel({ pendentes, onImported }: { pendentes: Pendente[]; onImported: () => void }) {
   const [open, setOpen] = useState(false);
   const [text, setText] = useState("");
   const [overwrite, setOverwrite] = useState(false);
   const [busy, setBusy] = useState(false);
   const [preview, setPreview] = useState<any>(null);
   const [msg, setMsg] = useState("");
   const [invalid, setInvalid] = useState<string[]>([]);

   const exportPendentes = () => {
      const header = ['Reserva', 'Data', 'Cliente', 'Pagamento', 'Valor cobrado (BRL)', 'NET Europcar (BRL)'];
      const lines = pendentes.map(p => [p.resNumber, p.data, p.cliente, p.tipo === 'PIX' ? 'PIX' : 'Cartão', p.valor.toFixed(2).replace('.', ','), '']
         .map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
      const blob = new Blob(['\uFEFF' + [header.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'reservas_sem_net_para_europcar.csv'; a.click();
      URL.revokeObjectURL(url);
   };

   const onFile = async (f: File | undefined) => {
      if (!f) return;
      setText(await f.text());
      setPreview(null); setMsg("");
   };

   const send = async (commit: boolean) => {
      const { rows, invalid } = parseLines(text);
      setInvalid(invalid);
      if (rows.length === 0) { setMsg('Nenhuma linha válida. Formato: número da reserva ; NET em R$'); return; }
      setBusy(true); setMsg("");
      try {
         const res = await fetch('/api/admin/comissoes/import-net', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows, commit, overwrite }),
         });
         const d = await res.json();
         if (!res.ok || d.error) { setMsg(`Erro: ${d.error || res.status}`); return; }
         setPreview(d);
         if (commit) { setMsg(`✅ ${d.prontas} reserva(s) gravadas com o NET da Europcar.`); onImported(); }
      } catch { setMsg('Erro de conexão'); }
      finally { setBusy(false); }
   };

   return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
               <h2 className="text-sm font-bold text-white">📥 Importar NET oficial da Europcar</h2>
               <p className="text-[11px] text-gray-400 mt-1">
                  Para reservas sem NET real: envie a lista para a Europcar, receba o NET de cada reserva (extrato Greenway/Click4) e importe aqui.
                  Markup = valor cobrado − NET; comissão só em Cartão e PIX.
               </p>
            </div>
            <div className="flex gap-2 shrink-0">
               <button type="button" onClick={exportPendentes} disabled={pendentes.length === 0}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 border border-gray-700 text-white font-bold px-3 py-2 rounded-lg text-xs transition-colors">
                  ⬇️ Lista p/ Europcar ({pendentes.length})
               </button>
               <button type="button" onClick={() => setOpen(o => !o)}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-3 py-2 rounded-lg text-xs transition-colors">
                  {open ? 'Fechar' : 'Importar NET'}
               </button>
            </div>
         </div>

         {open && (
            <div className="space-y-3">
               <p className="text-[11px] text-gray-500">
                  Uma reserva por linha: <code className="text-gray-300">número da reserva ; NET em R$</code> (pode colar direto do Excel ou abrir o CSV devolvido pela Europcar — a última coluna é lida como NET).
               </p>
               <textarea
                  value={text}
                  onChange={e => { setText(e.target.value); setPreview(null); }}
                  rows={6}
                  placeholder={"1207704545;1.234,56\n1208101700;749,25"}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-emerald-600"
               />
               <div className="flex flex-wrap items-center gap-3">
                  <input type="file" accept=".csv,.txt" onChange={e => onFile(e.target.files?.[0])} className="text-xs text-gray-400" />
                  <label className="flex items-center gap-2 text-xs text-gray-300">
                     <input type="checkbox" checked={overwrite} onChange={e => { setOverwrite(e.target.checked); setPreview(null); }} />
                     Substituir também NET que já veio da API
                  </label>
                  <div className="flex gap-2 ml-auto">
                     <button type="button" onClick={() => send(false)} disabled={busy || !text.trim()}
                        className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 border border-gray-600 text-white font-bold px-4 py-2 rounded-lg text-xs">
                        {busy ? '...' : '1. Pré-visualizar'}
                     </button>
                     <button type="button" onClick={() => send(true)} disabled={busy || !preview || preview.commit || preview.prontas === 0}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold px-4 py-2 rounded-lg text-xs">
                        2. Confirmar e gravar
                     </button>
                  </div>
               </div>

               {msg && <p className="text-xs font-bold text-sky-200">{msg}</p>}
               {invalid.length > 0 && (
                  <p className="text-[11px] text-amber-300">⚠️ {invalid.length} linha(s) ignoradas por formato inválido: {invalid.slice(0, 3).join(' | ')}{invalid.length > 3 ? ' …' : ''}</p>
               )}

               {preview && (
                  <div className="space-y-2">
                     <p className="text-xs text-gray-300">
                        {preview.commit ? 'Gravado' : 'Pré-visualização'}: <strong>{preview.prontas}</strong> de {preview.total} prontas ·
                        comissão dessas: <strong className="text-emerald-400">{fmt(preview.comissaoTotal)}</strong> ({preview.rate}% do markup)
                     </p>
                     <div className="overflow-x-auto max-h-80 border border-gray-800 rounded-lg">
                        <table className="w-full text-xs text-left">
                           <thead className="bg-gray-800/60 sticky top-0">
                              <tr className="text-[10px] uppercase text-gray-400">
                                 <th className="px-3 py-2">Reserva</th><th className="px-3 py-2">Pagto</th>
                                 <th className="px-3 py-2 text-right">Cobrado</th><th className="px-3 py-2 text-right">NET Europcar</th>
                                 <th className="px-3 py-2 text-right">Markup</th><th className="px-3 py-2 text-right">Comissão</th>
                                 <th className="px-3 py-2">Situação</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-800/60">
                              {preview.results.map((r: any, i: number) => (
                                 <tr key={`${r.resNumber}-${i}`}>
                                    <td className="px-3 py-2 font-bold text-white">{r.resNumber}</td>
                                    <td className="px-3 py-2 text-gray-400">{r.tipo === 'CREDIT_CARD' ? 'Cartão' : r.tipo === 'PIX' ? 'PIX' : r.tipo === 'PIX_PENDING' ? 'PIX pend.' : r.tipo ? 'Balcão' : '—'}</td>
                                    <td className="px-3 py-2 text-right text-gray-300">{r.cobradoBRL != null ? fmt(r.cobradoBRL) : '—'}</td>
                                    <td className="px-3 py-2 text-right text-slate-200">
                                       {isNaN(r.netBRL) ? '—' : fmt(r.netBRL)}
                                       {r.netAtual != null && <div className="text-[10px] text-gray-500">atual {fmt(r.netAtual)}</div>}
                                    </td>
                                    <td className="px-3 py-2 text-right text-purple-300">{r.markupBRL != null ? `${fmt(r.markupBRL)} (${String(r.markupPercent).replace('.', ',')}%)` : '—'}</td>
                                    <td className="px-3 py-2 text-right text-emerald-400">{r.comissaoBRL != null ? fmt(r.comissaoBRL) : '—'}</td>
                                    <td className="px-3 py-2">
                                       <span className={`font-bold ${STATUS_STYLE[r.status] || ''}`}>{r.status}</span>
                                       {r.detail && <div className="text-[10px] text-gray-400">{r.detail}</div>}
                                       {(r.warnings || []).map((w: string) => <div key={w} className="text-[10px] text-amber-300">⚠️ {w}</div>)}
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
               )}
            </div>
         )}
      </div>
   );
}
