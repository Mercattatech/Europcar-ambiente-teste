"use client";

/**
 * Blocos "Pago on-line" × "A pagar no balcão" + "Incluso".
 * Regra em src/lib/europcar/paymentSplit.ts (payer com `ba` = on-line; sem `ba` = balcão).
 * Usado no checkout (resumo e PIX) e na tela de confirmação (/obrigado).
 */
import {
  formatBRL,
  formatMoney,
  counterNotice,
  counterCurrencyNotice,
  includedExcessText,
  type PaymentSplit,
  type SplitLine,
} from "@/lib/europcar/paymentSplit";

interface Props {
  split: PaymentSplit;
  /** Nome PT-BR por código (auxK) para itens que o mapa não traduz (ex.: opcionais escolhidos no site) */
  nameOverrides?: Record<string, string>;
  /** Título do bloco on-line (default "Pago on-line") */
  onlineTitle?: string;
  /** Esconde o detalhamento do bloco on-line (ex.: isPriceSecret em telas do condutor) */
  hideOnlineDetail?: boolean;
  /** Parcelamento do cartão (mostra "Nx de R$ ...") */
  installments?: number;
  compact?: boolean;
}

function Money({ brl, local, currency, strong }: { brl: number; local: number; currency: string; strong?: boolean }) {
  const showLocal = !!currency && currency !== "BRL";
  return (
    <span className="text-right shrink-0 whitespace-nowrap">
      <span className={strong ? "font-black text-gray-900" : "font-semibold text-gray-900"}>{formatBRL(brl)}</span>
      {showLocal && <span className="text-gray-500 font-medium"> ({formatMoney(local, currency)})</span>}
    </span>
  );
}

export default function PaymentSplitBlocks({
  split,
  nameOverrides = {},
  onlineTitle = "Pago on-line",
  hideOnlineDetail = false,
  installments = 1,
  compact = false,
}: Props) {
  const cur = split.localCurrency;
  const labelOf = (l: SplitLine) => (!l.mapped && l.auxK && nameOverrides[l.auxK]) || l.label;
  const textSize = compact ? "text-[11px]" : "text-xs";
  const showLocal = !!cur && cur !== "BRL";

  const BlockContent = ({ block, side }: { block: NonNullable<PaymentSplit['online']>; side: 'online' | 'counter' }) => {
    const isOnline = side === 'online';
    const hasLines = block.lines.length > 0;
    const hasIncluded = block.included && block.included.length > 0;
    if (!hasLines && !hasIncluded) return null;

    return (
      <div className={`mt-3 pt-2.5 border-t border-gray-100 space-y-1.5 ${textSize} text-gray-700`}>
        {block.lines.map((l, idx) => (
          <div key={`${l.side}-${l.chrgTy}-${l.auxK}-${idx}`} className="flex justify-between items-start gap-2">
            <div className="flex items-start gap-1.5 min-w-0">
              <span className="text-gray-400 font-bold">-</span>
              <span>{labelOf(l)}</span>
            </div>
            <Money brl={l.priceBRL} local={l.priceLocal} currency={cur} />
          </div>
        ))}
        {block.included.map((i, idx) => {
          const exc = includedExcessText(i, cur);
          return (
            <div key={`${side}-inc-${i.code}-${idx}`} className="flex justify-between items-start gap-2">
              <div className="flex items-start gap-1.5 min-w-0">
                <span className={isOnline ? "text-[#008d36] font-bold" : "text-amber-700 font-bold"}>✓</span>
                <span className={isOnline ? "text-gray-800" : "text-gray-800"}>
                  {i.label}
                  {exc && <span className="text-gray-500 font-normal"> ({exc})</span>}
                </span>
              </div>
              <span className={isOnline ? "text-[#008d36] font-bold text-right shrink-0" : "text-amber-800 font-bold text-right shrink-0"}>
                Incluso
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-3.5" data-testid="payment-split-blocks">
      {!split.online && (
        <div className="bg-white border-2 border-emerald-500/30 rounded-xl p-4 shadow-2xs" id="split-online-block">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 pt-0.5">
              <span className="text-base">💳</span>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-950">{onlineTitle}</span>
            </div>
            <span className="text-base sm:text-lg font-black text-gray-900 whitespace-nowrap">{formatBRL(0)}</span>
          </div>
          <p className={`mt-3 pt-2.5 border-t border-gray-100 ${textSize} text-gray-600`}>
            Nenhum valor a pagar on-line: todas as cobranças desta reserva são pagas no balcão.
          </p>
        </div>
      )}
      {split.online && (
        <div className="bg-white border-2 border-emerald-500/30 rounded-xl p-4 shadow-2xs" id="split-online-block">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 pt-0.5">
              <span className="text-base">💳</span>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-950">{onlineTitle}</span>
            </div>
            <div className="text-right">
              <span className="text-base sm:text-lg font-black text-gray-900 whitespace-nowrap block">
                {formatBRL(split.online.subtotalBRL)}
              </span>
              {showLocal && (
                <span className="text-xs font-semibold text-gray-500 whitespace-nowrap block mt-0.5">
                  ({formatMoney(split.online.subtotalLocal, cur)})
                </span>
              )}
            </div>
          </div>
          {!hideOnlineDetail && <BlockContent block={split.online} side="online" />}
          {installments > 1 && (
            <div className="mt-2 bg-emerald-50 border border-emerald-200/70 rounded-lg px-2.5 py-1 flex items-center justify-between text-[11px]">
              <span className="text-emerald-800 font-medium">Parcelamento:</span>
              <span className="font-black text-[#008d36]">
                {installments}x de {formatBRL(split.online.subtotalBRL / installments)}{" "}
                <span className="font-normal text-[10px] text-emerald-700">sem juros</span>
              </span>
            </div>
          )}
        </div>
      )}

      {split.counter && (
        <div className="bg-white border-2 border-amber-300/80 rounded-xl p-4 shadow-2xs" id="split-counter-block">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 pt-0.5">
              <span className="text-base">🏪</span>
              <span className="text-xs font-black uppercase tracking-wider text-amber-950">A pagar no balcão</span>
            </div>
            <div className="text-right">
              <span className="text-base sm:text-lg font-black text-gray-900 whitespace-nowrap block">
                {formatBRL(split.counter.subtotalBRL)}
              </span>
              {showLocal && (
                <span className="text-xs font-semibold text-gray-500 whitespace-nowrap block mt-0.5">
                  ({formatMoney(split.counter.subtotalLocal, cur)})
                </span>
              )}
            </div>
          </div>
          <BlockContent block={split.counter} side="counter" />
          <p className={`mt-3 pt-2.5 border-t border-amber-200/80 ${textSize} text-amber-950 leading-snug`}>
            {counterNotice(cur)}
          </p>
        </div>
      )}

      <div className="bg-amber-50/90 border-2 border-amber-300 rounded-xl p-4 shadow-xs" id="split-total-block">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 pt-0.5">
            <span className="text-base">🟢</span>
            <span className="text-xs font-black uppercase tracking-wider text-amber-950">Valor total</span>
          </div>
          <div className="text-right">
            <span className="text-lg sm:text-xl font-black text-amber-950 whitespace-nowrap block">{formatBRL(split.totalBRL)}</span>
            {showLocal && (
              <span className="text-xs font-semibold text-amber-800 whitespace-nowrap block mt-0.5">
                ({formatMoney(split.totalLocal, cur)})
              </span>
            )}
          </div>
        </div>
        {split.counter && (
          <p className={`mt-3 pt-2.5 border-t border-amber-200/80 ${textSize} text-amber-950 leading-snug`}>
            {counterCurrencyNotice(cur)}
          </p>
        )}
      </div>
    </div>
  );
}
