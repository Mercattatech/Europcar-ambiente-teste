"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const partnerTypes = [
  { value: "INFLUENCER", label: "Influenciador" },
  { value: "COMPANY", label: "Empresa Parceira" },
  { value: "INDIVIDUAL", label: "Pessoa Física" },
  { value: "AFFILIATE", label: "Afiliado" },
  { value: "EMPLOYEE", label: "Colaborador" },
  { value: "CLIENT", label: "Cliente" },
  { value: "AMBASSADOR", label: "Embaixador" },
  { value: "REPRESENTATIVE", label: "Representante" },
  { value: "OTHER", label: "Outro" },
];

export default function NovoParceiro() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showBank, setShowBank] = useState(false);

  const [form, setForm] = useState({
    name: "", tradeName: "", type: "INFLUENCER",
    cpf: "", cnpj: "", email: "", whatsapp: "", phone: "",
    company: "", position: "", city: "", state: "", country: "BR",
    instagram: "", tiktok: "", youtube: "", linkedin: "", website: "",
    notes: "",
    bankName: "", bankAgency: "", bankAccount: "", pixKey: "", bankHolder: "", bankHolderDoc: "",
    commissionEnabled: false, commissionType: "PERCENTAGE", commissionValue: "", commissionBase: "PAID",
    commissionReleaseDelayDays: "7",
  });

  const u = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }));

  const handleSave = async () => {
    setError("");
    if (!form.name.trim()) { setError("Nome é obrigatório."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setSaving(false); return; }
      router.push(`/painel/cupons/parceiros/${data.id}`);
    } catch { setError("Erro de conexão."); }
    setSaving(false);
  };

  const inputCls = "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-green-600";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">🤝 Novo Parceiro</h1>
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm font-bold">← Voltar</button>
      </div>

      {error && <div className="bg-red-900/30 border border-red-600/40 text-red-400 px-4 py-3 rounded-xl text-sm font-bold">{error}</div>}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
        <h2 className="text-lg font-bold text-white">Informações básicas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-1">Nome *</label>
            <input value={form.name} onChange={e => u("name", e.target.value)} className={inputCls} placeholder="João Silva" />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-1">Nome Fantasia</label>
            <input value={form.tradeName} onChange={e => u("tradeName", e.target.value)} className={inputCls} placeholder="João Viagens" />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-1">Tipo</label>
            <select value={form.type} onChange={e => u("type", e.target.value)} className={inputCls}>
              {partnerTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-1">E-mail</label>
            <input type="email" value={form.email} onChange={e => u("email", e.target.value)} className={inputCls} placeholder="joao@email.com" />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-1">WhatsApp</label>
            <input value={form.whatsapp} onChange={e => u("whatsapp", e.target.value)} className={inputCls} placeholder="(11) 99999-0000" />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-1">Telefone</label>
            <input value={form.phone} onChange={e => u("phone", e.target.value)} className={inputCls} placeholder="(11) 3333-0000" />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-1">CPF</label>
            <input value={form.cpf} onChange={e => u("cpf", e.target.value)} className={inputCls} placeholder="000.000.000-00" />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-1">CNPJ</label>
            <input value={form.cnpj} onChange={e => u("cnpj", e.target.value)} className={inputCls} placeholder="00.000.000/0001-00" />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-1">Empresa</label>
            <input value={form.company} onChange={e => u("company", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-1">Cargo</label>
            <input value={form.position} onChange={e => u("position", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-1">Cidade</label>
            <input value={form.city} onChange={e => u("city", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-1">Estado</label>
            <input value={form.state} onChange={e => u("state", e.target.value)} className={inputCls} placeholder="SP" />
          </div>
        </div>

        <h2 className="text-lg font-bold text-white pt-4">Redes Sociais</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-1">Instagram</label>
            <input value={form.instagram} onChange={e => u("instagram", e.target.value)} className={inputCls} placeholder="@joaosilva" />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-1">TikTok</label>
            <input value={form.tiktok} onChange={e => u("tiktok", e.target.value)} className={inputCls} placeholder="@joaosilva" />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-1">YouTube</label>
            <input value={form.youtube} onChange={e => u("youtube", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-1">LinkedIn</label>
            <input value={form.linkedin} onChange={e => u("linkedin", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-400 block mb-1">Website</label>
            <input value={form.website} onChange={e => u("website", e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <label className="text-sm font-bold text-gray-400 block mb-1">Observações</label>
          <textarea value={form.notes} onChange={e => u("notes", e.target.value)} rows={3} className={inputCls + " resize-none"} />
        </div>

        {/* Comissão */}
        <h2 className="text-lg font-bold text-white pt-4">Comissão</h2>
        <label className="flex items-center gap-3 p-4 bg-gray-800 rounded-xl cursor-pointer">
          <input type="checkbox" checked={form.commissionEnabled} onChange={e => u("commissionEnabled", e.target.checked)} className="w-5 h-5 accent-green-600" />
          <div>
            <p className="text-sm font-bold text-white">Gerar comissão por venda</p>
            <p className="text-[11px] text-gray-500">Habilita cálculo automático de comissão</p>
          </div>
        </label>
        {form.commissionEnabled && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-bold text-gray-400 block mb-1">Tipo</label>
              <select value={form.commissionType} onChange={e => u("commissionType", e.target.value)} className={inputCls}>
                <option value="PERCENTAGE">Percentual</option>
                <option value="FIXED">Valor fixo</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-400 block mb-1">Valor</label>
              <input type="number" step="0.01" value={form.commissionValue} onChange={e => u("commissionValue", e.target.value)} className={inputCls} placeholder="10" />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-400 block mb-1">Base</label>
              <select value={form.commissionBase} onChange={e => u("commissionBase", e.target.value)} className={inputCls}>
                <option value="PAID">Valor pago</option>
                <option value="GROSS">Valor bruto</option>
                <option value="NET">Valor líquido</option>
                <option value="FIXED">Valor fixo</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-400 block mb-1">Delay (dias)</label>
              <input type="number" value={form.commissionReleaseDelayDays} onChange={e => u("commissionReleaseDelayDays", e.target.value)} className={inputCls} placeholder="7" />
            </div>
          </div>
        )}

        {/* Dados bancários */}
        <div className="pt-4">
          <button onClick={() => setShowBank(!showBank)} className="text-sm font-bold text-gray-400 hover:text-white transition-colors">
            {showBank ? "▼" : "▶"} Dados Bancários (opcional)
          </button>
        </div>
        {showBank && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="text-sm font-bold text-gray-400 block mb-1">Banco</label><input value={form.bankName} onChange={e => u("bankName", e.target.value)} className={inputCls} /></div>
            <div><label className="text-sm font-bold text-gray-400 block mb-1">Agência</label><input value={form.bankAgency} onChange={e => u("bankAgency", e.target.value)} className={inputCls} /></div>
            <div><label className="text-sm font-bold text-gray-400 block mb-1">Conta</label><input value={form.bankAccount} onChange={e => u("bankAccount", e.target.value)} className={inputCls} /></div>
            <div><label className="text-sm font-bold text-gray-400 block mb-1">PIX</label><input value={form.pixKey} onChange={e => u("pixKey", e.target.value)} className={inputCls} /></div>
            <div><label className="text-sm font-bold text-gray-400 block mb-1">Titular</label><input value={form.bankHolder} onChange={e => u("bankHolder", e.target.value)} className={inputCls} /></div>
            <div><label className="text-sm font-bold text-gray-400 block mb-1">CPF/CNPJ Titular</label><input value={form.bankHolderDoc} onChange={e => u("bankHolderDoc", e.target.value)} className={inputCls} /></div>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button onClick={() => router.back()} className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-colors">← Cancelar</button>
        <button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-3 rounded-xl text-sm transition-colors disabled:opacity-50">
          {saving ? "Salvando..." : "✅ Criar Parceiro"}
        </button>
      </div>
    </div>
  );
}
