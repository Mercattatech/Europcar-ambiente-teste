"use client";

import { useState, useEffect } from "react";

const OP_STATUS_CONFIG: Record<string, { label: string; description: string; color: string }> = {
   R:  { label: "R",  description: "On Request",       color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" },
   S:  { label: "S",  description: "Sold",             color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" },
   CF: { label: "CF", description: "Confirmed",        color: "bg-blue-500/20 text-blue-400 border-blue-500/40" },
   CC: { label: "CC", description: "Cancelled",        color: "bg-red-500/20 text-red-400 border-red-500/40" },
   CP: { label: "CP", description: "Cancelled Prepaid", color: "bg-orange-500/20 text-orange-400 border-orange-500/40" },
   CO: { label: "CO", description: "Checked Out",      color: "bg-purple-500/20 text-purple-400 border-purple-500/40" },
   TD: { label: "TD", description: "Turn Down",        color: "bg-gray-600/30 text-gray-400 border-gray-500/40" },
   NS: { label: "NS", description: "No Show",          color: "bg-gray-500/20 text-gray-500 border-gray-500/40" },
};

const STATUS_LABELS: Record<string, string> = {
   CONFIRMED_PREPAID: "Pago Online",
   PENDING_PIX: "PIX Pendente",
   CONFIRMED_NON_PREPAID: "Pagar no Balcão",
   CANCELLED: "Cancelada",
};

function formatDateBR(dateStr?: string): string {
   if (!dateStr || dateStr.length < 8) return "—";
   return `${dateStr.slice(6, 8)}/${dateStr.slice(4, 6)}/${dateStr.slice(0, 4)}`;
}

function formatTimeBR(timeStr?: string): string {
   if (!timeStr || timeStr.length < 4) return "";
   return `${timeStr.slice(0, 2)}:${timeStr.slice(2)}`;
}

type ReportTab = "operational" | "financial";

function getReservationMetrics(res: any, parsed: any) {
   const booking = parsed?.booking || {};
   const car = booking?.car || {};
   const opStatus = res.operationalStatus || "R";

   const isCancelled =
      ["CANCELLED", "CANCELLED_GREENWAY", "ON_REQUEST_REJECTED"].includes(res.status) ||
      ["CC", "CP", "TD"].includes(opStatus);

   let amountBRL = 0;
   if (res.amountInCents && Number(res.amountInCents) > 0) {
      amountBRL = Number(res.amountInCents) / 100;
   } else if (car?.totalRateInBookingCurrency && !isNaN(parseFloat(car.totalRateInBookingCurrency))) {
      amountBRL = parseFloat(car.totalRateInBookingCurrency);
   } else if (car?.totalRateEstimate && car?.exchangeRate && !isNaN(parseFloat(car.totalRateEstimate)) && !isNaN(parseFloat(car.exchangeRate))) {
      amountBRL = parseFloat(car.totalRateEstimate) * parseFloat(car.exchangeRate);
   }

   let amountEUR = 0;
   if (car?.totalRateEstimate && !isNaN(parseFloat(car.totalRateEstimate))) {
      amountEUR = parseFloat(car.totalRateEstimate);
   } else if (amountBRL > 0 && car?.exchangeRate && parseFloat(car.exchangeRate) > 0) {
      amountEUR = amountBRL / parseFloat(car.exchangeRate);
   }

   const days = booking?.days ? parseInt(booking.days, 10) : 0;
   const isPrepaid = res.status === "CONFIRMED_PREPAID";
   const isCounter = res.status === "CONFIRMED_NON_PREPAID";

   const pm = parsed?.paymentMethod || (parsed?.cieloPaymentId && res.status === 'PENDING_PIX' ? 'PIX' : null);
   const isPixPaid = (res.status === 'CONFIRMED_PREPAID' || res.status === 'CONFIRMED' || res.status === 'ON_REQUEST') && pm === 'PIX';
   const isPixPending = res.status === 'PENDING_PIX';
   const isCreditCard = (res.status === 'CONFIRMED_PREPAID' && pm !== 'PIX') || pm === 'CREDIT';

   return {
      amountBRL,
      amountEUR,
      isCancelled,
      isPrepaid,
      isCounter,
      isPixPaid,
      isPixPending,
      isCreditCard,
      days,
      opStatus,
   };
}

function getPaymentBadgeInfo(res: any, metrics: any) {
   if (metrics.isCancelled) {
      return { label: "🚫 Cancelada", badgeClass: "bg-red-500/20 text-red-400 border border-red-500/30" };
   }
   if (metrics.isPixPaid) {
      return { label: "📱 PIX (Pago)", badgeClass: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" };
   }
   if (metrics.isPixPending) {
      return { label: "⏳ PIX Pendente", badgeClass: "bg-amber-500/20 text-amber-400 border border-amber-500/30" };
   }
   if (metrics.isCreditCard) {
      return { label: "💳 Cartão Crédito", badgeClass: "bg-blue-500/20 text-blue-400 border border-blue-500/30" };
   }
   if (metrics.isCounter) {
      return { label: "🏢 Balcão", badgeClass: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" };
   }
   return { label: STATUS_LABELS[res.status] || res.status || "—", badgeClass: "bg-gray-700/40 text-gray-400 border border-gray-600/30" };
}

export default function PainelRelatorios() {
   const [activeTab, setActiveTab] = useState<ReportTab>("operational");
   const [reservations, setReservations] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
   const [exporting, setExporting] = useState(false);

   // Filters
   const [startDate, setStartDate] = useState("");
   const [endDate, setEndDate] = useState("");
   const [opStatusFilter, setOpStatusFilter] = useState("ALL");
   const [paymentStatusFilter, setPaymentStatusFilter] = useState("ALL");

   const fetchReservations = async () => {
      setLoading(true);
      try {
         const params = new URLSearchParams();
         if (opStatusFilter !== "ALL") params.set("operationalStatus", opStatusFilter);
         if (paymentStatusFilter !== "ALL") params.set("status", paymentStatusFilter);
         if (startDate) params.set("startDate", startDate);
         if (endDate) params.set("endDate", endDate);
         const res = await fetch(`/api/admin/reservations?${params}`);
         const data = await res.json();
         setReservations(Array.isArray(data) ? data : []);
      } catch (e) {
         console.error(e);
      } finally {
         setLoading(false);
      }
   };

   useEffect(() => {
      fetchReservations();
   }, [opStatusFilter, paymentStatusFilter, startDate, endDate]);

   const handleExportCSV = async () => {
      setExporting(true);
      try {
         const params = new URLSearchParams();
         params.set("type", activeTab);
         if (opStatusFilter !== "ALL") params.set("operationalStatus", opStatusFilter);
         if (paymentStatusFilter !== "ALL") params.set("status", paymentStatusFilter);
         if (startDate) params.set("startDate", startDate);
         if (endDate) params.set("endDate", endDate);

         const res = await fetch(`/api/admin/reservations/export?${params}`);
         if (!res.ok) throw new Error("Export failed");

         const blob = await res.blob();
         const url = URL.createObjectURL(blob);
         const a = document.createElement("a");
         a.href = url;
         a.download = activeTab === "financial"
            ? `relatorio_financeiro_${new Date().toISOString().slice(0, 10)}.csv`
            : `relatorio_operacional_${new Date().toISOString().slice(0, 10)}.csv`;
         document.body.appendChild(a);
         a.click();
         a.remove();
         URL.revokeObjectURL(url);
      } catch (e) {
         console.error(e);
         alert("Erro ao exportar CSV");
      } finally {
         setExporting(false);
      }
   };

   // Quick Date Presets
   const setDatePreset = (preset: "today" | "7d" | "thisMonth" | "lastMonth" | "all") => {
      const now = new Date();
      if (preset === "today") {
         const d = now.toISOString().slice(0, 10);
         setStartDate(d);
         setEndDate(d);
      } else if (preset === "7d") {
         const past = new Date();
         past.setDate(past.getDate() - 7);
         setStartDate(past.toISOString().slice(0, 10));
         setEndDate(now.toISOString().slice(0, 10));
      } else if (preset === "thisMonth") {
         const first = new Date(now.getFullYear(), now.getMonth(), 1);
         const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
         setStartDate(first.toISOString().slice(0, 10));
         setEndDate(last.toISOString().slice(0, 10));
      } else if (preset === "lastMonth") {
         const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
         const last = new Date(now.getFullYear(), now.getMonth(), 0);
         setStartDate(first.toISOString().slice(0, 10));
         setEndDate(last.toISOString().slice(0, 10));
      } else if (preset === "all") {
         setStartDate("");
         setEndDate("");
      }
   };

   // Parsed data & metrics for preview
   const parsedReservations = reservations.map(res => {
      let parsed: any = {};
      try {
         parsed = typeof res.customerData === "string" ? JSON.parse(res.customerData) : res.customerData;
      } catch (e) {}
      const metrics = getReservationMetrics(res, parsed);
      return { ...res, parsed, metrics };
   });

   // Totals calculated strictly from filtered reservations
   const totalFiltered = parsedReservations.length;
   const activeReservations = parsedReservations.filter(r => !r.metrics.isCancelled);
   const cancelledReservations = parsedReservations.filter(r => r.metrics.isCancelled);

   const totalActiveBRL = activeReservations.reduce((sum, r) => sum + r.metrics.amountBRL, 0);
   const totalActiveEUR = activeReservations.reduce((sum, r) => sum + r.metrics.amountEUR, 0);
   const totalActivePrepaidBRL = activeReservations.filter(r => r.metrics.isPrepaid).reduce((sum, r) => sum + r.metrics.amountBRL, 0);
   const totalActivePixBRL = activeReservations.filter(r => r.metrics.isPixPaid).reduce((sum, r) => sum + r.metrics.amountBRL, 0);
   const totalActiveCreditBRL = activeReservations.filter(r => r.metrics.isCreditCard).reduce((sum, r) => sum + r.metrics.amountBRL, 0);
   const totalActiveCounterBRL = activeReservations.filter(r => r.metrics.isCounter).reduce((sum, r) => sum + r.metrics.amountBRL, 0);
   const totalActiveDays = activeReservations.reduce((sum, r) => sum + r.metrics.days, 0);

   const countActivePix = activeReservations.filter(r => r.metrics.isPixPaid).length;
   const countActiveCredit = activeReservations.filter(r => r.metrics.isCreditCard).length;
   const countActiveCounter = activeReservations.filter(r => r.metrics.isCounter).length;

   const totalCancelledBRL = cancelledReservations.reduce((sum, r) => sum + r.metrics.amountBRL, 0);
   const totalCancelledEUR = cancelledReservations.reduce((sum, r) => sum + r.metrics.amountEUR, 0);

   const countMomentary = activeReservations.filter(r => ["R", "S", "CF"].includes(r.metrics.opStatus)).length;
   const countCheckedOut = activeReservations.filter(r => r.metrics.opStatus === "CO").length;

   return (
      <div className="space-y-6">
         {/* Header */}
         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
               <h1 className="text-2xl font-black text-white">Relatórios & Exportação</h1>
               <p className="text-gray-400 text-sm mt-1">Exporte dados operacionais e financeiros das reservas com totais em tempo real</p>
            </div>
            <button
               onClick={handleExportCSV}
               disabled={exporting || loading || reservations.length === 0}
               className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all flex items-center gap-2 shadow-lg shadow-green-900/30 hover:shadow-green-900/50"
            >
               {exporting ? (
                  <>
                     <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                     Exportando...
                  </>
               ) : (
                  <>
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                     </svg>
                     Exportar CSV ({reservations.length} registros)
                  </>
               )}
            </button>
         </div>

         {/* Tab Switcher */}
         <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800 w-fit">
            <button
               onClick={() => setActiveTab("operational")}
               className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  activeTab === "operational"
                     ? "bg-green-600 text-white shadow-lg"
                     : "text-gray-400 hover:text-white hover:bg-gray-800"
               }`}
            >
               📋 Relatório Operacional
            </button>
            <button
               onClick={() => setActiveTab("financial")}
               className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  activeTab === "financial"
                     ? "bg-green-600 text-white shadow-lg"
                     : "text-gray-400 hover:text-white hover:bg-gray-800"
               }`}
            >
               💰 Relatório Financeiro
            </button>
         </div>

         {/* Filters */}
         <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800/80 pb-3">
               <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Filtros Dinâmicos</p>
               {/* Quick Presets */}
               <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-gray-500 self-center mr-1">Atalhos de Data:</span>
                  <button onClick={() => setDatePreset("today")} className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[11px] text-gray-300 font-medium transition-colors">Hoje</button>
                  <button onClick={() => setDatePreset("7d")} className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[11px] text-gray-300 font-medium transition-colors">Últimos 7 dias</button>
                  <button onClick={() => setDatePreset("thisMonth")} className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[11px] text-gray-300 font-medium transition-colors">Mês Atual</button>
                  <button onClick={() => setDatePreset("lastMonth")} className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[11px] text-gray-300 font-medium transition-colors">Mês Anterior</button>
                  <button onClick={() => setDatePreset("all")} className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[11px] text-gray-300 font-medium transition-colors">Todas</button>
               </div>
            </div>

            <div className="flex flex-wrap gap-4">
               {/* Date range */}
               <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Data Início</label>
                  <input
                     type="date"
                     value={startDate}
                     onChange={e => setStartDate(e.target.value)}
                     className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-600 transition-colors [color-scheme:dark]"
                  />
               </div>
               <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Data Fim</label>
                  <input
                     type="date"
                     value={endDate}
                     onChange={e => setEndDate(e.target.value)}
                     className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-600 transition-colors [color-scheme:dark]"
                  />
               </div>
               {/* Operational Status */}
               <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Status Operacional</label>
                  <select
                     value={opStatusFilter}
                     onChange={e => setOpStatusFilter(e.target.value)}
                     className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-600 transition-colors appearance-none min-w-[180px]"
                  >
                     <option value="ALL">Todos os Status Op.</option>
                     <optgroup label="Agrupados">
                        <option value="ACTIVE">Momentâneos (R, S, CF)</option>
                        <option value="DONE">Concluídos (CC, CP, CO, TD, NS)</option>
                     </optgroup>
                     <optgroup label="Momentâneos">
                        <option value="R">R — On Request</option>
                        <option value="S">S — Sold</option>
                        <option value="CF">CF — Confirmed</option>
                     </optgroup>
                     <optgroup label="Concluídos">
                        <option value="CC">CC — Cancelled</option>
                        <option value="CP">CP — Cancelled Prepaid</option>
                        <option value="CO">CO — Checked Out</option>
                        <option value="TD">TD — Turn Down</option>
                        <option value="NS">NS — No Show</option>
                     </optgroup>
                  </select>
               </div>
               {/* Payment Status */}
               <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Status Pagamento</label>
                  <select
                     value={paymentStatusFilter}
                     onChange={e => setPaymentStatusFilter(e.target.value)}
                     className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-green-600 transition-colors appearance-none min-w-[180px]"
                  >
                     <option value="ALL">Todos os Pagamentos</option>
                     <option value="PIX_PAID">📱 PIX (Efetivado / Pago)</option>
                     <option value="CREDIT_CARD">💳 Cartão de Crédito</option>
                     <option value="PENDING_PIX">⏳ PIX Pendente</option>
                     <option value="CONFIRMED_NON_PREPAID">🏢 Pagar no Balcão</option>
                     <option value="CONFIRMED_PREPAID">Pago Online (Todos)</option>
                     <option value="CANCELLED">🚫 Cancelada (Online ou GW)</option>
                  </select>
               </div>
               {/* Clear */}
               {(startDate || endDate || opStatusFilter !== "ALL" || paymentStatusFilter !== "ALL") && (
                  <div className="flex items-end">
                     <button
                        onClick={() => { setStartDate(""); setEndDate(""); setOpStatusFilter("ALL"); setPaymentStatusFilter("ALL"); }}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                     >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        Limpar Filtros
                     </button>
                  </div>
               )}
            </div>
         </div>

         {/* Stats Summary - 5 KPI Cards updating dynamically */}
         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Card 1: Total Reservas */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Total Filtradas</p>
               <p className="text-2xl font-black text-white mt-1">{totalFiltered}</p>
               <p className="text-[11px] text-gray-500 mt-1">
                  <span className="text-emerald-400 font-bold">{activeReservations.length}</span> ativas · <span className="text-red-400 font-bold">{cancelledReservations.length}</span> canceladas
               </p>
            </div>

            {/* Card 2: Receita Ativa (BRL) - EXCLUI CANCELADAS */}
            <div className="bg-gray-900 border border-emerald-900/40 rounded-xl p-4 relative overflow-hidden">
               <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">Receita Ativa (BRL)</p>
                  <span className="text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">Ativas</span>
               </div>
               <p className="text-2xl font-black text-emerald-400 mt-1">
                  R$ {totalActiveBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
               </p>
               <div className="text-[10px] text-gray-400 mt-2 space-y-0.5 border-t border-gray-800/80 pt-1.5 font-medium">
                  <div className="flex justify-between items-center text-emerald-300">
                     <span>📱 PIX ({countActivePix}):</span>
                     <span>R$ {totalActivePixBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-blue-300">
                     <span>💳 Cartão ({countActiveCredit}):</span>
                     <span>R$ {totalActiveCreditBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-yellow-300">
                     <span>🏢 Balcão ({countActiveCounter}):</span>
                     <span>R$ {totalActiveCounterBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
               </div>
            </div>

            {/* Card 3: Receita Estimada (EUR) */}
            <div className="bg-gray-900 border border-blue-900/40 rounded-xl p-4">
               <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">Net Ativo (EUR)</p>
                  <span className="text-[9px] font-semibold bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">Estimado</span>
               </div>
               <p className="text-2xl font-black text-blue-400 mt-1">
                  € {totalActiveEUR.toFixed(2)}
               </p>
               <p className="text-[10px] text-gray-500 mt-1">
                  Ticket Médio: € {activeReservations.length > 0 ? (totalActiveEUR / activeReservations.length).toFixed(2) : "0.00"}
               </p>
            </div>

            {/* Card 4: Operacional Ativas & CO */}
            <div className="bg-gray-900 border border-purple-900/40 rounded-xl p-4">
               <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wide">Operacional</p>
               <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-2xl font-black text-white">{countMomentary}</p>
                  <span className="text-xs text-yellow-400 font-bold">em andamento</span>
               </div>
               <p className="text-[11px] text-gray-400 mt-1">
                  <span className="text-purple-400 font-bold">{countCheckedOut}</span> Checked Out (CO)
               </p>
            </div>

            {/* Card 5: Canceladas com Valor Separado */}
            <div className="bg-gray-900 border border-red-900/40 rounded-xl p-4">
               <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Canceladas</p>
                  <span className="text-[9px] font-semibold bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded">Excluídas</span>
               </div>
               <p className="text-2xl font-black text-red-400 mt-1">{cancelledReservations.length}</p>
               <p className="text-[10px] text-red-400/80 mt-1 font-medium">
                  R$ {totalCancelledBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} não somado
               </p>
            </div>
         </div>

         {/* Data Preview Table */}
         <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-xl">
            <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-850">
               <div>
                  <p className="text-xs font-bold text-gray-200">
                     {activeTab === "operational" ? "📋 Relatório Operacional" : "💰 Relatório Financeiro"}
                  </p>
                  <p className="text-[10px] text-gray-500">
                     Mostrando {parsedReservations.length} reservas filtradas ({activeReservations.length} ativas, {cancelledReservations.length} canceladas)
                  </p>
               </div>
               <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                  Soma Ativa: R$ {totalActiveBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
               </span>
            </div>
            <div className="overflow-x-auto">
               {activeTab === "operational" ? (
                  /* OPERATIONAL TABLE */
                  <table className="w-full text-sm text-left min-w-[950px]">
                     <thead className="bg-gray-800/60 border-b border-gray-700">
                        <tr>
                           <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Código</th>
                           <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Status Op.</th>
                           <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Pagamento</th>
                           <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Data Criação</th>
                           <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Retirada</th>
                           <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Devolução</th>
                           <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Cliente</th>
                           <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Veículo</th>
                           <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase text-right">Valor (BRL)</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-800/50">
                        {loading && (
                           <tr><td colSpan={9} className="text-center py-12">
                              <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                              <p className="text-xs text-gray-500 mt-2">Carregando relatório...</p>
                           </td></tr>
                        )}
                        {!loading && parsedReservations.length === 0 && (
                           <tr><td colSpan={9} className="text-center py-12 text-gray-500">
                              Nenhum registro encontrado para os filtros selecionados.
                           </td></tr>
                        )}
                        {!loading && parsedReservations.map(({ parsed, metrics, ...res }) => {
                           const opConfig = OP_STATUS_CONFIG[metrics.opStatus] || OP_STATUS_CONFIG.R;
                           const booking = parsed?.booking || {};
                           return (
                              <tr key={res.id} className={`hover:bg-gray-800/40 transition-colors ${metrics.isCancelled ? "bg-red-950/10 opacity-70" : ""}`}>
                                 <td className="px-4 py-3 font-mono font-bold text-white text-xs">
                                    {res.resNumber || "—"}
                                    {metrics.isCancelled && <span className="ml-1 text-[9px] text-red-400 font-sans font-bold">🚫</span>}
                                 </td>
                                 <td className="px-4 py-3">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${opConfig.color}`}>
                                       {opConfig.label} — {opConfig.description}
                                    </span>
                                 </td>
                                 <td className="px-4 py-3">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-flex items-center gap-1 ${getPaymentBadgeInfo(res, metrics).badgeClass}`}>
                                       {getPaymentBadgeInfo(res, metrics).label}
                                    </span>
                                 </td>
                                 <td className="px-4 py-3 text-xs text-gray-400">
                                    {new Date(res.createdAt).toLocaleDateString("pt-BR")}{" "}
                                    <span className="text-gray-600">{new Date(res.createdAt).toLocaleTimeString("pt-BR")}</span>
                                 </td>
                                 <td className="px-4 py-3 text-xs text-gray-400">
                                    {formatDateBR(booking?.pickupDate)} {formatTimeBR(booking?.pickupTime)}
                                 </td>
                                 <td className="px-4 py-3 text-xs text-gray-400">
                                    {formatDateBR(booking?.returnDate)} {formatTimeBR(booking?.returnTime)}
                                 </td>
                                 <td className="px-4 py-3">
                                    <div className="text-xs text-white font-bold">{parsed?.nome || "—"} {parsed?.sobrenome || ""}</div>
                                    <div className="text-[10px] text-gray-600">{parsed?.email || ""}</div>
                                 </td>
                                 <td className="px-4 py-3 text-xs text-gray-400">
                                    {booking?.car?.carCategorySample || booking?.car?.carCategoryName || "—"}
                                 </td>
                                 <td className="px-4 py-3 text-xs font-bold text-right">
                                    {metrics.isCancelled ? (
                                       <div>
                                          <span className="text-red-400 line-through">
                                             R$ {metrics.amountBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                          </span>
                                          <span className="block text-[9px] text-red-500 font-normal">Cancelada</span>
                                       </div>
                                    ) : metrics.amountBRL > 0 ? (
                                       <span className="text-green-400">
                                          R$ {metrics.amountBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                       </span>
                                    ) : (
                                       <span className="text-gray-500">—</span>
                                    )}
                                 </td>
                              </tr>
                           );
                        })}
                     </tbody>

                     {/* FOOTER TOTALIZADOR - OPERACIONAL */}
                     {!loading && parsedReservations.length > 0 && (
                        <tfoot className="bg-gray-800/90 border-t-2 border-gray-700 text-white font-bold">
                           <tr>
                              <td className="px-4 py-3 text-xs uppercase text-gray-300">
                                 Total ({totalFiltered})
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-300" colSpan={2}>
                                 <span className="text-emerald-400">{activeReservations.length} ativas</span>
                                 {cancelledReservations.length > 0 && (
                                    <span className="text-red-400 ml-2">· {cancelledReservations.length} canceladas</span>
                                 )}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-400" colSpan={3}>
                                 Total Diárias Ativas: <span className="text-white font-bold">{totalActiveDays} dias</span>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-400" colSpan={2}>
                                 {cancelledReservations.length > 0 ? (
                                    <span className="text-red-400 text-[11px] font-normal">
                                       * Canceladas excluídas da receita
                                    </span>
                                 ) : null}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-black">
                                 <div className="text-emerald-400">
                                    R$ {totalActiveBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                 </div>
                                 {cancelledReservations.length > 0 && (
                                    <div className="text-[10px] text-red-400 font-normal mt-0.5">
                                       (Canc: R$ {totalCancelledBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                                    </div>
                                 )}
                              </td>
                           </tr>
                        </tfoot>
                     )}
                  </table>
               ) : (
                  /* FINANCIAL TABLE */
                  <table className="w-full text-sm text-left min-w-[1450px]">
                     <thead className="bg-gray-800/60 border-b border-gray-700">
                        <tr>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Código</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Reserva</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Retirada</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Devolução</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase text-right">Net (EUR)</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase text-right">Total (BRL)</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Pagamento</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Câmbio</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Estação Ret.</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Estação Dev.</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Veículo</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Cliente</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase">Desconto/CID</th>
                           <th className="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase text-center">Status Op.</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-800/50">
                        {loading && (
                           <tr><td colSpan={14} className="text-center py-12">
                              <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                              <p className="text-xs text-gray-500 mt-2">Carregando relatório financeiro...</p>
                           </td></tr>
                        )}
                        {!loading && parsedReservations.length === 0 && (
                           <tr><td colSpan={14} className="text-center py-12 text-gray-500">
                              Nenhum registro encontrado para os filtros selecionados.
                           </td></tr>
                        )}
                        {!loading && parsedReservations.map(({ parsed, metrics, ...res }) => {
                           const opConfig = OP_STATUS_CONFIG[metrics.opStatus] || OP_STATUS_CONFIG.R;
                           const booking = parsed?.booking || {};
                           const car = booking?.car || {};
                           return (
                              <tr key={res.id} className={`hover:bg-gray-800/40 transition-colors ${metrics.isCancelled ? "bg-red-950/10 opacity-70" : ""}`}>
                                 <td className="px-3 py-3 font-mono font-bold text-white text-[11px]">
                                    {res.resNumber || "—"}
                                    {metrics.isCancelled && <span className="ml-1 text-[9px] text-red-400 font-sans font-bold">🚫</span>}
                                 </td>
                                 <td className="px-3 py-3 text-[10px] text-gray-400">
                                    {new Date(res.createdAt).toLocaleDateString("pt-BR")}{" "}
                                    <span className="text-gray-600">{new Date(res.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                                 </td>
                                 <td className="px-3 py-3 text-[10px] text-gray-400">
                                    {formatDateBR(booking?.pickupDate)} {formatTimeBR(booking?.pickupTime)}
                                 </td>
                                 <td className="px-3 py-3 text-[10px] text-gray-400">
                                    {formatDateBR(booking?.returnDate)} {formatTimeBR(booking?.returnTime)}
                                 </td>
                                 <td className="px-3 py-3 text-[10px] font-bold text-right">
                                    {metrics.isCancelled ? (
                                       <span className="text-red-400 line-through">€ {metrics.amountEUR.toFixed(2)}</span>
                                    ) : metrics.amountEUR > 0 ? (
                                       <span className="text-blue-400">€ {metrics.amountEUR.toFixed(2)}</span>
                                    ) : (
                                       <span className="text-gray-600">—</span>
                                    )}
                                 </td>
                                 <td className="px-3 py-3 text-[10px] font-bold text-right">
                                    {metrics.isCancelled ? (
                                       <div>
                                          <span className="text-red-400 line-through">
                                             R$ {metrics.amountBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                          </span>
                                          <span className="block text-[8px] text-red-500 font-normal">Cancelada</span>
                                       </div>
                                    ) : metrics.amountBRL > 0 ? (
                                       <span className="text-green-400">
                                          R$ {metrics.amountBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                       </span>
                                    ) : (
                                       <span className="text-gray-600">—</span>
                                    )}
                                 </td>
                                 <td className="px-3 py-3">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-flex items-center gap-1 ${getPaymentBadgeInfo(res, metrics).badgeClass}`}>
                                       {getPaymentBadgeInfo(res, metrics).label}
                                    </span>
                                 </td>
                                 <td className="px-3 py-3 text-[10px] text-gray-500 font-mono">
                                    {car?.exchangeRate ? parseFloat(car.exchangeRate).toFixed(4) : "—"}
                                 </td>
                                 <td className="px-3 py-3 text-[10px] text-gray-400">{booking?.pickupStation || "—"}</td>
                                 <td className="px-3 py-3 text-[10px] text-gray-400">{booking?.returnStation || booking?.pickupStation || "—"}</td>
                                 <td className="px-3 py-3 text-[10px] text-gray-400">
                                    {car?.carCategorySample || car?.carCategoryName || "—"}
                                    <br /><span className="text-gray-600">{car?.carCategoryCode || ""}</span>
                                 </td>
                                 <td className="px-3 py-3">
                                    <div className="text-[10px] text-white font-bold">{parsed?.nome || "—"} {parsed?.sobrenome || ""}</div>
                                    <div className="text-[9px] text-gray-600">{parsed?.email || ""}</div>
                                    <div className="text-[9px] text-gray-600">{parsed?.cpf || ""}</div>
                                 </td>
                                 <td className="px-3 py-3 text-[10px] text-orange-400 font-mono">
                                    {parsed?.contractID || booking?.contractID || "—"}
                                 </td>
                                 <td className="px-3 py-3 text-center">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${opConfig.color}`}>
                                       {opConfig.label}
                                    </span>
                                 </td>
                              </tr>
                           );
                        })}
                     </tbody>

                     {/* FOOTER TOTALIZADOR - FINANCEIRO */}
                     {!loading && parsedReservations.length > 0 && (
                        <tfoot className="bg-gray-800/90 border-t-2 border-gray-700 text-white font-bold">
                           <tr>
                              <td className="px-3 py-3 text-xs uppercase text-gray-300" colSpan={4}>
                                 TOTAL ATIVO / CONFIRMADO ({activeReservations.length} reservas)
                              </td>
                              <td className="px-3 py-3 text-xs text-right font-black text-blue-400">
                                 € {totalActiveEUR.toFixed(2)}
                              </td>
                              <td className="px-3 py-3 text-xs text-right font-black">
                                 <div className="text-emerald-400">
                                    R$ {totalActiveBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                 </div>
                                 <div className="text-[9px] text-gray-300 font-normal mt-0.5 space-y-0.5">
                                    <div>📱 PIX: R$ {totalActivePixBRL.toFixed(2)} | 💳 Cartão: R$ {totalActiveCreditBRL.toFixed(2)} | 🏢 Balcão: R$ {totalActiveCounterBRL.toFixed(2)}</div>
                                 </div>
                                 {cancelledReservations.length > 0 && (
                                    <div className="text-[9px] text-red-400 font-normal mt-0.5">
                                       (Canc: R$ {totalCancelledBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                                    </div>
                                 )}
                              </td>
                              <td className="px-3 py-3 text-[10px] text-gray-400" colSpan={8}>
                                 {cancelledReservations.length > 0 ? (
                                    <span className="text-red-400">
                                       * {cancelledReservations.length} reserva(s) cancelada(s) (total R$ {totalCancelledBRL.toFixed(2)}) excluídas da receita ativa.
                                    </span>
                                 ) : (
                                    <span className="text-emerald-400">
                                       * Todas as {totalFiltered} reservas exibidas são válidas.
                                    </span>
                                 )}
                              </td>
                           </tr>
                        </tfoot>
                     )}
                  </table>
               )}
            </div>
         </div>
      </div>
   );
}
