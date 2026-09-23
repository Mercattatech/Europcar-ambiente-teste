import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Cookies | Europcar Brasil",
  description:
    "Como a Europcar Brasil utiliza cookies e tecnologias semelhantes no site europcar.com.br.",
};

export default function CookiesPage() {
  return (
    <div style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", background: "#EDEFEC", minHeight: "100vh" }}>

      {/* ── HERO ── */}
      <div style={{ background: "#009222", padding: "48px 32px 40px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 48, flexWrap: "wrap", gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 18, color: "#FFFFFF", letterSpacing: "0.02em" }}>Europcar Brasil</span>
            <span style={{ fontSize: 13, color: "#E4F3E0", letterSpacing: "0.04em" }}>Política de Cookies · v1.0</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.34em", textTransform: "uppercase", color: "#FFDC00", marginBottom: 16 }}>Time to move</div>
          <h1 style={{ margin: 0, fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 700, color: "#FFFFFF", lineHeight: 1.08, letterSpacing: "-0.025em" }}>
            Política de Cookies – Europcar Brasil
          </h1>
          <div style={{ height: 5, width: 76, background: "#FFDC00", margin: "20px 0" }} />
          <p style={{ margin: "0 0 40px", maxWidth: 520, fontSize: 16, lineHeight: 1.65, color: "#E4F3E0" }}>
            Como utilizamos cookies e tecnologias semelhantes no site europcar.com.br.
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

        {/* Introdução */}
        <div style={{ background: "#F3F8F1", borderTop: "3px solid #FFDC00", padding: "20px 24px", margin: "32px 0" }}>
          <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.65, color: "#20301F" }}>
            A Europcar Brasil, gerida pela Rental Line Locadora de Veículos Ltda, utiliza cookies e tecnologias semelhantes no site europcar.com.br para garantir o funcionamento adequado da plataforma, melhorar a sua experiência de navegação e personalizar anúncios.
          </p>
        </div>

        {/* Seção 1 */}
        <SectionTitle n="1" title="O que são cookies?" />
        <p style={pStyle}>
          Cookies são pequenos arquivos de texto baixados no seu dispositivo (computador ou smartphone) quando você visita o nosso site. Eles permitem que a plataforma memorize suas ações e preferências (como login, idioma e itens da reserva) por um determinado período.
        </p>

        {/* Seção 2 */}
        <SectionTitle n="2" title="Tipos de cookies que utilizamos" />
        <div style={{ display: "grid", gap: 20, marginBottom: 32 }}>
          <CookieType
            name="Cookies Estritamente Necessários (Essenciais)"
            description="São fundamentais para que o site funcione, permitindo que você navegue e utilize recursos como o carrinho de reserva e o ambiente seguro de pagamento. Não podem ser desativados."
            color="#009222"
          />
          <CookieType
            name="Cookies Analíticos (Desempenho)"
            description="Ajudam-nos a entender como os visitantes interagem com o site, fornecendo informações sobre as áreas visitadas, o tempo gasto no site e quaisquer problemas encontrados, como mensagens de erro."
            color="#2563EB"
          />
          <CookieType
            name="Cookies de Marketing (Publicidade)"
            description="São utilizados para rastrear os visitantes pelos sites. A intenção é exibir anúncios que sejam relevantes e envolventes para o usuário individual."
            color="#D97706"
          />
        </div>

        {/* Seção 3 */}
        <SectionTitle n="3" title="Como gerenciar os seus cookies" />
        <p style={pStyle}>
          Ao acessar nosso site pela primeira vez, você foi convidado a configurar suas preferências através do nosso Banner de Cookies. Você pode alterar essa escolha a qualquer momento clicando em &ldquo;Gerenciar Cookies&rdquo; no rodapé do site. Além disso, a maioria dos navegadores permite que você bloqueie ou apague cookies através das configurações de privacidade de seu navegador.
        </p>

        {/* Seção 4 */}
        <SectionTitle n="4" title="Contato" />
        <p style={{ ...pStyle, marginBottom: 40 }}>
          Se tiver dúvidas sobre o uso de cookies em nosso site, entre em contato através do e-mail de privacidade detalhado em nosso{" "}
          <a href="/termos/privacidade" style={{ color: "#009222", textDecoration: "underline", textUnderlineOffset: 2 }}>Aviso de Privacidade</a>.
        </p>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, paddingTop: 16, marginTop: 32, borderTop: "1px solid #D8E0D6", fontSize: 12, color: "#5A6259", flexWrap: "wrap" }}>
          <span>Europcar Brasil · Rental Line Locadora de Veículos Ltda</span>
          <span>Política de Cookies · v1.0 · Vigência Setembro de 2026</span>
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

function CookieType({ name, description, color }: { name: string; description: string; color: string }) {
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #DCE5DA", borderRadius: 6, padding: "20px 24px", borderLeft: `4px solid ${color}` }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#101F12", lineHeight: 1.3 }}>{name}</h3>
      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "#20301F" }}>{description}</p>
    </div>
  );
}
