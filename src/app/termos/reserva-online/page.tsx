import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos e Condições de Reserva | Europcar Brasil",
  description: "Regras aplicáveis às reservas de veículos realizadas no site europcar.com.br e na Central de Reservas da Europcar Brasil.",
};

export default function ReservaTermosPage() {
  return (
    <div style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", background: "#EDEFEC", minHeight: "100vh" }}>
      {/* HERO */}
      <div style={{ background: "#009222", padding: "48px 32px 40px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 48, flexWrap: "wrap", gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 18, color: "#FFF", letterSpacing: "0.02em" }}>Europcar Brasil</span>
            <span style={{ fontSize: 13, color: "#E4F3E0", letterSpacing: "0.04em" }}>Termos e Condições de Reserva · v1.1</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.34em", textTransform: "uppercase", color: "#FFDC00", marginBottom: 16 }}>Time to move</div>
          <h1 style={{ margin: 0, fontSize: "clamp(28px,5vw,44px)", fontWeight: 700, color: "#FFF", lineHeight: 1.08, letterSpacing: "-0.025em" }}>Termos e Condições de Reserva</h1>
          <div style={{ height: 5, width: 76, background: "#FFDC00", margin: "20px 0" }} />
          <p style={{ margin: "0 0 40px", maxWidth: 560, fontSize: 16, lineHeight: 1.65, color: "#E4F3E0" }}>Regras aplicáveis às reservas de veículos realizadas no site europcar.com.br e na Central de Reservas da Europcar Brasil.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "16px 32px", paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.25)" }}>
            {[["Versão","v1.1"],["Vigência","Setembro de 2026"],["Aplicável a","Brasil · europcar.com.br"]].map(([l,v])=>(
              <div key={l}><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#FFDC00", marginBottom: 6 }}>{l}</div><p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#FFF", lineHeight: 1.35 }}>{v}</p></div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 24px 64px" }}>
        {/* Aviso */}
        <div style={{ background: "#F3F8F1", borderTop: "3px solid #FFDC00", padding: "20px 24px", margin: "32px 0" }}>
          <p style={{ margin: "0 0 12px", fontSize: 15.5, lineHeight: 1.65, color: "#20301F" }}>Estes Termos aplicam-se exclusivamente às reservas realizadas no site europcar.com.br e na Central de Reservas da Europcar Brasil. Reservas feitas em qualquer outro site, aplicativo ou central de reservas da rede Europcar em outros países não são regidas por estas regras, ainda que utilizem a marca Europcar.</p>
          <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.65, color: "#20301F" }}>Este documento rege a reserva — não a locação em si, regida pelo Contrato de Locação de Veículos e pelos Termos e Condições Gerais.</p>
        </div>

        {/* Índice */}
        <div style={{ marginBottom: 40 }}>
          <Lbl>Índice</Lbl>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "10px 32px" }}>
            {[["I","Definições"],["II","Formação da reserva"],["III","Modalidades de reserva"],["IV","Modificação, cancelamento e reembolso"],["V","Direito de arrependimento e reservas de última hora"],["VI","Força maior e alternativas para o consumidor"],["VII","Reserva de veículo no exterior"],["VIII","Disposições gerais"]].map(([n,t])=>(
              <div key={n} style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: "0 8px", fontSize: 14, lineHeight: 1.5, color: "#20301F" }}>
                <span style={{ color: "#009222", fontWeight: 700 }}>{n}</span><span>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* I - Definições */}
        <ChTitle n="I" title="Definições" />
        <div style={{ display: "grid", gap: 14, marginBottom: 32 }}>
          {[
            ["CENTRAL DE ATENDIMENTO","canal telefônico ou digital da Europcar disponibilizado para reserva, alteração e cancelamento."],
            ["RESERVA","solicitação do CLIENTE de disponibilização futura de um VEÍCULO em AGÊNCIA e data determinadas, feita pelo sítio eletrônico, aplicativo ou CENTRAL DE ATENDIMENTO da Europcar."],
            ["RESERVA CONFIRMADA","RESERVA para a qual a LOCADORA enviou ao CLIENTE comunicação confirmando a disponibilidade do VEÍCULO e o preço estimado."],
            ["RESERVA COM PAGAMENTO NA RETIRADA","modalidade de RESERVA que não exige dados de pagamento no ato da solicitação, sendo o preço cobrado no balcão da AGÊNCIA no momento da retirada."],
            ["RESERVA PRÉ-PAGA","modalidade de RESERVA que exige o pagamento antecipado do valor estimado da locação no ato da confirmação."],
            ["VOUCHER","documento emitido pela LOCADORA que comprova a RESERVA CONFIRMADA e, quando aplicável, o pagamento antecipado."],
          ].map(([term,def])=>(
            <div key={term} style={{ borderLeft: "3px solid #009222", paddingLeft: 16, fontSize: 15, lineHeight: 1.6, color: "#20301F" }}>
              <strong style={{ color: "#101F12" }}>{term}:</strong> {def}
            </div>
          ))}
        </div>

        {/* II - Formação */}
        <ChTitle n="II" title="Formação da reserva" />
        {[
          ["2.1","As informações constantes das páginas descritivas dos serviços da Europcar Brasil têm caráter informativo e não constituem oferta contratual definitiva, ressalvadas as páginas em que o preço e as condições são apresentados de forma clara no fluxo de reserva."],
          ["2.2","Ao submeter um pedido de reserva, o CLIENTE formula uma solicitação de verificação de disponibilidade. A LOCADORA responderá confirmando a disponibilidade e o preço estimado ou informando a indisponibilidade."],
          ["2.3","Erro manifesto de preço ou de disponibilidade decorrente de falha evidente de sistema não vincula a LOCADORA. Constatado o erro, a LOCADORA poderá cancelar a RESERVA, restituindo imediata e integralmente qualquer valor pago pelo CLIENTE, sem incidência de penalidades."],
          ["2.4","O CLIENTE garante a veracidade dos dados fornecidos e a suficiência de fundos ou limite no meio de pagamento indicado."],
          ["2.5","A LOCADORA poderá recusar solicitações caso os dados obrigatórios não sejam fornecidos integralmente ou ocorra falha sistêmica comprovada, comunicando o CLIENTE de imediato."],
        ].map(([n,t])=><Clause key={n} n={n}>{t}</Clause>)}

        {/* III - Modalidades */}
        <ChTitle n="III" title="Modalidades de reserva" />
        <h3 style={h3}>Reserva com pagamento na retirada</h3>
        <Clause n="3.1">Confirmada a RESERVA COM PAGAMENTO NA RETIRADA, a LOCADORA garantirá o VEÍCULO da categoria solicitada pelo prazo de tolerância previsto no Contrato de Locação, contado do horário informado, observado o funcionamento da AGÊNCIA.</Clause>
        <Clause n="3.2">Esgotado o prazo sem retirada ou cancelamento, aplica-se a Taxa de Não Comparecimento prevista no Tarifário.</Clause>
        <h3 style={h3}>Reserva pré-paga</h3>
        <Clause n="3.3">A contratação da RESERVA PRÉ-PAGA exige pagamento antecipado, servindo a confirmação como VOUCHER.</Clause>
        <Clause n="3.4">Havendo indicação de número de voo em agências de aeroportos, a disponibilidade será garantida até 1 (uma) hora após a chegada efetiva do voo, respeitado o horário de funcionamento da AGÊNCIA.</Clause>

        {/* IV - Modificação */}
        <ChTitle n="IV" title="Modificação, cancelamento e reembolso" />
        <Clause n="4.1">O CLIENTE pode modificar a RESERVA CONFIRMADA sem custo quando solicitada com 48 (quarenta e oito) horas ou mais de antecedência da retirada.</Clause>
        <Clause n="4.2">O CLIENTE pode cancelar a RESERVA CONFIRMADA sem ônus dentro do prazo de cancelamento gratuito ou do prazo de arrependimento legal.</Clause>
        <Clause n="4.3">Condições de reembolso para reserva pré-paga</Clause>
        <Clause n="4.3.1">Cancelamentos elegíveis a reembolso integral (direito de arrependimento ou cancelamento tempestivo) terão os valores restituídos no prazo de até 2 a 5 dias úteis para pagamentos realizados via Pix ou transferência, e em até 2 faturas subsequentes (conforme o ciclo da administradora) para pagamentos via cartão de crédito.</Clause>
        <Clause n="4.4">Fora do prazo de cancelamento gratuito ou em caso de não comparecimento (No-Show), aplicar-se-ão as taxas retidas conforme previsto no Contrato de Locação e Tarifário.</Clause>

        {/* V - Arrependimento */}
        <ChTitle n="V" title="Direito de arrependimento e reservas de última hora" />
        <Clause n="5.1">Em conformidade com o artigo 49 do Código de Defesa do Consumidor, nas contratações realizadas à distância (internet ou telefone), é assegurado o direito de arrependimento no prazo de 7 (sete) dias corridos contados da confirmação da reserva, com restituição integral dos valores pagos, desde que a retirada do veículo ocorra com antecedência superior a 48 (quarenta e oito) horas da data da compra.</Clause>
        <Clause n="5.2">Para reservas realizadas com menos de 48 (quarenta e oito) horas de antecedência da retirada, a LOCADORA concede uma janela de reflexão de até 2 (duas) horas contadas imediatamente a partir da confirmação, período em que o CLIENTE poderá cancelar a contratação sem qualquer ônus ou taxa.</Clause>
        <Clause n="5.3">Esgotada a janela de 2 horas da cláusula anterior para reservas de última hora, ou transcorrido o prazo do artigo 49 para as demais, incidirão as regras regulares de cancelamento e retenção previstas no Capítulo IV.</Clause>
        <Clause n="5.4">As hipóteses de cancelamento com restituição previstas neste Capítulo não se aplicam às RESERVAS contratadas sob tarifa expressamente identificada como não reembolsável. Nessa modalidade, o CLIENTE opta por uma tarifa promocional de menor valor e, no ato da contratação, declara ciência e assume o risco de que o valor pago não será restituído em caso de cancelamento ou não comparecimento, ressalvadas as hipóteses de força maior do Capítulo VI e de cancelamento por iniciativa da LOCADORA.</Clause>
        <Clause n="5.5">Em qualquer hipótese de cancelamento de RESERVA, quando aplicável restituição ou cobrança, os valores observarão os montantes praticados conforme os termos e condições vigentes no país onde o veículo seria retirado, na moeda e nas regras ali aplicáveis, inclusive quanto a taxas de cancelamento, taxas de não comparecimento e condições de tarifa não reembolsável.</Clause>

        {/* VI - Força maior */}
        <ChTitle n="VI" title="Força maior e alternativas para o consumidor" />
        <Clause n="6.1">Nenhuma das partes responde pelo descumprimento de obrigações em caso de força maior devidamente caracterizada e comprovada, nos termos definidos abaixo.</Clause>
        <div style={{ background: "#FFF", border: "1px solid #DCE5DA", borderLeft: "4px solid #D97706", borderRadius: 6, padding: "16px 20px", margin: "0 0 16px" }}>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "#20301F" }}>Considera-se força maior, para os fins deste Capítulo, apenas o evento extraordinário e inevitável decorrente de desastre natural, guerra, comoção civil, calamidade pública ou epidemia ou pandemia oficialmente declarada por autoridade competente. Não configuram força maior greve, atraso, overbooking ou cancelamento de voo por causa climática comum ou falha operacional da companhia aérea — salvo quando o cancelamento decorrer diretamente de um dos eventos catastróficos acima, cabendo ao CLIENTE comprovar o nexo.</p>
        </div>
        <Clause n="6.2">Configurada a força maior acima definida e comprovado que ela impediu o comparecimento do CLIENTE, a LOCADORA poderá, a critério do CLIENTE, converter o valor retido de taxa de No-Show em crédito integral para utilização em reservas futuras na rede Europcar Brasil, válido por 180 dias.</Clause>

        {/* VII - Exterior */}
        <ChTitle n="VII" title="Reserva de veículo no exterior" />
        <Clause n="7.1">A Europcar Brasil atua exclusivamente como agente de venda para reservas com retirada no exterior, sendo a prestação da locação efetiva de responsabilidade da empresa local da rede Europcar operante no país de destino.</Clause>
        <Clause n="7.2">A locação internacional submete-se integralmente aos termos, condições e contratos locais aplicados pela operadora estrangeira no balcão de retirada.</Clause>
        <Clause n="7.3">Constitui obrigação exclusiva do CLIENTE consultar, ler integralmente e cumprir as regras, restrições e condições específicas aplicáveis no país de destino e na locadora local — incluindo, sem se limitar a:</Clause>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10, margin: "0 0 16px", paddingLeft: 48 }}>
          {["Exigências de documentos","Idade mínima e categorias de CNH","Permissão Internacional para Dirigir (PID)","Limites de quilometragem","Seguros obrigatórios ou opcionais locais","Bloqueio de caução em cartão internacional"].map(item=>(
            <div key={item} style={{ borderTop: "1px solid #DCE5DA", paddingTop: 8, fontSize: 14, color: "#20301F" }}>{item}</div>
          ))}
        </div>
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "16px 20px", margin: "0 0 32px" }}>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "#7F1D1D" }}>A Europcar Brasil não se responsabiliza por recusas de locação, cobranças adicionais locais ou aplicação de taxas decorrentes do descumprimento pelo CLIENTE das normas vigentes na agência de retirada estrangeira.</p>
        </div>

        {/* VIII - Disposições */}
        <ChTitle n="VIII" title="Disposições gerais" />
        <Clause n="8.1">As tarifas de reserva não cobrem custos de opcionais, combustíveis, taxas governamentais ou multas.</Clause>
        <Clause n="8.2">Eventuais dúvidas ou solicitações devem ser encaminhadas ao canal oficial de atendimento ao cliente da Europcar Brasil.</Clause>
        <Clause n="8.3">Fica eleito o foro do domicílio do consumidor para dirimir eventuais litígios oriundos destes Termos de Reserva.</Clause>

        {/* Contato */}
        <div style={{ background: "#009222", padding: "28px 32px", borderRadius: 4, marginTop: 40 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#FFDC00", marginBottom: 14 }}>Central de Atendimento Europcar Brasil</div>
          <div style={{ height: 3, width: 44, background: "#FFDC00", marginBottom: 20 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "20px 32px" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#FFDC00", marginBottom: 6 }}>Telefone</div>
              <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "#FFF" }}>+55 11 5542-0500</p>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#FFDC00", marginBottom: 6 }}>Antes ou durante a reserva</div>
              <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "#FFF" }}>reservas@europcar.com.br</p>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#FFDC00", marginBottom: 6 }}>Pós-venda (exclusivo por e-mail)</div>
              <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: "#FFF" }}>sac@europcar.com.br</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, paddingTop: 16, marginTop: 32, borderTop: "1px solid #D8E0D6", fontSize: 12, color: "#5A6259", flexWrap: "wrap" }}>
          <span>Europcar Brasil · Termos e Condições de Reserva</span>
          <span>v1.1 · Setembro de 2026</span>
        </div>
      </div>
    </div>
  );
}

/* ── helpers ── */
const h3: React.CSSProperties = { margin: "24px 0 12px", fontSize: 16, fontWeight: 700, color: "#009222", letterSpacing: "0.02em" };

function Lbl({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#009222", marginBottom: 16 }}>{children}</div>;
}

function ChTitle({ n, title }: { n: string; title: string }) {
  return (
    <div style={{ marginTop: 40, marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#009222" }}>Capítulo {n}</div>
      <h2 style={{ margin: "9px 0 0", fontSize: "clamp(18px,3vw,22px)", fontWeight: 700, letterSpacing: "-0.015em", color: "#101F12", lineHeight: 1.2 }}>{title}</h2>
      <div style={{ height: 3, width: 44, background: "#FFDC00", marginTop: 13 }} />
    </div>
  );
}

function Clause({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: "0 8px", margin: "0 0 14px", fontSize: 15.5, lineHeight: 1.65, color: "#20301F" }}>
      <span style={{ color: "#009222", fontWeight: 700, fontSize: 13 }}>{n}</span>
      <span>{children}</span>
    </div>
  );
}
