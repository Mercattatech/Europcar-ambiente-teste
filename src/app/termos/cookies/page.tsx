import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Cookies — Europcar Brasil",
  description: "Saiba como a Europcar Brasil utiliza cookies e tecnologias de rastreamento.",
};

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-4 px-6 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/">
              <img src="/logo.jpg" alt="Europcar" className="h-8 object-contain" />
            </a>
            <div className="w-px h-6 bg-gray-300" />
            <h1 className="text-base font-bold text-gray-900">Política de Cookies</h1>
          </div>
          <a href="/" className="text-sm text-[#008d36] font-bold hover:underline hidden sm:block">← Voltar</a>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Hero */}
        <div className="bg-[#1a1a1a] rounded-2xl p-8 mb-10 text-white">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🍪</span>
            <h2 className="text-2xl font-black">Política de Cookies</h2>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">
            Esta política explica o que são cookies, como os usamos, e como você pode controlá-los.
            Ao continuar navegando no site, você concorda com o uso de cookies conforme descrito abaixo.
          </p>
          <p className="text-gray-500 text-xs mt-3">Última atualização: Janeiro de 2025</p>
        </div>

        <div className="space-y-8 text-gray-700">
          {/* 1 */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">1</span>
              O que são cookies?
            </h2>
            <p className="leading-relaxed">
              Cookies são pequenos arquivos de texto armazenados no seu dispositivo quando você acessa um site. Eles permitem que o site reconheça seu dispositivo e lembre de informações sobre sua visita — como seu idioma preferido ou dados de login — tornando a próxima visita mais fácil e o site mais útil para você.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">2</span>
              Tipos de cookies que usamos
            </h2>
            <div className="space-y-4">
              {[
                {
                  icon: "🔧",
                  tipo: "Cookies Essenciais",
                  badge: "Sempre ativos",
                  badgeColor: "bg-green-100 text-green-700",
                  desc: "Necessários para o funcionamento básico do site. Sem eles, serviços como login, carrinho e processo de reserva não funcionariam. Não podem ser desativados.",
                  exemplos: ["Sessão de autenticação (next-auth)", "Segurança CSRF", "Preferências de idioma"],
                },
                {
                  icon: "📊",
                  tipo: "Cookies Analíticos",
                  badge: "Opcional",
                  badgeColor: "bg-blue-100 text-blue-700",
                  desc: "Nos ajudam a entender como os visitantes interagem com o site, coletando informações de forma anônima. Usamos esses dados para melhorar a experiência de uso.",
                  exemplos: ["Google Analytics (GA4)", "Métricas de páginas visitadas", "Taxa de conversão de reservas"],
                },
                {
                  icon: "🎯",
                  tipo: "Cookies de Marketing",
                  badge: "Opcional",
                  badgeColor: "bg-yellow-100 text-yellow-700",
                  desc: "Utilizados para exibir anúncios relevantes com base nos seus interesses. Podem ser compartilhados com parceiros de publicidade.",
                  exemplos: ["Google Ads (remarketing)", "Meta Pixel (Facebook/Instagram)", "LinkedIn Insight Tag"],
                },
              ].map((item) => (
                <div key={item.tipo} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{item.icon}</span>
                      <h3 className="font-black text-gray-900">{item.tipo}</h3>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${item.badgeColor}`}>{item.badge}</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">{item.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {item.exemplos.map((ex) => (
                      <span key={ex} className="text-[11px] bg-gray-100 text-gray-500 px-2 py-1 rounded-lg">{ex}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">3</span>
              Por quanto tempo os cookies ficam armazenados?
            </h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="font-bold text-gray-900 mb-1">Cookies de sessão</p>
                <p className="text-gray-500">Excluídos automaticamente quando você fecha o navegador.</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="font-bold text-gray-900 mb-1">Cookies persistentes</p>
                <p className="text-gray-500">Ficam armazenados por um período pré-determinado (geralmente 12 meses), mesmo após fechar o navegador.</p>
              </div>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">4</span>
              Como controlar os cookies
            </h2>
            <p className="leading-relaxed mb-4">
              Você pode controlar e/ou excluir cookies a qualquer momento através das configurações do seu navegador. Saiba como:
            </p>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {[
                { nav: "Google Chrome", url: "https://support.google.com/chrome/answer/95647" },
                { nav: "Mozilla Firefox", url: "https://support.mozilla.org/kb/cookies-information-websites-store-on-your-computer" },
                { nav: "Safari (Apple)", url: "https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" },
                { nav: "Microsoft Edge", url: "https://support.microsoft.com/microsoft-edge/delete-cookies-in-microsoft-edge" },
              ].map((b) => (
                <a key={b.nav} href={b.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between bg-white border border-gray-200 hover:border-[#008d36] rounded-xl p-4 transition-colors group">
                  <span className="font-medium text-gray-700 group-hover:text-[#008d36]">{b.nav}</span>
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-[#008d36]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ))}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4 text-sm text-amber-800">
              <strong>⚠️ Atenção:</strong> Desativar todos os cookies pode impedir o funcionamento correto de algumas funcionalidades do site, como o processo de reserva e login.
            </div>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">5</span>
              Contato
            </h2>
            <p className="text-sm leading-relaxed">
              Dúvidas sobre nossa Política de Cookies? Entre em contato:{" "}
              <a href="mailto:privacidade@europcar.com.br" className="text-[#008d36] hover:underline font-medium">privacidade@europcar.com.br</a>
            </p>
          </section>
        </div>

        {/* Footer nav */}
        <div className="mt-12 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <a href="/" className="text-[#008d36] font-bold hover:underline text-sm">← Voltar ao início</a>
          <div className="flex gap-4 text-xs text-gray-400">
            <a href="/termos/privacidade" className="hover:text-gray-700 transition-colors">Política de Privacidade</a>
            <a href="/termos/reserva-online" className="hover:text-gray-700 transition-colors">Termos da Reserva Online</a>
          </div>
        </div>
      </main>
    </div>
  );
}
