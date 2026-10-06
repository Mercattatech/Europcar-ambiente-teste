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
