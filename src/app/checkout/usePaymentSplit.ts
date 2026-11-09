"use client";

/**
 * useEtoPaymentSplit — refaz a cotação no XRS no checkout (com os opcionais escolhidos)
 * e aplica a regra on-line (payer ba) × balcão (payer sem ba).
 *
 * - Só para tarifas ETO (POA segue o fluxo antigo, por decisão do negócio).
 * - Os opcionais (insuranceList type="O" e equipamentos) vão na requisição: o lado em que
 *   cada um cai é decidido pelo payer da linha retornada — nunca presumido.
 * - Markup ETO (margem do painel) aplicado SOMENTE ao bloco on-line.
 * - A cotação vai com o MESMO meio de pagamento do bookReservation ETO (mirrorEtoPayment),
 *   para o payer de cada linha ser o mesmo da reserva real no GW.
 * - Linha sem ba = balcão, SEMPRE (inclusive taxa de aeroporto e taxa de devolução em outra loja).
 *   Se nenhuma linha tiver ba, tudo vai para o balcão e nada é cobrado on-line.
 * - Só volta ao cálculo antigo (status "fallback") se a cotação falhar.
 */
import { useEffect, useRef, useState } from "react";
import { computePaymentSplit, type PaymentSplit } from "@/lib/europcar/paymentSplit";
import { isZeroExcessBooking } from "@/lib/europcar/protectionSummary";

// Mesma lista de códigos de proteção usada em api/reservas e bookXRS
const INSURANCE_CODES = ['TPL', 'LDW', 'CDW', 'THW', 'SCDW', 'SPCDW', 'STHW', 'SPTHW', 'MEDIUM', 'PREMIUM', 'PREMPRE', 'PREMUP', 'RSA', 'APP', 'PAI', 'PEP', 'SLDW', 'WWI', 'SPAI', 'INTERIOR', 'PREMPLUS'];

export type SplitStatus = "idle" | "loading" | "ready" | "fallback";

async function readMarkupPercent(booking: any): Promise<number> {
  const fromBooking = Number(booking?.etoMarginPercent);
  if (Number.isFinite(fromBooking)) return fromBooking;
  try {
    const country = booking?.stationCountry ? `?country=${encodeURIComponent(booking.stationCountry)}` : '';
    const r = await fetch(`/api/admin/margin${country}`, { cache: "no-store" });
    const d = await r.json();
    if (r.ok && typeof d?.percent === "number") return d.percent;
  } catch { /* ignora */ }
  throw new Error("margem ETO indisponível");
}

function buildOptionalLists(booking: any) {
  const extras: Record<string, number> = booking?.extras || {};
  const insurance = new Set<string>();
  const equipment = new Map<string, number>();
  for (const [code, qty] of Object.entries(extras)) {
    if (!(Number(qty) > 0)) continue;
    if (INSURANCE_CODES.includes(code)) insurance.add(code);
    else equipment.set(code, Math.max(equipment.get(code) || 0, Number(qty)));
  }
  for (const ins of booking?.xrsInsurances || []) {
    const code = ins?.code || ins;
    if (code) insurance.add(String(code));
  }
  for (const eq of booking?.xrsEquipment || []) {
    if (eq?.code && Number(eq.qty) > 0) equipment.set(eq.code, Math.max(equipment.get(eq.code) || 0, Number(eq.qty)));
  }
  return {
    insuranceList: [...insurance].map((code) => ({ code })),
    equipmentList: [...equipment.entries()].map(([code, qty]) => ({ code, qty })),
  };
}

export function useEtoPaymentSplit(booking: any, setBooking: (updater: (prev: any) => any) => void) {
  const [split, setSplit] = useState<PaymentSplit | null>(null);
  const [status, setStatus] = useState<SplitStatus>("idle");
  const requested = useRef(false);

  useEffect(() => {
    if (!booking || requested.current) return;
    if (booking.tariffType !== "ETO") return;
    requested.current = true;
    setStatus("loading");

    const persist = (next: any) => {
      try { sessionStorage.setItem("europcar_booking", JSON.stringify(next)); } catch { /* ignora */ }
      return next;
    };
    const fallback = (reason: string) => {
      console.warn(`[checkout] Regra on-line × balcão indisponível (${reason}) — usando cálculo antigo.`);
      setSplit(null);
      setStatus("fallback");
      setBooking((prev: any) => {
        if (!prev?.paymentSplit) return prev;
        const { paymentSplit: _old, ...rest } = prev;
        return persist(rest);
      });
    };

    (async () => {
      try {
        const car = booking.car || {};
        const markup = await readMarkupPercent(booking);
        const { insuranceList, equipmentList } = buildOptionalLists(booking);
        const res = await fetch("/api/europcar/getQuote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            carCategory: car.carCategoryCode,
            pickupStation: booking.pickupStation,
            returnStation: booking.returnStation || booking.pickupStation,
            pickupDate: booking.pickupDate,
            returnDate: booking.returnDate,
            pickupTime: booking.pickupTime,
            returnTime: booking.returnTime,
            contractID: booking.contractID,
            rateId: car.rateId || car.$?.rateId || "",
            prepaidMode: "PP",
            driverAge: booking.driverAge,
            xrsLanguage: booking.xrsLanguage,
            equipmentList,
            insuranceList,
            mirrorEtoPayment: true,
            stationCountry: booking.stationCountry,
          }),
        });
        const data = await res.json();
        const reservation = data?.message?.serviceResponse?.reservation || data?.serviceResponse?.reservation;
        if (!res.ok || data?._xrsError || !reservation) {
          fallback(data?._errorCode || `HTTP ${res.status}`);
          return;
        }
        const computed = computePaymentSplit(reservation, {
          onlineMarkupPercent: markup,
          isZeroExcess: isZeroExcessBooking(booking),
        });
        if (!computed) {
          fallback("cotação sem chargeList");
          return;
        }
        if (!computed.online) {
          // Regra: linha sem ba = balcão. Nenhuma linha com ba → tudo no balcão, nada on-line.
          console.warn(`[checkout] Cotação ETO sem nenhuma linha com payer ba (mirror=${data?._etoMirror}) — tudo a pagar no balcão.`);
        }
        setSplit(computed);
        setStatus("ready");
        setBooking((prev: any) => persist({ ...prev, paymentSplit: computed }));
      } catch (err: any) {
        fallback(err?.message || "erro");
      }
    })();
  }, [booking, setBooking]);

  return { split, status };
}
