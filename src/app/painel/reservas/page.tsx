"use client";

import { useState, useEffect, Fragment } from "react";
import { computeReservationMetrics } from "@/lib/europcar/reservationMetrics";
import { listContractedProtections, isZeroExcessBooking } from "@/lib/europcar/protectionSummary";
import StationCode from "@/components/admin/StationCode";

// Status de pagamento (existentes)
const PAYMENT_STATUS_OPTIONS = [
   { value: "ALL", label: "Todos", color: "bg-gray-700 text-gray-300" },
   { value: "CONFIRMED_PREPAID", label: "Pago Online", color: "bg-green-500/20 text-green-400" },
   { value: "PENDING_PIX", label: "PIX Pendente", color: "bg-yellow-500/20 text-yellow-400" },
   { value: "CONFIRMED_NON_PREPAID", label: "Pagar no Balcão", color: "bg-blue-500/20 text-blue-400" },
   { value: "ON_REQUEST", label: "⏳ Sob Consulta", color: "bg-amber-500/20 text-amber-400" },
   { value: "ON_REQUEST_REJECTED", label: "❌ Recusada (OR)", color: "bg-orange-500/20 text-orange-400" },
   { value: "CANCELLED", label: "Cancelada", color: "bg-red-500/20 text-red-400" },
   { value: "CANCELLED_GREENWAY", label: "Cancelada (Greenway)", color: "bg-red-600/20 text-red-300" },
   { value: "NO_SHOW", label: "No Show", color: "bg-gray-500/20 text-gray-400" },
   { value: "CHECKED_OUT", label: "Check-out", color: "bg-purple-500/20 text-purple-400" },
];

const STATUS_COLORS: Record<string, string> = {
   "CONFIRMED_PREPAID": "bg-green-500/20 text-green-400 border-green-600/30",
   "PENDING_PIX": "bg-yellow-500/20 text-yellow-400 border-yellow-600/30",
   "CONFIRMED_NON_PREPAID": "bg-blue-500/20 text-blue-300 border-blue-600/30",
   "ON_REQUEST": "bg-amber-500/20 text-amber-400 border-amber-600/30",
   "ON_REQUEST_REJECTED": "bg-orange-500/20 text-orange-400 border-orange-600/30",
   "CANCELLED": "bg-red-500/20 text-red-400 border-red-600/30",
   "CANCELLED_GREENWAY": "bg-red-600/20 text-red-300 border-red-500/30",
   "NO_SHOW": "bg-gray-500/20 text-gray-400 border-gray-500/30",
   "CHECKED_OUT": "bg-purple-500/20 text-purple-400 border-purple-500/30",
};
const STATUS_LABELS: Record<string, string> = {
   "CONFIRMED_PREPAID": "Pago Online (Cielo)",
   "PENDING_PIX": "PIX Aguardando",
   "CONFIRMED_NON_PREPAID": "Pagar no Balcão",
   "ON_REQUEST": "⏳ Sob Consulta",
   "ON_REQUEST_REJECTED": "❌ Recusada (OR)",
   "CANCELLED": "Cancelada / Erro",
   "CANCELLED_GREENWAY": "Cancelada (Greenway)",
   "NO_SHOW": "No Show",
   "CHECKED_OUT": "Check-out Realizado",
};

// Status Operacionais (novos)
const OP_STATUS_CONFIG: Record<string, { label: string; description: string; color: string; group: string }> = {
   R:  { label: "R",  description: "On Request",       color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",  group: "momentaneo" },
   S:  { label: "S",  description: "Sold",             color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40", group: "momentaneo" },
   CF: { label: "CF", description: "Confirmed",        color: "bg-blue-500/20 text-blue-400 border-blue-500/40",       group: "momentaneo" },
   CC: { label: "CC", description: "Cancelled",        color: "bg-red-500/20 text-red-400 border-red-500/40",          group: "concluido" },
   CP: { label: "CP", description: "Cancelled Prepaid", color: "bg-orange-500/20 text-orange-400 border-orange-500/40", group: "concluido" },
   CO: { label: "CO", description: "Checked Out",      color: "bg-purple-500/20 text-purple-400 border-purple-500/40", group: "concluido" },
   TD: { label: "TD", description: "Turn Down",        color: "bg-gray-600/30 text-gray-400 border-gray-500/40",       group: "concluido" },
   NS: { label: "NS", description: "No Show",          color: "bg-gray-500/20 text-gray-500 border-gray-500/40",       group: "concluido" },
};

const OP_STATUS_FILTER_OPTIONS = [
   { value: "ALL", label: "Todos", color: "bg-gray-700 text-gray-300" },
   { value: "ACTIVE", label: "Momentâneos", color: "bg-cyan-500/20 text-cyan-400" },
   { value: "R",  label: "R - On Request", color: "bg-yellow-500/20 text-yellow-400" },
   { value: "S",  label: "S - Sold", color: "bg-emerald-500/20 text-emerald-400" },
   { value: "CF", label: "CF - Confirmed", color: "bg-blue-500/20 text-blue-400" },
   { value: "DONE", label: "Concluídos", color: "bg-gray-600/20 text-gray-400" },
   { value: "CC", label: "CC - Cancelled", color: "bg-red-500/20 text-red-400" },
   { value: "CP", label: "CP - Cancelled Prepaid", color: "bg-orange-500/20 text-orange-400" },
   { value: "CO", label: "CO - Checked Out", color: "bg-purple-500/20 text-purple-400" },
   { value: "TD", label: "TD - Turn Down", color: "bg-gray-600/30 text-gray-400" },
   { value: "NS", label: "NS - No Show", color: "bg-gray-500/20 text-gray-500" },
];

const TIME_OPTIONS_24H = Array.from({ length: 48 }, (_, i) => {
   const h = String(Math.floor(i / 2)).padStart(2, '0');
   const m = i % 2 === 0 ? '00' : '30';
   return `${h}${m}`;
});

// Símbolo da moeda local real da reserva (ex.: THB → ฿, EUR → €, CHF → CHF)
function curSym(code?: string): string {
  const c = (code || 'EUR').toUpperCase();
  try {
    const part = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: c }).formatToParts(0).find(p => p.type === 'currency');
    return part?.value || c;
  } catch { return c; }
}

function getTimeOptions(current?: string) {
   if (current && !TIME_OPTIONS_24H.includes(current) && /^\d{4}$/.test(current)) {
      return [...TIME_OPTIONS_24H, current].sort();
   }
   return TIME_OPTIONS_24H;
}

export default function PainelReservas() {
   const [reservations, setReservations] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
   const [statusFilter, setStatusFilter] = useState("ALL");
   const [opStatusFilter, setOpStatusFilter] = useState("ALL");
   const [search, setSearch] = useState("");
   const [startDate, setStartDate] = useState("");
   const [endDate, setEndDate] = useState("");
   const [expandedRow, setExpandedRow] = useState<string | null>(null);
   const [changingStatus, setChangingStatus] = useState<string | null>(null);
   const [changingOpStatus, setChangingOpStatus] = useState<string | null>(null);
   const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
   const [cancelModal, setCancelModal] = useState<{ id: string; resNumber: string } | null>(null);

   // Modify modal (admin)
   const [modifyModal, setModifyModal] = useState<any | null>(null);
   const [adminModifyData, setAdminModifyData] = useState<{
      pickupDate: string; pickupTime: string; pickupStationID: string;
      returnDate: string; returnTime: string; returnStationID: string;
      carCategory: string; flightNumber: string;
   }>({ pickupDate: '', pickupTime: '1000', pickupStationID: '', returnDate: '', returnTime: '1000', returnStationID: '', carCategory: '', flightNumber: '' });
   const [adminModifying, setAdminModifying] = useState(false);
   const [adminModifyMsg, setAdminModifyMsg] = useState('');
   const [resendingEmail, setResendingEmail] = useState<string | null>(null);
   const [emailPreview, setEmailPreview] = useState<any | null>(null);
   const [selectedCurrency, setSelectedCurrency] = useState<string>('BRL');
   const [customAmount, setCustomAmount] = useState<string>('');
   const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
   const [resendingCancelEmail, setResendingCancelEmail] = useState<string | null>(null);
   const [emailDropdown, setEmailDropdown] = useState<string | null>(null);
   const [syncLoading, setSyncLoading] = useState(false);
   const [syncResult, setSyncResult] = useState<any | null>(null);
   const [syncingSingle, setSyncingSingle] = useState<string | null>(null);

   // ── Modal de XML da Reserva ──
   const [xmlModalOpen, setXmlModalOpen] = useState(false);
   const [xmlModalReservation, setXmlModalReservation] = useState<any | null>(null);
   const [xmlLoading, setXmlLoading] = useState(false);
   const [xmlLogsLoading, setXmlLogsLoading] = useState(false);
   const [xmlData, setXmlData] = useState<{
      liveXml?: any;
      liveError?: string | null;
      logs?: any[];
   } | null>(null);
   const [xmlViewType, setXmlViewType] = useState<'response' | 'request'>('response');
   const [selectedLogIndex, setSelectedLogIndex] = useState<number>(-1);
   const [xmlCopied, setXmlCopied] = useState(false);
   const [formatXml, setFormatXml] = useState(true);

   // ── Nova Reserva Manual ──
   const [manualModalOpen, setManualModalOpen] = useState(false);
   const [manualSaving, setManualSaving] = useState(false);
   const [manualForm, setManualForm] = useState({
      nome: '',
      sobrenome: '',
      email: '',
      telefone: '',
      cpf: '',
      paisEmissao: 'BR',
      pickupStation: '',
      returnStation: '',
      pickupDate: '',
      pickupTime: '1000',
      returnDate: '',
      returnTime: '1000',
      carCategory: 'EDMR',
      carName: '',
      amountBRL: '',
      amountCounter: '',
      taxaDevolucao: '',
      paymentMethod: 'BALCAO',
      status: 'CONFIRMED_NON_PREPAID',
      operationalStatus: 'CF',
      sendToGW: false,
   });

   // ── Sincronizar / Importar por Nº do GreenWay ──
   const [syncGWModalOpen, setSyncGWModalOpen] = useState(false);
   const [syncGWResNumber, setSyncGWResNumber] = useState('');
   const [syncGWLoading, setSyncGWLoading] = useState(false);
   const [syncGWSaving, setSyncGWSaving] = useState(false);
   const [syncGWData, setSyncGWData] = useState<any | null>(null);
   const [syncGWEditForm, setSyncGWEditForm] = useState({
      nome: '',
      sobrenome: '',
      email: '',
      telefone: '',
      cpf: '',
      paisEmissao: 'BR',
      pickupStation: '',
      returnStation: '',
      pickupDate: '',
      pickupTime: '1000',
      returnDate: '',
      returnTime: '1000',
      carCategory: '',
      carName: '',
      amountBRL: '',
      amountCounter: '',
      taxaDevolucao: '',
      paymentMethod: 'BALCAO',
      operationalStatus: 'CF',
      status: 'CONFIRMED_NON_PREPAID',
   });

   const handleOpenManualModal = () => {
      setManualForm({
         nome: '',
         sobrenome: '',
         email: '',
         telefone: '',
         cpf: '',
         paisEmissao: 'BR',
         pickupStation: '',
         returnStation: '',
         pickupDate: '',
         pickupTime: '1000',
         returnDate: '',
         returnTime: '1000',
         carCategory: 'EDMR',
         carName: '',
         amountBRL: '',
         amountCounter: '',
         taxaDevolucao: '',
         paymentMethod: 'BALCAO',
         status: 'CONFIRMED_NON_PREPAID',
         operationalStatus: 'CF',
         sendToGW: false,
      });
      setManualModalOpen(true);
   };

   const handleSaveManual = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!manualForm.nome.trim() || !manualForm.sobrenome.trim() || !manualForm.email.trim()) {
         return showToast('Preencha nome, sobrenome e e-mail do cliente.', 'error');
      }
      if (!manualForm.pickupStation.trim() || !manualForm.pickupDate || !manualForm.returnDate || !manualForm.carCategory.trim()) {
         return showToast('Preencha os dados da locação (estação, datas e categoria).', 'error');
      }

      setManualSaving(true);
      try {
         const res = await fetch('/api/admin/reservas/cadastrar-manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(manualForm),
         });
         const data = await res.json();
         if (!res.ok || data.error) {
            showToast(`Erro ao cadastrar: ${data.error || 'Falha no servidor'}`, 'error');
         } else {
            if (data.gwSent) {
               showToast(`✅ Reserva criada e enviada ao GreenWay! Nº ${data.gwResNumber}`, 'success');
            } else if (data.gwError) {
               showToast(`⚠️ Salva localmente, mas GW retornou: ${data.gwError}`, 'error');
            } else {
               showToast('✅ Reserva manual criada com sucesso!', 'success');
            }
            setManualModalOpen(false);
            fetchReservations();
         }
      } catch (err: any) {
         showToast(`Erro de conexão: ${err.message}`, 'error');
      } finally {
         setManualSaving(false);
      }
   };

   const handleOpenSyncGWModal = () => {
      setSyncGWResNumber('');
      setSyncGWData(null);
      setSyncGWModalOpen(true);
   };

   const handleSearchInGW = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!syncGWResNumber.trim()) {
         return showToast('Digite o número da reserva no GreenWay', 'error');
      }

      setSyncGWLoading(true);
      setSyncGWData(null);
      try {
         const res = await fetch('/api/admin/reservas/consultar-greenway', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resNumber: syncGWResNumber.trim() }),
         });
         const data = await res.json();
         if (!res.ok || data.error) {
            showToast(`❌ ${data.error || 'Reserva não encontrada no GreenWay'}`, 'error');
         } else {
            setSyncGWData(data);
            const d = data.data || {};
            const quoteTotal = d.quote?.totalRateEstimateInBookingCurrency || d.quote?.totalRateEstimate || '';
            setSyncGWEditForm({
               nome: d.driver?.firstName || '',
               sobrenome: d.driver?.lastName || '',
               email: d.driver?.email || '',
               telefone: d.driver?.phone || '',
               cpf: '',
               paisEmissao: d.driver?.country || 'BR',
               pickupStation: d.pickupStation || '',
               returnStation: d.returnStation || d.pickupStation || '',
               pickupDate: d.pickupDateFormatted || (d.pickupDate?.length === 8 ? `${d.pickupDate.slice(0,4)}-${d.pickupDate.slice(4,6)}-${d.pickupDate.slice(6,8)}` : ''),
               pickupTime: d.pickupTime || '1000',
               returnDate: d.returnDateFormatted || (d.returnDate?.length === 8 ? `${d.returnDate.slice(0,4)}-${d.returnDate.slice(4,6)}-${d.returnDate.slice(6,8)}` : ''),
               returnTime: d.returnTime || '1000',
               carCategory: d.carCategory || '',
               carName: d.carCategory || '',
               amountBRL: quoteTotal,
               amountCounter: '',
               taxaDevolucao: '',
               paymentMethod: 'BALCAO',
               operationalStatus: d.xrsStatusCode || 'CF',
               status: 'CONFIRMED_NON_PREPAID',
            });
            showToast(`✅ Dados da reserva ${d.resNumber} carregados do GreenWay!`, 'success');
         }
      } catch (err: any) {
         showToast(`Erro de conexão: ${err.message}`, 'error');
      } finally {
         setSyncGWLoading(false);
      }
   };

   const handleSaveImportedFromGW = async () => {
      if (!syncGWData?.data?.resNumber) return;
      if (!syncGWEditForm.nome.trim() || !syncGWEditForm.sobrenome.trim() || !syncGWEditForm.email.trim()) {
         return showToast('Por favor, preencha nome, sobrenome e e-mail do cliente.', 'error');
      }

      setSyncGWSaving(true);
      try {
         const payload = {
            ...syncGWEditForm,
            resNumber: syncGWData.data.resNumber,
            overwriteIfExists: !!syncGWData.alreadyExistsLocally,
         };
         const res = await fetch('/api/admin/reservas/cadastrar-manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
         });
         const data = await res.json();
         if (!res.ok || data.error) {
            showToast(`Erro ao cadastrar: ${data.error}`, 'error');
         } else {
            showToast(`✅ Reserva ${syncGWData.data.resNumber} cadastrada no sistema!`, 'success');
            setSyncGWModalOpen(false);
            setSyncGWData(null);
            fetchReservations();
         }
      } catch (err: any) {
         showToast(`Erro de conexão: ${err.message}`, 'error');
      } finally {
         setSyncGWSaving(false);
      }
   };

   const showToast = (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
   };

   // ── Formatador de XML com indentação limpa ──
   const formatXmlString = (xml: string): string => {
      if (!xml) return '';
      try {
         let formatted = '';
         let indent = 0;
         const tab = '  ';
         const cleaned = xml.replace(/>\s*</g, '><').trim();
         const tokens = cleaned.split(/(<[^>]+>)/g).filter(Boolean);

         for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i].trim();
            if (!token) continue;

            if (token.startsWith('</')) {
               indent = Math.max(0, indent - 1);
               formatted += tab.repeat(indent) + token + '\n';
            } else if (token.startsWith('<') && (token.endsWith('/>') || token.startsWith('<?') || token.startsWith('<!'))) {
               formatted += tab.repeat(indent) + token + '\n';
            } else if (token.startsWith('<')) {
               if (i + 2 < tokens.length && !tokens[i + 1].startsWith('<') && tokens[i + 2].startsWith('</')) {
                  formatted += tab.repeat(indent) + token + tokens[i + 1] + tokens[i + 2] + '\n';
                  i += 2;
               } else {
                  formatted += tab.repeat(indent) + token + '\n';
                  indent++;
               }
            } else {
               formatted += tab.repeat(indent) + token + '\n';
            }
         }
         return formatted.trim();
      } catch {
         return xml;
      }
   };

   const getXmlResNum = (res: any) =>
      res?.resNumber && res.resNumber !== res.merchantOrderId ? res.resNumber : (res?.resNumber || res?.merchantOrderId);

   const fetchXmlPart = async (res: any, mode: 'logs' | 'live') => {
      const response = await fetch('/api/admin/reservas/xml', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ resNumber: getXmlResNum(res), merchantOrderId: res.merchantOrderId, mode }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Falha na resposta');
      return data;
   };

   const loadLiveXml = async (res: any, notify = false) => {
      setXmlLoading(true);
      try {
         const data = await fetchXmlPart(res, 'live');
         setXmlData(prev => ({ ...(prev || {}), liveXml: data.liveXml, liveError: data.liveError }));
         if (notify) {
            setSelectedLogIndex(-1);
            showToast('XML atualizado diretamente do GreenWay!', 'success');
         }
      } catch (err: any) {
         setXmlData(prev => ({ ...(prev || {}), liveXml: null, liveError: err.message }));
      } finally {
         setXmlLoading(false);
      }
   };

   const handleOpenXmlModal = async (res: any) => {
      setXmlModalReservation(res);
      setXmlModalOpen(true);
      setXmlData(null);
      setXmlViewType('response');
      setSelectedLogIndex(-1);
      setXmlCopied(false);

      // Consulta ao vivo (GreenWay, lenta) e histórico (banco, rápido) em paralelo.
      let liveDone = false;
      const livePromise = loadLiveXml(res).finally(() => { liveDone = true; });

      setXmlLogsLoading(true);
      try {
         const data = await fetchXmlPart(res, 'logs');
         const logs = data.logs || [];
         setXmlData(prev => ({ ...(prev || {}), logs }));
         // Se o GreenWay ainda está respondendo, já exibe o histórico mais relevante
         if (!liveDone && logs.length > 0) {
            const bookIdx = logs.findIndex((l: any) => l.action === 'bookReservation');
            setSelectedLogIndex(bookIdx >= 0 ? bookIdx : 0);
         }
      } catch (err: any) {
         showToast(`Erro ao carregar histórico XML: ${err.message}`, 'error');
      } finally {
         setXmlLogsLoading(false);
      }
      await livePromise;
   };

   const handleRefreshLiveXml = async () => {
      if (!xmlModalReservation) return;
      setSelectedLogIndex(-1);
      await loadLiveXml(xmlModalReservation, true);
   };

   const handleCopyXml = (text: string) => {
      if (!text) return;
      navigator.clipboard.writeText(text);
      setXmlCopied(true);
      showToast('XML copiado para a área de transferência!', 'success');
      setTimeout(() => setXmlCopied(false), 2000);
   };

   const handleDownloadXml = (text: string, filename: string) => {
      if (!text) return;
      const blob = new Blob([text], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Arquivo ${filename} baixado!`, 'success');
   };


   const handleSyncSingleGreenway = async (resNumber: string) => {
      setSyncingSingle(resNumber);
      try {
         showToast(`Consultando status da reserva ${resNumber} no GreenWay...`);
         const res = await fetch('/api/reservas/sync-greenway', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resNumber }),
         });
         const data = await res.json();
         if (!res.ok || data.error) {
            showToast(`Erro ao consultar GreenWay: ${data.error || 'Falha na resposta'}`, "error");
         } else if (data.changes > 0) {
            const item = data.results?.[0];
            showToast(`✅ GreenWay atualizado! Status: ${item?.xrsStatus || item?.newOpStatus || 'Confirmado'}`, "success");
            fetchReservations();
         } else {
            const item = data.results?.[0];
            const statusMsg = item?.xrsStatus
               ? `GreenWay: ${item.xrsStatus} (${item.newOpStatus}) — sem alteração necessária.`
               : `Status no GreenWay já está em dia ou sem alteração.`;
            showToast(statusMsg, "success");
            fetchReservations();
         }
      } catch (e: any) {
         showToast(`Erro de conexão: ${e.message}`, "error");
      } finally {
         setSyncingSingle(null);
      }
   };

   const handleViewReceipt = (resNumber: string) => {
      const key = resNumber || '';
      if (!key) return;
      window.open(`/api/receipt/${encodeURIComponent(key)}`, '_blank');
   };

   // Abre preview do e-mail antes de enviar
   const handleOpenEmailPreview = async (resNumber: string) => {
      const key = resNumber || '';
      if (!key) return;
      setLoadingPreview(key);
      try {
         const r = await fetch(`/api/admin/resend-email/${encodeURIComponent(key)}/preview`);
         const data = await r.json();
         if (r.ok) {
            setEmailPreview(data);
            // Pré-preenche moeda e valor com os dados detectados
            setSelectedCurrency(data.localeCurrency || 'BRL');
            setCustomAmount(data.localAmount > 0 ? data.localAmount.toFixed(2) : (data.amountBRL || 0).toFixed(2));
         } else {
            showToast(`❌ Erro ao carregar preview: ${data.error || ''}`, 'error');
         }
      } catch {
         showToast('❌ Erro de conexão ao carregar preview', 'error');
      } finally {
         setLoadingPreview(null);
      }
   };

   // Reenviar e-mail com trigger específico
   const handleResendWithTrigger = async (resNumber: string, trigger: string) => {
      const key = resNumber || '';
      if (!key) return;
      const triggerLabels: Record<string,string> = { RESERVA_SUCESSO: 'Confirmação', CANCELAMENTO: 'Cancelamento', RESERVA_SOB_SOLICITACAO: 'Sob Solicitação' };
      if (!confirm(`Deseja reenviar o e-mail de "${triggerLabels[trigger] || trigger}" para o cliente?`)) return;
      setResendingCancelEmail(key);
      setEmailDropdown(null);
      try {
         const r = await fetch(`/api/admin/resend-email/${encodeURIComponent(key)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trigger }),
         });
         const data = await r.json();
         if (r.ok) {
            showToast(`✅ E-mail de ${triggerLabels[trigger]} reenviado para ${data.sentTo}`);
         } else {
            showToast(`❌ Erro: ${data.error || 'Falha ao reenviar'}`, 'error');
         }
      } catch {
         showToast('❌ Erro de conexão ao reenviar e-mail', 'error');
      } finally {
         setResendingCancelEmail(null);
      }
   };

   // Reenvia e-mail (chamado após confirmação no modal de preview)
   const handleResendEmail = async (resNumber: string) => {
      const key = resNumber || '';
      if (!key) return;
      setResendingEmail(key);
      try {
         const r = await fetch(`/api/admin/resend-email/${encodeURIComponent(key)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currency: selectedCurrency, amount: parseFloat(customAmount) || undefined }),
         });
         const data = await r.json();
         if (r.ok) {
            showToast(`✅ E-mail reenviado para ${data.sentTo} · ${data.localeCurrency || ''}`, 'success');
            setEmailPreview(null);
         } else {
            showToast(`❌ Erro: ${data.error || 'Falha ao reenviar e-mail'}`, 'error');
         }
      } catch {
         showToast('❌ Erro de conexão ao reenviar e-mail', 'error');
      } finally {
         setResendingEmail(null);
      }
   };

   const fetchReservations = async () => {
      setLoading(true);
      try {
         const params = new URLSearchParams();
         if (statusFilter !== "ALL") params.set("status", statusFilter);
         if (search) params.set("search", search);
         if (startDate) params.set("startDate", startDate);
         if (endDate) params.set("endDate", endDate);
         if (opStatusFilter !== "ALL" && opStatusFilter !== "ACTIVE" && opStatusFilter !== "DONE") {
            params.set("operationalStatus", opStatusFilter);
         }
         const res = await fetch(`/api/admin/reservations?${params}`);
         const data = await res.json();
         let items = Array.isArray(data) ? data : [];

         if (opStatusFilter === "ACTIVE") {
            items = items.filter((r: any) => ["R", "S", "CF"].includes(r.operationalStatus || "R"));
         } else if (opStatusFilter === "DONE") {
            items = items.filter((r: any) => ["CC", "CP", "CO", "TD", "NS"].includes(r.operationalStatus || ""));
         }

         setReservations(items);
      } catch (e) {
         console.error(e);
      } finally {
         setLoading(false);
      }
   };

   useEffect(() => { fetchReservations(); }, [statusFilter, opStatusFilter, startDate, endDate]);

   const handleSearch = (e: React.FormEvent) => {
      e.preventDefault();
      fetchReservations();
   };

   const handleChangeStatus = async (id: string, newStatus: string) => {
      if (!confirm(`Deseja alterar o status desta reserva para "${STATUS_LABELS[newStatus] || newStatus}"?`)) return;
      try {
         const res = await fetch(`/api/admin/reservations/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
         });
         if (res.ok) {
            showToast("Status atualizado!");
            fetchReservations();
            setChangingStatus(null);
         } else {
            showToast("Erro ao atualizar", "error");
         }
      } catch (e) {
         showToast("Erro de conexão", "error");
      }
   };

   const handleChangeOpStatus = async (id: string, newOpStatus: string) => {
      const config = OP_STATUS_CONFIG[newOpStatus];
      if (!confirm(`Alterar status operacional para "${config?.label} - ${config?.description}"?`)) return;
      try {
         const res = await fetch(`/api/admin/reservations/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operationalStatus: newOpStatus }),
         });
         if (res.ok) {
            showToast(`Status operacional atualizado para ${config?.label}!`);
            fetchReservations();
            setChangingOpStatus(null);
         } else {
            showToast("Erro ao atualizar", "error");
         }
      } catch (e) {
         showToast("Erro de conexão", "error");
      }
   };

   const handleCheckPix = async (orderId: string) => {
      if (!orderId) return showToast("Pedido não possui Order ID", "error");
      try {
         showToast("Verificando PIX na Cielo...");
         const res = await fetch(`/api/reservas/pix-status?orderId=${orderId}`);
         const data = await res.json();
         if (data.status === "PAID") {
            showToast("PIX Pago! Reserva confirmada e e-mail enviado.", "success");
            fetchReservations();
         } else {
            showToast("PIX ainda não pago na Cielo.", "error");
         }
      } catch (e) {
         showToast("Erro ao verificar PIX", "error");
      }
   };

   // Reenvia a reserva ao GreenWay (XRS Europcar) manualmente.
   // Útil quando o pagamento foi aprovado mas o bookReservation falhou.
   const handleReenviarXRS = async (reservationId: string) => {
      if (!confirm("Enviar esta reserva ao GreenWay (Europcar)? Isso criará o registro oficial no sistema Europcar.")) return;
      try {
         showToast("⏳ Enviando ao GreenWay...");
         const res = await fetch('/api/admin/reservas/reenviar-xrs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reservationId }),
         });
         const data = await res.json();
         if (data.success) {
            showToast(`✅ Enviado ao GreenWay! Reserva: ${data.resNumber}${data.isOnRequest ? ' (On Request)' : ''}`, "success");
            fetchReservations();
         } else {
            showToast(`❌ ${data.error || 'Falha ao reenviar ao GreenWay'}`, "error");
         }
      } catch (e) {
         showToast("Erro de conexão ao reenviar", "error");
      }
   };


   const handleDelete = async (id: string) => {
      try {
         const res = await fetch(`/api/admin/reservations/${id}`, { method: "DELETE" });
         const data = await res.json();
         if (res.ok) {
            if (data.xrsCancelled) {
               showToast("Reserva cancelada na Europcar e no sistema local!");
            } else {
               showToast("Reserva cancelada localmente. Verifique o portal Europcar se necessário.", "success");
            }
            fetchReservations();
         } else {
            showToast(data.error || "Erro ao cancelar", "error");
         }
      } catch (e) {
         showToast("Erro de conexão", "error");
      } finally {
         setCancelModal(null);
      }
   };

   // ── Admin Modify ──
   const openModifyModal = (res: any) => {
      const parsed = typeof res.customerData === 'string' ? JSON.parse(res.customerData) : (res.customerData || {});
      setModifyModal({ ...res, parsed });
      setAdminModifyData({
         pickupDate: parsed?.booking?.pickupDate ? `${parsed.booking.pickupDate.slice(0,4)}-${parsed.booking.pickupDate.slice(4,6)}-${parsed.booking.pickupDate.slice(6,8)}` : '',
         pickupTime: parsed?.booking?.pickupTime || '1000',
         pickupStationID: parsed?.booking?.pickupStation || '',
         returnDate: parsed?.booking?.returnDate ? `${parsed.booking.returnDate.slice(0,4)}-${parsed.booking.returnDate.slice(4,6)}-${parsed.booking.returnDate.slice(6,8)}` : '',
         returnTime: parsed?.booking?.returnTime || '1000',
         returnStationID: parsed?.booking?.returnStation || parsed?.booking?.pickupStation || '',
         carCategory: parsed?.booking?.car?.carCategoryCode || '',
         flightNumber: parsed?.flightNumber || '',
      });
      setAdminModifyMsg('');
   };

   const handleAdminModify = async () => {
      if (!modifyModal?.resNumber) return;
      setAdminModifying(true);
      setAdminModifyMsg('');
      try {
         const parsed = modifyModal.parsed || {};
         const payload: any = {
            resNumber: modifyModal.resNumber,
            firstName: parsed?.nome || parsed?.firstName || 'Admin',
            lastName: parsed?.sobrenome || parsed?.lastName || 'Europcar',
         };
         const origPickupDate = (parsed?.booking?.pickupDate || '').replace(/-/g, '');
         const newPickupDate = (adminModifyData.pickupDate || '').replace(/-/g, '');
         if (newPickupDate && newPickupDate !== origPickupDate) {
            payload.pickupDate = newPickupDate;
         }

         const origPickupTime = String(parsed?.booking?.pickupTime || '');
         const newPickupTime = String(adminModifyData.pickupTime || '');
         if (newPickupTime && newPickupTime !== origPickupTime) {
            payload.pickupTime = newPickupTime;
         }

         const origPickupStation = String(parsed?.booking?.pickupStation || '').trim();
         const newPickupStation = String(adminModifyData.pickupStationID || '').trim();
         if (newPickupStation && newPickupStation !== origPickupStation) {
            payload.pickupStationID = newPickupStation;
         }

         const origReturnDate = (parsed?.booking?.returnDate || '').replace(/-/g, '');
         const newReturnDate = (adminModifyData.returnDate || '').replace(/-/g, '');
         if (newReturnDate && newReturnDate !== origReturnDate) {
            payload.returnDate = newReturnDate;
         }

         const origReturnTime = String(parsed?.booking?.returnTime || '');
         const newReturnTime = String(adminModifyData.returnTime || '');
         if (newReturnTime && newReturnTime !== origReturnTime) {
            payload.returnTime = newReturnTime;
         }

         const origReturnStation = String(parsed?.booking?.returnStation || parsed?.booking?.pickupStation || '').trim();
         const newReturnStation = String(adminModifyData.returnStationID || '').trim();
         if (newReturnStation && newReturnStation !== origReturnStation) {
            payload.returnStationID = newReturnStation;
         }

         const origCarCategory = String(parsed?.booking?.car?.carCategoryCode || '').trim();
         const newCarCategory = String(adminModifyData.carCategory || '').trim();
         if (newCarCategory && newCarCategory !== origCarCategory) {
            payload.carCategory = newCarCategory;
         }

         // Número do voo: só envia se foi alterado (permite também apagar)
         const origFlight = String(parsed?.flightNumber || '').trim().toUpperCase();
         const newFlight = adminModifyData.flightNumber.trim().toUpperCase();
         if (newFlight !== origFlight) {
            payload.flightNumber = newFlight;
         }

         const res = await fetch('/api/europcar/modifyReservation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-modify': 'true' },
            body: JSON.stringify(payload)
         });
         const data = await res.json();
         if (data.success) {
            setAdminModifyMsg(data.warning ? `⚠️ ${data.warning}` : '✅ Reserva modificada com sucesso!');
            setTimeout(() => { setModifyModal(null); setAdminModifyMsg(''); fetchReservations(); }, 2500);
         } else {
            setAdminModifyMsg(`❌ Erro: ${data.error || data.returnCode || 'Falha ao modificar'}`);
         }
      } catch (e: any) {
         setAdminModifyMsg(`❌ ${e.message}`);
      } finally {
         setAdminModifying(false);
      }
   };

   const parsedReservations = reservations.map(r => {
      let parsed: any = {};
      try { parsed = typeof r.customerData === 'string' ? JSON.parse(r.customerData) : r.customerData; } catch(e){}
      const metrics = computeReservationMetrics(r, parsed);
      return { ...r, parsed, metrics };
   });

   const isPendingPixFilter = statusFilter === "PENDING_PIX";
   const isCancelledFilter = statusFilter === "CANCELLED" || statusFilter === "CANCELLED_GREENWAY";

   const counts: Record<string, number> = { ALL: reservations.length };
   reservations.forEach(r => {
      counts[r.status] = (counts[r.status] || 0) + 1;
      if (r.status === 'CANCELLED_GREENWAY') {
         counts.CANCELLED = (counts.CANCELLED || 0) + 1;
      }
   });

   const opCounts: Record<string, number> = { ALL: reservations.length, ACTIVE: 0, DONE: 0 };
   reservations.forEach(r => {
      const op = r.operationalStatus || "R";
      opCounts[op] = (opCounts[op] || 0) + 1;
      if (["R", "S", "CF"].includes(op)) opCounts.ACTIVE++;
      else opCounts.DONE++;
   });

   const activeList = parsedReservations.filter(r => r.metrics.isActive);
   const pendingPixList = parsedReservations.filter(r => r.metrics.isPendingPix);
   const cancelledList = parsedReservations.filter(r => r.metrics.isCancelled);

   const targetList = isPendingPixFilter
      ? pendingPixList
      : isCancelledFilter
      ? cancelledList
      : activeList;

   const totalActiveBRL = targetList.reduce((sum, r) => sum + r.metrics.totalGeralBRL, 0);
   const totalActiveOnlineBRL = targetList.reduce((sum, r) => sum + r.metrics.onlinePaidBRL, 0);
   const totalActiveCounterBRL = targetList.reduce((sum, r) => sum + r.metrics.counterDueBRL, 0);
   const totalCancelledBRL = cancelledList.reduce((sum, r) => sum + r.metrics.totalGeralBRL, 0);
   const totalPendingPixBRL = pendingPixList.reduce((sum, r) => sum + r.metrics.totalGeralBRL, 0);

   return (
      <div className="space-y-6">
         {/* ── E-mail Preview Modal ── */}
         {emailPreview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
               <div className="bg-gray-900 border border-indigo-800/40 rounded-2xl p-0 max-w-lg w-full shadow-2xl overflow-hidden">
                  {/* Header */}
                  <div className="bg-indigo-950 px-6 py-4 flex items-center justify-between border-b border-indigo-800/40">
                     <div>
                        <h2 className="text-white font-bold text-base">✉️ Preview do E-mail</h2>
                        <p className="text-indigo-300 text-xs mt-0.5">Confirme os dados antes de enviar</p>
                     </div>
                     <button onClick={() => setEmailPreview(null)} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                     </button>
                  </div>
                  {/* Body */}
                  <div className="px-6 py-5 space-y-4">
                     {/* Destinatário */}
                     <div className="bg-gray-800 rounded-xl p-4">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">Destinatário</p>
                        <p className="text-white font-semibold">{emailPreview.customerName}</p>
                        <p className="text-indigo-300 text-sm">{emailPreview.toEmail}</p>
                     </div>
                     {/* Reserva */}
                     <div className="bg-gray-800 rounded-xl p-4">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">Reserva</p>
                        <p className="text-white font-mono font-bold text-lg">{emailPreview.resNumber}</p>
                        <p className="text-gray-400 text-sm">{emailPreview.carName} · {emailPreview.carCategory}</p>
                        <p className="text-gray-400 text-sm mt-1">{emailPreview.pickupStation} → {emailPreview.returnStation}</p>
                     </div>
                     {/* Seletor de Moeda e Valor */}
                     <div className="bg-indigo-950 border border-indigo-700/50 rounded-xl p-4 space-y-3">
                        <p className="text-[10px] text-indigo-400 uppercase font-bold tracking-wider">Valor no E-mail</p>
                        {/* Moeda detectada automaticamente */}
                        {emailPreview._debug?.step2_stationCurrency && (
                           <p className="text-xs text-green-400">
                              ✅ Moeda detectada pela estação <span className="font-mono font-bold">{emailPreview._debug.pickupStation_raw}</span> → <span className="font-mono font-bold">{emailPreview._debug.step2_stationCurrency}</span>
                           </p>
                        )}
                        {emailPreview.amountBRL > 0 && (
                           <p className="text-xs text-gray-500">Cobrado em BRL (Cielo): <span className="font-mono font-bold text-gray-300">R$ {emailPreview.amountBRL?.toFixed(2).replace('.', ',')}</span></p>
                        )}
                        {/* Seletor de moeda */}
                        <div>
                           <label className="text-[10px] text-indigo-400 uppercase font-bold tracking-wider block mb-1">Moeda do e-mail</label>
                           <select
                              value={selectedCurrency}
                              onChange={e => setSelectedCurrency(e.target.value)}
                              className="w-full bg-gray-800 border border-indigo-700/50 text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                           >
                              <option value="BRL">🇧🇷 BRL — Real Brasileiro</option>
                              <option value="EUR">🇪🇺 EUR — Euro</option>
                              <option value="USD">🇺🇸 USD — Dólar Americano</option>
                              <option value="GBP">🇬🇧 GBP — Libra Esterlina</option>
                              <option value="CHF">🇨🇭 CHF — Franco Suíço</option>
                              <option value="ARS">🇦🇷 ARS — Peso Argentino</option>
                              <option value="CAD">🇨🇦 CAD — Dólar Canadense</option>
                              <option value="AUD">🇦🇺 AUD — Dólar Australiano</option>
                              <option value="JPY">🇯🇵 JPY — Iene Japonês</option>
                              <option value="MXN">🇲🇽 MXN — Peso Mexicano</option>
                              <option value="CLP">🇨🇱 CLP — Peso Chileno</option>
                              <option value="COP">🇨🇴 COP — Peso Colombiano</option>
                              <option value="PEN">🇵🇪 PEN — Sol Peruano</option>
                              <option value="NOK">🇳🇴 NOK — Coroa Norueguesa</option>
                              <option value="SEK">🇸🇪 SEK — Coroa Sueca</option>
                              <option value="DKK">🇩🇰 DKK — Coroa Dinamarquesa</option>
                              <option value="PLN">🇵🇱 PLN — Zloty Polonês</option>
                           </select>
                        </div>
                        {/* Valor editável */}
                        <div>
                           <label className="text-[10px] text-indigo-400 uppercase font-bold tracking-wider block mb-1">Valor ({selectedCurrency})</label>
                           <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={customAmount}
                              onChange={e => setCustomAmount(e.target.value)}
                              placeholder="Ex: 285.50"
                              className="w-full bg-gray-800 border border-indigo-700/50 text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                           />
                        </div>
                        {/* Preview do valor formatado */}
                        {customAmount && parseFloat(customAmount) > 0 && (
                           <div className="bg-indigo-900/30 rounded-lg px-3 py-2">
                              <p className="text-[10px] text-indigo-400 uppercase tracking-wider mb-0.5">Aparecerá no e-mail como:</p>
                              <p className="text-xl font-black text-indigo-200">
                                 {(() => { try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedCurrency, minimumFractionDigits: selectedCurrency === 'JPY' ? 0 : 2 }).format(parseFloat(customAmount)); } catch { return `${selectedCurrency} ${parseFloat(customAmount).toFixed(2)}`; } })()}
                              </p>
                           </div>
                        )}
                     </div>
                  </div>
                  {/* Footer */}
                  <div className="px-6 pb-5 flex gap-3">
                     <button onClick={() => setEmailPreview(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl text-sm transition-colors">
                        Cancelar
                     </button>
                     <button
                        onClick={() => handleResendEmail(emailPreview.resNumber)}
                        disabled={!!resendingEmail}
                        className="flex-1 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-wait text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                     >
                        {resendingEmail ? (
                           <><svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>Enviando...</>
                        ) : (
                           <>✉️ Confirmar e Enviar</>
                        )}
                     </button>
                  </div>
               </div>
            </div>
         )}
         {cancelModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
               <div className="bg-gray-900 border border-red-800/40 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
                  <div className="flex items-center gap-3 mb-4">
                     <div className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                        </svg>
                     </div>
                     <div>
                        <h3 className="text-lg font-black text-white">Confirmar Cancelamento</h3>
                        <p className="text-xs text-gray-500">Reserva: <span className="text-white font-mono">{cancelModal.resNumber}</span></p>
                     </div>
                  </div>
                  <div className="bg-yellow-950/40 border border-yellow-700/30 rounded-xl p-4 mb-6 space-y-1.5">
                     <p className="text-xs font-bold text-yellow-300 mb-2 flex items-center gap-1.5">
                        <span>📋</span> Política de Cancelamento Europcar
                     </p>
                     <p className="text-xs text-yellow-200/80">• Mais de 48h de antecedência: <strong className="text-yellow-200">sem cobrança.</strong></p>
                     <p className="text-xs text-yellow-200/80">• Entre 24h e 48h antes: <strong className="text-yellow-200">50% do valor da primeira diária.</strong></p>
                     <p className="text-xs text-yellow-200/80">• Menos de 24h ou no-show: <strong className="text-yellow-200">100% da primeira diária.</strong></p>
                     <p className="text-xs text-yellow-200/80">• Modalidade &quot;Pagar no Balcão&quot; (NP): <strong className="text-yellow-200">cancelamento gratuito.</strong></p>
                  </div>
                  <div className="flex gap-3">
                     <button onClick={() => setCancelModal(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2.5 rounded-xl text-sm transition-colors">Manter Reserva</button>
                     <button onClick={() => handleDelete(cancelModal.id)} className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">Confirmar Cancelamento</button>
                  </div>
               </div>
            </div>
         )}

         {/* ── Modal: Visualizar e Baixar XML da Reserva (XRS / GreenWay) ── */}
         {xmlModalOpen && (() => {
            const rawCurrentXml = (() => {
               if (selectedLogIndex === -1) {
                  return xmlViewType === 'response'
                     ? (xmlData?.liveXml?.xmlResponse || '')
                     : (xmlData?.liveXml?.xmlRequest || '');
               }
               const log = xmlData?.logs?.[selectedLogIndex];
               return xmlViewType === 'response' ? (log?.xmlResponse || '') : (log?.xmlRequest || '');
            })();
            const displayedXml = formatXml ? formatXmlString(rawCurrentXml) : rawCurrentXml;
            const resNum = xmlModalReservation?.resNumber && xmlModalReservation?.resNumber !== xmlModalReservation?.merchantOrderId
               ? xmlModalReservation.resNumber
               : (xmlModalReservation?.resNumber || xmlModalReservation?.merchantOrderId || 'reserva');
            const suffix = selectedLogIndex === -1 ? 'greenway_live' : (xmlData?.logs?.[selectedLogIndex]?.action || 'log');
            const currentDownloadFilename = `reserva_${resNum}_${suffix}_${xmlViewType}.xml`;

            return (
               <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setXmlModalOpen(false)}>
                  <div className="bg-gray-900 border border-emerald-500/40 rounded-2xl max-w-5xl w-full p-6 shadow-2xl flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
                     {/* Cabeçalho */}
                     <div className="flex items-center justify-between pb-4 border-b border-gray-800">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                              </svg>
                           </div>
                           <div>
                              <div className="flex items-center gap-2">
                                 <h2 className="text-lg font-black text-white">XML da Reserva</h2>
                                 <span className="font-mono text-sm px-2.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                                    {resNum}
                                 </span>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                 Cliente: <span className="text-gray-200 font-semibold">{xmlModalReservation?.customerData?.nome || xmlModalReservation?.parsed?.nome || '—'} {xmlModalReservation?.customerData?.sobrenome || xmlModalReservation?.parsed?.sobrenome || ''}</span> • 
                                 Merchant Order: <span className="font-mono text-gray-300">{xmlModalReservation?.merchantOrderId}</span>
                              </p>
                           </div>
                        </div>
                        <button
                           onClick={() => setXmlModalOpen(false)}
                           className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
                           title="Fechar"
                        >
                           ✕
                        </button>
                     </div>

                     {/* Controles e Seletores */}
                     <div className="py-4 border-b border-gray-800/80 flex flex-wrap items-center justify-between gap-3">
                        {/* Seletor de Origem: Live XRS vs Logs históricos */}
                        <div className="flex items-center gap-2 flex-wrap">
                           <span className="text-xs font-bold text-gray-400">Origem:</span>
                           <button
                              onClick={() => setSelectedLogIndex(-1)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                 selectedLogIndex === -1
                                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                              }`}
                           >
                              <span className={`inline-block w-2 h-2 rounded-full bg-emerald-400 ${xmlLoading ? 'animate-ping' : 'animate-pulse'}`}></span>
                              GreenWay XRS (Ao Vivo){xmlLoading ? ' — consultando...' : ''}
                           </button>

                           {xmlLogsLoading && (
                              <span className="text-[11px] text-gray-500 flex items-center gap-1.5">
                                 <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>
                                 Carregando histórico...
                              </span>
                           )}

                           {xmlData?.logs && xmlData.logs.length > 0 && (
                              <select
                                 value={selectedLogIndex}
                                 onChange={(e) => setSelectedLogIndex(Number(e.target.value))}
                                 className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border outline-none cursor-pointer ${
                                    selectedLogIndex >= 0
                                       ? 'bg-blue-600/30 text-blue-300 border-blue-500'
                                       : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                                 }`}
                              >
                                 <option value={-1}>Ou ver log histórico do banco ({xmlData.logs.length} encontrados)...</option>
                                 {xmlData.logs.map((log: any, idx: number) => (
                                    <option key={log.id} value={idx}>
                                       Log #{idx + 1}: {log.action} ({new Date(log.createdAt).toLocaleString('pt-BR')}) {log.hasError ? '⚠️ Erro' : '✓ OK'}
                                    </option>
                                 ))}
                              </select>
                           )}

                           <button
                              onClick={handleRefreshLiveXml}
                              disabled={xmlLoading}
                              className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                              title="Atualizar consulta no GreenWay"
                           >
                              <svg className={`w-4 h-4 ${xmlLoading ? 'animate-spin text-emerald-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                           </button>
                        </div>

                        {/* Alternar entre Resposta (Response) e Requisição (Request) */}
                        <div className="flex items-center gap-2">
                           <div className="bg-gray-800 p-1 rounded-xl flex items-center border border-gray-700">
                              <button
                                 onClick={() => setXmlViewType('response')}
                                 className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                    xmlViewType === 'response'
                                       ? 'bg-emerald-500 text-gray-950 font-black'
                                       : 'text-gray-400 hover:text-white'
                                 }`}
                              >
                                 Resposta (Response XML)
                              </button>
                              <button
                                 onClick={() => setXmlViewType('request')}
                                 className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                    xmlViewType === 'request'
                                       ? 'bg-emerald-500 text-gray-950 font-black'
                                       : 'text-gray-400 hover:text-white'
                                 }`}
                              >
                                 Requisição (Request XML)
                              </button>
                           </div>
                        </div>
                     </div>

                     {/* Barra de Ações Rápidas (Copiar / Baixar / Toggle Formatação) */}
                     <div className="py-2.5 flex items-center justify-between text-xs text-gray-400 flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                           <label className="flex items-center gap-1.5 cursor-pointer text-gray-300 hover:text-white select-none">
                              <input
                                 type="checkbox"
                                 checked={formatXml}
                                 onChange={(e) => setFormatXml(e.target.checked)}
                                 className="rounded bg-gray-800 border-gray-700 text-emerald-500 focus:ring-0"
                              />
                              <span>Formatar XML (Identação e quebra de linhas)</span>
                           </label>
                           {selectedLogIndex === -1 && xmlData?.liveXml?.durationMs && (
                              <span className="text-[11px] text-gray-400">
                                 Latência: <strong className="text-gray-200">{xmlData.liveXml.durationMs}ms</strong>
                              </span>
                           )}
                           {selectedLogIndex >= 0 && xmlData?.logs?.[selectedLogIndex] && (
                              <span className="text-[11px] text-gray-400">
                                 Ação: <strong className="text-gray-200">{xmlData.logs[selectedLogIndex].action}</strong> • 
                                 Endpoint: <span className="font-mono text-[10px] text-gray-300">{xmlData.logs[selectedLogIndex].endpoint}</span>
                              </span>
                           )}
                        </div>

                        <div className="flex items-center gap-2">
                           <button
                              onClick={() => handleCopyXml(displayedXml)}
                              disabled={!displayedXml}
                              className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold transition-colors flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                           >
                              {xmlCopied ? (
                                 <>
                                    <span className="text-emerald-400">✓</span>
                                    <span className="text-emerald-400">Copiado!</span>
                                 </>
                              ) : (
                                 <>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Copiar XML
                                 </>
                              )}
                           </button>

                           <button
                              onClick={() => handleDownloadXml(displayedXml, currentDownloadFilename)}
                              disabled={!displayedXml}
                              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                           >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Baixar XML (.xml)
                           </button>
                        </div>
                     </div>

                     {/* Área de Visualização do Conteúdo XML */}
                     <div className="flex-1 overflow-hidden min-h-[300px] max-h-[550px] relative mt-2 bg-gray-950 rounded-xl border border-gray-800 flex flex-col">
                        {(selectedLogIndex === -1 && xmlLoading) ? (
                           <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
                              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                              <p className="text-xs text-gray-400">Consultando GreenWay (Europcar XRS)...</p>
                              {xmlData?.logs && xmlData.logs.length > 0 && (
                                 <button
                                    onClick={() => {
                                       const idx = xmlData.logs!.findIndex((l: any) => l.action === 'bookReservation');
                                       setSelectedLogIndex(idx >= 0 ? idx : 0);
                                    }}
                                    className="text-xs text-blue-300 hover:text-blue-200 underline cursor-pointer"
                                 >
                                    Ver histórico salvo enquanto aguarda ({xmlData.logs.length})
                                 </button>
                              )}
                           </div>
                        ) : !displayedXml ? (
                           <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                              <p className="text-gray-400 text-sm">Nenhum XML encontrado para esta seleção.</p>
                              {xmlData?.liveError && (
                                 <p className="text-xs text-red-400 mt-2 bg-red-950/40 p-2 rounded border border-red-900/40">
                                    {xmlData.liveError}
                                 </p>
                              )}
                           </div>
                        ) : (
                           <div className="flex-1 overflow-auto p-4 font-mono text-xs text-emerald-400 selection:bg-emerald-900 selection:text-white leading-relaxed">
                              <pre className="whitespace-pre">{displayedXml}</pre>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            );
         })()}

         {/* ── Admin Modify Modal ── */}
         {modifyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setModifyModal(null)}>
               <div className="bg-gray-900 border border-blue-800/40 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-3 mb-5">
                     <div className="w-10 h-10 rounded-full bg-blue-900/40 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                     </div>
                     <div>
                        <h3 className="text-lg font-black text-white">Modificar Reserva</h3>
                        <p className="text-xs text-gray-500">Reserva: <span className="text-white font-mono">{modifyModal.resNumber}</span> — {modifyModal.parsed?.nome} {modifyModal.parsed?.sobrenome}</p>
                     </div>
                  </div>

                  <div className="space-y-4">
                     {/* Retirada */}
                     <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Retirada</p>
                     <div className="grid grid-cols-3 gap-2">
                        <div>
                           <label className="block text-[10px] font-medium text-gray-400 mb-1">Data</label>
                           <input type="date" value={adminModifyData.pickupDate} onChange={e => setAdminModifyData(p => ({ ...p, pickupDate: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors" />
                        </div>
                        <div>
                           <label className="block text-[10px] font-medium text-gray-400 mb-1">Horário</label>
                           <select value={adminModifyData.pickupTime} onChange={e => setAdminModifyData(p => ({ ...p, pickupTime: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors">
                              {getTimeOptions(adminModifyData.pickupTime).map(t => <option key={t} value={t}>{t.slice(0,2)}:{t.slice(2)}</option>)}
                           </select>
                        </div>
                        <div>
                           <label className="block text-[10px] font-medium text-gray-400 mb-1">Estação</label>
                           <input type="text" value={adminModifyData.pickupStationID} onChange={e => setAdminModifyData(p => ({ ...p, pickupStationID: e.target.value.toUpperCase() }))} placeholder="LIST01" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-xs font-mono focus:outline-none focus:border-blue-500 transition-colors" />
                        </div>
                     </div>

                     {/* Devolução */}
                     <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-2">Devolução</p>
                     <div className="grid grid-cols-3 gap-2">
                        <div>
                           <label className="block text-[10px] font-medium text-gray-400 mb-1">Data</label>
                           <input type="date" value={adminModifyData.returnDate} onChange={e => setAdminModifyData(p => ({ ...p, returnDate: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors" />
                        </div>
                        <div>
                           <label className="block text-[10px] font-medium text-gray-400 mb-1">Horário</label>
                           <select value={adminModifyData.returnTime} onChange={e => setAdminModifyData(p => ({ ...p, returnTime: e.target.value }))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-blue-500 transition-colors">
                              {getTimeOptions(adminModifyData.returnTime).map(t => <option key={t} value={t}>{t.slice(0,2)}:{t.slice(2)}</option>)}
                           </select>
                        </div>
                        <div>
                           <label className="block text-[10px] font-medium text-gray-400 mb-1">Estação</label>
                           <input type="text" value={adminModifyData.returnStationID} onChange={e => setAdminModifyData(p => ({ ...p, returnStationID: e.target.value.toUpperCase() }))} placeholder="LIST01" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-xs font-mono focus:outline-none focus:border-blue-500 transition-colors" />
                        </div>
                     </div>

                     {/* Categoria do carro */}
                     <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-2">Veículo</p>
                     <div className="grid grid-cols-2 gap-2">
                        <div>
                           <label className="block text-[10px] font-medium text-gray-400 mb-1">Categoria (ex: EDMR, CDMR, SDMR)</label>
                           <input type="text" value={adminModifyData.carCategory} onChange={e => setAdminModifyData(p => ({ ...p, carCategory: e.target.value.toUpperCase() }))} placeholder="EDMR" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-xs font-mono uppercase focus:outline-none focus:border-blue-500 transition-colors" />
                        </div>
                        <div>
                           <label className="block text-[10px] font-medium text-gray-400 mb-1">Número do voo</label>
                           <input type="text" value={adminModifyData.flightNumber} onChange={e => setAdminModifyData(p => ({ ...p, flightNumber: e.target.value.toUpperCase().replace(/\s/g, '') }))} maxLength={8} placeholder="Ex: LA3212" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-xs font-mono uppercase focus:outline-none focus:border-blue-500 transition-colors" />
                           {!modifyModal.parsed?.flightNumber && <p className="text-[10px] text-gray-500 mt-1">Nenhum voo informado na reserva</p>}
                        </div>
                     </div>
                  </div>

                  {adminModifyMsg && (
                     <p className={`mt-4 text-sm text-center font-medium ${adminModifyMsg.startsWith('✅') ? 'text-emerald-400' : 'text-red-400'}`}>
                        {adminModifyMsg}
                     </p>
                  )}

                  <div className="flex gap-3 mt-6">
                     <button onClick={() => setModifyModal(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2.5 rounded-xl text-sm transition-colors">Cancelar</button>
                     <button onClick={handleAdminModify} disabled={adminModifying} className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                        {adminModifying ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Salvando...</> : 'Salvar Alteração no XRS'}
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* ── Modal: Nova Reserva Manual ── */}
         {manualModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setManualModalOpen(false)}>
               <div className="bg-gray-900 border border-emerald-800/40 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-8" onClick={e => e.stopPropagation()}>
                  {/* Header */}
                  <div className="bg-gradient-to-r from-emerald-950 via-gray-900 to-gray-900 px-6 py-4 flex items-center justify-between border-b border-emerald-800/40">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-900/50 border border-emerald-700/50 flex items-center justify-center text-emerald-400">
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
                        </div>
                        <div>
                           <h2 className="text-white font-bold text-base">Nova Reserva Manual</h2>
                           <p className="text-emerald-400/80 text-xs">Cadastre manualmente no sistema e envie ao GreenWay (GW)</p>
                        </div>
                     </div>
                     <button onClick={() => setManualModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                     </button>
                  </div>

                  {/* Body Form */}
                  <form onSubmit={handleSaveManual} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                     {/* 1. Cliente */}
                     <div>
                        <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                           <span>👤</span> Dados do Cliente
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                           <div>
                              <label className="block text-[11px] font-medium text-gray-300 mb-1">Nome *</label>
                              <input
                                 type="text"
                                 required
                                 value={manualForm.nome}
                                 onChange={e => setManualForm(p => ({ ...p, nome: e.target.value }))}
                                 placeholder="Ex: Carlos"
                                 className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                              />
                           </div>
                           <div>
                              <label className="block text-[11px] font-medium text-gray-300 mb-1">Sobrenome *</label>
                              <input
                                 type="text"
                                 required
                                 value={manualForm.sobrenome}
                                 onChange={e => setManualForm(p => ({ ...p, sobrenome: e.target.value }))}
                                 placeholder="Ex: Oliveira"
                                 className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                              />
                           </div>
                           <div>
                              <label className="block text-[11px] font-medium text-gray-300 mb-1">E-mail *</label>
                              <input
                                 type="email"
                                 required
                                 value={manualForm.email}
                                 onChange={e => setManualForm(p => ({ ...p, email: e.target.value }))}
                                 placeholder="cliente@email.com"
                                 className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                              />
                           </div>
                           <div>
                              <label className="block text-[11px] font-medium text-gray-300 mb-1">Telefone / WhatsApp</label>
                              <input
                                 type="text"
                                 value={manualForm.telefone}
                                 onChange={e => setManualForm(p => ({ ...p, telefone: e.target.value }))}
                                 placeholder="+55 11 99999-9999"
                                 className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                              />
                           </div>
                           <div>
                              <label className="block text-[11px] font-medium text-gray-300 mb-1">CPF / Documento</label>
                              <input
                                 type="text"
                                 value={manualForm.cpf}
                                 onChange={e => setManualForm(p => ({ ...p, cpf: e.target.value }))}
                                 placeholder="000.000.000-00"
                                 className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                              />
                           </div>
                           <div>
                              <label className="block text-[11px] font-medium text-gray-300 mb-1">País Emissão</label>
                              <input
                                 type="text"
                                 value={manualForm.paisEmissao}
                                 onChange={e => setManualForm(p => ({ ...p, paisEmissao: e.target.value.toUpperCase() }))}
                                 placeholder="BR"
                                 className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs font-mono uppercase focus:outline-none focus:border-emerald-500"
                              />
                           </div>
                        </div>
                     </div>

                     {/* 2. Locação */}
                     <div className="border-t border-gray-800 pt-4">
                        <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                           <span>🚗</span> Dados da Locação
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                           <div>
                              <label className="block text-[11px] font-medium text-gray-300 mb-1">Estação Retirada *</label>
                              <input
                                 type="text"
                                 required
                                 value={manualForm.pickupStation}
                                 onChange={e => {
                                    const val = e.target.value.toUpperCase();
                                    setManualForm(p => ({ ...p, pickupStation: val, returnStation: p.returnStation ? p.returnStation : val }));
                                 }}
                                 placeholder="Ex: LIST01 ou POAO03"
                                 className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs font-mono uppercase focus:outline-none focus:border-emerald-500"
                              />
                           </div>
                           <div>
                              <label className="block text-[11px] font-medium text-gray-300 mb-1">Data Retirada *</label>
                              <input
                                 type="date"
                                 required
                                 value={manualForm.pickupDate}
                                 onChange={e => setManualForm(p => ({ ...p, pickupDate: e.target.value }))}
                                 className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                              />
                           </div>
                           <div>
                              <label className="block text-[11px] font-medium text-gray-300 mb-1">Horário Retirada</label>
                              <select
                                 value={manualForm.pickupTime}
                                 onChange={e => setManualForm(p => ({ ...p, pickupTime: e.target.value }))}
                                 className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                              >
                                 {getTimeOptions(manualForm.pickupTime).map(t => (
                                    <option key={t} value={t}>{t.slice(0,2)}:{t.slice(2)}</option>
                                 ))}
                              </select>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                           <div>
                              <label className="block text-[11px] font-medium text-gray-300 mb-1">Estação Devolução *</label>
                              <input
                                 type="text"
                                 required
                                 value={manualForm.returnStation}
                                 onChange={e => setManualForm(p => ({ ...p, returnStation: e.target.value.toUpperCase() }))}
                                 placeholder="Ex: LIST01"
                                 className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs font-mono uppercase focus:outline-none focus:border-emerald-500"
                              />
                           </div>
                           <div>
                              <label className="block text-[11px] font-medium text-gray-300 mb-1">Data Devolução *</label>
                              <input
                                 type="date"
                                 required
                                 value={manualForm.returnDate}
                                 onChange={e => setManualForm(p => ({ ...p, returnDate: e.target.value }))}
                                 className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                              />
                           </div>
                           <div>
                              <label className="block text-[11px] font-medium text-gray-300 mb-1">Horário Devolução</label>
                              <select
                                 value={manualForm.returnTime}
                                 onChange={e => setManualForm(p => ({ ...p, returnTime: e.target.value }))}
                                 className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                              >
                                 {getTimeOptions(manualForm.returnTime).map(t => (
                                    <option key={t} value={t}>{t.slice(0,2)}:{t.slice(2)}</option>
                                 ))}
                              </select>
                           </div>
                        </div>

                        {manualForm.pickupStation && manualForm.returnStation && manualForm.pickupStation.trim().toUpperCase() !== manualForm.returnStation.trim().toUpperCase() && (
                           <div className="mt-3 p-2.5 bg-amber-950/40 border border-amber-600/40 rounded-lg flex items-center gap-2 text-xs text-amber-300">
                              <span>🔄</span>
                              <span><strong>Locação One-Way detectada:</strong> devolução em estação diferente. Preencha a taxa de devolução no bloco de valores abaixo se aplicável.</span>
                           </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                           <div>
                              <label className="block text-[11px] font-medium text-gray-300 mb-1">Categoria Veículo (ACRISS) *</label>
                              <input
                                 type="text"
                                 required
                                 value={manualForm.carCategory}
                                 onChange={e => setManualForm(p => ({ ...p, carCategory: e.target.value.toUpperCase() }))}
                                 placeholder="Ex: EDMR, CDMR, ECMR, IFAR"
                                 className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs font-mono uppercase focus:outline-none focus:border-emerald-500"
                              />
                           </div>
                           <div>
                              <label className="block text-[11px] font-medium text-gray-300 mb-1">Nome / Modelo do Carro</label>
                              <input
                                 type="text"
                                 value={manualForm.carName}
                                 onChange={e => setManualForm(p => ({ ...p, carName: e.target.value }))}
                                 placeholder="Ex: Fiat 500 ou similar"
                                 className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                              />
                           </div>
                        </div>
                     </div>

                     {/* 3. Pagamento e Valores */}
                     <div className="border-t border-gray-800 pt-4">
                        <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                           <span>💳</span> Valores & Pagamento
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                           <div>
                              <label className="block text-[11px] font-medium text-gray-300 mb-1">Valor Pago Online (Cielo/PIX R$)</label>
                              <input
                                 type="number"
                                 step="0.01"
                                 min="0"
                                 value={manualForm.amountBRL}
                                 onChange={e => setManualForm(p => ({ ...p, amountBRL: e.target.value }))}
                                 placeholder="Ex: 580.00"
                                 className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                              />
                           </div>
                           <div>
                              <label className="block text-[11px] font-medium text-amber-300 mb-1">A Pagar no Balcão (€ ou R$)</label>
                              <input
                                 type="number"
                                 step="0.01"
                                 min="0"
                                 value={manualForm.amountCounter}
                                 onChange={e => setManualForm(p => ({ ...p, amountCounter: e.target.value }))}
                                 placeholder="Ex: 45.00"
                                 className="w-full bg-gray-800 border border-amber-700/50 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
                              />
                           </div>
                           <div>
                              <label className="block text-[11px] font-medium text-purple-300 mb-1">Taxa Devolução One-Way (€ ou R$)</label>
                              <input
                                 type="number"
                                 step="0.01"
                                 min="0"
                                 value={manualForm.taxaDevolucao}
                                 onChange={e => setManualForm(p => ({ ...p, taxaDevolucao: e.target.value }))}
                                 placeholder="Ex: 35.00"
                                 className="w-full bg-gray-800 border border-purple-700/50 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                              />
                           </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                           <div>
                              <label className="block text-[11px] font-medium text-gray-300 mb-1">Forma de Pagamento</label>
                              <select
                                 value={manualForm.paymentMethod}
                                 onChange={e => {
                                    const pm = e.target.value;
                                    setManualForm(p => ({
                                       ...p,
                                       paymentMethod: pm,
                                       status: pm === 'BALCAO' ? 'CONFIRMED_NON_PREPAID' : (pm === 'PIX' ? 'PENDING_PIX' : 'CONFIRMED_PREPAID')
                                    }));
                                 }}
                                 className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                              >
                                 <option value="BALCAO">🏪 Pagar no Balcão (NP)</option>
                                 <option value="PIX">🔑 PIX (Online)</option>
                                 <option value="CREDIT">💳 Cartão de Crédito Online (Cielo)</option>
                                 <option value="VOUCHER">🎟️ Voucher / Faturado</option>
                              </select>
                           </div>
                           <div>
                              <label className="block text-[11px] font-medium text-gray-300 mb-1">Status Operacional</label>
                              <select
                                 value={manualForm.operationalStatus}
                                 onChange={e => setManualForm(p => ({ ...p, operationalStatus: e.target.value }))}
                                 className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                              >
                                 <option value="CF">CF — Confirmada (Backoffice)</option>
                                 <option value="S">S — Sold (Confirmada)</option>
                                 <option value="R">R — On Request (Sob Consulta)</option>
                              </select>
                           </div>
                        </div>
                     </div>

                     {/* 4. Enviar ao GW */}
                     <div className="bg-emerald-950/40 border border-emerald-700/40 rounded-xl p-3.5 flex items-center justify-between gap-3">
                        <div>
                           <p className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>📤</span> Enviar imediatamente ao GreenWay (GW)
                           </p>
                           <p className="text-[11px] text-gray-400 mt-0.5">
                              Chama o webservice da Europcar para gerar o número oficial de reserva no GreenWay agora.
                           </p>
                        </div>
                        <input
                           type="checkbox"
                           checked={manualForm.sendToGW}
                           onChange={e => setManualForm(p => ({ ...p, sendToGW: e.target.checked }))}
                           className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                        />
                     </div>

                     {/* Footer buttons */}
                     <div className="flex gap-3 pt-3">
                        <button
                           type="button"
                           onClick={() => setManualModalOpen(false)}
                           className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2.5 rounded-xl text-xs transition-colors"
                        >
                           Cancelar
                        </button>
                        <button
                           type="submit"
                           disabled={manualSaving}
                           className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40"
                        >
                           {manualSaving ? (
                              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Salvando...</>
                           ) : (
                              <>💾 Salvar Reserva Manual</>
                           )}
                        </button>
                     </div>
                  </form>
               </div>
            </div>
         )}

         {/* ── Modal: Sincronizar por Nº do GreenWay (Importar) ── */}
         {syncGWModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setSyncGWModalOpen(false)}>
               <div className="bg-gray-900 border border-cyan-800/40 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-8" onClick={e => e.stopPropagation()}>
                  {/* Header */}
                  <div className="bg-gradient-to-r from-cyan-950 via-gray-900 to-gray-900 px-6 py-4 flex items-center justify-between border-b border-cyan-800/40">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-900/50 border border-cyan-700/50 flex items-center justify-center text-cyan-400">
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                        </div>
                        <div>
                           <h2 className="text-white font-bold text-base">Sincronizar por Nº do GreenWay</h2>
                           <p className="text-cyan-400/80 text-xs">Digite o número da reserva no GW para consultar e cadastrar automaticamente</p>
                        </div>
                     </div>
                     <button onClick={() => setSyncGWModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                     </button>
                  </div>

                  {/* Search bar */}
                  <div className="p-6 space-y-4">
                     <form onSubmit={handleSearchInGW} className="flex gap-2">
                        <div className="relative flex-1">
                           <input
                              type="text"
                              value={syncGWResNumber}
                              onChange={e => setSyncGWResNumber(e.target.value)}
                              placeholder="Digite o número da reserva no GreenWay (ex: 1207745328)"
                              className="w-full bg-gray-800 border border-cyan-700/60 rounded-xl px-4 py-3 text-white text-sm font-mono placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                           />
                        </div>
                        <button
                           type="submit"
                           disabled={syncGWLoading}
                           className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold px-5 py-3 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-cyan-900/30 transition-all shrink-0"
                        >
                           {syncGWLoading ? (
                              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Buscando...</>
                           ) : (
                              <>🔍 Buscar no GW</>
                           )}
                        </button>
                     </form>

                     {/* Loading State */}
                     {syncGWLoading && (
                        <div className="py-8 text-center space-y-2">
                           <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto"/>
                           <p className="text-xs text-cyan-300 font-medium">Consultando webservice GreenWay Europcar (search.searchbyid)...</p>
                        </div>
                     )}

                     {/* Result Details */}
                     {syncGWData && syncGWData.data && (
                        <div className="space-y-4 pt-2">
                           {/* Status banner */}
                           <div className={`rounded-xl p-3.5 border flex items-center justify-between gap-3 ${syncGWData.alreadyExistsLocally ? 'bg-amber-950/40 border-amber-800/40 text-amber-200' : 'bg-emerald-950/40 border-emerald-800/40 text-emerald-200'}`}>
                              <div>
                                 <p className="text-xs font-bold">
                                    {syncGWData.alreadyExistsLocally ? '⚠️ Reserva já cadastrada no sistema local' : '✅ Reserva encontrada no GreenWay com sucesso!'}
                                 </p>
                                 <p className="text-[11px] opacity-80 mt-0.5">
                                    {syncGWData.alreadyExistsLocally
                                       ? 'Ao salvar, você atualizará os dados locais com as informações retornadas pelo GreenWay.'
                                       : 'Confira os dados abaixo e clique em cadastrar para registrar no sistema local.'}
                                 </p>
                              </div>
                              <span className="font-mono font-bold text-xs px-2.5 py-1 rounded bg-black/40 border border-current">
                                 GW: {syncGWData.data.xrsStatusCode} — {syncGWData.data.xrsStatus}
                              </span>
                           </div>

                           {/* Summary Card */}
                           <div className="bg-gray-800/70 border border-gray-700/60 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                              <div>
                                 <p className="text-[10px] text-gray-400 uppercase font-bold">Nº Reserva</p>
                                 <p className="font-mono font-black text-white text-sm mt-0.5">{syncGWData.data.resNumber}</p>
                              </div>
                              <div>
                                 <p className="text-[10px] text-gray-400 uppercase font-bold">Categoria</p>
                                 <p className="font-mono font-black text-cyan-400 text-sm mt-0.5">{syncGWData.data.carCategory || '—'}</p>
                              </div>
                              <div>
                                 <p className="text-[10px] text-gray-400 uppercase font-bold">Retirada</p>
                                 <p className="font-semibold text-white mt-0.5">{syncGWData.data.pickupStation} · {syncGWData.data.pickupDateFormatted || syncGWData.data.pickupDate}</p>
                              </div>
                              <div>
                                 <p className="text-[10px] text-gray-400 uppercase font-bold">Devolução</p>
                                 <p className="font-semibold text-white mt-0.5">{syncGWData.data.returnStation} · {syncGWData.data.returnDateFormatted || syncGWData.data.returnDate}</p>
                              </div>
                           </div>

                           {/* Editable Fields to Confirm */}
                           <div className="bg-gray-800/40 border border-gray-700/40 rounded-xl p-4 space-y-3">
                              <p className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">Conferir e Completar Dados para Cadastro</p>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                 <div>
                                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Nome do Cliente *</label>
                                    <input
                                       type="text"
                                       value={syncGWEditForm.nome}
                                       onChange={e => setSyncGWEditForm(p => ({ ...p, nome: e.target.value }))}
                                       placeholder="Nome"
                                       className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                                    />
                                 </div>
                                 <div>
                                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Sobrenome *</label>
                                    <input
                                       type="text"
                                       value={syncGWEditForm.sobrenome}
                                       onChange={e => setSyncGWEditForm(p => ({ ...p, sobrenome: e.target.value }))}
                                       placeholder="Sobrenome"
                                       className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                                    />
                                 </div>
                                 <div>
                                    <label className="block text-[10px] font-medium text-gray-400 mb-1">E-mail *</label>
                                    <input
                                       type="email"
                                       value={syncGWEditForm.email}
                                       onChange={e => setSyncGWEditForm(p => ({ ...p, email: e.target.value }))}
                                       placeholder="cliente@email.com"
                                       className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                                    />
                                 </div>
                                 <div>
                                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Telefone</label>
                                    <input
                                       type="text"
                                       value={syncGWEditForm.telefone}
                                       onChange={e => setSyncGWEditForm(p => ({ ...p, telefone: e.target.value }))}
                                       placeholder="+55 11 99999-9999"
                                       className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                                    />
                                 </div>
                                 <div>
                                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Valor Pago Online (R$)</label>
                                    <input
                                       type="number"
                                       step="0.01"
                                       value={syncGWEditForm.amountBRL}
                                       onChange={e => setSyncGWEditForm(p => ({ ...p, amountBRL: e.target.value }))}
                                       placeholder="0.00"
                                       className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                                    />
                                 </div>
                                 <div>
                                    <label className="block text-[10px] font-medium text-amber-300 mb-1">A Pagar no Balcão (€ ou R$)</label>
                                    <input
                                       type="number"
                                       step="0.01"
                                       value={syncGWEditForm.amountCounter}
                                       onChange={e => setSyncGWEditForm(p => ({ ...p, amountCounter: e.target.value }))}
                                       placeholder="0.00"
                                       className="w-full bg-gray-800 border border-amber-700/50 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                                    />
                                 </div>
                                 <div>
                                    <label className="block text-[10px] font-medium text-purple-300 mb-1">Taxa Devolução One-Way (€ ou R$)</label>
                                    <input
                                       type="number"
                                       step="0.01"
                                       value={syncGWEditForm.taxaDevolucao}
                                       onChange={e => setSyncGWEditForm(p => ({ ...p, taxaDevolucao: e.target.value }))}
                                       placeholder="0.00"
                                       className="w-full bg-gray-800 border border-purple-700/50 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                                    />
                                 </div>
                                 <div>
                                    <label className="block text-[10px] font-medium text-gray-400 mb-1">Forma de Pagamento</label>
                                    <select
                                       value={syncGWEditForm.paymentMethod}
                                       onChange={e => {
                                          const pm = e.target.value;
                                          setSyncGWEditForm(p => ({
                                             ...p,
                                             paymentMethod: pm,
                                             status: pm === 'BALCAO' ? 'CONFIRMED_NON_PREPAID' : (pm === 'PIX' ? 'PENDING_PIX' : 'CONFIRMED_PREPAID')
                                          }));
                                       }}
                                       className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                                    >
                                       <option value="BALCAO">🏪 Pagar no Balcão (NP)</option>
                                       <option value="PIX">🔑 PIX (Online)</option>
                                       <option value="CREDIT">💳 Pago Online (Cartão)</option>
                                       <option value="VOUCHER">🎟️ Voucher / Faturado</option>
                                    </select>
                                 </div>
                              </div>
                           </div>

                           {/* Action button */}
                           <div className="flex gap-3 pt-2">
                              <button
                                 type="button"
                                 onClick={() => setSyncGWModalOpen(false)}
                                 className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2.5 rounded-xl text-xs transition-colors"
                              >
                                 Cancelar
                              </button>
                              <button
                                 type="button"
                                 onClick={handleSaveImportedFromGW}
                                 disabled={syncGWSaving}
                                 className="flex-1 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/40"
                              >
                                 {syncGWSaving ? (
                                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Cadastrando...</>
                                 ) : (
                                    <>📥 Cadastrar Reserva Automaticamente</>
                                 )}
                              </button>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            </div>
         )}

         {toast && (
            <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-2xl font-bold text-sm animate-pulse ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
               {toast.message}
            </div>
         )}

         <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
               <h1 className="text-2xl font-black text-white">Gestão de Reservas</h1>
               <p className="text-gray-400 text-sm mt-1">Todas as reservas do sistema — com controle de status operacional</p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
               <button
                  onClick={handleOpenManualModal}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer"
               >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
                  Nova Reserva Manual
               </button>

               <button
                  onClick={handleOpenSyncGWModal}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-cyan-900/30 transition-all cursor-pointer"
               >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                  Sincronizar por Nº (GW)
               </button>

               <button
                  onClick={async () => {
                     setSyncLoading(true);
                     setSyncResult(null);
                     try {
                        const res = await fetch('/api/reservas/sync-greenway', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
                        const data = await res.json();
                        setSyncResult(data);
                        if (data.changes > 0) fetchReservations();
                     } catch (e: any) { setSyncResult({ error: e.message }); }
                     setSyncLoading(false);
                  }}
                  disabled={syncLoading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-colors shrink-0"
               >
                  {syncLoading ? (
                     <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  )}
                  🔄 Sincronizar com Greenway
               </button>
            </div>
         </div>
         {syncResult && (
            <div className={`rounded-xl p-3 text-xs font-medium ${syncResult.error ? 'bg-red-900/20 text-red-400 border border-red-800' : 'bg-green-900/20 text-green-400 border border-green-800'}`}>
               {syncResult.error ? `❌ Erro: ${syncResult.error}` : `✅ ${syncResult.synced} reservas verificadas, ${syncResult.changes} alterações. ${syncResult.results?.map((r: any) => `${r.resNumber}: ${r.oldStatus} → ${r.newStatus}`).join(' | ') || ''}`}
            </div>
         )}

         {/* STATUS OPERACIONAL Filter */}
         <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status Operacional</p>
            <div className="flex flex-wrap gap-1.5">
               {OP_STATUS_FILTER_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setOpStatusFilter(opt.value)}
                     className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${opStatusFilter === opt.value ? `${opt.color} ring-1 ring-current scale-105` : "bg-gray-800/60 text-gray-500 hover:text-gray-300"}`}>
                     {opt.label} {opCounts[opt.value] !== undefined ? `(${opCounts[opt.value]})` : ""}
                  </button>
               ))}
            </div>
         </div>

         {/* Status Pagamento Filter */}
         <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status Pagamento</p>
            <div className="flex flex-wrap gap-2">
               {PAYMENT_STATUS_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
                     className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${statusFilter === opt.value ? `${opt.color} ring-1 ring-current scale-105` : "bg-gray-800 text-gray-500 hover:text-gray-300"}`}>
                     {opt.label} {counts[opt.value] !== undefined ? `(${counts[opt.value]})` : ""}
                  </button>
               ))}
            </div>
         </div>

         {/* Date Filter */}
         <div className="flex flex-wrap items-end gap-3">
            <div>
               <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Data Início</label>
               <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-green-600 transition-colors [color-scheme:dark]" />
            </div>
            <div>
               <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Data Fim</label>
               <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-green-600 transition-colors [color-scheme:dark]" />
            </div>
            {(startDate || endDate) && (
               <button onClick={() => { setStartDate(""); setEndDate(""); }} className="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-3 py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  Limpar datas
               </button>
            )}
         </div>

         {/* Search */}
         <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
               <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
               <input type="text" placeholder="Buscar por reserva, nome, email ou CPF..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-green-600 transition-colors" />
            </div>
            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition-colors">Buscar</button>
         </form>

         {/* Summary Bar */}
         <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3.5">
               <p className="text-[10px] font-bold text-gray-400 uppercase">Reservas Filtradas</p>
               <p className="text-xl font-black text-white mt-0.5">{reservations.length}</p>
               <p className="text-[10px] text-gray-500 mt-0.5">
                  <span className="text-emerald-400 font-bold">{activeList.length}</span> ativas
                  {pendingPixList.length > 0 && <> · <span className="text-amber-400 font-bold">{pendingPixList.length}</span> pend.</>}
                  {cancelledList.length > 0 && <> · <span className="text-red-400 font-bold">{cancelledList.length}</span> canc.</>}
               </p>
            </div>
            <div className="bg-gray-900 border border-emerald-900/30 rounded-xl p-3.5">
               <p className="text-[10px] font-bold text-emerald-400 uppercase">
                  {isPendingPixFilter ? "Receita Pendente (BRL)" : isCancelledFilter ? "Receita Cancelada (BRL)" : "Receita Ativa (BRL)"}
               </p>
               <p className="text-xl font-black text-emerald-400 mt-0.5">
                  R$ {totalActiveBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
               </p>
               <p className="text-[10px] text-gray-500 mt-0.5">
                  {isPendingPixFilter
                     ? "PIX pendente de pagamento"
                     : isCancelledFilter
                     ? "Reservas canceladas"
                     : (
                        <span>
                           <strong className="text-emerald-400">R$ {totalActiveOnlineBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> online
                           {totalActiveCounterBRL > 0.05 && (
                              <span> · <strong className="text-amber-400">R$ {totalActiveCounterBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong> balcão</span>
                           )}
                        </span>
                     )}
               </p>
            </div>
            <div className="bg-gray-900 border border-cyan-900/30 rounded-xl p-3.5">
               <p className="text-[10px] font-bold text-cyan-400 uppercase">Em Andamento (R/S/CF)</p>
               <p className="text-xl font-black text-cyan-400 mt-0.5">{opCounts.ACTIVE || 0}</p>
               <p className="text-[10px] text-gray-500 mt-0.5">{(opCounts.CO || 0)} Checked Out</p>
            </div>
            <div className="bg-gray-900 border border-red-900/30 rounded-xl p-3.5">
               <p className="text-[10px] font-bold text-red-400 uppercase">Canceladas</p>
               <p className="text-xl font-black text-red-400 mt-0.5">{cancelledList.length}</p>
               <p className="text-[10px] text-red-400/80 mt-0.5">
                  R$ {totalCancelledBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} não somado
                  {pendingPixList.length > 0 && !isPendingPixFilter && (
                     <span className="block text-amber-400/80 mt-0.5">
                        + {pendingPixList.length} PIX pend. (R$ {totalPendingPixBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                     </span>
                  )}
               </p>
            </div>
         </div>

         {/* Reservations Table */}
         <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                  <thead className="bg-gray-800/50 border-b border-gray-700">
                     <tr>
                        <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reserva</th>
                        <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cliente</th>
                        <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Veículo</th>
                        <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Valor</th>
                        <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Op. Status</th>
                        <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pagamento</th>
                        <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Data</th>
                        <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Ações</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                     {loading && (<tr><td colSpan={8} className="text-center py-10"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div></td></tr>)}
                     {!loading && reservations.length === 0 && (<tr><td colSpan={8} className="text-center py-10 text-gray-500">Nenhuma reserva encontrada.</td></tr>)}
                     {!loading && parsedReservations.map(({ parsed, metrics, ...res }) => {
                        const isExpanded = expandedRow === res.id;
                        const opStatus = res.operationalStatus || "R";
                        const opConfig = OP_STATUS_CONFIG[opStatus] || OP_STATUS_CONFIG.R;

                        return (
                           <Fragment key={res.id}>
                              <tr className="hover:bg-gray-800/30 transition-colors group">
                              <td className="px-4 py-4">
                                 {res.resNumber && res.resNumber !== res.merchantOrderId ? (
                                    <div className="font-black text-white text-base font-mono">{res.resNumber}</div>
                                 ) : (
                                    <div className="space-y-1">
                                       <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-600/40">
                                          ✍️ Manual (Sem GW)
                                       </span>
                                    </div>
                                 )}
                                 <div className="text-[10px] text-gray-500 font-mono mt-0.5">{res.merchantOrderId}</div>
                              </td>
                              <td className="px-4 py-4">
                                 <div className="font-bold text-white">{parsed?.nome || "—"} {parsed?.sobrenome || ""}</div>
                                 <div className="text-xs text-gray-500">{parsed?.email || "—"}</div>
                                 <div className="text-[10px] text-gray-600">{parsed?.cpf} • {parsed?.telefone}</div>
                              </td>
                              <td className="px-4 py-4">
                                 <div className="font-bold text-white text-xs uppercase">{parsed?.booking?.car?.carCategorySample || parsed?.booking?.car?.carCategoryName || "—"}</div>
                                 <div className="text-[10px] text-gray-500">{parsed?.booking?.car?.carCategoryCode || ""}</div>
                                 {isZeroExcessBooking(parsed?.booking) && (
                                    <div className="mt-1 inline-flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-600/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300" title="Proteção Premium — Franquia Zero">
                                       🛡️ Premium · Franquia Zero
                                    </div>
                                 )}
                              </td>
                              <td className="px-4 py-4">
                                 {/* Total geral da locação (bate 100% com o voucher do cliente) */}
                                 <div className="font-bold text-white text-xs">
                                    R$ {metrics.totalGeralBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    {metrics.totalGeralEUR > 0 && metrics.currencyLocal !== 'BRL' && (
                                       <span className="text-gray-400 font-normal ml-1 text-[11px]">
                                          ({curSym(metrics.currencyLocal)} {metrics.totalGeralEUR.toFixed(2)})
                                       </span>
                                    )}
                                 </div>

                                 {metrics.isPrepaid ? (
                                    metrics.counterDueBRL && metrics.counterDueBRL > 0.05 ? (
                                       <div className="mt-0.5 space-y-0.5">
                                          <div className="text-[10px] text-emerald-400 font-semibold leading-tight">
                                             ✓ R$ {metrics.onlinePaidBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} online
                                          </div>
                                          <div className="text-[10px] text-amber-400 font-semibold leading-tight">
                                             + {metrics.counterDueEUR > 0 ? `${curSym(metrics.currencyLocal)} ${metrics.counterDueEUR.toFixed(2)} ` : ''}(~R$ {metrics.counterDueBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) balcão
                                          </div>
                                       </div>
                                    ) : (
                                       <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                                          ✓ 100% pago online
                                       </div>
                                    )
                                 ) : (
                                    <div className="text-[10px] text-blue-300 font-semibold mt-0.5">
                                       🏪 a pagar no balcão
                                    </div>
                                 )}
                                 <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                                    {metrics.days ? <span>{metrics.days} dias</span> : null}
                                    {metrics.isOneWay && (
                                       <span className="text-amber-400 font-semibold" title="Devolução em outra agência">
                                          · 🔄 One-Way
                                       </span>
                                    )}
                                 </div>
                              </td>

                              {/* STATUS OPERACIONAL */}
                              <td className="px-4 py-4">
                                 {changingOpStatus === res.id ? (
                                    <div className="space-y-1 min-w-[140px]">
                                       <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Momentâneos</p>
                                       {["R", "S", "CF"].map(code => (
                                          <button key={code} onClick={() => handleChangeOpStatus(res.id, code)} className={`block w-full text-left px-2 py-1.5 rounded text-[10px] font-bold ${OP_STATUS_CONFIG[code].color} hover:opacity-80 transition-opacity`}>
                                             {code} — {OP_STATUS_CONFIG[code].description}
                                          </button>
                                       ))}
                                       <div className="border-t border-gray-700/50 my-1"></div>
                                       <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Concluídos</p>
                                       {["CC", "CP", "CO", "TD", "NS"].map(code => (
                                          <button key={code} onClick={() => handleChangeOpStatus(res.id, code)} className={`block w-full text-left px-2 py-1.5 rounded text-[10px] font-bold ${OP_STATUS_CONFIG[code].color} hover:opacity-80 transition-opacity`}>
                                             {code} — {OP_STATUS_CONFIG[code].description}
                                          </button>
                                       ))}
                                       <button onClick={() => setChangingOpStatus(null)} className="text-[10px] text-gray-500 hover:text-gray-300 w-full text-left px-2 mt-1">Cancelar</button>
                                    </div>
                                 ) : (
                                    <button onClick={() => setChangingOpStatus(res.id)} className={`text-xs font-black uppercase px-3 py-1.5 rounded-lg border ${opConfig.color} hover:opacity-80 transition-all cursor-pointer flex items-center gap-1.5`} title={`${opConfig.label} — ${opConfig.description}`}>
                                       <span className="text-sm">{opConfig.label}</span>
                                       <span className="text-[9px] font-medium opacity-70 hidden sm:inline">{opConfig.description}</span>
                                    </button>
                                 )}
                              </td>

                              {/* Status Pagamento */}
                              <td className="px-4 py-4">
                                 {changingStatus === res.id ? (
                                    <div className="space-y-1">
                                       {["CONFIRMED_PREPAID", "CONFIRMED_NON_PREPAID", "PENDING_PIX", "CANCELLED"].map(s => (
                                          <button key={s} onClick={() => handleChangeStatus(res.id, s)} className={`block w-full text-left px-2 py-1 rounded text-[10px] font-bold ${STATUS_COLORS[s] || "bg-gray-700 text-gray-300"} hover:opacity-80`}>
                                             {STATUS_LABELS[s]}
                                          </button>
                                       ))}
                                       <button onClick={() => setChangingStatus(null)} className="text-[10px] text-gray-500 hover:text-gray-300 w-full text-left px-2">Cancelar</button>
                                    </div>
                                 ) : (
                                    <div className="flex flex-col gap-1 items-start">
                                       <button onClick={() => setChangingStatus(res.id)} className={`text-[10px] font-bold uppercase px-2.5 py-1.5 rounded border ${STATUS_COLORS[res.status] || "bg-gray-700 text-gray-300 border-gray-600"} hover:opacity-80 transition-opacity cursor-pointer`}>
                                          {STATUS_LABELS[res.status] || res.status}
                                       </button>
                                       {/* Método de pagamento real — lido do customerData persistido */}
                                       {(() => {
                                          const pm = parsed?.paymentMethod;
                                          const cf = parsed?.cardLastFour;
                                          const pid = parsed?.cieloPaymentId;
                                          if (pm === 'CREDIT' && cf) {
                                             return <span className="text-[9px] text-gray-400 flex items-center gap-1">💳 Cartão {cf}</span>;
                                          } else if (pm === 'PIX' || res.status === 'PENDING_PIX') {
                                             return <span className="text-[9px] text-sky-400 flex items-center gap-1">🔑 PIX{pid ? ` · ${pid.slice(0,8)}…` : ''}</span>;
                                          } else if (pm === 'BALCAO' || res.status === 'CONFIRMED_NON_PREPAID') {
                                             return <span className="text-[9px] text-blue-400 flex items-center gap-1">🏪 Pagar no Balcão</span>;
                                          } else if (pm === 'VOUCHER') {
                                             return <span className="text-[9px] text-purple-400 flex items-center gap-1">🎟️ Voucher</span>;
                                          }
                                          return null;
                                       })()}
                                       {/* Botão Sincronizar — PIX pendente na Cielo */}
                                       {res.status === 'PENDING_PIX' && (
                                          <button onClick={() => handleCheckPix(res.merchantOrderId)} title="Sincronizar PIX com Cielo" className="text-[9px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded w-full flex justify-center items-center gap-1 shadow-sm transition-colors">
                                             <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                             Sincronizar
                                          </button>
                                       )}
                                       {/* Botão Reenviar XRS — reserva sem resNumber válido no GreenWay */}
                                       {(!res.resNumber || res.resNumber === res.merchantOrderId || res.resNumber.length <= 5) && res.status !== 'CANCELLED' && (
                                          <button onClick={() => handleReenviarXRS(res.id)} title="Enviar esta reserva ao GreenWay (Europcar XRS)" className="text-[9px] bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold px-2 py-1.5 rounded w-full flex justify-center items-center gap-1.5 shadow-sm transition-all cursor-pointer">
                                             <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                             📤 Enviar ao GW
                                          </button>
                                       )}
                                    </div>
                                 )}
                              </td>
                              <td className="px-4 py-4 text-xs text-gray-500">
                                 {new Date(res.createdAt).toLocaleDateString("pt-BR")}<br />
                                 <span className="text-[10px]">{new Date(res.createdAt).toLocaleTimeString("pt-BR")}</span>
                              </td>
                              <td className="px-4 py-4 text-right">
                                 <div className="flex justify-end gap-2">
                                    {/* Botão Ver Recibo Localizado */}
                                    <button
                                       onClick={() => handleViewReceipt(res.resNumber || res.merchantOrderId)}
                                       className="p-1.5 rounded-lg bg-gray-800 hover:bg-emerald-900/50 text-gray-400 hover:text-emerald-400 transition-colors"
                                       title="Ver recibo localizado (idioma e moeda do país)"
                                    >
                                       {/* Receipt icon */}
                                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                       </svg>
                                    </button>
                                    {/* Botão Sincronizar com GreenWay */}
                                    {res.resNumber && (
                                       <button
                                          onClick={() => handleSyncSingleGreenway(res.resNumber)}
                                          disabled={syncingSingle === res.resNumber}
                                          className="p-1.5 rounded-lg bg-gray-800 hover:bg-sky-900/50 text-gray-400 hover:text-sky-400 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                          title="Sincronizar status com GreenWay (XRS)"
                                       >
                                          {syncingSingle === res.resNumber ? (
                                             <svg className="w-4 h-4 animate-spin text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                             </svg>
                                          ) : (
                                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                             </svg>
                                          )}
                                       </button>
                                    )}
                                    {/* Botão Reenviar E-mail Localizado */}
                                    <button
                                       onClick={() => handleOpenEmailPreview(res.resNumber || res.merchantOrderId)}
                                       disabled={resendingEmail === (res.resNumber || res.merchantOrderId) || loadingPreview === (res.resNumber || res.merchantOrderId)}
                                       className="p-1.5 rounded-lg bg-gray-800 hover:bg-indigo-900/50 text-gray-400 hover:text-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                       title="Reenviar e-mail no idioma e moeda local do cliente"
                                    >
                                       {(resendingEmail === (res.resNumber || res.merchantOrderId) || loadingPreview === (res.resNumber || res.merchantOrderId)) ? (
                                          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                          </svg>
                                       ) : (
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                          </svg>
                                       )}
                                    </button>
                                    {/* Dropdown Reenviar E-mail (3 opções) */}
                                    <div className="relative">
                                       <button
                                          onClick={() => setEmailDropdown(emailDropdown === res.id ? null : res.id)}
                                          disabled={resendingCancelEmail === (res.resNumber || res.merchantOrderId)}
                                          className="p-1.5 rounded-lg bg-gray-800 hover:bg-indigo-900/50 text-gray-400 hover:text-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                          title="Reenviar e-mail"
                                       >
                                          {resendingCancelEmail === (res.resNumber || res.merchantOrderId) ? (
                                             <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                             </svg>
                                          ) : (
                                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                             </svg>
                                          )}
                                       </button>
                                       {emailDropdown === res.id && (
                                          <div className="absolute right-0 top-8 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[200px]">
                                             <button onClick={() => handleResendWithTrigger(res.resNumber || res.merchantOrderId, 'RESERVA_SUCESSO')} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-green-900/40 hover:text-green-400 flex items-center gap-2">
                                                <span className="text-green-400">✉</span> Confirmação de Reserva
                                             </button>
                                             <button onClick={() => handleResendWithTrigger(res.resNumber || res.merchantOrderId, 'CANCELAMENTO')} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-red-900/40 hover:text-red-400 flex items-center gap-2">
                                                <span className="text-red-400">✘</span> Reserva Cancelada
                                             </button>
                                             <button onClick={() => handleResendWithTrigger(res.resNumber || res.merchantOrderId, 'RESERVA_SOB_SOLICITACAO')} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-amber-900/40 hover:text-amber-400 flex items-center gap-2">
                                                <span className="text-amber-400">⏳</span> Sob Solicitação (On Request)
                                             </button>
                                          </div>
                                       )}
                                    </div>
                                    {/* Botão Ver Detalhes (Expandir / Recolher Linha) */}
                                    <button
                                       onClick={() => setExpandedRow(isExpanded ? null : res.id)}
                                       className={`p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors cursor-pointer ${isExpanded ? 'text-white bg-gray-700' : ''}`}
                                       title={isExpanded ? "Ocultar detalhes da reserva" : "Expandir detalhes da reserva"}
                                    >
                                       <svg className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                       </svg>
                                    </button>

                                    {/* Botão Ver e Baixar XML da Reserva (Ícone de Olho) */}
                                    <button
                                       onClick={() => handleOpenXmlModal(res)}
                                       className="p-1.5 rounded-lg bg-gray-800 hover:bg-emerald-900/50 text-gray-400 hover:text-emerald-400 transition-colors border border-transparent hover:border-emerald-500/30 cursor-pointer"
                                       title="Ver e baixar XML da reserva (XRS / GreenWay)"
                                    >
                                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                       </svg>
                                    </button>
                                    {res.resNumber && (
                                       <button onClick={() => openModifyModal(res)} className="p-1.5 rounded-lg bg-gray-800 hover:bg-blue-900/50 text-gray-400 hover:text-blue-400 transition-colors" title="Modificar reserva no XRS">
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                       </button>
                                    )}
                                    <button onClick={() => setCancelModal({ id: res.id, resNumber: res.resNumber || res.id })} className="p-1.5 rounded-lg bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 transition-colors" title="Cancelar reserva">
                                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                 </div>
                              </td>
                              </tr>
                              {isExpanded && (
                               <tr className="bg-gray-800/40 border-b border-gray-800">
                                  <td colSpan={8} className="px-5 py-4">
                                     <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700/50">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Detalhamento da Reserva</span>
                                        <button
                                           onClick={() => handleOpenXmlModal(res)}
                                           className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                           title="Ver e baixar XML da reserva"
                                        >
                                           <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                           </svg>
                                           Ver / Baixar XML da Reserva (XRS)
                                        </button>
                                     </div>
                                     <div className="flex flex-wrap gap-4 text-sm">
                                        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700/50 flex-1 min-w-[200px]">
                                           <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Dados do Cliente</p>
                                           <p className="text-gray-300"><strong>Nome:</strong> {parsed?.nome || "—"} {parsed?.sobrenome || ""}</p>
                                           <p className="text-gray-300"><strong>E-mail:</strong> {parsed?.email || "—"}</p>
                                           <p className="text-gray-300"><strong>CPF:</strong> {parsed?.cpf || "—"}</p>
                                           <p className="text-gray-300"><strong>Telefone:</strong> {parsed?.telefone || "—"}</p>
                                           {/* 🇮🇹 PID+CNH Acknowledgment Badge */}
                                           {parsed?.pidAcknowledged && (
                                              <div className="mt-3 bg-blue-900/30 border border-blue-700/40 rounded-lg px-3 py-2">
                                                 <p className="text-blue-300 text-[11px] font-bold flex items-center gap-1.5">
                                                    <span>🇮🇹</span> PID + CNH físicas confirmadas
                                                 </p>
                                                 {parsed?.pidAcknowledgedAt && (
                                                    <p className="text-blue-500 text-[10px] mt-0.5">
                                                       Ciência em: {new Date(parsed.pidAcknowledgedAt).toLocaleString('pt-BR')}
                                                    </p>
                                                 )}
                                              </div>
                                           )}
                                        </div>
                                        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700/50 flex-1 min-w-[200px]">
                                           <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Veículo e Período</p>
                                           <p className="text-gray-300"><strong>Categoria:</strong> {parsed?.booking?.car?.carCategoryCode || parsed?.carCategory || "—"}</p>
                                           <p className="text-gray-300"><strong>Veículo:</strong> {parsed?.booking?.car?.carCategorySample || parsed?.booking?.car?.carCategoryName || "—"}</p>
                                           <p className="text-gray-300"><strong>Rate ID:</strong> <span className="font-mono text-xs text-gray-500">{parsed?.booking?.car?.rateId || "—"}</span></p>
                                           <div className="border-t border-gray-700/50 my-2"></div>
                                           <p className="text-gray-300"><strong>Retirada:</strong> <StationCode code={parsed?.booking?.pickupStation} /> — {parsed?.booking?.pickupDate ? `${parsed.booking.pickupDate.slice(6,8)}/${parsed.booking.pickupDate.slice(4,6)}/${parsed.booking.pickupDate.slice(0,4)}` : "—"} {parsed?.booking?.pickupTime ? `${parsed.booking.pickupTime.slice(0,2)}:${parsed.booking.pickupTime.slice(2)}` : ""}</p>
                                           <p className="text-gray-300"><strong>Devolução:</strong> <StationCode code={parsed?.booking?.returnStation || parsed?.booking?.pickupStation} /> — {parsed?.booking?.returnDate ? `${parsed.booking.returnDate.slice(6,8)}/${parsed.booking.returnDate.slice(4,6)}/${parsed.booking.returnDate.slice(0,4)}` : "—"} {parsed?.booking?.returnTime ? `${parsed.booking.returnTime.slice(0,2)}:${parsed.booking.returnTime.slice(2)}` : ""}</p>
                                           {metrics.isOneWay && (
                                              <div className="my-1.5 p-2 bg-purple-950/40 border border-purple-500/30 rounded text-xs">
                                                 <div className="flex items-center gap-1.5 text-purple-300 font-semibold">
                                                    <span>🔄</span>
                                                    <span>Devolução em outra agência (One-Way)</span>
                                                 </div>
                                                 {metrics.oneWayFeeEUR > 0 && (
                                                    <p className="text-purple-200/80 text-[11px] mt-0.5 ml-5">
                                                       Taxa de devolução: <strong>{curSym(metrics.currencyLocal)} {metrics.oneWayFeeEUR.toFixed(2)}</strong> {metrics.oneWayFeeBRL > 0 ? `(~R$ ${metrics.oneWayFeeBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` : ''}
                                                    </p>
                                                 )}
                                              </div>
                                           )}
                                           <p className="text-gray-300"><strong>Dias:</strong> {metrics.days || parsed?.booking?.duration || parsed?.booking?.days || "—"}</p>
                                           <p className="text-gray-300"><strong>País:</strong> {parsed?.booking?.stationCountry || parsed?.booking?.country || (parsed?.booking?.pickupStation?.startsWith('BR') ? 'BR' : '—')}</p>
                                        </div>
                                        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700/50 flex-1 min-w-[200px]">
                                           <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Valores e Pagamento</p>
                                           <p className="text-gray-200">
                                              <strong>💳 Pago Online (Cielo/PIX):</strong>{' '}
                                              <span className="font-semibold text-emerald-400">
                                                 R$ {metrics.onlinePaidBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                              </span>
                                              {metrics.onlinePaidEUR > 0 && metrics.currencyLocal !== 'BRL' ? <span className="text-gray-400 text-xs"> ({curSym(metrics.currencyLocal)} {metrics.onlinePaidEUR.toFixed(2)})</span> : null}
                                           </p>
                                           <p className="text-gray-200 mt-1">
                                              <strong>🏪 A Pagar na Retirada:</strong>{' '}
                                              {metrics.counterDueBRL > 0.05 || (metrics.currencyLocal !== 'BRL' && metrics.counterDueEUR > 0.05) ? (
                                                 <span className="font-semibold text-amber-400">
                                                    {metrics.currencyLocal !== 'BRL' && metrics.counterDueEUR > 0 ? (
                                                       <>{curSym(metrics.currencyLocal)} {metrics.counterDueEUR.toFixed(2)} <span className="text-amber-400/80 text-xs">(~R$ {metrics.counterDueBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</span></>
                                                    ) : (
                                                       <>R$ {metrics.counterDueBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</>
                                                    )}
                                                 </span>
                                              ) : (
                                                 <span className="text-emerald-400 text-xs font-semibold">R$ 0,00 (Quitado online)</span>
                                              )}
                                           </p>
                                           {metrics.isOneWay && (
                                              <p className="text-purple-300 text-xs mt-1">
                                                 <strong>↳ Taxa de Devolução:</strong>{' '}
                                                 {metrics.oneWayFeeEUR > 0 ? (
                                                    <span className="font-semibold">{curSym(metrics.currencyLocal)} {metrics.oneWayFeeEUR.toFixed(2)} (~R$ {metrics.oneWayFeeBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</span>
                                                 ) : (
                                                    <span className="text-gray-400">Inclusa na tarifa</span>
                                                 )}
                                              </p>
                                           )}
                                           <p className="text-gray-300 mt-1 text-xs">
                                              <strong>Total da Locação:</strong>{' '}
                                              <span className="font-bold text-white">
                                                 R$ {metrics.totalGeralBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                              </span>
                                              {metrics.totalGeralEUR > 0 && metrics.currencyLocal !== 'BRL' ? <span className="text-gray-400"> ({curSym(metrics.currencyLocal)} {metrics.totalGeralEUR.toFixed(2)})</span> : null}
                                           </p>
                                           <p className="text-gray-300"><strong>Câmbio:</strong> {(() => {
                                              const cur = String(metrics.currencyLocal || parsed?.booking?.car?.currency || 'BRL').toUpperCase();
                                              if (cur === 'BRL') return 'Moeda nacional (BRL)';
                                              const xrsRate = parseFloat(parsed?.booking?.car?.exchangeRate || parsed?.booking?.exchangeRate || '0');
                                              if (xrsRate > 0) {
                                                return `1 ${cur} = ${xrsRate.toFixed(4)} BRL`;
                                              }
                                              return '—';
                                           })()}</p>
                                           <div className="border-t border-gray-700/50 my-2"></div>
                                           <p className="text-gray-300"><strong>Método:</strong> <span className={`text-xs font-bold px-2 py-0.5 rounded ${res.status === 'CONFIRMED_PREPAID' ? 'bg-green-500/20 text-green-400' : res.status === 'PENDING_PIX' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-300'}`}>{STATUS_LABELS[res.status] || res.status}</span></p>
                                           {(parsed?.booking?.contractID || parsed?.contractID) && <p className="text-gray-300 mt-1"><strong>ContractID:</strong> <span className="font-mono text-xs text-orange-400">{parsed?.booking?.contractID || parsed?.contractID}</span></p>}
                                           <p className="text-gray-300"><strong>Merchant Order:</strong> <span className="font-mono text-[10px] text-gray-500">{res.merchantOrderId || "—"}</span></p>
                                           {parsed?.couponData && (
                                              <>
                                                 <div className="border-t border-gray-700/50 my-2"></div>
                                                 <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">🎟️ Cupom de Desconto</p>
                                                 <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3 space-y-1">
                                                    <p className="text-green-400 font-mono font-bold text-sm">{parsed.couponData.code}</p>
                                                    <p className="text-gray-300 text-xs">{parsed.couponData.discountLabel}</p>
                                                    {parsed.couponData.accepted && (
                                                       <div className="bg-amber-900/20 border border-amber-700/30 rounded p-2 mt-1">
                                                          <p className="text-amber-400 text-[10px] font-bold">✅ ACEITE DOCUMENTADO</p>
                                                          <p className="text-gray-400 text-[10px]">{parsed.couponData.acceptedText}</p>
                                                          <p className="text-gray-500 text-[10px] mt-0.5">Data: {parsed.couponData.acceptedAt ? new Date(parsed.couponData.acceptedAt).toLocaleString('pt-BR') : '—'}</p>
                                                       </div>
                                                    )}
                                                 </div>
                                              </>
                                           )}
                                        </div>
                                        <div className="bg-gray-900 rounded-lg p-4 border border-gray-700/50 flex-1 min-w-[200px]">
                                           <p className="text-[10px] text-gray-500 font-bold uppercase mb-2">Fidelidade, Voo e Extras</p>
                                           <p className="text-gray-300"><strong>Programa:</strong> {parsed?.loyaltyProgramId || "N/A"} {parsed?.loyaltyId && ` - ${parsed?.loyaltyId}`}</p>
                                           <p className="text-gray-300 flex items-center gap-2">
                                              <strong>Voo:</strong> {parsed?.flightNumber || "N/A"}
                                              {parsed?.flightNumber && (
                                                 <a href={`https://www.google.com/search?q=voo+${parsed.flightNumber}`} target="_blank" rel="noreferrer" className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded inline-flex items-center gap-1 transition-colors">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                    Consultar
                                                 </a>
                                              )}
                                           </p>
                                           {(parsed?.customer?.loyaltyProgramName || parsed?.customer?.loyaltyProgramId) && (
                                              <>
                                                 <div className="border-t border-gray-700/50 my-2"></div>
                                                 <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Programa de Fidelidade</p>
                                                 <div className="flex items-center gap-2">
                                                    <span className="bg-[#e67e00]/20 text-[#e67e00] text-[10px] font-bold px-2 py-1 rounded">✈️ {parsed.customer.loyaltyProgramName || parsed.customer.loyaltyProgramId}</span>
                                                    {parsed?.customer?.loyaltyId && (<span className="text-gray-400 text-[10px]">Nº {parsed.customer.loyaltyId}</span>)}
                                                 </div>
                                              </>
                                           )}
                                           <div className="border-t border-gray-700/50 my-2"></div>
                                           <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Proteções Contratadas</p>
                                           {(() => {
                                              const prots = listContractedProtections(parsed);
                                              if (prots.length === 0) return (<p className="text-gray-500 text-xs italic">Nenhuma proteção contratada (somente a cobertura básica da tarifa)</p>);
                                              return (
                                                 <div className="flex flex-wrap gap-1">
                                                    {prots.map((p) => (
                                                       <span key={p.code} className={`text-[10px] font-bold px-2 py-1 rounded ${p.includedInRate ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-600/40' : 'bg-green-900/40 text-green-300'}`}>
                                                          🛡️ {p.name}{p.qty > 1 ? ` x${p.qty}` : ''}{p.includedInRate ? ' (incluída na tarifa)' : ''}{p.priceBRL > 0 && ` (R$${p.priceBRL.toFixed(2)})`}
                                                       </span>
                                                    ))}
                                                 </div>
                                              );
                                           })()}
                                           {parsed?.booking?.xrsEquipment && parsed.booking.xrsEquipment.length > 0 && (
                                              <>
                                                 <div className="border-t border-gray-700/50 my-2"></div>
                                                 <p className="text-[10px] text-[#e67e00] font-bold uppercase mb-1">Acessórios</p>
                                                 <div className="flex flex-wrap gap-1">
                                                    {parsed.booking.xrsEquipment.map((eq: any) => (
                                                       <span key={eq.code} className="bg-orange-900/40 text-orange-300 text-[10px] font-bold px-2 py-1 rounded">{eq.icon || '📦'} {eq.name || eq.code} x{eq.qty}{eq.priceBRL > 0 && ` (R$${parseFloat(eq.priceBRL).toFixed(2)}/dia)`}</span>
                                                    ))}
                                                 </div>
                                              </>
                                           )}
                                        </div>
                                     </div>
                                  </td>
                               </tr>
                              )}
                           </Fragment>
                        );
                     })}
                  </tbody>
                  {!loading && reservations.length > 0 && (
                     <tfoot className="bg-gray-800/80 border-t-2 border-gray-700 text-white font-bold">
                        <tr>
                           <td className="px-4 py-3.5 text-xs uppercase text-gray-300">
                              Total ({reservations.length})
                           </td>
                           <td className="px-4 py-3.5 text-xs text-gray-400" colSpan={2}>
                              <span className="text-emerald-400">{activeList.length} ativas</span>
                              {pendingPixList.length > 0 && (
                                 <span className="text-amber-400 ml-1.5">· {pendingPixList.length} pend.</span>
                              )}
                              {cancelledList.length > 0 && (
                                 <span className="text-red-400 ml-1.5">· {cancelledList.length} canc.</span>
                              )}
                           </td>
                           <td className="px-4 py-3.5 text-xs font-black">
                              <div className="text-emerald-400">
                                 R$ {totalActiveBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </div>
                              {cancelledList.length > 0 && !isCancelledFilter && (
                                 <div className="text-[10px] text-red-400 font-normal">
                                    (Canc: R$ {totalCancelledBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                                 </div>
                              )}
                           </td>
                           <td className="px-4 py-3.5 text-xs text-gray-400" colSpan={4}>
                              {cancelledList.length > 0 && !isCancelledFilter ? (
                                 <span className="text-red-400 text-[11px] font-normal">
                                    * Reservas canceladas foram excluídas do total de receita ativa.
                                 </span>
                              ) : (
                                 <span className="text-emerald-400 text-[11px] font-normal">
                                    * Todas as {targetList.length} reservas filtradas são válidas.
                                 </span>
                              )}
                           </td>
                        </tr>
                     </tfoot>
                  )}
               </table>
            </div>
         </div>
      </div>
   );
}
