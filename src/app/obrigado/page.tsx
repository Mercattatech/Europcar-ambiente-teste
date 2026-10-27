"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import PaymentSplitBlocks from "@/components/checkout/PaymentSplitBlocks";
import type { PaymentSplit } from "@/lib/europcar/paymentSplit";

function ObrigadoContent() {
  const searchParams = useSearchParams();
  const resNumber = searchParams.get("res") || "";
  const method = searchParams.get("method") || "";
  const amountCents = parseInt(searchParams.get("amount") || "0");
  const amountBRL = amountCents > 0 ? (amountCents / 100) : 0;
  // Moeda da estação (enviado pelo checkout para reservas internacionais BALCÃO)
  const stationCurrency  = searchParams.get("currency") || "BRL";
  const exchangeRate     = parseFloat(searchParams.get("exchangeRate") || "1");

  // Valor formatado na moeda da reserva
  const displayAmount = (() => {
    if (amountBRL <= 0) return null;
    if (stationCurrency === "BRL" || exchangeRate <= 0) {
      return `R$ ${amountBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
    }
    // Converte BRL → moeda local
    const localAmount = amountBRL / exchangeRate;
    try {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: stationCurrency,
        minimumFractionDigits: stationCurrency === "JPY" ? 0 : 2,
      }).format(localAmount);
    } catch {
      return `${stationCurrency} ${localAmount.toFixed(2)}`;
    }
  })();

  const [conversionFired, setConversionFired] = useState(false);

  // Regra on-line (payer ba) × balcão — gravada pelo checkout antes do redirecionamento
  const [paymentSplit, setPaymentSplit] = useState<PaymentSplit | null>(null);
  useEffect(() => {
    if (!resNumber) return;
    try {
      const raw = sessionStorage.getItem(`europcar_payment_split_${resNumber}`);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.version === 1) setPaymentSplit(parsed);
    } catch { /* ignora */ }
  }, [resNumber]);

  // Fire Google conversion event once
  useEffect(() => {
    if (conversionFired || !resNumber) return;
    try {
      const w = window as any;
      if (typeof w.gtag === "function") {
        w.gtag("event", "purchase", {
          transaction_id: resNumber,
          value: amountBRL,
          currency: "BRL",
          items: [{ item_name: "Reserva Europcar", quantity: 1 }],
        });
        console.log(`[obrigado] ✅ gtag purchase event fired: ${resNumber} R$ ${amountBRL}`);
      }
      // Also push to dataLayer for GTM
      if (w.dataLayer) {
        w.dataLayer.push({
          event: "purchase",
          ecommerce: {
            transaction_id: resNumber,
            value: amountBRL,
            currency: "BRL",
            items: [{ item_name: "Reserva Europcar", quantity: 1 }],
          },
        });
      }
    } catch (e) {
      console.error("[obrigado] Error firing conversion:", e);
    }
    setConversionFired(true);
  }, [resNumber, amountBRL, conversionFired]);

  const methodLabel: Record<string, string> = {
    CREDIT: "Cartão de Crédito",
    PIX: "PIX",
    BALCAO: "Pagar no Balcão",
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7f7f7] to-gray-100 flex flex-col items-center justify-center p-4 gap-6">
      {/* Logo */}
      <div className="bg-[#008d36] px-6 py-3 rounded-md shadow-md">
        <img src="/logo.jpg" alt="Europcar" className="h-10 object-contain" />
      </div>

      {/* Card */}
      <div className="bg-white p-10 rounded-2xl shadow-xl max-w-lg w-full text-center border-t-8 border-[#008d36]">
        {/* Success Icon */}
        <div className="w-24 h-24 bg-green-100 text-[#008d36] rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-black text-gray-900 mb-2">Obrigado pela sua reserva!</h1>
        <p className="text-gray-500 mb-8">Sua reserva foi registrada com sucesso. Anote seu código abaixo.</p>

        {/* Reservation Number */}
        {resNumber && (
          <div className="bg-gray-50 border-2 border-[#008d36]/20 rounded-xl p-6 mb-6">
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-2">Código de Reserva</span>
            <span className="text-4xl font-black text-[#008d36] tracking-widest">{resNumber}</span>
          </div>
        )}

        {paymentSplit && (
          <div className="text-left mb-6" id="obrigado-payment-split">
            <PaymentSplitBlocks split={paymentSplit} onlineTitle="Pago on-line" />
          </div>
        )}


        {/* Info box */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 text-left">
          <p className="text-amber-800 text-sm">
            <strong>📧 Importante:</strong> Enviamos um e-mail com todos os detalhes da sua reserva. 
            Apresente o código de reserva no balcão da estação no momento da retirada do veículo.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/reservas"
            className="bg-[#008d36] hover:bg-[#007530] text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            📋 Minhas Reservas
          </Link>
          <Link
            href="/"
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            🏠 Ir para o início
          </Link>
        </div>
      </div>

      {/* Footer */}
      <p className="text-gray-400 text-xs">© {new Date().getFullYear()} Europcar Brasil · Todos os direitos reservados</p>
    </div>
  );
}

export default function ObrigadoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#008d36] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ObrigadoContent />
    </Suspense>
  );
}
