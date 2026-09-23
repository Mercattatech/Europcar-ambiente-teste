"use client";

import { useState, useEffect } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem("europcar_cookie_consent");
      if (!consent) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    try { localStorage.setItem("europcar_cookie_consent", "accepted"); } catch {}
    setVisible(false);
  };

  const reject = () => {
    try { localStorage.setItem("europcar_cookie_consent", "rejected"); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      className="fixed bottom-0 left-0 right-0 z-[9999] p-4 md:p-6 animate-in slide-in-from-bottom duration-500"
    >
      <div className="max-w-5xl mx-auto bg-[#111] border border-gray-700 rounded-2xl shadow-2xl p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Icon */}
          <div className="shrink-0 w-10 h-10 bg-[#008d36]/20 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-[#008d36]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm mb-1">🍪 Utilizamos cookies</p>
            <p className="text-gray-400 text-xs leading-relaxed">
              Usamos cookies essenciais para o funcionamento do site e cookies analíticos para melhorar sua experiência.
              Ao continuar navegando, você concorda com nossa{" "}
              <a href="/termos/cookies" className="text-[#008d36] hover:underline font-medium">
                Política de Cookies
              </a>{" "}
              e{" "}
              <a href="/termos/privacidade" className="text-[#008d36] hover:underline font-medium">
                Política de Privacidade
              </a>.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              id="cookie-reject-btn"
              onClick={reject}
              className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors py-2 px-3"
            >
              Apenas essenciais
            </button>
            <button
              id="cookie-accept-btn"
              onClick={accept}
              className="bg-[#008d36] hover:bg-[#007a2e] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
            >
              Aceitar todos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
