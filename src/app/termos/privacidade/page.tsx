import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso de Privacidade · LGPD | Europcar Brasil",
  description:
    "Como a Europcar Brasil coleta, utiliza, compartilha e protege os dados pessoais dos seus clientes, nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018).",
};

export default function PrivacidadePage() {
  return (
    <div style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", background: "#EDEFEC", minHeight: "100vh" }}>

      {/* ── HERO ── */}
      <div style={{ background: "#009222", padding: "48px 32px 40px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 48, flexWrap: "wrap", gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 18, color: "#FFFFFF", letterSpacing: "0.02em" }}>Europcar Brasil</span>
            <span style={{ fontSize: 13, color: "#E4F3E0", letterSpacing: "0.04em" }}>Aviso de Privacidade · LGPD</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.34em", textTransform: "uppercase", color: "#FFDC00", marginBottom: 16 }}>Time to move</div>
          <h1 style={{ margin: 0, fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 700, color: "#FFFFFF", lineHeight: 1.05, letterSpacing: "-0.025em" }}>
            Aviso de Privacidade
          </h1>
          <div style={{ height: 5, width: 76, background: "#FFDC00", margin: "20px 0" }} />
          <p style={{ margin: "0 0 40px", maxWidth: 520, fontSize: 16, lineHeight: 1.65, color: "#E4F3E0" }}>
            Como a Europcar Brasil coleta, utiliza, compartilha e protege os dados pessoais dos seus clientes, nos termos da Lei Geral de Proteção de Dados.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px 32px", paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.25)" }}>
            {[
              { label: "Documento", value: "LGPD · Lei nº 13.709/2018" },
              { label: "Última atualização", value: "Setembro de 2026" },
              { label: "Aplicável a", value: "Brasil · europcar.com.br" },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#FFDC00", marginBottom: 6 }}>{label}</div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.35 }}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTEÚDO ── */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 24px 64px" }}>

        {/* Resumo */}
        <div style={{ background: "#F3F8F1", borderTop: "3px solid #FFDC00", padding: "20px 24px", margin: "32px 0" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#009222", marginBottom: 10 }}>
            Última atualização · Setembro de 2026
          </div>
          <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.65, color: "#20301F" }}>
            A Europcar Brasil, ao processar seus dados pessoais na locação de um veículo, segue rigorosamente a{" "}
            <strong>Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — &ldquo;LGPD&rdquo;)</strong>. Este Aviso explica, em linguagem direta, quais dados coletamos, por quê, por quanto tempo, e como você exerce seus direitos.
          </p>
        </div>

        {/* Índice */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#009222", marginBottom: 16 }}>Índice</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "10px 32px" }}>
            {[
              ["1", "Quem é o controlador dos seus dados"],
              ["2", "Quais dados coletamos"],
              ["3", "Por que tratamos seus dados, e com que base legal"],
              ["4", "Com quem compartilhamos seus dados"],
              ["5", "Por quanto tempo mantemos seus dados"],
              ["6", "Veículos conectados e telemetria"],
              ["7", "Cadastro interno de prevenção a fraude"],
              ["8", "Seus direitos"],
              ["9", "Como exercer seus direitos e falar com o Encarregado"],
              ["10", "Alterações a este Aviso"],
            ].map(([n, title]) => (
              <div key={n} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: "0 8px", fontSize: 14, lineHeight: 1.5, color: "#20301F" }}>
                <span style={{ color: "#009222", fontWeight: 700 }}>{n}</span>
                <span>{title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Seção helper */}
        {/* Seção 1 */}
        <SectionTitle n="1" title="Quem é o controlador dos seus dados" />
        <p style={p}>
          A <strong>Rental Line Locadora Ltda.</strong> (CNPJ nº 00.938.766/0001-11, com sede na Av. Morumbi, 8653, Brooklin, CEP 04703-004, São Paulo — SP), na qualidade de franqueadora master da marca no país, é a controladora responsável pelas diretrizes gerais de tratamento de dados pessoais.
        </p>
        <p style={p}>
          No momento da locação ou atendimento, a execução do serviço e o respectivo tratamento operacional também são compartilhados com o franqueado local operador da agência escolhida — o qual possui obrigações contratuais estritas de conformidade com a LGPD.
        </p>

        {/* Seção 2 */}
        <SectionTitle n="2" title="Quais dados coletamos" />
        <ul style={{ margin: "0 0 8px", padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
          {[
            ["Dados de identificação:", "nome, CPF, RG ou documento equivalente, data de nascimento, endereço, telefone, e-mail."],
            ["Dados de habilitação:", "número, categoria e validade da CNH, tempo de habilitação."],
            ["Dados de pagamento:", "dados do cartão de crédito utilizado na pré-autorização, processados por meio de parceiro de pagamento; não armazenamos o número completo do cartão."],
            ["Dados da locação:", "veículo alugado, datas, quilometragem, proteções contratadas, ocorrências durante o período."],
            ["Dados de condutores adicionais e responsável financeiro,", "quando indicados por você."],
            ["Dados do veículo conectado,", "quando o veículo dispuser de telemetria — ver Seção 6."],
            ["Dados de navegação,", "se você reservar ou interagir com a Europcar Brasil pelo site ou aplicativo (cookies, endereço IP, páginas visitadas), tratados conforme a política de cookies do site."],
          ].map(([bold, rest]) => (
            <li key={bold as string} style={{ ...p, margin: 0 }}>
              <strong>{bold}</strong> {rest}
            </li>
          ))}
        </ul>

        {/* Seção 3 */}
        <SectionTitle n="3" title="Por que tratamos seus dados, e com que base legal" />
        <div style={{ overflowX: "auto", marginBottom: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14.5, lineHeight: 1.5 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "10px 14px", background: "#009222", color: "#FFF", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", width: "56%" }}>Finalidade</th>
                <th style={{ textAlign: "left", padding: "10px 14px", background: "#009222", color: "#FFF", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Base legal</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Formalizar e executar o Contrato de Locação", "Execução de contrato — Art. 7º, V"],
                ["Verificar sua habilitação e elegibilidade para dirigir", "Execução de contrato — Art. 7º, V"],
                ["Cobrar valores devidos, processar pagamentos e a pré-autorização", "Execução de contrato — Art. 7º, V"],
                ["Cumprir obrigações com órgãos de trânsito (indicação de condutor infrator)", "Obrigação legal ou regulatória — Art. 7º, II"],
                ["Gerir o cadastro interno de prevenção a fraude e gestão de risco", "Legítimo interesse — Art. 7º, IX"],
                ["Localizar o veículo em caso de furto, roubo ou não devolução", "Legítimo interesse — Art. 7º, IX"],
                ["Enviar comunicações sobre sua reserva ou locação em andamento", "Legítimo interesse — Art. 7º, IX"],
                ["Enviar ofertas, promoções e comunicações de marketing", "Consentimento — Art. 7º, I. Você pode retirá-lo a qualquer momento."],
                ["Reporte, auditoria e gestão de marca perante a franqueadora master", "Legítimo interesse e execução de contrato de franquia — Art. 7º, IX"],
                ["Cumprir determinação de autoridade judicial ou administrativa", "Obrigação legal — Art. 7º, II"],
              ].map(([fin, base], i) => (
                <tr key={fin} style={{ background: i % 2 === 1 ? "#F3F8F1" : "#FFF" }}>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid #DCE5DA", color: "#101F12", fontWeight: 700, verticalAlign: "top" }}>{fin}</td>
                  <td style={{ padding: "11px 14px", borderBottom: "1px solid #DCE5DA", color: "#20301F", verticalAlign: "top" }}>{base}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin: "0 0 32px", fontSize: 12, color: "#5A6259" }}>Referências de artigos conforme a Lei nº 13.709/2018 (LGPD).</p>

        {/* Seção 4 */}
        <SectionTitle n="4" title="Com quem compartilhamos seus dados" />
        <ul style={{ margin: "0 0 16px", padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
          {[
            "Empresas da Rede Europcar Brasil e suas franqueadas, para viabilizar a locação em diferentes praças e a eventual troca de veículo entre agências.",
            <><strong>Europcar Internacional</strong> (franqueadora master global), para gestão de marca, auditoria da rede franqueada, prevenção a fraude em escala internacional e reporte corporativo, observadas as salvaguardas de transferência internacional previstas na LGPD.</>,
            "Autoridades de trânsito, para cumprimento da indicação de condutor infrator.",
            "Instituições financeiras e adquirentes de cartão, para processar pagamentos e a pré-autorização.",
            "Prestadores de serviço da Europcar Brasil, como empresas de assistência 24 horas, guincho e telemetria, estritamente para a execução desses serviços.",
            "Autoridades públicas, mediante obrigação legal ou ordem judicial.",
          ].map((item, i) => (
            <li key={i} style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: "0 12px", ...p, margin: 0 }}>
              <span style={{ color: "#009222", fontWeight: 700 }}>·</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div style={{ background: "#F3F8F1", padding: "16px 20px", marginBottom: 32 }}>
          <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "#101F12" }}>Não vendemos seus dados pessoais a terceiros.</p>
        </div>

        {/* Seção 5 */}
        <SectionTitle n="5" title="Por quanto tempo mantemos seus dados" />
        <p style={p}>
          Mantemos seus dados pelo tempo necessário ao cumprimento das finalidades acima, observados os prazos legais aplicáveis — por exemplo, o prazo prescricional de eventuais ações decorrentes do Contrato, e o prazo de guarda de documentos fiscais exigido pela legislação tributária. Findos esses prazos, os dados são eliminados ou anonimizados.
        </p>

        {/* Seção 6 */}
        <SectionTitle n="6" title="Veículos conectados e telemetria" />
        <p style={{ ...p, marginBottom: 16 }}>O veículo alugado pode dispor de sistema de telemetria ou rastreamento, usado para:</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginBottom: 16 }}>
          {[
            "Gerir a locação (quilometragem, nível de combustível, manutenção)",
            "Localizar o veículo em caso de furto, roubo, apropriação indébita ou não devolução no prazo",
            "Identificar o uso do veículo fora do território autorizado ou em desacordo com o Contrato",
            "Apurar acidentes e avarias",
          ].map((item) => (
            <div key={item} style={{ borderTop: "1px solid #DCE5DA", paddingTop: 10, fontSize: 14.5, lineHeight: 1.5, color: "#20301F" }}>{item}</div>
          ))}
        </div>
        <p style={p}>Esses dados podem ser usados durante e após o período da locação, pelo tempo necessário à apuração de eventual evento danoso.</p>

        {/* Seção 7 */}
        <SectionTitle n="7" title="Cadastro interno de prevenção a fraude e gestão de risco" />
        <p style={p}>
          Mantemos um cadastro interno, de uso exclusivo da Rede Europcar Brasil, para identificar clientes que apresentem risco à operação, com base em critérios objetivos de inadimplemento, reincidência em avarias, conduta abusiva ou descumprimento contratual anterior.{" "}
          <strong>Este cadastro não é compartilhado com outras locadoras de mercado.</strong>
        </p>

        {/* Seção 8 */}
        <SectionTitle n="8" title="Seus direitos" />
        <p style={{ ...p, marginBottom: 16 }}>
          Nos termos do <strong>artigo 18 da LGPD</strong>, você pode solicitar a qualquer momento:
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, marginBottom: 32 }}>
          {[
            "Confirmação de tratamento e acesso aos dados",
            "Portabilidade a outro fornecedor",
            "Correção de dados incompletos ou desatualizados",
            "Eliminação de dados tratados com consentimento",
            "Anonimização, bloqueio ou eliminação de dados desnecessários",
            "Informações sobre o compartilhamento",
            "Oposição a tratamentos baseados em legítimo interesse",
          ].map((item) => (
            <div key={item} style={{ borderTop: "1px solid #DCE5DA", paddingTop: 10, fontSize: 14.5, lineHeight: 1.5, color: "#20301F" }}>{item}</div>
          ))}
        </div>

        {/* Seção 9 */}
        <SectionTitle n="9" title="Como exercer seus direitos e falar com o Encarregado" />
        <p style={p}>
          Para esclarecer dúvidas, solicitar atualizações ou exercer qualquer um dos seus direitos previstos na LGPD, você pode entrar em contato com o Encarregado de Proteção de Dados da Rental Line Locadora pelos canais oficiais indicados ao final deste Aviso.
        </p>
        <p style={p}>
          Responderemos à sua solicitação dentro do prazo legal aplicável. Você também tem o direito de apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD) em{" "}
          <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" style={{ color: "#009222" }}>www.gov.br/anpd</a>.
        </p>

        {/* Seção 10 */}
        <SectionTitle n="10" title="Alterações a este Aviso" />
        <p style={{ ...p, marginBottom: 40 }}>
          Este Aviso pode ser atualizado para refletir mudanças em nossas práticas ou na legislação. Alterações relevantes serão comunicadas pelos canais de contato fornecidos por você.
        </p>

        {/* DPO Box */}
        <div style={{ background: "#009222", padding: "28px 32px", borderRadius: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#FFDC00", marginBottom: 14 }}>
            Encarregado de Proteção de Dados (DPO) · Rental Line Locadora
          </div>
          <div style={{ height: 3, width: 44, background: "#FFDC00", marginBottom: 20 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "20px 32px" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#FFDC00", marginBottom: 6 }}>E-mail</div>
              <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "#FFF" }}>sac@europcar.com.br</p>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#FFDC00", marginBottom: 6 }}>Endereço físico</div>
              <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "#FFF", lineHeight: 1.4 }}>
                Av. Morumbi, 8653 — Brooklin<br />CEP 04703-004, São Paulo — SP
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#E4F3E0" }}>Aos cuidados da governança de dados da Rental Line Locadora.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, paddingTop: 16, marginTop: 32, borderTop: "1px solid #D8E0D6", fontSize: 12, color: "#5A6259" }}>
          <span>Europcar Brasil · Aviso de Privacidade</span>
          <span>Setembro de 2026</span>
        </div>
      </div>
    </div>
  );
}

/* ── helpers ── */
const p: React.CSSProperties = { margin: "0 0 16px", fontSize: 15.5, lineHeight: 1.65, color: "#20301F" };

function SectionTitle({ n, title }: { n: string; title: string }) {
  return (
    <div style={{ marginTop: 40, marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#009222" }}>Seção {n}</div>
      <h2 style={{ margin: "9px 0 0", fontSize: "clamp(18px, 3vw, 22px)", fontWeight: 700, letterSpacing: "-0.015em", color: "#101F12", lineHeight: 1.2 }}>{title}</h2>
      <div style={{ height: 3, width: 44, background: "#FFDC00", marginTop: 13 }} />
    </div>
  );
}
