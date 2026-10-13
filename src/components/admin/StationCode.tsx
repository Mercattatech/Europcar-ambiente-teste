"use client";

import { useState } from "react";

/**
 * Código de loja (ex.: LISX02) com tooltip de nome + endereço ao passar o mouse.
 * Os dados vêm de /api/europcar/stationInfo (cache no servidor) e ficam em cache na página,
 * então cada loja é consultada uma única vez por sessão do painel.
 */

interface StationInfo {
  code: string;
  name: string;
  fullAddress: string;
  phone?: string;
}

const cache = new Map<string, Promise<StationInfo | null>>();

function loadStation(code: string): Promise<StationInfo | null> {
  let p = cache.get(code);
  if (!p) {
    p = fetch(`/api/europcar/stationInfo?code=${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d?.station as StationInfo) || null)
      .catch(() => null);
    // Falha não fica em cache: permite nova tentativa no próximo hover
    p.then((s) => { if (!s) cache.delete(code); });
    cache.set(code, p);
  }
  return p;
}

export default function StationCode({ code, className = "" }: { code?: string | null; className?: string }) {
  const c = String(code || "").trim().toUpperCase();
  const [info, setInfo] = useState<StationInfo | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [open, setOpen] = useState(false);

  if (!c) return <span className={className}>—</span>;

  const onEnter = () => {
    setOpen(true);
    if (state === "idle" || state === "error") {
      setState("loading");
      loadStation(c).then((s) => {
        setInfo(s);
        setState(s ? "done" : "error");
      });
    }
  };

  const title = info ? `${info.name} (${info.code})${info.fullAddress ? ` — ${info.fullAddress}` : ""}` : c;

  return (
    <span
      className={`relative inline-block cursor-help underline decoration-dotted decoration-gray-500 underline-offset-2 ${className}`}
      onMouseEnter={onEnter}
      onMouseLeave={() => setOpen(false)}
      onFocus={onEnter}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      title={title}
      aria-label={title}
    >
      {c}
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-left text-xs font-normal normal-case text-gray-300 shadow-xl no-underline"
        >
          {state === "loading" && <span className="text-gray-500">Carregando loja…</span>}
          {state === "error" && <span className="text-gray-500">Não foi possível carregar os dados da loja {c}.</span>}
          {state === "done" && info && (
            <>
              <span className="block font-bold text-white">{info.name}</span>
              <span className="block font-mono text-[10px] text-gray-500">{info.code}</span>
              {info.fullAddress && <span className="mt-1 block leading-snug">📍 {info.fullAddress}</span>}
              {info.phone && <span className="mt-0.5 block text-gray-400">📞 {info.phone}</span>}
            </>
          )}
        </span>
      )}
    </span>
  );
}
