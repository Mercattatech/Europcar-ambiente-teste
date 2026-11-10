"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export type NavItem = { href: string; label: string; icon: string };
export type NavGroup = { id: string; label: string; icon: string; items: NavItem[] };

const STORAGE_KEY = "painel_menu_open_groups";
const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Item ativo = o href mais específico (mais longo) que casa com a rota atual. */
export function findActiveHref(pathname: string, groups: NavGroup[]): string | null {
  let best: string | null = null;
  for (const g of groups) {
    for (const it of g.items) {
      const match = pathname === it.href || (it.href !== "/painel" && it.href !== "/" && pathname.startsWith(it.href + "/"));
      if (match && (!best || it.href.length > best.length)) best = it.href;
    }
  }
  return best;
}

type Props = {
  groups: NavGroup[];
  pathname: string;
  /** Sidebar recolhida (só ícones) */
  collapsed?: boolean;
  /** Esconde busca e títulos de grupo (menu simples do vendedor) */
  flat?: boolean;
  mobile?: boolean;
};

export default function SidebarNav({ groups, pathname, collapsed = false, flat = false, mobile = false }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  const activeHref = useMemo(() => findActiveHref(pathname, groups), [pathname, groups]);
  const activeGroupId = useMemo(
    () => groups.find((g) => g.items.some((i) => i.href === activeHref))?.id,
    [groups, activeHref]
  );

  // Carrega preferência salva (grupo ativo + primeiro grupo abertos por padrão)
  useEffect(() => {
    let saved: Record<string, boolean> = {};
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { /* ignora */ }
    const initial: Record<string, boolean> = Object.keys(saved).length ? saved : { [groups[0]?.id]: true };
    setOpen(initial);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ao navegar, abre automaticamente o grupo da página atual
  useEffect(() => {
    if (!loaded || !activeGroupId) return;
    setOpen((prev) => (prev[activeGroupId] ? prev : { ...prev, [activeGroupId]: true }));
  }, [activeGroupId, loaded]);

  const toggle = (id: string) => {
    setOpen((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignora */ }
      return next;
    });
  };

  const q = norm(query.trim());
  const searching = q.length > 0;
  const visibleGroups = groups
    .map((g) => ({ ...g, items: searching ? g.items.filter((i) => norm(i.label).includes(q) || norm(g.label).includes(q)) : g.items }))
    .filter((g) => g.items.length > 0);

  const linkCls = (active: boolean) =>
    `flex items-center gap-3 px-3 ${mobile ? "py-2.5 rounded-xl" : "py-2 rounded-lg"} text-sm font-medium transition-all ${
      active ? "bg-green-600/15 text-green-400 border border-green-600/30" : "text-gray-400 hover:text-white hover:bg-gray-800/80 border border-transparent"
    }`;

  // Sidebar recolhida: lista só os ícones, com separador entre grupos
  if (collapsed) {
    return (
      <div className="space-y-1">
        {groups.map((g, gi) => (
          <div key={g.id} className={gi > 0 ? "pt-2 mt-2 border-t border-gray-800" : ""}>
            {g.items.map((it) => (
              <Link key={it.href} href={it.href} title={it.label} className={`${linkCls(it.href === activeHref)} justify-center`}>
                <span className="text-lg shrink-0">{it.icon}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (flat) {
    return (
      <div className="space-y-1">
        {groups.flatMap((g) => g.items).map((it) => (
          <Link key={it.href} href={it.href} className={linkCls(it.href === activeHref)}>
            <span className="text-lg shrink-0">{it.icon}</span>
            <span>{it.label}</span>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">🔍</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar no menu..."
          className="w-full bg-gray-800/70 border border-gray-700 rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-600"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs px-1" aria-label="Limpar busca">✕</button>
        )}
      </div>

      {searching && visibleGroups.length === 0 && (
        <p className="text-xs text-gray-500 px-3 py-4 text-center">Nenhum item encontrado para “{query}”.</p>
      )}

      {visibleGroups.map((g) => {
        const isOpen = searching || !!open[g.id];
        const hasActive = g.id === activeGroupId;
        return (
          <div key={g.id}>
            <button
              onClick={() => !searching && toggle(g.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${
                hasActive ? "text-green-400" : "text-gray-500 hover:text-gray-300"
              }`}
              aria-expanded={isOpen}
            >
              <span className="text-sm">{g.icon}</span>
              <span className="flex-1 text-left">{g.label}</span>
              {!searching && <span className={`text-[10px] transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>}
            </button>
            {isOpen && (
              <div className="mt-0.5 ml-2 pl-2 border-l border-gray-800 space-y-0.5">
                {g.items.map((it) => (
                  <Link key={it.href} href={it.href} className={linkCls(it.href === activeHref)}>
                    <span className="text-base shrink-0">{it.icon}</span>
                    <span className="truncate">{it.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
