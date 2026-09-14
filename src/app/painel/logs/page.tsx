"use client";

import { useState, useEffect } from "react";

export default function PainelLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/api/admin/logs")
      .then(res => res.json())
      .then(data => { setLogs(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filteredLogs = logs.filter(log => {
    if (!filter) return true;
    const term = filter.toLowerCase();
    return (
      (log.endpoint || "").toLowerCase().includes(term) ||
      (log.payload || "").toLowerCase().includes(term) ||
      (log.response || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">System Logs</h1>
          <p className="text-gray-400 text-sm mt-1">Registros de transações da API Cielo e Erros de 3DS dos Clientes</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Buscar por 3DS, nome, whats..."
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500 w-64"
          />
          <button
            onClick={() => setFilter(filter === "3DS" ? "" : "3DS")}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors border ${filter === "3DS" ? "bg-purple-600 text-white border-purple-500" : "bg-gray-800 text-purple-400 border-purple-500/30 hover:bg-purple-900/30"}`}
          >
            🔍 Filtro 3DS
          </button>
          <button onClick={() => window.location.reload()} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg font-bold text-sm transition-colors">
            🔄 Atualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 p-10 rounded-xl text-center text-gray-500">Nenhum log encontrado.</div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800/50 border-b border-gray-700">
              <tr>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Data/Hora</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Endpoint / Evento</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Payload (Dados)</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Response / Resumo Cliente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filteredLogs.map(log => {
                const is3dsError = (log.endpoint || "").includes("[3DS Client Error]");
                return (
                  <tr key={log.id} className={`hover:bg-gray-800/30 transition-colors align-top ${is3dsError ? "bg-purple-950/10" : ""}`}>
                    <td className="px-5 py-4 font-mono text-xs text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-5 py-4">
                      {is3dsError ? (
                        <span className="inline-block bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-1 rounded font-mono text-[11px] font-bold">
                          {log.endpoint}
                        </span>
                      ) : (
                        <span className="font-bold text-white text-xs">{log.endpoint}</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <pre className="bg-gray-950 p-2 rounded text-[10px] text-gray-300 overflow-auto max-w-xs max-h-24 scrollbar-thin border border-gray-800">{log.payload}</pre>
                    </td>
                    <td className="px-5 py-4">
                      <pre className={`p-2 rounded text-[10px] overflow-auto max-w-md max-h-24 scrollbar-thin border ${is3dsError ? "bg-purple-950/40 text-purple-200 border-purple-800/50 font-sans whitespace-pre-wrap" : "bg-gray-950 text-gray-300 border-gray-800"}`}>
                        {log.response}
                      </pre>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
