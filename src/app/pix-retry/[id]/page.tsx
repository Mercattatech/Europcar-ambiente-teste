"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

export default function PixRetryPage() {
  const params = useParams();
  const merchantOrderId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pixData, setPixData] = useState<{
    qrCodeBase64: string;
    qrCodeString: string;
    paymentId: string;
    amount: number;
    merchantOrderId: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [paid, setPaid] = useState(false);
  const [resNumber, setResNumber] = useState("");

  const generateNewPix = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/pix-retry/${merchantOrderId}`);
      const data = await res.json();
      if (data.success) {
        setPixData(data);
      } else if (data.status === 'NOT_FOUND') {
        setError("Esta reserva já foi confirmada ou não existe mais.");
        setPaid(true);
      } else {
        setError(data.error || "Erro ao gerar novo PIX.");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [merchantOrderId]);

  useEffect(() => {
    if (merchantOrderId) generateNewPix();
  }, [merchantOrderId, generateNewPix]);

  // Auto-check payment status every 5 seconds
  useEffect(() => {
    if (!pixData || paid) return;
    const interval = setInterval(async () => {
      setCheckingStatus(true);
      try {
        const res = await fetch(`/api/reservas/pix-status?merchantOrderId=${merchantOrderId}`);
        const data = await res.json();
        if (data.status === "PAID") {
          setPaid(true);
          setResNumber(data.resNumber || "");
          clearInterval(interval);
          // Redirect to thank you page
          const amt = pixData?.amount || 0;
          window.location.href = `/obrigado?res=${encodeURIComponent(data.resNumber || '')}&method=PIX&amount=${amt}`;
        }
      } catch {}
      setCheckingStatus(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [pixData, paid, merchantOrderId]);

  const copyToClipboard = () => {
    if (pixData?.qrCodeString) {
      navigator.clipboard.writeText(pixData.qrCodeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const amountBRL = pixData ? (pixData.amount / 100).toFixed(2).replace(".", ",") : "0,00";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">

        {/* Header */}
        <div className="bg-[#008d36] p-6 text-center">
          <div className="text-3xl font-black text-white italic tracking-tight">Europcar</div>
          <p className="text-white/70 text-sm mt-1">europcar.com.br</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Paid */}
          {paid && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">Pagamento Confirmado!</h2>
              <p className="text-gray-500">Obrigado! Sua reserva está garantida.</p>
              {resNumber && (
                <div className="mt-4 bg-green-50 border-2 border-green-500 rounded-xl p-4">
                  <p className="text-xs text-green-600 font-bold uppercase">Número da Reserva</p>
                  <p className="text-2xl font-black text-green-700 tracking-widest mt-1">{resNumber}</p>
                </div>
              )}
              <a href="/" className="inline-block mt-6 bg-[#008d36] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#007530] transition-colors">
                Ir para o site
              </a>
            </div>
          )}

          {/* Loading */}
          {loading && !paid && (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-[#008d36] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="font-bold text-gray-600">Gerando novo PIX...</p>
            </div>
          )}

          {/* Error */}
          {!loading && error && !paid && (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">⚠️</div>
              <p className="font-bold text-red-700 mb-2">{error}</p>
              <button onClick={generateNewPix} className="mt-4 bg-[#008d36] text-white font-bold px-6 py-2.5 rounded-xl hover:bg-[#007530] transition-colors">
                Tentar novamente
              </button>
            </div>
          )}

          {/* PIX QR Code */}
          {!loading && !error && pixData && !paid && (
            <>
              <div className="text-center mb-4">
                <h2 className="text-xl font-black text-gray-900">Novo PIX Gerado!</h2>
                <p className="text-gray-500 text-sm mt-1">Escaneie o QR Code ou copie o código abaixo</p>
              </div>

              {/* Amount */}
              <div className="bg-gray-50 rounded-xl p-4 text-center mb-4">
                <p className="text-xs text-gray-500 font-bold uppercase">Valor</p>
                <p className="text-3xl font-black text-[#008d36]">R$ {amountBRL}</p>
              </div>

              {/* QR Code */}
              {pixData.qrCodeBase64 && (
                <div className="flex justify-center mb-4">
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-3">
                    <img
                      src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                      alt="QR Code PIX"
                      className="w-52 h-52"
                    />
                  </div>
                </div>
              )}

              {/* Copy PIX */}
              <button
                onClick={copyToClipboard}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                  copied
                    ? "bg-green-500 text-white"
                    : "bg-[#008d36] hover:bg-[#007530] text-white"
                }`}
              >
                {copied ? "✅ Código copiado!" : "📋 Copiar PIX Copia e Cola"}
              </button>

              {/* PIX String (hidden overflow) */}
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">PIX Copia e Cola</p>
                <p className="text-xs text-gray-600 font-mono break-all leading-relaxed">{pixData.qrCodeString}</p>
              </div>

              {/* Status indicator */}
              <div className="mt-4 text-center">
                <div className="inline-flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
                  {checkingStatus ? (
                    <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                  )}
                  <span className="text-xs text-yellow-700 font-bold">Aguardando pagamento...</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-2">A página será atualizada automaticamente quando o pagamento for confirmado.</p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 p-4 text-center">
          <p className="text-gray-400 text-xs">© {new Date().getFullYear()} Europcar Brasil · Todos os direitos reservados</p>
        </div>
      </div>
    </div>
  );
}
