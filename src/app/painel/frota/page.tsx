"use client";
import { useEffect, useState, useRef } from "react";

interface CarImageOverride { carCode: string; imageUrl: string; }
interface CarCategoryOverride { carCode: string; friendlyName: string; onRequest: boolean; }

export default function PainelFrotaPage() {
  const [overrides, setOverrides] = useState<CarImageOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [carCode, setCarCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<CarCategoryOverride[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catCarCode, setCatCarCode] = useState("");
  const [catFriendlyName, setCatFriendlyName] = useState("");
  const [catOnRequest, setCatOnRequest] = useState(false);
  const [catSaving, setCatSaving] = useState(false);
  const [syncingCategories, setSyncingCategories] = useState(false);
  const [catMessage, setCatMessage] = useState<{ type: string; text: string } | null>(null);

  const handleSyncCategories = async () => {
    setSyncingCategories(true);
    setCatMessage(null);
    try {
      const r = await fetch("/api/cars/sync-categories", { method: "POST" });
      const d = await r.json();
      if (d.success) {
        setCatMessage({ type: "success", text: d.message || "Categorias sincronizadas da XRS!" });
        await fetchCategories();
      } else {
        setCatMessage({ type: "error", text: d.error || d.message || "Erro ao sincronizar categorias" });
      }
    } catch {
      setCatMessage({ type: "error", text: "Erro de conexão ao sincronizar categorias" });
    } finally {
      setSyncingCategories(false);
    }
  };

  const fetchCategories = async () => {
    setCatLoading(true);
    try { const r = await fetch("/api/cars/categories"); const d = await r.json(); setCategories(Array.isArray(d) ? d : []); }
    catch {} finally { setCatLoading(false); }
  };

  const fetchOverrides = async () => {
    setLoading(true);
    try { const r = await fetch("/api/cars/images"); const d = await r.json(); setOverrides(Array.isArray(d) ? d : []); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchOverrides(); fetchCategories(); }, []);

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catCarCode.trim()) return;
    setCatSaving(true); setCatMessage(null);
    try {
      const r = await fetch("/api/cars/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ carCode: catCarCode.trim().toUpperCase(), friendlyName: catFriendlyName.trim() || catCarCode.trim().toUpperCase(), onRequest: catOnRequest }) });
      if (r.ok) { setCatMessage({ type: "success", text: `Categoria ${catCarCode.toUpperCase()} salva!` }); setCatCarCode(""); setCatFriendlyName(""); setCatOnRequest(false); await fetchCategories(); }
      else { const err = await r.json(); setCatMessage({ type: "error", text: err.error || "Erro ao salvar" }); }
    } catch { setCatMessage({ type: "error", text: "Erro de conexão" }); }
    finally { setCatSaving(false); }
  };

  const handleDeleteCategory = async (code: string) => {
    if (!confirm(`Remover ${code}?`)) return;
    try { await fetch(`/api/cars/categories?carCode=${code}`, { method: "DELETE" }); await fetchCategories(); } catch {}
  };

  const handleToggleOnRequest = async (cat: CarCategoryOverride) => {
    try { await fetch("/api/cars/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ carCode: cat.carCode, friendlyName: cat.friendlyName, onRequest: !cat.onRequest }) }); await fetchCategories(); } catch {}
  };

  const handleSync = async () => {
    setSyncing(true); setMessage(null);
    try { const r = await fetch("/api/cars/sync-images", { method: "POST" }); const d = await r.json(); if (d.success) { setMessage({ type: "success", text: `${d.message} (${d.cars?.join(", ")})` }); await fetchOverrides(); } else { setMessage({ type: "error", text: d.message || d.error || "Erro" }); } }
    catch { setMessage({ type: "error", text: "Erro de conexão" }); } finally { setSyncing(false); }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault(); if (!carCode.trim() || !file) return;
    setUploading(true); setMessage(null);
    try {
      const fd = new FormData(); fd.append("carCode", carCode.trim().toUpperCase()); fd.append("file", file);
      const r = await fetch("/api/cars/images", { method: "POST", body: fd });
      if (r.ok) { setMessage({ type: "success", text: `Foto do ${carCode.toUpperCase()} salva!` }); setCarCode(""); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; await fetchOverrides(); }
      else { const err = await r.json(); setMessage({ type: "error", text: err.error || "Erro ao fazer upload" }); }
    } catch { setMessage({ type: "error", text: "Erro ao fazer upload" }); } finally { setUploading(false); }
  };

  const handleFetchFromAPI = async () => {
    if (!carCode.trim()) { setMessage({ type: "error", text: "Digite o código SIPP primeiro." }); return; }
    const code = carCode.trim().toUpperCase(); setFetching(true); setMessage(null);
    try {
      const urls = [`https://static.europcar.com/carvisuals/partners/835x557/${code}_IT.png`, `https://static.europcar.com/carvisuals/partners/835x557/${code}_DE.png`, `https://static.europcar.com/carvisuals/partners/835x557/${code}_FR.png`];
      const r = await fetch("/api/cars/fetch-from-cdn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ carCode: code, urls }) });
      if (r.ok) { setMessage({ type: "success", text: `Imagem do ${code} baixada e salva!` }); setCarCode(""); await fetchOverrides(); }
      else { const err = await r.json(); setMessage({ type: "error", text: err.error || "Imagem não encontrada" }); }
    } catch { setMessage({ type: "error", text: "Erro ao buscar imagem" }); } finally { setFetching(false); }
  };

  const handleDelete = async (code: string) => {
    if (!confirm(`Excluir foto de ${code}?`)) return;
    try { await fetch(`/api/cars/images?carCode=${code}`, { method: "DELETE" }); await fetchOverrides(); } catch (e) { console.error(e); }
  };

  return (
    <div className="max-w-4xl space-y-10">

      {/* ═══ ON-REQUEST ═══ */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-black text-white">Veículos Sob Consulta (LIMITED)</h1>
          <button
            onClick={handleSyncCategories}
            disabled={syncingCategories}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm"
            title="Consulta a API XRS Europcar para descobrir novos códigos ACRISS, nomes de modelos e marcar on-request"
          >
            {syncingCategories ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sincronizando da XRS...
              </>
            ) : (
              "🔄 Sincronizar da XRS"
            )}
          </button>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-gray-400 mb-4 gap-2">
          <p>
            Marque os códigos ACRISS que são <strong className="text-white">on-request</strong>. Eles mostrarão a badge <span className="bg-black text-white text-[9px] font-black px-2 py-0.5 rounded-full">LIMITED</span> e um popup de aviso ao cliente antes de reservar.
          </p>
          <span className="shrink-0 text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded inline-flex items-center gap-1.5" title="Rotina automática diária agendada via cron">
            <span>⏰</span> Auto: todos os dias às 00:00h
          </span>
        </div>

        {catMessage && <div className={`mb-4 p-3 rounded-lg border text-sm font-bold ${catMessage.type === "success" ? "bg-green-900/30 border-green-800 text-green-400" : "bg-red-900/30 border-red-800 text-red-400"}`}>{catMessage.text}</div>}

        <form onSubmit={handleSaveCategory} className="bg-gray-800/50 border border-gray-700 rounded-lg p-5 mb-4">
          <h2 className="text-sm font-bold text-white mb-3">Adicionar / Atualizar Código ACRISS</h2>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="w-32">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Código ACRISS</label>
              <input value={catCarCode} onChange={e => setCatCarCode(e.target.value.toUpperCase())} placeholder="PVAR" className="w-full bg-gray-900 border border-gray-600 text-white rounded px-3 py-2 text-sm outline-none focus:border-[#008d36] uppercase" />
            </div>
            <div className="flex-1 min-w-40">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Nome amigável</label>
              <input value={catFriendlyName} onChange={e => setCatFriendlyName(e.target.value)} placeholder="Ex: BMW X5 / Minivan Premium" className="w-full bg-gray-900 border border-gray-600 text-white rounded px-3 py-2 text-sm outline-none focus:border-[#008d36]" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer mb-0.5 whitespace-nowrap">
              <input type="checkbox" checked={catOnRequest} onChange={e => setCatOnRequest(e.target.checked)} className="w-4 h-4 accent-black" />
              <span className="text-sm font-bold text-white">On-Request (LIMITED)</span>
            </label>
            <button type="submit" disabled={catSaving || !catCarCode.trim()} className="bg-[#008d36] hover:bg-[#007a2d] disabled:opacity-50 text-white font-bold px-5 py-2 rounded text-sm transition-colors shrink-0">
              {catSaving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-700">
            <h2 className="text-sm font-bold text-white">Categorias Cadastradas ({categories.length})</h2>
          </div>
          {catLoading ? <div className="p-6 text-center text-gray-400">Carregando...</div>
          : categories.length === 0 ? <div className="p-6 text-center text-gray-500">Nenhuma categoria cadastrada ainda.</div>
          : (
            <div className="divide-y divide-gray-700">
              {categories.map(cat => (
                <div key={cat.carCode} className="flex items-center justify-between px-5 py-3 hover:bg-gray-800/30">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-white text-sm bg-gray-900 px-2 py-0.5 rounded border border-gray-600">{cat.carCode}</span>
                    <span className="text-gray-300 text-sm">{cat.friendlyName}</span>
                    {cat.onRequest && <span className="bg-black text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">LIMITED</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleToggleOnRequest(cat)} className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${cat.onRequest ? 'bg-black text-white hover:bg-gray-800' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                      {cat.onRequest ? '✓ On-Request' : 'Marcar On-Request'}
                    </button>
                    <button onClick={() => handleDeleteCategory(cat.carCode)} className="text-red-500 hover:text-red-400 text-xs px-2">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ═══ FOTOS ═══ */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-black text-white">Fotos da Frota</h1>
          <button onClick={handleSync} disabled={syncing} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2">
            {syncing ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sincronizando...</> : "🔄 Sincronizar da Europcar"}
          </button>
        </div>
        <p className="text-gray-400 text-sm mb-4">Cadastre fotos customizadas por código SIPP (ex: EDMR, CDAR).</p>

        {message && <div className={`mb-4 p-4 rounded-lg border text-sm font-bold ${message.type === "success" ? "bg-green-900/30 border-green-800 text-green-400" : "bg-red-900/30 border-red-800 text-red-400"}`}>{message.text}</div>}

        <form onSubmit={handleUpload} className="bg-gray-800/50 border border-gray-700 rounded-lg p-5 mb-4">
          <h2 className="text-sm font-bold text-white mb-3">Upload Manual</h2>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="w-48">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Código SIPP</label>
              <input value={carCode} onChange={e => setCarCode(e.target.value.toUpperCase())} placeholder="Ex: EDMR" className="w-full bg-gray-900 border border-gray-600 text-white rounded px-3 py-2 text-sm outline-none focus:border-[#008d36] uppercase" />
            </div>
            <div className="flex-1 min-w-48">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Arquivo (.jpg, .png)</label>
              <input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} ref={fileInputRef} className="w-full bg-gray-900 border border-gray-600 text-gray-300 rounded px-3 py-1.5 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-[#008d36] file:text-white" />
            </div>
            <button type="submit" disabled={uploading || !carCode.trim() || !file} className="bg-[#008d36] hover:bg-[#007a2d] disabled:opacity-50 text-white font-bold px-6 py-2 rounded text-sm transition-colors shrink-0">
              {uploading ? "Salvando..." : "📤 Enviar"}
            </button>
            <button type="button" onClick={handleFetchFromAPI} disabled={fetching || !carCode.trim()} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded text-sm transition-colors shrink-0">
              {fetching ? "Buscando..." : "🔗 Buscar CDN"}
            </button>
          </div>
        </form>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-700 flex justify-between items-center">
            <h2 className="text-sm font-bold text-white">Fotos Customizadas ({overrides.length})</h2>
            <span className="text-xs text-gray-500">Hover para excluir</span>
          </div>
          {loading ? <div className="p-8 text-center text-gray-400">Carregando...</div>
          : overrides.length === 0 ? <div className="p-8 text-center text-gray-500">Nenhuma foto customizada.</div>
          : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-5">
              {overrides.map(o => (
                <div key={o.carCode} className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden flex flex-col group relative">
                  <div className="h-32 bg-white flex items-center justify-center p-2 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={o.imageUrl} alt={o.carCode} className="max-w-full max-h-full object-contain" />
                    <button onClick={() => handleDelete(o.carCode)} className="absolute top-2 right-2 bg-red-600/90 hover:bg-red-500 text-white w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">🗑️</button>
                  </div>
                  <div className="px-3 py-2 border-t border-gray-700 text-center">
                    <span className="text-white font-bold text-sm bg-gray-800 px-2 py-0.5 rounded border border-gray-600">{o.carCode}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
