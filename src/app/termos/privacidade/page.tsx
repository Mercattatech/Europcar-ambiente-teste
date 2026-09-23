import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Segurança e Política de Privacidade — Europcar Brasil",
  description: "Conheça como a Europcar Brasil coleta, utiliza e protege seus dados pessoais.",
};

export default function PrivacidadePage() {
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
            <h1 className="text-base font-bold text-gray-900">Segurança e Política de Privacidade</h1>
          </div>
          <a href="/" className="text-sm text-[#008d36] font-bold hover:underline hidden sm:block">← Voltar</a>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Hero */}
        <div className="bg-[#008d36] rounded-2xl p-8 mb-10 text-white">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🔒</span>
            <h2 className="text-2xl font-black">Segurança e Política de Privacidade</h2>
          </div>
          <p className="text-green-100 text-sm leading-relaxed">
            A Europcar Brasil está comprometida com a proteção dos seus dados pessoais.
            Esta política descreve como coletamos, usamos e protegemos suas informações
            em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
          </p>
          <p className="text-green-200 text-xs mt-3">Última atualização: Janeiro de 2025</p>
        </div>

        <div className="space-y-8 text-gray-700">
          {/* 1 */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">1</span>
              Quem somos
            </h2>
            <p className="leading-relaxed">
              A <strong>Europcar Brasil Ltda.</strong>, operada pelo <strong>Grupo Mercatta</strong>, é a responsável pelo tratamento dos seus dados pessoais coletados por meio deste site e plataforma de reservas (<a href="https://www.europcar.com.br" className="text-[#008d36] hover:underline">www.europcar.com.br</a>).
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">2</span>
              Dados que coletamos
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <div className="flex gap-3">
                <span className="text-[#008d36] font-black shrink-0">→</span>
                <div><strong>Dados cadastrais:</strong> nome completo, CPF, e-mail, telefone, data de nascimento.</div>
              </div>
              <div className="flex gap-3">
                <span className="text-[#008d36] font-black shrink-0">→</span>
                <div><strong>Dados de habilitação:</strong> número da CNH, país de emissão, data de vencimento.</div>
              </div>
              <div className="flex gap-3">
                <span className="text-[#008d36] font-black shrink-0">→</span>
                <div><strong>Dados de reserva:</strong> destino, datas, categoria de veículo, extras selecionados.</div>
              </div>
              <div className="flex gap-3">
                <span className="text-[#008d36] font-black shrink-0">→</span>
                <div><strong>Dados de pagamento:</strong> método de pagamento (não armazenamos dados completos de cartão — processados pela Cielo S.A.).</div>
              </div>
              <div className="flex gap-3">
                <span className="text-[#008d36] font-black shrink-0">→</span>
                <div><strong>Dados técnicos:</strong> endereço IP, tipo de navegador, páginas visitadas, cookies.</div>
              </div>
            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">3</span>
              Como usamos seus dados
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: "📋", title: "Execução do contrato", desc: "Para processar e confirmar sua reserva de veículo." },
                { icon: "📧", title: "Comunicações", desc: "Para envio de confirmações, vouchers e notificações da reserva." },
                { icon: "💳", title: "Pagamento", desc: "Para processar pagamentos com segurança via gateway Cielo." },
                { icon: "⚖️", title: "Obrigações legais", desc: "Para cumprir exigências legais e regulatórias brasileiras." },
                { icon: "📊", title: "Melhoria do serviço", desc: "Para análise de uso e melhoria contínua da plataforma." },
                { icon: "🔐", title: "Prevenção de fraudes", desc: "Para identificar e prevenir atividades suspeitas ou fraudulentas." },
              ].map((item) => (
                <div key={item.title} className="bg-white border border-gray-200 rounded-xl p-4 flex gap-3">
                  <span className="text-2xl shrink-0">{item.icon}</span>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">4</span>
              Compartilhamento de dados
            </h2>
            <p className="leading-relaxed mb-3">Seus dados podem ser compartilhados com:</p>
            <ul className="space-y-2 text-sm">
              <li className="flex gap-2"><span className="text-[#008d36]">•</span> <strong>Europcar Groupe S.A.</strong> — para operação da reserva no sistema GreenWay (XRS).</li>
              <li className="flex gap-2"><span className="text-[#008d36]">•</span> <strong>Cielo S.A.</strong> — para processamento de pagamentos com cartão de crédito.</li>
              <li className="flex gap-2"><span className="text-[#008d36]">•</span> <strong>Operadoras locais</strong> — estações Europcar no destino da reserva.</li>
              <li className="flex gap-2"><span className="text-[#008d36]">•</span> <strong>Autoridades públicas</strong> — quando exigido por lei ou ordem judicial.</li>
            </ul>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4 text-sm text-blue-800">
              <strong>🌍 Transferências internacionais:</strong> Para reservas em países fora do Brasil, seus dados são transmitidos ao sistema Europcar internacional (UE). Essas transferências são protegidas por cláusulas contratuais adequadas.
            </div>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">5</span>
              Segurança dos dados
            </h2>
            <p className="leading-relaxed">
              Adotamos medidas técnicas e organizacionais para proteger seus dados: criptografia TLS em todas as comunicações, armazenamento seguro em servidores certificados, acesso restrito a dados pessoais, e monitoramento contínuo contra acessos não autorizados. Os dados de cartão de crédito <strong>nunca são armazenados</strong> em nossos servidores — são processados diretamente pela Cielo com certificação PCI-DSS.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">6</span>
              Seus direitos (LGPD)
            </h2>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {[
                "Confirmar a existência de tratamento dos seus dados",
                "Acessar cópia dos seus dados pessoais",
                "Corrigir dados incompletos ou desatualizados",
                "Solicitar a anonimização ou exclusão dos dados",
                "Revogar o consentimento a qualquer momento",
                "Portabilidade dos dados a outro fornecedor",
              ].map((right) => (
                <div key={right} className="flex gap-2 items-start bg-white border border-gray-200 rounded-lg p-3">
                  <span className="text-[#008d36] font-black shrink-0 mt-0.5">✓</span>
                  <span>{right}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">7</span>
              Retenção de dados
            </h2>
            <p className="leading-relaxed">
              Mantemos seus dados pelo período necessário para a finalidade coletada. Dados de reserva são retidos por <strong>5 anos</strong> conforme obrigações fiscais e legais brasileiras. Você pode solicitar a exclusão antecipada de dados não obrigatórios.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">8</span>
              Contato do Encarregado (DPO)
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm mb-3">Para exercer seus direitos ou tirar dúvidas sobre esta política, entre em contato:</p>
              <div className="space-y-2 text-sm">
                <div className="flex gap-2"><span className="font-bold">E-mail:</span> <a href="mailto:privacidade@europcar.com.br" className="text-[#008d36] hover:underline">privacidade@europcar.com.br</a></div>
                <div className="flex gap-2"><span className="font-bold">Telefone:</span> <a href="tel:+551155420500" className="text-[#008d36] hover:underline">(11) 5542-0500</a></div>
                <div className="flex gap-2"><span className="font-bold">Horário:</span> Segunda a Sexta, 8h às 20h</div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer nav */}
        <div className="mt-12 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <a href="/" className="text-[#008d36] font-bold hover:underline text-sm">← Voltar ao início</a>
          <div className="flex gap-4 text-xs text-gray-400">
            <a href="/termos/cookies" className="hover:text-gray-700 transition-colors">Política de Cookies</a>
            <a href="/termos/reserva-online" className="hover:text-gray-700 transition-colors">Termos da Reserva Online</a>
          </div>
        </div>
      </main>
    </div>
  );
}
