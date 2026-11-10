"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * Link de pagamento enviado por um vendedor.
 * Restaura a cotação congelada e leva o cliente ao checkout normal (PIX / cartão com 3DS).
 */
export default function PagarLinkPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/pagamento-link/${token}`);
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Link inválido."); return; }
        sessionStorage.setItem("europcar_booking", JSON.stringify(data.bookingData));
        sessionStorage.setItem("europcar_payment_link_token", data.token);
        sessionStorage.setItem("europcar_payment_link_customer", JSON.stringify(data.customerData || {}));
        router.replace("/checkout");
      } catch {
        setError("Erro de conexão. Verifique sua internet e tente novamente.");
      }
    })();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 max-w-md w-full text-center">
        <img src="/logo.jpg" alt="Europcar" className="h-10 mx-auto mb-6 object-contain" />
        {error ? (
          <>
            <div className="text-4xl mb-3">⚠️</div>
            <h1 className="text-lg font-black text-gray-900 mb-2">Não foi possível abrir o link</h1>
            <p className="text-sm text-gray-600 mb-6">{error}</p>
            <a href="/" className="inline-block bg-[#008d36] hover:bg-[#007a2d] text-white font-bold py-3 px-6 rounded-lg text-sm">Ir para o site</a>
          </>
        ) : (
          <>
            <div className="w-10 h-10 border-4 border-[#008d36] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-600 font-medium">Carregando a sua reserva...</p>
          </>
        )}
      </div>
    </div>
  );
}

