"use client";

import { useState, useEffect, useMemo } from "react";

interface RejectionKPIs {
  totalAmount: number;
  totalCount: number;
  avgTicket: number;
  reversible: { count: number; pct: number; amount: number };
  irreversible: { count: number; pct: number; amount: number };
  linxAntifraud: { count: number; pct: number; amount: number };
  unknownCodes: { count: number; pct: number; amount: number };
  topCauseByCount: any | null;
  topCauseByAmount: any | null;
}

interface TopRejectionItem {
  cardBrand: string;
  code: string;
  reason: string;
  rejectionCount: number;
  rejectionPct: number;
  lostAmount: number;
  avgTicket: number;
  rejectionType: string | null;
  canRetry: boolean | null;
  recommendedAction: string | null;
  responsibility: string | null;
}

interface AlertItem {
  id: string;
  level: "CRITICAL" | "HIGH" | "WARNING" | "INFO";
  title: string;
  message: string;
  code?: string;
  count: number;
}

interface RejectionLogItem {
  id: string;
  createdAt: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  cieloMerchantOrderId: string | null;
  cieloPaymentId: string | null;
  reservationId: string | null;
  amount: number;
  paymentMethod: string | null;
  provider: string;
  cardBrand: string | null;
  rejectionCategory: string;
  rejectionType: string | null;
  canRetry: boolean | null;
  returnCodeRaw: string | null;
  returnCodeNormalized: string | null;
  returnMessage: string | null;
  friendlyExplanation: string | null;
  recommendedAction: string | null;
  actionStatus: string | null;
  responsibility: string | null;
  rootCause: string | null;
  aiBehaviorInstruction: string | null;
  customerFriendlyMessage: string | null;
  retryPolicyText: string | null;
  mappingStatus: string;
  httpStatus: number | null;
  sourceEndpoint: string | null;
  rawPayload: any;
}

export default function PainelRecusasLogs() {
  // Navigation / View Tabs
  const [activeTab, setActiveTab] = useState<"analytics" | "cielo_raw">("analytics");

  // Filters State
  const [period, setPeriod] = useState<string>("30d");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
  const [selectedProvider, setSelectedProvider] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [selectedSpecialCode, setSelectedSpecialCode] = useState<string>("");
  const [isLinxOnly, setIsLinxOnly] = useState<boolean>(false);
  const [isUnknownOnly, setIsUnknownOnly] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  // Top 10 Chart Metric Toggle
  const [topMetric, setTopMetric] = useState<"count" | "amount">("count");

  // Data State
  const [loading, setLoading] = useState<boolean>(true);
  const [kpis, setKpis] = useState<RejectionKPIs | null>(null);
  const [top10, setTop10] = useState<{ byCount: TopRejectionItem[]; byAmount: TopRejectionItem[] }>({
    byCount: [],
    byAmount: []
  });
  const [charts, setCharts] = useState<any>({
    byBrand: [],
    byProvider: [],
    byCategory: [],
    byResponsibility: [],
    timeSeries: []
  });
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [logs, setLogs] = useState<RejectionLogItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });

  // Legacy LogCielo state
  const [cieloLogs, setCieloLogs] = useState<any[]>([]);

  // Selected Item Modal State
  const [selectedLog, setSelectedLog] = useState<RejectionLogItem | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Seeding status
  const [seedSuccess, setSeedSuccess] = useState<boolean | null>(null);

  // AI & MCP Modal State
  const [showAIModal, setShowAIModal] = useState<boolean>(false);
  const [aiModalTab, setAiModalTab] = useState<"chat" | "mcp">("chat");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    {
      role: "assistant",
      text: "Olá! Sou o Assistente de Inteligência Operacional da Europcar Brasil 🚗\nPosso analisar perdas, identificar causas de recusa, checar alertas de segurança ou redigir mensagens empáticas de recuperação para seus clientes."
    }
  ]);
  const [chatInput, setChatInput] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  // Load Data
  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "cielo_raw") {
        const res = await fetch("/api/admin/logs?view=log_cielo");
        const json = await res.json();
        setCieloLogs(json.logCielo || []);
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      params.set("period", period);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (selectedBrand !== "ALL") params.set("brand", selectedBrand);
      if (selectedProvider !== "ALL") params.set("provider", selectedProvider);
      if (selectedCategory !== "ALL") params.set("category", selectedCategory);
      if (selectedType !== "ALL") params.set("rejectionType", selectedType);
      if (selectedSpecialCode) params.set("specialCode", selectedSpecialCode);
      if (isLinxOnly) params.set("isLinxOnly", "true");
      if (isUnknownOnly) params.set("isUnknownOnly", "true");
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", "25");

      const res = await fetch(`/api/admin/logs?${params.toString()}`);
      if (!res.ok) throw new Error("Falha ao carregar métricas");
      const data = await res.json();

      setKpis(data.kpis || null);
      setTop10(data.top10 || { byCount: [], byAmount: [] });
      setCharts(data.charts || {});
      setAlerts(data.alerts || []);
      setLogs(data.logs || []);
      setPagination(data.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
    } catch (err) {
      console.error("Erro ao buscar logs analíticos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [
    activeTab,
    period,
    startDate,
    endDate,
    selectedBrand,
    selectedProvider,
    selectedCategory,
    selectedType,
    selectedSpecialCode,
    isLinxOnly,
    isUnknownOnly,
    page
  ]);

  // Handle Search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  // Drill-down from Top Chart directly to Table
  const handleDrillDown = (item: TopRejectionItem) => {
    if (item.code && item.code !== "SEM_CODIGO") {
      setSearch(item.code);
    } else {
      setSearch(item.reason);
    }
    if (item.cardBrand && item.cardBrand !== "N/A" && item.cardBrand !== "Cielo/Geral") {
      setSelectedBrand(item.cardBrand);
    }
    setPage(1);
  };

  // Reset all filters
  const resetFilters = () => {
    setPeriod("30d");
    setStartDate("");
    setEndDate("");
    setSelectedBrand("ALL");
    setSelectedProvider("ALL");
    setSelectedCategory("ALL");
    setSelectedType("ALL");
    setSelectedSpecialCode("");
    setIsLinxOnly(false);
    setIsUnknownOnly(false);
    setSearch("");
    setPage(1);
  };

  // Copy text helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // Trigger dictionary seed manually if needed
  const handleSeedDictionary = async () => {
    try {
      const res = await fetch("/api/admin/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" })
      });
      const data = await res.json();
      if (data.success) {
        setSeedSuccess(true);
        setTimeout(() => setSeedSuccess(null), 3500);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Chat message sender
  const handleSendChatMessage = async (presetText?: string) => {
    const textToSend = presetText || chatInput;
    if (!textToSend.trim() || chatLoading) return;

    setChatMessages((prev) => [...prev, { role: "user", text: textToSend }]);
    if (!presetText) setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: textToSend })
      });
      const data = await res.json();
      if (data.reply) {
        setChatMessages((prev) => [...prev, { role: "assistant", text: data.reply }]);
      } else {
        setChatMessages((prev) => [...prev, { role: "assistant", text: "Não foi possível obter resposta no momento." }]);
      }
    } catch (err: any) {
      setChatMessages((prev) => [...prev, { role: "assistant", text: "Erro ao comunicar com o assistente: " + err.message }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Top list according to toggle
  const currentTopItems = useMemo(() => {
    return topMetric === "count" ? top10.byCount : top10.byAmount;
  }, [topMetric, top10]);

  // Max value for progress bars
  const maxBarValue = useMemo(() => {
    if (!currentTopItems || currentTopItems.length === 0) return 1;
    return topMetric === "count"
      ? Math.max(...currentTopItems.map(i => i.rejectionCount)) || 1
      : Math.max(...currentTopItems.map(i => i.lostAmount)) || 1;
  }, [currentTopItems, topMetric]);

  return (
    <div className="space-y-6 pb-20 text-gray-100">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span className="p-2 bg-gradient-to-br from-red-500/20 to-rose-600/20 text-rose-400 rounded-xl border border-rose-500/30">
                🛡️
              </span>
              Painel de Recusas & Vendas Perdidas
            </h1>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Tempo Real
            </span>
          </div>
          <p className="text-gray-400 text-xs mt-1.5 max-w-3xl leading-relaxed">
            Observabilidade total de tentativas não efetivadas (Cielo, Linx Antifraude, XRS e Infraestrutura).
            Identifique causas-raiz, recupere vendas reversíveis e monitore alertas críticos de segurança.
          </p>
        </div>

        {/* View Switcher & Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="bg-gray-900 border border-gray-800 p-1 rounded-xl flex items-center text-xs font-semibold">
            <button
              onClick={() => setActiveTab("analytics")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "analytics"
                  ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              📊 Painel Analítico
            </button>
            <button
              onClick={() => setActiveTab("cielo_raw")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "cielo_raw"
                  ? "bg-purple-600 text-white font-bold shadow-md shadow-purple-600/20"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              📜 Logs Cielo Brutos
            </button>
          </div>

          <button
            onClick={handleSeedDictionary}
            title="Sincronizar Dicionário Oficial de 142 Códigos"
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 px-3 py-2 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <span>📖</span>
            {seedSuccess ? "Dicionário Sincronizado!" : "Sync Dicionário"}
          </button>

          <button
            onClick={() => setShowAIModal(true)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-all shadow-md shadow-purple-600/25 flex items-center gap-1.5"
          >
            <span>🤖</span>
            Assistente IA & MCP
          </button>

          <button
            onClick={fetchData}
            className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            🔄 Atualizar
          </button>
        </div>
      </div>

      {activeTab === "analytics" && (
        <>
          {/* OPERATIONAL ALERTS (Section 8.4 & 15) */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((al) => {
                const isCrit = al.level === "CRITICAL";
                const isHigh = al.level === "HIGH";
                const isWarn = al.level === "WARNING";

                const bgClass = isCrit
                  ? "bg-rose-950/40 border-rose-600/60 text-rose-200"
                  : isHigh
                  ? "bg-amber-950/40 border-amber-500/60 text-amber-200"
                  : isWarn
                  ? "bg-yellow-950/30 border-yellow-500/40 text-yellow-200"
                  : "bg-blue-950/30 border-blue-500/40 text-blue-200";

                const badgeBg = isCrit
                  ? "bg-rose-500 text-white font-black"
                  : isHigh
                  ? "bg-amber-500 text-slate-950 font-black"
                  : isWarn
                  ? "bg-yellow-400 text-slate-950 font-bold"
                  : "bg-blue-500 text-white font-bold";

                return (
                  <div
                    key={al.id}
                    className={`flex items-start justify-between p-3.5 rounded-xl border ${bgClass} shadow-sm backdrop-blur-sm`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] tracking-wider uppercase ${badgeBg}`}>
                        {al.level}
                      </span>
                      <div>
                        <h4 className="font-bold text-xs flex items-center gap-2">
                          {al.title}
                          {al.code && (
                            <span className="font-mono bg-black/40 px-1.5 py-0.2 rounded border border-white/10 text-[11px]">
                              Código: {al.code}
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] opacity-90 mt-0.5 leading-snug">{al.message}</p>
                      </div>
                    </div>
                    {al.code && (
                      <button
                        onClick={() => {
                          setSelectedSpecialCode(al.code || "");
                          setSearch(al.code || "");
                        }}
                        className="text-[11px] font-bold underline hover:opacity-80 shrink-0 ml-4"
                      >
                        Filtrar ({al.count})
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* GLOBAL FILTERS TOOLBAR (Section 12) */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Date Presets */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-gray-400 mr-1">Período:</span>
                {[
                  { id: "today", label: "Hoje" },
                  { id: "yesterday", label: "Ontem" },
                  { id: "7d", label: "Últimos 7 dias" },
                  { id: "30d", label: "Últimos 30 dias" },
                  { id: "all", label: "Todo Período" },
                  { id: "custom", label: "Personalizado" }
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPeriod(p.id);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      period === p.id
                        ? "bg-gray-700 text-white font-bold border border-gray-600 shadow-sm"
                        : "bg-gray-800/60 text-gray-400 hover:text-white border border-gray-800"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Special Filter Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setIsLinxOnly(!isLinxOnly);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                    isLinxOnly
                      ? "bg-purple-600 text-white border-purple-400"
                      : "bg-gray-800/80 text-purple-400 border-purple-500/30 hover:bg-purple-950/30"
                  }`}
                >
                  🛡️ Antifraude / Linx
                </button>
                <button
                  onClick={() => {
                    setIsUnknownOnly(!isUnknownOnly);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                    isUnknownOnly
                      ? "bg-amber-600 text-white border-amber-400"
                      : "bg-gray-800/80 text-amber-400 border-amber-500/30 hover:bg-amber-950/30"
                  }`}
                >
                  ❓ Não Mapeados
                </button>
                {(selectedBrand !== "ALL" ||
                  selectedProvider !== "ALL" ||
                  selectedCategory !== "ALL" ||
                  selectedType !== "ALL" ||
                  selectedSpecialCode ||
                  isLinxOnly ||
                  isUnknownOnly ||
                  search) && (
                  <button
                    onClick={resetFilters}
                    className="text-xs text-rose-400 hover:text-rose-300 font-medium underline px-1"
                  >
                    Limpar Filtros
                  </button>
                )}
              </div>
            </div>

            {/* Custom Dates if selected */}
            {period === "custom" && (
              <div className="flex items-center gap-3 pt-2 border-t border-gray-800/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">De:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-gray-950 border border-gray-700 text-white text-xs rounded-lg px-2.5 py-1.5 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Até:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-gray-950 border border-gray-700 text-white text-xs rounded-lg px-2.5 py-1.5 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
            )}

            {/* Dropdowns & Search Input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 pt-2 border-t border-gray-800/60">
              {/* Brand Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Bandeira
                </label>
                <select
                  value={selectedBrand}
                  onChange={(e) => {
                    setSelectedBrand(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-gray-950 border border-gray-700 text-white text-xs rounded-lg px-2.5 py-2 focus:border-emerald-500 outline-none"
                >
                  <option value="ALL">Todas as Bandeiras</option>
                  <option value="Visa">Visa</option>
                  <option value="Mastercard">Mastercard</option>
                  <option value="Elo">Elo</option>
                  <option value="AmEx">AmEx</option>
                  <option value="Hipercard">Hipercard</option>
                  <option value="Cielo/Geral">Cielo / Geral</option>
                </select>
              </div>

              {/* Provider Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Provedor
                </label>
                <select
                  value={selectedProvider}
                  onChange={(e) => {
                    setSelectedProvider(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-gray-950 border border-gray-700 text-white text-xs rounded-lg px-2.5 py-2 focus:border-emerald-500 outline-none"
                >
                  <option value="ALL">Todos os Provedores</option>
                  <option value="Cielo">Cielo</option>
                  <option value="Linx Online / Cielo">Linx Online / Lynx</option>
                  <option value="Europcar XRS">Europcar XRS</option>
                  <option value="Cielo / 3DS Lynx">3DS Client</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Categoria
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-gray-950 border border-gray-700 text-white text-xs rounded-lg px-2.5 py-2 focus:border-emerald-500 outline-none"
                >
                  <option value="ALL">Todas as Categorias</option>
                  <option value="INSUFFICIENT_FUNDS">Saldo Insuficiente</option>
                  <option value="ANTIFRAUD_LINX">Antifraude Linx</option>
                  <option value="CARD_BLOCKED">Cartão Bloqueado</option>
                  <option value="TRANSACTION_NOT_PERMITTED">Não Permitida</option>
                  <option value="FRAUD_SECURITY">Suspeita de Fraude</option>
                  <option value="SECURITY_BRUTE_FORCE">Ataque Força Bruta</option>
                  <option value="MERCHANT_CONFIGURATION">Configuração Loja (GF/GD)</option>
                  <option value="ISSUER_DECLINED">Negada Emissor (FG)</option>
                  <option value="SYSTEM_COMMUNICATION">Falha de Sistema</option>
                  <option value="XRS_RULES">Regras XRS</option>
                  <option value="UNKNOWN_CODE">Não Mapeado</option>
                </select>
              </div>

              {/* Reversibility Filter */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Tipo de Recusa
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => {
                    setSelectedType(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-gray-950 border border-gray-700 text-white text-xs rounded-lg px-2.5 py-2 focus:border-emerald-500 outline-none"
                >
                  <option value="ALL">Todos os Tipos</option>
                  <option value="REVERSÍVEL">Reversível (Pode Retentar)</option>
                  <option value="IRREVERSÍVEL">Irreversível (Bloqueado)</option>
                  <option value="N/A">Não Aplicável / Pendente</option>
                </select>
              </div>

              {/* Search Box */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Busca (Nome, Pedido, Código)
                </label>
                <form onSubmit={handleSearchSubmit} className="relative">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ex: 51, João, Cielo..."
                    className="w-full bg-gray-950 border border-gray-700 text-white text-xs rounded-lg pl-2.5 pr-8 py-2 focus:border-emerald-500 outline-none"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-2 text-gray-400 hover:text-white text-xs"
                  >
                    🔍
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* SECTION 9: KPIS OVERVIEW CARDS */}
          {loading && !kpis ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : kpis ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {/* 1. Valor Total Recusado */}
              <div className="bg-gradient-to-br from-rose-950/40 to-gray-900 border border-rose-500/30 p-4 rounded-2xl relative overflow-hidden">
                <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">Perda Financeira</span>
                <div className="text-xl font-black text-white mt-1">
                  {kpis.totalAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <div className="text-[11px] text-gray-400 mt-1 flex items-center justify-between">
                  <span>Ticket Médio:</span>
                  <span className="font-semibold text-gray-300">
                    {kpis.avgTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              </div>

              {/* 2. Total de Recusas */}
              <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total de Recusas</span>
                <div className="text-2xl font-black text-white mt-1">{kpis.totalCount}</div>
                <div className="text-[11px] text-gray-400 mt-1">tentativas não efetivadas</div>
              </div>

              {/* 3. Reversíveis (Oportunidade) */}
              <div className="bg-gradient-to-br from-emerald-950/30 to-gray-900 border border-emerald-500/30 p-4 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
                  <span>⚡</span> Potencial Recuperação
                </span>
                <div className="text-xl font-black text-emerald-300 mt-1">
                  {kpis.reversible.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <div className="text-[11px] text-emerald-400/90 mt-1 flex items-center justify-between">
                  <span>{kpis.reversible.count} recusas</span>
                  <span className="font-bold">({kpis.reversible.pct}%)</span>
                </div>
              </div>

              {/* 4. Irreversíveis */}
              <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Irreversíveis</span>
                <div className="text-lg font-bold text-gray-200 mt-1">
                  {kpis.irreversible.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <div className="text-[11px] text-gray-400 mt-1 flex items-center justify-between">
                  <span>{kpis.irreversible.count} recusas</span>
                  <span>({kpis.irreversible.pct}%)</span>
                </div>
              </div>

              {/* 5. Linx / Antifraude */}
              <div className="bg-purple-950/20 border border-purple-500/30 p-4 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider flex items-center gap-1">
                  <span>🛡️</span> Linx / Antifraude
                </span>
                <div className="text-lg font-bold text-purple-300 mt-1">
                  {kpis.linxAntifraud.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <div className="text-[11px] text-purple-400/80 mt-1 flex items-center justify-between">
                  <span>{kpis.linxAntifraud.count} bloqueios</span>
                  <span>({kpis.linxAntifraud.pct}%)</span>
                </div>
              </div>

              {/* 6. Não Mapeados */}
              <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Não Mapeados</span>
                <div className="text-lg font-bold text-amber-300 mt-1">{kpis.unknownCodes.count}</div>
                <div className="text-[11px] text-gray-400 mt-1">
                  {kpis.unknownCodes.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
              </div>

              {/* 7. Maior Causa */}
              <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Causa Líder</span>
                <div className="text-xs font-bold text-white mt-1 truncate" title={kpis.topCauseByCount?.reason || "N/A"}>
                  {kpis.topCauseByCount ? `${kpis.topCauseByCount.code} - ${kpis.topCauseByCount.reason}` : "Nenhuma"}
                </div>
                <div className="text-[11px] text-gray-400 mt-1">
                  {kpis.topCauseByCount ? `${kpis.topCauseByCount.rejectionCount} ocorrências` : "-"}
                </div>
              </div>
            </div>
          ) : null}

          {/* SECTION 10: GRÁFICO PRINCIPAL — TOP 10 MAIORES CAUSAS DE RECUSA */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>📊</span> Top 10 Maiores Causas de Recusa
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Agrupamento analítico por Bandeira + Código + Motivo amigável real. Clique na barra para filtrar a tabela.
                </p>
              </div>

              {/* Metric Selector Toggle (Section 10) */}
              <div className="flex items-center bg-gray-950 border border-gray-800 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
                <button
                  onClick={() => setTopMetric("count")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    topMetric === "count"
                      ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  🔢 Por Quantidade
                </button>
                <button
                  onClick={() => setTopMetric("amount")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    topMetric === "amount"
                      ? "bg-rose-600 text-white font-bold shadow-md shadow-rose-600/30"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  💰 Por Valor Perdido (R$)
                </button>
              </div>
            </div>

            {/* Horizontal Bar Chart Items */}
            {currentTopItems.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-xs">
                Nenhum evento registrado no período selecionado.
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {currentTopItems.map((item, idx) => {
                  const barValue = topMetric === "count" ? item.rejectionCount : item.lostAmount;
                  const pctWidth = Math.min(100, Math.max(8, (barValue / maxBarValue) * 100));

                  const isRev = item.canRetry === true || item.rejectionType === "REVERSÍVEL";
                  const isIrrev = item.canRetry === false || item.rejectionType === "IRREVERSÍVEL";

                  return (
                    <div
                      key={idx}
                      onClick={() => handleDrillDown(item)}
                      className="group cursor-pointer p-2.5 rounded-xl hover:bg-gray-800/60 transition-all border border-transparent hover:border-gray-700/60"
                      title="Clique para filtrar a tabela por esta causa"
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-gray-500 text-[11px] font-bold w-5">#{idx + 1}</span>
                          <span className="bg-gray-800 text-gray-200 px-2 py-0.5 rounded font-mono text-[11px] font-bold border border-gray-700">
                            {item.cardBrand} • {item.code}
                          </span>
                          <span className="font-semibold text-gray-200 truncate" title={item.reason}>
                            {item.reason}
                          </span>
                          {isRev && (
                            <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-1.5 py-0.2 rounded border border-emerald-500/20">
                              Reversível
                            </span>
                          )}
                          {isIrrev && (
                            <span className="bg-rose-500/10 text-rose-400 text-[10px] font-bold px-1.5 py-0.2 rounded border border-rose-500/20">
                              Irreversível
                            </span>
                          )}
                        </div>

                        <div className="text-right shrink-0 ml-3">
                          {topMetric === "count" ? (
                            <span className="font-bold text-white text-xs">
                              {item.rejectionCount}{" "}
                              <span className="text-gray-400 text-[11px] font-normal">
                                ({item.rejectionPct}%) • {item.lostAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </span>
                            </span>
                          ) : (
                            <span className="font-bold text-rose-400 text-xs">
                              {item.lostAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}{" "}
                              <span className="text-gray-400 text-[11px] font-normal">
                                ({item.rejectionCount}x • Médio: {item.avgTicket.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bar Fill */}
                      <div className="w-full bg-gray-950 rounded-full h-3 overflow-hidden border border-gray-800">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            topMetric === "count"
                              ? "bg-gradient-to-r from-blue-600 to-indigo-500 group-hover:from-blue-500 group-hover:to-indigo-400"
                              : "bg-gradient-to-r from-rose-600 to-orange-500 group-hover:from-rose-500 group-hover:to-orange-400"
                          }`}
                          style={{ width: `${pctWidth}%` }}
                        ></div>
                      </div>

                      {/* Micro Recommendation info on hover */}
                      {item.recommendedAction && (
                        <div className="text-[11px] text-gray-400 mt-1 opacity-80 group-hover:opacity-100 flex items-center gap-1">
                          <span className="text-emerald-400">💡 Ação recomendada:</span>
                          <span>{item.recommendedAction}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 11: GRÁFICOS COMPLEMENTARES */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Por Bandeira */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center justify-between">
                <span>💳 Por Bandeira</span>
                <span className="text-gray-500 font-mono text-[10px]">Total</span>
              </h4>
              <div className="space-y-2">
                {charts.byBrand?.slice(0, 5).map((b: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 font-medium">{b.brand}</span>
                    <span className="font-bold text-white">
                      {b.count}x <span className="text-gray-500 text-[10px]">({Number(b.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Por Provedor */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center justify-between">
                <span>⚙️ Por Provedor</span>
                <span className="text-gray-500 font-mono text-[10px]">Total</span>
              </h4>
              <div className="space-y-2">
                {charts.byProvider?.slice(0, 5).map((p: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 font-medium truncate max-w-[140px]">{p.provider}</span>
                    <span className="font-bold text-white">
                      {p.count}x <span className="text-gray-500 text-[10px]">({Number(p.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Por Responsabilidade */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center justify-between">
                <span>🏢 Por Responsabilidade</span>
                <span className="text-gray-500 font-mono text-[10px]">Origem</span>
              </h4>
              <div className="space-y-2">
                {charts.byResponsibility?.slice(0, 5).map((r: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 font-medium truncate max-w-[140px]" title={r.responsibility}>
                      {r.responsibility}
                    </span>
                    <span className="font-bold text-white">{r.count}x</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Categorias */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center justify-between">
                <span>📂 Top Categorias</span>
                <span className="text-gray-500 font-mono text-[10px]">Taxonomia</span>
              </h4>
              <div className="space-y-2">
                {charts.byCategory?.slice(0, 5).map((c: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 font-medium truncate max-w-[140px]" title={c.category}>
                      {c.category}
                    </span>
                    <span className="font-bold text-white">{c.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 13: TABELA PRINCIPAL DE EVENTOS REAIS */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg space-y-0">
            <div className="p-4 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>📑</span> Registro Detalhado de Recusas & Tentativas
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Exibindo {logs.length} de {pagination.total} evento(s) filtrados. Dados sensíveis de cartão mascarados.
                </p>
              </div>

              {/* Pagination controls */}
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:text-white disabled:opacity-40 text-xs font-medium border border-gray-700"
                >
                  ◀ Anterior
                </button>
                <span className="text-xs font-mono text-gray-400 px-1">
                  {page} / {pagination.totalPages || 1}
                </span>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-2.5 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:text-white disabled:opacity-40 text-xs font-medium border border-gray-700"
                >
                  Próxima ▶
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-950/70 border-b border-gray-800 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Data/Hora</th>
                    <th className="px-4 py-3">Cliente / Contato</th>
                    <th className="px-4 py-3">Pedido / ID</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Provedor / Bandeira</th>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Motivo Amigável & Ação</th>
                    <th className="px-4 py-3 text-center">Tipo</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                        Nenhuma recusa encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const isRev = log.canRetry === true || log.rejectionType === "REVERSÍVEL";
                      const isIrrev = log.canRetry === false || log.rejectionType === "IRREVERSÍVEL";
                      const isSpecial = ["FG", "GA", "GF", "GD", "GT", "GK"].includes(
                        (log.returnCodeNormalized || "").toUpperCase()
                      );

                      return (
                        <tr
                          key={log.id}
                          className={`hover:bg-gray-800/40 transition-colors ${
                            isSpecial ? "bg-rose-950/10" : ""
                          }`}
                        >
                          {/* Data/Hora */}
                          <td className="px-4 py-3 font-mono text-gray-400 whitespace-nowrap text-[11px]">
                            {new Date(log.createdAt).toLocaleString("pt-BR")}
                          </td>

                          {/* Cliente */}
                          <td className="px-4 py-3 max-w-[180px]">
                            <div className="font-semibold text-white truncate" title={log.customerName || "Desconhecido"}>
                              {log.customerName || "Não identificado"}
                            </div>
                            <div className="text-gray-400 text-[10px] truncate" title={log.customerEmail || ""}>
                              {log.customerEmail || log.customerPhone || "-"}
                            </div>
                          </td>

                          {/* IDs */}
                          <td className="px-4 py-3 font-mono text-[10px]">
                            <div className="text-gray-300 font-bold truncate max-w-[120px]" title={log.cieloMerchantOrderId || ""}>
                              {log.cieloMerchantOrderId || "Sem OrderId"}
                            </div>
                            <div className="text-gray-500 truncate max-w-[120px]" title={log.cieloPaymentId || ""}>
                              {log.cieloPaymentId ? `Pay: ${log.cieloPaymentId.slice(0, 10)}...` : "-"}
                            </div>
                          </td>

                          {/* Valor */}
                          <td className="px-4 py-3 font-bold text-white whitespace-nowrap">
                            {Number(log.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </td>

                          {/* Provedor / Bandeira */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-semibold text-gray-200">{log.cardBrand || "Geral"}</div>
                            <div className="text-gray-400 text-[10px]">{log.provider}</div>
                          </td>

                          {/* Código */}
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] border ${
                                isSpecial
                                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                  : "bg-gray-800 text-gray-200 border-gray-700"
                              }`}
                            >
                              {log.returnCodeNormalized || log.returnCodeRaw || "N/A"}
                            </span>
                          </td>

                          {/* Motivo & Ação */}
                          <td className="px-4 py-3 max-w-xs">
                            <div className="font-medium text-gray-200 line-clamp-1" title={log.friendlyExplanation || log.returnMessage || ""}>
                              {log.friendlyExplanation || log.returnMessage || "Sem mensagem"}
                            </div>
                            {log.recommendedAction && (
                              <div className="text-[10px] text-gray-400 truncate mt-0.5">
                                💡 {log.recommendedAction}
                              </div>
                            )}
                          </td>

                          {/* Tipo Reversível */}
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {isRev ? (
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                Reversível
                              </span>
                            ) : isIrrev ? (
                              <span className="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                Irreversível
                              </span>
                            ) : (
                              <span className="bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full text-[10px]">
                                N/A
                              </span>
                            )}
                          </td>

                          {/* Detalhes Button */}
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-700 transition-colors"
                            >
                              Detalhes 🔎
                            </button>
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

      {/* RAW CIELO LOGS TAB (Legacy Inspect) */}
      {activeTab === "cielo_raw" && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg">
          <div className="p-4 border-b border-gray-800">
            <h3 className="text-base font-bold text-white">📜 Logs Brutos de Integração da API Cielo</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Últimas 100 requisições e respostas salvas diretamente na tabela LogCielo.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-950/70 border-b border-gray-800 text-gray-400 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Data/Hora</th>
                  <th className="px-4 py-3">Endpoint</th>
                  <th className="px-4 py-3">Payload Seguro</th>
                  <th className="px-4 py-3">Resposta Bruta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {cieloLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-800/30 align-top">
                    <td className="px-4 py-3 font-mono text-gray-400 whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-200">{l.endpoint}</td>
                    <td className="px-4 py-3">
                      <pre className="bg-gray-950 p-2 rounded text-[10px] text-gray-300 max-h-24 max-w-sm overflow-auto border border-gray-800">
                        {l.payload}
                      </pre>
                    </td>
                    <td className="px-4 py-3">
                      <pre className="bg-gray-950 p-2 rounded text-[10px] text-gray-300 max-h-24 max-w-md overflow-auto border border-gray-800">
                        {l.response}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAIL MODAL (Section 13 & 8.3) */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 w-full max-w-3xl rounded-2xl p-6 space-y-5 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2.5 py-1 rounded text-sm font-bold">
                    {selectedLog.cardBrand} • Código {selectedLog.returnCodeNormalized || selectedLog.returnCodeRaw}
                  </span>
                  <span className="bg-gray-800 text-gray-300 px-2.5 py-1 rounded text-xs font-semibold">
                    {selectedLog.rejectionCategory}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white mt-2">
                  {selectedLog.friendlyExplanation || selectedLog.returnMessage}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-white p-2 text-lg"
              >
                ✕
              </button>
            </div>

            {/* Quick Metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-950 p-3.5 rounded-xl border border-gray-800 text-xs">
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Valor Tentativa</span>
                <span className="font-bold text-white text-sm">
                  {Number(selectedLog.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Data/Hora</span>
                <span className="text-gray-300 font-mono">
                  {new Date(selectedLog.createdAt).toLocaleString("pt-BR")}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Provedor</span>
                <span className="text-gray-300">{selectedLog.provider}</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Pode Retentar?</span>
                <span className={selectedLog.canRetry ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  {selectedLog.canRetry === true ? "SIM (Reversível)" : selectedLog.canRetry === false ? "NÃO (Irreversível)" : "Indefinido"}
                </span>
              </div>
            </div>

            {/* Customer & IDs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-gray-950 p-3.5 rounded-xl border border-gray-800">
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold mb-1">Dados do Cliente</span>
                <p className="text-white font-bold">{selectedLog.customerName || "Não informado"}</p>
                <p className="text-gray-400">{selectedLog.customerEmail || "Sem e-mail"}</p>
                <p className="text-gray-400">{selectedLog.customerPhone || "Sem telefone"}</p>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold mb-1">Identificadores</span>
                <div className="space-y-1 font-mono text-[11px]">
                  <p className="text-gray-300 flex items-center justify-between">
                    <span>Order ID:</span>
                    <button
                      onClick={() => copyToClipboard(selectedLog.cieloMerchantOrderId || "", "orderId")}
                      className="font-bold text-blue-400 hover:underline"
                    >
                      {selectedLog.cieloMerchantOrderId || "-"} 📋
                    </button>
                  </p>
                  <p className="text-gray-300 flex items-center justify-between">
                    <span>Payment ID:</span>
                    <button
                      onClick={() => copyToClipboard(selectedLog.cieloPaymentId || "", "payId")}
                      className="font-bold text-blue-400 hover:underline truncate max-w-[180px]"
                    >
                      {selectedLog.cieloPaymentId || "-"} 📋
                    </button>
                  </p>
                </div>
              </div>
            </div>

            {/* Responsibility & Root Cause */}
            <div className="space-y-2 text-xs">
              <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                <span className="text-[10px] uppercase font-bold text-indigo-400 block mb-1">
                  Atribuição de Responsabilidade:
                </span>
                <p className="text-gray-200 font-semibold">{selectedLog.responsibility || "Não especificada"}</p>
                {selectedLog.rootCause && (
                  <p className="text-gray-400 text-[11px] mt-1">Causa Raiz: {selectedLog.rootCause}</p>
                )}
              </div>

              {/* Recommended Action */}
              {selectedLog.recommendedAction && (
                <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">
                    Ação Recomendada pela Operação:
                  </span>
                  <p className="text-gray-200">{selectedLog.recommendedAction}</p>
                </div>
              )}

              {/* AI Behavior Instruction (Section 8.3) */}
              {selectedLog.aiBehaviorInstruction && (
                <div className="bg-purple-950/30 border border-purple-500/40 p-3.5 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-purple-300 block mb-1 flex items-center gap-1">
                    <span>🤖</span> Diretriz de Comportamento para IA & Atendimento:
                  </span>
                  <p className="text-purple-200 text-xs leading-relaxed">{selectedLog.aiBehaviorInstruction}</p>
                </div>
              )}

              {/* Customer Friendly Message (Ready to copy for WhatsApp/Email) */}
              {selectedLog.customerFriendlyMessage && (
                <div className="bg-emerald-950/30 border border-emerald-500/40 p-3.5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-emerald-300 flex items-center gap-1">
                      <span>💬</span> Mensagem Amigável para Enviar ao Cliente:
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(selectedLog.customerFriendlyMessage || "", "clientMsg")
                      }
                      className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-2.5 py-1 rounded text-xs transition-colors"
                    >
                      {copiedText === "clientMsg" ? "Copiado! ✓" : "Copiar Texto 📋"}
                    </button>
                  </div>
                  <p className="text-emerald-100 text-xs italic bg-black/40 p-2.5 rounded-lg border border-emerald-500/20">
                    &ldquo;{selectedLog.customerFriendlyMessage}&rdquo;
                  </p>
                </div>
              )}
            </div>

            {/* Sanitized Raw Payload (Section 13) */}
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                Payload Sanitizado (Sem PAN completo / Sem CVV):
              </span>
              <pre className="bg-gray-950 p-3 rounded-xl text-[11px] font-mono text-gray-300 border border-gray-800 max-h-48 overflow-auto scrollbar-thin">
                {JSON.stringify(selectedLog.rawPayload, null, 2)}
              </pre>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2 border-t border-gray-800">
              <button
                onClick={() => setSelectedLog(null)}
                className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI & MCP HYBRID MODAL */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 w-full max-w-4xl rounded-3xl p-6 space-y-5 shadow-2xl relative my-8 max-h-[92vh] flex flex-col">
            {/* Header & Tabs */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 text-purple-400 rounded-2xl border border-purple-500/30 text-lg">
                  🤖
                </span>
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    Assistente de Inteligência Operacional & MCP
                  </h3>
                  <p className="text-xs text-gray-400">
                    Conectado ao banco de recusas, XRS Europcar e ao protocolo MCP da Anthropic
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="bg-gray-950 border border-gray-800 p-1 rounded-xl flex items-center text-xs font-semibold">
                  <button
                    onClick={() => setAiModalTab("chat")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      aiModalTab === "chat"
                        ? "bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    💬 Chat com a IA
                  </button>
                  <button
                    onClick={() => setAiModalTab("mcp")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      aiModalTab === "mcp"
                        ? "bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    🔌 Conectar Claude Desktop (MCP)
                  </button>
                </div>

                <button
                  onClick={() => setShowAIModal(false)}
                  className="text-gray-400 hover:text-white p-2 text-lg ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* TAB 1: CHAT COM A IA */}
            {aiModalTab === "chat" && (
              <div className="flex flex-col flex-1 min-h-0 space-y-4">
                {/* Suggestions Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0 scrollbar-none">
                  <span className="text-[11px] text-gray-500 font-bold shrink-0">Sugestões rápidas:</span>
                  {[
                    "Qual o valor total de perdas e recusas de hoje?",
                    "Existe algum alerta de segurança crítico ou erro de IP?",
                    "Quais as 5 maiores causas de recusa da semana?",
                    "Como recuperar vendas reversíveis com Pix?"
                  ].map((sug, idx) => (
                    <button
                      key={idx}
                      disabled={chatLoading}
                      onClick={() => handleSendChatMessage(sug)}
                      className="bg-gray-950 hover:bg-gray-800 text-gray-300 text-[11px] px-3 py-1.5 rounded-xl border border-gray-800 shrink-0 transition-colors hover:border-purple-500/40 text-left disabled:opacity-50"
                    >
                      💡 {sug}
                    </button>
                  ))}
                </div>

                {/* Messages Box */}
                <div className="flex-1 overflow-y-auto space-y-3.5 bg-gray-950 p-4 rounded-2xl border border-gray-800 scrollbar-thin">
                  {chatMessages.map((msg, idx) => {
                    const isAssistant = msg.role === "assistant";
                    return (
                      <div
                        key={idx}
                        className={`flex gap-3 text-xs ${
                          isAssistant ? "items-start" : "items-start flex-row-reverse"
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                            isAssistant
                              ? "bg-purple-600 text-white"
                              : "bg-blue-600 text-white"
                          }`}
                        >
                          {isAssistant ? "IA" : "EU"}
                        </div>
                        <div
                          className={`p-3.5 rounded-2xl max-w-[85%] whitespace-pre-wrap leading-relaxed ${
                            isAssistant
                              ? "bg-gray-900 border border-gray-800 text-gray-200"
                              : "bg-blue-600/20 border border-blue-500/30 text-blue-100 font-medium"
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })}
                  {chatLoading && (
                    <div className="flex items-center gap-2 text-xs text-purple-400 p-2 animate-pulse">
                      <span>🤖</span> Consultando banco de dados e processando resposta...
                    </div>
                  )}
                </div>

                {/* Input form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChatMessage();
                  }}
                  className="flex items-center gap-2 shrink-0 pt-1"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Pergunte sobre perdas, pedidos, causas de recusa, alertas ou mensagens para clientes..."
                    className="flex-1 bg-gray-950 border border-gray-700 text-white text-xs rounded-xl px-4 py-3 focus:border-purple-500 outline-none"
                    disabled={chatLoading}
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold px-5 py-3 rounded-xl text-xs transition-colors shadow-md shadow-purple-600/30 shrink-0"
                  >
                    Enviar ➔
                  </button>
                </form>
              </div>
            )}

            {/* TAB 2: CONEXÃO COM O CLAUDE DESKTOP (MCP) */}
            {aiModalTab === "mcp" && (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
                {/* Status Box */}
                <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-gray-900 border border-indigo-500/30 p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
                    <div>
                      <h4 className="font-bold text-white text-sm">Servidor MCP Ativo & Pronto</h4>
                      <p className="text-gray-400 text-[11px] mt-0.5">
                        Protocolo Model Context Protocol (Anthropic) compatível com Claude Desktop, Claude Code e Cursor.
                      </p>
                    </div>
                  </div>
                  <span className="bg-emerald-500/20 text-emerald-300 font-bold px-3 py-1 rounded-full border border-emerald-500/30 text-[11px]">
                    Status: ONLINE
                  </span>
                </div>

                {/* Instruções de Instalação */}
                <div className="bg-gray-950 border border-gray-800 p-4 rounded-2xl space-y-3">
                  <h4 className="font-bold text-white text-xs flex items-center gap-2">
                    <span>📌</span> Como conectar no Claude Desktop:
                  </h4>
                  <ol className="list-decimal list-inside space-y-1.5 text-gray-300 text-[11px] leading-relaxed">
                    <li>
                      Abra o Claude Desktop e acesse: <code className="bg-gray-900 px-1.5 py-0.5 rounded text-indigo-300">Settings &gt; Developer &gt; Edit Config</code>.
                    </li>
                    <li>
                      No arquivo <code className="bg-gray-900 px-1.5 py-0.5 rounded text-indigo-300">claude_desktop_config.json</code>, adicione a configuração abaixo:
                    </li>
                  </ol>

                  {/* Config Snippet */}
                  <div className="relative">
                    <pre className="bg-black/80 text-gray-200 p-3.5 rounded-xl font-mono text-[11px] border border-gray-800 overflow-x-auto">
{`{
  "mcpServers": {
    "europcar-brasil": {
      "url": "https://europcar.seudominio.com.br/api/mcp",
      "headers": {
        "Authorization": "Bearer SUA_MCP_API_KEY"
      }
    }
  }
}`}
                    </pre>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          JSON.stringify(
                            {
                              mcpServers: {
                                "europcar-brasil": {
                                  url: typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "https://europcar.seudominio.com.br/api/mcp",
                                  headers: {
                                    Authorization: "Bearer SUA_MCP_API_KEY"
                                  }
                                }
                              }
                            },
                            null,
                            2
                          ),
                          "mcpConfig"
                        )
                      }
                      className="absolute top-2.5 right-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1 rounded-lg text-xs transition-colors"
                    >
                      {copiedText === "mcpConfig" ? "Copiado! ✓" : "Copiar JSON 📋"}
                    </button>
                  </div>
                </div>

                {/* Lista de Ferramentas Expostas */}
                <div className="bg-gray-950 border border-gray-800 p-4 rounded-2xl space-y-3">
                  <h4 className="font-bold text-white text-xs flex items-center justify-between">
                    <span>🛠️ Ferramentas (Tools) Nativas Expostas ao Claude / MCP:</span>
                    <span className="text-gray-500 text-[10px]">Model Context Protocol v2024-11-05</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {[
                      {
                        name: "relatorio_vendas",
                        desc: "Relatório de faturamento total, reservas, divisão Pix vs Cartão vs Balcão e ticket médio."
                      },
                      {
                        name: "consultar_reserva",
                        desc: "Busca completa de reserva por resNumber, OrderId, cliente ou status."
                      },
                      {
                        name: "cancelar_reserva",
                        desc: "Cancela no XRS Europcar, atualiza banco, cancela na Cielo e envia e-mail ao cliente."
                      },
                      {
                        name: "alterar_reserva",
                        desc: "Modifica datas, horários, estações ou categoria de veículo no XRS Europcar."
                      },
                      {
                        name: "reenviar_email_confirmacao",
                        desc: "Reenvia voucher oficial com proteções, valores e instruções ao cliente."
                      },
                      {
                        name: "consultar_recusas_kpis",
                        desc: "Consulta perda total em R$, ticket médio, reversíveis e causas líderes em tempo real."
                      },
                      {
                        name: "consultar_recusas_lista",
                        desc: "Filtra e lista recusas recentes por bandeira, código, categoria ou cliente."
                      },
                      {
                        name: "detalhar_recusa",
                        desc: "Puxa causa-raiz, responsabilidade atribuída e instrução de IA por Order ID ou Payment ID."
                      },
                      {
                        name: "verificar_alertas_seguranca",
                        desc: "Detecta ataques de força bruta (GT/GK), erros de IP na Cielo (GF) e retenções Linx (GA)."
                      },
                      {
                        name: "gerar_mensagem_recuperacao",
                        desc: "Redige mensagem empática e profissional para WhatsApp/E-mail oferecendo Pix."
                      },
                      {
                        name: "consultar_cupons",
                        desc: "Consulta cupons ativos, percentuais de desconto e limites de utilização."
                      },
                      {
                        name: "criar_cupom",
                        desc: "Cria um novo cupom de desconto promocional no sistema."
                      },
                      {
                        name: "consultar_logs_sistema",
                        desc: "Inspeciona requisições e respostas brutas da Cielo (LogCielo) e XRS (LogXRS)."
                       },
                       {
                         name: "consultar_disponibilidade",
                         desc: "Consulta categorias ACRISS por loja e período: estado (disponível, sob requisição ou ausente), preço por dia e total, com markup ETO."
                       },
                       {
                         name: "listar_estacoes",
                         desc: "Lista lojas Europcar por país/busca ou detalha uma estação (horários, antecedência mínima)."
                      }
                    ].map((tool, idx) => (
                      <div key={idx} className="bg-gray-900/80 border border-gray-800/80 p-3 rounded-xl">
                        <div className="font-mono text-purple-300 font-bold text-[11px]">{tool.name}</div>
                        <div className="text-gray-400 text-[10px] mt-1 leading-snug">{tool.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
