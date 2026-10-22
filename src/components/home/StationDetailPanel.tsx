"use client";

interface Props {
  hovered: any;
  detail: any;
  loading: boolean;
  onSelect: (station: any) => void;
  t: (key: string) => string;
}

/**
 * Painel de detalhes da estação (Europcar style) — usado tanto na retirada
 * quanto na devolução, para manter o mesmo padrão visual (verde Europcar),
 * com endereço, telefone, e-mail, horários e mapa.
 *
 * Importante: o `detail` só é usado se pertencer à estação em hover
 * (evita exibir dados de outra loja por respostas fora de ordem).
 */
export default function StationDetailPanel({ hovered, detail: rawDetail, loading, onSelect, t }: Props) {
  if (!hovered) return null;

  const sameCode = (a?: string, b?: string) =>
    String(a || "").toUpperCase() === String(b || "").toUpperCase();
  const detail = rawDetail && sameCode(rawDetail.code, hovered.code) ? rawDetail : null;
  const isLoading = loading;

  const name = detail?.name || hovered.name;
  const address = detail?.address || hovered.address;
  const lat = detail?.latitude || hovered.latitude;
  const lng = detail?.longitude || hovered.longitude;
  const phone = detail?.phone || "";
  const email = detail?.email || "";
  const hours: any[] = detail?.hours?.length ? detail.hours : hovered.hours || [];

  return (
    <div className="hidden md:flex flex-col flex-1 overflow-y-auto">
      <div className="flex flex-1 min-h-0">
        {/* Station info */}
        <div className="w-[260px] shrink-0 p-5 flex flex-col overflow-y-auto border-r border-gray-100">
          <h3 className="font-black text-sm uppercase text-gray-900 leading-tight">{name}</h3>
          <div className="mt-1.5 text-[11px] text-gray-500 leading-relaxed">
            {address && <div>{address}</div>}
            {detail?.postalCode && <div>{detail.postalCode} {detail?.city || ""}</div>}
            {hovered.country && <div className="uppercase font-medium text-gray-400">{hovered.country}</div>}
          </div>

          {/* Contato */}
          {(phone || email) && (
            <div className="mt-3 flex flex-col gap-1">
              {phone && (
                <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-1.5 text-[11px] text-gray-700 hover:text-[#008d36]">
                  <svg className="w-3.5 h-3.5 text-[#008d36] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  <span className="font-bold">{phone}</span>
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`} className="flex items-center gap-1.5 text-[11px] text-gray-700 hover:text-[#008d36] break-all">
                  <svg className="w-3.5 h-3.5 text-[#008d36] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  <span>{email}</span>
                </a>
              )}
            </div>
          )}

          {/* Features */}
          {isLoading ? (
            <div className="mt-4 flex flex-col gap-2">
              <div className="h-3.5 bg-gray-100 rounded animate-pulse w-3/4"></div>
              <div className="h-3.5 bg-gray-100 rounded animate-pulse w-1/2"></div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              {Boolean(detail?.has247Return ?? detail?.features?.has247Return) && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#008d36] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                  <span className="text-xs font-bold text-gray-700">Devolução 24/7</span>
                </div>
              )}
              {Boolean(detail?.hasOutOfHours ?? detail?.features?.hasOutOfHours) && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm shrink-0">🕐</span>
                  <span className="text-xs font-bold text-gray-700">{t("station.outOfHours")}</span>
                </div>
              )}
              {Boolean(detail?.hasElectricVehicles ?? detail?.features?.hasElectricVehicles) && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#008d36] shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M7 2v11h3v9l7-12h-4l4-8z" /></svg>
                  <span className="text-xs font-bold text-gray-700">{t("station.electricVehicles")}</span>
                </div>
              )}
              {Boolean(detail?.features?.hasMeetAndGreet) && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm shrink-0">🤝</span>
                  <span className="text-xs font-bold text-gray-700">{t("station.meetAndGreet")}</span>
                </div>
              )}
              {Boolean(detail?.features?.hasShuttle) && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm shrink-0">🚐</span>
                  <span className="text-xs font-bold text-gray-700">{t("station.transferShuttle")}</span>
                </div>
              )}
              {Boolean(detail?.hasLunchBreak ?? detail?.features?.hasLunchBreak) && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700 font-bold">
                  <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span>{t("station.lunchBreak")}</span>
                </div>
              )}
            </div>
          )}

          {/* Horários */}
          <div className="mt-3 flex-1">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#008d36]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {t("station.operatingHours")}
            </div>
            {isLoading && !hours.length ? (
              <div className="flex gap-1.5 items-center text-[11px] text-gray-400">
                <div className="w-3 h-3 border-2 border-[#008d36] border-t-transparent rounded-full animate-spin"></div>
                Consultando horários...
              </div>
            ) : hours.length ? (
              <div className="flex flex-col gap-0">
                {hours.map((h: any, i: number) => {
                  const isClosed = h.isClosed || (!h.open && !h.hours && (!h.intervals || !h.intervals.length));
                  const multi = Boolean(h.intervals && h.intervals.length > 1);
                  return (
                    <div key={i} className="flex justify-between items-start text-[11px] py-0.5 border-b border-gray-50 last:border-0">
                      <span className="font-bold text-gray-700 w-12 shrink-0 uppercase">{h.day}:</span>
                      {isClosed ? (
                        <span className="text-red-500 font-bold">Fechado</span>
                      ) : multi ? (
                        <div className="flex flex-col items-end gap-0.5">
                          {h.intervals.map((inv: any, idx: number) => (
                            <span key={idx} className="text-gray-700 font-medium whitespace-nowrap">{inv.open} - {inv.close}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-700 font-medium">
                          {h.intervals?.[0] ? `${h.intervals[0].open} - ${h.intervals[0].close}` : h.hours || `${h.open} - ${h.close}`}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 italic">Consulte a loja.</p>
            )}
          </div>

          <button type="button" onClick={() => onSelect(hovered)} className="mt-3 w-full bg-[#008d36] hover:bg-[#007530] text-white font-bold text-xs py-2.5 rounded transition-colors shrink-0">
            Selecionar esta loja
          </button>
        </div>

        {/* Google Maps */}
        <div className="flex-1 bg-gray-100 min-h-[300px]">
          {lat && lng ? (
            <iframe
              key={`${lat},${lng}`}
              className="w-full h-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps?q=${lat},${lng}&z=14&output=embed`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
              <div className="text-center">
                <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {isLoading ? "Carregando mapa..." : "Mapa indisponível"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
