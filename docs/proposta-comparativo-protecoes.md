# Proposta: Comparativo Lado a Lado de Proteções (Básica vs. Premium)

Documento preparado para alinhamento e aprovação com o Luiz e equipe Europcar Brasil.

---

## 1. Objetivo
Demonstrar de forma clara e visual as vantagens de contratar a **Proteção Premium (Franquia Zero)** em relação à **Proteção Básica**, destacando a especificação da franquia em cada caso para aumentar a conversão de upsell.

---

## 2. Visão Comparativa (Estrutura de Conteúdo)

| Item de Comparação | Proteção Básica (Inclusa) | Proteção Premium — Franquia Zero (Recomendada) |
| :--- | :--- | :--- |
| **Status / Badge** | `Já inclusa no valor` | `⭐ Recomendado · Tranquilidade Total` |
| **Preço Adicional** | R$ 0,00 (incluso na tarifa) | Upgrade por + EUR 7,29 (+ R$ 42,29) *(exemplo dinâmico)* |
| **Franquia em Sinistro** | **Sujeito à Franquia Padrão** (R$ 8.000 a R$ 15.000+ / € 1.500 a € 2.500) | **FRANQUIA ZERO (R$ 0,00)** — Isenção total |
| **Danos e Colisão (CDW)** | Coberto **com** franquia (cliente paga até o teto) | Cobertura 100% **sem** franquia |
| **Roubo e Furto (THW)** | Coberto **com** franquia | Cobertura 100% **sem** franquia |
| **Danos a Terceiros (TPL)** | Incluso conforme leis locais | Incluso conforme leis locais |
| **Caução / Bloqueio no Cartão** | Valor integral da franquia retido no balcão | **Caução reduzida** (somente combustível/extras) |
| **Devolução do Veículo** | Vistoria detalhada com cobrança de avarias | Devolução rápida, sem estresse ou cobranças extras |

---

## 3. Onde o Código é Aplicado
- **Arquivo:** `src/app/reservation/vehicles/page.tsx`
- **Seção:** Substitui o bloco do Upsell ETO (linhas ~2684 a 2750), unificando as proteções lado a lado em 2 colunas responsivas.

---

## 4. Código JSX / React Pré-configurado

```tsx
{/* 🛡️ Comparativo de Proteções: Básica vs Premium (Franquia Zero) */}
{selectedTariffType === 'ETO' && (() => {
  const code = selectedCar?.carCategoryCode;
  const etoZeroCar = etoZeroCars.find(e => e.carCategoryCode === code);
  if (!etoZeroCar) return null;

  const marginMultiplier = 1 + (etoMargin / 100);
  const currentTotal = parseFloat(selectedCar?.totalRateEstimate || 0);
  const zeroTotal_raw = parseFloat(etoZeroCar.totalRateEstimate || 0);
  const zeroTotal = zeroTotal_raw * marginMultiplier;
  const upgradeCost = zeroTotal - currentTotal;
  const currency = selectedCar?.currency || 'EUR';
  const currentBRL = parseFloat(selectedCar?.totalRateEstimateInBookingCurrency || 0);
  const zeroBRL_raw = parseFloat(etoZeroCar.totalRateEstimateInBookingCurrency || 0);
  const zeroBRL = zeroBRL_raw * marginMultiplier;
  const upgradeBRL = zeroBRL - currentBRL;

  if (upgradeCost <= 0) return null;

  // Franquia padrão da categoria (se retornada pela cotação)
  const basicWithExcess = (quoteInsurances || []).find(
    (ins: any) => (ins.type === 'I' || ins.type === 'M') && (ins.bkExcessWithPOM > 0 || ins.excessWithPOM > 0)
  );
  const excessBRL = basicWithExcess?.bkExcessWithPOM || 0;
  const excessOrig = basicWithExcess?.excessWithPOM || 0;

  return (
    <div className="mb-10">
      {/* Cabeçalho da Seção */}
      <div className="mb-5">
        <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
          <span>🛡️</span> Escolha o nível de proteção para sua viagem
        </h3>
        <p className="text-xs md:text-sm text-gray-600 mt-1">
          Compare as coberturas abaixo e viaje sem preocupações eliminando a franquia no exterior.
        </p>
      </div>

      {/* Grid Comparativo: Uma ao lado da outra */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
        
        {/* CARD 1: PROTEÇÃO BÁSICA (INCLUSA) */}
        <div className={`relative flex flex-col justify-between rounded-2xl p-5 md:p-6 transition-all border-2 ${
          !zeroExcessUpgrade 
            ? 'border-gray-300 bg-white shadow-sm' 
            : 'border-gray-200 bg-gray-50/60 opacity-85'
        }`}>
          <div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center text-xl shrink-0 border border-gray-200">
                  🛡️
                </div>
                <div>
                  <h4 className="font-black text-gray-900 text-base md:text-lg leading-snug">
                    Proteção Básica
                  </h4>
                  <span className="text-[11px] font-bold text-gray-500">
                    Obrigatória da locadora
                  </span>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                Já inclusa
              </span>
            </div>

            {/* Franquia */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 mb-5">
              <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider block mb-0.5">
                Coparticipação em caso de sinistro:
              </span>
              <div className="text-base md:text-lg font-black text-amber-900">
                {excessBRL > 0 ? (
                  <>Com Franquia: R$ {fmtPrice(excessBRL)} {excessOrig > 0 && `(${currency} ${fmtPrice(excessOrig)})`}</>
                ) : (
                  <>Sujeito à Franquia Padrão</>
                )}
              </div>
              <p className="text-[11px] text-amber-700 mt-1 leading-snug">
                Você é responsável pelos custos de reparo ou perda até o teto da franquia da locadora.
              </p>
            </div>

            {/* Lista de Itens */}
            <ul className="space-y-3 mb-6 text-xs text-gray-700">
              <li className="flex items-start gap-2.5">
                <span className="text-amber-500 font-bold text-sm shrink-0">⚠️</span>
                <span>
                  <strong>Danos e Colisão (CDW):</strong> Cobertura ativa, porém com cobrança de franquia em caso de avaria.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-amber-500 font-bold text-sm shrink-0">⚠️</span>
                <span>
                  <strong>Roubo e Furto (THW):</strong> Cobertura ativa com participação obrigatória da franquia.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold text-sm shrink-0">✓</span>
                <span>
                  <strong>Responsabilidade Civil (TPL):</strong> Danos materiais e corporais a terceiros inclusos.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-gray-400 font-bold text-sm shrink-0">•</span>
                <span className="text-gray-500">
                  <strong>Caução no balcão:</strong> Requer bloqueio de garantia do valor integral da franquia no cartão.
                </span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between mt-auto">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Custo</span>
              <span className="text-lg font-black text-gray-900">Incluso no valor</span>
            </div>
            {zeroExcessUpgrade ? (
              <button
                type="button"
                onClick={() => {
                  setZeroExcessUpgrade(false);
                  const originalCar = cars.find(c => c.carCategoryCode === selectedCar?.carCategoryCode);
                  const originalEtoCar = etoCars.find(c => c.carCategoryCode === selectedCar?.carCategoryCode);
                  if (originalCar && originalEtoCar) {
                    const totalPriceETO = parseFloat(originalEtoCar.totalRateEstimate || "0") * (1 + etoMargin / 100);
                    const totalBRL_ETO = parseFloat(originalEtoCar.totalRateEstimateInBookingCurrency || "0") * (1 + etoMargin / 100);
                    setSelectedCar((prev: any) => ({
                      ...prev,
                      ...originalCar,
                      ...originalEtoCar,
                      totalRateEstimate: totalPriceETO.toFixed(2),
                      totalRateEstimateInBookingCurrency: totalBRL_ETO.toFixed(2),
                      optionalInsurances: originalCar.optionalInsurances,
                      imageUrl: prev.imageUrl,
                      _etoCID: '56935466'
                    }));
                  }
                }}
                className="text-xs font-bold text-gray-600 hover:text-gray-900 border border-gray-300 hover:bg-gray-100 py-2.5 px-4 rounded-lg transition-all"
              >
                Voltar para Básica
              </button>
            ) : (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                ✓ Plano Atual
              </span>
            )}
          </div>
        </div>

        {/* CARD 2: PROTEÇÃO PREMIUM (FRANQUIA ZERO) — RECOMENDADO */}
        <div className={`relative flex flex-col justify-between rounded-2xl p-5 md:p-6 transition-all border-2 ${
          zeroExcessUpgrade 
            ? 'border-[#008d36] bg-emerald-50/40 shadow-xl shadow-emerald-900/10 ring-2 ring-[#008d36]/30' 
            : 'border-[#e67e00] bg-gradient-to-b from-orange-50/70 via-amber-50/30 to-white hover:shadow-lg'
        }`}>
          <div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#e67e00] to-[#ff9800] text-white flex items-center justify-center text-xl shrink-0 shadow-sm">
                  🛡️
                </div>
                <div>
                  <h4 className="font-black text-gray-900 text-base md:text-lg leading-snug">
                    Proteção Premium
                  </h4>
                  <span className="text-[11px] font-black text-[#e67e00]">
                    Franquia Zero
                  </span>
                </div>
              </div>
              <span className="text-[10px] bg-[#e67e00] text-white px-2.5 py-1 rounded-full font-black uppercase tracking-wider shadow-xs">
                ⭐ Recomendado
              </span>
            </div>

            {/* Franquia Zero */}
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 mb-5">
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block mb-0.5">
                Coparticipação em caso de sinistro:
              </span>
              <div className="text-xl md:text-2xl font-black text-[#008d36] flex items-center gap-1.5">
                <span>R$ 0,00</span>
                <span className="text-xs uppercase bg-[#008d36] text-white px-2 py-0.5 rounded font-black tracking-wider">
                  Zero Franquia
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 mt-1 leading-snug font-medium">
                Você não paga absolutamente nada em caso de avaria acidental, danos ou roubo do veículo.
              </p>
            </div>

            {/* Vantagens */}
            <ul className="space-y-3 mb-6 text-xs text-gray-800 font-medium">
              <li className="flex items-start gap-2.5">
                <span className="text-[#008d36] font-bold text-base shrink-0">✓</span>
                <span>
                  <strong>Isenção Total de Danos e Colisão (CDW):</strong> Reparos 100% cobertos sem franquia.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-[#008d36] font-bold text-base shrink-0">✓</span>
                <span>
                  <strong>Isenção Total em Roubo e Furto (THW):</strong> Sem cobrança de coparticipação.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-[#008d36] font-bold text-base shrink-0">✓</span>
                <span>
                  <strong>Caução Reduzida no Balcão:</strong> Menor limite de crédito pré-bloqueado na retirada.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-[#008d36] font-bold text-base shrink-0">✓</span>
                <span>
                  <strong>Devolução Rápida e Sem Estresse:</strong> Devolva o carro sem risco de cobranças extras.
                </span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-amber-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-auto">
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Upgrade por apenas</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl md:text-2xl font-black text-[#e67e00]">
                  + {currency} {fmtPrice(upgradeCost)}
                </span>
                {upgradeBRL > 0 && (
                  <span className="text-xs text-gray-600 font-bold">
                    (+ R$ {fmtPrice(upgradeBRL)})
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (zeroExcessUpgrade) {
                  setZeroExcessUpgrade(false);
                  const originalCar = cars.find(c => c.carCategoryCode === selectedCar?.carCategoryCode);
                  const originalEtoCar = etoCars.find(c => c.carCategoryCode === selectedCar?.carCategoryCode);
                  if (originalCar && originalEtoCar) {
                    const totalPriceETO = parseFloat(originalEtoCar.totalRateEstimate || "0") * (1 + etoMargin / 100);
                    const totalBRL_ETO = parseFloat(originalEtoCar.totalRateEstimateInBookingCurrency || "0") * (1 + etoMargin / 100);
                    setSelectedCar((prev: any) => ({
                      ...prev,
                      ...originalCar,
                      ...originalEtoCar,
                      totalRateEstimate: totalPriceETO.toFixed(2),
                      totalRateEstimateInBookingCurrency: totalBRL_ETO.toFixed(2),
                      optionalInsurances: originalCar.optionalInsurances,
                      imageUrl: prev.imageUrl,
                      _etoCID: '56935466'
                    }));
                  }
                } else {
                  setZeroExcessUpgrade(true);
                  setSelectedCar((prev: any) => ({
                    ...prev,
                    ...etoZeroCar,
                    totalRateEstimate: zeroTotal.toFixed(2),
                    totalRateEstimateInBookingCurrency: zeroBRL.toFixed(2),
                    optionalInsurances: prev?.optionalInsurances,
                    imageUrl: prev?.imageUrl,
                    _etoCID: '56935495'
                  }));
                }
              }}
              className={`font-black py-3 px-6 rounded-xl text-sm transition-all text-center shadow-md ${
                zeroExcessUpgrade 
                  ? 'bg-[#008d36] hover:bg-[#007530] text-white ring-2 ring-[#008d36]/20' 
                  : 'bg-[#e67e00] hover:bg-[#cc6f00] text-white shadow-[#e67e00]/25'
              }`}
            >
              {zeroExcessUpgrade ? '✓ Proteção Ativada' : 'Adicionar Proteção'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
})()}
```
