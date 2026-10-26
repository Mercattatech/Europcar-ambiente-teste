"use client";

import { useEffect, useRef, useState } from "react";
import { APPLICATION_QUESTIONS } from "@/lib/franquia/applicationQuestions";

/** Chave do localStorage: quem já aplicou não vê o popup de novo. */
export const APPLICATION_STORAGE_KEY = "fr_aplicacao_v1";

export interface ApplicationContact {
  name: string;
  email: string;
  phone: string;
  city: string;
}

type Status = { kind: "idle" | "sending" | "err"; msg: string };

const TOTAL_STEPS = APPLICATION_QUESTIONS.length + 1; // 8 perguntas + contato

/**
 * Popup de aplicação que libera o simulador.
 * Passo a passo: 8 perguntas de qualificação → dados de contato → envio ao webhook.
 */
export default function FranchiseApplication({ onDone }: { onDone: (contact: ApplicationContact) => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [hp, setHp] = useState(""); // honeypot
  const [status, setStatus] = useState<Status>({ kind: "idle", msg: "" });
  const dialogRef = useRef<HTMLDivElement>(null);

  const isContactStep = step === APPLICATION_QUESTIONS.length;
  const q = APPLICATION_QUESTIONS[step];
  const progress = Math.round(((step + 1) / TOTAL_STEPS) * 100);

  // Trava o scroll da página enquanto o popup está aberto
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Foco no primeiro campo a cada passo (acessibilidade/teclado)
  useEffect(() => {
    const el = dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]");
    el?.focus();
  }, [step]);

  function choose(id: string, label: string) {
    setAnswers((a) => ({ ...a, [id]: label }));
    // Pequena pausa para o usuário ver a opção marcada antes de avançar
    window.setTimeout(() => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1)), 220);
  }

  function next(e?: React.FormEvent) {
    e?.preventDefault();
    if (q?.type === "text" && !(answers[q.id] || "").trim()) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "sending") return;
    if (!e.currentTarget.reportValidity()) return;

    const params = new URLSearchParams(window.location.search);
    setStatus({ kind: "sending", msg: "Enviando sua aplicação…" });
    try {
      const res = await fetch("/api/franquia/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "aplicacao",
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          city: answers.cidade || "",
          application: answers,
          website: hp,
          pageUrl: window.location.href,
          utm: {
            source: params.get("utm_source") || "",
            medium: params.get("utm_medium") || "",
            campaign: params.get("utm_campaign") || "",
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Não foi possível enviar agora.");

      try { localStorage.setItem(APPLICATION_STORAGE_KEY, new Date().toISOString()); } catch { /* ignora */ }
      onDone({ ...contact, city: answers.cidade || "" });
    } catch (err: any) {
      setStatus({ kind: "err", msg: err?.message || "Não foi possível enviar agora. Tente novamente." });
    }
  }

  return (
    <div className="fr-app-overlay">
      <div
        ref={dialogRef}
        className="fr-app"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fr-app-title"
      >
        <header className="fr-app-head">
          <span className="fr-app-badge">Aplicação de franqueado</span>
          <h2 id="fr-app-title">
            Para ter acesso ao simulador da franquia Europcar, preencha a aplicação para sabermos se você está
            elegível a ser nosso franqueado.
          </h2>
          <div className="fr-app-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
          <p className="fr-app-count">Etapa {step + 1} de {TOTAL_STEPS}</p>
        </header>

        <div className="fr-app-body" key={step}>
          {!isContactStep && q?.type === "choice" && (
            <fieldset className="fr-app-q">
              <legend>{q.title}</legend>
              {q.hint && <p className="fr-app-hint">{q.hint}</p>}
              <div className="fr-app-options">
                {q.options!.map((o, i) => {
                  const selected = answers[q.id] === o.label;
                  return (
                    <button
                      key={o.label}
                      id={`fr-app-${q.id}-${i}`}
                      type="button"
                      className={`fr-app-opt${selected ? " is-selected" : ""}`}
                      aria-pressed={selected}
                      data-autofocus={i === 0 ? "" : undefined}
                      onClick={() => choose(q.id, o.label)}
                    >
                      <span className="fr-app-radio" aria-hidden="true" />
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {!isContactStep && q?.type === "text" && (
            <form className="fr-app-q" onSubmit={next}>
              <label className="fr-app-label">
                <span className="fr-app-legend">{q.title}</span>
                <input
                  id={`fr-app-${q.id}`}
                  data-autofocus=""
                  required
                  maxLength={120}
                  placeholder={q.placeholder}
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                />
              </label>
              <button className="fr-btn fr-primary fr-app-next" type="submit" disabled={!(answers[q.id] || "").trim()}>
                Continuar
              </button>
            </form>
          )}

          {isContactStep && (
            <form className="fr-app-q" onSubmit={submit}>
              <p className="fr-app-legend">Última etapa: como podemos falar com você?</p>
              <label className="fr-app-label">
                <span>Nome completo</span>
                <input id="fr-app-name" data-autofocus="" required autoComplete="name" maxLength={120}
                  value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} />
              </label>
              <label className="fr-app-label">
                <span>E-mail</span>
                <input id="fr-app-email" type="email" required autoComplete="email" maxLength={160}
                  value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} />
              </label>
              <label className="fr-app-label">
                <span>Telefone / WhatsApp</span>
                <input id="fr-app-phone" type="tel" required autoComplete="tel" placeholder="(11) 99999-8888"
                  minLength={10} title="Informe DDD + número"
                  value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} />
              </label>
              <input className="fr-hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
                value={hp} onChange={(e) => setHp(e.target.value)} />
              <button id="fr-app-submit" className="fr-btn fr-primary fr-app-next" type="submit" disabled={status.kind === "sending"}>
                {status.kind === "sending" ? "Enviando…" : "Enviar aplicação e acessar o simulador"}
              </button>
              <p className="fr-app-privacy">
                Seus dados são enviados com segurança ao time de expansão da Europcar Brasil.
              </p>
              {status.kind === "err" && <p className="fr-app-err" role="alert">{status.msg}</p>}
            </form>
          )}
        </div>

        <footer className="fr-app-foot">
          {step > 0 ? (
            <button type="button" className="fr-app-back" onClick={() => setStep((s) => Math.max(0, s - 1))}>
              ← Voltar
            </button>
          ) : <span />}
          <a className="fr-app-exit" href="/">Ir para o site de reservas</a>
        </footer>
      </div>
    </div>
  );
}
