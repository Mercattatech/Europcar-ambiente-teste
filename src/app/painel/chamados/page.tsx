"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Priority = "URGENT" | "HIGH" | "NORMAL" | "LOW";
type Status = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; emoji: string }> = {
  URGENT: { label: "Urgente",  color: "text-red-400",    bg: "bg-red-500/20 border-red-500/40",    emoji: "🔴" },
  HIGH:   { label: "Alta",     color: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/40", emoji: "🟡" },
  NORMAL: { label: "Normal",   color: "text-green-400",  bg: "bg-green-500/20 border-green-500/40",  emoji: "🟢" },
  LOW:    { label: "Baixa",    color: "text-gray-400",   bg: "bg-gray-500/20 border-gray-500/40",    emoji: "⚪" },
};

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string }> = {
  OPEN:        { label: "Aberto",       color: "text-blue-400",   bg: "bg-blue-500/20 border-blue-500/40" },
  IN_PROGRESS: { label: "Em Andamento", color: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/40" },
  RESOLVED:    { label: "Resolvido",    color: "text-green-400",  bg: "bg-green-500/20 border-green-500/40" },
  CLOSED:      { label: "Fechado",      color: "text-gray-400",   bg: "bg-gray-500/20 border-gray-500/40" },
};

function PriorityBadge({ priority }: { priority: string }) {
  const c = PRIORITY_CONFIG[priority as Priority] || PRIORITY_CONFIG.NORMAL;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${c.bg} ${c.color}`}>
      {c.emoji} {c.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status as Status] || STATUS_CONFIG.OPEN;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${c.bg} ${c.color}`}>
      {c.label}
    </span>
  );
}

const TAG_PRESETS = ["Bug", "Melhoria", "Novo recurso", "Design", "Performance", "E-mail", "Pagamento", "API", "Dashboard", "Relatório"];

export default function ChamadosPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [tickets, setTickets]             = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [filterStatus, setFilterStatus]   = useState<string>("ALL");
  const [filterPriority, setFilterPriority] = useState<string>("ALL");
  const [showCreate, setShowCreate]       = useState(false);
  const [selected, setSelected]           = useState<any | null>(null);

  // Form state
  const [title, setTitle]           = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority]     = useState<Priority>("NORMAL");
  const [tags, setTags]             = useState<string[]>([]);
  const [tagInput, setTagInput]     = useState("");
  const [imageUrls, setImageUrls]   = useState<string[]>([]);
  const [videoUrl, setVideoUrl]     = useState("");
  const [uploading, setUploading]   = useState(false);
  const [saving, setSaving]         = useState(false);

  // Status change
  const [changingStatus, setChangingStatus] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus   !== "ALL") params.set("status",   filterStatus);
      if (filterPriority !== "ALL") params.set("priority", filterPriority);
      const res = await fetch(`/api/admin/chamados?${params}`);
      const d = await res.json();
      setTickets(d.tickets || []);
    } catch { setTickets([]); }
    setLoading(false);
  }, [filterStatus, filterPriority]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/chamados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, priority, tags, imageUrls, videoUrl: videoUrl || undefined }),
      });
      if (res.ok) {
        setShowCreate(false);
        resetForm();
        fetchTickets();
      }
    } finally { setSaving(false); }
  };

  const resetForm = () => {
    setTitle(""); setDescription(""); setPriority("NORMAL");
    setTags([]); setTagInput(""); setImageUrls([]); setVideoUrl("");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/upload-image", { method: "POST", body: form });
      const d = await res.json();
      if (d.url) setImageUrls(prev => [...prev, d.url]);
    } finally { setUploading(false); }
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    setChangingStatus(ticketId);
    try {
      await fetch(`/api/admin/chamados/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchTickets();
      if (selected?.id === ticketId) setSelected((prev: any) => ({ ...prev, status: newStatus }));
    } finally { setChangingStatus(null); }
  };

  const handleDelete = async (ticketId: string) => {
    if (!confirm("Tem certeza que deseja excluir este chamado?")) return;
    await fetch(`/api/admin/chamados/${ticketId}`, { method: "DELETE" });
    fetchTickets();
    if (selected?.id === ticketId) setSelected(null);
  };

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput("");
  };

  if (sessionStatus === "loading") return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">🎫 Chamados de Desenvolvimento</h1>
          <p className="text-gray-400 text-sm mt-1">Crie e acompanhe chamados internos para o time de dev</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-indigo-700 hover:bg-indigo-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
          Novo Chamado
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2">
          <span className="text-[10px] text-gray-500 uppercase font-bold">Status:</span>
          {(["ALL","OPEN","IN_PROGRESS","RESOLVED","CLOSED"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${filterStatus === s ? "bg-indigo-700 text-white" : "text-gray-400 hover:text-white"}`}
            >
              {s === "ALL" ? "Todos" : STATUS_CONFIG[s as Status]?.label || s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2">
          <span className="text-[10px] text-gray-500 uppercase font-bold">Prioridade:</span>
          {(["ALL","URGENT","HIGH","NORMAL","LOW"] as const).map(p => (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${filterPriority === p ? "bg-indigo-700 text-white" : "text-gray-400 hover:text-white"}`}
            >
              {p === "ALL" ? "Todas" : PRIORITY_CONFIG[p as Priority]?.emoji + " " + PRIORITY_CONFIG[p as Priority]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de chamados */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"/></div>
      ) : tickets.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
          <div className="text-5xl mb-4">🎫</div>
          <p className="text-gray-400 font-bold">Nenhum chamado encontrado</p>
          <p className="text-gray-600 text-sm mt-1">Crie um novo chamado usando o botão acima</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {tickets.map((ticket: any) => {
            const parsedTags: string[] = (() => { try { return JSON.parse(ticket.tags || "[]"); } catch { return []; } })();
            const parsedImgs: string[] = (() => { try { return JSON.parse(ticket.imageUrls || "[]"); } catch { return []; } })();
            return (
              <div
                key={ticket.id}
                className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-5 transition-all cursor-pointer group"
                onClick={() => setSelected(ticket)}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <PriorityBadge priority={ticket.priority} />
                      <StatusBadge status={ticket.status} />
                      {parsedTags.map((tag: string) => (
                        <span key={tag} className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full font-mono">{tag}</span>
                      ))}
                    </div>
                    <h3 className="text-white font-bold text-base group-hover:text-indigo-300 transition-colors truncate">{ticket.title}</h3>
                    <p className="text-gray-500 text-sm mt-1 line-clamp-2">{ticket.description}</p>
                    <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-600">
                      <span>👤 {ticket.createdBy?.name || ticket.createdBy?.email || "—"}</span>
                      <span>📅 {new Date(ticket.createdAt).toLocaleDateString("pt-BR")}</span>
                      {parsedImgs.length > 0 && <span>🖼️ {parsedImgs.length} imagem(ns)</span>}
                      {ticket.videoUrl && <span>🎬 vídeo</span>}
                    </div>
                  </div>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <select
                      value={ticket.status}
                      onChange={e => handleStatusChange(ticket.id, e.target.value)}
                      disabled={changingStatus === ticket.id}
                      className="bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="OPEN">Aberto</option>
                      <option value="IN_PROGRESS">Em Andamento</option>
                      <option value="RESOLVED">Resolvido</option>
                      <option value="CLOSED">Fechado</option>
                    </select>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(ticket.id); }}
                      className="text-gray-600 hover:text-red-400 transition-colors p-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal Detalhe ───────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setSelected(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-gray-800 px-6 py-4 flex items-center justify-between border-b border-gray-700 rounded-t-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <PriorityBadge priority={selected.priority} />
                <StatusBadge status={selected.status} />
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <h2 className="text-white font-black text-xl">{selected.title}</h2>
                <p className="text-[10px] text-gray-500 mt-1">
                  Por {selected.createdBy?.name || selected.createdBy?.email} · {new Date(selected.createdAt).toLocaleString("pt-BR")}
                </p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-300 text-sm whitespace-pre-wrap">{selected.description}</p>
              </div>
              {/* Tags */}
              {(() => { try { const t = JSON.parse(selected.tags || "[]"); return t.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {t.map((tag: string) => (
                    <span key={tag} className="text-xs bg-gray-800 text-gray-300 px-2.5 py-1 rounded-full border border-gray-700">{tag}</span>
                  ))}
                </div>
              ) : null; } catch { return null; } })()}
              {/* Imagens */}
              {(() => { try { const imgs = JSON.parse(selected.imageUrls || "[]"); return imgs.length > 0 ? (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">Imagens</p>
                  <div className="grid grid-cols-2 gap-2">
                    {imgs.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Imagem ${i+1}`} className="w-full rounded-lg border border-gray-700 hover:border-indigo-500 transition-colors object-cover max-h-40"/>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null; } catch { return null; } })()}
              {/* Vídeo */}
              {selected.videoUrl && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-2">Vídeo</p>
                  <a href={selected.videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm underline">
                    🎬 {selected.videoUrl}
                  </a>
                </div>
              )}
              {/* Alterar status */}
              <div className="border-t border-gray-700 pt-4 flex gap-2 flex-wrap">
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider w-full mb-1">Alterar Status</p>
                {(["OPEN","IN_PROGRESS","RESOLVED","CLOSED"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(selected.id, s)}
                    disabled={selected.status === s || changingStatus === selected.id}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
                      selected.status === s
                        ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].color} cursor-default`
                        : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
                    }`}
                  >
                    {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Criar Chamado ──────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-gray-900 border border-indigo-800/40 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-indigo-950 px-6 py-4 flex items-center justify-between border-b border-indigo-800/40 rounded-t-2xl">
              <div>
                <h2 className="text-white font-bold text-base">🎫 Novo Chamado</h2>
                <p className="text-indigo-300 text-xs mt-0.5">Descreva o problema ou melhoria em detalhes</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5">
              {/* Título */}
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block mb-1.5">Título *</label>
                <input
                  value={title} onChange={e => setTitle(e.target.value)} required
                  placeholder="Ex: Botão de cancelamento não funciona no mobile"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Prioridade */}
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block mb-1.5">Prioridade</label>
                <div className="flex gap-2 flex-wrap">
                  {(["URGENT","HIGH","NORMAL","LOW"] as Priority[]).map(p => {
                    const c = PRIORITY_CONFIG[p];
                    return (
                      <button type="button" key={p} onClick={() => setPriority(p)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-bold transition-all ${
                          priority === p ? `${c.bg} ${c.color}` : "border-gray-700 text-gray-500 hover:border-gray-600"
                        }`}
                      >
                        {c.emoji} {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block mb-1.5">Descrição detalhada *</label>
                <textarea
                  value={description} onChange={e => setDescription(e.target.value)} required rows={6}
                  placeholder="Descreva o problema ou a melhoria com o máximo de detalhes possível. Inclua passos para reproduzir, comportamento esperado e comportamento atual."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block mb-1.5">Tags</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {TAG_PRESETS.map(t => (
                    <button type="button" key={t} onClick={() => addTag(t)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        tags.includes(t) ? "bg-indigo-700 border-indigo-600 text-white" : "border-gray-700 text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={tagInput} onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
                    placeholder="Tag personalizada + Enter"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <button type="button" onClick={() => addTag(tagInput)} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-xl text-sm">
                    Adicionar
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tags.map(t => (
                      <span key={t} className="flex items-center gap-1 bg-indigo-900/40 border border-indigo-700/40 text-indigo-300 text-xs px-2 py-0.5 rounded-full">
                        {t}
                        <button type="button" onClick={() => setTags(prev => prev.filter(x => x !== t))} className="hover:text-red-400">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Upload de imagens */}
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block mb-1.5">Imagens (screenshots / evidências)</label>
                <label className="flex items-center gap-3 cursor-pointer bg-gray-800 border border-dashed border-gray-700 hover:border-indigo-500 rounded-xl p-4 transition-colors">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  <span className="text-sm text-gray-400">{uploading ? "Enviando..." : "Clique para adicionar imagem"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading}/>
                </label>
                {imageUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {imageUrls.map((url, i) => (
                      <div key={i} className="relative">
                        <img src={url} alt={`img ${i}`} className="w-full h-20 object-cover rounded-lg border border-gray-700"/>
                        <button type="button" onClick={() => setImageUrls(prev => prev.filter((_, j) => j !== i))}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white rounded-full text-[10px] flex items-center justify-center hover:bg-red-500"
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Link de vídeo */}
              <div>
                <label className="text-[10px] text-gray-500 uppercase font-bold tracking-wider block mb-1.5">Link de Vídeo (YouTube, Loom, etc.)</label>
                <input
                  value={videoUrl} onChange={e => setVideoUrl(e.target.value)} type="url"
                  placeholder="https://youtu.be/..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Ações */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl text-sm">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
                  {saving ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>Criando...</>
                  ) : "🎫 Criar Chamado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
