# Templates de e-mail de reserva

Cole cada HTML no template correspondente em `/painel/config-email` (campo HTML) e use o assunto indicado.

| Arquivo | Trigger | Assunto sugerido |
|---|---|---|
| `RESERVA_SUCESSO.html` | RESERVA_SUCESSO | `Reserva {{NUMERO_RESERVA}} confirmada — Europcar Brasil` |
| `RESERVA_SOB_SOLICITACAO.html` | RESERVA_SOB_SOLICITACAO | `Reserva {{NUMERO_RESERVA}} em análise — Europcar Brasil` |
| `RESERVA_CONFIRMADA.html` | RESERVA_CONFIRMADA | `Reserva {{NUMERO_RESERVA}} confirmada — Europcar Brasil` |
| `RESERVA_ALTERADA.html` | RESERVA_ALTERADA | `Reserva {{NUMERO_RESERVA}} alterada — Europcar Brasil` |
| `CANCELAMENTO.html` | CANCELAMENTO | `Reserva {{NUMERO_RESERVA}} cancelada — Europcar Brasil` |

## Bloco condicional

`{{#MOEDA_ESTRANGEIRA}}...{{/MOEDA_ESTRANGEIRA}}` — o conteúdo só aparece quando a moeda da reserva não é BRL
(estimativa "≈ R$" e aviso de valor em moeda local). Para reservas em reais, o bloco some.

## Detalhamento da reserva (variáveis novas)

Montadas em `src/lib/email/reservationDetailVars.ts`. Todas as linhas do template usam
`{{#VAR}}...{{/VAR}}`, então somem sozinhas quando o dado não existe (não aparece `{{VAR}}` cru).
O motor resolve **um nível** de bloco condicional — não aninhe `{{#A}}` dentro de `{{#B}}`.

| Variável | Conteúdo |
|---|---|
| `TEXTO_DIARIAS` / `QTD_DIARIAS` | "6 diárias" / 6 |
| `QUILOMETRAGEM` | "Ilimitada" ou "X km por dia" |
| `TARIFA` | "Pagar agora — cancelamento grátis" / "Pagar no balcão" |
| `VALOR_VEICULO`, `VALOR_PROTECOES`, `VALOR_ACESSORIOS`, `TOTAL_RESERVA` | valores na moeda local (≈ R$) |
| `CAMBIO` | "1 EUR = R$ 6,0368" (só moeda estrangeira) |
| `VALOR_PAGO_ONLINE`, `PAGO_ONLINE_LABEL` | **sempre preenchido** — "Pago no cartão de crédito" / "Pago via PIX" + valor em R$ (Balcão: "R$ 0,00") |
| `VALOR_BALCAO` | **sempre preenchido** — valor a pagar no destino (moeda local ≈ R$) ou "Nada a pagar — apenas a caução" |
| `LISTA_BALCAO` | itens cobrados no balcão (ex.: sobretaxa de aeroporto) |
| `LISTA_INCLUIDOS` | km, coberturas incluídas, taxas de licença/administração, IVA % |
| `LISTA_FRANQUIA` | franquia de cada proteção contratada ("franquia zero" quando 0, inclusive Proteção Premium) |
| `LISTA_ONLINE` | itens pagos on-line (conta empresarial). **Vazio quando `isPriceSecret="Y"`** — só o subtotal aparece |

### Regra on-line (conta empresarial) × balcão

Quando a reserva tem `paymentSplit` (tarifas ETO — ver `src/lib/europcar/paymentSplit.ts`), as variáveis
`VALOR_PAGO_ONLINE`, `LISTA_ONLINE`, `VALOR_BALCAO`, `LISTA_BALCAO` (itens + aviso de cobrança na retirada),
`LISTA_INCLUIDOS` (proteções a 0,00 com franquia), `TOTAL_RESERVA`, `VALOR_TOTAL`, `VALOR_LOCAL` e `VALOR_BRL`
passam a vir da regra por linha (`payer ba` = on-line, sem `ba` = balcão). `VALOR_VEICULO`, `VALOR_PROTECOES`
e `VALOR_ACESSORIOS` ficam vazios (os itens já estão nos blocos).

## Lojas de retirada e devolução

Preenchidas automaticamente em `sendTransactionalEmail` (`src/lib/email/enrichReservationEmailVars.ts`)
para todos os e-mails de reserva, via XRS `getStation` (com cache de 24h).

| Variável | Conteúdo |
|---|---|
| `NOME_LOJA_RETIRADA` / `NOME_LOJA_DEVOLUCAO` | "CORROIOS SEIXAL" (cai para o código se o XRS falhar) |
| `CODIGO_LOJA_RETIRADA` / `CODIGO_LOJA_DEVOLUCAO` | "LISX02" |
| `ENDERECO_LOJA_RETIRADA` / `ENDERECO_LOJA_DEVOLUCAO` | "Estação Ferroviária Corroios, 2855-097 Corroios, Portugal" |
| `TELEFONE_LOJA_RETIRADA` / `TELEFONE_LOJA_DEVOLUCAO` | telefone da loja |
| `LOCAL_RETIRADA` / `LOCAL_DEVOLUCAO` | linha única "NOME (CÓDIGO) — endereço" (compatível com templates antigos) |

> **Caução:** o valor **não vem do XRS**. O template traz apenas o texto explicativo (quem define, quando
> é bloqueada e que a liberação depende do banco emissor) — nunca um valor.
