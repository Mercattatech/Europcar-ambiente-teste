"use client";

import Link from "next/link";
import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useSession, signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import LoginModal from "@/components/auth/LoginModal";
import { LanguageSelector, useLanguage } from "@/lib/i18n/LanguageContext";
import { parsePayerList, type PayerSplit } from "@/lib/europcar/parsePayerList";
import { DEFAULT_POA_CID, SECONDARY_POA_CID } from "@/lib/europcar/xrsClient";
import { calculateRentalDays, formatRentalDays } from "@/lib/europcar/rentalDuration";

function getVehicleType(car: any): string {
  const code = (car.carCategoryCode || "").toUpperCase();
  const c3 = code[2] || '';
  if (c3 === 'F' || c3 === 'G' || c3 === 'K') return "SUV";
  if (c3 === 'V') return "Van / Minivan";
  if (code.startsWith("M") || code.startsWith("N")) return "Mini";
  if (code.startsWith("E")) return "Econômico";
  if (code.startsWith("C")) return "Compacto";
  if (code.startsWith("I") || code.startsWith("J")) return "Intermediário";
  if (code.startsWith("S") || code.startsWith("F") || code.startsWith("G")) return "Standard";
  if (code.startsWith("P") || code.startsWith("L") || code.startsWith("U") || code.startsWith("W")) return "Premium";
  return "Carro";
}

// Multi-source car image: official API URL → sample name → ACRISS code → placeholder
function CarImage({ sample, code, alt, imageUrl, overrideUrl }: { sample: string; code: string; alt: string; imageUrl?: string, overrideUrl?: string }) {
  const sources = [
    // 0. Custom override from admin panel
    overrideUrl || null,
    // 1. Official image from XRS API (carvisual link — HD 835x557)
    imageUrl || null,
    // 2. By brand/model name from carCategorySample
    sample ? (() => {
      const parts = sample.split(" ");
      const brand = parts[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      const model = parts.slice(1, 3).join("-").toLowerCase().replace(/[^a-z0-9-]/g, "");
      return `https://www.europcar.com/vehicles/images/223/cars/${brand}/${model}.png`;
    })() : null,
    // 3. By ACRISS category code
    code ? `https://static.europcar.com/carvisuals/partners/835x557/${code}_IT.png` : null,
    // 4. Generic placeholder
    `https://placehold.co/400x200/f5f5f5/008d36?text=${encodeURIComponent(code || "CAR")}`,
  ].filter(Boolean) as string[];

  const [srcIdx, setSrcIdx] = useState(0);

  return (
    <img
      src={sources[srcIdx]}
      alt={alt}
      onError={() => { if (srcIdx < sources.length - 1) setSrcIdx(i => i + 1); }}
      className="object-contain w-full h-full mix-blend-multiply"
    />
  );
}

// Visual ilustrativo dos extras nos mesmos moldes do site oficial da Europcar
function EquipmentVisual({ code, icon }: { code: string; icon?: string }) {
  const c = (code || '').toUpperCase();
  if (c === 'ADD' || c === 'ADR') {
    return (
      <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="22" fill="#F0FDF4" />
        <circle cx="24" cy="18" r="6" fill="#008d36" />
        <path d="M12 36c0-5 5.3-8 12-8s12 3 12 8" fill="#008d36" opacity="0.85" />
        <circle cx="34" cy="30" r="7" fill="#1F2937" />
        <circle cx="34" cy="30" r="5" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3 2" fill="none" />
        <circle cx="34" cy="30" r="2" fill="#FFFFFF" />
      </svg>
    );
  }
  if (c === 'NVS' || c === 'NAV') {
    return (
      <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none">
        <rect x="6" y="11" width="36" height="25" rx="4" fill="#1F2937" />
        <rect x="9" y="14" width="30" height="19" rx="2" fill="#E0F2FE" />
        <path d="M11 28l9-7 7 4 10-10" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="35" cy="17" r="3" fill="#EF4444" />
        <path d="M19 36l-2 5h14l-2-5" fill="#6B7280" />
      </svg>
    );
  }
  if (c === 'CSB' || c === 'CSI') {
    return (
      <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none">
        <rect x="13" y="7" width="22" height="32" rx="6" fill="#DC2626" />
        <rect x="16" y="10" width="16" height="18" rx="4" fill="#1F2937" />
        <path d="M11 26h26v10a4 4 0 01-4 4H15a4 4 0 01-4-4v-10z" fill="#1F2937" />
        <path d="M24 16v13M19 23h10" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (c === 'CST') {
    return (
      <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none">
        <rect x="14" y="6" width="20" height="34" rx="5" fill="#374151" />
        <rect x="17" y="9" width="14" height="17" rx="3" fill="#111827" />
        <path d="M12 26h24v9a4 4 0 01-4 4H16a4 4 0 01-4-4v-9z" fill="#111827" />
        <circle cx="24" cy="23" r="2.5" fill="#008d36" />
      </svg>
    );
  }
  if (c === 'CBS' || c === 'BST') {
    return (
      <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="22" width="32" height="14" rx="4" fill="#1F2937" />
        <path d="M8 25c0-5 3.5-9 8-9h16c4.5 0 8 4 8 9" stroke="#4B5563" strokeWidth="3" />
        <rect x="12" y="24" width="24" height="8" rx="2" fill="#374151" />
      </svg>
    );
  }
  if (c === 'YOU' || c === 'JAC') {
    return (
      <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="22" fill="#FEF3C7" />
        <circle cx="24" cy="18" r="6" fill="#D97706" />
        <path d="M13 36c0-5 5-8 11-8s11 3 11 8" fill="#D97706" />
        <path d="M18 15c2-4 10-4 12 0" stroke="#92400E" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (c === 'CBF' || c === 'LRC') {
    return (
      <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="20" fill="#E0F2FE" stroke="#0284C7" strokeWidth="2" />
        <ellipse cx="24" cy="24" rx="10" ry="20" stroke="#0284C7" strokeWidth="1.5" />
        <path d="M4 24h40M7 14h34M7 34h34" stroke="#0284C7" strokeWidth="1.5" />
      </svg>
    );
  }
  if (c === 'SNO' || c === 'CHN') {
    return (
      <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="20" fill="#1F2937" />
        <circle cx="24" cy="24" r="12" fill="#374151" />
        <circle cx="24" cy="24" r="5" fill="#9CA3AF" />
        <path d="M13 14l22 20M13 34l22-20M6 24h36M24 6v36" stroke="#E5E7EB" strokeWidth="1.5" strokeDasharray="3 2" />
      </svg>
    );
  }
  if (c === 'SKR' || c === 'SKB' || c === 'SKV') {
    return (
      <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none">
        <rect x="6" y="27" width="36" height="4" rx="2" fill="#1F2937" />
        <rect x="10" y="31" width="4" height="6" rx="1" fill="#4B5563" />
        <rect x="34" y="31" width="4" height="6" rx="1" fill="#4B5563" />
        <path d="M12 11l20 20M17 9l20 20" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  return <span className="text-2xl">{icon || '📦'}</span>;
}

// ---- Inner component (needs useSearchParams inside Suspense) ----
function VehiclesContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedCar, setSelectedCar] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(2);
  const [carImageOverrides, setCarImageOverrides] = useState<Record<string, string>>({});
  const [carCategoryOverrides, setCarCategoryOverrides] = useState<Record<string, string>>({});
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  // On-request modal
  const [onRequestModal, setOnRequestModal] = useState<{ car: any; tariff: 'POA' | 'ETO' } | null>(null);
  // Set of carCodes marked as on-request in admin
  const [onRequestCarCodes, setOnRequestCarCodes] = useState<Set<string>>(new Set());

  // URL params
  const pickupStation = searchParams.get("pickup") || "";
  const returnStation = searchParams.get("return") || pickupStation;
  const pickupDate = searchParams.get("date") || "";
  const pickupTime = (searchParams.get("time") || "1000").replace(":", "");
  const returnTime = (searchParams.get("returnTime") || searchParams.get("time") || "1000").replace(":", "");
  const contractID = searchParams.get("contractID") || "";
  const driverCountry = searchParams.get("country") || "BR";
  const driverCountryName = searchParams.get("countryName") || "Brasil";
  const stationCountry = searchParams.get("stationCountry") || "";

  // Driver age — from search form dropdown (18-25 or "26+")
  // Convert "26+" to numeric 30 (above young driver threshold, below senior)
  const rawAge = searchParams.get("age") || "26+";
  const driverAge: number = rawAge === "26+" ? 30 : parseInt(rawAge, 10) || 30;

  // I18N: Map stationCountry to XRS language code for preferredLanguage
  const COUNTRY_TO_XRS_LANG: Record<string, string> = {
    US: 'EN', GB: 'EN', AU: 'EN', CA: 'EN', IE: 'EN',
    BR: 'PT', PT: 'PT',
    ES: 'ES', AR: 'ES', CL: 'ES', MX: 'ES', CO: 'ES',
    FR: 'FR', BE: 'FR', CH: 'FR',
    DE: 'DE', AT: 'DE',
    IT: 'IT',
    NL: 'NL',
    PL: 'PL',
    CZ: 'CS',
    HU: 'HU',
    RO: 'RO',
    SE: 'SV',
    DK: 'DA',
    FI: 'FI',
    NO: 'NO',
    GR: 'EL',
    BG: 'BG',
    HR: 'HR',
    SK: 'SK',
    UA: 'UK',
  };
  const xrsLanguage = COUNTRY_TO_XRS_LANG[stationCountry?.toUpperCase() || ''] || 'PT';

  // Duração oficial retornada pela API XRS (getMultipleRates / getQuote)
  const [apiRentalDuration, setApiRentalDuration] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/cars/images')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const map = data.reduce((acc: any, item: any) => ({ ...acc, [item.carCode]: item.imageUrl }), {});
          setCarImageOverrides(map);
        }
      })
      .catch(console.error);

    fetch('/api/cars/categories')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const nameMap = data.reduce((acc: any, item: any) => ({ ...acc, [item.carCode]: item.friendlyName }), {});
          setCarCategoryOverrides(nameMap);
          // Extract on-request codes
          const onReqSet = new Set<string>(data.filter((item: any) => item.onRequest).map((item: any) => item.carCode as string));
          setOnRequestCarCodes(onReqSet);
        }
      })
      .catch(console.error);
  }, []);

  // Auto-compute returnDate (+3 days) if not in URL
  const returnDate = useMemo(() => {
    const rd = searchParams.get("returnDate");
    if (rd) return rd;
    if (!pickupDate || pickupDate.length < 8) return "";
    const y = parseInt(pickupDate.slice(0, 4));
    const m = parseInt(pickupDate.slice(4, 6)) - 1;
    const d = parseInt(pickupDate.slice(6, 8));
    const dt = new Date(y, m, d + 3);
    return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}`;
  }, [searchParams, pickupDate]);

  // Calculate duration in days (ciclos de 24h + tolerância do país + prioridade da API XRS)
  const bookingDurationDays = useMemo(() => {
    return calculateRentalDays({
      pickupDate,
      pickupTime,
      returnDate,
      returnTime,
      station: pickupStation,
      country: stationCountry || driverCountry,
      apiDuration: selectedCar?.duration || apiRentalDuration,
    });
  }, [pickupDate, pickupTime, returnDate, returnTime, pickupStation, stationCountry, driverCountry, selectedCar?.duration, apiRentalDuration]);

  // contractID from sessionStorage
  const [sessionContractID, setSessionContractID] = useState("");
  useEffect(() => {
    try { setSessionContractID(sessionStorage.getItem("europcar_contractID") || ""); } catch { }
  }, []);
  const effectiveContractID = contractID || sessionContractID;

  // Station name display
  const isOneWay = returnStation !== pickupStation;
  const [stationName, setStationName] = useState(pickupStation);
  const [returnStationName, setReturnStationName] = useState(returnStation);
  useEffect(() => {
    if (!pickupStation) return;
    fetch(`/api/europcar/getStations?q=${pickupStation}`)
      .then(r => r.json())
      .then(d => {
        const s = d.stations?.find((x: any) => x.code === pickupStation);
        if (s) setStationName(s.name);
      }).catch(() => { });
  }, [pickupStation]);

  // Resolve return station name (One-Way)
  useEffect(() => {
    if (!isOneWay || !returnStation) return;
    fetch(`/api/europcar/getStations?q=${returnStation}`)
      .then(r => r.json())
      .then(d => {
        const s = d.stations?.find((x: any) => x.code === returnStation);
        if (s) setReturnStationName(s.name);
      }).catch(() => { });
  }, [returnStation, isOneWay]);

  // Station features (shuttle, delivery, terminal type)
  const [pickupStationInfo, setPickupStationInfo] = useState<any>(null);
  useEffect(() => {
    if (!pickupStation) return;
    fetch(`/api/europcar/getStation?stationCode=${pickupStation}`)
      .then(r => r.json())
      .then(d => {
        if (d.station) setPickupStationInfo(d.station);
      }).catch(() => { });
  }, [pickupStation]);

  // XRS cars state
  const [cars, setCars] = useState<any[]>([]);
  const [etoCars, setEtoCars] = useState<any[]>([]);      // ETO Com Excesso rates
  const [etoZeroCars, setEtoZeroCars] = useState<any[]>([]); // ETO Zero Excesso rates
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [step3Error, setStep3Error] = useState<string | null>(null);

  // Equipment from getMultipleRates (serviceResponse.reservation.equipmentList)
  // Contains equipment with full pricing — replaces the old getEquipmentList call
  const [ratesEquipment, setRatesEquipment] = useState<any[]>([]);

  // ETO margin from admin panel
  const [etoMargin, setEtoMargin] = useState(0);
  // false até a margem ser lida com sucesso; sem ela não oferecemos "Pagar agora" (evita vender ETO sem markup)
  const [etoMarginReady, setEtoMarginReady] = useState(false);

  // Selected tariff type per car
  const [selectedTariffType, setSelectedTariffType] = useState<'POA' | 'ETO'>('POA');

  // Zero Excess upgrade (upsell on Step 3)
  const [zeroExcessUpgrade, setZeroExcessUpgrade] = useState(false);

  // Extras
  const [dbExtras, setDbExtras] = useState<any[]>([]);
  const [selectedExtrasMap, setSelectedExtrasMap] = useState<Record<string, number>>({});
  const [selectedProtectionPackage, setSelectedProtectionPackage] = useState<'none' | 'basic' | 'medium' | 'premium'>('none');
  const [expandedPackages, setExpandedPackages] = useState<Set<string>>(new Set());
  const [loadingExtras, setLoadingExtras] = useState(false);

  // XRS Equipment (accessories from API)
  const [xrsEquipment, setXrsEquipment] = useState<any[]>([]);
  const [selectedEquipmentMap, setSelectedEquipmentMap] = useState<Record<string, number>>({});
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  // Equipment prices fetched from getQuote: { code: { price, priceBRL, currency } }
  const [equipmentPrices, setEquipmentPrices] = useState<Record<string, { price: number; priceBRL: number; totalBRL: number; currency: string; exchangeRate: number; onRequest: boolean }>>({});
  // Track if we already fetched Step 3 data for the selected car
  const [step3FetchedCarCategory, setStep3FetchedCarCategory] = useState<string | null>(null);
  // Quote insurances from getQuote API (real data for the selected vehicle)
  const [quoteInsurances, setQuoteInsurances] = useState<any[]>([]);
  // Quote mileage data from getQuote API
  const [quoteMileage, setQuoteMileage] = useState<{ includedKm: number; totalIncludedDist: number; extraKmPrice: number; extraKmPriceBRL: number; includedKmType: string; currency: string } | null>(null);
  // Quote totals (e.g. amount to pay on arrival)
  const [quoteTotals, setQuoteTotals] = useState<any>(null);
  // PayerSplit from XRS payerList (chargesDetail=TRE) — quem paga o quê
  const [payerSplit, setPayerSplit] = useState<PayerSplit | null>(null);

  // ETO protection skip state
  const [protectionsSkipped, setProtectionsSkipped] = useState(false);

  // International Banner from /painel
  const [intlBanner, setIntlBanner] = useState<{ enabled: boolean; title: string; line1: string; line2: string; line3: string; bgColor: string } | null>(null);

  // Filters
  const [transmission, setTransmission] = useState("Ambos");
  const [vehicleType, setVehicleType] = useState("Todos");
  const [minSeats, setMinSeats] = useState(2);
  const [sortBy, setSortBy] = useState("Recomendado");
  const [selectedMinPrice, setSelectedMinPrice] = useState<number | null>(null);
  const [selectedMaxPrice, setSelectedMaxPrice] = useState<number | null>(null);

  // Promo modal for Balcão (Pagar no balcão)
  const [showBalcaoPromoModal, setShowBalcaoPromoModal] = useState(false);
  const [pendingPoaSelection, setPendingPoaSelection] = useState<{ car: any; etoCar: any; totalPriceETO: number; totalBRL_ETO: number } | null>(null);
  const [promoPopupConfig, setPromoPopupConfig] = useState<any>(null);

  useEffect(() => {
    fetch("/api/admin/config/promo-popup")
      .then(res => res.json())
      .then(data => setPromoPopupConfig(data))
      .catch(() => {});
  }, []);

  const handleConfirmEtoFromModal = () => {
    if (pendingPoaSelection) {
      const { car, etoCar, totalPriceETO, totalBRL_ETO } = pendingPoaSelection;
      setSelectedTariffType('ETO');
      const merged = {
        ...car,
        ...etoCar,
        totalRateEstimate: totalPriceETO.toFixed(2),
        totalRateEstimateInBookingCurrency: totalBRL_ETO.toFixed(2),
        optionalInsurances: car.optionalInsurances,
        imageUrl: car.imageUrl,
        _etoCID: '56935466'
      };
      handleSelectCar(merged);
    }
    setShowBalcaoPromoModal(false);
    setPendingPoaSelection(null);
  };

  const handleConfirmPoaFromModal = () => {
    if (pendingPoaSelection) {
      setSelectedTariffType('POA');
      handleSelectCar(pendingPoaSelection.car);
    }
    setShowBalcaoPromoModal(false);
    setPendingPoaSelection(null);
  };

  const formatDate = (d: string) => d ? `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}` : "";

  // ---- Fetch vehicles from XRS (POA + ETO in parallel) ----
  const fetchCars = useCallback(async () => {
    if (!pickupStation || !pickupDate) {
      setError("Dados de pesquisa incompletos. Volte e tente novamente.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      // Step 1: getCarCategories → get ACRISS codes (use POA CID)
      const poaCID = DEFAULT_POA_CID;
      const poaCID2 = SECONDARY_POA_CID;
      const etoCID = '56935466'; // ETO Líquido (Com Excesso) — desconto maior

      const catRes = await fetch("/api/europcar/getCarCategories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          pickupStation, 
          returnStation: returnStation || pickupStation, 
          pickupDate, 
          returnDate, 
          pickupTime, 
          returnTime,
          contractID: effectiveContractID || poaCID
        }),
      });
      const catData = await catRes.json();

      // Check for One-Way restriction error
      const serviceResponse = catData?.message?.serviceResponse || catData?.serviceResponse;
      const errorCode = serviceResponse?.$.errorCode || serviceResponse?.errorCode || '';
      if (errorCode === 'rental.onewaynotallowed') {
        setError('Não é possível devolver neste local. A Europcar não permite devolução entre as estações selecionadas. Tente selecionar outras estações.');
        setLoading(false);
        return;
      }

      const rawCatList =
        catData?.message?.serviceResponse?.carCategoryList?.carCategory ||
        catData?.serviceResponse?.carCategoryList?.carCategory || [];
      const catList: any[] = Array.isArray(rawCatList) ? rawCatList : rawCatList ? [rawCatList] : [];

      const acrissCodes = catList
        .map((c: any) => (c.$ ? c.$.carCategoryCode : c.carCategoryCode))
        .filter(Boolean);

      const catDetailsMap = catList.reduce((acc: any, c: any) => {
        const attrs = c.$ || c;
        if (attrs.carCategoryCode) {
          acc[attrs.carCategoryCode] = attrs;
        }
        return acc;
      }, {});

      if (acrissCodes.length === 0) {
        const returnCode = serviceResponse?.$?.returnCode || serviceResponse?.returnCode || '';
        if (returnCode === 'KO') {
          setError('Não foi possível buscar veículos para este trajeto. Verifique as estações selecionadas e tente novamente.');
        } else {
          setError('Nenhum veículo disponível para esta estação e período.');
        }
        setLoading(false);
        return;
      }

      // Step 2: getMultipleRates — POA (57269673 + 55138134) + ETO em paralelo
      const ratesBody = (cid: string) => ({
        pickupStation,
        returnStation: returnStation || pickupStation,
        pickupDate,
        returnDate,
        pickupTime,
        returnTime,
        acrissCodes,
        contractID: cid,
        driverAge,
        xrsLanguage,
      });

      // Skip ETO fetches for Brazilian stations (Brazil = POA only)
      const isBrazilStation = stationCountry === 'BR' || pickupStation.startsWith('BR');

      const fetchPoa1 = fetch("/api/europcar/getMultipleRates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ratesBody(effectiveContractID || poaCID)),
      });

      const fetchPoa2 = effectiveContractID ? Promise.resolve(null) : fetch("/api/europcar/getMultipleRates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ratesBody(poaCID2)),
      }).catch(() => null);

      const [poaRatesRes1, poaRatesRes2, etoRatesRes, etoZeroRatesRes] = await Promise.all([
        fetchPoa1,
        fetchPoa2,
        isBrazilStation ? Promise.resolve(null) : fetch("/api/europcar/getMultipleRates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ratesBody(etoCID)),
        }).catch(() => null),
        isBrazilStation ? Promise.resolve(null) : fetch("/api/europcar/getMultipleRates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ratesBody('56935495')),
        }).catch(() => null),
      ]);

      // ── Parse rates + extract equipmentList from serviceResponse.reservation ──
      // The equipmentList with full pricing lives at serviceResponse.reservation.equipmentList
      // (NOT inside each reservationRate). Per Antonio (XRS support), this replaces getEquipmentList.
      const parseRates = (ratesData: any, specsMap: any, defaultCid?: string): { rates: any[]; equipment: any[] } => {
        const allRates: any[] = [];
        let allEquipment: any[] = [];
        if (!ratesData) return { rates: allRates, equipment: allEquipment };
        const chunks = Array.isArray(ratesData.results) ? ratesData.results : [ratesData];
        for (const chunk of chunks) {
          // ── Extract equipmentList & duration from serviceResponse.reservation node ──
          const reservation =
            chunk?.message?.serviceResponse?.reservation ||
            chunk?.serviceResponse?.reservation;
          const chunkDurationStr = reservation?.$?.duration || reservation?.duration;
          const parsedChunkDuration = chunkDurationStr ? parseInt(String(chunkDurationStr), 10) : undefined;
          if (parsedChunkDuration && parsedChunkDuration > 0) {
            setApiRentalDuration(prev => prev || parsedChunkDuration);
          }
          if (reservation?.equipmentList) {
            const eqRaw = reservation.equipmentList.equipment;
            const eqArr: any[] = Array.isArray(eqRaw) ? eqRaw : eqRaw ? [eqRaw] : [];
            for (const eq of eqArr) {
              const a = eq.$ || eq;
              const code = (a.code || '').toString().trim().toUpperCase();
              const statusCode = (a.statusCode || 'F').toString().trim().toUpperCase();
              if (statusCode === 'U') continue; // skip unavailable
              allEquipment.push({
                code,
                price:                         parseFloat(a.price || '0'),
                priceInBookingCurrency:        parseFloat(a.priceInBookingCurrency || '0'),
                rentalPriceAI:                 parseFloat(a.rentalPriceAI || '0'),
                rentalPriceInBookingCurrencyAI:parseFloat(a.rentalPriceInBookingCurrencyAI || '0'),
                rentalMax:                     parseFloat(a.rentalMax || '0'),
                rentalMaxAI:                   parseFloat(a.rentalMaxAI || '0'),
                rentalMaxInBookingCurrencyAI:  parseFloat(a.rentalMaxInBookingCurrencyAI || '0'),
                tax:                           parseFloat(a.tax || '0'),
                per:                           a.per || 'D',  // D=per day, R=per rental
                qty:                           parseInt(a.qty || '1'),
                statusCode,
                onRequest:                     statusCode === 'R',
                type:                          a.type || 'O',
                descr:                         a.descr || '',
              });
            }
          }

          const rawList =
            chunk?.message?.serviceResponse?.reservationRateList?.reservationRate ||
            chunk?.serviceResponse?.reservationRateList?.reservationRate || [];
          const rateArr: any[] = Array.isArray(rawList) ? rawList : rawList ? [rawList] : [];
          for (const r of rateArr) {
            const attrs = r.$ || r;
            if (!attrs.carCategoryCode || !attrs.totalRateEstimate) continue;
            // ── Filtro de segurança: categoria DEVE constar nas categorias operadas pela estação ──
            if (acrissCodes.length > 0 && !acrissCodes.includes(attrs.carCategoryCode)) continue;
            if (attrs.statusCode === 'U') continue; // U = Unavailable
            const linksRaw = r.links?.link || [];
            const linksArr: any[] = Array.isArray(linksRaw) ? linksRaw : [linksRaw];
            const carvisual = linksArr.find((l: any) => (l.$ || l).id === "carvisual");
            const imageUrl: string = (carvisual?.$ || carvisual)?.value || "";
            const rawIns = r.insuranceList?.insurance || [];
            const insArr: any[] = Array.isArray(rawIns) ? rawIns : [rawIns];
            const optionalInsurances = insArr
              .map((ins: any) => ins.$ || ins)
              .filter((ins: any) => ins.type === "O" && parseFloat(ins.price || "0") > 0);

            // Extract basic protections (included)
            const includedInsurances = insArr
              .map((ins: any) => ins.$ || ins)
              .filter((ins: any) => ins.type === "M" || ins.type === "I");

            let mileageType = "Controlado";
            let mileageLimit = "";
            let mileageUnit = "km";
            let extraMileageCost = "";

            // getMultipleRates returns mileage as root attributes on reservationRate
            const inclKm = attrs.includedKm || attrs.includedKmScr || "";
            const kmType = attrs.includedKmType || "D"; // D=per day, R=rental period
            const kmUnit = attrs.includedKmUnit || "K"; // K=km, M=miles

            if (inclKm === "UNLIMITED" || inclKm === "ILLIMITE" || inclKm === "ILIMITADO") {
              mileageType = "Livre";
            } else if (inclKm && inclKm !== "0") {
              mileageType = "Controlado";
              mileageLimit = inclKm;
              mileageUnit = kmUnit === "M" ? "milhas" : "km";
            } else {
              // Fallback: check distance child node
              const distanceRaw = r.distance;
              const distance = distanceRaw?.$ || distanceRaw;
              if (distance) {
                if (distance.unlimitedDistance === "Y" || distance.unlimited === "Y" || distance.unlimitedMileage === "Y") {
                  mileageType = "Livre";
                } else {
                  const distVal = distance.distanceValue || distance.includedDistance || distance.quantity || distance.freeDistance || distance.value || "";
                  if (distVal) mileageLimit = String(distVal);
                  mileageUnit = (distance.unit === "M" || distance.distUnit === "M") ? "milhas" : "km";
                }
                const extraRate = distance.extraDistanceRate || distance.extraMileageRate || distance.surchargeRate || "";
                if (extraRate) extraMileageCost = String(extraRate);
              }
            }

            // Extract deductible/excess from included insurances
            let deductibleAmount = "";
            let deductibleCurrency = "";
            const allInsForDeductible = insArr.map((ins: any) => ins.$ || ins);
            // Look for CDW or basic protection with deductible
            const cdwIns = allInsForDeductible.find((ins: any) => 
              (ins.code === "CDW" || ins.code === "TP" || ins.code === "TPC" || ins.type === "M") && ins.deductible
            );
            if (cdwIns) {
              deductibleAmount = cdwIns.deductible;
              deductibleCurrency = cdwIns.deductibleCurrency || attrs.currency || 'BRL';
            }
            // Fallback: check for any insurance with deductible
            if (!deductibleAmount) {
              const anyWithDeductible = allInsForDeductible.find((ins: any) => ins.deductible);
              if (anyWithDeductible) {
                deductibleAmount = anyWithDeductible.deductible;
                deductibleCurrency = anyWithDeductible.deductibleCurrency || attrs.currency || "BRL";
              }
            }
            // XRS informa a franquia em excessWithPOM (moeda local) / bkExcessWithPOM (moeda de pagamento).
            // Usa a proteção incluída/obrigatória (pacote Básico) com franquia > 0.
            if (!deductibleAmount) {
              const basicWithExcess = allInsForDeductible.find((ins: any) =>
                (ins.type === 'I' || ins.type === 'M') && parseFloat(ins.excessWithPOM || '0') > 0
              );
              if (basicWithExcess) {
                deductibleAmount = basicWithExcess.excessWithPOM;
                deductibleCurrency = attrs.currency || 'BRL';
              }
            }

            // Extract ageLimit from the reservationRate node
            const ageLimit = r.ageLimit?.$ || r.ageLimit || {};
            const minAgeForCategory = ageLimit.minAgeForCategory || attrs.minAgeForCategory || '';
            const youngDriverAge = ageLimit.youngDriverAge || '';
            const minAgeForCountry = ageLimit.minAgeForCountry || '';
            const maxAgeForCountry = ageLimit.maxAgeForCountry || '';
            const minLicencePeriod = ageLimit.minLicencePeriod || '';

            // Build specs from the reservationRate attributes directly (all fields come from API)
            const specsFromRate = {
              carCategorySeats:           attrs.carCategorySeats || '',
              carCategoryDoors:           attrs.carCategoryDoors || '',
              carCategoryAirCond:         attrs.carCategoryAirCond || '',
              carCategoryAutomatic:       attrs.carCategoryAutomatic || '',
              carCategoryBaggageQuantity: attrs.carCategoryBaggageQuantity || '',
              carCategoryPowerHP:         attrs.carCategoryPowerHP || '',
              carCategoryPowerKW:         attrs.carCategoryPowerKW || '',
              carCategoryCO2Quantity:     attrs.carCategoryCO2Quantity || '',
              carCategoryType:            attrs.carCategoryType || '',
              carCategoryFuelType:        attrs.fuelTypeCode || '',
              carCategoryModelHeight:     attrs.carCategoryModelHeight || '',
              carCategoryModelLength:     attrs.carCategoryModelLength || '',
              carCategoryModelWidth:      attrs.carCategoryModelWidth || '',
              carCategoryModelGuaranteed: attrs.carCategoryModelGuaranteed || '',
              carCategoryMinDriverAge:    minAgeForCategory,
              youngDriverAge,
              minAgeForCountry,
              maxAgeForCountry,
              minLicencePeriod,
            };
            // Merge with catDetailsMap (fallback for any field not in reservationRate)
            const specs = { ...specsMap[attrs.carCategoryCode] || {}, ...specsFromRate };

            const rateContractID = attrs.contractID || defaultCid || effectiveContractID || DEFAULT_POA_CID;
            const rateDuration = parseInt(attrs.duration || String(parsedChunkDuration || '0'), 10) || undefined;

            allRates.push({ 
              ...attrs, 
              duration: rateDuration,
              contractID: rateContractID,
              imageUrl, 
              optionalInsurances, 
              includedInsurances,
              mileageType,
              mileageLimit,
              mileageUnit,
              mileageKmType: attrs.includedKmType || 'D', // D=per day, R=rental period
              extraMileageCost: extraMileageCost || attrs.extraKmPrice || '',
              deductibleAmount,
              deductibleCurrency,
              distanceRaw: '',
              specs 
            });
            // DEBUG: log statusCode para identificar veículos on-request
            if (attrs.statusCode) {
              console.log(`[DEBUG on-request] Car ${attrs.carCategoryCode} statusCode=${attrs.statusCode}`);
            }
          }
        }
        return { rates: allRates, equipment: allEquipment };
      };

      const poaRatesData1 = await poaRatesRes1.json();
      const parsed1 = parseRates(poaRatesData1, catDetailsMap, effectiveContractID || poaCID);
      const poaRates1 = parsed1.rates;

      let poaRates2: any[] = [];
      let poaEquipment2: any[] = [];
      if (poaRatesRes2) {
        try {
          const poaRatesData2 = await poaRatesRes2.json();
          const parsed2 = parseRates(poaRatesData2, catDetailsMap, poaCID2);
          poaRates2 = parsed2.rates;
          poaEquipment2 = parsed2.equipment;
        } catch { /* POA CID 2 indisponível para este trecho */ }
      }

      // Mescla tarifas POA de ambos os CIDs: prioriza o CID promocional (55138134) se retornar a categoria.
      // Caso contrário, cai para o CID padrão (57269673).
      const mergedPoaMap = new Map<string, any>();
      // 1. Adiciona todas as tarifas do CID padrão (57269673)
      for (const car of poaRates1) {
        mergedPoaMap.set(car.carCategoryCode, car);
      }
      // 2. Sobrescreve com as tarifas do CID promocional (55138134) se houver
      for (const car of poaRates2) {
        mergedPoaMap.set(car.carCategoryCode, car);
      }
      const poaRates = Array.from(mergedPoaMap.values());

      // ── Merge equipment from both POA CIDs ────────────────────────────────
      // Same strategy: promo CID equipment overwrites default CID equipment.
      // Equipment is per-station (not per-category), so we merge by code.
      const mergedEquipMap = new Map<string, any>();
      for (const eq of parsed1.equipment) mergedEquipMap.set(eq.code, eq);
      for (const eq of poaEquipment2) mergedEquipMap.set(eq.code, eq);
      const mergedEquipment = Array.from(mergedEquipMap.values());
      setRatesEquipment(mergedEquipment);
      console.log(`[fetchCars] Equipment from getMultipleRates: ${mergedEquipment.length} items`);

      // Parse ETO rates (may fail for some stations)
      let etoRates: any[] = [];
      if (etoRatesRes) {
        try {
          const etoRatesData = await etoRatesRes.json();
          etoRates = parseRates(etoRatesData, catDetailsMap).rates;
        } catch { /* ETO unavailable for this station */ }
      }

      // Parse ETO Zero Excess rates
      let etoZeroRates: any[] = [];
      if (etoZeroRatesRes) {
        try {
          const etoZeroRatesData = await etoZeroRatesRes.json();
          etoZeroRates = parseRates(etoZeroRatesData, catDetailsMap).rates;
        } catch { /* ETO Zero unavailable */ }
      }

      if (poaRates.length === 0) {
        setError("Sem tarifas disponíveis para o período selecionado. Tente outras datas.");
        setLoading(false);
        return;
      }

      setCars(poaRates);
      setEtoCars(etoRates);
      setEtoZeroCars(etoZeroRates);
    } catch (e: any) {
      setError("Erro ao buscar veículos: " + (e.message || "Tente novamente."));
    } finally {
      setLoading(false);
    }
  }, [pickupStation, returnStation, pickupDate, returnDate, pickupTime, returnTime, effectiveContractID]);

  useEffect(() => { fetchCars(); }, [fetchCars]);

  // Load international banner config from /painel
  useEffect(() => {
    fetch('/api/admin/config?key=BANNER_INTERNACIONAL')
      .then(r => r.json())
      .then(d => {
        if (d.value) {
          try { setIntlBanner(JSON.parse(d.value)); } catch {}
        }
      })
      .catch(() => {});
  }, []);

  // Load ETO margin from admin panel
  useEffect(() => {
    let cancelled = false;
    const load = async (attempt: number) => {
      try {
        const r = await fetch('/api/admin/margin', { cache: 'no-store' });
        const d = await r.json();
        if (!r.ok || typeof d?.percent !== 'number') throw new Error('margin unavailable');
        if (!cancelled) { setEtoMargin(d.percent); setEtoMarginReady(true); }
      } catch {
        if (!cancelled && attempt < 4) setTimeout(() => load(attempt + 1), 1500 * (attempt + 1));
      }
    };
    load(0);
    return () => { cancelled = true; };
  }, []);

  // Load extras when advancing to step 3
  useEffect(() => {
    if (currentStep === 3 && dbExtras.length === 0) {
      setLoadingExtras(true);
      fetch("/api/admin/extras")
        .then(r => r.json())
        .then(d => setDbExtras(d.filter((e: any) => e.active)))
        .finally(() => setLoadingExtras(false));
    }
  }, [currentStep, dbExtras.length]);

  // ── Step 3: Load insurances + mileage + charges via getQuote ────────────────
  // Strategy (post-Antonio migration):
  //  Equipment list + prices now come from getMultipleRates (ratesEquipment state)
  //  loaded in Step 2. getEquipmentList is no longer called.
  //  getQuote is still needed for: insurances, chargeList, mileage, payerSplit.
  useEffect(() => {
    if (currentStep !== 3 || !selectedCar) return;
    const carCategory = selectedCar.carCategoryCode;
    if (!carCategory || !pickupStation || !pickupDate || !returnDate) return;
    if (step3FetchedCarCategory === carCategory) return;

    // Determine prepaidMode based on tariff type
    // POA (Pay on Arrival) → NP (Non-Prepaid)
    // ETO (prepaid corporate) → PP (Prepaid)
    const prepaidMode = selectedTariffType === 'ETO' ? 'PP' : 'NP';

    const cidForQuote = selectedTariffType === 'ETO'
      ? (selectedCar._etoCID || '56935466')
      : (selectedCar.contractID || effectiveContractID || DEFAULT_POA_CID);

    setLoadingEquipment(true);

    // ── Step 3a: Equipment from getMultipleRates (already loaded in Step 2) ──
    // Friendly name / icon catalog (mesmos nomes e categorias do site oficial da Europcar)
    const EQUIPMENT_CATALOG: Record<string, { name: string; icon: string; description: string; maxQty: number }> = {
      CSB: { name: 'Assento de bebê (1–3 anos)', icon: '👶', description: 'Cadeira infantil para crianças de 1 a 3 anos (grupo 1, 9–18 kg).', maxQty: 3 },
      CSI: { name: 'Bebê conforto (0–12 meses)', icon: '👶', description: 'Cadeira infantil voltada para trás para bebês de 0 a 12 meses (até 13 kg).', maxQty: 3 },
      CST: { name: 'Assento criança (4–7 anos)', icon: '🧒', description: 'Cadeira para crianças de 4 a 7 anos (15–30 kg).', maxQty: 3 },
      CBS: { name: 'Assento de elevação Booster (8–12 anos)', icon: '💺', description: 'Assento de elevação para crianças de 8 a 12 anos (até 150 cm / 22–36 kg).', maxQty: 3 },
      BST: { name: 'Assento de elevação Booster (8–12 anos)', icon: '💺', description: 'Assento de elevação para crianças de 8 a 12 anos (até 150 cm / 22–36 kg).', maxQty: 3 },
      NVS: { name: 'Sistema de navegação GPS', icon: '🗺️', description: 'Navegador GPS portátil com mapas atualizados.', maxQty: 1 },
      NAV: { name: 'Sistema de navegação GPS', icon: '🗺️', description: 'GPS com mapeamento local e internacional.', maxQty: 1 },
      TOL: { name: 'Ativação de pedágio eletrônico (Via Verde / Toll)', icon: '🛣️', description: 'Taxa de ativação do dispositivo eletrônico para pedágios e portagens (ex: Via Verde). O valor do consumo será cobrado pela locadora.', maxQty: 1 },
      TOLL: { name: 'Ativação de pedágio eletrônico (Via Verde / Toll)', icon: '🛣️', description: 'Taxa de ativação do dispositivo eletrônico para pedágios.', maxQty: 1 },
      VVR: { name: 'Ativação de dispositivo Via Verde', icon: '🛣️', description: 'Taxa de ativação para pagamento automático de portagens em Portugal.', maxQty: 1 },
      ETL: { name: 'Ativação de pedágio eletrônico', icon: '🛣️', description: 'Taxa de ativação de dispositivo eletrônico para pedágios.', maxQty: 1 },
      ADD: { name: 'Condutor adicional', icon: '👤', description: 'Permite compartilhar a direção em longas viagens.', maxQty: 3 },
      ADR: { name: 'Condutor adicional', icon: '👤', description: 'Condutor extra habilitado a dirigir o veículo alugado.', maxQty: 3 },
      JAC: { name: 'Sobretaxa motorista jovem', icon: '🧑‍🦱', description: 'Exigida para motoristas com menos de 25 anos.', maxQty: 2 },
      YOU: { name: 'Sobretaxa motorista jovem', icon: '🧑‍🦱', description: 'Taxa para motoristas com menos de 25 anos.', maxQty: 2 },
      TRH: { name: 'Engate para reboque', icon: '🔗', description: 'Suporte para reboque de trailers ou caravanas.', maxQty: 1 },
      CBF: { name: 'Taxa transfronteiriça', icon: '🌍', description: 'Permite conduzir o veículo em países adicionais.', maxQty: 1 },
      LRC: { name: 'Taxa transfronteiriça', icon: '🌍', description: 'Autorização para condução em países adicionais.', maxQty: 1 },
      DVD: { name: 'Diesel garantido', icon: '⛽', description: 'Disponível apenas para categorias EDMR, CDMR, EVMR, IVMR e SDMR.', maxQty: 1 },
      SKR: { name: 'Rack de esqui', icon: '🎿', description: 'Suporte para transporte de esquis no teto do veículo.', maxQty: 2 },
      SKB: { name: 'Rack de esqui', icon: '🎿', description: 'Rack para esquis ou snowboards.', maxQty: 2 },
      SKV: { name: 'Rack de esqui', icon: '🎿', description: 'Rack para transporte de esquis.', maxQty: 2 },
      SNO: { name: 'Correntes para neve', icon: '⛓️', description: 'Correntes para pneus — obrigatórias em certas regiões.', maxQty: 2 },
      SNR: { name: 'Sobretaxa motorista sênior', icon: '👴', description: 'Taxa para motoristas acima da idade máxima.', maxQty: 1 },
      CHN: { name: 'Correntes para neve', icon: '⛓️', description: 'Correntes para pneus em condições de neve.', maxQty: 2 },
      WFI: { name: 'Wi-Fi portátil', icon: '📶', description: 'Hotspot Wi-Fi móvel com dados inclusos.', maxQty: 1 },
      LUG: { name: 'Proteção de bagagem', icon: '🧳', description: 'Cobertura para danos ou roubo de bagagem.', maxQty: 1 },
      HEL: { name: 'Capacete de motocicleta', icon: '🪖', description: 'Capacete fornecido junto com o veículo.', maxQty: 2 },
      MMS: { name: 'Proteção de espelhos', icon: '🪞', description: 'Cobertura adicional para espelhos retrovisores.', maxQty: 1 },
      JAB: { name: 'Dispositivo antiabandono', icon: '🔔', description: 'Alarme antiabandono para crianças.', maxQty: 1 },
      STR: { name: 'Pneus de neve', icon: '🛞', description: 'Pneus especiais para condições de neve.', maxQty: 1 },
      DSL: { name: 'Carga para carros a diesel', icon: '⛽', description: 'Suplemento para veículos a diesel.', maxQty: 1 },
      EMS: { name: 'Serviço de emergência no exterior', icon: '🆘', description: 'Assistência de emergência para viagens internacionais.', maxQty: 1 },
      LSR: { name: 'Cinta de amarração com catraca', icon: '🔧', description: 'Cinta para fixação de carga.', maxQty: 1 },
    };

    // Exclui equipamentos internos de furgões de carga / vinhetas internas que o site oficial da Europcar não oferece em carros de passeio
    const EXCLUDED_EQUIPMENT_CODES = new Set(['ETR', 'VIG', 'LSR', 'TRH', 'HEL']);

    // Build stationEquipment from ratesEquipment (already loaded in Step 2)
    // Only include type "O" (optional) — mandatory/included are automatic
    const stationEquipment = ratesEquipment
      .filter((eq: any) => eq.type === 'O' && !EXCLUDED_EQUIPMENT_CODES.has(eq.code))
      .map((eq: any) => {
        const meta = EQUIPMENT_CATALOG[eq.code];
        const isToll = ['TOL', 'TOLL', 'VVR', 'ETL'].includes(eq.code);
        return {
          code:        eq.code,
          name:        meta?.name        || eq.descr || eq.code,
          icon:        meta?.icon        || (isToll ? '🛣️' : '📦'),
          description: meta?.description || eq.descr || '',
          maxQty:      isToll ? 1 : (meta?.maxQty ?? 1),
          onRequest:   eq.onRequest,
          statusCode:  eq.statusCode || 'F',
          priceFromList: eq.priceInBookingCurrency || eq.price || 0,
        };
      });

    // Build equipment prices directly from getMultipleRates data (no getQuote needed for prices)
    const pricesFromRates: Record<string, { price: number; priceBRL: number; totalBRL: number; currency: string; exchangeRate: number; onRequest: boolean }> = {};
    for (const eq of ratesEquipment) {
      if (eq.type !== 'O') continue;
      // rentalPriceInBookingCurrencyAI = total price for the rental period (with tax) in BRL
      // rentalMaxInBookingCurrencyAI   = maximum CAP (ceiling) for the period in BRL
      // rentalMax >= 99999 is a sentinel value meaning "no cap" — must NOT be used as price.
      // Strategy: use rentalPriceInBookingCurrencyAI as the actual total. If a real cap
      // exists (rentalMax < 99999), apply it as a ceiling.
      const rentalTotal = eq.rentalPriceInBookingCurrencyAI || 0;
      const hasRealCap  = eq.rentalMax > 0 && eq.rentalMax < 99999;
      const rentalCap   = hasRealCap ? eq.rentalMaxInBookingCurrencyAI : Infinity;
      const totalBRL    = rentalTotal > 0
        ? Math.min(rentalTotal, rentalCap)
        : eq.priceInBookingCurrency;
      pricesFromRates[eq.code] = {
        price:        eq.price,
        priceBRL:     eq.priceInBookingCurrency,
        totalBRL:     totalBRL,
        currency:     selectedCar?.currency || 'BRL',
        exchangeRate: parseFloat(selectedCar?.exchangeRate || '1'),
        onRequest:    eq.onRequest,
      };
    }

    // ── Step 3b: Equipment codes for chargeList filtering ──────────────────
    const codesForQuote = stationEquipment.map((eq: any) => ({ code: eq.code, qty: 1 }));

    // Wrap async work in IIFE (useEffect cannot be async)
    (async () => {
      // ── getQuote (NO equipment — only for insurances/charges/mileage/payerSplit) ──
      // Equipment prices already come from getMultipleRates. getQuote is needed only for:
      //   - insuranceList (optional protections like SCDW, PAI, etc.)
      //   - chargeList (airport surcharge, VAT, high season, etc.)
      //   - mileage data (includedKm, extraKmPrice)
      //   - payerSplit (chargesDetail=TRE)
      const rateIdForQuote = selectedCar.rateId || selectedCar.$?.rateId || '';
      let quoteDataList: any[] = [];
      quoteDataList = await Promise.all([
        fetch('/api/europcar/getQuote', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            carCategory,
            pickupStation,
            returnStation: returnStation || pickupStation,
            pickupDate,
            returnDate,
            pickupTime,
            returnTime,
            contractID:  cidForQuote,
            rateId:      rateIdForQuote,
            prepaidMode,           // ← dynamic NP or PP
            driverAge,
            xrsLanguage,
            equipmentList: [],     // ← empty — prices come from getMultipleRates
          }),
        })
          .then(r => r.json())
          .catch(err => { console.warn('[Step3] getQuote failed:', err); return null; })
      ]);

        // ── Airport surcharge NP call ───────────────────────────────────────────
        // Confirmed by Europcar: airport surcharge amount varies between POA (NP)
        // and BA (PP) modes. The B2B portal shows the NP value as the "at station"
        // charge. Always fetch NP even for ETO (PP) customers so the displayed
        // amount matches what they will actually pay at the counter.
        // This is a lightweight call with no equipment list (chargeList only).
        let npAirportData: any = null;
        if (prepaidMode === 'PP') {
          // Only needed when the main call is PP — NP already gives the right value
          npAirportData = await fetch('/api/europcar/getQuote', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              carCategory,
              pickupStation,
              returnStation: returnStation || pickupStation,
              pickupDate,
              returnDate,
              pickupTime,
              returnTime,
              contractID:   cidForQuote,
              rateId:       rateIdForQuote,
              prepaidMode:  'NP',    // ← always NP to get the "at station" airport surcharge
              equipmentList: [],
            }),
          })
            .then(r => r.json())
            .catch(err => { console.warn('[Step3] NP airport surcharge call failed:', err); return null; });
        }

        // Extract the NP airport surcharge value (EUR + BRL) for later use
        let npAirportEntry: { price: number; priceBRL: number; vatPct: number } | null = null;
        if (npAirportData) {
          try {
            const npReservation = npAirportData?.message?.serviceResponse?.reservation;
            const npQuote       = npReservation?.quote;
            const npChargeRaw   = npQuote?.chargeList?.chargeLine;
            const npChargeArr   = npChargeRaw
              ? (Array.isArray(npChargeRaw) ? npChargeRaw : [npChargeRaw])
              : [];
            let npVatPct = 0;
            let npAirPrice = 0, npAirBRL = 0;
            npChargeArr.forEach((c: any) => {
              const a = c.$ || c;
              if (a.chrgTy === '00028') npVatPct  = parseFloat(a.chrgPct || '0');
              if (a.chrgTy === '00024') {
                npAirPrice = parseFloat(a.price || '0');
                npAirBRL   = parseFloat(a.priceInBookingCurrency || '0');
              }
            });
            if (npAirBRL > 0) {
              npAirportEntry = { price: npAirPrice, priceBRL: npAirBRL, vatPct: npVatPct };
              console.log(`[Step3] NP airport surcharge: ${npAirPrice} EUR / ${npAirBRL} BRL (VAT ${npVatPct}%)`);
            }
          } catch (e) { /* ignore */ }
        }

        // ── Validar disponibilidade do veículo retornado pelo getQuote ──────
        const primaryQuote = quoteDataList[0];
        const primaryReservation = primaryQuote?.message?.serviceResponse?.reservation || primaryQuote?.serviceResponse?.reservation;
        if (primaryQuote?._xrsError || !primaryReservation) {
          const errCode = primaryQuote?._errorCode || primaryQuote?._xrsErrors?.[0]?.code || '';
          console.warn('[Step3] ❌ Veículo indisponível no getQuote:', errCode);
          setStep3Error(
            errCode === 'rental.onewaynotallowed'
              ? 'A Europcar não permite devolução deste modelo na estação de retorno selecionada (One-Way não permitido para este veículo).'
              : 'Este veículo não está disponível para confirmação nesta estação ou rota selecionada. Por favor, volte e escolha outro modelo.'
          );
          setLoadingEquipment(false);
          return;
        } else {
          setStep3Error(null);
        }

        // ── Parse prices from getQuote responses (merged across chunks) ──
        // ── Use equipment prices from getMultipleRates (pricesFromRates) ──────
        const prices: Record<string, { price: number; priceBRL: number; totalBRL: number; currency: string; exchangeRate: number; onRequest: boolean }> = { ...pricesFromRates };

        for (const quoteData of quoteDataList) {
          if (!quoteData) continue;
          const reservation = quoteData?.message?.serviceResponse?.reservation || quoteData?.serviceResponse?.reservation;
          const quote       = reservation?.quote;
          const quoteAttrs  = quote?.$ || quote || {};
          const exchRate    = parseFloat(quoteAttrs.exchangeRate || '1');
          const quoteDurationStr = quoteData?._duration || reservation?.$?.duration || reservation?.duration;
          const parsedQuoteDuration = quoteDurationStr ? parseInt(String(quoteDurationStr), 10) : undefined;
          if (parsedQuoteDuration && parsedQuoteDuration > 0) {
            setApiRentalDuration(prev => prev || parsedQuoteDuration);
          }

          // ── Insurance list from getQuote (same regardless of equipment chunk) ──
          // Known airport/station surcharge codes in the Europcar XRS API
          const AIRPORT_SURCHARGE_CODES = ['APF','APT','AIRPORTFEE','APS','ASF','APF2','APTF','STF'];
          // Known high-season surcharge codes
          const HIGH_SEASON_CODES = ['YSC','HSS','HSCH','HSC','HSSE','HSSF'];

          const AIRPORT_LABEL = 'Sobretaxa de aeroporto/estação ferroviária';
          const HIGH_SEASON_LABEL = 'Sobretaxa de Alta Estação';

          const insuranceNamesPT: Record<string, string> = {
            CDW:        'Cobertura por Danos à Colisão (CDW)',
            THW:        'Cobertura por Roubo/Furto (THW)',
            PAI:        'Seguro de Acidentes Pessoais (PAI)',
            PEC:        'Proteção de Pertences Pessoais (PEC)',
            SCDW:       'Super CDW',
            STHW:       'Super THW',
            SPCDW:      'Proteção Premium CDW',
            SPTHW:      'Proteção Premium THW',
            APP:        'Proteção de Aparência',
            RSA:        'Assistência na Estrada (RSA)',
            PREMIUM:    'Cobertura Premium',
            PREMPRE:    'Cobertura Premium Pré-paga',
            APF:        AIRPORT_LABEL,
            APT:        AIRPORT_LABEL,
            APS:        AIRPORT_LABEL,
            ASF:        AIRPORT_LABEL,
            AIRPORTFEE: AIRPORT_LABEL,
            CITYFEE:    'Sobretaxa de Cidade',
            LOC:        'Sobretaxa Local',
            PRM:        'Sobretaxa de Estação Premium',
            YSC:        HIGH_SEASON_LABEL,
            HSS:        HIGH_SEASON_LABEL,
            HSCH:       HIGH_SEASON_LABEL,
            HSC:        HIGH_SEASON_LABEL,
            HSSE:       HIGH_SEASON_LABEL,
            LAF:        'Taxas de Licença e Administração',
            RTF:        'Taxa Rodoviária',
            LIC:        'Licenças e Taxas',
            TAX:        'Impostos e Taxas',
            VAT:        'IVA (Imposto sobre Valor Acrescentado)',
          };

          // Narrow airport detection: requires airport/railway/aeroporto keyword (NOT generic "surcharge")
          const isAirportSurcharge = (code: string, descr: string): boolean => {
            const c = (code || '').toUpperCase();
            const d = (descr || '').toLowerCase();
            if (AIRPORT_SURCHARGE_CODES.includes(c)) return true;
            return (
              d.includes('airport') || d.includes('aeroporto') ||
              d.includes('railway') || d.includes('ferroviária') ||
              d.includes('terminal fee') || d.includes('station fee') ||
              d.includes('airport fee') || d.includes('airport surcharge') ||
              d.includes('station surcharge') || d.includes('railway surcharge')
            );
          };

          // Translate any description to Portuguese using keywords
          const translateDescr = (code: string, apiDescr: string): string => {
            const c = (code || '').toUpperCase();
            const d = (apiDescr || '').toLowerCase();
            if (insuranceNamesPT[c]) return insuranceNamesPT[c];
            if (isAirportSurcharge(c, apiDescr)) return AIRPORT_LABEL;
            if (HIGH_SEASON_CODES.includes(c) || d.includes('high season') || d.includes('alta estação') || d.includes('season surcharge')) return HIGH_SEASON_LABEL;
            if (d.includes('road tax') || d.includes('license fee') || d.includes('licence fee')) return 'Taxas de Licença e Administração';
            if (d.includes('collision') || d.includes('damage waiver') || d.includes('cdw')) return 'Cobertura por Danos à Colisão (CDW)';
            if (d.includes('theft') || d.includes('thw')) return 'Cobertura por Roubo/Furto (THW)';
            if (d.includes('vat') || d.includes('imposto') || d.includes('tax')) return 'Impostos e Taxas';
            return apiDescr || code; // fallback to API description
          };

          let parsedInsurances: any[] = [];

          if (quote?.insuranceList?.insurance) {
            const rawIns  = quote.insuranceList.insurance;
            const insArr  = Array.isArray(rawIns) ? rawIns : [rawIns];

            parsedInsurances = insArr.map((ins: any) => {
              const a = ins.$ || ins;
              const code = (a.code || '').toUpperCase();
              const descr = translateDescr(code, a.descr || '');
              return {
                code,
                descr,
                type:                          a.type                          || 'O',
                includedInTotal:               a.includedInTotal               || '',
                price:                         parseFloat(a.price              || '0'),
                priceInBookingCurrency:        parseFloat(a.priceInBookingCurrency || '0'),
                rentalPriceAI:                 parseFloat(a.rentalPriceAI      || '0'),
                rentalPriceInBookingCurrencyAI:parseFloat(a.rentalPriceInBookingCurrencyAI || '0'),
                excessWithPOM:                 parseFloat(a.excessWithPOM      || '0'),
                bkExcessWithPOM:               parseFloat(a.bkExcessWithPOM    || '0'),
                prepaid:                       a.prepaid                       || '',
                paidBy:                        undefined as string | undefined,
              };
            }).filter((ins: any) => ins.code);

            // Remove airport surcharges captured from insuranceList — they lack VAT and carry
            // a lower pre-tax value. The authoritative value (with VAT, correct BRL) comes
            // exclusively from chargeList chrgTy="00024". We'll re-add it below.
            const airportIdx = parsedInsurances.findIndex((i: any) =>
              isAirportSurcharge(i.code, i.descr || '')
            );
            if (airportIdx !== -1) parsedInsurances.splice(airportIdx, 1);
          } else if (selectedCar?.optionalInsurances?.length || selectedCar?.includedInsurances?.length) {
            // Fallback: se getQuote não retornou insuranceList, recupera do getMultipleRates
            const fallbackList = [
              ...(selectedCar.includedInsurances || []).map((ins: any) => ({ ...ins, type: ins.type || 'I' })),
              ...(selectedCar.optionalInsurances || []).map((ins: any) => ({ ...ins, type: 'O' })),
            ];
            parsedInsurances = fallbackList.map((ins: any) => {
              const a = ins.$ || ins;
              const code = (a.code || '').toUpperCase();
              const descr = translateDescr(code, a.descr || '');
              return {
                code,
                descr,
                type:                          a.type                          || 'O',
                includedInTotal:               a.includedInTotal               || (a.type === 'I' ? 'Y' : ''),
                price:                         parseFloat(a.price              || '0'),
                priceInBookingCurrency:        parseFloat(a.priceInBookingCurrency || '0'),
                rentalPriceAI:                 parseFloat(a.rentalPriceAI      || '0'),
                rentalPriceInBookingCurrencyAI:parseFloat(a.rentalPriceInBookingCurrencyAI || '0'),
                excessWithPOM:                 parseFloat(a.excessWithPOM      || '0'),
                bkExcessWithPOM:               parseFloat(a.bkExcessWithPOM    || '0'),
                prepaid:                       a.prepaid                       || '',
                paidBy:                        undefined as string | undefined,
              };
            }).filter((ins: any) => ins.code);
          }

          // Codes already captured from insuranceList — avoid duplicates from chargeList
          const alreadyCaptured = new Set(parsedInsurances.map((i: any) => i.code));
          // Equipment codes that should not appear in "incluído" — uma lista fixa (por
          // catálogo) nunca cobre tudo, porque cada estação retorna seu próprio conjunto
          // de códigos (ex: LIST01 tem BBS/CBS/PCB/WIF/TOL/EMS, nenhum coberto por um
          // catálogo estático). A cotação por equipamento (linhas acima) já sabe
          // exatamente quais códigos pertencem à estação — usa essa lista dinâmica como
          // fonte principal, e a lista fixa só como reforço para códigos "clássicos"
          // que às vezes vêm via chargeList mesmo sem estarem no getEquipmentList.
          const equipmentCodes = new Set([
            ...codesForQuote.map((e: any) => (e.code || '').toUpperCase()),
            'ADD','ADR',                 // condutor adicional
            'CSB','CSI','CST','BST',     // cadeiras/assentos infantis
            'NVS','NAV',                 // GPS
            'JAC','YOU',                 // sobretaxa motorista jovem
            'TRH',                       // engate reboque
            'CBF','LRC',                 // taxa transfronteiriça
            'DVD',                       // diesel garantido
            'SKR','SKB','SKV','SNO','CHN', // esqui / correntes de neve
            'WFI','LUG','HEL','MMS','JAB', // wifi, bagagem, capacete, espelhos, antiabandono
            'RSA',                       // roadside assistance (já capturado via insuranceList)
          ]);
          // Rental structure charge types to skip (Basic Rental, Free Miles, etc.)
          const skipChrgTy = new Set(['00001','00048']);

          // ── chargeList — API returns <chargeLine> elements (NOT <charge>) ──
          // IMPORTANT: Individual chargeLine items carry PRE-VAT prices.
          // The VAT (chrgTy="00028") is a separate line. areTaxesIncluded="Y" on
          // the quote means the TOTAL includes VAT, not the individual lines.
          // Confirmed by: sum(pre-VAT lines) + VAT line = totalRateEstimate.
          // We must apply VAT multiplier to get the correct display value.
          const rawChargeLine = quote?.chargeList?.chargeLine;
          if (rawChargeLine) {
            const chargeArr = Array.isArray(rawChargeLine) ? rawChargeLine : [rawChargeLine];

            // ── Pass 1: extract VAT % from the 00028 line ──────────────────────────
            // Airport surcharge (and others) are stored PRE-VAT; we need to apply
            // the VAT multiplier to display the correct amount to the customer.
            let vatMultiplier = 1;
            chargeArr.forEach((c: any) => {
              const a = c.$ || c;
              if ((a.chrgTy || '') === '00028') {
                const pct = parseFloat(a.chrgPct || '0');
                if (pct > 0 && pct <= 100) vatMultiplier = 1 + pct / 100;
              }
            });

            let vatAddedFromChargeLine = false;
            chargeArr.forEach((c: any) => {
              const a = c.$ || c;
              const auxK       = (a.auxK     || '').toUpperCase();
              const chrgTy     = (a.chrgTy   || '');
              const chrgTyDesc = (a.chrgTyDesc || '').trim();
              const chrgPct    = parseFloat(a.chrgPct || '0');
              const price      = parseFloat(a.price || '0');
              const priceBK    = parseFloat(a.priceInBookingCurrency || '0');

              // ── paidBy: quem paga esta cobrança (fonte XRS) ──────────────
              const payerNode = c.payer?.$ || c.payer || {};
              const paidBy: 'driver' | 'business' | 'unknown' =
                'dvrName' in payerNode ? 'driver'
                : 'ba' in payerNode ? 'business'
                : 'unknown';

              // Skip pure rental/mileage infrastructure lines
              if (skipChrgTy.has(chrgTy)) return;
              // Skip equipment items (already shown in extras section)
              if (equipmentCodes.has(auxK)) return;

              // ── Airport surcharge (chrgTy 00024) ─────────────────────────────────────
              // The correct \"at counter\" value depends on prepaidMode:
              //   PP (ETO): always use the dedicated NP call (npAirportEntry).
              //             If that call failed → skip entirely (no fallback with wrong value).
              //   NP (POA): this call IS already NP → use its value directly.
              // Confirmed by Europcar: airport surcharge amount varies between POA (NP)
              // and BA (PP) modes. The NP value matches what the B2B portal shows.
              if (chrgTy === '00024') {
                // Remove any duplicate airport entry that slipped in from insuranceList
                const dupIdx = parsedInsurances.findIndex((i: any) =>
                  isAirportSurcharge(i.code, i.descr || '')
                );
                if (dupIdx !== -1) parsedInsurances.splice(dupIdx, 1);

                if (prepaidMode === 'PP') {
                  // ETO customer: must use NP value — no fallback, no guessing.
                  if (!npAirportEntry) {
                    console.warn('[Step3] Airport surcharge skipped: NP call unavailable for PP customer.');
                    return; // skip — do not show incorrect PP amount
                  }
                  const npVatMult = npAirportEntry.vatPct > 0 ? 1 + npAirportEntry.vatPct / 100 : 1;
                  parsedInsurances.push({
                    code:                          auxK && auxK !== '8' && auxK !== '' ? auxK : 'AIRPORTFEE',
                    descr:                         AIRPORT_LABEL,
                    type:                          'M',
                    includedInTotal:               'Y',
                    price:                         npAirportEntry.price    * npVatMult,
                    priceInBookingCurrency:        npAirportEntry.priceBRL * npVatMult,
                    rentalPriceAI:                 0,
                    rentalPriceInBookingCurrencyAI: 0,
                    excessWithPOM:                 0,
                    bkExcessWithPOM:               0,
                    prepaid:                       '',
                    paidBy: 'counter' as any,  // Airport surcharge = SEMPRE balcão
                  });
                } else {
                  // POA customer: this call is already NP — value is authoritative.
                  // chrgTy 00024 = SEMPRE pago no balcão, independente do paidBy do XRS.
                  parsedInsurances.push({
                    code:                          auxK && auxK !== '8' && auxK !== '' ? auxK : 'AIRPORTFEE',
                    descr:                         AIRPORT_LABEL,
                    type:                          'M',
                    includedInTotal:               'Y',
                    price:                         price   * vatMultiplier,
                    priceInBookingCurrency:        priceBK * vatMultiplier,
                    rentalPriceAI:                 0,
                    rentalPriceInBookingCurrencyAI: 0,
                    excessWithPOM:                 0,
                    bkExcessWithPOM:               0,
                    prepaid:                       '',
                    paidBy: 'counter' as any,  // Airport surcharge = SEMPRE balcão
                  });
                }
                return;
              }


              // Skip insurance items already captured from insuranceList
              if (alreadyCaptured.has(auxK)) return;

              // ── Young/Senior Driver Surcharge (chrgTy 00070 or codes YOU/SNR) ──
              // When the driver age is below youngDriverAge, the XRS automatically
              // includes this surcharge. We display it as a visible line item.
              if (chrgTy === '00070' || auxK === 'YOU' || auxK === 'SNR') {
                const isYoung = chrgTy === '00070' || auxK === 'YOU';
                const surchargeLabel = isYoung ? 'Taxa de Jovem Condutor' : 'Taxa de Condutor Sênior';
                parsedInsurances.push({
                  code: auxK || chrgTy,
                  descr: surchargeLabel,
                  type: 'M',
                  includedInTotal: 'Y',
                  price:   price   * vatMultiplier,
                  priceInBookingCurrency: priceBK * vatMultiplier,
                  rentalPriceAI: 0,
                  rentalPriceInBookingCurrencyAI: 0,
                  excessWithPOM: 0,
                  bkExcessWithPOM: 0,
                  prepaid: '',
                  paidBy,
                });
                console.log(`[Step3] 🧑 ${surchargeLabel}: EUR ${price.toFixed(2)} / BRL ${priceBK.toFixed(2)} (paidBy=${paidBy})`);
                return;
              }

              // VAT / Tax line
              if (chrgTy === '00028' || chrgTyDesc.toUpperCase() === 'VAT') {
                if (!vatAddedFromChargeLine) {
                  vatAddedFromChargeLine = true;
                  const pct = chrgPct > 0 && chrgPct <= 100 ? ` ${chrgPct}%` : '';
                  parsedInsurances.push({
                    code: 'VAT',
                    descr: `IVA${pct}`,
                    type: 'M',
                    includedInTotal: 'Y',
                    price,
                    priceInBookingCurrency: priceBK,
                    rentalPriceAI: 0,
                    rentalPriceInBookingCurrencyAI: 0,
                    excessWithPOM: 0,
                    bkExcessWithPOM: 0,
                    prepaid: '',
                    paidBy,
                  });
                }
                return;
              }

              // Use auxK as code if meaningful, else use chrgTy
              const code = auxK && auxK !== '8' && auxK !== '' ? auxK : chrgTy;
              const descr = translateDescr(code, chrgTyDesc);

              parsedInsurances.push({
                code,
                descr,
                type: 'M',
                includedInTotal: 'Y',
                price,
                priceInBookingCurrency: priceBK,
                rentalPriceAI: 0,
                rentalPriceInBookingCurrencyAI: 0,
                excessWithPOM: 0,
                bkExcessWithPOM: 0,
                prepaid: '',
                paidBy,
              });
            });
          }

          // ── taxList fallback (if API returns a separate taxList) ──
          if (quote?.taxList?.tax) {
            const rawTax = quote.taxList.tax;
            const taxArr = Array.isArray(rawTax) ? rawTax : [rawTax];
            taxArr.forEach((t: any) => {
              const a = t.$ || t;
              const percent = parseFloat(a.percent || a.amount || '0');
              const isVAT = (a.type || '').toUpperCase() === 'VAT';
              if (parsedInsurances.some((i: any) => i.code === 'VAT') && isVAT) return; // already added
              const taxName = isVAT
                ? `IVA${percent > 0 && percent <= 100 ? ' ' + percent + '%' : ''}`
                : `Taxa/Imposto${percent > 0 && percent <= 100 ? ' ' + percent + '%' : ''}`;
              parsedInsurances.push({
                code:                          (a.type || 'TAX').toUpperCase(),
                descr:                         taxName.trim(),
                type:                          'M',
                includedInTotal:               'Y',
                price:                         parseFloat(a.price || '0'),
                priceInBookingCurrency:        parseFloat(a.priceInBookingCurrency || '0'),
                rentalPriceAI:                 parseFloat(a.rentalPriceAI || '0'),
                rentalPriceInBookingCurrencyAI:parseFloat(a.rentalPriceInBookingCurrencyAI || '0'),
                excessWithPOM:                 0,
                bkExcessWithPOM:               0,
                prepaid:                       a.prepaid || '',
              });
            });
          }

          setQuoteInsurances(parsedInsurances);

          // ── payerList — split entre motorista e conta corporativa ────────────
          // Usa parsePayerList para extrair driverDueBRL (cobrado online) e
          // businessDueBRL (faturado separado). Armazenado em payerSplit e
          // incluído no payload que vai ao checkout via sessionStorage.
          const split = parsePayerList(reservation);
          if (split) {
            setPayerSplit(split);
            console.log(`[Step3] payerSplit: driver=${split.driverDueBRL} BRL, business=${split.businessDueBRL} BRL`);
          } else {
            setPayerSplit(null);
            console.log('[Step3] payerList não disponível — checkout usará cálculo por nome de cobrança como fallback');
          }

          // ── Mileage data ────────────────────────────────────────────────
          const includedKm     = parseInt(quoteAttrs.includedKm     || '0');
          const totalIncludedDist = parseInt(quoteAttrs.totalIncludedDist || '0');
          const extraKmPrice   = parseFloat(quoteAttrs.extraKmPrice  || '0');
          const exchangeRate   = parseFloat(quoteAttrs.exchangeRate  || '1');
          if (includedKm > 0 || totalIncludedDist > 0) {
            setQuoteMileage({
              includedKm,
              totalIncludedDist,
              extraKmPrice,
              extraKmPriceBRL: extraKmPrice * exchangeRate,
              includedKmType:  quoteAttrs.includedKmType || 'D',
              currency:        quoteAttrs.currency       || 'EUR',
            });
          }

          // ── Totals from getQuote ────────────────────────────────────────
          if (quoteAttrs.amountToPayOnArrivalInBookingCurrency || quoteAttrs.amountToPayOnArrival) {
            setQuoteTotals({
              amountToPayOnArrival: quoteAttrs.amountToPayOnArrival || '0',
              amountToPayOnArrivalInBookingCurrency: quoteAttrs.amountToPayOnArrivalInBookingCurrency || '0',
            });
          }
        }

        // ── Fallback: sobretaxa de aeroporto do NP quando PP não retornou chargeList ──
        // Quando getQuote PP não retorna quote (comum para ETO CIDs), a sobretaxa
        // de aeroporto do NP call (npAirportEntry) precisa ser injetada manualmente.
        // chrgTy 00024 = SEMPRE pago no balcão, nunca somar no ticket Cielo.
        if (npAirportEntry && npAirportEntry.priceBRL > 0) {
          const currentInsurances = quoteInsurances.length > 0 ? [...quoteInsurances] : [];
          const hasAirport = currentInsurances.some((i: any) =>
            ['APF','APT','AIRPORTFEE','APS','ASF','APF2','APTF','STF'].includes((i.code || '').toUpperCase()) ||
            i.code === 'AIRPORTFEE' ||
            (i.descr || '').toLowerCase().includes('airport') ||
            (i.descr || '').toLowerCase().includes('aeroporto')
          );
          if (!hasAirport) {
            const npVatMult = npAirportEntry.vatPct > 0 ? 1 + npAirportEntry.vatPct / 100 : 1;
            const airportEntry = {
              code:                          'AIRPORTFEE',
              descr:                         'Sobretaxa de aeroporto/estação ferroviária',
              type:                          'M',
              includedInTotal:               'Y',
              price:                         npAirportEntry.price    * npVatMult,
              priceInBookingCurrency:        npAirportEntry.priceBRL * npVatMult,
              rentalPriceAI:                 0,
              rentalPriceInBookingCurrencyAI: 0,
              excessWithPOM:                 0,
              bkExcessWithPOM:               0,
              prepaid:                       '',
              paidBy:                        'counter' as const,  // SEMPRE balcão
            };
            currentInsurances.push(airportEntry);
            setQuoteInsurances(currentInsurances);
            console.log(`[Step3] ✈️ Airport surcharge injetada via NP fallback: EUR ${npAirportEntry.price.toFixed(2)} / BRL ${npAirportEntry.priceBRL.toFixed(2)} (VAT ${npAirportEntry.vatPct}%) → paidBy=counter`);
          }
        }

        setEquipmentPrices(prices);

        // ── Finalize equipment list with merged price data ─────────────────
        // Items from getMultipleRates + enriched with prices already extracted.
        const enrichedEquipment = stationEquipment.map((eq: any) => ({
          ...eq,
          onRequest: eq.onRequest || (prices[eq.code]?.onRequest ?? false),
        }));

        // ── Deduplicar equipamentos com mesmo nome mas códigos diferentes ──
        // O XRS pode retornar CST e CSI (ambos "Assento criança 1-3 anos") ou
        // ADD e ADR (ambos "Condutor adicional") com preços diferentes.
        // Mantém apenas o item com o maior preço.
        const seenNames = new Map<string, any>();
        for (const eq of enrichedEquipment) {
          const normName = (eq.name || '').trim().toLowerCase();
          if (!normName) { seenNames.set(eq.code, eq); continue; }

          const existing = seenNames.get(normName);
          if (!existing) {
            seenNames.set(normName, eq);
          } else {
            const existPrice = prices[existing.code]?.totalBRL || prices[existing.code]?.priceBRL || 0;
            const newPrice   = prices[eq.code]?.totalBRL       || prices[eq.code]?.priceBRL       || 0;
            if (newPrice > existPrice) {
              seenNames.set(normName, eq);
              console.log(`[Step3] Dedup: ${eq.code} (R$${newPrice}) substitui ${existing.code} (R$${existPrice}) para "${eq.name}"`);
            } else {
              console.log(`[Step3] Dedup: ${existing.code} (R$${existPrice}) mantido, ${eq.code} (R$${newPrice}) removido para "${eq.name}"`);
            }
          }
        }
        const finalEquipment = Array.from(seenNames.values());

        setXrsEquipment(finalEquipment);
        setStep3FetchedCarCategory(carCategory);
        console.log(`[Step3] Equipment loaded: ${finalEquipment.length} items (source: getMultipleRates), prepaidMode=${prepaidMode}`);
    })()
      .catch(err => console.warn('[Step3] Quote/equipment processing failed:', err))
      .finally(() => setLoadingEquipment(false));

  }, [currentStep, selectedCar, ratesEquipment, pickupStation, returnStation, pickupDate, returnDate, pickupTime, returnTime, selectedTariffType, effectiveContractID]);




  const CHILD_SEAT_CODES = useMemo(() => new Set(['CSB', 'CSI', 'CST', 'CBS', 'BST']), []);
  const TOLL_CODES = useMemo(() => new Set(['TOL', 'TOLL', 'VVR', 'ETL']), []);

  const handleEquipmentQuantity = (code: string, delta: number, maxQty: number = 1) => {
    setSelectedEquipmentMap(prev => {
      const current = prev[code] || 0;
      const next = current + delta;
      if (next <= 0) {
        const { [code]: _, ...rest } = prev;
        return rest;
      }

      // Pedágio eletrônico é taxa de ativação única (máx 1 por veículo)
      if (TOLL_CODES.has(code) && next > 1) {
        return prev;
      }

      if (next > maxQty) return prev;

      // Limite combinado de assentos infantis de acordo com a capacidade do veículo
      if (CHILD_SEAT_CODES.has(code) && delta > 0) {
        const currentTotalChildSeats = Object.entries(prev)
          .filter(([k]) => CHILD_SEAT_CODES.has(k))
          .reduce((sum, [, v]) => sum + v, 0);
        const maxSeatsNum = parseInt(selectedCar?.carCategorySeats || '5', 10);
        const maxChildSeats = maxSeatsNum > 5 ? 4 : 3;
        if (currentTotalChildSeats >= maxChildSeats) {
          return prev;
        }
      }

      // Limite combinado de condutores adicionais (máx 3 adicionais)
      if ((code === 'ADD' || code === 'ADR') && delta > 0) {
        const currentTotalDrivers = Object.entries(prev)
          .filter(([k]) => k === 'ADD' || k === 'ADR')
          .reduce((sum, [, v]) => sum + v, 0);
        if (currentTotalDrivers >= 3) {
          return prev;
        }
      }

      return { ...prev, [code]: next };
    });
  };

  const handleExtraQuantity = (id: string, delta: number) => {
    setSelectedExtrasMap(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) { const { [id]: _, ...rest } = prev; return rest; }
      return { ...prev, [id]: next };
    });
  };

  const selectedExtrasPricePerDay = useMemo(() => {
    let sum = 0;
    for (const [id, qty] of Object.entries(selectedExtrasMap)) {
      const ext = dbExtras.find((e: any) => e.id === id);
      if (ext) sum += ext.pricePerDay * (qty as number);
    }
    return sum;
  }, [selectedExtrasMap, dbExtras]);

  // BRL total de proteções XRS selecionadas (rentalPriceInBookingCurrencyAI = total do período)
  const selectedInsuranceTotalBRL = useMemo(() => {
    return quoteInsurances
      .filter((ins: any) => selectedExtrasMap[ins.code] > 0)
      .reduce((sum: number, ins: any) => sum + (parseFloat(ins.rentalPriceInBookingCurrencyAI || ins.priceInBookingCurrency || 0)), 0);
  }, [quoteInsurances, selectedExtrasMap]);

  // BRL total de equipamentos XRS selecionados
  const selectedEquipmentTotalBRL = useMemo(() => {
    return Object.entries(selectedEquipmentMap)
      .filter(([, qty]) => (qty as number) > 0)
      .reduce((sum: number, [code, qty]) => {
        const ep = equipmentPrices[code];
        if (!ep) return sum;
        const total = ep.totalBRL > 0 ? ep.totalBRL : ep.priceBRL * bookingDurationDays;
        return sum + total * (qty as number);
      }, 0);
  }, [selectedEquipmentMap, equipmentPrices, bookingDurationDays]);

  const absolutePriceRange = useMemo(() => {
    if (!cars.length) return { min: 0, max: 0 };
    const prices = cars.map((c: any) => parseFloat(c.totalRateEstimate || 0)).filter((p: number) => p > 0);
    if (!prices.length) return { min: 0, max: 0 };
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [cars]);

  const availableVehicleTypes = useMemo(() => {
    const types = new Set<string>();
    cars.forEach((c: any) => {
      types.add(getVehicleType(c));
    });
    return ["Todos", ...Array.from(types).sort()];
  }, [cars]);

  const filteredCars = useMemo(() => {
    let result = cars.filter((car: any) => {
      const auto = car.carCategoryAutomatic === "Y";
      if (transmission === "Automática" && !auto) return false;
      if (transmission === "Manual" && auto) return false;
      if (vehicleType !== "Todos" && getVehicleType(car) !== vehicleType) return false;
      const seats = parseInt(car.carCategorySeats || "2");
      if (seats < minSeats) return false;
      const price = parseFloat(car.totalRateEstimate || "0");
      if (selectedMinPrice !== null && price < selectedMinPrice) return false;
      if (selectedMaxPrice !== null && price > selectedMaxPrice) return false;
      return true;
    });
    if (sortBy === "Preço: Menor para maior") result.sort((a: any, b: any) => parseFloat(a.totalRateEstimate) - parseFloat(b.totalRateEstimate));
    else if (sortBy === "Preço: Maior para menor") result.sort((a: any, b: any) => parseFloat(b.totalRateEstimate) - parseFloat(a.totalRateEstimate));
    return result;
  }, [cars, transmission, vehicleType, minSeats, sortBy, selectedMinPrice, selectedMaxPrice]);

  const priceRange = useMemo(() => {
    if (!filteredCars.length) return { min: 0, max: 0 };
    const prices = filteredCars.map((c: any) => parseFloat(c.totalRateEstimate || 0)).filter((p: number) => p > 0);
    if (!prices.length) return { min: 0, max: 0 };
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [filteredCars]);

  const handleSelectCar = (car: any) => {
    // Só aplica overrides de imagem do banco para pesquisas BRASILEIRAS.
    // Para pesquisas internacionais, o componente CarImage usa o CDN da Europcar
    // pelo código ACRISS — evita mostrar a foto do Kwid BR para um C3 internacional
    // quando ambos compartilham o mesmo carCategoryCode.
    const isBrazilianSearch = !stationCountry || stationCountry === 'BR';
    setSelectedCar({
      ...car,
      imageUrl: isBrazilianSearch ? (carImageOverrides[car.carCategoryCode] || car.imageUrl) : car.imageUrl
    });
    setZeroExcessUpgrade(false);       // reset upgrade when changing car
    setEquipmentPrices({});            // reset equipment prices for new station/car
    setXrsEquipment([]);               // reset dynamic equipment list for new station
    setStep3FetchedCarCategory(null);  // reset fetch tracker
    setQuoteInsurances([]);            // reset insurances for new car
    setQuoteMileage(null);             // reset mileage for new car
    setSelectedEquipmentMap({});       // clear previous selections
    setStep3Error(null);               // reset previous quote error
    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Journey tracking — Step 2: Vehicle Selected
    try {
      const sessionId = sessionStorage.getItem("europcar_journey_session");
      if (sessionId) {
        fetch("/api/journey/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            step: 2,
            selectedCar: car.carCategoryCode,
            selectedCarName: carCategoryOverrides[car.carCategoryCode] || car.carCategorySample || car.carCategoryCode,
            carPrice: parseFloat(car.totalRateEstimateInBookingCurrency || car.totalRateEstimate || "0"),
          }),
        }).catch(() => {});
      }
    } catch {}
  };

  /** Returns true if a car is marked as on-request (from admin config or XRS statusCode) */
  const isCarOnRequest = (car: any): boolean =>
    car.statusCode === 'R' || onRequestCarCodes.has(car.carCategoryCode?.toUpperCase() || '');

  /** Intercepts car selection — shows on-request popup when car is on-request */
  const handleSelectCarWithOnRequestCheck = (car: any, tariff: 'POA' | 'ETO') => {
    if (isCarOnRequest(car)) {
      setOnRequestModal({ car, tariff });
    } else {
      setSelectedTariffType(tariff);
      handleSelectCar(car);
    }
  };

  const fmtPrice = (v: any) => parseFloat(String(v || 0)).toFixed(2).replace(".", ",");

  // ---- RENDER ----
  return (
    <div className="min-h-screen bg-[#f7f7f7] font-sans">
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 md:h-20 flex justify-between items-center">
          <Link href="/">
            <img src="/logo.jpg" alt="Europcar" className="h-8 md:h-12 object-contain" />
          </Link>
          <div className="flex items-center gap-3 md:gap-6 text-xs md:text-sm font-bold text-gray-900">
            {session?.user ? (
              <div className="flex items-center gap-4">
                <span className="text-[#008d36]">{t('nav.hello')}, {session.user.name || session.user.email?.split("@")[0]}</span>
                <button onClick={() => signOut({ callbackUrl: "/" })} className="text-xs text-gray-500 hover:text-red-500 font-normal">{t('nav.logout')}</button>
              </div>
            ) : status !== "loading" && (
              <button onClick={() => setShowLoginModal(true)} className="hover:text-[#008d36]">{t('nav.login')}</button>
            )}
            <LanguageSelector />
          </div>
        </div>
      </header>

      {/* Stepper */}
      <div className="bg-white border-b border-gray-200 py-2 md:py-4">
        <div className="max-w-7xl mx-auto px-3 md:px-4">
          {/* Mobile: compact horizontal stepper */}
          <div className="flex md:hidden items-center gap-1 mb-2">
            {[{ n: 1, label: 'LOCAL', active: true }, { n: 2, label: 'VEÍCULO', active: currentStep >= 2 }, { n: 3, label: 'EXTRAS', active: currentStep >= 3 }, { n: 4, label: 'REVISAR', active: false }].map((s, i) => (
              <div key={s.n} className="flex items-center gap-1 flex-1">
                <span className={`${s.active ? 'bg-[#008d36] text-white' : 'bg-gray-200 text-gray-500'} font-bold text-[9px] w-4 h-4 flex items-center justify-center rounded-sm shrink-0`}>{s.n}</span>
                <span className={`text-[8px] font-bold uppercase ${s.active ? 'text-[#008d36]' : 'text-gray-400'}`}>{s.label}</span>
                {i < 3 && <div className="flex-1 h-px bg-gray-200 mx-1" />}
              </div>
            ))}
          </div>
          {/* Mobile: show only current step details */}
          <div className="md:hidden bg-gray-50 rounded-lg p-3 text-[10px]">
            {currentStep <= 2 ? (
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="font-bold text-gray-400 uppercase text-[9px]">{t('vehicles.pickup')}</div>
                  <div className="font-bold text-gray-900 truncate">{stationName || pickupStation}</div>
                  <div className="text-gray-500">{formatDate(pickupDate)}</div>
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-400 uppercase text-[9px]">{t('vehicles.return')}</div>
                  <div className={`font-bold truncate ${isOneWay ? 'text-[#e67e00]' : 'text-gray-900'}`}>{isOneWay ? (returnStationName || returnStation) : (stationName || pickupStation)}</div>
                  <div className="text-gray-500">{formatDate(returnDate)}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[#008d36] font-bold">✓ {selectedCar?.carCategorySample || selectedCar?.carCategoryName || ''}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500 truncate">{stationName || pickupStation}</span>
              </div>
            )}
          </div>
          {/* Desktop: full stepper */}
          <div className="hidden md:flex gap-4">
            {/* Step 1 */}
            <div className="flex-1 bg-white border border-gray-200 rounded p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-[#008d36] text-white font-bold text-xs w-5 h-5 flex items-center justify-center rounded-sm">1</span>
                <span className="text-[11px] font-bold text-gray-500 uppercase">{t('vehicles.step1')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <div>
                  <div className="font-bold text-gray-900 uppercase text-[10px]">{t('vehicles.pickup')}</div>
                  <div className="font-bold truncate max-w-[130px]">{stationName || pickupStation}</div>
                  <div className="text-gray-500">{formatDate(pickupDate)}</div>
                </div>
                <div>
                  <div className="font-bold text-gray-900 uppercase text-[10px]">{t('vehicles.return')}</div>
                  <div className={`font-bold truncate max-w-[130px] ${isOneWay ? 'text-[#e67e00]' : ''}`}>{isOneWay ? (returnStationName || returnStation) : (stationName || pickupStation)}</div>
                  <div className="text-gray-500">{formatDate(returnDate)}</div>
                </div>
              </div>
              {/* Shuttle / Delivery badges */}
              {pickupStationInfo?.features && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {pickupStationInfo.features.hasShuttle && (
                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[9px] font-bold px-2 py-0.5 rounded-full">
                      🚌 {t('vehicles.shuttleBus')}
                    </span>
                  )}
                  {pickupStationInfo.type === 'airport' && (
                    <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 text-[9px] font-bold px-2 py-0.5 rounded-full">
                      ✈️ {t('vehicles.airport')}
                    </span>
                  )}
                  {pickupStationInfo.features.hasDelivery && (
                    <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-[9px] font-bold px-2 py-0.5 rounded-full">
                      🚗 {t('vehicles.deliveryAvailable')}
                    </span>
                  )}
                  {pickupStationInfo.features.has247Return && (
                    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-[9px] font-bold px-2 py-0.5 rounded-full">
                      🔑 {t('vehicles.return24h')}
                    </span>
                  )}
                </div>
              )}
            </div>
            {/* Step 2 */}
            <div className={`flex-1 bg-white border-2 ${currentStep === 2 ? "border-[#008d36]" : "border-gray-200"} rounded p-4 relative`}>
              <div className="absolute -top-3 left-4 bg-white px-2 flex items-center gap-2">
                <span className="bg-[#008d36] text-white font-bold text-xs w-5 h-5 flex items-center justify-center rounded-sm">2</span>
                <span className="text-[11px] font-bold text-[#008d36] uppercase">VEÍCULO</span>
              </div>
              <p className="text-[13px] text-gray-500 mt-2">
                {selectedCar ? `${selectedCar.carCategorySample || carCategoryOverrides[selectedCar.carCategoryCode] || selectedCar.carCategoryName || selectedCar.carCategoryCode} ✓` : "Selecione um veículo abaixo."}
              </p>
            </div>
            {/* Step 3 */}
            <div className={`flex-1 bg-white border-2 ${currentStep === 3 ? "border-[#008d36]" : "border-gray-200"} rounded p-4 relative`}>
              <div className="absolute -top-3 left-4 bg-white px-2 flex items-center gap-2">
                <span className={`${currentStep === 3 ? "bg-[#008d36] text-white" : "bg-gray-200 text-gray-500"} font-bold text-xs w-5 h-5 flex items-center justify-center rounded-sm`}>3</span>
                <span className={`text-[11px] font-bold ${currentStep === 3 ? "text-[#008d36]" : "text-gray-400"} uppercase`}>PROTEÇÃO, EXTRAS</span>
              </div>
              <p className="text-[13px] text-gray-500 mt-2">{currentStep === 3 ? "Escolha extras opcionais." : "Disponível após selecionar veículo."}</p>
            </div>
            {/* Step 4 */}
            <div className="flex-1 bg-white border border-gray-200 rounded p-4">
              <div className="flex items-center gap-2">
                <span className="bg-gray-200 text-gray-500 font-bold text-xs w-5 h-5 flex items-center justify-center rounded-sm">4</span>
                <span className="text-[11px] font-bold text-gray-400 uppercase">REVISAR</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="max-w-7xl mx-auto px-4 py-4 md:py-8 flex flex-col md:flex-row gap-4 md:gap-8 items-start">
        {/* Mobile filter toggle */}
        {currentStep === 2 && (
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="md:hidden flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-3 w-full justify-center text-sm font-bold text-gray-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            {showMobileFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </button>
        )}
        {/* Filters sidebar */}
        {currentStep === 2 && (
        <div className={`${showMobileFilters ? 'block' : 'hidden'} md:block w-full md:w-[260px] shrink-0 md:sticky md:top-4`}>
          <div className="bg-white rounded border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900">Filtros</h3>
              <button
                onClick={() => {
                  setTransmission("Ambos");
                  setVehicleType("Todos");
                  setMinSeats(2);
                  setSelectedMinPrice(null);
                  setSelectedMaxPrice(null);
                }}
                className="text-[#008d36] text-xs font-bold hover:underline"
              >
                Redefinir
              </button>
            </div>
            <div className="mb-5">
              <h4 className="font-bold text-sm text-gray-900 mb-2">Transmissão</h4>
              {["Ambos", "Automática", "Manual"].map(t => (
                <label key={t} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mb-1.5">
                  <input type="radio" name="trans" checked={transmission === t} onChange={() => setTransmission(t)} className="accent-[#008d36]" /> {t}
                </label>
              ))}
            </div>
            <div className="mb-5 border-t border-gray-100 pt-4">
              <h4 className="font-bold text-sm text-gray-900 mb-2">{t('vehicles.vehicleType')}</h4>
              {availableVehicleTypes.map(v => {
                const count = v === "Todos" ? cars.length : cars.filter((c: any) => getVehicleType(c) === v).length;
                return (
                  <label key={v} className="flex items-center justify-between text-sm text-gray-600 cursor-pointer mb-1.5 hover:text-gray-900">
                    <span className="flex items-center gap-2">
                      <input type="radio" name="tipo" checked={vehicleType === v} onChange={() => setVehicleType(v)} className="accent-[#008d36]" /> {v}
                    </span>
                    <span className="text-[11px] text-gray-400 font-mono">({count})</span>
                  </label>
                );
              })}
            </div>
            <div className="border-t border-gray-100 pt-4">
              <h4 className="font-bold text-sm text-gray-900 mb-2">{t('vehicles.minSeats')}</h4>
              <div className="flex justify-between text-xs font-bold text-gray-600 mb-1">{[2, 4, 5, 7].map(n => <span key={n}>{n}+</span>)}</div>
              <input
                type="range" min="2" max="7" value={minSeats}
                onChange={e => setMinSeats(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #d1d5db ${((minSeats - 2) / (7 - 2)) * 100}%, #008d36 ${((minSeats - 2) / (7 - 2)) * 100}%)`,
                }}
              />
            </div>
            {absolutePriceRange.max > 0 && (
              <div className="border-t border-gray-100 pt-4 mt-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-sm text-gray-900">Preços ({cars[0]?.currency || "EUR"})</h4>
                  {(selectedMinPrice !== null || selectedMaxPrice !== null) && (
                    <button
                      onClick={() => { setSelectedMinPrice(null); setSelectedMaxPrice(null); }}
                      className="text-[10px] text-gray-400 hover:text-red-500 font-bold"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <label className="block text-[9px] text-gray-400 uppercase font-bold mb-0.5">Mín.</label>
                    <input
                      type="number"
                      step="any"
                      min={Math.floor(absolutePriceRange.min)}
                      max={selectedMaxPrice ?? Math.ceil(absolutePriceRange.max)}
                      value={selectedMinPrice !== null ? selectedMinPrice : ''}
                      placeholder={absolutePriceRange.min.toFixed(2)}
                      onChange={e => {
                        const val = e.target.value === '' ? null : parseFloat(e.target.value);
                        setSelectedMinPrice(val !== null && !isNaN(val) ? val : null);
                      }}
                      className="w-full text-center border border-gray-300 rounded p-1.5 text-xs font-bold bg-white text-gray-900 focus:border-[#008d36] focus:outline-none"
                    />
                  </div>
                  <span className="self-end pb-2 text-gray-400 font-bold">—</span>
                  <div className="flex-1">
                    <label className="block text-[9px] text-gray-400 uppercase font-bold mb-0.5">Máx.</label>
                    <input
                      type="number"
                      step="any"
                      min={selectedMinPrice ?? Math.floor(absolutePriceRange.min)}
                      max={Math.ceil(absolutePriceRange.max)}
                      value={selectedMaxPrice !== null ? selectedMaxPrice : ''}
                      placeholder={absolutePriceRange.max.toFixed(2)}
                      onChange={e => {
                        const val = e.target.value === '' ? null : parseFloat(e.target.value);
                        setSelectedMaxPrice(val !== null && !isNaN(val) ? val : null);
                      }}
                      className="w-full text-center border border-gray-300 rounded p-1.5 text-xs font-bold bg-white text-gray-900 focus:border-[#008d36] focus:outline-none"
                    />
                  </div>
                </div>
                {/* Slider de ajuste dinâmico */}
                <div className="mt-3">
                  <input
                    type="range"
                    min={Math.floor(absolutePriceRange.min)}
                    max={Math.ceil(absolutePriceRange.max)}
                    step="1"
                    value={selectedMaxPrice ?? Math.ceil(absolutePriceRange.max)}
                    onChange={e => setSelectedMaxPrice(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #008d36 ${(((selectedMaxPrice ?? Math.ceil(absolutePriceRange.max)) - Math.floor(absolutePriceRange.min)) / Math.max(1, Math.ceil(absolutePriceRange.max) - Math.floor(absolutePriceRange.min))) * 100}%, #d1d5db ${(((selectedMaxPrice ?? Math.ceil(absolutePriceRange.max)) - Math.floor(absolutePriceRange.min)) / Math.max(1, Math.ceil(absolutePriceRange.max) - Math.floor(absolutePriceRange.min))) * 100}%)`,
                    }}
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>{fmtPrice(absolutePriceRange.min)}</span>
                    <span className="font-bold text-[#008d36]">Até {fmtPrice(selectedMaxPrice ?? absolutePriceRange.max)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Content area */}
        <div className="flex-1">
          {currentStep === 2 ? (
            <>
              {/* ✅ Banner de Tarifa Contratada Ativa */}
              {effectiveContractID && (
                <div className="mb-5 flex items-center gap-3 bg-green-50 border border-green-300 rounded-lg px-5 py-3">
                  <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <span className="text-sm font-bold text-green-800">Tarifa contratada aplicada: </span>
                    <span className="text-sm font-mono font-black text-green-900 bg-green-100 px-2 py-0.5 rounded">{effectiveContractID}</span>
                    <span className="text-xs text-green-600 ml-2">— Os preços exibidos já refletem sua tarifa negociada.</span>
                  </div>
                  <a href="/" className="text-xs text-green-600 hover:text-red-500 font-bold underline shrink-0">Remover</a>
                </div>
              )}

              <div className="flex justify-end items-center mb-5">
                <label className="text-sm font-bold text-gray-900 mr-3">{t('vehicles.sortBy')}</label>
                <select className="border border-gray-300 rounded bg-white px-3 py-2 text-sm font-bold text-gray-700 outline-none w-52" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option>Recomendado</option>
                  <option>Preço: Menor para maior</option>
                  <option>Preço: Maior para menor</option>
                </select>
              </div>

              {/* Loading */}
              {loading && (
                <div className="bg-white rounded-lg border border-gray-200 p-16 text-center">
                  <div className="w-10 h-10 border-4 border-[#008d36] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="font-bold text-gray-600">{t('vehicles.loading')}</p>
                  <p className="text-sm text-gray-400 mt-1">Consultando API Europcar XRS</p>
                </div>
              )}

              {/* Error */}
              {!loading && error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
                  <div className="text-4xl mb-3">⚠️</div>
                  <p className="font-bold text-red-700 text-lg mb-1">{t('vehicles.loadError')}</p>
                  <p className="text-red-600 text-sm mb-4">{error}</p>
                  <button onClick={fetchCars} className="bg-[#008d36] text-white px-6 py-2 rounded font-bold text-sm hover:bg-[#007530]">{t('vehicles.tryAgain')}</button>
                </div>
              )}

              {/* International Banner - only for non-Brazil searches */}
              {!loading && !error && intlBanner?.enabled && !(stationCountry === 'BR' || !stationCountry || pickupStation.toUpperCase().startsWith('BR')) && (
                <div style={{ background: `linear-gradient(135deg, ${intlBanner.bgColor || '#008d36'}, ${intlBanner.bgColor || '#008d36'}dd)` }} className="rounded-xl p-5 text-center shadow-lg mb-2">
                  <p className="text-white font-black text-lg tracking-wide">{intlBanner.title}</p>
                  <div className="flex flex-wrap justify-center gap-3 mt-3">
                    {intlBanner.line1 && <span className="bg-white/20 backdrop-blur text-white text-sm font-bold px-4 py-1.5 rounded-full">{intlBanner.line1}</span>}
                    {intlBanner.line2 && <span className="bg-white/20 backdrop-blur text-white text-sm font-bold px-4 py-1.5 rounded-full">{intlBanner.line2}</span>}
                    {intlBanner.line3 && <span className="bg-white/20 backdrop-blur text-white text-sm font-bold px-4 py-1.5 rounded-full">{intlBanner.line3}</span>}
                  </div>
                </div>
              )}

              {/* Cars */}
              {!loading && !error && (
                <div className="flex flex-col gap-5">
                  {filteredCars.length === 0 && (
                    <div className="bg-white p-8 text-center rounded-lg border border-gray-200 text-gray-500">{t('vehicles.noVehicles')}</div>
                  )}
                  {filteredCars.map((car: any, idx: number) => {
                    const code = car.carCategoryCode;
                    const name = carCategoryOverrides[code] || car.carCategoryName || code;
                    const sample = car.carCategorySample || "";
                    const currency = car.currency || "EUR";
                    const totalPricePOA = parseFloat(car.totalRateEstimate || 0);
                    const totalBRL_POA = parseFloat(car.totalRateEstimateInBookingCurrency || 0);
                    const basePrice = parseFloat(car.basePrice || 0);
                    const isSelected = selectedCar?.carCategoryCode === code && selectedCar?.rateId === car.rateId;

                    // Find matching ETO rate for this car
                    const etoCar = etoCars.find(e => e.carCategoryCode === code);
                    const totalPriceETO_raw = etoCar ? parseFloat(etoCar.totalRateEstimate || 0) : 0;
                    const totalBRL_ETO_raw = etoCar ? parseFloat(etoCar.totalRateEstimateInBookingCurrency || 0) : 0;
                    // Apply admin margin to ETO
                    const totalPriceETO = totalPriceETO_raw * (1 + etoMargin / 100);
                    const totalBRL_ETO = totalBRL_ETO_raw * (1 + etoMargin / 100);
                    const isBrazil = stationCountry === 'BR' || !stationCountry || pickupStation.toUpperCase().startsWith('BR');
                    const hasETO = !isBrazil && etoMarginReady && etoCar && totalPriceETO_raw > 0;
                    // Calculate discount % ETO vs POA
                    const discountPct = hasETO && totalPricePOA > 0 ? Math.round((1 - totalPriceETO / totalPricePOA) * 100) : 0;

                    const dailyBRL_POA = totalBRL_POA > 0 ? totalBRL_POA / bookingDurationDays : 0;
                    const dailyPOA = totalPricePOA > 0 ? totalPricePOA / bookingDurationDays : 0;

                    const isPremium = code.startsWith('U') || code.startsWith('L') || car.specs?.carCategoryType?.toLowerCase().includes('premium');

                    return (
                      <div key={`${code}-${idx}`} className={`bg-white rounded border flex flex-col transition-shadow ${isSelected ? "border-[#008d36] shadow-lg" : isPremium ? "border-[#c9a84c] hover:shadow-md" : "border-gray-200 hover:shadow-md"}`}>
                        
                        {/* Top row */}
                        <div className="flex flex-col sm:flex-row p-4 md:p-5 gap-4 md:gap-6">
                          {/* Image - gold background for premium */}
                          <div className={`w-full sm:w-[200px] md:w-[240px] shrink-0 flex items-center justify-center p-2 rounded-lg ${isPremium ? "bg-gradient-to-b from-[#f5ecd0] to-[#efe3c0]" : ""}`}>
                            <CarImage sample={sample} code={code} alt={sample || name} imageUrl={car.imageUrl} overrideUrl={isBrazil ? carImageOverrides[code] : undefined} />
                          </div>

                          {/* Info */}
                          <div className="flex-1 flex flex-col justify-start">
                            {/* Car name: use sample (AUDI A3 SPORTBACK) as main title */}
                            <h2 className="text-lg md:text-[22px] font-black text-gray-900 uppercase tracking-tight">
                              {sample || name}
                            </h2>
                            
                            {/* Tags row with tooltips */}
                            <div className="mt-2 mb-4 flex flex-wrap gap-2">
                              {/* Premium or OU SIMILAR tag */}
                              {isPremium ? (
                                <span className="group relative inline-flex items-center gap-1.5 bg-gradient-to-r from-[#c9a84c] to-[#d4b85a] rounded-full px-3 py-1.5 text-[10px] font-black text-white uppercase cursor-help shadow-sm">
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg>
                                  PREMIUM
                                  <svg className="w-3.5 h-3.5 bg-white/30 text-white rounded-full p-[2px]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                  <span className="absolute top-full left-0 mt-2 w-72 bg-[#c9a84c] text-white text-[12px] font-medium normal-case rounded-lg p-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl leading-relaxed">
                                    Você receberá este modelo ou outro similar de uma marca Premium: BMW, Audi, Mercedes, Tesla, Jaguar, Land Rover, Lexus, Porsche, Volvo ou Alfa Romeo.
                                  </span>
                                </span>
                              ) : (
                                <span className="group relative inline-flex items-center gap-1.5 border border-gray-300 rounded-full px-3 py-1 text-[10px] font-black text-gray-900 uppercase cursor-help">
                                  OU SIMILAR {name.split(',')[0].split(' ')[0]}
                                  <svg className="w-3.5 h-3.5 bg-gray-300 text-white rounded-full p-[2px]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                  <span className="absolute top-full left-0 mt-2 w-64 bg-gray-900 text-white text-[11px] font-normal normal-case rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                    Você receberá este modelo ou um veículo similar da mesma categoria com características equivalentes.
                                  </span>
                                </span>
                              )}

                              {/* Category type tag from API */}
                              {car.specs?.carCategoryType && (
                                <span className="group relative inline-flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1 text-[10px] font-black text-gray-600 uppercase cursor-help">
                                  {car.specs.carCategoryType}
                                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-[11px] font-normal normal-case rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                    Tipo de veículo: {car.specs.carCategoryType}
                                  </span>
                                </span>
                              )}

                              {/* Fuel type tag */}
                              {car.specs?.carCategoryFuelType && (
                                <span className="group relative inline-flex items-center gap-1.5 bg-blue-50 rounded-full px-3 py-1 text-[10px] font-black text-blue-700 uppercase cursor-help">
                                  {car.specs.carCategoryFuelType === 'D' ? 'Diesel' : car.specs.carCategoryFuelType === 'E' ? 'Elétrico' : car.specs.carCategoryFuelType === 'H' ? 'Híbrido' : 'Gasolina'}
                                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 bg-gray-900 text-white text-[11px] font-normal normal-case rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                    Tipo de combustível do veículo
                                  </span>
                                </span>
                              )}

                              {/* Model Choice tag */}
                              {car.specs?.carCategoryModelGuaranteed === 'Y' && (
                                <span className="group relative inline-flex items-center gap-1.5 bg-purple-50 rounded-full px-3 py-1 text-[10px] font-black text-purple-700 uppercase cursor-help">
                                  Model Choice
                                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-[11px] font-normal normal-case rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                    Modelo garantido — você receberá exatamente este veículo.
                                  </span>
                                </span>
                              )}

                              {/* LIMITED badge for on-request vehicles */}
                              {isCarOnRequest(car) && (
                                <span className="group relative inline-flex items-center gap-1.5 bg-black rounded-full px-3 py-1 text-[10px] font-black text-white uppercase cursor-help">
                                  LIMITED
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                  <span className="absolute bottom-full left-0 mb-2 w-64 bg-gray-900 text-white text-[11px] font-normal normal-case rounded-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                    Disponibilidade limitada. A estação tem 8 horas úteis para confirmar esta reserva.
                                  </span>
                                </span>
                              )}
                            </div>

                            {/* 2.2 Vehicle Specs Icons Row */}
                            <div className="flex items-center gap-4 text-sm font-black text-gray-900 flex-wrap">
                              <span className="flex items-center gap-1.5" title="Passageiros">
                                <svg className="w-[18px] h-[18px] text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                                {car.specs?.carCategorySeats || car.carCategorySeats || "?"}
                              </span>
                              <span className="flex items-center gap-1.5" title="Portas">
                                <svg className="w-[18px] h-[18px] text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-8 12H9v-2h2v2zm0-4H9V9h2v2z"/></svg>
                                {car.specs?.carCategoryDoors || car.carCategoryDoors || "?"}
                              </span>
                              {car.specs?.carCategoryBaggageQuantity && (
                                <span className="flex items-center gap-1.5" title="Malas">
                                  <svg className="w-[18px] h-[18px] text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M17 6h-2V3c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v3H7c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2h2v2h-2V4z"/></svg>
                                  {car.specs.carCategoryBaggageQuantity}
                                </span>
                              )}
                              <span className="flex items-center gap-1.5" title="Transmissão">
                                <svg className="w-[18px] h-[18px] text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v4h-2zm0 6h2v2h-2z"/></svg>
                                {car.specs?.carCategoryAutomatic === "Y" || car.carCategoryAutomatic === "Y" ? "A" : "M"}
                              </span>
                              {(car.specs?.carCategoryAirCond === "Y" || car.carCategoryAirCond === "Y") && (
                                <span className="flex items-center gap-1.5" title="Ar-condicionado">
                                  <svg className="w-[18px] h-[18px] text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M17.3 11l-3.3-3.3c-.4-.4-1-.4-1.4 0s-.4 1 0 1.4L14.2 10.7 13.5 10H10V6.5l.7.7c.4.4 1 .4 1.4 0s.4-1 0-1.4l-3.3-3.3c-.4-.4-1-.4-1.4 0l-3.3 3.3c-.4.4-.4 1 0 1.4s1 .4 1.4 0l.7-.7V10H2.8l1.6-1.6c.4-.4.4-1 0-1.4s-1-.4-1.4 0l-3.3 3.3c-.4.4-.4 1 0 1.4s1 .4 1.4 0L2.8 13h3.5v3.5l-.7-.7c-.4-.4-1-.4-1.4 0s-.4 1 0 1.4l3.3 3.3c.4.4 1 .4 1.4 0s.4-1 0-1.4l-.7-.7V13h3.5l-1.6 1.6c-.4.4-.4 1 0 1.4s1 .4 1.4 0l3.3-3.3c.3-.4.3-1-.1-1.4zM12 12c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1z"/></svg>
                                  A/C
                                </span>
                              )}
                              <span className="flex items-center gap-1.5" title="Idade mínima do motorista">
                                <svg className="w-[18px] h-[18px] text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 14c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm7.5 3H4.5v-1c0-1.5 3-2.25 4.5-2.25s4.5.75 4.5 2.25v1z"/></svg>
                                {car.specs?.carCategoryMinDriverAge || "18"}
                              </span>
                            </div>

                            {/* Mileage + Protection Checks */}
                            <div className="flex flex-col gap-1 mt-4">
                              <div className="text-[#008d36] flex items-center gap-2 text-sm font-bold">
                                <svg className="w-[16px] h-[16px] text-[#008d36]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                {car.mileageType === "Livre" ? "Quilometragem ilimitada" : car.mileageLimit ? `${car.mileageLimit} ${car.mileageUnit || "km"} incluído` : "Quilometragem incluída"}
                              </div>
                              {!isBrazil && (
                              <div className="text-[#008d36] flex items-center gap-2 text-sm font-bold">
                                <svg className="w-[16px] h-[16px] text-[#008d36]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                Proteção básica incluída
                              </div>
                              )}
                            </div>
                          </div>

                          {/* Price columns */}
                          <div className={`shrink-0 flex ${hasETO ? 'gap-4' : ''} items-stretch justify-end`}>
                            {/* POA - Pay at Counter */}
                            <div className={`${hasETO ? 'w-[180px]' : 'w-[200px]'} flex flex-col items-end justify-center text-right`}>
                              <span className="text-[10px] text-gray-800 font-medium uppercase tracking-wider mb-2">{t('vehicles.payAtCounter')}</span>
                              <div className="flex flex-col items-end mb-1">
                                <div className="text-2xl font-black text-gray-900 leading-none whitespace-nowrap">
                                  {dailyBRL_POA > 0 ? `R$ ${fmtPrice(dailyBRL_POA)}` : `${currency} ${fmtPrice(dailyPOA)}`} <span className="text-xl font-normal text-gray-900">/ dia</span>
                                </div>
                                <div className="text-sm text-gray-400 font-medium mt-1">
                                  TOTAL {totalBRL_POA > 0 ? `R$ ${fmtPrice(totalBRL_POA)}` : `${currency} ${fmtPrice(totalPricePOA)}`}
                                </div>
                              </div>
                              {/* Age restriction warning */}
                              {(() => {
                                const minAge = parseInt(car.specs?.carCategoryMinDriverAge || '0', 10);
                                const minCountryAge = parseInt(car.specs?.minAgeForCountry || '0', 10);
                                const effectiveMin = Math.max(minAge, minCountryAge);
                                const isBlocked = effectiveMin > 0 && driverAge < effectiveMin;
                                if (isBlocked) {
                                  return (
                                    <div className="w-full mt-4">
                                      <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-xs text-red-700 font-medium mb-2 flex items-center gap-1.5">
                                        <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                                        {t('vehicles.minAge')}: {effectiveMin} {t('vehicles.years')}
                                      </div>
                                      <button disabled className="w-full bg-gray-300 text-gray-500 font-black py-3 px-4 rounded text-base cursor-not-allowed">
                                        {t('vehicles.unavailable')}
                                      </button>
                                    </div>
                                  );
                                }
                                return (
                                  <button
                                    onClick={() => handleSelectCarWithOnRequestCheck(car, 'POA')}
                                    className="w-full mt-4 bg-[#FFD100] hover:bg-[#F2C700] text-black font-black py-3 px-4 rounded text-base transition-colors"
                                  >
                                    {isSelected && selectedTariffType === 'POA' ? t('vehicles.selected') : t('vehicles.select')}
                                  </button>
                                );
                              })()}
                            </div>

                            {/* ETO - Pay Now (with markup) */}
                            {hasETO && (() => {
                              const dailyBRL_ETO = totalBRL_ETO > 0 ? totalBRL_ETO / bookingDurationDays : 0;
                              const dailyETO = totalPriceETO > 0 ? totalPriceETO / bookingDurationDays : 0;
                              return (
                                <div className="w-[190px] flex flex-col items-end justify-center text-right bg-green-50 border border-green-200 rounded-lg p-3 relative">
                                  {discountPct > 0 && (
                                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#008d36] text-white text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap">
                                      {discountPct}% {t('vehicles.cheaper')}
                                    </span>
                                  )}
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <span className="text-[10px] text-[#008d36] font-bold uppercase tracking-wider">{t('vehicles.payNow')}</span>
                                    <span className="bg-blue-100 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">{t('vehicles.freeCancellation')}</span>
                                  </div>
                                  <div className="flex flex-col items-end mb-1">
                                    <div className="text-2xl font-black text-[#008d36] leading-none whitespace-nowrap">
                                      {dailyBRL_ETO > 0 ? `R$ ${fmtPrice(dailyBRL_ETO)}` : `${currency} ${fmtPrice(dailyETO)}`} <span className="text-xl font-normal text-[#008d36]">/ dia</span>
                                    </div>
                                    <div className="text-sm text-green-600 font-medium mt-1">
                                      TOTAL {totalBRL_ETO > 0 ? `R$ ${fmtPrice(totalBRL_ETO)}` : `${currency} ${fmtPrice(totalPriceETO)}`}
                                    </div>
                                  </div>
                                  {(() => {
                                    const minAge = parseInt(car.specs?.carCategoryMinDriverAge || '0', 10);
                                    const minCountryAge = parseInt(car.specs?.minAgeForCountry || '0', 10);
                                    const effectiveMin = Math.max(minAge, minCountryAge);
                                    const isBlocked = effectiveMin > 0 && driverAge < effectiveMin;
                                    if (isBlocked) {
                                      return (
                                        <button disabled className="w-full mt-4 bg-gray-300 text-gray-500 font-black py-3 px-4 rounded text-base cursor-not-allowed">
                                          {t('vehicles.unavailable')}
                                        </button>
                                      );
                                    }
                                    return (
                                      <button
                                        onClick={() => {
                                          const merged = { ...car, ...etoCar, totalRateEstimate: totalPriceETO.toFixed(2), totalRateEstimateInBookingCurrency: totalBRL_ETO.toFixed(2), optionalInsurances: car.optionalInsurances, imageUrl: car.imageUrl, _etoCID: '56935466' };
                                          handleSelectCarWithOnRequestCheck(merged, 'ETO');
                                        }}
                                        className="w-full mt-4 bg-[#008d36] hover:bg-[#007530] text-white font-black py-3 px-4 rounded text-base transition-colors"
                                      >
                                        {isSelected && selectedTariffType === 'ETO' ? `${t('vehicles.selected')} ✓` : t('vehicles.payNowBtn')}
                                      </button>
                                    );
                                  })()}
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Expandable Details */}
                        <details className="group">
                          <summary className="list-none flex items-center gap-1 cursor-pointer text-[#008d36] text-[15px] font-bold pl-[284px] pb-5 select-none hover:underline">
                            <span className="group-open:hidden flex items-center gap-1">{t('vehicles.moreDetails')} <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg></span>
                            <span className="hidden group-open:flex items-center gap-1">{t('vehicles.lessDetails')} <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg></span>
                          </summary>
                          <div className="bg-[#f9f9f9] p-8 flex flex-col gap-6">
                            <h3 className="text-[22px] font-black text-gray-900">{t('vehicles.fullDetails')}</h3>
                            
                            {/* Full specs row matching official site */}
                            <div className="flex items-center gap-x-8 gap-y-4 text-[15px] font-black text-gray-900 flex-wrap">
                              <span className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                                {car.specs?.carCategorySeats || car.carCategorySeats || "?"} pessoas
                              </span>
                              <span className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-8 12H9v-2h2v2zm0-4H9V9h2v2z"/></svg>
                                {car.specs?.carCategoryDoors || car.carCategoryDoors || "?"} portas
                              </span>
                              {(car.specs?.carCategoryAirCond === "Y" || car.carCategoryAirCond === "Y") && (
                                <span className="flex items-center gap-2">
                                  <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M22 11h-4.17l3.24-3.24-1.41-1.42L15 11h-2V9l4.66-4.66-1.42-1.41L13 6.17V2h-2v4.17L7.76 2.93 6.34 4.34 11 9v2H9L4.34 6.34 2.93 7.76 6.17 11H2v2h4.17l-3.24 3.24 1.41 1.42L9 13h2v2l-4.66 4.66 1.42 1.41L11 17.83V22h2v-4.17l3.24 3.24 1.42-1.41L13 15v-2h2l4.66 4.66 1.41-1.42L17.83 13H22z"/></svg>
                                  A/C
                                </span>
                              )}
                              {car.specs?.carCategoryPowerHP && (
                                <span className="flex items-center gap-2">
                                  <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>
                                  {car.specs.carCategoryPowerHP}CV
                                </span>
                              )}
                              {car.specs?.carCategoryBaggageQuantity && (
                                <span className="flex items-center gap-2">
                                  <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M17 6h-2V3c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v3H7c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2h2v2h-2V4z"/></svg>
                                  {car.specs.carCategoryBaggageQuantity} bagagens
                                </span>
                              )}
                              <span className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v4h-2zm0 6h2v2h-2z"/></svg>
                                {car.specs?.carCategoryAutomatic === "Y" || car.carCategoryAutomatic === "Y" ? "Automático" : "Manual"}
                              </span>
                              {car.specs?.carCategoryPowerKW && (
                                <span className="flex items-center gap-2">
                                  <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                                  {car.specs.carCategoryPowerKW} kW
                                </span>
                              )}
                            </div>
                            
                            {/* CO2 + Age row */}
                            <div className="flex items-center gap-8 text-[15px] font-black text-gray-900 flex-wrap">
                              {car.specs?.carCategoryCO2Quantity && (
                                <span className="flex items-center gap-2">
                                  <span className="bg-[#FFD100] text-black text-[11px] font-black px-2 py-0.5 rounded">D</span>
                                  Emissão de CO2: {car.specs.carCategoryCO2Quantity} g/km
                                </span>
                              )}
                              <span className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 14c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm7.5 3H4.5v-1c0-1.5 3-2.25 4.5-2.25s4.5.75 4.5 2.25v1z"/></svg>
                                Idade mínima do motorista: {car.specs?.carCategoryMinDriverAge || "18"} anos
                              </span>
                            </div>
                            
                            {/* Incluídos - Quilometragem + Proteção blocks */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                              <div className="border-[2px] border-gray-100 bg-white rounded-xl p-5 flex flex-col justify-start">
                                <span className="text-[10px] font-black text-[#e4002b] uppercase tracking-wider mb-1">INCLUÍDO</span>
                                <h4 className="text-[17px] font-black text-gray-900 mb-4">Quilometragem</h4>
                                <div className="flex items-start gap-2 text-sm text-gray-700 font-bold mb-2">
                                  <svg className="w-4 h-4 text-[#008d36] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                  <span>
                                    {car.mileageType === "Livre"
                                      ? "Quilometragem ilimitada"
                                      : car.mileageLimit
                                        ? `${car.mileageLimit} ${car.mileageUnit || "km"} incluído${car.mileageKmType === 'D' ? '/dia' : ''}`
                                        : "Quilometragem incluída"}
                                  </span>
                                </div>
                                {car.mileageType !== "Livre" && car.extraMileageCost && (
                                  <div className="text-sm text-gray-500 pl-6">
                                    Quilometragem adicional: {currency} {car.extraMileageCost}/{car.mileageUnit || "km"}
                                  </div>
                                )}
                              </div>

                              {!isBrazil && (
                              <div className="border-[2px] border-gray-100 bg-white rounded-xl p-5 flex flex-col justify-start">
                                <span className="text-[10px] font-black text-[#e4002b] uppercase tracking-wider mb-1">INCLUÍDO</span>
                                <h4 className="text-[17px] font-black text-gray-900 mb-2">{t('extras.protectionTitle')}</h4>
                                {car.deductibleAmount && (
                                  <div className="text-sm font-bold text-gray-900 mb-4">
                                    Excesso: {car.deductibleCurrency || currency} {parseFloat(car.deductibleAmount).toLocaleString("pt-BR", {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                  </div>
                                )}
                                <div className="flex flex-col gap-2">
                                  {car.includedInsurances && car.includedInsurances.length > 0 ? (
                                    car.includedInsurances.map((ins: any, iIdx: number) => (
                                      <div key={iIdx} className="flex items-start gap-2 text-sm text-gray-700 font-bold">
                                        <svg className="w-4 h-4 text-[#008d36] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                        <span>{ins.name || ins.description || ins.code || "Proteção incluída"}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <>
                                      <div className="flex items-start gap-2 text-sm text-gray-700 font-bold">
                                        <svg className="w-4 h-4 text-[#008d36] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                        <span>{t('extras.collisionProtection')}</span>
                                      </div>
                                      <div className="flex items-start gap-2 text-sm text-gray-700 font-bold">
                                        <svg className="w-4 h-4 text-[#008d36] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                        <span>{t('extras.theftProtection')}</span>
                                      </div>
                                    </>
                                  )}
                                </div>
                                <div className="flex items-start gap-2 text-xs text-gray-400 mt-4">
                                  <svg className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                  Você poderá fazer upgrade da proteção depois de selecionar este veículo
                                </div>
                              </div>
                              )}
                            </div>

                          </div>
                        </details>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* Step 3 */
            <div className="bg-white rounded border border-gray-200 relative">
              {/* Step 3 Header bar */}
              <div className="border-b border-gray-200 p-4 md:p-6">
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={() => { setCurrentStep(2); setEquipmentPrices({}); setXrsEquipment([]); setQuoteInsurances([]); setQuoteMileage(null); setQuoteTotals(null); setSelectedEquipmentMap({}); }} className="text-[#008d36] font-bold hover:underline text-sm">← Voltar</button>
                </div>
                <h2 className="text-lg md:text-2xl font-black text-gray-900 mb-3">{t('extras.title')}</h2>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] md:text-xs text-gray-500 uppercase font-bold">TOTAL</div>
                    <div className="text-xl md:text-3xl font-black text-gray-900">
                      R$ {fmtPrice(
                        (parseFloat(selectedCar?.totalRateEstimateInBookingCurrency || selectedCar?.totalRateEstimate || "0")) +
                        (selectedExtrasPricePerDay * bookingDurationDays)
                      )}
                    </div>
                  </div>
                  <button
                    disabled={!!step3Error || loadingEquipment}
                    onClick={() => {
                      if (step3Error || loadingEquipment) return;
                      const selectedInsuranceCodes = Object.keys(selectedExtrasMap).filter(k => selectedExtrasMap[k] > 0);
                      const xrsEquipmentPayload = Object.entries(selectedEquipmentMap).filter(([, qty]) => qty > 0).map(([code, qty]) => {
                        const ep = equipmentPrices[code];
                        const meta = xrsEquipment.find((e: any) => e.code === code);
                        return { code, qty, name: meta?.name || code, icon: meta?.icon || '📦', price: ep?.price || 0, priceBRL: ep?.priceBRL || 0, totalBRL: ep?.totalBRL || 0, currency: ep?.currency || 'EUR' };
                      });
                      const xrsInsurancesPayload = selectedInsuranceCodes.map(code => {
                        const qi = quoteInsurances.find((i: any) => i.code === code);
                        const insNamesPT: Record<string, string> = { WWI: 'Proteção de para-brisas, vidros, faróis e pneus', THW: 'Proteção contra Roubo (THW)', STHW: 'Super Proteção contra Roubo', SPTHW: 'Proteção Total contra Roubo', SPCDW: 'Proteção Total contra Danos e Acidentes', SCDW: 'Super Proteção contra Danos', RSA: 'Assistência na estrada 24h', PREMPRE: 'Proteção Plus', PREMPLUS: 'Proteção Premium Plus', PREMIUM: 'Proteção Premium', PAI: 'Proteção para acidentes pessoais', MEDIUM: 'Proteção Média', INTERIOR: 'Cobertura de danos ao interior', AWC: 'Cobertura de estradas não pavimentadas', CDW: 'Proteção contra Danos por Colisão', LDW: 'Proteção Básica', TPL: 'Responsabilidade Civil', ECOLOGIC: 'Contribuição Ambiental', PEP: 'Proteção de Efeitos Pessoais', APP: 'Proteção de Aparência', LAF: 'Taxas e Impostos (Road Tax & License Fees)', HS: 'Adicional de Alta Temporada', HB: 'Seguro de Alto Risco', FP: 'Proteção contra Combustível', XCU: 'Proteção Estendida', RELOC: 'Taxa de Relocalização', YS: 'Sobretaxa Jovem Condutor', YOUNGDRI: 'Seguro Jovem Condutor', ONEWAY: 'Taxa de Viagem de Ida', DELIVER: 'Taxa de Entrega', COLLECT: 'Taxa de Coleta', REGFEE: 'Taxa Regulatória', AIRPORTFEE: 'Taxa de Aeroporto', CITYFEE: 'Taxa Municipal', NIGHTFEE: 'Taxa Fora de Horário', HOLIDAYFEE: 'Taxa de Feriado', ADMINFEE: 'Taxa Administrativa', SAFERETURN: 'Retorno Seguro' };
                        return { code, name: insNamesPT[code] || qi?.descr || code, price: qi?.rentalPriceAI || 0, priceBRL: qi?.rentalPriceInBookingCurrencyAI || 0 };
                      });
                      const cidForTariff = selectedTariffType === 'ETO'
                        ? (zeroExcessUpgrade ? '56935495' : (selectedCar?._etoCID || '56935466'))
                        : (selectedCar?.contractID || effectiveContractID || DEFAULT_POA_CID);
                      const enrichedCar = { ...selectedCar, ...quoteTotals, duration: bookingDurationDays };
                      const payload = { car: enrichedCar, duration: bookingDurationDays, extras: selectedExtrasMap, xrsEquipment: xrsEquipmentPayload, xrsInsurances: xrsInsurancesPayload, quoteInsurances: quoteInsurances, pickupStation, returnStation, pickupStationName: stationName || pickupStation, returnStationName: (isOneWay ? returnStationName : stationName) || returnStation, pickupDate, returnDate, pickupTime, returnTime, contractID: cidForTariff, tariffType: selectedTariffType, zeroExcess: zeroExcessUpgrade, selectedProtectionPackage, driverCountry, driverCountryName, stationCountry, quoteMileage, payerSplit, etoMarginPercent: etoMargin, driverAge, xrsLanguage, stationInfo: pickupStationInfo ? { type: pickupStationInfo.type, hasShuttle: pickupStationInfo.features?.hasShuttle, hasDelivery: pickupStationInfo.features?.hasDelivery, hasCollection: pickupStationInfo.features?.hasCollection } : undefined };
                      sessionStorage.setItem("europcar_booking", JSON.stringify(payload));
                      try {
                        const sessionId = sessionStorage.getItem("europcar_journey_session");
                        if (sessionId) {
                          const baseCarPrice = parseFloat(selectedCar?.totalRateEstimateInBookingCurrency || selectedCar?.totalRateEstimate || "0") || 0;
                          const insTotal = xrsInsurancesPayload.reduce((sum: number, ins: any) => sum + (parseFloat(ins.priceBRL) || 0), 0);
                          const eqTotal = xrsEquipmentPayload.reduce((sum: number, eq: any) => {
                            const t = parseFloat(eq.totalBRL || 0);
                            const d = parseFloat(eq.priceBRL || 0);
                            return sum + (t > 0 ? t : d * bookingDurationDays) * (eq.qty || 1);
                          }, 0);
                          const journeyExtrasPayload = {
                            insurances: xrsInsurancesPayload.map((ins: any) => ({
                              code: ins.code,
                              name: ins.name,
                              priceBRL: parseFloat(ins.priceBRL) || 0,
                            })),
                            equipment: xrsEquipmentPayload.map((eq: any) => ({
                              code: eq.code,
                              name: eq.name,
                              qty: eq.qty || 1,
                              priceBRL: parseFloat(eq.priceBRL) || 0,
                              totalBRL: parseFloat(eq.totalBRL || (parseFloat(eq.priceBRL || 0) * bookingDurationDays * (eq.qty || 1))) || 0,
                            })),
                            insurancesTotal: insTotal,
                            equipmentTotal: eqTotal,
                            extrasTotal: insTotal + eqTotal,
                            carPrice: baseCarPrice,
                            totalPrice: baseCarPrice + insTotal + eqTotal,
                          };
                          fetch("/api/journey/track", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              sessionId,
                              step: 3,
                              carPrice: baseCarPrice,
                              selectedExtras: journeyExtrasPayload,
                            }),
                          }).catch(() => {});
                        }
                      } catch {}
                      {
                        const qs = new URLSearchParams(searchParams.toString());
                        if (selectedCar?.carCode) qs.set("car", String(selectedCar.carCode));
                        if (selectedCar?.acrissCode) qs.set("acriss", String(selectedCar.acrissCode));
                        if (selectedTariffType) qs.set("tariff", String(selectedTariffType));
                        window.location.href = `/checkout?${qs.toString()}`;
                      }
                    }}
                    className={`font-black py-3 px-4 md:px-6 rounded text-xs md:text-sm whitespace-nowrap transition-colors ${
                      (step3Error || loadingEquipment)
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-[#008d36] hover:bg-[#007530] text-white'
                    }`}
                  >
                    {loadingEquipment ? 'Verificando...' : 'Ir para revisão →'}
                  </button>
                </div>
              </div>

              <div className="p-8">

              {step3Error ? (
                <div className="border-2 border-amber-300 rounded-xl p-8 md:p-12 text-center bg-amber-50 mb-8 max-w-2xl mx-auto shadow-sm">
                  <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                    ⚠️
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-3">Veículo Indisponível</h3>
                  <p className="text-gray-700 text-base mb-6 leading-relaxed">
                    {step3Error}
                  </p>
                  <button
                    onClick={() => {
                      setCurrentStep(2);
                      setStep3Error(null);
                      setEquipmentPrices({});
                      setXrsEquipment([]);
                      setQuoteInsurances([]);
                      setQuoteMileage(null);
                      setQuoteTotals(null);
                      setSelectedEquipmentMap({});
                    }}
                    className="inline-flex items-center justify-center gap-2 bg-[#008d36] hover:bg-[#007530] text-white font-bold py-3 px-8 rounded-lg shadow transition-colors text-base"
                  >
                    ← Voltar e escolher outro veículo
                  </button>
                </div>
              ) : null}

              {!step3Error && ((selectedTariffType === 'ETO' && protectionsSkipped) ? (
                <div className="border-2 border-[#008d36] rounded-xl p-10 text-center bg-green-50 mb-8">
                  <div className="w-20 h-20 bg-green-100 text-[#008d36] rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-2">🎉 Parabéns, você tomou a decisão correta!</h3>
                  <p className="text-gray-600 mb-6">{t('extras.reviewAndPay')}</p>
                  <button
                    onClick={() => {
                      const selectedInsuranceCodes2 = Object.keys(selectedExtrasMap).filter(k => selectedExtrasMap[k] > 0);
                      const xrsEquipmentPayload2 = Object.entries(selectedEquipmentMap).filter(([, qty]) => qty > 0).map(([code, qty]) => {
                        const ep2 = equipmentPrices[code];
                        const meta2 = xrsEquipment.find((e: any) => e.code === code);
                        return { code, qty, name: meta2?.name || code, icon: meta2?.icon || '📦', price: ep2?.price || 0, priceBRL: ep2?.priceBRL || 0, totalBRL: ep2?.totalBRL || 0, currency: ep2?.currency || 'EUR' };
                      });
                      const xrsInsurancesPayload2 = selectedInsuranceCodes2.map(code => {
                        const qi = quoteInsurances.find((i: any) => i.code === code);
                        const insNamesPT: Record<string, string> = { WWI: 'Proteção de para-brisas, vidros, faróis e pneus', THW: 'Proteção contra Roubo (THW)', STHW: 'Super Proteção contra Roubo', SPTHW: 'Proteção Total contra Roubo', SPCDW: 'Proteção Total contra Danos e Acidentes', SCDW: 'Super Proteção contra Danos', RSA: 'Assistência na estrada 24h', PREMPRE: 'Proteção Plus', PREMPLUS: 'Proteção Premium Plus', PREMIUM: 'Proteção Premium', PAI: 'Proteção para acidentes pessoais', MEDIUM: 'Proteção Média', INTERIOR: 'Cobertura de danos ao interior', AWC: 'Cobertura de estradas não pavimentadas', CDW: 'Proteção contra Danos por Colisão', LDW: 'Proteção Básica', TPL: 'Responsabilidade Civil', ECOLOGIC: 'Contribuição Ambiental', PEP: 'Proteção de Efeitos Pessoais', APP: 'Proteção de Aparência', LAF: 'Taxas e Impostos (Road Tax & License Fees)', HS: 'Adicional de Alta Temporada', HB: 'Seguro de Alto Risco', FP: 'Proteção contra Combustível', XCU: 'Proteção Estendida', RELOC: 'Taxa de Relocalização', YS: 'Sobretaxa Jovem Condutor', YOUNGDRI: 'Seguro Jovem Condutor', ONEWAY: 'Taxa de Viagem de Ida', DELIVER: 'Taxa de Entrega', COLLECT: 'Taxa de Coleta', REGFEE: 'Taxa Regulatória', AIRPORTFEE: 'Taxa de Aeroporto', CITYFEE: 'Taxa Municipal', NIGHTFEE: 'Taxa Fora de Horário', HOLIDAYFEE: 'Taxa de Feriado', ADMINFEE: 'Taxa Administrativa', SAFERETURN: 'Retorno Seguro' };
                        return { code, name: insNamesPT[code] || qi?.descr || code, price: qi?.rentalPriceAI || 0, priceBRL: qi?.rentalPriceInBookingCurrencyAI || 0 };
                      });
                      const cidForTariff = selectedTariffType === 'ETO'
                        ? (zeroExcessUpgrade ? '56935495' : (selectedCar?._etoCID || '56935466'))
                        : (zeroExcessUpgrade ? '56935495' : (selectedCar?.contractID || effectiveContractID || DEFAULT_POA_CID));
                      const payload = { car: { ...selectedCar, duration: bookingDurationDays }, duration: bookingDurationDays, extras: selectedExtrasMap, xrsEquipment: xrsEquipmentPayload2, xrsInsurances: xrsInsurancesPayload2, quoteInsurances: quoteInsurances, pickupStation, returnStation, pickupStationName: stationName || pickupStation, returnStationName: (isOneWay ? returnStationName : stationName) || returnStation, pickupDate, returnDate, pickupTime, returnTime, contractID: cidForTariff, tariffType: selectedTariffType, zeroExcess: zeroExcessUpgrade, selectedProtectionPackage, driverCountry, driverCountryName, stationCountry, quoteMileage, etoMarginPercent: etoMargin, driverAge, xrsLanguage, stationInfo: pickupStationInfo ? { type: pickupStationInfo.type, hasShuttle: pickupStationInfo.features?.hasShuttle, hasDelivery: pickupStationInfo.features?.hasDelivery, hasCollection: pickupStationInfo.features?.hasCollection } : undefined };
                      sessionStorage.setItem("europcar_booking", JSON.stringify(payload));
                      // Journey tracking — Step 3: Extras selected (ETO path)
                      try {
                        const sessionId = sessionStorage.getItem("europcar_journey_session");
                        if (sessionId) {
                          const baseCarPrice2 = parseFloat(selectedCar?.totalRateEstimateInBookingCurrency || "0");
                          const insTotal2 = xrsInsurancesPayload2.reduce((acc: number, cur: any) => acc + (parseFloat(cur.priceBRL) || 0), 0);
                          const eqTotal2 = xrsEquipmentPayload2.reduce((acc: number, cur: any) => {
                            const t = parseFloat(cur.totalBRL || 0);
                            const d = parseFloat(cur.priceBRL || 0);
                            return acc + (t > 0 ? t : d * bookingDurationDays) * (cur.qty || 1);
                          }, 0);
                          const journeyExtrasPayload2 = {
                            insurances: xrsInsurancesPayload2.map((ins: any) => ({
                              code: ins.code,
                              name: ins.name,
                              priceBRL: parseFloat(ins.priceBRL) || 0,
                            })),
                            equipment: xrsEquipmentPayload2.map((eq: any) => ({
                              code: eq.code,
                              name: eq.name,
                              qty: eq.qty || 1,
                              priceBRL: parseFloat(eq.priceBRL) || 0,
                              totalBRL: parseFloat(eq.totalBRL || (parseFloat(eq.priceBRL || 0) * bookingDurationDays * (eq.qty || 1))) || 0,
                            })),
                            insurancesTotal: insTotal2,
                            equipmentTotal: eqTotal2,
                            extrasTotal: insTotal2 + eqTotal2,
                            carPrice: baseCarPrice2,
                            totalPrice: baseCarPrice2 + insTotal2 + eqTotal2,
                          };
                          fetch("/api/journey/track", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              sessionId,
                              step: 3,
                              carPrice: baseCarPrice2,
                              selectedExtras: journeyExtrasPayload2,
                            }),
                          }).catch(() => {});
                        }
                      } catch {}
                      {
                        const qs = new URLSearchParams(searchParams.toString());
                        if (selectedCar?.carCode) qs.set("car", String(selectedCar.carCode));
                        if (selectedCar?.acrissCode) qs.set("acriss", String(selectedCar.acrissCode));
                        if (selectedTariffType) qs.set("tariff", String(selectedTariffType));
                        window.location.href = `/checkout?${qs.toString()}`;
                      }
                    }}
                    className="bg-[#008d36] hover:bg-[#007530] text-white font-black py-4 px-10 rounded-lg text-lg uppercase tracking-wide shadow-lg transition-colors"
                  >
                    Ir para Revisão e Pagamento →
                  </button>
                  <div className="mt-6">
                    <button
                      onClick={() => {
                        setProtectionsSkipped(false);
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
                        }
                      }}
                      className="text-[#008d36] text-sm font-bold hover:underline"
                    >
                      ← Rever opções de proteção e extras
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* 🛡️ Zero Excess Upsell — only for ETO tariff */}
                  {selectedTariffType === 'ETO' && (() => {
                    const code = selectedCar?.carCategoryCode;
                    const etoZeroCar = etoZeroCars.find(e => e.carCategoryCode === code);
                    if (!etoZeroCar) return null;
                    // selectedCar.totalRateEstimate already has etoMargin applied (set when user clicked "Pagar Agora")
                    // so we must apply the same margin to the Zero Excess price to get a consistent upgrade delta
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
                    return (
                      <div className={`border-2 rounded-xl p-4 md:p-6 mb-8 transition-all ${zeroExcessUpgrade ? 'border-[#008d36] bg-green-50 shadow-lg shadow-green-100' : 'border-[#e67e00] bg-gradient-to-r from-orange-50 to-amber-50 hover:shadow-md'}`}>
                        <div className="flex flex-col md:flex-row items-start gap-3 md:gap-5">
                          <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-[#e67e00] to-[#ff9800] flex items-center justify-center text-white text-xl md:text-2xl shrink-0 shadow-lg">🛡️</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h3 className="font-black text-gray-900 text-base md:text-lg">Proteção Premium — Franquia Zero</h3>
                              <span className="text-[9px] bg-[#e67e00] text-white px-2 py-0.5 rounded-full font-black uppercase">Recomendado</span>
                            </div>
                            <p className="text-xs md:text-sm text-gray-600 mb-3">{t('extras.zeroExcessDesc')}</p>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-6">
                              <div>
                                <span className="text-[10px] text-gray-400 uppercase font-bold block">{t('extras.upgradeFor')}</span>
                                <span className="text-xl md:text-2xl font-black text-[#e67e00]">+ {currency} {fmtPrice(upgradeCost)}</span>
                                {upgradeBRL > 0 && <span className="text-xs text-gray-500 ml-2">(+ R$ {fmtPrice(upgradeBRL)})</span>}
                              </div>
                              <button
                                onClick={() => {
                                  if (zeroExcessUpgrade) { setZeroExcessUpgrade(false); }
                                  else {
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
                                className={`font-bold py-3 px-6 md:px-8 rounded-lg text-sm transition-all w-full sm:w-auto text-center ${zeroExcessUpgrade ? 'bg-[#008d36] text-white shadow-lg' : 'bg-[#e67e00] hover:bg-[#cc6f00] text-white shadow-lg shadow-[#e67e00]/25'}`}
                              >
                                {zeroExcessUpgrade ? '✓ Adicionado' : 'Adicionar Proteção'}
                              </button>
                            </div>
                            {zeroExcessUpgrade && (
                              <div className="mt-3 text-xs md:text-sm text-[#008d36] font-bold flex flex-wrap items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                Franquia zero ativada! Novo total: {currency} {fmtPrice(zeroTotal)}
                                {zeroBRL > 0 && <span className="text-gray-500 font-normal">(R$ {fmtPrice(zeroBRL)})</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 🛡️ Proteções da API getQuote — Real data for selected vehicle */}
                  {loadingEquipment ? (
                    <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
                      <div className="w-4 h-4 border-2 border-[#008d36] border-t-transparent rounded-full animate-spin" />
                      <p>{t('extras.loadingProtections')}</p>
                    </div>
                  ) : quoteInsurances.filter((ins: any) => ins.type !== 'M' && ins.code !== 'SL').length > 0 ? (() => {
                    // Insurance name and description maps (Portuguese)
                    const insNamesPT: Record<string, string> = {
                      WWI: 'Proteção de para-brisas, vidros, faróis e pneus',
                      THW: 'Proteção contra Roubo (THW)',
                      STHW: 'Super Proteção contra Roubo',
                      SPTHW: 'Proteção Total contra Roubo',
                      SPCDW: 'Proteção Total contra Danos e Acidentes',
                      SL: 'Sem Proteção (Stand Liable)',
                      SCDW: 'Super Proteção contra Danos (SCDW)',
                      RSA: 'Assistência na estrada 24h',
                      PREMPRE: 'Proteção Plus',
                      PREMPLUS: 'Proteção Premium Plus',
                      PREMIUM: 'Proteção Premium',
                      PAI: 'Proteção para acidentes pessoais',
                      MEDIUM: 'Proteção Média',
                      INTERIOR: 'Cobertura de danos ao interior',
                      AWC: 'Cobertura de estradas não pavimentadas',
                      CDW: 'Proteção contra Danos por Colisão',
                      LDW: 'Proteção Básica (LDW)',
                      TPL: 'Responsabilidade Civil',
                      ECOLOGIC: 'Contribuição Ambiental',
                      PEP: 'Proteção de Efeitos Pessoais',
                      APP: 'Proteção de Aparência',
                      // ── Códigos adicionais frequentes na API XRS ──────────────
                      LAF: 'Taxas e Impostos (Road Tax & License Fees)',
                      HS:  'Adicional de Alta Temporada',
                      HB:  'Seguro de Alto Risco',
                      FP:  'Proteção contra Combustível',
                      XCU: 'Proteção Estendida',
                      RELOC: 'Taxa de Relocalização',
                      YS: 'Sobretaxa Jovem Condutor',
                      YOUNGDRI: 'Seguro Jovem Condutor',
                      ONEWAY: 'Taxa de Viagem de Ida',
                      DELIVER: 'Taxa de Entrega',
                      COLLECT: 'Taxa de Coleta',
                      REGFEE: 'Taxa Regulatória',
                      AIRPORTFEE: 'Taxa de Aeroporto',
                      CITYFEE: 'Taxa Municipal',
                      NIGHTFEE: 'Taxa Fora de Horário',
                      HOLIDAYFEE: 'Taxa de Feriado',
                      ADMINFEE: 'Taxa Administrativa',
                      SAFERETURN: 'Retorno Seguro',
                    };
                    const insDescPT: Record<string, string> = {
                      WWI: 'Reduz a zero a sua responsabilidade financeira por danos ao para-brisas, vidros, faróis e pneus.',
                      THW: 'Proteção contra roubo do veículo com franquia reduzida.',
                      STHW: 'Super proteção contra roubo com franquia ainda menor.',
                      SPTHW: 'Proteção total contra roubo — franquia zero.',
                      SPCDW: 'Proteção total contra danos e acidentes — franquia zero, cobertura completa.',
                      SL: 'Sem proteção adicional. Você assume toda a responsabilidade financeira.',
                      SCDW: 'Redução adicional da franquia em caso de danos ao veículo.',
                      RSA: 'Todo o caminho consigo, a qualquer hora, em qualquer dia. Com a assistência na estrada terá auxílio sempre que precisar.',
                      PREMPRE: 'Pacote de proteção completo com franquia zero para maiores de 23 anos.',
                      PREMPLUS: 'Pacote premium estendido com cobertura máxima e assistência.',
                      PREMIUM: 'Pacote Premium com proteção completa contra danos e roubo.',
                      PAI: 'Oferece indenização para motorista e passageiros em caso de morte ou lesão e cobertura para despesas médicas.',
                      MEDIUM: 'Pacote de proteção com franquia reduzida contra danos e roubo.',
                      INTERIOR: 'Cobertura de danos ao interior do veículo.',
                      AWC: 'Cobertura para condução em estradas não pavimentadas ou de terra.',
                      CDW: 'Proteção contra danos por colisão com franquia.',
                      LDW: 'Proteção básica incluindo danos e roubo com franquia padrão.',
                      TPL: 'Seguro obrigatório de responsabilidade civil.',
                      ECOLOGIC: 'Contribuição ambiental obrigatória.',
                      PEP: 'Cobertura para bagagens e pertences pessoais.',
                      APP: 'Proteção contra danos estéticos ao veículo.',
                    };
                    // Icon mapping using sprite sheet position (4x4 grid)
                    const insIconEmoji: Record<string, string> = {
                      WWI: '🔧', THW: '🔒', STHW: '🔐', SPTHW: '🛡️',
                      SPCDW: '✅', SL: '⚠️', SCDW: '🛡️', RSA: '🚑',
                      PREMPRE: '⭐', PREMPLUS: '👑', PREMIUM: '🏆',
                      PAI: '🩺', MEDIUM: '🛡️', INTERIOR: '💺', AWC: '🛤️',
                      CDW: '🚗', LDW: '📋', TPL: '📄', ECOLOGIC: '🌿',
                      PEP: '🧳', APP: '🎨',
                    };
                    // ── Tier classification of insurance codes ────────────────────────────
                    const MEDIUM_CODES = new Set(['RSA', 'WWI', 'APP', 'INTERIOR', 'AWC', 'PEP', 'THW', 'STHW', 'MEDIUM', 'PAI']);
                    const PREMIUM_CODES = new Set(['SCDW', 'SPCDW', 'SPTHW', 'PREMIUM', 'PREMPLUS', 'PREMPRE', 'ECOLOGIC']);

                    const includedIns  = quoteInsurances.filter((ins: any) => ins.type === 'I');
                    const optionalIns  = quoteInsurances.filter((ins: any) => ins.type === 'O' && ins.code !== 'SL');
                    const mediumMembers  = optionalIns.filter((ins: any) => MEDIUM_CODES.has(ins.code));
                    const premiumMembers = optionalIns.filter((ins: any) => PREMIUM_CODES.has(ins.code));
                    const premiumAll    = [...mediumMembers, ...premiumMembers];
                    const sumBRL = (list: any[]) => list.reduce((acc: number, ins: any) => acc + (ins.rentalPriceInBookingCurrencyAI || 0), 0);

                    const packages = [
                      { id: 'basic' as const, label: 'Básico', sublabel: 'Já incluído no veículo', badge: '', color: 'border-gray-300', headerBg: 'bg-gray-800', icon: '🛡️', members: [] as any[], extraMembers: includedIns, total: 0, isFree: true, description: 'Proteção mínima obrigatória incluída na tarifa do veículo.' },
                      { id: 'medium' as const, label: 'Médio', sublabel: 'Cobertura ampliada', badge: 'POPULAR', color: 'border-[#008d36]', headerBg: 'bg-[#008d36]', icon: '🛡️🛡️', members: mediumMembers, extraMembers: includedIns, total: sumBRL(mediumMembers), isFree: false, description: 'Amplia a proteção com coberturas adicionais como vidros, assistência e mais.' },
                      { id: 'premium' as const, label: 'Premium', sublabel: 'Cobertura máxima', badge: 'COMPLETO', color: 'border-yellow-400', headerBg: 'bg-yellow-500', icon: '🏆', members: premiumAll, extraMembers: includedIns, total: sumBRL(premiumAll), isFree: false, description: 'Máxima cobertura: sem franquia, proteção total contra danos e roubo.' },
                    ].filter(pkg => pkg.id === 'basic' || pkg.members.length > 0);

                    const handleSelectPackage = (pkgId: 'none' | 'basic' | 'medium' | 'premium', members: any[]) => {
                      setSelectedProtectionPackage(pkgId);
                      const newMap: Record<string, number> = { ...selectedExtrasMap };
                      for (const ins of quoteInsurances) { delete newMap[ins.code]; }
                      for (const ins of members) { if (ins.type === 'O') newMap[ins.code] = 1; }
                      setSelectedExtrasMap(newMap);
                    };

                     return (
                      <>
                        <h3 className="font-extrabold text-2xl text-gray-900 mb-2">Proteções</h3>
                        <p className="text-sm text-gray-500 mb-6">{t('extras.selectProtection')}</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                          {quoteInsurances
                            .filter((ins: any) => ins.type !== 'M' && ins.code !== 'SL')
                            .map((ins: any) => {
                              const insId = ins.code;
                              const sel = selectedExtrasMap[insId] > 0;
                              const isIncluded = ins.type === 'I';
                              const totalBRL = ins.rentalPriceInBookingCurrencyAI || 0;
                              const isAvailable = totalBRL > 0 || isIncluded;
                              const excessBRL = ins.bkExcessWithPOM || 0;
                              const name = insNamesPT[insId] || ins.descr || insId;
                              const desc = insDescPT[insId] || ins.descr || 'Proteção adicional.';
                              const icon = insIconEmoji[insId] || '🛡️';
                              const TRUNCATE_AT = 90;
                              const isLong = desc.length > TRUNCATE_AT;
                              const shortDesc = isLong ? desc.slice(0, TRUNCATE_AT) + '...' : desc;
                              return (
                                <article
                                  key={insId}
                                  className={`bg-white p-5 flex flex-col justify-between h-full rounded-lg transition-shadow duration-200 cursor-default
                                    ${sel ? 'border-2 border-[#008d36] shadow-md' : 'border border-gray-200 hover:shadow-md'}`}
                                >
                                  {/* Top content */}
                                  <div className="flex flex-col">
                                    {/* Icon + Title + Code tag */}
                                    <div className="flex items-start gap-3 mb-3">
                                      <div className="w-14 h-14 flex-shrink-0 flex items-center justify-center text-3xl bg-gray-50 rounded-lg border border-gray-100">
                                        {icon}
                                      </div>
                                      <div className="flex flex-col flex-1 min-w-0">
                                        <h2 className="text-[0.95rem] font-bold leading-tight text-gray-900 mb-1">{name}</h2>
                                        {/* Code tag */}
                                        <span className="self-start text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200">
                                          {insId}
                                        </span>
                                      </div>
                                    </div>
                                    {/* Description */}
                                    <div className="text-gray-500 text-xs leading-relaxed mb-3">
                                      <p>{shortDesc}</p>
                                    </div>
                                    {/* Excess / zero excess badge — inclui as proteções do pacote Básico (incluídas):
                                        é justamente nelas que o cliente precisa ver a franquia padrão */}
                                    {excessBRL > 0 ? (
                                      <p className={`text-xs mb-1 ${isIncluded ? 'font-bold text-gray-800' : 'text-gray-400'}`}>Franquia: R$ {fmtPrice(excessBRL)}</p>
                                    ) : (ins.excessWithPOM || 0) > 0 ? (
                                      <p className={`text-xs mb-1 ${isIncluded ? 'font-bold text-gray-800' : 'text-gray-400'}`}>Franquia: {selectedCar?.currency || 'EUR'} {fmtPrice(ins.excessWithPOM)}</p>
                                    ) : null}
                                    {ins.excessWithPOM === 0 && !isIncluded && insId !== 'RSA' && insId !== 'PAI' && (
                                      <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full mb-2 self-start uppercase tracking-wide">{t('extras.noExcess')}</span>
                                    )}
                                  </div>

                                  {/* Bottom: price + button */}
                                  <div className="mt-auto">
                                    <div className="mb-3">
                                      {isIncluded ? (
                                        <span className="text-base font-extrabold text-[#008d36]">Incluída</span>
                                      ) : isAvailable ? (
                                        <>
                                          <span className="text-xl font-extrabold text-gray-900">R$ {fmtPrice(totalBRL)}</span>
                                          <span className="text-gray-500 font-medium text-sm"> / total</span>
                                        </>
                                      ) : (
                                        <span className="text-sm font-bold text-orange-400">Indisponível</span>
                                      )}
                                    </div>
                                    {isIncluded ? (
                                      <div className="w-full text-center font-bold py-2.5 rounded-md text-sm bg-green-100 text-[#008d36]">
                                        ✓ Incluída
                                      </div>
                                    ) : isAvailable ? (
                                      <button
                                        onClick={() => sel ? handleExtraQuantity(insId, -1) : handleExtraQuantity(insId, 1)}
                                        className={`w-full py-2.5 rounded-md font-bold text-sm transition-colors
                                          ${sel ? 'bg-[#008d36] text-white' : 'bg-[#FFD100] hover:bg-[#f2c800] text-black'}`}
                                      >
                                        {sel ? '✓ Adicionado — Remover' : 'Adicionar'}
                                      </button>
                                    ) : (
                                      <div className="w-full text-center font-bold py-2.5 rounded-md text-sm bg-gray-100 text-gray-400">
                                        Indisponível
                                      </div>
                                    )}
                                  </div>
                                </article>
                              );
                            })}
                        </div>
                      </>
                    );
                  })() : (() => {
                    const basicWithExcess = (quoteInsurances || []).find(
                      (ins: any) => (ins.type === 'I' || ins.type === 'M') && (ins.bkExcessWithPOM > 0 || ins.excessWithPOM > 0)
                    );
                    const excessBRL = basicWithExcess?.bkExcessWithPOM || 0;
                    const excessOrig = basicWithExcess?.excessWithPOM || 0;
                    const currency = selectedCar?.currency || 'EUR';

                    return (
                      <div className="border border-green-200 bg-gradient-to-r from-green-50/70 to-emerald-50/40 rounded-2xl p-5 md:p-6 mb-8 shadow-xs">
                        <div className="flex items-start gap-3.5 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-[#008d36] text-white flex items-center justify-center text-xl shrink-0 shadow-sm">
                            🛡️
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-extrabold text-gray-900 text-base md:text-lg">
                                Proteção Básica Inclusa
                              </h3>
                              <span className="text-[11px] bg-green-100 text-[#008d36] font-bold px-2.5 py-0.5 rounded-full border border-green-200">
                                Já inclusa no valor
                              </span>
                            </div>
                            <p className="text-xs md:text-sm text-gray-600 mt-0.5">
                              Sua tarifa já contempla as coberturas obrigatórias da Europcar para você viajar com segurança e tranquilidade.
                            </p>
                          </div>
                        </div>

                        {/* Coberturas detalhadas da proteção básica */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-3 border-t border-green-100">
                          <div className="bg-white/80 rounded-xl p-3.5 border border-green-100/80 shadow-2xs">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-base">🚗</span>
                              <h4 className="font-bold text-gray-900 text-xs md:text-sm">Danos e Colisão (CDW/LDW)</h4>
                            </div>
                            <p className="text-[11px] md:text-xs text-gray-600 leading-relaxed">
                              Limita sua responsabilidade financeira em caso de avarias ou danos por colisão acidental ao veículo alugado.
                            </p>
                          </div>

                          <div className="bg-white/80 rounded-xl p-3.5 border border-green-100/80 shadow-2xs">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-base">🔒</span>
                              <h4 className="font-bold text-gray-900 text-xs md:text-sm">Roubo e Furto (THW/TP)</h4>
                            </div>
                            <p className="text-[11px] md:text-xs text-gray-600 leading-relaxed">
                              Cobertura contra roubo ou furto total do veículo durante todo o período da locação.
                            </p>
                          </div>

                          <div className="bg-white/80 rounded-xl p-3.5 border border-green-100/80 shadow-2xs">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-base">📄</span>
                              <h4 className="font-bold text-gray-900 text-xs md:text-sm">Responsabilidade Civil (TPL)</h4>
                            </div>
                            <p className="text-[11px] md:text-xs text-gray-600 leading-relaxed">
                              Proteção contra terceiros para danos materiais e corporais, conforme as leis do país de destino.
                            </p>
                          </div>
                        </div>

                        {/* Informação sobre franquia */}
                        <div className="mt-3.5 pt-3 border-t border-green-100/70 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1.5">
                            <span className="text-green-700 font-bold">ℹ️</span>
                            {excessBRL > 0 ? (
                              <span>Franquia padrão desta categoria: <strong className="text-gray-800">R$ {fmtPrice(excessBRL)}</strong> {excessOrig > 0 && `(${currency} ${fmtPrice(excessOrig)})`} (aplicada somente em caso de sinistro ou avaria).</span>
                            ) : (
                              <span>Proteção sujeita à coparticipação (franquia) padrão da locadora, acionada somente em caso de sinistro.</span>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 🚗 Quilometragem Incluída */}
                  {quoteMileage && (
                    <>
                      <h3 className="font-black text-lg text-gray-900 mb-4 mt-2">Quilometragem</h3>
                      <div className="border border-gray-200 rounded-xl p-5 mb-8 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-2xl shrink-0 shadow-md">🛣️</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <div className="flex items-center gap-2">
                              <svg className="w-5 h-5 text-[#008d36]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                              <span className="font-bold text-gray-900">{quoteMileage.totalIncludedDist.toLocaleString('pt-BR')} km</span>
                            </div>
                            <span className="text-sm text-gray-500">
                              ({quoteMileage.includedKm} km/{quoteMileage.includedKmType === 'D' ? 'dia' : 'período'})
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            Quilometragem adicional: <span className="font-bold text-gray-700">R$ {fmtPrice(quoteMileage.extraKmPriceBRL)}/km</span>
                            <span className="text-xs text-gray-400 ml-1">({quoteMileage.currency} {fmtPrice(quoteMileage.extraKmPrice)}/km)</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-bold text-[#008d36]">Incluído</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* 🧳 Extras disponíveis (XRS API) */}
                  <div className="mt-10">
                    <h3 className="font-black text-xl text-gray-900 mb-6">{t('extras.availableExtras')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                      {xrsEquipment.slice().sort((a: any, b: any) => {
                        const epA = equipmentPrices[a.code];
                        const fbA = parseFloat(a.priceFromList) || 0;
                        const hasPriceA = (epA && (epA.price > 0 || epA.priceBRL > 0 || epA.totalBRL > 0)) || fbA > 0;
                        const isUnavailableA = !loadingEquipment && !hasPriceA;

                        const epB = equipmentPrices[b.code];
                        const fbB = parseFloat(b.priceFromList) || 0;
                        const hasPriceB = (epB && (epB.price > 0 || epB.priceBRL > 0 || epB.totalBRL > 0)) || fbB > 0;
                        const isUnavailableB = !loadingEquipment && !hasPriceB;

                        if (isUnavailableA && !isUnavailableB) return 1;
                        if (!isUnavailableA && isUnavailableB) return -1;
                        return 0;
                      }).map((eq: any) => {
                        const qty = selectedEquipmentMap[eq.code] || 0;
                        const isChildSeat = CHILD_SEAT_CODES.has(eq.code);
                        const totalChildSeats = isChildSeat
                          ? Object.entries(selectedEquipmentMap)
                              .filter(([k]) => CHILD_SEAT_CODES.has(k))
                              .reduce((sum, [, v]) => sum + v, 0)
                          : 0;
                        const maxSeatsNum = parseInt(selectedCar?.carCategorySeats || '5', 10);
                        const maxChildSeats = maxSeatsNum > 5 ? 4 : 3;
                        const isDriver = eq.code === 'ADD' || eq.code === 'ADR';
                        const totalDrivers = isDriver
                          ? Object.entries(selectedEquipmentMap)
                              .filter(([k]) => k === 'ADD' || k === 'ADR')
                              .reduce((sum, [, v]) => sum + v, 0)
                          : 0;

                        const canAdd = qty < eq.maxQty &&
                          (!isChildSeat || totalChildSeats < maxChildSeats) &&
                          (!isDriver || totalDrivers < 3);
                        const fallbackPrice = parseFloat(eq.priceFromList) || 0;
                        const ep = equipmentPrices[eq.code];
                        const hasPrice = (ep && (ep.price > 0 || ep.priceBRL > 0 || ep.totalBRL > 0)) || fallbackPrice > 0;
                        const isUnavailable = !loadingEquipment && !hasPrice;
                        const isOnRequest = ep?.onRequest || eq.onRequest;
                        // Use totalBRL (rentalPriceInBookingCurrencyAI) = total for the period in BRL
                        const priceBRL = ep && ep.totalBRL > 0
                          ? ep.totalBRL
                          : ep && ep.priceBRL > 0
                            ? ep.priceBRL * bookingDurationDays
                            : ep && ep.price > 0
                              ? ep.price * (ep.exchangeRate || 1) * bookingDurationDays
                              : fallbackPrice * parseFloat(selectedCar?.exchangeRate || '1') * bookingDurationDays;

                        return (
                          <div
                            key={eq.code}
                            className={`bg-white border rounded-xl p-5 flex flex-col justify-between h-full transition-all duration-200 relative
                              ${isUnavailable ? 'opacity-60 cursor-not-allowed' : qty > 0 ? 'ring-2 ring-[#008d36] border-transparent shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}
                          >
                            {/* "Limitado" badge for on-request items */}
                            {isOnRequest && !isUnavailable && (
                              <div className="absolute -top-3 left-4 bg-gray-900 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 uppercase tracking-wide">
                                Sob Consulta ℹ️
                              </div>
                            )}

                            <div>
                              {/* Header: ilustração do extra + título (sem código técnico) */}
                              <div className="flex items-start gap-3.5 mb-2.5">
                                <div className={`w-14 h-14 shrink-0 rounded-xl flex items-center justify-center bg-gray-50 border border-gray-100 ${isUnavailable ? 'opacity-40 grayscale' : ''}`}>
                                  <EquipmentVisual code={eq.code} icon={eq.icon} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className={`text-sm font-bold leading-snug line-clamp-2 ${isUnavailable ? 'text-gray-400' : 'text-gray-900'}`}>
                                    {eq.name}
                                  </h4>
                                </div>
                              </div>

                              {/* Description */}
                              {eq.description && (
                                <p className={`text-xs leading-relaxed line-clamp-3 mb-4 min-h-[2.5rem] ${isUnavailable ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {eq.description}
                                </p>
                              )}
                            </div>

                            {/* Price + Controls */}
                            <div className="mt-auto pt-2">
                              {loadingEquipment ? (
                                <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                                  <div className="w-3 h-3 border-2 border-[#008d36] border-t-transparent rounded-full animate-spin" />
                                  Buscando preço...
                                </div>
                              ) : isUnavailable ? (
                                <span className="inline-block text-xs bg-red-50 text-red-500 font-bold px-3 py-1 rounded-full border border-red-200">
                                  Indisponível
                                </span>
                              ) : (
                                <>
                                  {/* Price igual ao oficial: R$ XXX,XX / total */}
                                  <div className="mb-3">
                                    <span className="text-xl font-black text-gray-900">
                                      R$ {priceBRL.toFixed(2).replace('.', ',')}
                                    </span>
                                    <span className="text-xs font-normal text-gray-400 ml-1">/ total</span>
                                  </div>

                                  {/* Controls: Seletor [- 0 +] ou Botão Amarelo "Adicionar" */}
                                  {eq.maxQty > 1 ? (
                                    <div className="flex items-center justify-between border border-gray-200 rounded-lg p-1 bg-white">
                                      <button
                                        onClick={() => handleEquipmentQuantity(eq.code, -1, eq.maxQty)}
                                        disabled={qty === 0}
                                        className={`w-10 h-9 rounded flex items-center justify-center text-lg font-bold transition-colors
                                          ${qty > 0 ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`}
                                      >
                                        −
                                      </button>
                                      <span className="font-bold text-sm text-gray-900 px-2">{qty}</span>
                                      <button
                                        onClick={() => handleEquipmentQuantity(eq.code, 1, eq.maxQty)}
                                        disabled={!canAdd}
                                        className={`w-10 h-9 rounded flex items-center justify-center text-lg font-bold transition-colors
                                          ${canAdd ? 'border border-[#008d36] text-[#008d36] hover:bg-green-50 cursor-pointer' : 'border border-gray-200 text-gray-300 bg-gray-50 cursor-not-allowed'}`}
                                      >
                                        +
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => qty > 0
                                        ? handleEquipmentQuantity(eq.code, -1, eq.maxQty)
                                        : handleEquipmentQuantity(eq.code, 1, eq.maxQty)
                                      }
                                      disabled={qty === 0 && !canAdd}
                                      className={`w-full font-bold py-2.5 rounded-lg text-sm transition-all shadow-xs
                                        ${qty > 0
                                          ? 'bg-[#008d36] text-white hover:bg-[#007a2d] cursor-pointer'
                                          : canAdd
                                            ? 'bg-[#FFCC00] hover:bg-[#e6b800] text-gray-900 cursor-pointer'
                                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        }`}
                                    >
                                      {qty > 0
                                        ? (['TOL', 'TOLL', 'VVR', 'ETL'].includes(eq.code) ? '✓ Ativado' : '✓ Adicionado')
                                        : (['TOL', 'TOLL', 'VVR', 'ETL'].includes(eq.code) ? 'Ativar Pedágio' : 'Adicionar')}
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>


                </>
              ))}
              </div> {/* close p-8 wrapper */}
            </div>
          )}
        </div>
      </div>
      {/* Promo Alert Modal for International Pay at Counter */}
      {showBalcaoPromoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-8 text-center border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500" />
            <button
              onClick={handleConfirmPoaFromModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors z-10"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {promoPopupConfig?.imageUrl ? (
              <div className="mb-4 rounded-xl overflow-hidden max-h-48 border border-gray-100 shadow-sm">
                <img src={promoPopupConfig.imageUrl} alt="Promo" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                <span className="text-3xl">🏷️</span>
              </div>
            )}

            {promoPopupConfig?.badgeText && (
              <span className="inline-block bg-emerald-100 text-emerald-700 text-[10px] font-black px-2.5 py-0.5 rounded-full mb-2 uppercase tracking-wide">
                {promoPopupConfig.badgeText}
              </span>
            )}

            <h3 className="text-xl font-black text-gray-900 mb-3">
              {promoPopupConfig?.title || "Aproveite a Promoção!"}
            </h3>
            
            <p className="text-gray-600 text-sm leading-relaxed mb-6 font-medium whitespace-pre-line">
              {promoPopupConfig?.message || "Aproveite a promoção, pagamento no cartão de crédito ou pix com até 6% de desconto e cancelamento grátis."}
            </p>
            
            <div className="space-y-3">
              <button
                onClick={handleConfirmEtoFromModal}
                className="w-full bg-[#008d36] hover:bg-[#007530] text-white font-black py-3.5 px-6 rounded-xl shadow-lg shadow-green-900/20 transition-all transform hover:-translate-y-0.5 text-sm flex items-center justify-center gap-2"
              >
                <span>💳</span> {promoPopupConfig?.primaryBtnText || "Garantir Desconto (Pagar Online)"}
              </button>
              <button
                onClick={handleConfirmPoaFromModal}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-xl text-xs transition-colors"
              >
                {promoPopupConfig?.secondaryBtnText || "Continuar sem Desconto (Pagar no Balcão)"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ═══ ON-REQUEST VEHICLE MODAL ═══ */}
      {onRequestModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
            <button
              onClick={() => setOnRequestModal(null)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            >
              ×
            </button>

            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-xl font-black">!</span>
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-3">
                Você selecionou um veículo “Sob Consulta”
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Este modelo tem disponibilidade limitada. Após concluir a reserva, a estação tem{' '}
                <strong>8 horas úteis</strong> para confirmar ou recusar.
                Um e-mail será enviado com o resultado.{' '}
                Se não confirmado, você deverá fazer uma nova reserva.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  const { car, tariff } = onRequestModal;
                  setOnRequestModal(null);
                  setSelectedTariffType(tariff);
                  handleSelectCar(car);
                }}
                className="w-full bg-[#FFD100] hover:bg-[#F2C700] text-black font-black py-3.5 px-6 rounded-xl text-sm transition-colors"
              >
                Continuar com este veículo
              </button>
              <button
                onClick={() => setOnRequestModal(null)}
                className="w-full bg-white border-2 border-[#008d36] hover:bg-green-50 text-[#008d36] font-black py-3.5 px-6 rounded-xl text-sm transition-colors"
              >
                Escolher outro veículo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Export with Suspense (required for useSearchParams in Next.js 14) ----
export default function VehiclesSelectionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f7f7f7] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#008d36] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="font-bold text-gray-600">Carregando...</p>
        </div>
      </div>
    }>
      <VehiclesContent />
    </Suspense>
  );
}
