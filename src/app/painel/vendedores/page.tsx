"use client";

import { useState, useEffect } from "react";

const EMPTY = { name: "", email: "", password: "", phone: "", cpf: "", role: "VENDEDOR", commissionType: "PERCENTAGE", commissionValue: "5", pixKey: "", sellerNotes: "" };

export default function PainelVendedores() {
   const [sellers, setSellers] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
   const [editing, setEditing] = useState<any>(null); // null = fechado, {} = novo
   const [form, setForm] = useState<any>(EMPTY);
   const [saving, setSaving] = useState(false);
   const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

   const showToast = (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3500);
   };

   const load = async () => {
      try {
         const res = await fetch("/api/admin/vendedores");
         const data = await res.json();
         setSellers(Array.isArray(data) ? data : []);
      } finally {
         setLoading(false);
      }
   };
   useEffect(() => { load(); }, []);

   const openNew = () => { setForm(EMPTY); setEditing({}); };
   const openEdit = (s: any) => {
      setForm({
         name: s.name || "", email: s.email || "", password: "", phone: s.phone || "", cpf: s.cpf || "", role: s.role === "VENDEDOR_ADMIN" ? "VENDEDOR_ADMIN" : "VENDEDOR",
         commissionType: s.commissionType || "PERCENTAGE", commissionValue: String(s.commissionValue ?? 0),
         pixKey: s.pixKey || "", sellerNotes: s.sellerNotes || "",
      });
      setEditing(s);
   };

   const save = async () => {
      setSaving(true);
      try {
         const isNew = !editing?.id;
         const body: any = { ...form, commissionValue: Number(String(form.commissionValue).replace(",", ".")) || 0 };
         if (!isNew && !body.password) delete body.password;
         const res = await fetch(isNew ? "/api/admin/vendedores" : `/api/admin/vendedores/${editing.id}`, {
            method: isNew ? "POST" : "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
         });
         const data = await res.json().catch(() => ({} as any));
         if (!res.ok) { showToast(data.error || "Erro ao salvar", "error"); return; }
         showToast(isNew ? "Vendedor cadastrado!" : "Vendedor atualizado!");
         setEditing(null);
         load();
      } finally {
         setSaving(false);
      }
   };

   const toggleStatus = async (s: any) => {
      const next = s.status === "BLOCKED" ? "ACTIVE" : "BLOCKED";
      const res = await fetch(`/api/admin/vendedores/${s.id}`, {
         method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }),
      });
      if (res.ok) { showToast(next === "ACTIVE" ? "Vendedor ativado" : "Vendedor inativado"); load(); }
      else showToast("Erro ao alterar status", "error");
   };

   const input = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500";
   const label = "block text-xs font-medium text-gray-400 mb-1";

   return (
      <div className="space-y-6">
         {toast && (
            <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-xl text-sm font-bold shadow-xl ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>{toast.message}</div>
         )}
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
               <h1 className="text-2xl font-black text-white">🧑‍💼 Vendedores</h1>
               <p className="text-sm text-gray-400 mt-1">Cadastre vendedores que vendem pelo site e compartilham link de pagamento com o cliente.</p>
            </div>
            <button onClick={openNew} className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm w-fit">+ Novo Vendedor</button>
         </div>

         <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
               <thead>
                  <tr className="text-left text-[11px] uppercase text-gray-500 border-b border-gray-800">
                     <th className="p-4">Vendedor</th><th className="p-4">Contato</th><th className="p-4">Comissão padrão</th>
                     <th className="p-4">Links</th><th className="p-4">Status</th><th className="p-4 text-right">Ações</th>
                  </tr>
               </thead>
               <tbody>
                  {loading && <tr><td colSpan={6} className="p-6 text-center text-gray-500">Carregando...</td></tr>}
                  {!loading && sellers.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-500">Nenhum vendedor cadastrado.</td></tr>}
                  {sellers.map((s) => (
                     <tr key={s.id} className="border-b border-gray-800/60 text-gray-300">
                        <td className="p-4"><p className="font-bold text-white">{s.name}</p><p className="text-xs text-gray-500">{s.email}</p>
                           <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded ${s.role === "VENDEDOR_ADMIN" ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}`}>{s.role === "VENDEDOR_ADMIN" ? "Vendedor + Admin" : "Apenas Vendedor"}</span>
                        </td>
                        <td className="p-4 text-xs">{s.phone || "—"}<br /><span className="text-gray-500">PIX: {s.pixKey || "—"}</span></td>
                        <td className="p-4 font-bold text-green-400">
                           {s.commissionType === "FIXED" ? `R$ ${Number(s.commissionValue || 0).toFixed(2).replace(".", ",")} / venda` : `${s.commissionValue ?? 0}% da venda`}
                        </td>
                        <td className="p-4 text-xs">{s.linksCreated} gerados · <span className="text-green-400">{s.linksUsed} pagos</span></td>
                        <td className="p-4">
                           <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${s.status === "BLOCKED" ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
                              {s.status === "BLOCKED" ? "Inativo" : "Ativo"}
                           </span>
                        </td>
                        <td className="p-4 text-right whitespace-nowrap">
                           <button onClick={() => openEdit(s)} className="text-xs font-bold text-blue-400 hover:text-blue-300 mr-3">Editar</button>
                           <button onClick={() => toggleStatus(s)} className="text-xs font-bold text-gray-400 hover:text-white">{s.status === "BLOCKED" ? "Ativar" : "Inativar"}</button>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>

         {editing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setEditing(null)}>
               <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                  <h2 className="text-lg font-black text-white">{editing.id ? "Editar vendedor" : "Novo vendedor"}</h2>
                  <div><label className={label}>Nome completo *</label><input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     <div><label className={label}>E-mail (login) *</label><input type="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                     <div><label className={label}>{editing.id ? "Nova senha (opcional)" : "Senha *"}</label><input type="password" className={input} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="mín. 6 caracteres" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     <div><label className={label}>Telefone / WhatsApp</label><input className={input} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                     <div><label className={label}>CPF</label><input className={input} value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     <div>
                        <label className={label}>Tipo de comissão padrão</label>
                        <select className={input} value={form.commissionType} onChange={(e) => setForm({ ...form, commissionType: e.target.value })}>
                           <option value="PERCENTAGE">% sobre o valor da venda</option>
                           <option value="FIXED">Valor fixo (R$) por venda</option>
                        </select>
                     </div>
                     <div>
                        <label className={label}>{form.commissionType === "FIXED" ? "Valor (R$)" : "Percentual (%)"}</label>
                        <input className={input} inputMode="decimal" value={form.commissionValue} onChange={(e) => setForm({ ...form, commissionValue: e.target.value })} />
                     </div>
                  </div>
                  <div>
                     <label className={label}>Perfil de acesso</label>
                     <select className={input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                        <option value="VENDEDOR">Apenas Vendedor — acessa só o painel de comissão</option>
                        <option value="VENDEDOR_ADMIN">Vendedor + Administrador — acesso total ao painel</option>
                     </select>
                  </div>
                  <div><label className={label}>Chave PIX para pagamento da comissão</label><input className={input} value={form.pixKey} onChange={(e) => setForm({ ...form, pixKey: e.target.value })} /></div>
                  <div><label className={label}>Observações</label><textarea rows={2} className={input} value={form.sellerNotes} onChange={(e) => setForm({ ...form, sellerNotes: e.target.value })} /></div>
                  <p className="text-[11px] text-gray-500">A comissão padrão é só uma sugestão: em cada venda você pode ajustar o valor em <b>Vendas &amp; Comissões Vendedores</b>.</p>
                  <div className="flex gap-3 pt-2">
                     <button onClick={() => setEditing(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-2.5 rounded-xl text-sm">Cancelar</button>
                     <button onClick={save} disabled={saving} className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm">{saving ? "Salvando..." : "Salvar"}</button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
}

