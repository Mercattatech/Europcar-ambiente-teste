import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de Uso do Site | Europcar Brasil",
  description:
    "Regras para o acesso e a navegação no site europcar.com.br.",
};

export default function TermosUsoPage() {
  return (
    <div style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", background: "#EDEFEC", minHeight: "100vh" }}>

      {/* ── HERO ── */}
      <div style={{ background: "#009222", padding: "48px 32px 40px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 48, flexWrap: "wrap", gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 18, color: "#FFFFFF", letterSpacing: "0.02em" }}>Europcar Brasil</span>
            <span style={{ fontSize: 13, color: "#E4F3E0", letterSpacing: "0.04em" }}>Termos de Uso do Site · v1.0</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.34em", textTransform: "uppercase", color: "#FFDC00", marginBottom: 16 }}>Time to move</div>
          <h1 style={{ margin: 0, fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 700, color: "#FFFFFF", lineHeight: 1.08, letterSpacing: "-0.025em" }}>
            Termos de Uso do Site Europcar Brasil
          </h1>
          <div style={{ height: 5, width: 76, background: "#FFDC00", margin: "20px 0" }} />
          <p style={{ margin: "0 0 40px", maxWidth: 520, fontSize: 16, lineHeight: 1.65, color: "#E4F3E0" }}>
            Regras para o acesso e a navegação no site europcar.com.br.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px 32px", paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.25)" }}>
            {[
              { label: "Versão", value: "v1.0" },
              { label: "Vigência", value: "Setembro de 2026" },
              { label: "Operadora", value: "Rental Line Locadora de Veículos Ltda" },
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

        {/* Índice */}
        <div style={{ margin: "32px 0 40px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#009222", marginBottom: 16 }}>Índice</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "10px 32px" }}>
            {[
              ["1", "Informações Gerais"],
              ["2", "Aceite dos Termos"],
              ["3", "Condições de Acesso e Uso Aceitável"],
              ["4", "Propriedade Intelectual"],
              ["5", "Segurança e Links de Terceiros"],
              ["6", "Limitação de Responsabilidade e Disponibilidade da Plataforma"],
              ["7", "Alterações nos Termos de Uso"],
              ["8", "Legislação Aplicável e Foro"],
            ].map(([n, title]) => (
              <div key={n} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: "0 8px", fontSize: 14, lineHeight: 1.5, color: "#20301F" }}>
                <span style={{ color: "#009222", fontWeight: 700 }}>{n}</span>
                <span>{title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Seção 1 */}
        <SectionTitle n="1" title="Informações Gerais" />
        <p style={pStyle}>
          Bem-vindo ao site europcar.com.br. Esta plataforma digital é operada e mantida pela Europcar Brasil, sob a gestão da Rental Line Locadora de Veículos Ltda. Estes Termos de Uso estabelecem as regras para o acesso e a navegação neste site. O uso comercial dos nossos serviços de locação é regido separadamente pelos nossos &ldquo;Termos e Condições de Reserva&rdquo;.
        </p>

        {/* Seção 2 */}
        <SectionTitle n="2" title="Aceite dos Termos" />
        <p style={pStyle}>
          Ao acessar, navegar ou utilizar qualquer funcionalidade do site europcar.com.br, o usuário declara ter lido, compreendido e concordado expressamente com estes Termos de Uso. Caso não concorde com qualquer disposição aqui presente, solicitamos que interrompa imediatamente o uso da plataforma.
        </p>

        {/* Seção 3 */}
        <SectionTitle n="3" title="Condições de Acesso e Uso Aceitável" />
        <p style={{ ...pStyle, marginBottom: 16 }}>
          O usuário compromete-se a utilizar o site de boa-fé e de acordo com a legislação brasileira vigente. É terminantemente proibido:
        </p>
        <div style={{ display: "grid", gap: 12, marginBottom: 32 }}>
          {[
            "Utilizar robôs, spiders, crawlers, scrapers ou qualquer outro meio automatizado para acessar, copiar ou extrair dados do site (incluindo preços e disponibilidade de frota) sem autorização prévia e por escrito.",
            "Tentar contornar, desativar ou interferir em recursos de segurança da plataforma.",
            "Inserir códigos maliciosos, vírus ou praticar ações que imponham uma carga desproporcional à infraestrutura do site.",
            "Utilizar a plataforma para fins fraudulentos, ilícitos ou para falsidade ideológica no momento do cadastro.",
          ].map((item, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: "0 12px", fontSize: 15.5, lineHeight: 1.65, color: "#20301F" }}>
              <span style={{ color: "#D32F2F", fontWeight: 700 }}>✕</span>
              <span>{item}</span>
            </div>
          ))}
        </div>

        {/* Seção 4 */}
        <SectionTitle n="4" title="Propriedade Intelectual" />
        <p style={pStyle}>
          Todo o conteúdo disponibilizado no site — incluindo, mas não se limitando a, logotipos, marcas (especialmente a marca Europcar), textos, fotografias, layout, design, códigos-fonte e softwares — é de propriedade exclusiva da Europcar Brasil ou de seus licenciantes. O uso da plataforma não confere ao usuário qualquer direito de propriedade intelectual sobre o seu conteúdo. A reprodução, distribuição, modificação ou engenharia reversa sem autorização expressa constituem violação das leis de direitos autorais e propriedade industrial.
        </p>

        {/* Seção 5 */}
        <SectionTitle n="5" title="Segurança e Links de Terceiros" />
        <p style={pStyle}>
          Nosso site pode conter links para plataformas de terceiros para viabilizar a prestação de serviços. Para o processamento de pagamentos e pré-autorizações, o site integra-se de forma segura a plataformas parceiras e adquirentes homologados. A Europcar Brasil não se responsabiliza pelas políticas de privacidade ou pelos termos de uso dessas plataformas terceiras, operando o site em conformidade com o padrão de segurança para não armazenar dados integrais de cartão de crédito em seus próprios servidores.
        </p>

        {/* Seção 6 */}
        <SectionTitle n="6" title="Limitação de Responsabilidade e Disponibilidade da Plataforma" />
        <p style={{ ...pStyle, marginBottom: 16 }}>
          A Europcar Brasil envida seus melhores esforços técnicos para manter o site disponível de forma contínua e segura. No entanto, a plataforma é oferecida &ldquo;no estado em que se encontra&rdquo; (<em>as is</em>). Não garantimos que o site funcionará de forma ininterrupta ou livre de erros. A Europcar Brasil exime-se de responsabilidade por:
        </p>
        <div style={{ display: "grid", gap: 12, marginBottom: 32 }}>
          {[
            "Indisponibilidades temporárias decorrentes de manutenção, problemas na rede de internet ou falhas nos servidores.",
            "Danos causados por ataques cibernéticos ou softwares maliciosos que possam infectar o equipamento do usuário durante a navegação.",
            "Erros manifestos de digitação ou falhas sistêmicas na exibição de tarifas promocionais ou disponibilidade de veículos, reservando-nos o direito de corrigir tais inconsistências sem aviso prévio.",
          ].map((item, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: "0 12px", fontSize: 15.5, lineHeight: 1.65, color: "#20301F" }}>
              <span style={{ color: "#009222", fontWeight: 700 }}>·</span>
              <span>{item}</span>
            </div>
          ))}
        </div>

        {/* Seção 7 */}
        <SectionTitle n="7" title="Alterações nos Termos de Uso" />
        <p style={pStyle}>
          Reservamo-nos o direito de modificar estes Termos de Uso a qualquer momento, para refletir melhorias na plataforma ou mudanças na legislação. A versão atualizada estará sempre disponível no rodapé do site, e o uso contínuo da plataforma após a publicação constituirá a aceitação das novas regras.
        </p>

        {/* Seção 8 */}
        <SectionTitle n="8" title="Legislação Aplicável e Foro" />
        <p style={{ ...pStyle, marginBottom: 40 }}>
          Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. Para dirimir quaisquer controvérsias decorrentes da navegação ou uso deste site, fica eleito o foro da Comarca de São Paulo - SP, com renúncia a qualquer outro, por mais privilegiado que seja.
        </p>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, paddingTop: 16, marginTop: 32, borderTop: "1px solid #D8E0D6", fontSize: 12, color: "#5A6259", flexWrap: "wrap" }}>
          <span>Europcar Brasil · Rental Line Locadora de Veículos Ltda</span>
          <span>Termos de Uso do Site · v1.0 · Vigência Setembro de 2026</span>
        </div>
      </div>
    </div>
  );
}

/* ── helpers ── */

const pStyle: React.CSSProperties = { margin: "0 0 16px", fontSize: 15.5, lineHeight: 1.65, color: "#20301F" };

function SectionTitle({ n, title }: { n: string; title: string }) {
  return (
    <div style={{ marginTop: 40, marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#009222" }}>Seção {n}</div>
      <h2 style={{ margin: "9px 0 0", fontSize: "clamp(18px, 3vw, 22px)", fontWeight: 700, letterSpacing: "-0.015em", color: "#101F12", lineHeight: 1.2 }}>{title}</h2>
      <div style={{ height: 3, width: 44, background: "#FFDC00", marginTop: 13 }} />
    </div>
  );
}
