"use client";

import { useEffect, useState } from "react";
import "../franchise.css";

const SITE_URL = "https://www.europcar.com.br";
const SECONDS = 10;

export default function ThankYouFranchise() {
  const [left, setLeft] = useState(SECONDS);
  const [paused, setPaused] = useState(false);

  // Contagem regressiva → redireciona para o site da Europcar
  useEffect(() => {
    if (paused) return;
    if (left <= 0) {
      window.location.href = SITE_URL;
      return;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, paused]);

  return (
    <div className="fr">
      <header className="fr-top">
        <a className="fr-brand" href="/seja-um-franqueado" aria-label="Europcar Brasil — Franquias">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="Europcar" />
          <small>Seja um<br />franqueado</small>
        </a>
      </header>

      <main className="fr-thanks">
        <div className="fr-thanks-card">
          <div className="fr-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="fr-eyebrow">Interesse recebido</p>
          <h1>Obrigado! Recebemos os seus dados.</h1>
          <p className="fr-muted">
            Nossa equipe de expansão da Europcar Brasil vai analisar o seu perfil, a cidade de interesse e a aderência
            ao modelo, e entrará em contato em breve.
          </p>

          <div className="fr-steps">
            <span><b>1</b> Análise do perfil e da praça</span>
            <span><b>2</b> Contato do time de expansão</span>
            <span><b>3</b> Apresentação da proposta comercial</span>
          </div>

          <p className="fr-redirect" role="status" aria-live="polite">
            {paused
              ? "Redirecionamento pausado."
              : `Você será levado ao site da Europcar em ${left}s…`}
          </p>
          <div className="fr-actions fr-center">
            <a className="fr-btn fr-primary" href={SITE_URL}>Ir para o site da Europcar agora</a>
            <button className="fr-btn fr-darkbtn" type="button" onClick={() => setPaused((p) => !p)}>
              {paused ? "Retomar redirecionamento" : "Permanecer nesta página"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
