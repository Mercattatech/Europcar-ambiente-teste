import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Termos e Condições Gerais de Locação | Europcar Brasil",
  description: "Condições gerais aplicáveis à locação de veículos da Europcar Brasil, complementares ao Contrato de Locação de Veículos.",
};

/* ── style tokens ── */
const G = "#009222"; const Y = "#FFDC00"; const T = "#20301F"; const H = "#101F12";
const ps: React.CSSProperties = { margin: "0 0 16px", fontSize: 15.5, lineHeight: 1.65, color: T };

/* ── reusable pieces ── */
function Lbl({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: G, marginBottom: 16 }}>{children}</div>;
}
function BTitle({ n, title }: { n: string; title: string }) {
  return (<div style={{ marginTop: 48, marginBottom: 20 }}><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: G }}>Bloco {n}</div><h2 style={{ margin: "9px 0 0", fontSize: "clamp(18px,3vw,22px)", fontWeight: 700, letterSpacing: "-0.015em", color: H, lineHeight: 1.2 }}>{title}</h2><div style={{ height: 3, width: 44, background: Y, marginTop: 13 }} /></div>);
}
function Cl({ n, children }: { n: string; children: React.ReactNode }) {
  return (<div style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: "0 8px", margin: "0 0 14px", fontSize: 15.5, lineHeight: 1.65, color: T }}><span style={{ color: G, fontWeight: 700, fontSize: 13 }}>{n}</span><span>{children}</span></div>);
}
function Tbl({ heads, rows }: { heads: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div style={{ overflowX: "auto", marginBottom: 24 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, lineHeight: 1.45 }}>
        <thead><tr>{heads.map((h, i) => <th key={i} style={{ textAlign: "left", padding: "10px 12px", background: G, color: "#FFF", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, ri) => <tr key={ri} style={{ background: ri % 2 === 1 ? "#F3F8F1" : "#FFF" }}>{r.map((c, ci) => <td key={ci} style={{ padding: "10px 12px", borderBottom: "1px solid #DCE5DA", color: T, verticalAlign: "top" }}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
function Note({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "#FFF", border: "1px solid #DCE5DA", borderLeft: "4px solid #D97706", borderRadius: 6, padding: "16px 20px", margin: "0 0 20px" }}><p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: T }}>{children}</p></div>;
}
function Warn({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "16px 20px", margin: "0 0 20px" }}><p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "#7F1D1D" }}>{children}</p></div>;
}

export default function LocacaoTermosPage() {
  return (
    <div style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", background: "#EDEFEC", minHeight: "100vh" }}>
      {/* HERO */}
      <div style={{ background: G, padding: "48px 32px 40px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 48, flexWrap: "wrap", gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 18, color: "#FFF", letterSpacing: "0.02em" }}>Europcar Brasil</span>
            <span style={{ fontSize: 13, color: "#E4F3E0", letterSpacing: "0.04em" }}>Termos e Condições Gerais de Locação · v3</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.34em", textTransform: "uppercase", color: Y, marginBottom: 16 }}>Time to move</div>
          <h1 style={{ margin: 0, fontSize: "clamp(26px,5vw,42px)", fontWeight: 700, color: "#FFF", lineHeight: 1.08, letterSpacing: "-0.025em" }}>Termos e Condições Gerais de Locação</h1>
          <div style={{ height: 5, width: 76, background: Y, margin: "20px 0" }} />
          <p style={{ margin: "0 0 40px", maxWidth: 600, fontSize: 16, lineHeight: 1.65, color: "#E4F3E0" }}>Condições gerais aplicáveis à locação de veículos da Europcar Brasil, complementares ao Contrato de Locação de Veículos.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "16px 32px", paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.25)" }}>
            {[["Versão","v3"],["Vigência","Setembro de 2026"],["Aplicável a","Brasil · europcar.com.br"]].map(([l,v])=>(
              <div key={l}><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: Y, marginBottom: 6 }}>{l}</div><p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#FFF", lineHeight: 1.35 }}>{v}</p></div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 64px" }}>
        {/* Intro */}
        <div style={{ background: "#F3F8F1", borderTop: "3px solid "+Y, padding: "20px 24px", margin: "32px 0" }}>
          <p style={{ ...ps, margin: "0 0 12px" }}>Pelo presente instrumento particular de Termos e Condições Gerais de Locação de Veículos (&ldquo;TERMOS E CONDIÇÕES&rdquo;), ficam estabelecidas as regras comerciais, os valores, os prazos e os parâmetros operacionais que disciplinam a locação de veículos realizada pelas empresas da Rede EUROPCAR BRASIL.</p>
          <p style={{ ...ps, margin: "0 0 12px" }}>Estes TERMOS E CONDIÇÕES são parte integrante do Contrato de Locação de Veículos (&ldquo;CONTRATO&rdquo;) e com ele devem ser interpretados de forma conjunta. Em caso de contradição entre os dois documentos, prevalece o CONTRATO, ressalvada a disposição destes TERMOS E CONDIÇÕES que for mais favorável ao CLIENTE — hierarquia fixada na cláusula 2.2 do CONTRATO.</p>
          <p style={{ ...ps, margin: 0 }}>Aplica-se a cada locação a versão destes TERMOS E CONDIÇÕES vigente na data de abertura do Demonstrativo do Contrato de Locação. Alterações são comunicadas ao CLIENTE com antecedência mínima de 15 (quinze) dias, facultado a este encerrar a locação sem ônus em caso de discordância, na forma da cláusula 2.3 do CONTRATO.</p>
        </div>

        {/* Índice */}
        <div style={{ marginBottom: 40 }}>
          <Lbl>Índice</Lbl>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "10px 32px" }}>
            {[["1","Requisitos para locação"],["2","Reserva, não comparecimento e cancelamento"],["3","Adicionais e serviços"],["4","Prazos, modalidades e quilometragem"],["5","Proteções"],["6","Tabela de valores, coparticipação e caução (ACRISS)"],["7","Garantia, pré-autorização e estorno"],["8","Devolução, combustível e limpeza"],["9","Veículos elétricos e híbridos plug-in"],["10","Encargos de circulação e infrações"],["11","Restrições de uso"],["12","Em caso de sinistro — prazos de comunicação"],["13","Rescisão e retomada"],["14","Canais de atendimento"]].map(([n,t])=>(
              <div key={n} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: "0 8px", fontSize: 14, lineHeight: 1.5, color: T }}><span style={{ color: G, fontWeight: 700 }}>{n}</span><span>{t}</span></div>
            ))}
          </div>
        </div>

        {/* ═══ BLOCO 1 ═══ */}
        <BTitle n="1" title="Requisitos para locação" />
        <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: G }}>1.1 Perfil obrigatório</h3>
        <p style={ps}>A locação pressupõe dois papéis, que podem coincidir na mesma pessoa ou ser distribuídos entre pessoas diferentes:</p>
        <div style={{ borderLeft: "3px solid "+G, paddingLeft: 16, marginBottom: 12 }}>
          <p style={ps}><strong>CLIENTE (contratante):</strong> identificado mediante documento oficial de identidade e CPF originais. É o único responsável, em qualquer hipótese, pelas obrigações financeiras da locação. Não precisa deter Carteira Nacional de Habilitação, salvo se também for o CONDUTOR do veículo.</p>
          <p style={ps}><strong>CONDUTOR:</strong> quem efetivamente dirigirá o veículo — pode ser o próprio CLIENTE ou terceiro por ele indicado. Deve reunir, cumulativamente: idade mínima de 21 anos completos; Carteira Nacional de Habilitação definitiva, válida, emitida há mais de 2 anos, em categoria compatível com o veículo; aptidão para conduzir, sem suspensão ou cassação — ressalvada a hipótese de Condutor Jovem, item 1.4.</p>
        </div>
        <p style={ps}>Toda locação deve ter, no mínimo, um CONDUTOR indicado que atenda aos requisitos acima, ainda que este não se confunda com o CLIENTE.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12, marginBottom: 20 }}>
          {[["Garantia","Cartão de crédito físico, apto à constituição da pré-autorização (ver bloco 7), em nome do CLIENTE."],["Análise","Aprovação prévia em análise cadastral e de crédito."],["Residência","Comprovante de residência, para residentes no Brasil."]].map(([t,d])=>(
            <div key={t} style={{ borderTop: "1px solid #DCE5DA", paddingTop: 10 }}><div style={{ fontSize: 11, fontWeight: 700, color: G, marginBottom: 4 }}>{t}</div><p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: T }}>{d}</p></div>
          ))}
        </div>

        <h3 style={{ margin: "24px 0 12px", fontSize: 16, fontWeight: 700, color: G }}>1.2 Condutores adicionais</h3>
        <p style={ps}>Podem ser indicados condutores adicionais em número ilimitado, mediante pagamento da tarifa do bloco 3, por condutor. Cada condutor deve atender aos mesmos requisitos do item 1.1 aplicáveis ao CONDUTOR, estar presente na retirada e assinar o Demonstrativo. As proteções contratadas estendem-se aos condutores regularmente indicados e aprovados.</p>

        <h3 style={{ margin: "24px 0 12px", fontSize: 16, fontWeight: 700, color: G }}>1.3 Cliente estrangeiro</h3>
        {["Passaporte original e visto válido, quando exigível, ou Registro Nacional Migratório.","Documento que comprove a data de entrada em território nacional.","Habilitação estrangeira original e válida. Se redigida em alfabeto não latino, acompanhada de tradução.","Idade mínima e demais requisitos do item 1.1 aplicáveis ao CONDUTOR, exceto comprovante de residência no Brasil."].map((item,i)=>(
          <div key={i} style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: "0 12px", ...ps, margin: "0 0 8px" }}><span style={{ color: G, fontWeight: 700 }}>·</span><span>{item}</span></div>
        ))}

        <h3 style={{ margin: "24px 0 12px", fontSize: 16, fontWeight: 700, color: G }}>1.4 Condutor Jovem (Young Driver), categoria BLINDADO e cadastro de risco</h3>
        <p style={ps}>Modalidade excepcional, informada de forma clara no ato da reserva e sujeita a consulta prévia de disponibilidade na agência de retirada.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12, marginBottom: 16 }}>
          {[["Faixa etária","De 19 anos completos a 21 anos incompletos; ou condutor de qualquer idade com habilitação definitiva emitida há menos de 2 anos."],["Habilitação","Definitiva emitida há, no mínimo, 12 meses."],["Exigência","Contratação obrigatória e cumulativa das coberturas LDW e TPL (Proteção Básica com TPL)."],["Taxa","Taxa de Condutor Jovem, conforme bloco 3."]].map(([t,d])=>(
            <div key={t} style={{ borderTop: "1px solid #DCE5DA", paddingTop: 10 }}><div style={{ fontSize: 11, fontWeight: 700, color: G, marginBottom: 4 }}>{t}</div><p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: T }}>{d}</p></div>
          ))}
        </div>
        <p style={ps}><strong>Grupos elegíveis:</strong> EDMR, CDMR, DDMR, CXMR, CDAR. É vedada a locação, nesta modalidade, dos demais códigos ACRISS, incluindo IDMR, ICMR, IDAR, CGAR, IFAR, SWAR, SDAR, SVMR, SVAR, PDAR, CPMR, CKMR, CDAE, IQMR, IQAR, SFAR, PDAH, PFAR, FQND, FQBD, XQBD e a categoria BLINDADO.</p>
        <p style={ps}><strong>Categoria BLINDADO:</strong> Idade mínima de 26 anos completos, em substituição ao requisito geral de 21 anos.</p>
        <p style={ps}><strong>Cadastro interno de prevenção a fraude e gestão de risco:</strong> Clientes incluídos no cadastro ficam sujeitos à recusa de nova solicitação de reserva ainda não confirmada ou locação de balcão. Reservas previamente confirmadas não são afetadas. É garantido o direito de contestação da inclusão no cadastro no prazo de 10 dias.</p>

        {/* ═══ BLOCO 2 ═══ */}
        <BTitle n="2" title="Reserva, não comparecimento e cancelamento" />
        <p style={ps}>O veículo permanece reservado por 1 (uma) hora após o horário previsto para retirada, observado o horário de funcionamento da agência.</p>
        <Tbl heads={["Item","Condição","Valor"]} rows={[
          [<strong>Taxa de Não Comparecimento</strong>,"Não comparecimento após 59 minutos do horário reservado","10% do valor total da reserva"],
          [<strong>Taxa de Cancelamento</strong>,"Cancelamento com menos de 48 horas da retirada","R$ 250,00"],
          [<strong>Cancelamento sem ônus</strong>,"Com 48 horas ou mais de antecedência","Isento"],
          [<strong>Força maior</strong>,"Mediante comprovação (ver restrições abaixo)","Isento"],
        ]} />
        <Note>Considera-se força maior, para os fins deste bloco, apenas o evento extraordinário e inevitável decorrente de desastre natural, guerra, comoção civil, calamidade pública ou epidemia ou pandemia oficialmente declarada por autoridade competente. Não configuram força maior greve, atraso, overbooking ou cancelamento de voo por causa climática comum ou falha operacional da companhia aérea — salvo quando o cancelamento decorrer diretamente de um dos eventos catastróficos acima, cabendo ao cliente comprovar o nexo.</Note>
        <Note>Equipara-se a força maior, para os fins deste bloco, a emergência médica grave ou o óbito do cliente, do condutor indicado, ou de cônjuge, companheiro ou parente até segundo grau, comprovada mediante laudo médico, atestado de internação, certidão de óbito ou documento equivalente — não bastando declaração do cliente. Essa hipótese não se aplica a reservas contratadas em tarifa não reembolsável, cuja condição de risco assumido pelo cliente prevalece.</Note>

        {/* ═══ BLOCO 3 ═══ */}
        <BTitle n="3" title="Adicionais e serviços" />
        <Tbl heads={["Adicional","Valor","Observação"]} rows={[
          [<strong>Condutor adicional</strong>,"R$ 19,95 por dia","Por condutor indicado, sem limite de quantidade"],
          [<strong>Condutor Jovem</strong>,"R$ 34,95 por dia","Ver bloco 1.4"],
          [<strong>Uso da Tag de Pedágio</strong>,"R$ 20,00 por contrato, limitado a 30 dias","Prorrogada a locação além de 30 dias, incide nova taxa a cada novo ciclo de 30 dias. Mais as tarifas da concessionária"],
          [<strong>Reposição de Tag de Pedágio</strong>,"R$ 20,00","Lançamento distinto do uso — devida uma única vez caso o cliente retire indevidamente ou não devolva o dispositivo na entrega do veículo"],
          [<strong>Sistema de navegação</strong>,"R$ 35,00 por dia","Limitado a R$ 500,00 por locação"],
          [<strong>Bebê Conforto</strong>,"R$ 35,00 por dia","Para crianças de 0 a 12 meses. Limitado a R$ 500,00 por locação"],
          [<strong>Cadeirinha Infantil</strong>,"R$ 35,00 por dia","Para crianças de 1 a 3 anos. Limitado a R$ 500,00 por locação"],
          [<strong>Assento de Elevação</strong>,"R$ 35,00 por dia","Para crianças de 4 a 7 anos. Limitado a R$ 500,00 por locação"],
          [<strong>Entrega e Devolução (Delivery &amp; Collection)</strong>,"R$ 5,00 por km","Mínimo de R$ 50,00 por trecho, sujeito a disponibilidade"],
          [<strong>Atendimento fora do horário</strong>,"A partir de R$ 100,00","Até 1 hora após o expediente, sob requisição"],
          [<strong>Serviço com Motorista (Chauffeur Drive)</strong>,"Consulte disponibilidade","—"],
          [<strong>Cross Border</strong>,"Consultar disponibilidade na loja de retirada","Sujeito a autorização prévia, solicitada com 7 dias de antecedência"],
        ]} />

        {/* ═══ BLOCO 4 ═══ */}
        <BTitle n="4" title="Prazos, modalidades e quilometragem" />
        <Tbl heads={["Item","Condição"]} rows={[
          [<strong>Diária</strong>,"24 horas contadas a partir do horário de retirada."],
          [<strong>Tolerância de devolução</strong>,"59 (cinquenta e nove) minutos. A partir do minuto 60, incide nova diária integral com adicionais e proteções."],
          [<strong>Locação Diária</strong>,"Até 27 diárias consecutivas."],
          [<strong>Locação Mensal e conversão automática</strong>,"A partir de 28 diárias. Atingida a 28ª diária, a Locação Diária converte-se automaticamente em Locação Mensal, sem necessidade de novo instrumento, renovada a cada 30 dias, com franquia de 3.000 km/mês."],
          [<strong>Prorrogação</strong>,"Solicitar com no mínimo 6 horas de antecedência, sujeita à aprovação e a nova pré-autorização."],
          [<strong>Franquia de quilometragem</strong>,"Livre na Locação Diária (até a 27ª diária). Na Locação Mensal, 3.000 km por ciclo de 30 dias, equivalente a 100 km por dia — limite que passa a valer a partir da conversão em Locação Mensal (28ª diária) e em cada ciclo renovado."],
          [<strong>Quilômetro excedente</strong>,"Conforme informado no Demonstrativo do Contrato de Locação, na data da retirada."],
          [<strong>Apresentação do veículo (Mensal)</strong>,"Somente mediante solicitação da locadora, com prazo de 48h para atendimento. Não atendida a solicitação no prazo, configura-se apropriação indébita, sujeita a busca e apreensão do veículo, na forma da cláusula 14.5 e seguintes do Contrato de Locação — sem multa específica para esta hipótese."],
        ]} />

        {/* ═══ BLOCO 5 ═══ */}
        <BTitle n="5" title="Proteções" />
        <p style={ps}>As proteções não constituem modalidade de seguro. Limitam a responsabilidade indenizatória do cliente perante a locadora, mediante pagamento de tarifa diária e observância da coparticipação e da Taxa Administrativa de Utilização de Cobertura.</p>
        <h3 style={{ margin: "24px 0 12px", fontSize: 16, fontWeight: 700, color: G }}>5.1 Tabela de correspondência e abrangência</h3>
        <Tbl heads={["Denominação comercial","Coberturas técnicas","Abrange"]} rows={[
          [<strong>PROTEÇÃO BÁSICA</strong>,"LDW","Furto, roubo, incêndio, colisão e avarias ao veículo, mediante coparticipação."],
          [<strong>PROTEÇÃO MÉDIA</strong>,"LDW + WWI + PAI","Básica, mais vidros, para-brisa e pneus, além de danos a ocupantes até R$ 5.000,00 por passageiro (redução de 50% da coparticipação)."],
          [<strong>PROTEÇÃO PREMIUM</strong>,"LDW + WWI + PAI + TPL","Média, mais danos materiais e corporais a terceiros (TPL), com isenção de coparticipação."],
          [<strong>TPL — Proteção a Terceiros</strong>,"TPL","Danos a terceiros: materiais até R$ 50.000,00 e corporais até R$ 100.000,00."],
          [<strong>SLI — Proteção Suplementar a Terceiros</strong>,"TPL complementar","Amplia o limite de cobertura por danos materiais e corporais a terceiros para até R$ 1.000.000,00 por evento. Não comercializada de forma isolada — pressupõe a contratação da TPL. Disponível apenas onde a Rede Europcar Brasil a comercializar."],
          [<strong>ASSISTÊNCIA 24H ESTENDIDA</strong>,"—","Proteção complementar: guincho até 300 km; táxi até 200 km; ônibus ilimitado; hospedagem até 2 diárias; cobertura de pane seca."],
          [<strong>SEM PROTEÇÃO</strong>,"—","Responsabilidade integral do CLIENTE por quaisquer perdas e danos."],
        ]} />

        <h3 style={{ margin: "24px 0 12px", fontSize: 16, fontWeight: 700, color: G }}>5.2 Regime de contratação</h3>
        <p style={ps}>Adesão opcional e expressa na abertura do contrato. Não pode ser incluída ou alterada no curso da locação.</p>

        <h3 style={{ margin: "24px 0 12px", fontSize: 16, fontWeight: 700, color: G }}>5.3 Condições de contratação da Proteção Premium</h3>
        {["Disponível a todos os grupos e categorias de veículo, exceto BLINDADO e categorias afins.","Sujeita a solicitação prévia de, no mínimo, 24 (vinte e quatro) horas de antecedência.","Resultado de análise cadastral de crédito e verificação do perfil do cliente."].map((item,i)=>(
          <div key={i} style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: "0 12px", ...ps, margin: "0 0 8px" }}><span style={{ color: G, fontWeight: 700 }}>·</span><span>{item}</span></div>
        ))}

        <h3 style={{ margin: "24px 0 12px", fontSize: 16, fontWeight: 700, color: G }}>5.4 Exclusões aplicáveis a todas as modalidades</h3>
        <Warn>Não estão cobertos: acessórios, som, GPS, Bebê Conforto, Cadeirinha Infantil, Assento de Elevação, tapetes, estepe, estofamentos, chaves e ferramentas; danos morais e indiretos; objetos pessoais; vandalismo, fenômenos da natureza e danos aos ocupantes (exceto mediante contratação de PAI/WWI aplicáveis).</Warn>

        {/* ═══ BLOCO 6 ═══ */}
        <BTitle n="6" title="Tabela de valores, coparticipação e caução (por código ACRISS)" />
        <p style={ps}>Os códigos ACRISS comercializados pela Rede Europcar Brasil constam nas tabelas abaixo, agrupados quando compartilham exatamente o mesmo valor, para otimizar a leitura da tabela.</p>

        <h3 style={{ margin: "24px 0 12px", fontSize: 16, fontWeight: 700, color: G }}>Proteção Básica (LDW)</h3>
        <Tbl heads={["Códigos ACRISS","Tarifa diária","Caução (BRL)","Coparticipação","Taxa utilização"]} rows={[
          ["EDMR, CDMR, DDMR","R$ 35,95","R$ 1.200,00","R$ 5.000,00","N/A"],
          ["CXMR, IDMR, ICMR","R$ 35,95","R$ 1.500,00","R$ 7.500,00","N/A"],
          ["CDAR, IDAR, CGAR, IFAR, SWAR, SDAR, SVMR, SVAR, PDAR, CPMR, CKMR","R$ 54,95","R$ 3.000,00","R$ 10.000,00","N/A"],
          ["CDAE, IQMR, IQAR, SFAR, PDAH, PFAR, FQND, FQBD, XQBD","R$ 64,95","R$ 5.000,00","R$ 16.000,00","N/A"],
          ["BLINDADO","R$ 204,95","R$ 8.000,00","R$ 20.000,00","N/A"],
        ]} />

        <h3 style={{ margin: "24px 0 12px", fontSize: 16, fontWeight: 700, color: G }}>Proteção Média (LDW + WWI + PAI)</h3>
        <Tbl heads={["Códigos ACRISS","Tarifa diária","Caução (BRL)","Coparticipação","Taxa utilização"]} rows={[
          ["EDMR, CDMR, DDMR","R$ 56,95","R$ 1.200,00","R$ 2.500,00","N/A"],
          ["CXMR, IDMR, ICMR","R$ 56,95","R$ 1.500,00","R$ 3.750,00","N/A"],
          ["CDAR, IDAR, CGAR, IFAR, SWAR, SDAR, SVMR, SVAR, PDAR, CPMR, CKMR","R$ 75,95","R$ 3.000,00","R$ 5.000,00","N/A"],
          ["CDAE, IQMR, IQAR, SFAR, PDAH, PFAR, FQND, FQBD, XQBD","R$ 88,95","R$ 5.000,00","R$ 8.000,00","N/A"],
          ["BLINDADO","R$ 243,95","R$ 8.000,00","R$ 10.000,00","N/A"],
        ]} />

        <h3 style={{ margin: "24px 0 12px", fontSize: 16, fontWeight: 700, color: G }}>Proteção Premium (LDW + WWI + PAI + TPL)</h3>
        <Tbl heads={["Códigos ACRISS","Tarifa diária","Caução (BRL)","Coparticipação","Taxa utilização"]} rows={[
          ["EDMR, CDMR, DDMR","R$ 107,85","R$ 600,00","Isento","R$ 600,00/evento"],
          ["CXMR, IDMR, ICMR","R$ 107,85","R$ 750,00","Isento","R$ 600,00/evento"],
          ["CDAR, IDAR, CGAR, IFAR, SWAR, SDAR, SVMR, SVAR, PDAR, CPMR, CKMR","R$ 145,85","R$ 1.500,00","Isento","R$ 600,00/evento"],
          ["CDAE, IQMR, IQAR, SFAR, PDAH, PFAR, FQND, FQBD, XQBD","R$ 168,85","R$ 2.500,00","Isento","R$ 600,00/evento"],
          ["BLINDADO","R$ 463,85","R$ 4.000,00","Isento","R$ 600,00/evento"],
        ]} />

        <h3 style={{ margin: "24px 0 12px", fontSize: 16, fontWeight: 700, color: G }}>TPL — Proteção a Terceiros (todos os códigos)</h3>
        <Tbl heads={["Códigos ACRISS","Tarifa diária","Caução","Coparticipação","Taxa utilização"]} rows={[
          ["Todos os códigos ACRISS comercializados","R$ 14,95","N/A","Isento","R$ 2.000,00/evento"],
        ]} />

        <h3 style={{ margin: "24px 0 12px", fontSize: 16, fontWeight: 700, color: G }}>SLI — Proteção Suplementar a Terceiros (todos os códigos)</h3>
        <Tbl heads={["Códigos ACRISS","Tarifa diária","Caução","Coparticipação","Taxa utilização"]} rows={[
          ["Todos os códigos ACRISS comercializados","R$ 9,90","N/A","Isento","N/A"],
        ]} />
        <Note>A SLI não é comercializada de forma isolada — pressupõe a contratação da TPL. Disponível apenas onde a Rede Europcar Brasil a comercializar.</Note>

        <h3 style={{ margin: "24px 0 12px", fontSize: 16, fontWeight: 700, color: G }}>Sem Proteção</h3>
        <Tbl heads={["Códigos ACRISS","Tarifa diária","Caução (BRL)","Responsabilidade"]} rows={[
          ["EDMR, CDMR, DDMR","R$ 0,00","R$ 9.000,00","100% dos danos"],
          ["CXMR, IDMR, ICMR","R$ 0,00","R$ 12.000,00","100% dos danos"],
          ["CDAR, IDAR, CGAR, IFAR, SWAR, SDAR, SVMR, SVAR, PDAR, CPMR, CKMR","R$ 0,00","R$ 18.000,00","100% dos danos"],
          ["CDAE, IQMR, IQAR, SFAR, PDAH, PFAR, FQND, FQBD, XQBD","R$ 0,00","R$ 30.000,00","100% dos danos"],
          ["BLINDADO","R$ 0,00","R$ 50.000,00","100% dos danos"],
        ]} />

        <Cl n="6.6">Taxa Administrativa de Utilização de Cobertura — É o valor fixo devido pelo efetivo acionamento da cobertura contratada. É autônoma e não se confunde com a coparticipação, sendo devida inclusive quando houver isenção da coparticipação.</Cl>
        <Cl n="6.7">Avarias de pequena monta — Serão cobradas com base em orçamento, acrescido da Taxa Administrativa de 15%, limitadas à coparticipação, e o orçamento detalhado e com fotos será disponibilizado previamente ao cliente.</Cl>

        {/* ═══ BLOCO 7 ═══ */}
        <BTitle n="7" title="Garantia, pré-autorização e estorno" />
        <p style={ps}>A pré-autorização é constituída exclusivamente via cartão de crédito físico (Mastercard, Visa, Diners, Amex) emitido por instituição bancária, com o nome do CLIENTE impresso ou gravado no próprio cartão. Não são aceitos cartões virtuais, pré-pagos, cartões sem nome do titular impresso ou gravado, ou caução em espécie.</p>
        <p style={ps}><strong>Estorno:</strong> No encerramento, liquidado o contrato, a LOCADORA solicita à administradora do cartão a baixa do limite retido em até 2 (dois) dias úteis. O prazo para recomposição efetiva do limite na fatura é de responsabilidade exclusiva do banco emissor do cartão.</p>
        <h3 style={{ margin: "24px 0 12px", fontSize: 16, fontWeight: 700, color: G }}>7.1 Seguro próprio — cobertura vinculada ao cartão de crédito</h3>
        <p style={ps}>O direito do cliente de recusar a contratação de qualquer proteção é incondicional (bloco 5.2) e independe da existência, da comprovação ou da suficiência de cobertura própria, inclusive vinculada a cartão de crédito. A Europcar não condiciona a retirada do veículo à apresentação de bilhete, certificado ou qualquer outro documento dessa natureza.</p>
        <p style={ps}>Recusada a contratação de proteção, o cliente permanece integralmente responsável perante a Europcar por perdas e danos, e sem redução do valor da pré-autorização.</p>
        <p style={ps}>A Europcar pode perguntar ao cliente, a título meramente informativo, sobre eventual cobertura vinculada ao cartão de crédito utilizado na pré-autorização, para fins internos de gestão de risco — nunca como condição para a locação ou para a recusa das proteções.</p>

        {/* ═══ BLOCO 8 ═══ */}
        <BTitle n="8" title="Devolução, combustível e limpeza" />
        <Tbl heads={["Item","Regra","Valor"]} rows={[
          [<strong>Combustível</strong>,"Entregue tanque cheio e devolvido igual — política cheio-cheio. Aferido em oitavos (8/8).","Isento"],
          [<strong>Serviço de Abastecimento</strong>,"Opcional, para quem prefere não reabastecer antes da devolução.","Taxa de Conveniência de R$ 59,95 + valor proporcional do litro faltante"],
          [<strong>Limpeza Simples</strong>,"Sujeira que não impeça nova locação imediata.","R$ 80,00"],
          [<strong>Limpeza Especial</strong>,"Sujeira excessiva, manchas, lama, pelos de animais.","A partir de R$ 150,00"],
          [<strong>Reembolso por Uso de Tabaco</strong>,"Proibido fumar (inclui cigarro eletrônico). A cobrança independe de registro de imagem.","3 diárias + troca do filtro de ar-condicionado + higienização + oxi-sanitização"],
          [<strong>Taxa de Retorno (one-way)</strong>,"Devolução em agência distinta (nacional). Internacional não permitido.","Consulte a loja de atendimento"],
          [<strong>Multa de Fronteira</strong>,"Cruzar fronteira do Brasil sem autorização escrita e prévia.","R$ 5.000,00"],
        ]} />

        {/* ═══ BLOCO 9 ═══ */}
        <BTitle n="9" title="Veículos elétricos e híbridos plug-in" />
        <Tbl heads={["Item","Regra","Valor"]} rows={[
          [<strong>Carga na entrega (100% elétrico)</strong>,"Registrada no Demonstrativo. Não se aplica a híbridos plug-in.","Sem custo adicional"],
          [<strong>Taxa de Recarga — retirada ≥ 80%</strong>,"Devolvido com carga inferior a 80%.","R$ 45,00"],
          [<strong>Taxa de Recarga — retirada 50%–79%</strong>,"Devolvido com carga ≤ 10%.","R$ 55,00"],
          [<strong>Retirada com carga &lt; 50%</strong>,"Não há cobrança de Taxa de Recarga.","Isento"],
          [<strong>Opção de Devolução Livre</strong>,"Pré-paga na retirada. Estornada se devolvido com &gt; 80%.","R$ 35,00"],
          [<strong>Híbridos plug-in</strong>,"Não sujeitos a percentual mínimo de carga nem à Taxa de Recarga.","N/A"],
          [<strong>Nível mínimo durante o uso (100% elétrico)</strong>,"Vedado operar com menos de 10% de carga.","Responsabilidade integral por danos"],
          [<strong>Cabo de recarga</strong>,"Apenas com o cabo fornecido ou conector dedicado em estações rápidas oficiais.","Responsabilidade integral por danos em caso de uso não autorizado"],
        ]} />

        {/* ═══ BLOCO 10 ═══ */}
        <BTitle n="10" title="Encargos de circulação e infrações" />
        <Tbl heads={["Item","Regra"]} rows={[
          [<strong>Infrações de trânsito</strong>,"Repasse do valor da multa ao cliente, com notificação prévia de 5 dias úteis + Taxa Administrativa."],
          [<strong>Identificação do infrator</strong>,"Prazo de 5 dias, contados da comunicação, para o cliente indicar o condutor."],
          [<strong>Pedágio, Estacionamento e Abastecimento</strong>,"Repasse do valor das transações realizadas por meio do dispositivo de pagamento automático + Taxa Administrativa."],
          [<strong>Taxa Ambiental</strong>,"Repasse de tributo municipal de acesso + Taxa Administrativa."],
          [<strong>Apreensão</strong>,"Valor das custas + Taxa Administrativa."],
          [<strong>Avarias</strong>,"Reembolso + Taxa Administrativa."],
          [<strong>Manutenção corretiva</strong>,"Reembolso, quando decorrente de uso inadequado ou mau uso + Taxa Administrativa."],
        ]} />

        {/* ═══ BLOCO 11 ═══ */}
        <BTitle n="11" title="Restrições de uso" />
        <Warn>O veículo NÃO poderá ser utilizado para (sujeito à rescisão e perda das proteções):</Warn>
        {["Transporte remunerado de pessoas ou bens, inclusive por aplicativos de mobilidade ou de entrega (Uber, 99, entregas), sem contrato específico;","Trafegar em praias, dunas, estradas não pavimentadas ou alagadas, submersão parcial ou total;","Testes de velocidade, rallies ou rachas;","Ser usado como reboque ou guincho;","Transporte de explosivos ou materiais ilícitos;","Circular fora do Brasil ou a menos de 50 km da fronteira sem autorização escrita;","Conduzir sob efeito de álcool ou drogas, agravar intencionalmente danos, entregar o volante a terceiros não autorizados ou deixar o veículo destravado com a chave."].map((item,i)=>(
          <div key={i} style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: "0 12px", ...ps, margin: "0 0 8px" }}><span style={{ color: "#D32F2F", fontWeight: 700 }}>·</span><span>{item}</span></div>
        ))}

        <h3 style={{ margin: "24px 0 12px", fontSize: 16, fontWeight: 700, color: G }}>11.1 Rodízio de veículos em São Paulo</h3>
        <p style={ps}>A responsabilidade pela observância do rodízio de veículos vigente na cidade de São Paulo é do cliente, do usuário e do condutor. A Europcar garante o grupo do veículo reservado, não a placa.</p>
        <p style={ps}>O rodízio abrange o Centro Expandido da Cidade de São Paulo, em dias úteis, das 7h às 10h e das 17h às 20h, conforme o final da placa:</p>
        <Tbl heads={["Final de placa","Dia da semana restrito"]} rows={[
          ["1 e 2","Segunda-feira"],["3 e 4","Terça-feira"],["5 e 6","Quarta-feira"],["7 e 8","Quinta-feira"],["9 e 0","Sexta-feira"],
        ]} />
        <Note>A regulamentação do rodízio é de competência do poder público municipal e pode ser alterada a qualquer tempo, sendo responsabilidade do cliente inteirar-se de sua validade e extensão vigentes na data da locação.</Note>

        {/* ═══ BLOCO 12 ═══ */}
        <BTitle n="12" title="Em caso de sinistro — prazos de comunicação" />
        <p style={ps}>A não observância dos prazos abaixo pode acarretar a perda das proteções contratadas:</p>
        <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
          {[["Imediatamente","Acionar a autoridade policial em caso de furto, roubo ou vítimas."],["Até 1 hora","Comunicar a Central de Assistência, telefone informado no Demonstrativo do Contrato de Locação."],["Até 6 horas","Registrar o Boletim de Ocorrência Policial."],["Até 3 dias úteis","Entregar o BO e o Relatório de Evento Danoso preenchido à Europcar."]].map(([t,d])=>(
            <div key={t} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "0 16px", borderTop: "1px solid #DCE5DA", paddingTop: 10 }}>
              <span style={{ fontWeight: 700, color: G, fontSize: 14 }}>{t}</span>
              <span style={{ fontSize: 14.5, lineHeight: 1.5, color: T }}>{d}</span>
            </div>
          ))}
        </div>
        <Note>Os prazos descritos acima poderão ser flexibilizados excepcionalmente em casos de força maior comprovada ou de emergência médica severa que impossibilitem fisicamente o cliente de efetuar a comunicação tempestiva, na forma da cláusula 12.1.1 do Contrato de Locação.</Note>
        <Cl n="12.1">Indenizações e lucros cessantes — Em perda total ou roubo, a base de indenização é o valor do veículo pela Tabela FIPE no dia do evento. Os lucros cessantes (por indisponibilidade de frota devido a dano provocado pelo cliente) correspondem a 70% da diária contratada, limitados a 30 dias. O cliente fica isento da cobrança de lucros cessantes caso tenha contratado e mantido ativa qualquer Proteção (Básica, Média ou Premium).</Cl>

        {/* ═══ BLOCO 13 ═══ */}
        <BTitle n="13" title="Rescisão e retomada" />
        <Tbl heads={["Item","Regra"]} rows={[
          [<strong>Rescisão imotivada</strong>,"Permitida para ambas as partes, com aviso mínimo de 48 horas."],
          [<strong>Rescisão motivada</strong>,"Imediata por quebra de contrato, inadimplência, fraude ou descaminho."],
          [<strong>Apropriação indébita</strong>,"Caracterizada após 24 horas de atraso na devolução sem justificativa de força maior."],
          [<strong>Recuperação de bem</strong>,"Reembolso das despesas de retomada (guincho, pátio, despachante) + Taxa Administrativa."],
          [<strong>Desconexão de Rastreio</strong>,"Vedada a adulteração ou desconexão da telemetria sem autorização prévia da locadora. Presume-se deliberada, cabendo ao cliente provar falha técnica. Não elidida a presunção: taxa de recuperação, rescisão e reembolso das diárias remanescentes."],
        ]} />

        {/* ═══ BLOCO 14 ═══ */}
        <BTitle n="14" title="Canais de atendimento" />
        <Tbl heads={["Setor","Contato / canal","Finalidade"]} rows={[
          [<strong>Central de Reservas</strong>,<>+55 11 5542-0500<br/>reservas@europcar.com.br</>,"Reserva, alteração e cancelamentos"],
          [<strong>Central de Assistência 24h</strong>,"Consultar telefone no Demonstrativo, informado na retirada","Emergências de frota e remoções"],
          [<strong>SAC / Ouvidoria</strong>,"sac@europcar.com.br","Pós-venda e dúvidas gerais"],
          [<strong>Encarregado de Dados (DPO)</strong>,"privacidade@europcar.com.br","Demandas sobre direitos (LGPD)"],
          [<strong>Aviso de Privacidade</strong>,<a href="/termos/privacidade" style={{ color: G }}>www.europcar.com.br/privacidade</a>,"Informações sobre proteção de dados"],
        ]} />

        <div style={{ background: "#F3F8F1", padding: "16px 20px", marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: T }}>Documento validado para padronização nas operações de balcão e ambiente digital da Europcar Brasil.</p>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, paddingTop: 16, marginTop: 32, borderTop: "1px solid #D8E0D6", fontSize: 12, color: "#5A6259", flexWrap: "wrap" }}>
          <span>Europcar Brasil · Termos e Condições Gerais de Locação de Veículos</span>
          <span>v3 · Setembro de 2026</span>
        </div>
      </div>
    </div>
  );
}
