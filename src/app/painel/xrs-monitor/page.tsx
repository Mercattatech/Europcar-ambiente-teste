"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function XrsMonitorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Config fields
  const [enabled, setEnabled] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(7);
  const [messagingIntervalSeconds, setMessagingIntervalSeconds] = useState(10);
  const [testStation, setTestStation] = useState("LIST01");
  const [whatsappNumbers, setWhatsappNumbers] = useState<string[]>([""]);
  const [errorMessageTemplate, setErrorMessageTemplate] = useState("");
  const [recoveryMessageTemplate, setRecoveryMessageTemplate] = useState("");

  // Status info
  const [lastStatus, setLastStatus] = useState("UNKNOWN");
  const [lastCheckAt, setLastCheckAt] = useState<string | null>(null);
  const [lastErrorAt, setLastErrorAt] = useState<string | null>(null);
  const [lastRecoveryAt, setLastRecoveryAt] = useState<string | null>(null);
  const [lastErrorMessage, setLastErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const res = await fetch("/api/admin/xrs-monitor");
      if (!res.ok) return;
      const data = await res.json();
      setEnabled(data.enabled);
      setIntervalMinutes(data.intervalMinutes);
      setMessagingIntervalSeconds(data.messagingIntervalSeconds);
      setTestStation(data.testStation);
      setErrorMessageTemplate(data.errorMessageTemplate);
      setRecoveryMessageTemplate(data.recoveryMessageTemplate);
      setLastStatus(data.lastStatus);
      setLastCheckAt(data.lastCheckAt);
      setLastErrorAt(data.lastErrorAt);
      setLastRecoveryAt(data.lastRecoveryAt);
      setLastErrorMessage(data.lastErrorMessage);
      const nums = Array.isArray(data.whatsappNumbers) ? data.whatsappNumbers : [];
      setWhatsappNumbers(nums.length > 0 ? nums : [""]);
    } catch { } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/xrs-monitor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          intervalMinutes,
          messagingIntervalSeconds,
          testStation,
          errorMessageTemplate,
          recoveryMessageTemplate,
          whatsappNumbers: whatsappNumbers.filter(n => n.trim()),
        }),
      });
      if (res.ok) {
        alert("Configurações salvas com sucesso!");
        loadConfig();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert("Erro ao salvar: " + (errData.error || `HTTP ${res.status}`));
      }
    } catch (err: any) {
      alert("Erro ao salvar: " + (err.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/cron/xrs-monitor");
      const data = await res.json();
      setTestResult(data);
      loadConfig(); // Reload status
    } catch (err: any) {
      setTestResult({ error: err.message });
    } finally {
      setTesting(false);
    }
  }

  function addNumber() {
    if (whatsappNumbers.length < 3) {
      setWhatsappNumbers([...whatsappNumbers, ""]);
    }
  }

  function removeNumber(idx: number) {
    setWhatsappNumbers(whatsappNumbers.filter((_, i) => i !== idx));
  }

  function updateNumber(idx: number, value: string) {
    const nums = [...whatsappNumbers];
    nums[idx] = value;
    setWhatsappNumbers(nums);
  }

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("pt-BR");
  };

  const statusColor = lastStatus === "OK" ? "bg-green-100 text-green-800 border-green-300" : lastStatus === "ERROR" ? "bg-red-100 text-red-800 border-red-300" : "bg-gray-100 text-gray-600 border-gray-300";
  const statusIcon = lastStatus === "OK" ? "✅" : lastStatus === "ERROR" ? "❌" : "❓";

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Carregando...</p></div>;
  }

  return (
    <div className="min-h-screen bg-[#f7f7f7] p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900">🔍 Monitor XRS</h1>
            <p className="text-sm text-gray-500">Monitoramento automático da API XRS (Europcar) com alertas WhatsApp</p>
          </div>
          <button
            onClick={() => router.push("/painel")}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Voltar ao Painel
          </button>
        </div>

        {/* Status Card */}
        <div className={`rounded-xl border-2 p-5 mb-6 ${statusColor}`}>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-2xl mr-2">{statusIcon}</span>
              <span className="font-black text-lg">{lastStatus === "OK" ? "API Operacional" : lastStatus === "ERROR" ? "API Fora do Ar" : "Sem dados"}</span>
            </div>
            <button
              onClick={runTest}
              disabled={testing}
              className="bg-white border border-gray-300 text-gray-700 font-bold py-2 px-4 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {testing ? "Testando..." : "🔄 Testar Agora"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
            <div><strong>Último check:</strong> {fmtDate(lastCheckAt)}</div>
            <div><strong>Último erro:</strong> {fmtDate(lastErrorAt)}</div>
            <div><strong>Última recuperação:</strong> {fmtDate(lastRecoveryAt)}</div>
            <div><strong>Erro:</strong> {lastErrorMessage || "—"}</div>
          </div>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`rounded-lg border p-4 mb-6 text-sm ${testResult.status === "OK" ? "bg-green-50 border-green-200" : testResult.status === "ERROR" ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
            <p className="font-bold mb-1">Resultado do Teste:</p>
            <pre className="text-xs font-mono whitespace-pre-wrap break-all">{JSON.stringify(testResult, null, 2)}</pre>
          </div>
        )}

        {/* Config Form */}
        <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
          <h2 className="text-lg font-black text-gray-900 border-b pb-3">⚙️ Configurações</h2>

          {/* Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="font-bold text-gray-800 text-sm">Monitoramento Ativo</label>
              <p className="text-xs text-gray-500">Ativa a verificação automática periódica</p>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative w-14 h-7 rounded-full transition-colors ${enabled ? "bg-green-500" : "bg-gray-300"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-7" : ""}`} />
            </button>
          </div>

          {/* Intervals */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Intervalo de Monitoramento</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1} max={60}
                  value={intervalMinutes}
                  onChange={e => setIntervalMinutes(Number(e.target.value))}
                  className="border rounded-lg p-2 w-20 text-center font-bold"
                />
                <span className="text-sm text-gray-500">minutos</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Intervalo entre Mensagens</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0} max={120}
                  value={messagingIntervalSeconds}
                  onChange={e => setMessagingIntervalSeconds(Number(e.target.value))}
                  className="border rounded-lg p-2 w-20 text-center font-bold"
                />
                <span className="text-sm text-gray-500">segundos</span>
              </div>
            </div>
          </div>

          {/* Test Station */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Estação de Teste</label>
            <input
              type="text"
              value={testStation}
              onChange={e => setTestStation(e.target.value)}
              className="border rounded-lg p-2 w-40 font-mono uppercase"
              placeholder="LIST01"
            />
            <p className="text-xs text-gray-400 mt-1">Código da estação usada no health check (ex: LIST01, GIGT01)</p>
          </div>

          {/* WhatsApp Numbers */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Números WhatsApp (até 3)</label>
            {whatsappNumbers.map((num, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-2">
                <span className="text-gray-400 text-sm font-bold w-5">{idx + 1}.</span>
                <input
                  type="tel"
                  value={num}
                  onChange={e => updateNumber(idx, e.target.value)}
                  className="border rounded-lg p-2 flex-1 font-mono"
                  placeholder="5511999999999"
                />
                {whatsappNumbers.length > 1 && (
                  <button
                    onClick={() => removeNumber(idx)}
                    className="text-red-500 hover:text-red-700 font-bold text-lg"
                  >×</button>
                )}
              </div>
            ))}
            {whatsappNumbers.length < 3 && (
              <button
                onClick={addNumber}
                className="text-blue-600 text-sm font-bold hover:underline"
              >+ Adicionar número</button>
            )}
          </div>

          {/* Message Templates */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Mensagem de Erro</label>
            <textarea
              value={errorMessageTemplate}
              onChange={e => setErrorMessageTemplate(e.target.value)}
              className="border rounded-lg p-3 w-full text-sm font-mono"
              rows={3}
            />
            <p className="text-xs text-gray-400 mt-1">Variáveis: {"{DATA}"}, {"{HORA}"}, {"{ERRO}"}</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Mensagem de Recuperação</label>
            <textarea
              value={recoveryMessageTemplate}
              onChange={e => setRecoveryMessageTemplate(e.target.value)}
              className="border rounded-lg p-3 w-full text-sm font-mono"
              rows={3}
            />
            <p className="text-xs text-gray-400 mt-1">Variáveis: {"{DATA}"}, {"{HORA}"}</p>
          </div>

          {/* Save Button */}
          <button
            onClick={saveConfig}
            disabled={saving}
            className="w-full bg-[#008d36] hover:bg-[#006d2a] text-white font-black py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? "Salvando..." : "💾 Salvar Configurações"}
          </button>
        </div>
      </div>
    </div>
  );
}
