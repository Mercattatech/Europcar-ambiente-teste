import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos e Condições da Reserva Online — Europcar Brasil",
  description: "Leia os termos e condições completos para reservas online realizadas na plataforma Europcar Brasil.",
};

export default function ReservaOnlinePage() {
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
            <h1 className="text-base font-bold text-gray-900">Termos e Condições da Reserva Online</h1>
          </div>
          <a href="/" className="text-sm text-[#008d36] font-bold hover:underline hidden sm:block">← Voltar</a>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Hero */}
        <div className="bg-gradient-to-br from-[#008d36] to-[#005c22] rounded-2xl p-8 mb-10 text-white">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">📋</span>
            <h2 className="text-2xl font-black">Termos e Condições da Reserva Online</h2>
          </div>
          <p className="text-green-100 text-sm leading-relaxed">
            Ao realizar uma reserva através da plataforma online da Europcar Brasil, você declara ter lido, compreendido e concordado com os presentes Termos e Condições. Leia com atenção antes de confirmar sua reserva.
          </p>
          <p className="text-green-200 text-xs mt-3">Última atualização: Janeiro de 2025</p>
        </div>

        <div className="space-y-8 text-gray-700">
          {/* 1 */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">1</span>
              Definições e Partes
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2 text-sm">
              <p><strong>Europcar Brasil / Operadora:</strong> Europcar Brasil Ltda., representada pelo Grupo Mercatta, responsável pela operação desta plataforma.</p>
              <p><strong>Cliente / Locatário:</strong> Pessoa física ou jurídica que realiza a reserva através desta plataforma.</p>
              <p><strong>Europcar Groupe:</strong> Europcar Groupe S.A., empresa francesa detentora da marca Europcar, responsável pelas operações internacionais.</p>
              <p><strong>Reserva Online:</strong> Contratação de aluguel de veículo realizada exclusivamente por meio desta plataforma digital.</p>
            </div>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">2</span>
              Elegibilidade e Requisitos
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3 bg-white border border-gray-200 rounded-xl p-4">
                <span className="text-[#008d36] font-black shrink-0">→</span>
                <div><strong>Idade mínima:</strong> O condutor principal deve ter no mínimo 21 anos (algumas categorias exigem 25 anos). Taxas adicionais podem ser aplicadas para condutores com menos de 25 anos.</div>
              </div>
              <div className="flex gap-3 bg-white border border-gray-200 rounded-xl p-4">
                <span className="text-[#008d36] font-black shrink-0">→</span>
                <div><strong>Habilitação:</strong> Carteira Nacional de Habilitação (CNH) válida, com no mínimo 2 anos de habilitação. Para reservas internacionais, pode ser exigida Permissão Internacional para Dirigir (PID).</div>
              </div>
              <div className="flex gap-3 bg-white border border-gray-200 rounded-xl p-4">
                <span className="text-[#008d36] font-black shrink-0">→</span>
                <div><strong>Cartão de crédito:</strong> Para reservas pré-pagas ou que exijam caução, é necessário cartão de crédito em nome do condutor principal no momento da retirada.</div>
              </div>
              <div className="flex gap-3 bg-white border border-gray-200 rounded-xl p-4 bg-blue-50 border-blue-200">
                <span className="text-blue-600 font-black shrink-0">🇮🇹</span>
                <div><strong>Reservas na Itália:</strong> Obrigatória a apresentação de <strong>PID (Permissão Internacional para Dirigir) FÍSICA</strong> e <strong>CNH física brasileira</strong> no ato da retirada. Documentos digitais não são aceitos. A não apresentação pode resultar na recusa do veículo sem reembolso.</div>
              </div>
            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">3</span>
              Confirmação da Reserva
            </h2>
            <p className="leading-relaxed text-sm">
              A reserva é considerada confirmada após o recebimento do e-mail de confirmação com o número de reserva Europcar. O número de reserva deve ser apresentado no balcão junto com os documentos exigidos. Reservas <strong>On Request</strong> estão sujeitas à confirmação pela equipe Europcar em até 48 horas úteis.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">4</span>
              Pagamento
            </h2>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="font-bold text-gray-900 mb-2">💳 Cartão de Crédito</p>
                <p className="text-gray-500">Pagamento integral antecipado. Processado com segurança pela Cielo (PCI-DSS). Aceito Visa, Mastercard e outros.</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="font-bold text-gray-900 mb-2">🔑 PIX</p>
                <p className="text-gray-500">Pagamento antecipado via PIX. Aguarde confirmação automática do pagamento antes de receber o voucher.</p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="font-bold text-gray-900 mb-2">🏪 Pagar no Balcão</p>
                <p className="text-gray-500">Pagamento realizado diretamente na estação Europcar na retirada. Cartão de crédito exigido para caução.</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">* Tarifas internacionais são exibidas em Euro (EUR) e convertidas para BRL na data do pagamento conforme cotação vigente.</p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">5</span>
              Política de Cancelamento
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden text-sm">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 grid grid-cols-3 font-bold text-gray-600 text-xs uppercase tracking-wider">
                <div>Antecedência</div>
                <div>Taxa</div>
                <div>Observação</div>
              </div>
              {[
                { prazo: "Mais de 48h", taxa: "Sem cobrança", obs: "Reembolso integral para pré-pagos", cor: "text-green-600" },
                { prazo: "24h a 48h", taxa: "50% da 1ª diária", obs: "Aplicado para reservas pré-pagas", cor: "text-yellow-600" },
                { prazo: "Menos de 24h", taxa: "100% da 1ª diária", obs: "Inclui no-show", cor: "text-red-600" },
                { prazo: "Pagar no Balcão", taxa: "Gratuito", obs: "Cancelamento sem custo a qualquer momento", cor: "text-green-600" },
              ].map((row) => (
                <div key={row.prazo} className="px-4 py-3 grid grid-cols-3 border-b border-gray-100 last:border-0">
                  <div className="font-medium text-gray-700">{row.prazo}</div>
                  <div className={`font-bold ${row.cor}`}>{row.taxa}</div>
                  <div className="text-gray-500 text-xs">{row.obs}</div>
                </div>
              ))}
            </div>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">6</span>
              Responsabilidades do Locatário
            </h2>
            <ul className="space-y-2 text-sm">
              {[
                "Apresentar-se no balcão na data e horário da retirada com todos os documentos exigidos.",
                "Devolver o veículo nas condições originais de entrega, com o mesmo nível de combustível.",
                "Respeitar as condições gerais de uso do veículo estabelecidas pela Europcar na estação.",
                "Não conduzir o veículo fora dos países permitidos na reserva sem autorização prévia.",
                "Comunicar imediatamente qualquer acidente ou dano ao veículo à estação Europcar.",
              ].map((item) => (
                <li key={item} className="flex gap-2 bg-white border border-gray-200 rounded-lg p-3">
                  <span className="text-[#008d36] font-black shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">7</span>
              Limitação de Responsabilidade
            </h2>
            <p className="text-sm leading-relaxed">
              A Europcar Brasil atua como intermediária entre o cliente e as estações Europcar internacionais operadas pelo Europcar Groupe. Para reservas internacionais, as condições locais da estação de destino prevalecem em caso de conflito. A Europcar Brasil não se responsabiliza por alterações operacionais das estações internacionais independentes.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">8</span>
              Foro e Legislação Aplicável
            </h2>
            <p className="text-sm leading-relaxed">
              Estes Termos são regidos pelas leis brasileiras. Para resolução de conflitos, fica eleito o foro da Comarca de São Paulo — SP, com renúncia a qualquer outro, por mais privilegiado que seja. O consumidor pode também recorrer ao Sistema Nacional de Defesa do Consumidor (SNDC) e ao <a href="https://www.consumidor.gov.br" target="_blank" rel="noopener noreferrer" className="text-[#008d36] hover:underline">consumidor.gov.br</a>.
            </p>
          </section>

          {/* 9 - Contato */}
          <section>
            <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-[#008d36] text-white rounded-lg flex items-center justify-center text-sm font-black shrink-0">9</span>
              Atendimento ao Cliente
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl p-5 grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-bold text-gray-900 mb-2">📧 E-mail</p>
                <a href="mailto:reservas@europcar.com.br" className="text-[#008d36] hover:underline">reservas@europcar.com.br</a>
              </div>
              <div>
                <p className="font-bold text-gray-900 mb-2">📞 Telefone</p>
                <a href="tel:+551155420500" className="text-[#008d36] hover:underline">(11) 5542-0500</a>
              </div>
              <div>
                <p className="font-bold text-gray-900 mb-2">🕐 Horário</p>
                <p className="text-gray-500">Segunda a Sexta, 8h às 20h</p>
              </div>
              <div>
                <p className="font-bold text-gray-900 mb-2">💬 WhatsApp</p>
                <a href="https://wa.me/551155420500" target="_blank" rel="noopener noreferrer" className="text-[#008d36] hover:underline">+55 (11) 5542-0500</a>
              </div>
            </div>
          </section>
        </div>

        {/* Footer nav */}
        <div className="mt-12 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <a href="/" className="text-[#008d36] font-bold hover:underline text-sm">← Voltar ao início</a>
          <div className="flex gap-4 text-xs text-gray-400">
            <a href="/termos/privacidade" className="hover:text-gray-700 transition-colors">Política de Privacidade</a>
            <a href="/termos/cookies" className="hover:text-gray-700 transition-colors">Política de Cookies</a>
          </div>
        </div>
      </main>
    </div>
  );
}
