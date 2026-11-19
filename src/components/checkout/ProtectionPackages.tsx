'use client';

import React from 'react';
import type { PackageItem } from '@/lib/europcar/protectionPackages';

export interface ProtectionCardData {
  id: 'basic' | 'medium' | 'premium';
  /** itens PRÓPRIOS do nível, informados pela XRS (code + descr do XML) */
  items: PackageItem[];
  /** itens dos níveis inferiores (cada nível contém tudo o que o anterior tem) */
  inherited: PackageItem[];
  inheritsFrom: Array<'basic' | 'medium'>;
  /** Básica incluída na tarifa (true) ou opcional com preço (false) */
  includedInRate?: boolean;
  /** franquia em BRL / moeda local (null = XML não informou) */
  excessBRL: number | null;
  excessLocal: number | null;
  /** adicional: BRL e moeda local (Básica = 0) */
  extraBRL: number;
  extraLocal: number;
  /** "+ EUR x" (moeda local) só quando existir */
  extraLocalCurrency?: string;
}

interface Props {
  cards: ProtectionCardData[];
  selected: 'basic' | 'medium' | 'premium' | 'none';
  currency: string;
  fmt: (n: number) => string;
  t: (key: any) => string;
  onSelect: (id: 'basic' | 'medium' | 'premium') => void;
}

const TITLE_KEY = { basic: 'pkg.basic', medium: 'pkg.medium', premium: 'pkg.premium' } as const;

function ItemRow({ it, muted }: { it: PackageItem; muted?: boolean }) {
  const showLabel = it.label !== it.code;
  return (
    <li className={`flex items-start gap-2 text-xs ${muted ? 'text-gray-500' : 'text-gray-800 font-medium'}`}>
      <span className="text-[#008d36] font-bold shrink-0">✓</span>
      <span>
        {showLabel && it.label}
        <span className={`${showLabel ? 'ml-1.5 ' : ''}text-[10px] font-black uppercase tracking-wider bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200`}>
          {it.code}
        </span>
      </span>
    </li>
  );
}

export default function ProtectionPackages({ cards, selected, currency, fmt, t, onSelect }: Props) {
  if (!cards.length) return null;
  return (
    <section className="mb-8" data-testid="protection-packages">
      <h3 className="font-extrabold text-2xl text-gray-900 mb-4">{t('pkg.title')}</h3>
      <div className={`grid grid-cols-1 gap-4 ${cards.length >= 3 ? 'md:grid-cols-3' : cards.length === 2 ? 'md:grid-cols-2' : ''}`}>
        {cards.map((c) => {
          const isSel = selected === c.id;
          const isPremium = c.id === 'premium';
          const zeroExcess = c.excessBRL === 0 && (c.excessLocal ?? 0) === 0;
          return (
            <article
              key={c.id}
              className={`relative flex flex-col rounded-xl bg-white p-5 transition-all ${
                isSel ? 'border-2 border-[#008d36] shadow-lg shadow-green-100' : 'border border-gray-200 hover:shadow-md'
              }`}
            >
              {isPremium && (
                <span className="absolute -top-2.5 right-4 text-[10px] bg-[#e67e00] text-white px-2.5 py-0.5 rounded-full font-black uppercase">
                  {t('pkg.recommended')}
                </span>
              )}
              <h4 className="text-xl font-black text-gray-900">{t(TITLE_KEY[c.id])}</h4>

              {/* Franquia — exatamente o valor do XML */}
              {c.excessBRL !== null && (
                <p className={`text-xs font-bold mt-1 ${zeroExcess ? 'text-red-600' : 'text-gray-800'}`}>
                  {t('pkg.excess')}: R$ {fmt(c.excessBRL)}
                  {!zeroExcess && c.excessLocal && currency !== 'BRL' ? <span className="font-normal text-gray-500"> ({currency} {fmt(c.excessLocal)})</span> : null}
                </p>
              )}

              {/* Adicional */}
              <div className="mt-3 mb-3">
                {c.id === 'basic' && c.includedInRate !== false ? (
                  <span className="text-base font-extrabold text-[#008d36]">{t('pkg.included')}</span>
                ) : (
                  <>
                    <span className="text-[10px] text-gray-400 uppercase font-bold block">{t('pkg.extra')}</span>
                    <span className="text-2xl font-black text-gray-900">+ R$ {fmt(c.extraBRL)}</span>
                    {c.extraLocal > 0 && currency !== 'BRL' && (
                      <span className="text-xs text-gray-500 ml-2">({currency} {fmt(c.extraLocal)})</span>
                    )}
                  </>
                )}
              </div>

              {/* Itens do pacote — todos vindos da XRS. Cada nível mostra primeiro o que herda dos inferiores */}
              <div className="border-t border-gray-100 pt-3 mb-4 flex-1">
                {c.inherited.length > 0 && (
                  <>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-1.5">
                      {t('pkg.includes')} {c.inheritsFrom.map((i) => t(TITLE_KEY[i])).join(' + ')}
                    </p>
                    <ul className="space-y-1.5 mb-3">
                      {c.inherited.map((it) => (
                        <ItemRow key={`inh-${it.code}`} it={it} muted />
                      ))}
                    </ul>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-[#008d36] mb-1.5">+ {t(TITLE_KEY[c.id])}</p>
                  </>
                )}
                <ul className="space-y-1.5">
                  {c.items.map((it) => (
                    <ItemRow key={it.code} it={it} />
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className={`w-full py-2.5 rounded-md font-bold text-sm transition-colors ${
                  isSel ? 'bg-[#008d36] text-white' : 'bg-[#FFD100] hover:bg-[#f2c800] text-black'
                }`}
              >
                {isSel ? t('pkg.selected') : t('pkg.select')}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
