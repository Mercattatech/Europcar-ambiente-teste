"use client";

import { useState, useEffect } from "react";

export default function PainelPromocoes() {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form fields
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [discountValue, setDiscountValue] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [contractID, setContractID] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [promoStatus, setPromoStatus] = useState("ACTIVE");
  
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Popup Promo Balcão Config
  const [popupActive, setPopupActive] = useState(true);
  const [popupTitle, setPopupTitle] = useState("Aproveite a Promoção!");
  const [popupMessage, setPopupMessage] = useState("Aproveite a promoção, pagamento no cartão de crédito ou pix com até 6% de desconto e cancelamento grátis.");
  const [popupPrimaryBtnText, setPopupPrimaryBtnText] = useState("Garantir Desconto (Pagar Online)");
  const [popupSecondaryBtnText, setPopupSecondaryBtnText] = useState("Continuar sem Desconto (Pagar no Balcão)");
  const [popupBadgeText, setPopupBadgeText] = useState("PROMOÇÃO EXCLUSIVA");
  const [popupImageUrl, setPopupImageUrl] = useState("");
  const [savingPopup, setSavingPopup] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPromotions = async () => {
    try {
      const res = await fetch("/api/admin/promotions");
      if (res.ok) setPromotions(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchPopupConfig = async () => {
    try {
      const res = await fetch("/api/admin/config/promo-popup");
      if (res.ok) {
        const data = await res.json();
        setPopupActive(data.active !== undefined ? data.active : true);
        setPopupTitle(data.title || "Aproveite a Promoção!");
        setPopupMessage(data.message || "");
        setPopupPrimaryBtnText(data.primaryBtnText || "Garantir Desconto (Pagar Online)");
        setPopupSecondaryBtnText(data.secondaryBtnText || "Continuar sem Desconto (Pagar no Balcão)");
        setPopupBadgeText(data.badgeText || "PROMOÇÃO EXCLUSIVA");
        setPopupImageUrl(data.imageUrl || "");
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchPromotions();
    fetchPopupConfig();
  }, []);

  const handleSavePopupConfig = async () => {
    setSavingPopup(true);
    try {
      const payload = {
        active: popupActive,
        title: popupTitle,
        message: popupMessage,
        primaryBtnText: popupPrimaryBtnText,
        secondaryBtnText: popupSecondaryBtnText,
        badgeText: popupBadgeText,
        imageUrl: popupImageUrl
      };
      const res = await fetch("/api/admin/config/promo-popup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast("Configuração do Popup salva com sucesso!");
      } else {
        showToast("Erro ao salvar popup", "error");
      }
    } catch (e) {
      showToast("Erro de conexão", "error");
    } finally {
      setSavingPopup(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload-image", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.url) {
        setPopupImageUrl(data.url);
        showToast("Imagem enviada!");
      } else {
        showToast("Erro ao enviar imagem", "error");
      }
    } catch (e) {
      showToast("Erro no envio da imagem", "error");
    } finally {
      setUploadingImage(false);
    }
  };

  const resetForm = () => {
    setEditingId(null); setTitle(""); setSubtitle(""); setDescription(""); setDiscountValue("");
    setImageUrl(""); setContractID(""); setStartDate(""); setEndDate(""); setIsActive(true); setPromoStatus("ACTIVE");
  };

  const handleOpenNew = () => { resetForm(); setShowModal(true); };

  const handleOpenEdit = (p: any) => {
    setEditingId(p.id);
    setTitle(p.title || "");
    setSubtitle(p.subtitle || "");
    setDescription(p.description || "");
    setDiscountValue(p.discountValue?.toString() || "");
    setImageUrl(p.imageUrl || "");
    setContractID(p.contractID || "");
    setStartDate(p.startDate ? new Date(p.startDate).toISOString().split("T")[0] : "");
    setEndDate(p.endDate ? new Date(p.endDate).toISOString().split("T")[0] : "");
    setIsActive(p.isActive !== undefined ? p.isActive : true);
    setPromoStatus(p.status || "ACTIVE");
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const payload = {
      title, subtitle, description,
      discountValue: discountValue ? parseFloat(discountValue) : null,
      imageUrl, contractID: contractID || null,
      startDate: startDate || null, endDate: endDate || null,
      isActive, status: promoStatus
    };
    try {
      const url = editingId ? `/api/admin/promotions/${editingId}` : "/api/admin/promotions";
      const res = await fetch(url, { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) { setShowModal(false); fetchPromotions(); showToast("Promoção salva!"); }
      else showToast("Erro ao salvar", "error");
    } catch (e) { showToast("Erro de conexão", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta promoção permanentemente?")) return;
    try {
      const res = await fetch(`/api/admin/promotions/${id}`, { method: "DELETE" });
      if (res.ok) { fetchPromotions(); showToast("Promoção excluída!"); }
    } catch (e) { console.error(e); }
  };

  const isPromoValid = (p: any) => {
    const now = new Date();
    if (p.startDate && new Date(p.startDate) > now) return false;
    if (p.endDate && new Date(p.endDate) < now) return false;
    return true;
  };

  return (
    <div className="space-y-6">
      {toast && <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-2xl font-bold text-sm ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>{toast.message}</div>}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Promoções & Ofertas</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie promoções com integração ao contractID da Europcar XRS</p>
        </div>
        <button onClick={handleOpenNew} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm transition-colors">+ Nova Promoção</button>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <span className="text-lg">💡</span>
        <p className="text-sm text-blue-300">O <strong>Contract ID</strong> é o código do contrato Europcar (ex: <code className="bg-blue-900/50 px-1.5 py-0.5 rounded text-xs">45944876</code>). Quando preenchido, será injetado automaticamente nas requisições XRS para aplicar o desconto negociado.</p>
      </div>

      {/* --- Popup Balcão Internacional Editor Section --- */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <h2 className="text-xl font-black text-white">Popup Promocional Balcão (Reservas Internacionais)</h2>
            </div>
            <p className="text-xs text-gray-400 mt-1">Configure o texto, imagens e botões do modal exibido ao escolher "Pagar no Balcão"</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer bg-gray-800 px-4 py-2 rounded-xl border border-gray-700">
              <input
                type="checkbox"
                checked={popupActive}
                onChange={e => setPopupActive(e.target.checked)}
                className="w-4 h-4 accent-green-500"
              />
              <span className={`text-xs font-bold ${popupActive ? "text-green-400" : "text-gray-400"}`}>
                {popupActive ? "Popup Ativo" : "Popup Inativo"}
              </span>
            </label>
            <button
              onClick={handleSavePopupConfig}
              disabled={savingPopup}
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl font-bold text-xs transition-colors shadow-lg disabled:opacity-50 flex items-center gap-2"
            >
              {savingPopup ? "Salvando..." : "💾 Salvar Configurações"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form Controls */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">Badge / Tag Superior</label>
              <input
                type="text"
                value={popupBadgeText}
                onChange={e => setPopupBadgeText(e.target.value)}
                placeholder="Ex: PROMOÇÃO EXCLUSIVA"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs text-white outline-none focus:border-green-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">Título Principal do Popup</label>
              <input
                type="text"
                value={popupTitle}
                onChange={e => setPopupTitle(e.target.value)}
                placeholder="Ex: Aproveite a Promoção!"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs text-white outline-none focus:border-green-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">Mensagem / Texto do Popup</label>
              <textarea
                rows={3}
                value={popupMessage}
                onChange={e => setPopupMessage(e.target.value)}
                placeholder="Ex: Aproveite a promoção, pagamento no cartão de crédito ou pix com até 6% de desconto e cancelamento grátis."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs text-white outline-none focus:border-green-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Texto Botão Verde (Com Desconto)</label>
                <input
                  type="text"
                  value={popupPrimaryBtnText}
                  onChange={e => setPopupPrimaryBtnText(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs text-white outline-none focus:border-green-500 font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Texto Botão Secundário (Balcão)</label>
                <input
                  type="text"
                  value={popupSecondaryBtnText}
                  onChange={e => setPopupSecondaryBtnText(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs text-white outline-none focus:border-green-500"
                />
              </div>
            </div>

            {/* Imagem do Popup */}
            <div className="border-t border-gray-800 pt-4 space-y-3">
              <label className="block text-xs font-bold text-gray-300">
                🖼️ Imagem do Banner do Popup <span className="text-gray-500 font-normal">(Opcional)</span>
              </label>

              <div className="flex items-center gap-3">
                <label className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 px-4 py-2.5 rounded-lg text-xs font-bold cursor-pointer transition-colors shrink-0">
                  {uploadingImage ? "Enviando imagem..." : "📁 Subir Imagem do Computador"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                </label>
                {popupImageUrl && (
                  <button
                    onClick={() => setPopupImageUrl("")}
                    className="text-xs text-red-400 hover:text-red-300 font-bold"
                  >
                    🗑️ Remover Imagem
                  </button>
                )}
              </div>

              <div>
                <input
                  type="text"
                  value={popupImageUrl}
                  onChange={e => setPopupImageUrl(e.target.value)}
                  placeholder="Ou cole a URL direta da imagem aqui (https://...)"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs text-white outline-none focus:border-green-500"
                />
              </div>
            </div>
          </div>

          {/* Live Preview Panel */}
          <div className="bg-gray-950 border border-gray-800 rounded-xl p-6 flex flex-col items-center justify-center relative">
            <span className="absolute top-3 left-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-gray-900 px-2 py-1 rounded">
              Pré-visualização em Tempo Real
            </span>

            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center border border-gray-100 relative overflow-hidden mt-6">
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500" />
              
              {/* Image preview if exists */}
              {popupImageUrl ? (
                <div className="mb-4 rounded-xl overflow-hidden max-h-40 border border-gray-100 shadow-sm">
                  <img src={popupImageUrl} alt="Banner" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <span className="text-2xl">🏷️</span>
                </div>
              )}

              {popupBadgeText && (
                <span className="inline-block bg-emerald-100 text-emerald-700 text-[10px] font-black px-2.5 py-0.5 rounded-full mb-2 uppercase tracking-wide">
                  {popupBadgeText}
                </span>
              )}

              <h4 className="text-lg font-black text-gray-900 mb-2">
                {popupTitle || "Aproveite a Promoção!"}
              </h4>

              <p className="text-gray-600 text-xs leading-relaxed mb-5 font-medium">
                {popupMessage || "Mensagem..."}
              </p>

              <div className="space-y-2">
                <div className="w-full bg-[#008d36] text-white font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md">
                  <span>💳</span> {popupPrimaryBtnText || "Garantir Desconto"}
                </div>
                <div className="w-full bg-gray-100 text-gray-700 font-bold py-2.5 px-4 rounded-xl text-[11px]">
                  {popupSecondaryBtnText || "Continuar sem Desconto"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : promotions.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 p-10 rounded-xl text-center text-gray-500">Nenhuma promoção cadastrada.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {promotions.map(p => {
            const valid = isPromoValid(p);
            return (
              <div key={p.id} className={`bg-gray-900 border rounded-xl overflow-hidden transition-colors ${p.isActive && valid ? "border-gray-800 hover:border-gray-700" : "border-gray-800/50 opacity-60"}`}>
                <div className="h-40 bg-gray-800 relative">
                  {p.imageUrl ? <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-600 text-4xl">🏷️</div>}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {p.isActive && valid && <span className="bg-green-500/90 text-white px-2 py-0.5 text-[10px] font-bold rounded">ATIVA</span>}
                    {!p.isActive && <span className="bg-red-500/90 text-white px-2 py-0.5 text-[10px] font-bold rounded">INATIVA</span>}
                    {p.isActive && !valid && <span className="bg-yellow-500/90 text-black px-2 py-0.5 text-[10px] font-bold rounded">EXPIRADA</span>}
                  </div>
                  {p.discountValue && (
                    <div className="absolute bottom-2 left-2 bg-red-600 text-white px-3 py-1 rounded-lg font-black text-lg shadow-lg">
                      {p.discountValue}% OFF
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="font-black text-white text-lg">{p.title}</h3>
                  {p.subtitle && <p className="text-sm text-green-400 font-medium">{p.subtitle}</p>}
                  <p className="text-xs text-gray-500 line-clamp-2">{p.description}</p>
                  
                  <div className="flex flex-wrap gap-2 pt-2">
                    {p.contractID && (
                      <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 text-[10px] font-bold rounded font-mono">ID: {p.contractID}</span>
                    )}
                    {p.startDate && (
                      <span className="bg-gray-800 text-gray-400 px-2 py-0.5 text-[10px] font-bold rounded">
                        {new Date(p.startDate).toLocaleDateString("pt-BR")} → {p.endDate ? new Date(p.endDate).toLocaleDateString("pt-BR") : "∞"}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 border-t border-gray-800 pt-3 mt-3">
                    <button onClick={() => handleOpenEdit(p)} className="text-xs font-bold text-blue-400 hover:text-blue-300 px-3 py-1.5 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">Editar</button>
                    <button onClick={() => handleDelete(p.id)} className="text-xs font-bold text-red-400 hover:text-red-300 px-3 py-1.5 bg-gray-800 rounded-lg hover:bg-red-900/50 transition-colors">Excluir</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 w-full max-w-2xl rounded-2xl shadow-2xl my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-lg font-black text-white">{editingId ? "Editar Promoção" : "Nova Promoção"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Título *</label>
                <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600" placeholder="Ex: Descubra o Brasil!" />
              </div>
              {/* Subtitle */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Subtítulo / Chamada</label>
                <input type="text" value={subtitle} onChange={e => setSubtitle(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600" placeholder="Ex: Alugue por apenas R$99/dia" />
              </div>
              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Descrição / Regras</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600" rows={3} placeholder="Regras e detalhes da oferta..."></textarea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Discount */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Desconto (%)</label>
                  <input type="number" step="0.01" value={discountValue} onChange={e => setDiscountValue(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600" placeholder="20" />
                </div>
                {/* Contract ID */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Contract ID (XRS) ⭐</label>
                  <input type="text" value={contractID} onChange={e => setContractID(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white font-mono outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-500/30" placeholder="Ex: 45944876" />
                  <p className="text-[10px] text-purple-400/70 mt-1">Código oficial do contrato/desconto Europcar para injetar na API XRS</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Start Date */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Data Início</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600" />
                </div>
                {/* End Date */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Data Fim</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600" />
                </div>
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">URL da Imagem de Destaque</label>
                <input type="text" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600" placeholder="https://..." />
              </div>

              {/* Toggles row */}
              <div className="flex gap-4">
                <div className="flex-1 flex items-center gap-3 bg-gray-800/50 rounded-lg p-3">
                  <input type="checkbox" id="isActiveCb" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-5 h-5 accent-green-600 rounded" />
                  <label htmlFor="isActiveCb" className="text-sm text-white font-bold cursor-pointer">Ativa no site</label>
                </div>
                <div className="flex-1">
                  <select value={promoStatus} onChange={e => setPromoStatus(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-green-600 h-full">
                    <option value="ACTIVE">Status: Ativo</option>
                    <option value="ARCHIVED">Status: Arquivado</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 bg-gray-800 text-gray-300 font-bold text-sm rounded-lg hover:bg-gray-700">Cancelar</button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-lg disabled:opacity-50">{saving ? "Salvando..." : "Salvar Promoção"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
