"use client";

import { useState, useEffect } from "react";
import { PROTECTION_CATALOG, EXTRA_CATALOG } from "@/lib/extrasSearchCatalog";

type SearchCfg = { protections: boolean; extras: boolean; disabledProtections: string[]; disabledExtras: string[] };

export default function PainelExtras() {
  const [extras, setExtras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerDay, setPricePerDay] = useState("");
  const [type, setType] = useState("ADDON");
  const [active, setActive] = useState(true);
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, t: "success" | "error" = "success") => { setToast({ message: msg, type: t }); setTimeout(() => setToast(null), 3000); };

  // Chave global: quando desativada, a seção some de TODAS as buscas do site
  const [searchCfg, setSearchCfg] = useState<SearchCfg | null>(null);
  const [savingCfg, setSavingCfg] = useState<string | null>(null);

  const normalizeCfg = (d: any): SearchCfg => ({
    protections: d?.protections !== false,
    extras: d?.extras !== false,
    disabledProtections: Array.isArray(d?.disabledProtections) ? d.disabledProtections : [],
    disabledExtras: Array.isArray(d?.disabledExtras) ? d.disabledExtras : [],
  });

  const fetchSearchCfg = async () => {
    try { const r = await fetch("/api/admin/extras-search", { cache: "no-store" }); if (r.ok) setSearchCfg(normalizeCfg(await r.json())); }
    catch (e) { console.error(e); }
  };

  const saveCfg = async (next: SearchCfg, payload: Record<string, unknown>, savingKey: string, okMessage: string) => {
    if (!searchCfg || savingCfg) return;
    const previous = searchCfg;
    setSearchCfg(next);
    setSavingCfg(savingKey);
    try {
      const r = await fetch("/api/admin/extras-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error("save failed");
      setSearchCfg(normalizeCfg(await r.json()));
      showToast(okMessage);
    } catch (e) {
      setSearchCfg(previous);
      showToast("Erro ao salvar. Tente novamente.", "error");
    } finally { setSavingCfg(null); }
  };

  const handleToggleSearch = (field: "protections" | "extras") => {
    if (!searchCfg) return;
    const nextValue = !searchCfg[field];
    saveCfg({ ...searchCfg, [field]: nextValue }, { [field]: nextValue }, field, `${field === "protections" ? "Proteções" : "Extras"} ${nextValue ? "ativados" : "desativados"} nas buscas do site`);
  };

  // Liga/desliga um item individual (um item pode agrupar vários códigos XRS equivalentes)
  const handleToggleItem = (kind: "protections" | "extras", codes: string[], name: string) => {
    if (!searchCfg) return;
    const listKey = kind === "protections" ? "disabledProtections" : "disabledExtras";
    const current = searchCfg[listKey];
    const isOff = codes.every((c) => current.includes(c));
    const nextList = isOff ? current.filter((c) => !codes.includes(c)) : Array.from(new Set([...current, ...codes]));
    saveCfg({ ...searchCfg, [listKey]: nextList }, { [listKey]: nextList }, `${kind}:${codes[0]}`, `${name} ${isOff ? "ativado" : "desativado"} nas buscas do site`);
  };

  const fetchExtras = async () => {
    try { const res = await fetch("/api/admin/extras"); if (res.ok) setExtras(await res.json()); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchExtras(); fetchSearchCfg(); }, []);

  const handleOpenNew = () => { setEditingId(null); setName(""); setDescription(""); setPricePerDay(""); setType("ADDON"); setActive(true); setImageUrl(""); setShowModal(true); };

  const handleOpenEdit = (e: any) => { setEditingId(e.id); setName(e.name); setDescription(e.description || ""); setPricePerDay(e.pricePerDay.toString()); setType(e.type); setActive(e.active); setImageUrl(e.imageUrl || ""); setShowModal(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const payload = { name, description, pricePerDay: parseFloat(pricePerDay), type, active, imageUrl };
    try {
      const url = editingId ? `/api/admin/extras/${editingId}` : "/api/admin/extras";
      const res = await fetch(url, { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) { setShowModal(false); fetchExtras(); showToast("Salvo!"); } else showToast("Erro ao salvar", "error");
    } catch (e) { showToast("Erro de conexão", "error"); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir permanentemente?")) return;
    try { const res = await fetch(`/api/admin/extras/${id}`, { method: "DELETE" }); if (res.ok) { fetchExtras(); showToast("Excluído!"); } } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6">
      {toast && <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-2xl font-bold text-sm ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>{toast.message}</div>}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Extras & Proteções</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie acessórios e proteções disponíveis para reservas</p>
        </div>
        <button onClick={handleOpenNew} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg font-bold text-sm transition-colors">+ Novo Item</button>
      </div>

      {/* ═══ CHAVE GLOBAL: PROTEÇÕES E EXTRAS NAS BUSCAS ═══ */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-sm font-black text-white uppercase tracking-wider">Exibição nas buscas do site</h2>
        <p className="text-xs text-gray-400 mt-1 mb-4">
          Quando <strong className="text-green-400">ativo</strong>, aparece em qualquer busca do site. Quando <strong className="text-red-400">inativo</strong>, não aparece em nenhuma busca. A mudança vale imediatamente para novos clientes.
        </p>
        {!searchCfg ? (
          <div className="text-xs text-gray-500">Carregando configuração...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {([
              { field: "protections" as const, title: "Proteções", desc: "Seguros da Europcar e proteção Franquia Zero na etapa de extras." },
              { field: "extras" as const, title: "Extras", desc: "Acessórios e equipamentos (cadeirinha, GPS, pedágio etc.)." },
            ]).map(({ field, title, desc }) => {
              const on = searchCfg[field];
              return (
                <div key={field} className="flex items-center justify-between gap-4 bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${on ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{on ? "Ativo" : "Inativo"}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{desc}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={`${on ? "Desativar" : "Ativar"} ${title} nas buscas`}
                    id={`toggle-search-${field}`}
                    disabled={savingCfg !== null}
                    onClick={() => handleToggleSearch(field)}
                    className={`relative shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-60 ${on ? "bg-green-600" : "bg-gray-600"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Itens individuais */}
        {searchCfg && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
            {([
              { kind: "protections" as const, title: "Proteções (item a item)", globalOn: searchCfg.protections, items: PROTECTION_CATALOG.map((p) => ({ key: p.code, name: p.name, description: p.description, codes: [p.code] })) },
              { kind: "extras" as const, title: "Extras (item a item)", globalOn: searchCfg.extras, items: EXTRA_CATALOG.map((x) => ({ key: x.codes[0], name: x.name, description: x.description, codes: x.codes })) },
            ]).map(({ kind, title, globalOn, items }) => {
              const disabledList = kind === "protections" ? searchCfg.disabledProtections : searchCfg.disabledExtras;
              const offCount = items.filter((i) => i.codes.every((c) => disabledList.includes(c))).length;
              return (
                <div key={kind} className="bg-gray-800/30 border border-gray-700 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-white uppercase tracking-wider">{title}</span>
                    <span className="text-[10px] text-gray-400">{items.length - offCount} ativos · {offCount} inativos</span>
                  </div>
                  {!globalOn && <div className="px-4 py-2 text-[11px] text-red-400 bg-red-500/10 border-b border-gray-700">A chave geral está inativa: nada desta lista aparece nas buscas.</div>}
                  <ul className={`divide-y divide-gray-800 max-h-96 overflow-y-auto ${globalOn ? "" : "opacity-50"}`}>
                    {items.map((item) => {
                      const on = !item.codes.every((c) => disabledList.includes(c));
                      return (
                        <li key={item.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-bold ${on ? "text-white" : "text-gray-500 line-through"}`}>{item.name}</span>
                              <span className="text-[9px] font-black tracking-widest bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">{item.codes.join(" / ")}</span>
                            </div>
                            <p className="text-[11px] text-gray-500 truncate">{item.description}</p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={on}
                            aria-label={`${on ? "Desativar" : "Ativar"} ${item.name} nas buscas`}
                            id={`toggle-item-${kind}-${item.codes[0]}`}
                            disabled={savingCfg !== null}
                            onClick={() => handleToggleItem(kind, item.codes, item.name)}
                            className={`relative shrink-0 w-10 h-6 rounded-full transition-colors disabled:opacity-60 ${on ? "bg-green-600" : "bg-gray-600"}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : "translate-x-0"}`} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
        {searchCfg && <p className="text-[11px] text-gray-500 mt-3">Itens que a XRS devolver e que não estiverem nas listas acima continuam aparecendo normalmente.</p>}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : extras.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 p-10 rounded-xl text-center text-gray-500">Nenhum extra ou proteção cadastrado.</div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800/50 border-b border-gray-700">
              <tr>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Item</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tipo</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Valor/Dia</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {extras.map(ex => (
                <tr key={ex.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-bold text-white">{ex.name}</div>
                    <div className="text-xs text-gray-500 truncate max-w-[200px]">{ex.description}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${ex.type === "PROTECTION" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"}`}>
                      {ex.type === "PROTECTION" ? "Proteção" : "Acessório"}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-bold text-green-400">R$ {ex.pricePerDay.toFixed(2).replace(".", ",")}</td>
                  <td className="px-5 py-4">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 w-fit ${ex.active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${ex.active ? "bg-green-500" : "bg-red-500"}`}></span>
                      {ex.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right space-x-2">
                    <button onClick={() => handleOpenEdit(ex)} className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors inline-block" title="Editar">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                    <button onClick={() => handleDelete(ex.id)} className="p-1.5 rounded-lg bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 transition-colors inline-block" title="Excluir">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 w-full max-w-lg rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-lg font-black text-white">{editingId ? "Editar Item" : "Novo Item"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Nome do Item</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600" placeholder="Ex: Cadeira de Bebê" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Descrição</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600" rows={2} placeholder="Detalhes opcionais..."></textarea>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Valor/Dia (R$)</label>
                  <input type="number" step="0.01" required value={pricePerDay} onChange={e => setPricePerDay(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600" placeholder="15.50" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Tipo</label>
                  <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600">
                    <option value="PROTECTION">Proteção de Veículo</option>
                    <option value="ADDON">Acessório (Addon)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">URL da Imagem/Ícone</label>
                <input type="text" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600" placeholder="/images/item.png" />
              </div>
              <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg p-3">
                <input type="checkbox" id="activeCb" checked={active} onChange={e => setActive(e.target.checked)} className="w-5 h-5 accent-green-600 rounded" />
                <label htmlFor="activeCb" className="text-sm text-white font-bold cursor-pointer">Disponível para clientes (Ativo)</label>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 bg-gray-800 text-gray-300 font-bold text-sm rounded-lg hover:bg-gray-700">Cancelar</button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-lg disabled:opacity-50">{saving ? "Salvando..." : "Salvar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
