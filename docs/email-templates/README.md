# Templates de e-mail de reserva

Cole cada HTML no template correspondente em `/painel/config-email` (campo HTML) e use o assunto indicado.

| Arquivo | Trigger | Assunto sugerido |
|---|---|---|
| `RESERVA_SUCESSO.html` | RESERVA_SUCESSO | `Reserva {{NUMERO_RESERVA}} confirmada — Europcar Brasil` |
| `RESERVA_SOB_SOLICITACAO.html` | RESERVA_SOB_SOLICITACAO | `Reserva {{NUMERO_RESERVA}} em análise — Europcar Brasil` |
| `RESERVA_CONFIRMADA.html` | RESERVA_CONFIRMADA | `Reserva {{NUMERO_RESERVA}} confirmada — Europcar Brasil` |
| `RESERVA_ALTERADA.html` | RESERVA_ALTERADA | `Reserva {{NUMERO_RESERVA}} alterada — Europcar Brasil` |

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
| `VALOR_PAGO_ONLINE`, `VALOR_BALCAO`, `LISTA_BALCAO` | divisão online × balcão (ex.: sobretaxa de aeroporto) |
| `LISTA_INCLUIDOS` | km, coberturas incluídas, taxas de licença/administração, IVA % |
| `LISTA_FRANQUIA` | franquia de cada proteção contratada ("franquia zero" quando 0) |

> **Caução:** o valor **não vem do XRS**. O template traz apenas o texto explicativo (quem define, quando
> é bloqueada e que a liberação depende do banco emissor) — nunca um valor.
