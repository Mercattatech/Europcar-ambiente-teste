"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "./franchise.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

interface SimInput { fleet: number; occupancy: number; ticket: number; vehicleCost: number }

// Premissas do simulador (mantidas exatamente como na proposta comercial)
function calc(i: SimInput) {
  const f = i.fleet;
  const o = i.occupancy / 100;
  const d = f * 30 * o;
  const r = d * i.ticket;
  const m = f * 100;
  const s = 8000 + (f <= 30 ? 1500 : f < 50 ? 3000 : 4500) + 900 + 300 + 200 + 300 + f * 11;
  const c = f <= 25 ? 2 : f <= 30 ? 4 : f <= 34 ? 5 : 6;
  const y = f >= 50 ? 2 : 1;
  const p = (4000 + c * 2400 + y * 2100) * 1.6;
  const a = (d / 8) * 0.85 * (8.12 * 5.2) + r * 0.06 + r * 0.02;
  const fees = r * 0.9 * 0.023 + r * 0.2 * 0.5;
  const e = m + s + p + a + r * 0.03 + fees + 700 + r * 0.14;
  const n = r - e;
  const real = n + f * i.vehicleCost * (0.2 / 12) - f * 833.33;
  const inv = f * i.vehicleCost;
  const roi = inv ? real / inv : 0;
  const pay = real > 0 ? inv / real : 0;
  return { d, r, n, real, roi, pay, margin: r ? n / r : 0 };
}

const BENEFITS = [
  ["01", "Marca global reconhecida", "Presença internacional, credibilidade e associação com turismo, mobilidade e locação."],
  ["02", "Geração de reservas", "Conexão com GDSs, OTAs e canais online como Rentcars, Decolar, Booking e Expedia."],
  ["03", "Hub de fornecedores", "Trabalho centralizado para negociar com montadoras, concessionárias, sistemas e parceiros."],
  ["04", "Estruturação de frota", "Relacionamento com o Grupo Volkswagen e outras montadoras para buscar condições competitivas."],
  ["05", "Sistema integrado", "Controle de frota, reservas, contratos, financeiro, multas, seguros e licenciamento."],
  ["06", "Novas receitas", "Marcas globais, reservas internacionais e possibilidade de comissionamento em turismo."],
  ["07", "Marketing da rede", "Fundo de marketing e ação regional para construção de marca e demanda local."],
  ["08", "Benefícios adicionais", "Relacionamentos e parcerias, incluindo benefícios de hotelaria para empresários e equipe."],
];

type Status = { kind: "idle" | "sending" | "ok" | "err"; msg: string };

/**
 * Campo do simulador: slider + campo numérico digitável (sincronizados).
 * O campo aceita digitar livremente; ao sair (ou Enter) o valor é ajustado ao intervalo permitido.
 */
function SimField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  display: string;
  onChange: (v: number) => void;
}) {
  const { label, value, min, max, step = 1, unit, display, onChange } = props;
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n / step) * step));
  const commit = () => {
    const n = Number(draft.replace(",", "."));
    const v = Number.isFinite(n) && draft.trim() !== "" ? clamp(n) : value;
    onChange(v);
    setDraft(String(v));
  };

  return (
    <div className="fr-field">
      <div className="fr-field-head">
        <span>{label}</span>
        <output>{display}</output>
      </div>
      <input
        className="fr-range"
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="fr-field-num">
        <button type="button" aria-label={`Diminuir ${label}`} onClick={() => onChange(clamp(value - step))}>−</button>
        <input
          type="text"
          inputMode="decimal"
          aria-label={`${label} (digite o valor)`}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = Number(e.target.value.replace(",", "."));
            if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
          }}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        />
        {unit && <em>{unit}</em>}
        <button type="button" aria-label={`Aumentar ${label}`} onClick={() => onChange(clamp(value + step))}>+</button>
      </div>
    </div>
  );
}

export default function FranchiseLanding() {
  const router = useRouter();
  const [sim, setSim] = useState<SimInput>({ fleet: 35, occupancy: 70, ticket: 300, vehicleCost: 100000 });
  const [status, setStatus] = useState<Status>({
    kind: "idle",
    msg: "Seus dados são enviados com segurança para o time de expansão da Europcar Brasil.",
  });
  const x = useMemo(() => calc(sim), [sim]);

  const set = (k: keyof SimInput) => (v: number) => setSim((s) => ({ ...s, [k]: v }));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "sending") return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const params = new URLSearchParams(window.location.search);

    setStatus({ kind: "sending", msg: "Enviando…" });
    try {
      const res = await fetch("/api/franquia/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          city: fd.get("city"),
          capital: fd.get("capital"),
          rental: fd.get("rental"),
          message: fd.get("message"),
          website: fd.get("website"), // honeypot
          simulation: sim,
          utm: {
            source: params.get("utm_source") || "",
            medium: params.get("utm_medium") || "",
            campaign: params.get("utm_campaign") || "",
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Não foi possível enviar agora.");
      form.reset();
      setStatus({ kind: "ok", msg: "Enviado! Redirecionando…" });
      router.push("/seja-um-franqueado/obrigado");
    } catch (err: any) {
      setStatus({ kind: "err", msg: err?.message || "Não foi possível enviar agora. Tente novamente." });
    }
  }

  return (
    <div className="fr">
      <header className="fr-top">
        <a className="fr-brand" href="#inicio" aria-label="Europcar Brasil — Franquias">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="Europcar" />
          <small>Seja um<br />franqueado</small>
        </a>
        <nav className="fr-nav">
          <a href="#diferenciais">Diferenciais</a>
          <a href="#simulador">Simulador</a>
          <a href="#interesse">Quero conhecer</a>
          <a href="/">Site de reservas</a>
        </nav>
      </header>

      <main>
        <section id="inicio" className="fr-hero">
          <div className="fr-wrap">
            <p className="fr-kicker">Projeto Expansão 2030</p>
            <h1>Abra uma franquia Europcar e entre em uma rede global de mobilidade.</h1>
            <p className="fr-lead">
              Uma oportunidade para operadores e investidores que querem atuar em rent a car com marca
              internacional, canais de reserva, tecnologia operacional e apoio comercial estruturado.
            </p>
            <div className="fr-actions">
              <a className="fr-btn fr-primary" href="#interesse">Quero falar com a expansão</a>
              <a className="fr-btn fr-ghost" href="#simulador">Simular rentabilidade</a>
            </div>
            <div className="fr-proof">
              <span><strong>140+</strong>países</span>
              <span><strong>3.835+</strong>pontos globais</span>
              <span><strong>1,2 mi</strong>veículos na rede</span>
            </div>
          </div>
        </section>

        <section className="fr-intro fr-wrap">
          <div>
            <p className="fr-eyebrow">Por que agora</p>
            <h2>Uma marca internacional em fase de reconstrução e expansão no Brasil.</h2>
          </div>
          <p>
            A proposta da Europcar Brasil combina reconhecimento global, operação local e um hub de benefícios para
            ajudar o franqueado a negociar melhor, receber reservas, estruturar frota e operar com mais controle.
          </p>
        </section>

        <section id="diferenciais" className="fr-wrap">
          <div className="fr-head">
            <p className="fr-eyebrow">Diferenciais da proposta</p>
            <h2>O que a rede entrega para aumentar competitividade.</h2>
          </div>
          <div className="fr-grid">
            {BENEFITS.map(([n, title, text]) => (
              <article className="fr-card" key={n}>
                <span className="fr-num">{n}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="fr-visuals fr-wrap">
          <article className="fr-visual"><h3>Operação local com marca internacional</h3><p>Cresça em praças estratégicas com o peso de uma rede global.</p></article>
          <article className="fr-visual"><h3>Hub de benefícios</h3><p>Reservas, fornecedores, tecnologia e marketing trabalhando a favor do franqueado.</p></article>
          <article className="fr-visual"><h3>Decisão orientada por números</h3><p>Proposta comercial combinada com simulação de rentabilidade.</p></article>
        </section>

        <section id="simulador" className="fr-wrap">
          <div className="fr-head">
            <p className="fr-eyebrow">Simulador financeiro</p>
            <h2>Veja uma estimativa de receita, resultado e ROI.</h2>
            <p className="fr-muted">Ajuste as principais premissas para entender o potencial econômico da loja.</p>
          </div>
          <div className="fr-sim">
            <form className="fr-panel" onSubmit={(e) => e.preventDefault()}>
              <SimField label="Frota operacional" value={sim.fleet} min={15} max={90} unit="veículos"
                display={`${number.format(sim.fleet)} veículos`} onChange={set("fleet")} />
              <SimField label="Taxa de ocupação" value={sim.occupancy} min={20} max={90} unit="%"
                display={`${number.format(sim.occupancy)}%`} onChange={set("occupancy")} />
              <SimField label="Ticket médio por diária" value={sim.ticket} min={180} max={520} step={5} unit="R$"
                display={money.format(sim.ticket)} onChange={set("ticket")} />
              <SimField label="Capital por veículo" value={sim.vehicleCost} min={70000} max={160000} step={5000} unit="R$"
                display={money.format(sim.vehicleCost)} onChange={set("vehicleCost")} />
            </form>
            <div className="fr-results">
              <article className="fr-metric fr-green"><span>Receita mensal</span><strong>{money.format(x.r)}</strong><small>{number.format(x.d)} diárias realizadas</small></article>
              <article className="fr-metric"><span>Resultado líquido</span><strong>{money.format(x.n)}</strong><small>{pct.format(x.margin)} de margem</small></article>
              <article className="fr-metric"><span>Lucro real ajustado</span><strong>{money.format(x.real)}</strong><small>inclui depreciação e perda patrimonial</small></article>
              <article className="fr-metric"><span>ROI mensal</span><strong>{pct.format(x.roi)}</strong><small>{x.pay > 0 ? `${number.format(x.pay)} meses de payback` : "sem payback no cenário"}</small></article>
            </div>
          </div>
          <aside className="fr-disclaimer" role="note">
            <strong>⚠️ Aviso importante</strong>
            <p>
              Este simulador é apenas uma <b>previsão ilustrativa</b>, calculada com premissas estimadas.
              Os resultados <b>não representam garantia, promessa ou compromisso de rentabilidade</b>. Os números reais
              dependem da praça, da frota, da ocupação, dos custos operacionais, da gestão do negócio e das condições
              comerciais definidas em contrato de franquia.
            </p>
          </aside>
        </section>

        <section className="fr-profile fr-wrap">
          <div className="fr-card fr-profilebox">
            <p className="fr-eyebrow">Perfil ideal</p>
            <h2>Buscamos candidatos com capital, cidade definida e apetite para operar com padrão de rede.</h2>
            <p className="fr-muted">Se você já possui locadora, atua com frota, turismo, mobilidade, aeroporto, hotelaria ou deseja investir no segmento, preencha o formulário.</p>
          </div>
          <div className="fr-tags">
            <span>Operador de locadora</span>
            <span>Investidor com capital para frota</span>
            <span>Empresário regional</span>
            <span>Praças turísticas e corporativas</span>
          </div>
        </section>

        <section id="interesse" className="fr-leadsec fr-wrap">
          <div className="fr-copy">
            <p className="fr-eyebrow">Próximo passo</p>
            <h2>Receba uma análise da sua cidade e uma conversa com a expansão Europcar.</h2>
            <p className="fr-muted">Preencha os dados para avaliarmos perfil, capital, cidade de interesse e aderência ao modelo.</p>
          </div>
          <form className="fr-form" onSubmit={onSubmit}>
            <label><span>Nome completo</span><input name="name" required autoComplete="name" /></label>
            <label><span>E-mail</span><input name="email" type="email" required autoComplete="email" /></label>
            <label><span>Telefone / WhatsApp</span><input name="phone" type="tel" required autoComplete="tel" placeholder="(11) 99999-8888" /></label>
            <label><span>Cidade de interesse</span><input name="city" required /></label>
            <label><span>Capital para investimento</span>
              <select name="capital" required defaultValue="">
                <option value="">Selecione</option>
                <option>Até R$ 1 milhão</option>
                <option>R$ 1 mi a R$ 2,5 mi</option>
                <option>R$ 2,5 mi a R$ 5 mi</option>
                <option>Acima de R$ 5 mi</option>
              </select></label>
            <label><span>Já possui locadora?</span>
              <select name="rental" required defaultValue="">
                <option value="">Selecione</option>
                <option>Sim, já possuo locadora</option>
                <option>Não, mas atuo com frota/mobilidade</option>
                <option>Não, sou investidor</option>
              </select></label>
            <label className="fr-full"><span>Mensagem opcional</span><textarea name="message" rows={4} maxLength={1000} /></label>
            {/* Honeypot anti-robô: invisível para pessoas */}
            <input className="fr-hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <button className="fr-btn fr-primary fr-full" type="submit" disabled={status.kind === "sending"}>
              {status.kind === "sending" ? "Enviando…" : "Enviar interesse"}
            </button>
            <p className={`fr-status ${status.kind === "ok" ? "fr-ok" : status.kind === "err" ? "fr-err" : ""}`} role="status" aria-live="polite">
              {status.msg}
            </p>
          </form>
        </section>
      </main>
    </div>
  );
}
