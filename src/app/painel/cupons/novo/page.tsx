"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const couponTypes = [
  { value: "PROMOTIONAL", label: "Promocional" },
  { value: "INFLUENCER", label: "Influenciador" },
  { value: "COMPANY", label: "Empresa Parceira" },
  { value: "INDIVIDUAL", label: "Pessoa Física" },
  { value: "AFFILIATE", label: "Afiliado" },
  { value: "EMPLOYEE", label: "Colaborador" },
  { value: "CLIENT", label: "Cliente" },
  { value: "CAMPAIGN", label: "Campanha" },
  { value: "COURTESY", label: "Cortesia" },
  { value: "FREE", label: "Gratuidade" },
  { value: "OTHER", label: "Outro" },
];

const discountTypes = [
  { value: "PERCENTAGE", label: "Percentual (%)", icon: "%" },
  { value: "FIXED_VALUE", label: "Valor fixo (R$)", icon: "R$" },
  { value: "FREE", label: "Gratuidade (100%)", icon: "🎁" },
];

export default function NovoCupom() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<any>(null);
  const [partners, setPartners] = useState<any[]>([]);

  // Form data
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    couponType: "PROMOTIONAL",
    discountType: "PERCENTAGE",
    discountValue: "",
    maxDiscount: "",
    minimumOrderValue: "",
    stackable: false,
    startsAt: "",
    expiresAt: "",
    maxUses: "",
    maxUsesPerCustomer: "1",
    maxUsesPerDay: "",
    maxUsesPerMonth: "",
    partnerId: "",
    campaign: "",
    requiresApproval: false,
    status: "ACTIVE",
  });

  useEffect(() => {
    fetch("/api/partners").then(r => r.json()).then(d => setPartners(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setForm(f => ({ ...f, code }));
  };

  const handleSave = async () => {
    setError("");
    if (!form.code.trim()) { setError("Código é obrigatório."); return; }
    if (!form.name.trim()) { setError("Nome é obrigatório."); return; }
    if (form.discountType !== "FREE" && (!form.discountValue || parseFloat(form.discountValue) <= 0)) {
      setError("Valor do desconto é obrigatório."); return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro ao criar cupom."); setSaving(false); return; }
      setSuccess(data);
    } catch {
      setError("Erro de conexão.");
    }
    setSaving(false);
  };

  const u = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  if (success) {
    const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${success.code}`;
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="bg-gray-900 border border-green-600/30 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✅</span>
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Cupom Criado!</h1>
          <div className="bg-gray-800 rounded-xl p-4 my-4">
            <p className="text-[11px] text-gray-500 uppercase font-bold mb-1">Código</p>
            <p className="text-3xl font-mono font-black text-green-400">{success.code}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 my-4">
            <p className="text-[11px] text-gray-500 uppercase font-bold mb-1">Link de Indicação</p>
            <p className="text-sm font-mono text-blue-400 break-all">{link}</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-center mt-4">
            <button onClick={() => navigator.clipboard.writeText(success.code)} className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors">📋 Copiar Cupom</button>
            <button onClick={() => navigator.clipboard.writeText(link)} className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors">🔗 Copiar Link</button>
            <button onClick={() => window.open(`https://wa.me/?text=Use%20o%20cupom%20${success.code}%20no%20site%20${encodeURIComponent(link)}`, '_blank')} className="bg-green-700 hover:bg-green-600 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors">💬 WhatsApp</button>
          </div>
          <div className="flex gap-2 justify-center mt-4">
            <button onClick={() => { setSuccess(null); setForm(f => ({ ...f, code: "", name: "" })); setStep(1); }} className="text-gray-400 hover:text-white text-sm font-bold">+ Criar outro</button>
            <span className="text-gray-600">·</span>
            <button onClick={() => router.push(`/painel/cupons/${success.id}`)} className="text-green-400 hover:text-green-300 text-sm font-bold">Ver detalhes →</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">🎟️ Novo Cupom</h1>
          <p className="text-sm text-gray-400 mt-1">Etapa {step} de 5</p>
        </div>
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm font-bold">← Voltar</button>
      </div>

      {/* Progress */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(s => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-green-500" : "bg-gray-800"}`} />
        ))}
      </div>

      {error && <div className="bg-red-900/30 border border-red-600/40 text-red-400 px-4 py-3 rounded-xl text-sm font-bold">{error}</div>}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
        {/* STEP 1: Tipo */}
        {step === 1 && (
          <>
            <h2 className="text-lg font-bold text-white">Quem vai usar?</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {couponTypes.map(t => (
                <button key={t.value} onClick={() => u("couponType", t.value)}
                  className={`p-3 rounded-xl text-sm font-bold text-left transition-all ${form.couponType === t.value ? "bg-green-600/20 border border-green-600/40 text-green-400" : "bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600"}`}
                >{t.label}</button>
              ))}
            </div>
            {form.couponType !== "PROMOTIONAL" && form.couponType !== "CAMPAIGN" && (
              <div>
                <label className="text-sm font-bold text-gray-400 block mb-1">Vincular a um parceiro (opcional)</label>
                <select value={form.partnerId} onChange={e => u("partnerId", e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-green-600">
                  <option value="">Nenhum parceiro</option>
                  {partners.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
                </select>
              </div>
            )}
          </>
        )}

        {/* STEP 2: Benefício */}
        {step === 2 && (
          <>
            <h2 className="text-lg font-bold text-white">Qual o benefício?</h2>
            <div className="grid grid-cols-3 gap-2">
              {discountTypes.map(d => (
                <button key={d.value} onClick={() => u("discountType", d.value)}
                  className={`p-4 rounded-xl text-center transition-all ${form.discountType === d.value ? "bg-green-600/20 border border-green-600/40 text-green-400" : "bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600"}`}
                >
                  <span className="text-2xl block mb-1">{d.icon}</span>
                  <span className="text-xs font-bold">{d.label}</span>
                </button>
              ))}
            </div>
            {form.discountType !== "FREE" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-gray-400 block mb-1">
                    {form.discountType === "PERCENTAGE" ? "Percentual (%)" : "Valor (R$)"}
                  </label>
                  <input type="number" step="0.01" value={form.discountValue} onChange={e => u("discountValue", e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-green-600" placeholder={form.discountType === "PERCENTAGE" ? "10" : "50.00"} />
                </div>
                {form.discountType === "PERCENTAGE" && (
                  <div>
                    <label className="text-sm font-bold text-gray-400 block mb-1">Desconto máximo (R$)</label>
                    <input type="number" step="0.01" value={form.maxDiscount} onChange={e => u("maxDiscount", e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-green-600" placeholder="300" />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* STEP 3: Regras */}
        {step === 3 && (
          <>
            <h2 className="text-lg font-bold text-white">Regras de uso</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-gray-400 block mb-1">Código do cupom</label>
                <div className="flex gap-2">
                  <input type="text" value={form.code} onChange={e => u("code", e.target.value.toUpperCase())} maxLength={20}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-green-600 font-mono uppercase" placeholder="JOAO10" />
                  <button onClick={generateCode} className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-3 py-2 rounded-xl text-sm transition-colors" title="Gerar código">🎲</button>
                </div>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-400 block mb-1">Nome interno</label>
                <input type="text" value={form.name} onChange={e => u("name", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-green-600" placeholder="Cupom Verão 2026" />
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-400 block mb-1">Descrição (opcional)</label>
              <textarea value={form.description} onChange={e => u("description", e.target.value)} rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-green-600 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-gray-400 block mb-1">Início (opcional)</label>
                <input type="datetime-local" value={form.startsAt} onChange={e => u("startsAt", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-green-600" />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-400 block mb-1">Expiração (opcional)</label>
                <input type="datetime-local" value={form.expiresAt} onChange={e => u("expiresAt", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-green-600" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-bold text-gray-400 block mb-1">Usos totais</label>
                <input type="number" value={form.maxUses} onChange={e => u("maxUses", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-green-600" placeholder="∞" />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-400 block mb-1">Por cliente</label>
                <input type="number" value={form.maxUsesPerCustomer} onChange={e => u("maxUsesPerCustomer", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-green-600" placeholder="1" />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-400 block mb-1">Por dia</label>
                <input type="number" value={form.maxUsesPerDay} onChange={e => u("maxUsesPerDay", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-green-600" placeholder="∞" />
              </div>
              <div>
                <label className="text-sm font-bold text-gray-400 block mb-1">Valor mínimo (R$)</label>
                <input type="number" step="0.01" value={form.minimumOrderValue} onChange={e => u("minimumOrderValue", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-green-600" placeholder="0" />
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-400 block mb-1">Campanha (opcional)</label>
              <input type="text" value={form.campaign} onChange={e => u("campaign", e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-green-600" placeholder="BLACK FRIDAY 2026" />
            </div>
          </>
        )}

        {/* STEP 4: Opções */}
        {step === 4 && (
          <>
            <h2 className="text-lg font-bold text-white">Opções adicionais</h2>
            <label className="flex items-center gap-3 p-4 bg-gray-800 rounded-xl cursor-pointer hover:bg-gray-750 transition-colors">
              <input type="checkbox" checked={form.stackable} onChange={e => u("stackable", e.target.checked)} className="w-5 h-5 accent-green-600" />
              <div>
                <p className="text-sm font-bold text-white">Acumular com outras promoções</p>
                <p className="text-[11px] text-gray-500">Permite uso junto com outro cupom ou promoção ativa</p>
              </div>
            </label>
            {form.discountType === "FREE" && (
              <label className="flex items-center gap-3 p-4 bg-gray-800 rounded-xl cursor-pointer hover:bg-gray-750 transition-colors">
                <input type="checkbox" checked={form.requiresApproval} onChange={e => u("requiresApproval", e.target.checked)} className="w-5 h-5 accent-green-600" />
                <div>
                  <p className="text-sm font-bold text-white">Exigir aprovação administrativa</p>
                  <p className="text-[11px] text-gray-500">Cupom 100% gratuito requer autorização para uso</p>
                </div>
              </label>
            )}
            <div>
              <label className="text-sm font-bold text-gray-400 block mb-1">Status inicial</label>
              <select value={form.status} onChange={e => u("status", e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-green-600">
                <option value="DRAFT">Rascunho</option>
                <option value="ACTIVE">Ativo (publicar agora)</option>
                <option value="SCHEDULED">Agendado</option>
              </select>
            </div>
          </>
        )}

        {/* STEP 5: Revisão */}
        {step === 5 && (
          <>
            <h2 className="text-lg font-bold text-white">Revisar e publicar</h2>
            <div className="space-y-3">
              {[
                { label: "Código", value: form.code || "—" },
                { label: "Nome", value: form.name || "—" },
                { label: "Tipo", value: couponTypes.find(t => t.value === form.couponType)?.label || form.couponType },
                { label: "Desconto", value: form.discountType === "FREE" ? "100% Grátis" : form.discountType === "PERCENTAGE" ? `${form.discountValue}%` : `R$ ${form.discountValue}` },
                ...(form.maxDiscount ? [{ label: "Desc. máximo", value: `R$ ${form.maxDiscount}` }] : []),
                ...(form.minimumOrderValue ? [{ label: "Valor mínimo", value: `R$ ${form.minimumOrderValue}` }] : []),
                { label: "Usos máx.", value: form.maxUses || "Ilimitado" },
                { label: "Por cliente", value: form.maxUsesPerCustomer || "Ilimitado" },
                ...(form.startsAt ? [{ label: "Início", value: new Date(form.startsAt).toLocaleString("pt-BR") }] : []),
                ...(form.expiresAt ? [{ label: "Expiração", value: new Date(form.expiresAt).toLocaleString("pt-BR") }] : []),
                ...(form.campaign ? [{ label: "Campanha", value: form.campaign }] : []),
                { label: "Status", value: form.status },
                ...(form.partnerId ? [{ label: "Parceiro", value: partners.find(p => p.id === form.partnerId)?.name || form.partnerId }] : []),
              ].map((item, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-gray-800/50">
                  <span className="text-sm text-gray-500">{item.label}</span>
                  <span className="text-sm font-bold text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <button onClick={() => step > 1 ? setStep(step - 1) : router.back()}
          className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors">
          ← {step === 1 ? "Cancelar" : "Anterior"}
        </button>
        {step < 5 ? (
          <button onClick={() => setStep(step + 1)} className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors">
            Próximo →
          </button>
        ) : (
          <button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-3 rounded-xl text-sm transition-colors disabled:opacity-50">
            {saving ? "Salvando..." : "✅ Criar Cupom"}
          </button>
        )}
      </div>
    </div>
  );
}
