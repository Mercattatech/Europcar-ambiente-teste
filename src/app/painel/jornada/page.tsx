"use client";

import { useState, useEffect } from "react";

const STEP_LABELS: Record<number, { label: string; icon: string; color: string }> = {
  1: { label: "Pesquisa", icon: "🔍", color: "bg-blue-500" },
  2: { label: "Veículo", icon: "🚗", color: "bg-yellow-500" },
  3: { label: "Extras", icon: "🛡️", color: "bg-orange-500" },
  4: { label: "Checkout", icon: "💳", color: "bg-purple-500" },
  5: { label: "Concluída", icon: "✅", color: "bg-green-500" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  IN_PROGRESS: { label: "Em Progresso", color: "bg-yellow-600/20 text-yellow-400" },
  COMPLETED: { label: "Concluída", color: "bg-green-600/20 text-green-400" },
  ABANDONED: { label: "Abandonada", color: "bg-red-600/20 text-red-400" },
};

export default function JornadaPage() {
  const [stats, setStats] = useState<any>(null);
  const [journeys, setJourneys] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterStep, setFilterStep] = useState("");
  const [filterStation, setFilterStation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchStats = () => {
    setLoadingStats(true);
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    fetch(`/api/admin/journey/stats?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && d.funnel) {
          setStats(d);
        } else {
          setStats(null);
        }
        setLoadingStats(false);
      })
      .catch(() => { setStats(null); setLoadingStats(false); });
  };

  const fetchJourneys = (p: number = 1) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(p));
    params.set("limit", "30");
    if (filterStatus) params.set("status", filterStatus);
    if (filterStep) params.set("step", filterStep);
    if (filterStation) params.set("station", filterStation);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (search) params.set("search", search);

    fetch(`/api/admin/journey?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && !d.error) {
          setJourneys(d.journeys || []);
          setTotal(d.total || 0);
          setPage(d.page || 1);
          setTotalPages(d.totalPages || 1);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
    fetchJourneys(1);
  }, []);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStats();
    fetchJourneys(1);
  };

  const fmtDate = (d: string) => {
    try {
      return new Date(d).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return d;
    }
  };

  const fmtDateShort = (d: string | null | undefined) => {
    if (!d) return "—";
    // Format: YYYYMMDD → DD/MM/YYYY
    if (d.length === 8 && !d.includes("/") && !d.includes("-")) {
      return `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}`;
    }
    return d;
  };

  const fmtTime = (t: string | null | undefined) => {
    if (!t) return "—";
    if (t.length === 4) return `${t.slice(0, 2)}:${t.slice(2, 4)}`;
    return t;
  };

  const fmtBRL = (v: number | null | undefined) => {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const parseJourneyData = (j: any) => {
    let carPrice = typeof j.carPrice === "number" ? j.carPrice : parseFloat(j.carPrice || "0") || 0;
    let insurances: Array<{ code: string; name: string; priceBRL: number }> = [];
    let equipment: Array<{ code: string; name: string; qty: number; priceBRL: number; totalBRL: number }> = [];
    let insurancesTotal = 0;
    let equipmentTotal = 0;
    let extrasTotal = 0;
    let totalPrice = 0;
    let customer: { name?: string; email?: string; phone?: string; cpf?: string } | undefined = undefined;
    let attemptError: string | undefined = undefined;
    let lastAttemptAt: string | undefined = undefined;
    let legacyExtras: string[] = [];
    let isStructured = false;

    if (j.selectedExtras) {
      try {
        const raw = typeof j.selectedExtras === "string" ? JSON.parse(j.selectedExtras) : j.selectedExtras;
        if (Array.isArray(raw)) {
          legacyExtras = raw.map((item: any) => typeof item === "string" ? item : (item.name || item.code || JSON.stringify(item)));
        } else if (raw && typeof raw === "object") {
          isStructured = true;
          if (Array.isArray(raw.insurances)) {
            insurances = raw.insurances.map((i: any) => ({
              code: i.code || "",
              name: i.name || i.code || "Proteção",
              priceBRL: parseFloat(i.priceBRL) || 0,
            }));
          }
          if (Array.isArray(raw.equipment)) {
            equipment = raw.equipment.map((e: any) => ({
              code: e.code || "",
              name: e.name || e.code || "Extra",
              qty: parseInt(e.qty) || 1,
              priceBRL: parseFloat(e.priceBRL) || 0,
              totalBRL: parseFloat(e.totalBRL || (parseFloat(e.priceBRL || 0) * (parseInt(e.qty) || 1))) || 0,
            }));
          }

          insurancesTotal = typeof raw.insurancesTotal === "number"
            ? raw.insurancesTotal
            : insurances.reduce((acc, cur) => acc + cur.priceBRL, 0);

          equipmentTotal = typeof raw.equipmentTotal === "number"
            ? raw.equipmentTotal
            : equipment.reduce((acc, cur) => acc + cur.totalBRL, 0);

          extrasTotal = typeof raw.extrasTotal === "number"
            ? raw.extrasTotal
            : (insurancesTotal + equipmentTotal);

          if (raw.carPrice) {
            carPrice = parseFloat(raw.carPrice) || carPrice;
          }

          totalPrice = typeof raw.totalPrice === "number"
            ? raw.totalPrice
            : (carPrice + extrasTotal);

          if (raw.customer) customer = raw.customer;
          if (raw.attemptError) attemptError = raw.attemptError;
          if (raw.lastAttemptAt) lastAttemptAt = raw.lastAttemptAt;
        }
      } catch {}
    }

    if (!isStructured) {
      totalPrice = carPrice;
    }

    return {
      carPrice,
      insurances,
      equipment,
      insurancesTotal,
      equipmentTotal,
      extrasTotal,
      totalPrice,
      customer,
      attemptError,
      lastAttemptAt,
      legacyExtras,
      isStructured,
    };
  };

  // Funnel bar widths
  const funnelMax = stats?.funnel?.step1 || 1;
  const funnelData = stats
    ? [
        { step: 1, count: stats.funnel.step1, label: "Pesquisa", icon: "🔍" },
        { step: 2, count: stats.funnel.step2, label: "Veículo", icon: "🚗" },
        { step: 3, count: stats.funnel.step3, label: "Extras", icon: "🛡️" },
        { step: 4, count: stats.funnel.step4, label: "Checkout", icon: "💳" },
        { step: 5, count: stats.funnel.step5, label: "Concluída", icon: "✅" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Jornada do Cliente</h1>
          <p className="text-sm text-gray-400 mt-1">
            Acompanhe o funil de conversão e entenda onde os clientes abandonam
          </p>
        </div>
      </div>

      {/* Loading State */}
      {loadingStats && !stats && (
        <div className="flex justify-center py-10">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-gray-500">Carregando dados da jornada...</p>
          </div>
        </div>
      )}

      {/* Empty State when no stats (API error or no data) */}
      {!loadingStats && !stats && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
          <p className="text-4xl mb-4">🗺️</p>
          <h3 className="text-lg font-bold text-white mb-2">Jornada do Cliente</h3>
          <p className="text-sm text-gray-400 mb-4">Nenhuma jornada registrada ainda. Os dados aparecerão aqui quando os primeiros clientes pesquisarem no site.</p>
          <p className="text-xs text-gray-600">As pesquisas, seleções de veículos e checkouts serão rastreados automaticamente.</p>
        </div>
      )}

      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center text-lg">📊</div>
              <p className="text-xs font-bold text-gray-500 uppercase">Total Pesquisas</p>
            </div>
            <p className="text-3xl font-black text-white">{stats.totalSessions}</p>
            <p className="text-xs text-gray-500 mt-1">Hoje: {stats.today?.sessions || 0}</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center text-lg">✅</div>
              <p className="text-xs font-bold text-gray-500 uppercase">Conversões</p>
            </div>
            <p className="text-3xl font-black text-green-400">{stats.statusCounts.completed}</p>
            <p className="text-xs text-gray-500 mt-1">Hoje: {stats.today?.completed || 0}</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center text-lg">📈</div>
              <p className="text-xs font-bold text-gray-500 uppercase">Taxa de Conversão</p>
            </div>
            <p className="text-3xl font-black text-emerald-400">{stats.conversionRate}%</p>
            <p className="text-xs text-gray-500 mt-1">Pesquisa → Reserva</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-600/20 flex items-center justify-center text-lg">⏳</div>
              <p className="text-xs font-bold text-gray-500 uppercase">Em Progresso</p>
            </div>
            <p className="text-3xl font-black text-yellow-400">{stats.statusCounts.inProgress}</p>
            <p className="text-xs text-gray-500 mt-1">Sessões ativas</p>
          </div>
        </div>
      )}

      {/* Funnel + Top Stations */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Funnel */}
          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <span className="w-1 h-5 bg-green-500 rounded-full inline-block"></span>
              Funil de Conversão
            </h2>
            <div className="space-y-4">
              {funnelData.map((item, idx) => {
                const pct = funnelMax > 0 ? (item.count / funnelMax) * 100 : 0;
                const prevCount = idx > 0 ? funnelData[idx - 1].count : item.count;
                const dropoff = prevCount > 0 ? (((prevCount - item.count) / prevCount) * 100).toFixed(0) : "0";
                return (
                  <div key={item.step} className="flex items-center gap-4">
                    <div className="w-24 shrink-0 flex items-center gap-2">
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-xs font-bold text-gray-400">{item.label}</span>
                    </div>
                    <div className="flex-1 bg-gray-800 rounded-full h-8 overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          item.step === 5 ? "bg-gradient-to-r from-green-600 to-green-400" :
                          item.step === 4 ? "bg-gradient-to-r from-purple-600 to-purple-400" :
                          item.step === 3 ? "bg-gradient-to-r from-orange-600 to-orange-400" :
                          item.step === 2 ? "bg-gradient-to-r from-yellow-600 to-yellow-400" :
                          "bg-gradient-to-r from-blue-600 to-blue-400"
                        }`}
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      />
                      <div className="absolute inset-0 flex items-center px-3 justify-between">
                        <span className="text-xs font-black text-white drop-shadow">{item.count}</span>
                        <span className="text-[10px] font-bold text-white/80">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    {idx > 0 && (
                      <div className="w-16 shrink-0 text-right">
                        <span className={`text-[10px] font-bold ${parseInt(dropoff) > 50 ? "text-red-400" : parseInt(dropoff) > 30 ? "text-orange-400" : "text-gray-500"}`}>
                          -{dropoff}%
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Stations */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-blue-500 rounded-full inline-block"></span>
              Estações Mais Pesquisadas
            </h2>
            {stats.topStations?.length > 0 ? (
              <div className="space-y-3">
                {stats.topStations.map((s: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                      idx === 0 ? "bg-yellow-500 text-black" :
                      idx === 1 ? "bg-gray-400 text-black" :
                      idx === 2 ? "bg-orange-600 text-white" :
                      "bg-gray-700 text-gray-300"
                    }`}>{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{s.name}</p>
                      <p className="text-[10px] text-gray-500 font-mono">{s.code}</p>
                    </div>
                    <span className="text-sm font-black text-green-400">{s.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Nenhuma pesquisa registrada</p>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <form onSubmit={handleFilter} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
            >
              <option value="">Todos</option>
              <option value="IN_PROGRESS">Em Progresso</option>
              <option value="COMPLETED">Concluída</option>
              <option value="ABANDONED">Abandonada</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Etapa</label>
            <select
              value={filterStep}
              onChange={(e) => setFilterStep(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
            >
              <option value="">Todas</option>
              <option value="1">1 - Pesquisa</option>
              <option value="2">2 - Veículo</option>
              <option value="3">3 - Extras</option>
              <option value="4">4 - Checkout</option>
              <option value="5">5 - Concluída</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">De</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Até</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Buscar</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Estação, carro, reserva..."
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 placeholder:text-gray-600"
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-sm py-2 px-4 rounded-lg transition-colors">
              Filtrar
            </button>
          </div>
        </div>
      </form>

      {/* Journeys Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-1 h-5 bg-purple-500 rounded-full inline-block"></span>
            Jornadas ({total})
          </h2>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            Página {page} de {totalPages}
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center">
            <div className="w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm text-gray-500">Carregando...</p>
          </div>
        ) : journeys.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-4xl mb-3">🗺️</p>
            <p className="text-gray-400 font-bold">Nenhuma jornada registrada</p>
            <p className="text-xs text-gray-600 mt-1">As jornadas aparecerão aqui conforme os clientes utilizarem o site</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Data</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Estação Retirada</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Veículo & Valores Somados</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase text-center">Etapa</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase text-center">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase">Reserva</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase text-center">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {journeys.map((j: any) => {
                  const stepInfo = STEP_LABELS[j.currentStep] || { label: "?", icon: "❓", color: "bg-gray-500" };
                  const statusInfo = STATUS_LABELS[j.status] || { label: j.status, color: "bg-gray-600/20 text-gray-400" };
                  const isExpanded = expandedId === j.id;
                  const parsed = parseJourneyData(j);

                  return (
                    <>
                      <tr
                        key={j.id}
                        className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer ${isExpanded ? "bg-gray-800/40" : ""}`}
                        onClick={() => setExpandedId(isExpanded ? null : j.id)}
                      >
                        <td className="px-4 py-3">
                          <p className="text-white font-medium text-xs">{fmtDate(j.createdAt)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white font-bold text-xs">{j.pickupStationName || "—"}</p>
                          <p className="text-[10px] text-gray-500 font-mono">{j.pickupStation || ""}</p>
                        </td>
                        <td className="px-4 py-3">
                          {j.selectedCarName ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-white font-bold text-xs truncate max-w-[220px]" title={j.selectedCarName}>
                                  {j.selectedCarName}
                                </p>
                                {j.selectedCar && (
                                  <span className="text-[9px] bg-gray-800 text-gray-400 px-1 py-0.2 rounded font-mono">
                                    {j.selectedCar}
                                  </span>
                                )}
                              </div>

                              {/* Badges for Protections & Extras */}
                              {(parsed.insurances.length > 0 || parsed.equipment.length > 0 || parsed.legacyExtras.length > 0) && (
                                <div className="flex flex-wrap gap-1 text-[10px]">
                                  {parsed.insurances.length > 0 && (
                                    <span className="bg-blue-950/70 text-blue-300 border border-blue-800/80 px-1.5 py-0.5 rounded font-medium">
                                      🛡️ {parsed.insurances.length} {parsed.insurances.length === 1 ? 'proteção' : 'proteções'} (+{fmtBRL(parsed.insurancesTotal)})
                                    </span>
                                  )}
                                  {parsed.equipment.length > 0 && (
                                    <span className="bg-orange-950/70 text-orange-300 border border-orange-800/80 px-1.5 py-0.5 rounded font-medium">
                                      📦 {parsed.equipment.length} {parsed.equipment.length === 1 ? 'extra' : 'extras'} (+{fmtBRL(parsed.equipmentTotal)})
                                    </span>
                                  )}
                                  {parsed.legacyExtras.length > 0 && (
                                    <span className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded text-[10px]">
                                      +{parsed.legacyExtras.length} extras
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Prominent Summed Total */}
                              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                {parsed.totalPrice > 0 ? (
                                  <>
                                    <span className="text-[10px] text-gray-400">Total Somado:</span>
                                    <span className="text-xs font-black text-green-400 bg-green-950/70 border border-green-800 px-1.5 py-0.5 rounded font-mono shadow-sm">
                                      {fmtBRL(parsed.totalPrice)}
                                    </span>
                                  </>
                                ) : parsed.carPrice > 0 ? (
                                  <>
                                    <span className="text-[10px] text-gray-400">Carro:</span>
                                    <span className="text-xs font-bold text-green-400">{fmtBRL(parsed.carPrice)}</span>
                                  </>
                                ) : null}
                              </div>

                              {/* Error or user info */}
                              {parsed.attemptError && (
                                <div className="text-[10px] text-red-400 flex items-center gap-1 font-medium bg-red-950/40 border border-red-800/50 px-1.5 py-0.5 rounded w-fit max-w-[240px] truncate" title={parsed.attemptError}>
                                  <span>⚠️ {parsed.attemptError}</span>
                                </div>
                              )}
                              {(parsed.customer?.name || j.userId) && (
                                <p className="text-[10px] text-gray-400 truncate max-w-[240px]" title={parsed.customer?.name || j.userId}>
                                  👤 {parsed.customer?.name || j.userId}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="text-sm">{stepInfo.icon}</span>
                            <span className="text-xs font-bold text-gray-300">{stepInfo.label}</span>
                          </div>
                          {/* Step progress dots */}
                          <div className="flex items-center gap-0.5 justify-center mt-1.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <div
                                key={s}
                                className={`w-4 h-1 rounded-full transition-colors ${
                                  s <= j.currentStep
                                    ? s === 5 ? "bg-green-500" : "bg-green-500/70"
                                    : "bg-gray-700"
                                }`}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {j.resNumber ? (
                            <span className="text-xs font-bold text-green-400 font-mono">{j.resNumber}</span>
                          ) : (
                            <span className="text-gray-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button className="text-gray-500 hover:text-white transition-colors">
                            <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <tr key={`${j.id}-details`} className="bg-gray-800/20">
                          <td colSpan={7} className="px-6 py-5">
                            {/* Payment Attempt Warning if failed */}
                            {parsed.attemptError && (
                              <div className="mb-5 bg-red-950/60 border border-red-700/80 rounded-xl p-4 flex items-start gap-3 shadow-md">
                                <div className="text-2xl mt-0.5">⚠️</div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <h5 className="text-red-400 font-bold text-sm">Tentativa de Pagamento Não Aprovada</h5>
                                    {parsed.lastAttemptAt && (
                                      <span className="text-red-400/80 text-[11px] font-mono">{fmtDate(parsed.lastAttemptAt)}</span>
                                    )}
                                  </div>
                                  <p className="text-red-200 text-xs mt-1">
                                    <span className="font-semibold text-white">Motivo retornado: </span>
                                    <span className="font-mono bg-red-900/60 text-red-100 px-2 py-0.5 rounded font-bold">{parsed.attemptError}</span>
                                  </p>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                              {/* Column 1: Trip Details */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1.5">
                                  <span className="w-1.5 h-3.5 bg-blue-500 rounded-full"></span>
                                  Dados da Pesquisa
                                </h4>
                                <div className="bg-gray-900 border border-gray-800 rounded-xl p-3.5 space-y-2 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Retirada:</span>
                                    <span className="text-white font-bold">{j.pickupStationName || j.pickupStation || "—"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Devolução:</span>
                                    <span className="text-white font-bold">{j.returnStationName || j.returnStation || "—"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Data Retirada:</span>
                                    <span className="text-white">{fmtDateShort(j.pickupDate)} {fmtTime(j.pickupTime)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Data Devolução:</span>
                                    <span className="text-white">{fmtDateShort(j.returnDate)} {fmtTime(j.returnTime)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">País:</span>
                                    <span className="text-white">{j.country || "—"}</span>
                                  </div>
                                  {j.contractID && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Contrato/Tarifa:</span>
                                      <span className="text-yellow-400 font-mono font-bold">{j.contractID}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Column 2: Proteções Selecionadas */}
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1.5">
                                    <span className="w-1.5 h-3.5 bg-blue-400 rounded-full"></span>
                                    🛡️ Proteções ({parsed.insurances.length})
                                  </h4>
                                  {parsed.insurancesTotal > 0 && (
                                    <span className="text-[11px] font-bold text-blue-400 bg-blue-950/70 border border-blue-800/80 px-2 py-0.5 rounded font-mono">
                                      {fmtBRL(parsed.insurancesTotal)}
                                    </span>
                                  )}
                                </div>
                                <div className="bg-gray-900 border border-gray-800 rounded-xl p-3.5 space-y-2 text-xs">
                                  {parsed.insurances.length > 0 ? (
                                    <div className="space-y-2">
                                      {parsed.insurances.map((ins, idx) => (
                                        <div key={idx} className="flex items-start justify-between bg-gray-800/60 p-2 rounded-lg border border-gray-700/50">
                                          <div className="min-w-0 pr-2">
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-[9px] bg-blue-900/60 text-blue-300 border border-blue-700/60 px-1.5 py-0.2 rounded font-mono font-bold">
                                                {ins.code}
                                              </span>
                                              <span className="text-white font-medium text-xs leading-tight">{ins.name}</span>
                                            </div>
                                          </div>
                                          <span className="text-blue-300 font-bold font-mono text-xs whitespace-nowrap">
                                            {fmtBRL(ins.priceBRL)}
                                          </span>
                                        </div>
                                      ))}
                                      <div className="pt-2 border-t border-gray-800 flex justify-between items-center text-xs">
                                        <span className="text-gray-400 font-medium">Subtotal Proteções:</span>
                                        <span className="text-white font-black font-mono">{fmtBRL(parsed.insurancesTotal)}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-gray-500 text-xs italic py-2 text-center">Nenhuma proteção adicional selecionada</p>
                                  )}
                                </div>
                              </div>

                              {/* Column 3: Extras e Equipamentos */}
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1.5">
                                    <span className="w-1.5 h-3.5 bg-orange-400 rounded-full"></span>
                                    📦 Extras & Equipamentos ({parsed.equipment.length})
                                  </h4>
                                  {parsed.equipmentTotal > 0 && (
                                    <span className="text-[11px] font-bold text-orange-400 bg-orange-950/70 border border-orange-800/80 px-2 py-0.5 rounded font-mono">
                                      {fmtBRL(parsed.equipmentTotal)}
                                    </span>
                                  )}
                                </div>
                                <div className="bg-gray-900 border border-gray-800 rounded-xl p-3.5 space-y-2 text-xs">
                                  {parsed.equipment.length > 0 ? (
                                    <div className="space-y-2">
                                      {parsed.equipment.map((eq, idx) => (
                                        <div key={idx} className="flex items-start justify-between bg-gray-800/60 p-2 rounded-lg border border-gray-700/50">
                                          <div className="min-w-0 pr-2">
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-[9px] bg-orange-900/60 text-orange-300 border border-orange-700/60 px-1.5 py-0.2 rounded font-mono font-bold">
                                                {eq.code}
                                              </span>
                                              <span className="text-white font-medium text-xs leading-tight">{eq.name}</span>
                                              {eq.qty > 1 && (
                                                <span className="text-[10px] bg-gray-700 text-gray-300 px-1 rounded">x{eq.qty}</span>
                                              )}
                                            </div>
                                          </div>
                                          <span className="text-orange-300 font-bold font-mono text-xs whitespace-nowrap">
                                            {fmtBRL(eq.totalBRL)}
                                          </span>
                                        </div>
                                      ))}
                                      <div className="pt-2 border-t border-gray-800 flex justify-between items-center text-xs">
                                        <span className="text-gray-400 font-medium">Subtotal Extras:</span>
                                        <span className="text-white font-black font-mono">{fmtBRL(parsed.equipmentTotal)}</span>
                                      </div>
                                    </div>
                                  ) : parsed.legacyExtras.length > 0 ? (
                                    <div>
                                      <span className="text-gray-500 block mb-1">Extras selecionados:</span>
                                      <div className="flex flex-wrap gap-1">
                                        {parsed.legacyExtras.map((ex, idx) => (
                                          <span key={idx} className="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full border border-gray-700">{ex}</span>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-gray-500 text-xs italic py-2 text-center">Nenhum extra ou equipamento adicionado</p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Row 2: Demonstrativo de Valores Somados + Dados do Cliente */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                              {/* Demonstrativo Financeiro */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1.5">
                                  <span className="w-1.5 h-3.5 bg-green-500 rounded-full"></span>
                                  💰 Demonstrativo de Valores Somados
                                </h4>
                                <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-green-900/60 rounded-xl p-4 space-y-2.5 text-xs shadow-md">
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-400">🚗 Veículo ({j.selectedCarName || "Aluguel"}):</span>
                                    <span className="text-white font-bold font-mono">
                                      {fmtBRL(parsed.carPrice)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-400">🛡️ Proteções ({parsed.insurances.length} itens):</span>
                                    <span className="text-blue-300 font-bold font-mono">
                                      + {fmtBRL(parsed.insurancesTotal)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-400">📦 Extras & Equipamentos ({parsed.equipment.length} itens):</span>
                                    <span className="text-orange-300 font-bold font-mono">
                                      + {fmtBRL(parsed.equipmentTotal)}
                                    </span>
                                  </div>

                                  <div className="border-t border-gray-700 pt-2.5 mt-2 flex justify-between items-center">
                                    <div>
                                      <span className="text-xs font-black text-white uppercase block">Total Geral Somado</span>
                                      <span className="text-[10px] text-gray-500">Veículo + Proteções + Extras</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-xl font-black text-green-400 font-mono tracking-tight">
                                        {fmtBRL(parsed.totalPrice)}
                                      </span>
                                    </div>
                                  </div>

                                  {j.paymentMethod && (
                                    <div className="border-t border-gray-800/80 pt-2 flex justify-between items-center text-[11px]">
                                      <span className="text-gray-500">Forma de Pagamento:</span>
                                      <span className="text-purple-300 font-bold bg-purple-950/60 border border-purple-800/60 px-2 py-0.5 rounded">
                                        {j.paymentMethod}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Dados do Cliente & Sessão */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1.5">
                                  <span className="w-1.5 h-3.5 bg-purple-500 rounded-full"></span>
                                  👤 Cliente & Sessão
                                </h4>
                                <div className="bg-gray-900 border border-gray-800 rounded-xl p-3.5 space-y-2 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Cliente:</span>
                                    <span className="text-white font-bold truncate max-w-[200px]" title={parsed.customer?.name || j.userId || "Visitante"}>
                                      {parsed.customer?.name || j.userId || "Visitante anônimo"}
                                    </span>
                                  </div>
                                  {parsed.customer?.email && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">E-mail:</span>
                                      <span className="text-gray-300 font-mono text-[11px] truncate max-w-[200px]">{parsed.customer.email}</span>
                                    </div>
                                  )}
                                  {parsed.customer?.phone && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Telefone:</span>
                                      <span className="text-gray-300 font-mono text-[11px]">{parsed.customer.phone}</span>
                                    </div>
                                  )}
                                  {parsed.customer?.cpf && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">CPF:</span>
                                      <span className="text-gray-300 font-mono text-[11px]">{parsed.customer.cpf}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Session ID:</span>
                                    <span className="text-white font-mono text-[10px]">{j.sessionId?.slice(0, 16)}...</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">IP:</span>
                                    <span className="text-white font-mono text-[11px]">{j.ipAddress || "—"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Criado:</span>
                                    <span className="text-white">{fmtDate(j.createdAt)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Atualizado:</span>
                                    <span className="text-white">{fmtDate(j.updatedAt)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Journey Timeline */}
                            <div className="mt-5 pt-4 border-t border-gray-800">
                              <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Linha do Tempo</h4>
                              <div className="flex items-center gap-2">
                                {[1, 2, 3, 4, 5].map((s) => {
                                  const si = STEP_LABELS[s];
                                  const reached = s <= j.currentStep;
                                  return (
                                    <div key={s} className="flex items-center gap-2 flex-1">
                                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                        reached
                                          ? s === j.currentStep && j.status !== "COMPLETED"
                                            ? "bg-yellow-600/20 text-yellow-400 border border-yellow-600/30"
                                            : "bg-green-600/20 text-green-400 border border-green-600/30"
                                          : "bg-gray-800 text-gray-600 border border-gray-700"
                                      }`}>
                                        <span>{si.icon}</span>
                                        <span className="hidden md:inline">{si.label}</span>
                                      </div>
                                      {s < 5 && (
                                        <div className={`flex-1 h-0.5 rounded ${reached && s < j.currentStep ? "bg-green-600" : "bg-gray-700"}`}></div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
            <button
              onClick={() => fetchJourneys(page - 1)}
              disabled={page <= 1}
              className="text-xs font-bold text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              ← Anterior
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => fetchJourneys(p)}
                    className={`w-8 h-8 rounded text-xs font-bold transition-colors ${
                      p === page ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-800"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              {totalPages > 7 && <span className="text-gray-600 text-xs">...</span>}
            </div>
            <button
              onClick={() => fetchJourneys(page + 1)}
              disabled={page >= totalPages}
              className="text-xs font-bold text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              Próxima →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
