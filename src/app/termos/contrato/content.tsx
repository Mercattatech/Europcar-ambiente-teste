"use client";
import React from "react";
import { G, Y, T, H, ps, Lbl, Ch, Cl, Sub, Al, H3, Tbl, Note, Warn, Bullet, Def } from "./components";

export default function ContratoContent() {
  return (
    <div style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", background: "#EDEFEC", minHeight: "100vh" }}>
      {/* HERO */}
      <div style={{ background: G, padding: "48px 32px 40px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 48, flexWrap: "wrap", gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 18, color: "#FFF", letterSpacing: "0.02em" }}>Europcar Brasil</span>
            <span style={{ fontSize: 13, color: "#E4F3E0", letterSpacing: "0.04em" }}>Contrato de Locação de Veículos · v4.0</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.34em", textTransform: "uppercase", color: Y, marginBottom: 16 }}>Time to move</div>
          <h1 style={{ margin: 0, fontSize: "clamp(26px,5vw,42px)", fontWeight: 700, color: "#FFF", lineHeight: 1.08, letterSpacing: "-0.025em" }}>Contrato de Locação de Veículos</h1>
          <div style={{ height: 5, width: 76, background: Y, margin: "20px 0" }} />
          <p style={{ margin: "0 0 12px", maxWidth: 640, fontSize: 16, lineHeight: 1.65, color: "#E4F3E0" }}>Instrumento particular que rege a locação de veículos da Europcar Brasil, vinculado a cada locação pela assinatura do Demonstrativo do Contrato de Locação.</p>
          <p style={{ margin: "0 0 40px", maxWidth: 640, fontSize: 13, lineHeight: 1.55, color: "#C4DFC0" }}>Substitui as Cláusulas e Condições Contratuais de Aluguel Diário de Carros registradas sob o nº 3.808.848 no 2º Cartório de Títulos e Documentos de São Paulo/SP.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "16px 32px", paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.25)" }}>
            {[["Versão","v4.0"],["Vigência","Setembro de 2026"],["Aplicável a","Brasil · europcar.com.br"]].map(([l,v])=>(
              <div key={l}><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: Y, marginBottom: 6 }}>{l}</div><p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#FFF", lineHeight: 1.35 }}>{v}</p></div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 64px" }}>
        {/* Preâmbulo */}
        <div style={{ background: "#F3F8F1", borderTop: "3px solid "+Y, padding: "20px 24px", margin: "32px 0" }}>
          <p style={{ ...ps, margin: "0 0 12px" }}>Pelo presente instrumento particular de Contrato de Locação de Veículos (&ldquo;CONTRATO&rdquo;), aplicável a toda locação realizada por empresa franqueada operando sob a marca EUROPCAR no Brasil, através de franquia empresarial, nos termos da Lei nº 13.966, de 26 de dezembro de 2019, e para todo o território nacional, ficam ajustadas as presentes CONDIÇÕES GERAIS, que regem a relação entre:</p>
          <p style={{ ...ps, margin: "0 0 12px" }}>de um lado, a pessoa jurídica franqueada da Rede EUROPCAR BRASIL identificada no cabeçalho do DEMONSTRATIVO DO CONTRATO DE LOCAÇÃO (&ldquo;LOCADORA&rdquo;), na qualidade de franqueada de Rental Line Locadora Ltda., sociedade empresária inscrita no CNPJ sob o nº 00.938.766/0001-11, com sede na Av. Morumbi, 8653, Brooklin, CEP 04703-004, São Paulo/SP, na qualidade de franqueadora master da marca EUROPCAR no país;</p>
          <p style={{ ...ps, margin: "0 0 12px" }}>e de outro lado, o CLIENTE devidamente qualificado no DEMONSTRATIVO DO CONTRATO DE LOCAÇÃO que a este instrumento se vincula e o integra (&ldquo;CLIENTE&rdquo;), LOCADORA e CLIENTE doravante designados em conjunto &ldquo;PARTES&rdquo; e, individualmente, &ldquo;PARTE&rdquo;,</p>
          <p style={{ ...ps, margin: "0 0 12px" }}>têm entre si justo e contratado o presente instrumento, que se regerá pelas cláusulas e condições a seguir, e, no que couber, pelo Código Civil (Lei nº 10.406/2002, artigos 565 e seguintes), pelo Código de Defesa do Consumidor (Lei nº 8.078/1990) e pelo Código de Trânsito Brasileiro (Lei nº 9.503/1997).</p>
          <p style={{ ...ps, margin: 0 }}>Ao assinar o DEMONSTRATIVO, o CLIENTE declara ter recebido, lido e compreendido este CONTRATO e os TERMOS E CONDIÇÕES GERAIS DE LOCAÇÃO DE VEÍCULOS vigentes, e com eles expressamente concorda, obrigando-se por si, pelo USUÁRIO e pelos CONDUTORES indicados.</p>
        </div>

        {/* Índice */}
        <div style={{ marginBottom: 40 }}>
          <Lbl>Índice</Lbl>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "10px 32px" }}>
            {[["I","Definições"],["II","Documentos da locação, hierarquia e alteração"],["III","Requisitos de contratação e análise cadastral"],["IV","Reserva, não comparecimento e cancelamento"],["V","Objeto, prazo, modalidades e prorrogação"],["VI","Preço, pagamento e inadimplemento"],["VII","Garantia, pré-autorização e estorno"],["VIII","Obrigações da locadora"],["IX","Obrigações do cliente e uso do veículo"],["X","Uso inadequado e agravamento de risco"],["XI","Proteções, coparticipação e perda de cobertura"],["XII","Sinistro: comunicação, prazos e indenização"],["XIII","Infrações de trânsito e encargos de circulação"],["XIV","Devolução do veículo"],["XV","Rescisão, retomada e bloqueio"],["XVI","Telemetria e proteção de dados pessoais"],["XVII","Conformidade e anticorrupção"],["XVIII","Disposições finais, assinatura eletrônica e foro"],["Anexo I","Conteúdo obrigatório dos Termos e Condições"]].map(([n,t])=>(
              <div key={n} style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: "0 8px", fontSize: 14, lineHeight: 1.5, color: T }}><span style={{ color: G, fontWeight: 700 }}>{n}</span><span>{t}</span></div>
            ))}
          </div>
        </div>

        {/* ═══ CAP I — Definições ═══ */}
        <Ch n="I" title="Definições" />
        <p style={ps}>As cláusulas deste CONTRATO são também referidas, ao longo do texto, como &ldquo;CONDIÇÕES GERAIS&rdquo; — expressão que designa o corpo normativo deste mesmo instrumento, e não um documento distinto.</p>
        <Cl n="1.1">Para os fins destas CONDIÇÕES GERAIS, os termos abaixo, empregados no singular ou no plural, têm o seguinte significado:</Cl>
        {[
          ["AGÊNCIA","unidade física da Rede Europcar Brasil habilitada à retirada e à devolução de veículos."],
          ["AGRAVAMENTO DE RISCO","ação ou omissão que aumente a probabilidade de ocorrência de SINISTRO ou amplie os seus efeitos, na forma do Capítulo X."],
          ["CENTRAL DE ASSISTÊNCIA","canal de atendimento disponibilizado pela LOCADORA, em regime de 24 horas, para acionamento em caso de pane, SINISTRO ou necessidade de remoção do VEÍCULO."],
          ["CHECAGEM DE VEÍCULO","termo de vistoria que registra as condições do VEÍCULO na entrega e na devolução, assinado por ambas as partes em meio físico ou eletrônico."],
          ["CLIENTE ou LOCATÁRIO","pessoa física ou jurídica identificada no DEMONSTRATIVO, responsável pelo integral cumprimento das obrigações da LOCAÇÃO, inclusive pelos atos do USUÁRIO e do CONDUTOR."],
          ["CONDUTOR","pessoa física indicada pelo CLIENTE, previamente identificada, qualificada e aprovada pela LOCADORA, autorizada a dirigir o VEÍCULO e identificada no DEMONSTRATIVO."],
          ["CONDUTOR NÃO AUTORIZADO","qualquer pessoa que conduza o VEÍCULO sem estar identificada e aprovada no DEMONSTRATIVO, ainda que habilitada."],
          ["COPARTICIPAÇÃO","valor previsto nos TERMOS E CONDIÇÕES, conforme o grupo do VEÍCULO e a PROTEÇÃO contratada, devido pelo CLIENTE por SINISTRO, destinado a amortizar os custos de reparo, a indisponibilidade do VEÍCULO para locação, a depreciação e as despesas administrativas da LOCADORA. A COPARTICIPAÇÃO não constitui franquia de seguro e não confere ao CLIENTE direito de acionar apólice eventualmente contratada pela LOCADORA."],
          ["DEMONSTRATIVO DO CONTRATO DE LOCAÇÃO ou DEMONSTRATIVO","documento emitido a cada locação que identifica as partes, o VEÍCULO, o USUÁRIO, o CONDUTOR, o prazo, os preços, as PROTEÇÕES e os adicionais contratados."],
          ["LOCADORA","pessoa jurídica identificada no cabeçalho do DEMONSTRATIVO, franqueada da Rede Europcar Brasil, que cede o uso do VEÍCULO ao CLIENTE."],
          ["LUCROS CESSANTES","valor devido à LOCADORA pelo período em que o VEÍCULO permanecer indisponível para locação em razão de SINISTRO imputável ao CLIENTE, apurado na forma do Capítulo XII."],
          ["PERDA TOTAL","caracterizada quando o custo de reparação do VEÍCULO, decorrente de um mesmo SINISTRO, atingir ou ultrapassar 50% do valor constante da Tabela FIPE na data do fato; quando houver classificação de média ou grande monta pela autoridade competente; ou quando forem constatados danos estruturais que comprometam a segurança, a dirigibilidade ou a documentação do VEÍCULO."],
          ["PRÉ-AUTORIZAÇÃO","reserva de valor em cartão de crédito, constituída antes do início da LOCAÇÃO, em garantia das obrigações pecuniárias do CLIENTE, na forma do Capítulo VII."],
          ["PROTEÇÃO","faculdade oferecida pela LOCADORA que limita a responsabilidade indenizatória do CLIENTE perante a LOCADORA, mediante pagamento de tarifa diária e observância da COPARTICIPAÇÃO. A PROTEÇÃO não constitui modalidade de seguro."],
          ["RELATÓRIO DE SINISTRO","formulário em modelo da Europcar Brasil no qual o CLIENTE, o USUÁRIO ou o CONDUTOR narra a dinâmica do fato e qualifica testemunhas e terceiros envolvidos."],
          ["RODÍZIO DE VEÍCULOS","restrição à circulação de veículos automotores em vias do centro expandido do Município de São Paulo, em dias úteis, das 7h às 10h e das 17h às 20h, conforme o algarismo final da placa, nos termos da legislação municipal vigente, sujeita a alteração pelo poder público competente, na forma da cláusula 8.6."],
          ["SINISTRO","colisão, capotamento, incêndio, alagamento, submersão, furto, roubo, apropriação indébita, vandalismo, avaria de qualquer natureza e qualquer outro fato que cause dano ao VEÍCULO, a terceiros ou a seus ocupantes."],
          ["SLI","Proteção Suplementar a Terceiros — proteção complementar e opcional à TPL, que amplia o limite de cobertura por danos materiais e corporais causados a terceiros para até R$ 1.000.000,00 por evento, na forma da cláusula 11.10 e seguintes."],
          ["TAXA ADMINISTRATIVA","percentual de 15% incidente uma única vez sobre cada valor cobrado em razão da LOCAÇÃO, na forma da cláusula 6.4."],
          ["TAXA DE UTILIZAÇÃO DE COBERTURA","valor fixo previsto nos TERMOS E CONDIÇÕES, devido pelo CLIENTE em razão do acionamento efetivo de determinada modalidade de PROTEÇÃO. Constitui contraprestação pela utilização da cobertura, é autônoma e distinta da COPARTICIPAÇÃO, com ela não se confunde e não constitui franquia de seguro."],
          ["TERMOS E CONDIÇÕES","documento comercial versionado que reúne requisitos de elegibilidade, restrições de uso, modalidades de PROTEÇÃO, valores de COPARTICIPAÇÃO e de PRÉ-AUTORIZAÇÃO, taxas e adicionais, na forma do Capítulo II e do Anexo I."],
          ["USO INADEQUADO","utilização do VEÍCULO em desacordo com o manual do fabricante, com a legislação vigente ou com estas CONDIÇÕES GERAIS, na forma do Capítulo X."],
          ["USUÁRIO","pessoa física que utilizará o VEÍCULO, responsável solidária pelo cumprimento destas CONDIÇÕES GERAIS."],
          ["VEÍCULO","automóvel de propriedade ou posse da LOCADORA, objeto da LOCAÇÃO, com seus acessórios, equipamentos e documentos."],
        ].map(([term,def])=><Def key={term} term={term}>{def}</Def>)}
        <Cl n="1.2"><strong>PADRONIZAÇÃO DE NOMENCLATURA.</strong> A cobertura obrigatória de responsabilidade indenizatória por danos causados a terceiros é designada, em todos os documentos da Rede Europcar Brasil, exclusivamente como TPL (Third Party Liability). A proteção complementar e opcional que amplia esse limite é designada exclusivamente como SLI, na forma da cláusula 11.10 e seguintes, e não se confunde com a TPL.</Cl>

        {/* ═══ CAP II ═══ */}
        <Ch n="II" title="Documentos da locação, hierarquia e alteração" />
        <Cl n="2.1">Integram a LOCAÇÃO, para todos os fins de direito:</Cl>
        {["estas CONDIÇÕES GERAIS;","os TERMOS E CONDIÇÕES GERAIS DE LOCAÇÃO DE VEÍCULOS, na versão vigente na data de abertura do DEMONSTRATIVO, disponível em cada AGÊNCIA e no sítio eletrônico da Rede Europcar Brasil;","o DEMONSTRATIVO DO CONTRATO DE LOCAÇÃO;","a CHECAGEM DE VEÍCULO de entrega e de devolução;","os regulamentos de modalidades específicas e de campanhas promocionais, quando aplicáveis."].map((item,i)=><Al key={i} letter={String.fromCharCode(97+i)}>{item}</Al>)}
        <Sub n="2.1.1">Os documentos referidos nas alíneas &ldquo;b&rdquo; e &ldquo;e&rdquo; são identificados por número de versão e data de vigência. A LOCADORA manterá disponível, em cada AGÊNCIA e no sítio eletrônico da Rede Europcar Brasil, a versão vigente de cada um deles.</Sub>
        <Sub n="2.1.2">Aplica-se a cada LOCAÇÃO a versão dos TERMOS E CONDIÇÕES vigente na data de abertura do DEMONSTRATIVO, ainda que sobrevenha alteração no curso da LOCAÇÃO, ressalvado o disposto na cláusula 2.3.</Sub>
        <Cl n="2.2">Em caso de contradição entre os documentos, prevalecerão estas CONDIÇÕES GERAIS e, na sequência, os demais na ordem em que dispostos na cláusula 2.1. A prevalência não se aplica quando a disposição de hierarquia inferior for mais favorável ao CLIENTE, hipótese em que esta prevalecerá.</Cl>
        <Cl n="2.3">A LOCADORA poderá alterar os TERMOS E CONDIÇÕES mediante comunicação ao CLIENTE com antecedência mínima de 15 (quinze) dias, por qualquer meio eletrônico informado no cadastro. Discordando das alterações, o CLIENTE poderá encerrar a LOCAÇÃO sem qualquer ônus, mediante devolução do VEÍCULO, permanecendo responsável pelos valores devidos até a efetiva devolução.</Cl>
        <Sub n="2.3.1">A prorrogação da LOCAÇÃO após a comunicação prevista na cláusula 2.3 importa aceitação das novas condições.</Sub>
        <Sub n="2.3.2">Os TERMOS E CONDIÇÕES não constituem documento registrado em cartório. Sua publicação no sítio eletrônico da Rede Europcar Brasil e em cada AGÊNCIA, na forma da cláusula 2.3, é suficiente para sua vigência e para sua oponibilidade ao CLIENTE.</Sub>
        <Sub n="2.3.3">Estas CONDIÇÕES GERAIS, por constituírem o CONTRATO, são o único dos documentos referidos na cláusula 2.1 sujeito a registro em cartório, e somente poderão ser alteradas mediante termo aditivo escrito e respectiva averbação no registro competente.</Sub>
        <Cl n="2.4">O CLIENTE reconhece que a Rede Europcar Brasil é composta por diversas pessoas jurídicas com autonomia administrativa, financeira e legal. A LOCADORA identificada no DEMONSTRATIVO é a responsável direta pela execução da LOCAÇÃO, sem prejuízo da responsabilidade solidária das demais integrantes da cadeia de fornecimento nas hipóteses previstas em lei, notadamente nos artigos 7º, parágrafo único, e 25, §1º, da Lei nº 8.078/1990.</Cl>

        {/* ═══ CAP III ═══ */}
        <Ch n="III" title="Requisitos de contratação e análise cadastral" />
        <Cl n="3.1">A LOCAÇÃO pressupõe dois papéis, que podem coincidir na mesma pessoa ou ser distribuídos entre pessoas diferentes: o CLIENTE e o CONDUTOR. São requisitos cumulativos para a contratação:</Cl>
        <Al letter="a">o CLIENTE deve ser identificado mediante documento oficial de identidade e CPF originais, sendo o único responsável, em qualquer hipótese, pelas obrigações financeiras da LOCAÇÃO, e não precisa deter Carteira Nacional de Habilitação, salvo se também for CONDUTOR do VEÍCULO;</Al>
        <Al letter="b">todo CONDUTOR — seja o próprio CLIENTE ou terceiro por ele indicado — deve reunir, cumulativamente: idade mínima de 21 (vinte e um) anos completos; Carteira Nacional de Habilitação definitiva, válida e emitida há mais de 2 (dois) anos, em categoria compatível com o VEÍCULO; e aptidão para conduzir, sem suspensão ou cassação do direito de dirigir, ressalvada a hipótese de CONDUTOR JOVEM, na forma da cláusula 3.2;</Al>
        <Al letter="c">apresentação de cartão de crédito físico apto à constituição da PRÉ-AUTORIZAÇÃO, em nome do CLIENTE, na forma do Capítulo VII;</Al>
        <Al letter="d">aprovação nas análises cadastral e de crédito realizadas pela LOCADORA.</Al>
        <Sub n="3.1.1">Toda LOCAÇÃO deve ter, no mínimo, um CONDUTOR indicado que atenda aos requisitos da alínea &ldquo;b&rdquo;, ainda que este não se confunda com o CLIENTE.</Sub>
        <Cl n="3.2"><strong>CONDUTOR JOVEM.</strong> Excepcionalmente, e mediante consulta prévia de disponibilidade à AGÊNCIA, será admitida a LOCAÇÃO a CLIENTE ou CONDUTOR com idade entre 19 e 21 anos incompletos, ou com habilitação definitiva emitida há menos de 2 anos, observados cumulativamente:</Cl>
        <Al letter="a">posse de Carteira Nacional de Habilitação definitiva emitida há, no mínimo, 12 meses;</Al>
        <Al letter="b">pagamento da taxa de Condutor Jovem prevista nos TERMOS E CONDIÇÕES;</Al>
        <Al letter="c">contratação obrigatória da PROTEÇÃO BÁSICA, compreendendo, no mínimo e cumulativamente, as coberturas LDW e TPL;</Al>
        <Al letter="d">constituição de PRÉ-AUTORIZAÇÃO no valor majorado previsto nos TERMOS E CONDIÇÕES.</Al>
        <Sub n="3.2.1">A modalidade CONDUTOR JOVEM é restrita aos grupos e categorias de VEÍCULO expressamente indicados nos TERMOS E CONDIÇÕES, sendo vedada, nessa modalidade, a locação de VEÍCULOS pertencentes aos grupos dele excluídos.</Sub>
        <Sub n="3.2.2">A contratação na modalidade CONDUTOR JOVEM depende de consulta prévia à AGÊNCIA e de confirmação de disponibilidade do grupo elegível.</Sub>
        <Cl n="3.3"><strong>CLIENTE ESTRANGEIRO.</strong> Além dos requisitos da cláusula 3.1 aplicáveis ao CONDUTOR, o CLIENTE, o USUÁRIO ou o CONDUTOR não residente no Brasil deverá apresentar passaporte original, visto válido quando exigível ou Registro Nacional Migratório, documento que comprove a data de entrada em território nacional e habilitação estrangeira original e válida. Habilitação redigida em alfabeto não latino deverá vir acompanhada de tradução, observados os acordos internacionais aplicáveis.</Cl>
        <Cl n="3.4"><strong>ANÁLISE CADASTRAL.</strong> A LOCADORA poderá realizar, a qualquer tempo, análise cadastral e de crédito do CLIENTE, do USUÁRIO e do CONDUTOR, com a finalidade de prevenção a fraude e de resguardo do patrimônio próprio e de terceiros.</Cl>
        <Sub n="3.4.1">A reprovação na análise cadastral, verificada antes ou no curso da LOCAÇÃO, faculta à LOCADORA recusar a contratação ou rescindir a LOCAÇÃO na forma do Capítulo XV, sem que disso decorra direito a indenização.</Sub>
        <Cl n="3.5"><strong>CONDUTORES ADICIONAIS.</strong> O CLIENTE poderá indicar CONDUTORES adicionais em número ilimitado, mediante pagamento da tarifa prevista nos TERMOS E CONDIÇÕES, por CONDUTOR. Cada CONDUTOR deverá atender aos requisitos da cláusula 3.1, alínea &ldquo;b&rdquo;, estar presente no ato da retirada e assinar o DEMONSTRATIVO.</Cl>
        <Sub n="3.5.1">As PROTEÇÕES contratadas estendem-se aos CONDUTORES regularmente indicados, aprovados e identificados no DEMONSTRATIVO.</Sub>
        <Cl n="3.6"><strong>REQUISITO DE IDADE PARA A CATEGORIA BLINDADO.</strong> Para a locação de VEÍCULOS da categoria BLINDADO, a idade mínima do CLIENTE, do USUÁRIO e de cada CONDUTOR é de 26 anos completos, em substituição ao requisito geral da cláusula 3.1, alínea &ldquo;a&rdquo;.</Cl>
        <Cl n="3.7"><strong>CADASTRO INTERNO DE PREVENÇÃO A FRAUDE E GESTÃO DE RISCO.</strong> A LOCADORA manterá cadastro interno, de uso exclusivo da Rede Europcar Brasil, para registro de CLIENTES, USUÁRIOS e CONDUTORES que apresentem risco à operação, com base no legítimo interesse previsto no artigo 7º, inciso IX, da Lei nº 13.709/2018.</Cl>
        <Sub n="3.7.1">Constituem critérios objetivos para inclusão no cadastro referido na cláusula 3.7:</Sub>
        <Al letter="a">inadimplemento de obrigação pecuniária decorrente de LOCAÇÃO anterior, com débito reconhecido ou objeto de cobrança judicial;</Al>
        <Al letter="b">reincidência em SINISTRO ou em avarias ao VEÍCULO em LOCAÇÕES anteriores;</Al>
        <Al letter="c">conduta abusiva, agressiva ou fraudulenta para com prepostos da LOCADORA ou terceiros, verificada em LOCAÇÃO anterior;</Al>
        <Al letter="d">descumprimento comprovado destas CONDIÇÕES GERAIS em LOCAÇÃO anterior, incluindo as hipóteses do Capítulo X.</Al>
        <Sub n="3.7.2">A inclusão no cadastro faculta à LOCADORA recusar solicitação de reserva ainda não confirmada, ou a contratação apresentada diretamente no balcão da AGÊNCIA. A inclusão no cadastro não afeta reserva já confirmada pela LOCADORA, ressalvada a reprovação em análise cadastral superveniente. O CLIENTE incluído será comunicado e poderá contestar a inclusão no prazo de 10 dias.</Sub>
        <Sub n="3.7.3">O cadastro é de uso exclusivo e interno da Rede Europcar Brasil, vedado o compartilhamento com outras locadoras ou entidades de mercado sem consentimento específico e destacado do titular dos dados.</Sub>

        {/* ═══ CAP IV ═══ */}
        <Ch n="IV" title="Reserva, não comparecimento e cancelamento" />
        <Cl n="4.1">A LOCADORA manterá o VEÍCULO reservado à disposição do CLIENTE pelo prazo de 1 (uma) hora contada do horário previsto para retirada, observado o horário de funcionamento da AGÊNCIA.</Cl>
        <Cl n="4.2"><strong>TAXA DE NÃO COMPARECIMENTO (NO SHOW).</strong> Decorrido o prazo da cláusula 4.1 sem que o CLIENTE compareça, o VEÍCULO ficará liberado para locação a terceiros e será devida a Taxa de Não Comparecimento, no valor de 10% do valor total da reserva, conforme os TERMOS E CONDIÇÕES.</Cl>
        <Cl n="4.3"><strong>TAXA DE CANCELAMENTO.</strong> O cancelamento da reserva em prazo inferior ao previsto nos TERMOS E CONDIÇÕES sujeitará o CLIENTE à Taxa de Cancelamento ali estabelecida.</Cl>
        <Cl n="4.4">Não serão devidas as taxas previstas nas cláusulas 4.2 e 4.3 quando o não comparecimento ou o cancelamento decorrer de caso fortuito ou força maior, devidamente comprovados.</Cl>
        <Cl n="4.5">Para os fins desta cláusula, considera-se força maior o evento imprevisível e extraordinário, alheio à vontade do CLIENTE, decorrente de causas como desastre natural, guerra, comoção civil ou decreto de calamidade pública, cujos efeitos não poderiam ter sido evitados por medida razoável, cabendo ao CLIENTE demonstrar tanto a ocorrência do evento quanto o nexo entre ele e o descumprimento.</Cl>
        <Sub n="4.5.1">Não configuram força maior: greve; atraso, overbooking ou cancelamento de voo ou de qualquer outro meio de transporte utilizado pelo CLIENTE para chegar à AGÊNCIA; ou qualquer evento rotineiro da operação de companhias de transporte — salvo quando o evento decorrer diretamente de uma das causas catastróficas descritas na cláusula 4.5.</Sub>
        <Sub n="4.5.2">Equipara-se às hipóteses da cláusula 4.5 a emergência médica grave ou o óbito do CLIENTE, do CONDUTOR indicado, ou de cônjuge, companheiro ou parente até segundo grau, comprovada mediante laudo médico, atestado de internação, certidão de óbito ou documento equivalente.</Sub>
        <Sub n="4.5.3">O disposto na cláusula 4.5.2 não se aplica quando a RESERVA tiver sido contratada em tarifa expressamente identificada como não reembolsável.</Sub>
        <Cl n="4.6">Regras de arrependimento e de cancelamento de reserva feita à distância são disciplinadas pelos Termos e Condições de Reserva da Europcar Brasil, aplicáveis complementarmente a este Capítulo.</Cl>

        {/* ═══ CAP V ═══ */}
        <Ch n="V" title="Objeto, prazo, modalidades e prorrogação" />
        <Cl n="5.1">Constitui objeto destas CONDIÇÕES GERAIS a locação de VEÍCULO, por prazo determinado, para uso exclusivo em território nacional, salvo autorização prévia, expressa e escrita da LOCADORA.</Cl>
        <Cl n="5.2"><strong>MODALIDADES.</strong> A LOCAÇÃO poderá ser contratada nas seguintes modalidades, conforme indicado no DEMONSTRATIVO:</Cl>
        <Al letter="a">LOCAÇÃO DIÁRIA: período de até 27 diárias;</Al>
        <Al letter="b">LOCAÇÃO MENSAL: período a partir de 28 diárias, renovável automaticamente por iguais períodos até o encerramento;</Al>
        <Al letter="c">modalidades específicas previstas em regulamento próprio, que prevalecerão em caso de divergência.</Al>
        <Sub n="5.2.1">A LOCAÇÃO DIÁRIA que atingir 28 diárias converte-se automaticamente em LOCAÇÃO MENSAL, a partir de quando: (i) a franquia de quilometragem passa a ser de 3.000 km por ciclo de 30 dias, equivalente a 100 km por dia; e (ii) passam a se aplicar as demais disposições próprias da LOCAÇÃO MENSAL.</Sub>
        <Cl n="5.3"><strong>DIÁRIA.</strong> A diária corresponde ao período de 24 horas contadas da retirada. Será concedida tolerância de 59 minutos; a partir do minuto 60, incidirá nova diária integral.</Cl>
        <Cl n="5.4"><strong>QUILOMETRAGEM.</strong> A LOCAÇÃO DIÁRIA poderá ser contratada com quilometragem livre ou controlada, conforme os TERMOS E CONDIÇÕES.</Cl>
        <Sub n="5.4.1">Constatada violação ou adulteração do hodômetro, será considerada a média de 200 km por dia, desde a abertura até o encerramento da LOCAÇÃO.</Sub>
        <Cl n="5.5"><strong>PRORROGAÇÃO.</strong> A prorrogação depende de autorização prévia e expressa da LOCADORA, devendo ser solicitada com antecedência mínima de 6 horas, e fica condicionada à quitação dos valores em aberto e à constituição de nova PRÉ-AUTORIZAÇÃO.</Cl>
        <Sub n="5.5.1">Prorrogada a LOCAÇÃO, as PROTEÇÕES e os adicionais permanecem automaticamente vigentes até a efetiva devolução do VEÍCULO.</Sub>
        <Sub n="5.5.2">Aplicam-se à prorrogação os preços vigentes na data em que ela ocorrer.</Sub>
        <Cl n="5.6"><strong>DEVOLUÇÃO ANTECIPADA.</strong> A devolução antecipada acarretará a reprecificação das diárias efetivamente utilizadas pela tarifa correspondente ao período realmente cumprido, com perda de promoções e descontos concedidos em função do prazo originalmente contratado.</Cl>

        {/* ═══ CAP VI ═══ */}
        <Ch n="VI" title="Preço, pagamento e inadimplemento" />
        <Cl n="6.1">O preço da LOCAÇÃO será apurado no encerramento do DEMONSTRATIVO e compreende as diárias, as PROTEÇÕES, os adicionais, as taxas, as despesas reembolsáveis e as indenizações devidas, acrescidos da TAXA ADMINISTRATIVA.</Cl>
        <Cl n="6.2">Não estão incluídos no valor da diária: combustível; multas e infrações de trânsito; quilometragem excedente; COPARTICIPAÇÃO; taxas de limpeza, retorno e liberação; Taxa de Preservação Ambiental; valores de pedágio e estacionamento; e indenizações decorrentes de SINISTRO.</Cl>
        <Cl n="6.3">Os débitos decorrentes da LOCAÇÃO serão cobrados ainda que apurados após o encerramento do DEMONSTRATIVO. O CLIENTE autoriza expressamente a LOCADORA a lançá-los em qualquer cartão cadastrado ou, na sua impossibilidade, a emitir boleto bancário.</Cl>
        <Cl n="6.4"><strong>TAXA ADMINISTRATIVA.</strong> A TAXA ADMINISTRATIVA, no percentual de 15%, incide uma única vez sobre cada valor cobrado em razão da LOCAÇÃO, vedada a incidência cumulativa ou sucessiva sobre a mesma base.</Cl>
        <Cl n="6.5"><strong>INADIMPLEMENTO.</strong> O não pagamento no vencimento sujeitará o CLIENTE a juros de mora de 1% ao mês, correção monetária pelo IGP-M e, ultrapassados 5 dias de atraso, multa moratória de 2% sobre o valor devido.</Cl>
        <Cl n="6.6">Persistindo o inadimplemento, a LOCADORA poderá inscrever o CLIENTE em cadastros de proteção ao crédito, promover protesto e adotar as medidas cabíveis.</Cl>
        <Cl n="6.7">A inscrição em cadastro de inadimplentes será precedida de comunicação ao CLIENTE, com indicação do valor e da origem do débito.</Cl>
        <Cl n="6.8">A LOCADORA poderá ceder, a qualquer título, os créditos decorrentes da LOCAÇÃO, independentemente de anuência do CLIENTE.</Cl>
        <Cl n="6.9"><strong>CONTESTAÇÃO DE COBRANÇA POSTERIOR AO ENCERRAMENTO.</strong> Todo valor apurado e cobrado após o encerramento do DEMONSTRATIVO será comunicado ao CLIENTE com a documentação que sustenta a cobrança.</Cl>
        <Sub n="6.9.1">O CLIENTE poderá contestar a cobrança no prazo de 10 dias. Ausente a contestação, a LOCADORA prosseguirá com a cobrança.</Sub>
        <Sub n="6.9.2">Tratando-se de avaria, o CLIENTE poderá solicitar segunda avaliação técnica por profissional habilitado de sua escolha.</Sub>

        {/* ═══ CAP VII ═══ */}
        <Ch n="VII" title="Garantia, pré-autorização e estorno" />
        <Cl n="7.1">Em garantia das obrigações pecuniárias da LOCAÇÃO, o CLIENTE autoriza a LOCADORA a constituir PRÉ-AUTORIZAÇÃO em cartão de crédito de sua titularidade, no ato da retirada, a título de caução e antecipação de pagamento parcial.</Cl>
        <Cl n="7.2">O valor da PRÉ-AUTORIZAÇÃO varia conforme o grupo do VEÍCULO e a modalidade de PROTEÇÃO contratada, e consta dos TERMOS E CONDIÇÕES.</Cl>
        <Cl n="7.3"><strong>MEIOS ACEITOS.</strong> Serão aceitos exclusivamente cartões de crédito físicos, emitidos por instituição financeira, com o nome do CLIENTE impresso ou gravado. Não serão aceitos cartões virtuais, pré-pagos, de débito, sem nome do titular, de titularidade de terceiro, nem caução em espécie.</Cl>
        <Cl n="7.4">O valor permanecerá reservado durante toda a LOCAÇÃO e poderá ser utilizado para quitação de quaisquer valores devidos.</Cl>
        <Cl n="7.5"><strong>ESTORNO.</strong> Na devolução do VEÍCULO, a LOCADORA solicitará à administradora do cartão a baixa do valor não utilizado, em até 2 dias úteis.</Cl>
        <Sub n="7.5.1">O prazo de efetiva liberação do valor no limite do cartão é definido exclusivamente pela administradora e pela instituição financeira emissora.</Sub>
        <Sub n="7.5.2">Mediante solicitação, a LOCADORA fornecerá comprovante da solicitação de baixa.</Sub>
        <Cl n="7.6">A PRÉ-AUTORIZAÇÃO não constitui limite da responsabilidade do CLIENTE, que responde integralmente pelos valores que excederem o montante reservado.</Cl>

        {/* ═══ CAP VIII ═══ */}
        <Ch n="VIII" title="Obrigações da locadora" />
        <Cl n="8.1">Constituem obrigações da LOCADORA:</Cl>
        <Al letter="a">entregar o VEÍCULO limpo, abastecido, revisado, em perfeitas condições de uso e segurança;</Al>
        <Al letter="b">registrar as condições do VEÍCULO na entrega e na devolução, mediante CHECAGEM DE VEÍCULO;</Al>
        <Al letter="c">manter o VEÍCULO reservado pelo prazo previsto na cláusula 4.1;</Al>
        <Al letter="d">arcar com as manutenções preventiva e corretiva decorrentes do uso normal;</Al>
        <Al letter="e">prestar assistência 24 horas, com atendimento de reboque em raio de até 100 km da AGÊNCIA de origem;</Al>
        <Al letter="f">substituir o VEÍCULO, sem ônus, em até 48 horas, por outro do mesmo grupo ou superior, em caso de defeito;</Al>
        <Al letter="g">informar previamente o CLIENTE sobre cobranças posteriores ao encerramento do DEMONSTRATIVO.</Al>
        <Cl n="8.2">A LOCADORA não substituirá o VEÍCULO nas hipóteses de furto, roubo, apropriação indébita, apreensão por fato imputável ao CLIENTE ou dano decorrente de USO INADEQUADO.</Cl>
        <Cl n="8.3">Constatado que não havia impedimento técnico à locomoção, ou que a ocorrência decorreu de USO INADEQUADO, os custos serão repassados ao CLIENTE, acrescidos da TAXA ADMINISTRATIVA.</Cl>
        <Cl n="8.4"><strong>SUBSTITUIÇÃO POR DECISÃO DE FROTA.</strong> Na LOCAÇÃO MENSAL, a LOCADORA poderá solicitar a substituição do VEÍCULO por outro de mesmo grupo, mediante comunicação com antecedência mínima de 5 dias.</Cl>

        <H3>Assistência 24 Horas</H3>
        <Cl n="8.5">A CENTRAL DE ASSISTÊNCIA fornecerá meio de transporte alternativo aos ocupantes do VEÍCULO sempre que, em razão de pane ou SINISTRO cobertos:</Cl>
        <Al letter="a">o VEÍCULO não puder se locomover por meios próprios;</Al>
        <Al letter="b">o reparo não puder ser concluído no local em até 24 horas;</Al>
        <Al letter="c">o VEÍCULO estiver a 100 km ou mais da AGÊNCIA de origem; ou</Al>
        <Al letter="d">o VEÍCULO tiver sido objeto de furto ou roubo.</Al>
        <Sub n="8.5.1">O meio de transporte alternativo destina-se ao retorno dos ocupantes ao município de domicílio do CLIENTE ou do USUÁRIO, ou à continuidade da viagem.</Sub>
        <Sub n="8.5.2">Será concedido 1 meio de transporte por acionamento: táxi (raio de 100 km) ou ônibus (sem limite de distância).</Sub>
        <Sub n="8.5.3">É vedada, em qualquer hipótese, a cobertura de passagem aérea.</Sub>
        <Sub n="8.5.4">O disposto nesta Seção compõe a Assistência 24 Horas incluída em toda LOCAÇÃO, sem custo adicional.</Sub>
        <Sub n="8.5.5">Contratada a ASSISTÊNCIA 24H ESTENDIDA, aplicam-se: guincho até 300 km; táxi até 200 km; ônibus ilimitado; hospedagem até 2 diárias; e cobertura de pane seca.</Sub>
        <Sub n="8.5.6">O valor da ASSISTÊNCIA 24H ESTENDIDA está previsto nos TERMOS E CONDIÇÕES.</Sub>

        <H3>Rodízio de Veículos em São Paulo</H3>
        <Cl n="8.6">A responsabilidade pela observância do RODÍZIO DE VEÍCULOS é do CLIENTE, do USUÁRIO e do CONDUTOR.</Cl>
        <Sub n="8.6.1">O RODÍZIO abrange o Centro Expandido de São Paulo, em dias úteis, das 7h às 10h e das 17h às 20h.</Sub>
        <Tbl heads={["Final de placa","Dia da semana restrito"]} rows={[["1 e 2","Segunda-feira"],["3 e 4","Terça-feira"],["5 e 6","Quarta-feira"],["7 e 8","Quinta-feira"],["9 e 0","Sexta-feira"]]} />
        <Sub n="8.6.2">A regulamentação do RODÍZIO é de competência do poder público municipal e pode ser alterada a qualquer tempo.</Sub>
        <Note>Atenção: fique atento ao RODÍZIO DE VEÍCULOS vigente na cidade de São Paulo.</Note>

        {/* ═══ CAP IX ═══ */}
        <Ch n="IX" title="Obrigações do cliente e uso do veículo" />
        <Cl n="9.1">O CLIENTE responde pela guarda e pelo correto uso do VEÍCULO, obrigando-se a devolvê-lo nas mesmas condições em que o recebeu, ressalvado o desgaste natural.</Cl>
        <Cl n="9.2">Constituem obrigações do CLIENTE:</Cl>
        <Al letter="a">conduzir o VEÍCULO de forma prudente, observando a legislação de trânsito;</Al>
        <Al letter="b">não permitir a condução por CONDUTOR NÃO AUTORIZADO;</Al>
        <Al letter="c">apresentar o VEÍCULO para manutenção preventiva, revisão ou recall quando convocado;</Al>
        <Al letter="d">não efetuar reparo, modificação ou instalação sem autorização prévia e escrita;</Al>
        <Al letter="e">comunicar imediatamente qualquer defeito no hodômetro;</Al>
        <Al letter="f">estacionar o VEÍCULO em local seguro, mantendo-o travado;</Al>
        <Al letter="g">utilizar dispositivos de retenção no transporte de crianças;</Al>
        <Al letter="h">devolver o VEÍCULO limpo, com todos os acessórios, chaves e documentos;</Al>
        <Al letter="i">não abandonar o VEÍCULO em via pública;</Al>
        <Al letter="j">informar à LOCADORA, na LOCAÇÃO MENSAL, a quilometragem até o dia 25 de cada mês.</Al>
        <Cl n="9.3"><strong>DENUNCIAÇÃO DA LIDE.</strong> O CLIENTE aceita ser chamado a integrar demandas judiciais propostas contra a LOCADORA em razão de fatos ocorridos durante a LOCAÇÃO.</Cl>
        <Cl n="9.4"><strong>DESPESAS REEMBOLSÁVEIS.</strong> Serão reembolsados à LOCADORA, acrescidos da TAXA ADMINISTRATIVA, os valores relativos a: chaves, segunda via de documentos ou placas, despesas de apreensão, reboque e serviços solicitados.</Cl>
        <Cl n="9.5"><strong>LIMPEZA.</strong> O VEÍCULO devolvido com sujidade que impeça a locação imediata sujeitará o CLIENTE à Taxa de Limpeza prevista nos TERMOS E CONDIÇÕES.</Cl>
        <Sub n="9.5.1">É vedado fumar ou fazer uso de cigarro eletrônico no interior do VEÍCULO.</Sub>
        <Sub n="9.5.2">O descumprimento sujeitará o CLIENTE ao ressarcimento em composição fixa, a título de pré-fixação de perdas e danos.</Sub>
        <Sub n="9.5.3">A multa substitui, para a mesma ocorrência, a Taxa de Limpeza Especial, vedada a cumulação.</Sub>
        <Sub n="9.5.4">Devolvido o VEÍCULO em condições de higiene que impossibilitem a identificação de avarias, a LOCADORA realizará nova vistoria após a limpeza.</Sub>
        <Cl n="9.6"><strong>PENALIDADE POR FRAUDE.</strong> Multa de 10% do valor do VEÍCULO (Tabela FIPE) por: violação do hodômetro ou cessão do VEÍCULO a terceiro sem autorização.</Cl>
        <Sub n="9.6.1"><strong>RECOMPOSIÇÃO POR PERDA DE GARANTIA.</strong> Indenização de 10% do valor do VEÍCULO por não apresentação para revisão no prazo de garantia do fabricante.</Sub>
        <Cl n="9.7"><strong>APRESENTAÇÃO DO VEÍCULO NA LOCAÇÃO MENSAL.</strong> O CLIENTE obriga-se a apresentar o VEÍCULO em AGÊNCIA da LOCADORA sempre que solicitado.</Cl>
        <Sub n="9.7.1">Prazo de 48 horas para apresentação. Ultrapassado, configura-se apropriação indébita, na forma da cláusula 14.5.</Sub>

        <H3>Veículos Elétricos e Híbridos Plug-in</H3>
        <Cl n="9.8">Recarga exclusivamente com o cabo fornecido pela LOCADORA ou conector dedicado em estações rápidas oficiais.</Cl>
        <Cl n="9.9">Manter o nível de carga da bateria em no mínimo 10% durante toda a LOCAÇÃO.</Cl>
        <Cl n="9.10">O VEÍCULO 100% elétrico será entregue com o percentual de carga registrado no DEMONSTRATIVO. Não se aplica a híbridos plug-in.</Cl>
        <Sub n="9.10.1">Taxa de Recarga devida quando a carga na devolução for inferior ao parâmetro contratual, conforme TERMOS E CONDIÇÕES.</Sub>
        <Sub n="9.10.2">Não será devida a Taxa de Recarga quando o VEÍCULO for retirado com carga inferior a 50%.</Sub>
        <Sub n="9.10.3">Opção de Devolução Livre: pré-paga na retirada, isenta o CLIENTE da Taxa de Recarga.</Sub>
        <Cl n="9.11">O descumprimento sujeita o CLIENTE à responsabilidade integral por dano à bateria, não coberto pelas PROTEÇÕES.</Cl>

        {/* ═══ CAP X ═══ */}
        <Ch n="X" title="Uso inadequado e agravamento de risco" />
        <Cl n="10.1"><strong>USO INADEQUADO.</strong> Constitui USO INADEQUADO do VEÍCULO:</Cl>
        {["trafegar em dunas, praias, areias, pântanos, mangues, leitos de rio, trilhas, vias alagadas ou interditadas;","submergir o VEÍCULO, total ou parcialmente;","transportar pessoas ou bens mediante remuneração, inclusive por aplicativos, sem contrato específico;","transportar acima da capacidade indicada pelo fabricante;","participar de corridas, competições, testes de velocidade, rallies ou \"rachas\";","utilizar o VEÍCULO como guincho ou reboque;","transportar combustível, explosivos ou produtos ilícitos;","utilizar para instrução ou treinamento de condutores;","circular com luzes de advertência de falha grave acesas no painel;","abastecer com combustível em desacordo com o manual do fabricante;","circular fora do território nacional ou a menos de 50 km da fronteira sem autorização;","utilizar para fim ilícito ou diverso da destinação constante do certificado de registro."].map((item,i)=><Al key={i} letter={String.fromCharCode(97+i)}>{item}</Al>)}
        <Cl n="10.2"><strong>AGRAVAMENTO DE RISCO.</strong> Constitui AGRAVAMENTO DE RISCO toda ação ou omissão que aumente a probabilidade de ocorrência de SINISTRO:</Cl>
        {["conduzir sob efeito de álcool, entorpecentes ou substância que altere a capacidade psicomotora;","conduzir em velocidade incompatível com a via;","entregar a posse ou a condução a CONDUTOR NÃO AUTORIZADO;","deixar o VEÍCULO destravado, com a chave na ignição;","circular em condições mecânicas inadequadas ou sem atenção a espaço, altura e dimensões compatíveis;","agravar intencionalmente os danos, provocar ou simular SINISTRO;","prestar declaração falsa ou incompleta, ou omitir circunstância relevante."].map((item,i)=><Al key={i} letter={String.fromCharCode(97+i)}>{item}</Al>)}
        <Cl n="10.3">A ocorrência acarreta, cumulativamente: perda das PROTEÇÕES; responsabilidade integral e ilimitada; e faculdade de rescisão.</Cl>
        <Cl n="10.4"><strong>MULTA POR CRUZAMENTO DE FRONTEIRA SEM AUTORIZAÇÃO.</strong> Valor fixo previsto nos TERMOS E CONDIÇÕES, a título de pré-fixação de perdas e danos.</Cl>

        {/* ═══ CAP XI ═══ */}
        <Ch n="XI" title="Proteções, coparticipação e perda de cobertura" />
        <Cl n="11.1">As PROTEÇÕES não constituem modalidade de seguro. Significam que a LOCADORA assume custos e responsabilidades que excedam a COPARTICIPAÇÃO, até os limites fixados nos TERMOS E CONDIÇÕES.</Cl>
        <Cl n="11.2">A adesão é opcional, manifestada expressamente no DEMONSTRATIVO. Não contratada na abertura, é vedada a sua inclusão ou alteração no curso da LOCAÇÃO.</Cl>
        <Cl n="11.3"><strong>MODALIDADES.</strong> As modalidades de PROTEÇÃO constam dos TERMOS E CONDIÇÕES, com tabela de correspondência entre a denominação comercial e a cobertura técnica.</Cl>
        <Sub n="11.3.1"><strong>CONDIÇÕES DE CONTRATAÇÃO.</strong> Sujeita a prévia aprovação da LOCADORA conforme critérios publicados nos TERMOS E CONDIÇÕES.</Sub>
        <Sub n="11.3.1.1">A PROTEÇÃO PREMIUM está disponível para todas as categorias, exceto BLINDADO, e deve ser solicitada com antecedência mínima de 24 horas.</Sub>
        <Cl n="11.4"><strong>COPARTICIPAÇÃO.</strong> Contratada a PROTEÇÃO, a responsabilidade limita-se ao valor da COPARTICIPAÇÃO correspondente ao grupo do VEÍCULO, por evento.</Cl>
        <Sub n="11.4.1"><strong>TAXA DE UTILIZAÇÃO DE COBERTURA.</strong> Devida pelo acionamento efetivo das modalidades de PROTEÇÃO, em valor fixo por evento.</Sub>
        <Sub n="11.4.2">A TAXA é autônoma em relação à COPARTICIPAÇÃO, devida ainda que haja isenção ou redução de COPARTICIPAÇÃO.</Sub>
        <Sub n="11.4.3">O valor será informado ao CLIENTE no ato da contratação e constará em destaque no DEMONSTRATIVO.</Sub>
        <Cl n="11.5"><strong>AVARIAS DE PEQUENA MONTA.</strong> Cobradas com base em orçamento, acrescido de TAXA ADMINISTRATIVA de 15%, até o limite da COPARTICIPAÇÃO.</Cl>
        <Sub n="11.5.1">Orçamento será disponibilizado ao CLIENTE previamente, com discriminação de peças, serviços e registro fotográfico.</Sub>
        <Cl n="11.6"><strong>EXCLUSÕES.</strong> Independentemente da PROTEÇÃO: acessórios, som, GPS, tapetes, rodas, pneus, estepe, estofamentos, chaves, ferramentas, documentos; danos morais e indiretos; objetos pessoais; vandalismo, fenômenos da natureza; e danos aos ocupantes. Pneus, vidros e ocupantes ficam excluídos desta restrição quando contratada a PROTEÇÃO específica.</Cl>
        <Cl n="11.7">Os valores que excederem os limites da PROTEÇÃO permanecem sob responsabilidade integral do CLIENTE.</Cl>
        <Cl n="11.8"><strong>PERDA DAS PROTEÇÕES.</strong> O CLIENTE perderá o direito às PROTEÇÕES quando:</Cl>
        {["descumprir qualquer dos prazos da cláusula 12.1;","incorrer em USO INADEQUADO ou AGRAVAMENTO DE RISCO;","deixar de preencher e entregar o RELATÓRIO DE SINISTRO;","deixar de devolver as chaves e documentos do VEÍCULO declarado furtado ou roubado;","efetuar reparo ou celebrar acordo sem autorização da LOCADORA;","utilizar serviço de reboque não indicado pela CENTRAL DE ASSISTÊNCIA;","estiver inadimplente quanto à tarifa da PROTEÇÃO;","circular fora do território nacional sem autorização."].map((item,i)=><Al key={i} letter={String.fromCharCode(97+i)}>{item}</Al>)}
        <Sub n="11.8.1">A perda das PROTEÇÕES não afasta a dedução de valor já pago a título de COPARTICIPAÇÃO.</Sub>
        <Sub n="11.8.2">As hipóteses das alíneas &ldquo;a&rdquo; e &ldquo;c&rdquo; serão apuradas mediante laudo da autoridade competente, assegurado ao CLIENTE o direito de manifestação prévia no prazo de 10 dias.</Sub>
        <Cl n="11.9"><strong>SEGURO PRÓPRIO.</strong> O direito de recusar PROTEÇÃO independe de cobertura própria ou vinculada a cartão de crédito. A LOCADORA não pode condicionar a retirada à apresentação de bilhete ou certificado.</Cl>
        <Sub n="11.9.1">Recusada a PROTEÇÃO, o CLIENTE permanece integralmente responsável, sem redução de PRÉ-AUTORIZAÇÃO.</Sub>
        <Sub n="11.9.2">A LOCADORA pode perguntar sobre cobertura vinculada ao cartão, a título meramente informativo, para fins de gestão de risco.</Sub>

        <H3>SLI (Proteção Suplementar a Terceiros)</H3>
        <Cl n="11.10">Mediante disponibilidade na AGÊNCIA, e em complemento à TPL, o CLIENTE poderá contratar a proteção SLI, que amplia o limite de cobertura por danos a terceiros para o valor previsto nos TERMOS E CONDIÇÕES.</Cl>
        <Sub n="11.10.1">A contratação da SLI pressupõe a contratação da TPL. Não é comercializada de forma isolada.</Sub>
        <Sub n="11.10.2">A SLI está sujeita à disponibilidade na localidade da AGÊNCIA de retirada.</Sub>
        <Sub n="11.10.3">Tarifa diária única, independente do grupo ou categoria do VEÍCULO.</Sub>
        <Sub n="11.10.4">O acionamento da SLI não está sujeito a TAXA DE UTILIZAÇÃO DE COBERTURA própria.</Sub>

        {/* ═══ CAP XII ═══ */}
        <Ch n="XII" title="Sinistro: comunicação, prazos e indenização" />
        <Cl n="12.1"><strong>PRAZOS IMPRORROGÁVEIS.</strong> Ocorrido SINISTRO, o CLIENTE, o USUÁRIO ou o CONDUTOR obrigam-se, sob pena de perda das PROTEÇÕES:</Cl>
        {[["a","acionar imediatamente a autoridade policial, sempre que houver vítima, terceiro envolvido ou subtração;"],["b","comunicar o fato à CENTRAL DE ASSISTÊNCIA em até 1 hora da ocorrência;"],["c","registrar o Boletim de Ocorrência em até 6 horas;"],["d","entregar à LOCADORA o BO e o RELATÓRIO DE SINISTRO em até 3 dias úteis;"],["e","apresentar o Laudo Pericial, sempre que houver vítima ou capotamento;"],["f","permanecer no local até orientação da CENTRAL DE ASSISTÊNCIA;"],["g","utilizar exclusivamente o serviço de reboque indicado pela CENTRAL DE ASSISTÊNCIA."]].map(([l,t])=><Al key={l} letter={l}>{t}</Al>)}
        <Sub n="12.1.1">Os prazos são improrrogáveis, ressalvada a impossibilidade comprovada de cumprimento tempestivo por caso fortuito ou força maior, hipótese em que o prazo passa a fluir a partir da cessação do impedimento.</Sub>
        <Cl n="12.2">É vedado ao CLIENTE efetuar reparo ou celebrar acordo sem autorização prévia, expressa e escrita da LOCADORA.</Cl>

        <H3>Seção I — Indenização</H3>
        <Cl n="12.3"><strong>AVARIA SEM PERDA TOTAL.</strong> O CLIENTE ressarcirá o custo de recuperação do VEÍCULO, observado o limite da COPARTICIPAÇÃO quando contratada e mantida a PROTEÇÃO.</Cl>
        <Cl n="12.4"><strong>PERDA TOTAL, FURTO, ROUBO E APROPRIAÇÃO INDÉBITA.</strong> O CLIENTE ressarcirá o valor do VEÍCULO pela Tabela FIPE na data do SINISTRO, observado o limite da COPARTICIPAÇÃO quando contratada e mantida a PROTEÇÃO.</Cl>
        <Sub n="12.4.1">Recuperado o VEÍCULO após o pagamento integral da indenização, a LOCADORA restituirá ao CLIENTE o valor pago, deduzidas as despesas.</Sub>
        <Sub n="12.4.2">Na hipótese de PERDA TOTAL, furto, roubo ou incêndio, será cobrado 1 tanque cheio de combustível.</Sub>

        <H3>Seção II — Lucros cessantes</H3>
        <Cl n="12.5">São devidos LUCROS CESSANTES pelo período de indisponibilidade do VEÍCULO em razão de SINISTRO imputável ao CLIENTE.</Cl>
        <Cl n="12.6"><strong>APURAÇÃO.</strong> 70% da diária contratada, por dia de indisponibilidade, limitados a 30 diárias por evento.</Cl>
        <Sub n="12.6.1">A indisponibilidade será comprovada mediante ordem de serviço da oficina.</Sub>
        <Sub n="12.6.2">Não serão computados os dias de atraso imputável à LOCADORA.</Sub>
        <Cl n="12.7"><strong>ISENÇÃO.</strong> Contratada e mantida qualquer modalidade de PROTEÇÃO, o CLIENTE fica isento de LUCROS CESSANTES, salvo perda de cobertura.</Cl>

        {/* ═══ CAP XIII ═══ */}
        <Ch n="XIII" title="Infrações de trânsito e encargos de circulação" />
        <Cl n="13.1">O CLIENTE é integralmente responsável pelas infrações de trânsito cometidas durante a LOCAÇÃO.</Cl>
        <Cl n="13.2"><strong>INDICAÇÃO DO CONDUTOR INFRATOR.</strong> O CLIENTE outorga à LOCADORA poderes para representá-lo perante o órgão autuador.</Cl>
        <Sub n="13.2.1">Sendo a infração atribuível a CONDUTOR adicional, o CLIENTE deverá indicá-lo no prazo de 5 dias.</Sub>
        <Sub n="13.2.2">O CLIENTE responde pelos agravamentos decorrentes da não aceitação da indicação pelo órgão autuador.</Sub>
        <Cl n="13.3"><strong>NOTIFICAÇÃO PRÉVIA.</strong> A LOCADORA comunicará o CLIENTE com antecedência mínima de 5 dias úteis do lançamento de qualquer valor relativo a infração.</Cl>
        <Cl n="13.4"><strong>ENCARGO ADMINISTRATIVO.</strong> Sobre o valor da autuação incidirá a TAXA ADMINISTRATIVA, uma única vez.</Cl>
        <Cl n="13.5"><strong>RECURSO.</strong> É facultado ao CLIENTE recorrer da autuação perante o órgão competente. O recurso não suspende a obrigação de reembolso.</Cl>
        <Cl n="13.6"><strong>PEDÁGIO, ESTACIONAMENTO E ABASTECIMENTO.</strong> Utilizado o dispositivo de pagamento automático, será devida a taxa de contratação prevista nos TERMOS E CONDIÇÕES, além das transações realizadas.</Cl>
        <Sub n="13.6.1">Aplica-se igualmente aos sistemas de cobrança eletrônica em fluxo livre, sem cancela.</Sub>
        <Sub n="13.6.2">O CLIENTE responde pelas infrações decorrentes de evasão de pedágio.</Sub>
        <Sub n="13.6.3">Retirado ou não devolvido o dispositivo de pagamento automático, será devida a Taxa de Reposição.</Sub>
        <Cl n="13.7"><strong>TAXA DE PRESERVAÇÃO AMBIENTAL.</strong> O CLIENTE é responsável pelo recolhimento do tributo municipal de acesso.</Cl>

        {/* ═══ CAP XIV ═══ */}
        <Ch n="XIV" title="Devolução do veículo" />
        <Cl n="14.1">O VEÍCULO deverá ser devolvido na data, no horário e na AGÊNCIA indicados no DEMONSTRATIVO.</Cl>
        <Cl n="14.2">A devolução somente se considera concluída com o recebimento expresso do VEÍCULO pela LOCADORA e a assinatura da CHECAGEM DE VEÍCULO de devolução.</Cl>
        <Cl n="14.3"><strong>COMBUSTÍVEL.</strong> Entregue com tanque cheio e devolvido na mesma condição — política cheio-cheio. Aferido em oitavos.</Cl>
        <Sub n="14.3.1">Havendo substituição do VEÍCULO no curso da LOCAÇÃO, permanece a obrigação de devolução com tanque cheio.</Sub>
        <Cl n="14.4"><strong>TAXA DE RETORNO.</strong> Devolução em AGÊNCIA diversa, quando autorizada, sujeita à Taxa de Retorno.</Cl>
        <Sub n="14.4.1">Não são admitidas locações com devolução em país diverso do de retirada.</Sub>
        <Cl n="14.5"><strong>APROPRIAÇÃO INDÉBITA.</strong> A não devolução em até 24 horas do término do prazo caracterizará apropriação indébita, independentemente de notificação.</Cl>
        <Sub n="14.5.1">A LOCADORA poderá adotar todas as medidas legais para reaver o bem.</Sub>
        <Cl n="14.6"><strong>OBJETOS ESQUECIDOS.</strong> A LOCADORA não se responsabiliza por objetos deixados no VEÍCULO. Guarda por 30 dias.</Cl>

        {/* ═══ CAP XV ═══ */}
        <Ch n="XV" title="Rescisão, retomada e bloqueio" />
        <Cl n="15.1"><strong>RESCISÃO IMOTIVADA.</strong> Qualquer das partes poderá encerrar a LOCAÇÃO a qualquer tempo, com aviso de 48 horas.</Cl>
        <Cl n="15.2"><strong>RESCISÃO MOTIVADA.</strong> A LOCAÇÃO será rescindida de pleno direito nas hipóteses de:</Cl>
        {["descumprimento de qualquer obrigação;","USO INADEQUADO ou AGRAVAMENTO DE RISCO;","inadimplemento de qualquer valor devido;","reprovação cadastral superveniente, indício de fraude ou desvio de finalidade;","falência, recuperação judicial ou insolvência;","impedimento legal ou privação de liberdade do CLIENTE;","não devolução do VEÍCULO no prazo contratado."].map((item,i)=><Al key={i} letter={String.fromCharCode(97+i)}>{item}</Al>)}
        <Cl n="15.3"><strong>RETOMADA.</strong> O CLIENTE deverá devolver o VEÍCULO imediatamente. A LOCADORA poderá usar chave reserva, promover reintegração de posse e notícia-crime.</Cl>
        <Cl n="15.4"><strong>BLOQUEIO.</strong> A LOCADORA poderá promover o bloqueio mecânico ou eletrônico do VEÍCULO, mediante comunicação prévia.</Cl>
        <Sub n="15.4.1">O bloqueio será executado de modo a não expor ninguém a risco. Vedada a imobilização com o VEÍCULO em movimento.</Sub>
        <Cl n="15.5">A rescisão não exime o CLIENTE do pagamento dos valores devidos até a efetiva devolução.</Cl>
        <Cl n="15.6"><strong>REABERTURA.</strong> Rescindida a LOCAÇÃO por inadimplemento, a LOCADORA poderá autorizar a reabertura mediante quitação integral.</Cl>

        {/* ═══ CAP XVI ═══ */}
        <Ch n="XVI" title="Telemetria e proteção de dados pessoais" />
        <Cl n="16.1">O VEÍCULO poderá estar equipado com sistema de telemetria, rastreamento ou dispositivo eletrônico equivalente.</Cl>
        <Cl n="16.2">O tratamento de dados pessoais observará a Lei nº 13.709/2018 e o Aviso de Privacidade da Europcar Brasil, disponível em <a href="/termos/privacidade" style={{ color: G }}>www.europcar.com.br/privacidade</a>.</Cl>
        <Cl n="16.3">As finalidades, bases legais, prazos de retenção e hipóteses de compartilhamento estão descritos no Aviso de Privacidade.</Cl>
        <Cl n="16.4">Havendo tratamento de dados de telemetria para formação de perfil de condução, o CLIENTE poderá solicitar informações sobre os parâmetros utilizados.</Cl>
        <Cl n="16.5">O Encarregado pelo Tratamento de Dados Pessoais é designado pela Rental Line Locadora Ltda. (CNPJ nº 00.938.766/0001-11), contatado pelo e-mail privacidade@europcar.com.br.</Cl>
        <Cl n="16.6">Constatada falha ou ausência de comunicação do equipamento, a LOCADORA poderá promover sua substituição ou adotar providências para retomada do VEÍCULO.</Cl>
        <Cl n="16.7">É vedado ao CLIENTE desconectar, remover, danificar ou adulterar o dispositivo de telemetria ou rastreamento, salvo mediante autorização prévia.</Cl>
        <Cl n="16.8">Constatada a desconexão sem autorização, presume-se o caráter deliberado, cabendo ao CLIENTE provar falha técnica. Consequências: taxa de recuperação, rescisão, reembolso das diárias remanescentes e perda das PROTEÇÕES.</Cl>
        <Sub n="16.8.1">Comprovada falha técnica do equipamento, aplica-se exclusivamente a substituição do equipamento.</Sub>

        {/* ═══ CAP XVII ═══ */}
        <Ch n="XVII" title="Conformidade e anticorrupção" />
        <Cl n="17.1">As partes comprometem-se a cumprir a legislação anticorrupção e de prevenção à lavagem de dinheiro, incluindo as Leis nº 12.846/2013, nº 9.613/1998 e nº 12.529/2011.</Cl>
        <Cl n="17.2">As partes declaram que não ofereceram, prometeram, autorizaram ou pagaram qualquer vantagem indevida a agente público ou terceiro.</Cl>
        <Cl n="17.3">O CLIENTE declara que não utilizará o VEÍCULO para fim ilícito. Verificada tal hipótese, com apreensão do VEÍCULO, o CLIENTE ressarcirá a LOCADORA pelo valor integral do bem conforme Tabela FIPE.</Cl>
        <Cl n="17.4">As partes comprometem-se a comunicar violações a este Capítulo no prazo de 10 dias, por meio do canal sac@europcar.com.br.</Cl>

        {/* ═══ CAP XVIII ═══ */}
        <Ch n="XVIII" title="Disposições finais, assinatura eletrônica e foro" />
        <Cl n="18.1"><strong>ASSINATURA ELETRÔNICA.</strong> As partes reconhecem como válida a celebração do DEMONSTRATIVO e demais documentos por meio eletrônico ou digital, nos termos do artigo 10, §2º, da Medida Provisória nº 2.200-2/2001, admitindo-se: (i) cadastro privado com autenticação por login e senha; e (ii) assinatura manuscrita capturada eletronicamente por dispositivo touchscreen.</Cl>
        <Cl n="18.2"><strong>TÍTULO EXECUTIVO.</strong> O DEMONSTRATIVO, acompanhado destas CONDIÇÕES GERAIS, constitui título executivo extrajudicial, nos termos do artigo 784 do CPC.</Cl>
        <Sub n="18.2.1">Não reconhecida a natureza de título executivo, os documentos permanecem válidos como prova documental plena para instrução de ação de cobrança.</Sub>
        <Cl n="18.3"><strong>SOLIDARIEDADE.</strong> O CLIENTE, o USUÁRIO e os CONDUTORES respondem solidariamente por todas as obrigações.</Cl>
        <Cl n="18.4">A tolerância da LOCADORA quanto ao descumprimento de qualquer obrigação não constitui novação, renúncia ou alteração do pactuado.</Cl>
        <Cl n="18.5">A eventual nulidade de qualquer disposição não prejudicará as demais.</Cl>
        <Cl n="18.6">A LOCAÇÃO é pessoal e intransferível, vedada a cessão, sublocação ou transferência.</Cl>
        <Cl n="18.7"><strong>CANAIS DE ATENDIMENTO.</strong> SAC: sac@europcar.com.br · Central de Atendimento: +55 11 5542-0500.</Cl>
        <Cl n="18.8"><strong>FORO.</strong> Foro da sede da LOCADORA, facultado ao CLIENTE optar pelo foro de seu domicílio (art. 101, I, CDC).</Cl>
        <Cl n="18.9"><strong>REGISTRO.</strong> Este CONTRATO é registrado sob o nº 3.808.848 no 2º Cartório de Títulos e Documentos da Comarca de São Paulo/SP, na versão 4.0.</Cl>

        {/* ═══ ANEXO I ═══ */}
        <div style={{ marginTop: 48, marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: G }}>Anexo I</div>
          <h2 style={{ margin: "9px 0 0", fontSize: "clamp(18px,3vw,22px)", fontWeight: 700, letterSpacing: "-0.015em", color: H, lineHeight: 1.2 }}>Conteúdo obrigatório dos Termos e Condições Gerais de Locação de Veículos</h2>
          <div style={{ height: 3, width: 44, background: Y, marginTop: 13 }} />
        </div>
        <p style={ps}>Os TERMOS E CONDIÇÕES é documento comercial versionado, alterável na forma da cláusula 2.3, e deve conter, no mínimo, os itens abaixo:</p>
        <Tbl heads={["Bloco","Conteúdo mínimo","Cláusula"]} rows={[
          [<strong>Identificação</strong>,"Número da versão, data de vigência e data de substituição.","2.1.1"],
          [<strong>Elegibilidade</strong>,"Idade mínima, tempo de habilitação, documentos exigidos, cliente estrangeiro. Condutores adicionais ilimitados.","3.1, 3.3, 3.5"],
          [<strong>Condutor Jovem</strong>,"Faixa etária, tempo mínimo de habilitação, taxa, exigência de Proteção Básica (LDW+TPL) e grupos elegíveis.","3.2, 3.2.1"],
          [<strong>Reserva</strong>,"Prazo de tolerância, Taxa de Não Comparecimento, Taxa de Cancelamento e prazos.","4.1 a 4.6"],
          [<strong>Prazos e modalidades</strong>,"Definição de locação diária e mensal, tolerância de devolução, franquias de quilometragem e valor do km excedente.","5.2 a 5.4"],
          [<strong>Adicionais</strong>,"Condutor adicional, Bebê Conforto, Cadeirinha, Assento de Elevação, navegação, pedágio, Entrega e Devolução, atendimento fora do horário, Chauffeur Drive, Cross Border.","6.1, 9.4"],
          [<strong>Assistência 24h Estendida</strong>,"Raio de guincho e táxi, ônibus, hospedagem, pane seca e valor.","8.5.5, 8.5.6"],
          [<strong>Rodízio em São Paulo</strong>,"Aviso destacado; nenhum valor associado.","8.6"],
          [<strong>Proteções</strong>,"Denominação comercial, cobertura técnica, limites, exclusões e tarifa diária por código ACRISS.","11.3"],
          [<strong>SLI</strong>,"Localidades com disponibilidade, valor único da tarifa diária (R$ 9,90), independente de categoria.","11.10 a 11.10.4"],
          [<strong>Condições de contratação</strong>,"Modalidades sujeitas a aprovação prévia e critérios objetivos.","11.3.1, 11.3.1.1"],
          [<strong>Tabela de correspondência</strong>,"Quadro que relaciona cada denominação à cobertura técnica. A SLI é produto complementar à TPL.","1.2, 11.3, 11.10"],
          [<strong>Coparticipação</strong>,"Valor por evento, por grupo e por modalidade, com fato gerador.","11.4, 11.4.1"],
          [<strong>Taxa de Utilização</strong>,"Valor fixo por evento, por modalidade, com fato gerador expresso. Grafar separadamente da coparticipação.","11.4.1 a 11.4.3"],
          [<strong>Pré-autorização</strong>,"Valor por grupo e por modalidade, bandeiras aceitas, restrição a cartão físico e prazo de baixa.","7.2, 7.3, 7.5"],
          [<strong>Seguro próprio</strong>,"Direito incondicional de recusa das proteções.","11.9 a 11.9.2"],
          [<strong>Combustível e limpeza</strong>,"Preço por litro, método de aferição, Taxas de Limpeza.","14.3, 9.5"],
          [<strong>Multa por uso de tabaco</strong>,"Valor fixo, grafado como pré-fixação de perdas e danos.","9.5.2"],
          [<strong>Taxa de Retorno</strong>,"Critério de cálculo por quilometragem entre unidades.","14.4"],
          [<strong>Encargos de circulação</strong>,"Taxa Administrativa, percentual sobre infrações, taxa de pedágio, free flow e Taxa de Preservação Ambiental.","6.4, 13.4, 13.6, 13.7"],
          [<strong>Restrições de uso</strong>,"Rol de restrições operacionais, com remissão ao Capítulo X.","10.1, 10.2"],
          [<strong>Taxas de rescisão</strong>,"Taxa de Liberação (apreensão).","9.4"],
          [<strong>Lucros cessantes</strong>,"Percentual da diária, limite de diárias e forma de comprovação.","12.6"],
        ]} />

        <div style={{ background: "#F3F8F1", padding: "16px 20px", marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: T }}>Documento padronizado para as operações da Rede Europcar Brasil. Dúvidas: sac@europcar.com.br · +55 11 5542-0500</p>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, paddingTop: 16, marginTop: 32, borderTop: "1px solid #D8E0D6", fontSize: 12, color: "#5A6259", flexWrap: "wrap" }}>
          <span>Europcar Brasil · Contrato de Locação de Veículos</span>
          <span>v4.0 · Setembro de 2026</span>
        </div>
      </div>
    </div>
  );
}
