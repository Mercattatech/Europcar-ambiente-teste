"use client";

import { useState, useEffect, useCallback } from "react";

export default function PainelConteudoSite() {
  // ─── Banner Internacional ────────────────────────────
  const [bannerEnabled, setBannerEnabled] = useState(true);
  const [bannerTitle, setBannerTitle] = useState("💳 PAGUE COM CARTÃO DE CRÉDITO E APROVEITE!");
  const [bannerLine1, setBannerLine1] = useState("✅ Até 6x sem juros");
  const [bannerLine2, setBannerLine2] = useState("✅ Isento de IOF");
  const [bannerLine3, setBannerLine3] = useState("✅ Até 6% de desconto");
  const [bannerBgColor, setBannerBgColor] = useState("#008d36");

  // ─── Política de Privacidade ─────────────────────────
  const [privacyPdfUrl, setPrivacyPdfUrl] = useState("");
  const [privacyUploading, setPrivacyUploading] = useState(false);

  // ─── UI ──────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [bannerRes, privacyRes] = await Promise.all([
        fetch("/api/admin/config?key=BANNER_INTERNACIONAL").then(r => r.json()),
        fetch("/api/admin/config?key=PRIVACY_POLICY_URL").then(r => r.json()),
      ]);

      if (bannerRes.value) {
        try {
          const data = JSON.parse(bannerRes.value);
          setBannerEnabled(data.enabled !== false);
          if (data.title) setBannerTitle(data.title);
          if (data.line1) setBannerLine1(data.line1);
          if (data.line2) setBannerLine2(data.line2);
          if (data.line3) setBannerLine3(data.line3);
          if (data.bgColor) setBannerBgColor(data.bgColor);
        } catch {}
      }

      if (privacyRes.value) setPrivacyPdfUrl(privacyRes.value);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const saveAll = async () => {
    setSaving(true);
    setMsg("");
    try {
      const bannerData = JSON.stringify({
        enabled: bannerEnabled,
        title: bannerTitle,
        line1: bannerLine1,
        line2: bannerLine2,
        line3: bannerLine3,
        bgColor: bannerBgColor,
      });

      await Promise.all([
        fetch("/api/admin/config", {
          method: "POST",
          body: JSON.stringify({ key: "BANNER_INTERNACIONAL", value: bannerData }),
        }),
        fetch("/api/admin/config", {
          method: "POST",
          body: JSON.stringify({ key: "PRIVACY_POLICY_URL", value: privacyPdfUrl }),
        }),
      ]);
      setMsg("✅ Configurações salvas com sucesso!");
      setTimeout(() => setMsg(""), 4000);
    } catch {
      setMsg("❌ Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setMsg("❌ Apenas arquivos PDF são aceitos.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMsg("❌ Arquivo muito grande (máximo 10MB).");
      return;
    }

    setPrivacyUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload-pdf", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        setPrivacyPdfUrl(data.url);
        setMsg("✅ PDF enviado com sucesso!");
        setTimeout(() => setMsg(""), 4000);
      } else {
        setMsg(`❌ ${data.error || "Erro ao enviar PDF."}`);
      }
    } catch {
      setMsg("❌ Erro de rede ao enviar PDF.");
    } finally {
      setPrivacyUploading(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">🌐 Conteúdo do Site</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie banners, políticas e conteúdos públicos do site.</p>
        </div>
        <button onClick={saveAll} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl transition-colors flex items-center gap-2">
          {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "💾 Salvar Tudo"}
        </button>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl font-bold ${msg.includes("✅") ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
          {msg}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-8">

          {/* ═══ Banner Internacional ═══ */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">🌍 Banner Internacional</h2>
                <p className="text-xs text-gray-500 mt-1">Exibido apenas em buscas internacionais (fora do Brasil) na página de veículos.</p>
              </div>
              <button
                onClick={() => setBannerEnabled(!bannerEnabled)}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${bannerEnabled ? "bg-emerald-600" : "bg-gray-700"}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${bannerEnabled ? "translate-x-8" : "translate-x-1"}`} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Título principal</label>
                <input type="text" value={bannerTitle} onChange={e => setBannerTitle(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Vantagem 1</label>
                  <input type="text" value={bannerLine1} onChange={e => setBannerLine1(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Vantagem 2</label>
                  <input type="text" value={bannerLine2} onChange={e => setBannerLine2(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Vantagem 3</label>
                  <input type="text" value={bannerLine3} onChange={e => setBannerLine3(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="block text-xs font-medium text-gray-400">Cor de fundo</label>
                <input type="color" value={bannerBgColor} onChange={e => setBannerBgColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border border-gray-700" />
                <span className="text-xs text-gray-500 font-mono">{bannerBgColor}</span>
              </div>

              {/* Preview */}
              <div className="mt-4">
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Preview</p>
                <div style={{ background: `linear-gradient(135deg, ${bannerBgColor}, ${bannerBgColor}dd)` }} className="rounded-xl p-5 text-center shadow-lg">
                  <p className="text-white font-black text-lg tracking-wide">{bannerTitle}</p>
                  <div className="flex flex-wrap justify-center gap-4 mt-3">
                    <span className="bg-white/20 backdrop-blur text-white text-sm font-bold px-4 py-1.5 rounded-full">{bannerLine1}</span>
                    <span className="bg-white/20 backdrop-blur text-white text-sm font-bold px-4 py-1.5 rounded-full">{bannerLine2}</span>
                    <span className="bg-white/20 backdrop-blur text-white text-sm font-bold px-4 py-1.5 rounded-full">{bannerLine3}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ Política de Privacidade ═══ */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-1">📄 Política de Privacidade</h2>
            <p className="text-xs text-gray-500 mb-4">
              Faça upload do PDF da Política de Privacidade. O link será exibido no rodapé do site.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">URL do PDF (ou faça upload abaixo)</label>
                <input type="text" value={privacyPdfUrl} onChange={e => setPrivacyPdfUrl(e.target.value)} placeholder="https://... ou /uploads/privacy.pdf" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
              </div>

              <div className="flex items-center gap-4">
                <label className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors flex items-center gap-2">
                  {privacyUploading ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "📤 Upload PDF"}
                  <input type="file" accept=".pdf" onChange={handlePdfUpload} className="hidden" />
                </label>
                {privacyPdfUrl && (
                  <a href={privacyPdfUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:text-emerald-300 underline flex items-center gap-1">
                    👁 Visualizar PDF atual
                  </a>
                )}
              </div>

              {privacyPdfUrl && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                  <p className="text-xs text-emerald-400 font-bold">✅ PDF configurado</p>
                  <p className="text-[10px] text-emerald-400/70 font-mono mt-1 break-all">{privacyPdfUrl}</p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
