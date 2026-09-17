/**
 * receiptLocales.ts
 *
 * Mapa de países (ISO 3166-1 alpha-2) para:
 *   - locale: código BCP47 para formatação de datas/números
 *   - currency: código ISO 4217
 *   - currencySymbol: símbolo para exibição
 *   - lang: código de idioma simplificado
 *   - labels: todas as strings do recibo traduzidas
 */

export interface ReceiptLocale {
  locale: string;
  currency: string;
  currencySymbol: string;
  lang: string;
  labels: {
    title: string;
    confirmed: string;
    reservationNo: string;
    issueDate: string;
    customer: string;
    name: string;
    email: string;
    phone: string;
    vehicle: string;
    category: string;
    model: string;
    pickup: string;
    return: string;
    station: string;
    date: string;
    time: string;
    extras: string;
    insurances: string;
    payment: string;
    method: string;
    total: string;
    localTotal: string;
    paymentMethods: {
      CREDIT: string;
      PIX: string;
      BALCAO: string;
      VOUCHER: string;
    };
    footer: string;
    printButton: string;
    downloadButton: string;
  };
}

const LOCALES: Record<string, ReceiptLocale> = {
  // ──── BRASIL ────
  BR: {
    locale: 'pt-BR', currency: 'BRL', currencySymbol: 'R$', lang: 'pt',
    labels: {
      title: 'Recibo de Reserva',
      confirmed: 'Reserva Confirmada',
      reservationNo: 'Nº da Reserva',
      issueDate: 'Data de Emissão',
      customer: 'Dados do Cliente',
      name: 'Nome',
      email: 'E-mail',
      phone: 'Telefone',
      vehicle: 'Veículo',
      category: 'Categoria',
      model: 'Modelo de Referência',
      pickup: 'Retirada',
      return: 'Devolução',
      station: 'Estação',
      date: 'Data',
      time: 'Horário',
      extras: 'Extras e Proteções',
      insurances: 'Seguros',
      payment: 'Pagamento',
      method: 'Método',
      total: 'Total',
      localTotal: 'Total na Moeda Local',
      paymentMethods: { CREDIT: 'Cartão de Crédito', PIX: 'PIX', BALCAO: 'Pagamento no Balcão', VOUCHER: 'Voucher Corporativo' },
      footer: 'Apresente este recibo no balcão de retirada. Europcar · europcar.com.br',
      printButton: '🖨️ Imprimir / Salvar PDF',
      downloadButton: '⬇️ Baixar PDF',
    },
  },

  // ──── PORTUGAL ────
  PT: {
    locale: 'pt-PT', currency: 'EUR', currencySymbol: '€', lang: 'pt',
    labels: {
      title: 'Recibo de Reserva',
      confirmed: 'Reserva Confirmada',
      reservationNo: 'Nº da Reserva',
      issueDate: 'Data de Emissão',
      customer: 'Dados do Cliente',
      name: 'Nome',
      email: 'E-mail',
      phone: 'Telefone',
      vehicle: 'Veículo',
      category: 'Categoria',
      model: 'Modelo de Referência',
      pickup: 'Levantamento',
      return: 'Entrega',
      station: 'Estação',
      date: 'Data',
      time: 'Hora',
      extras: 'Extras e Proteções',
      insurances: 'Seguros',
      payment: 'Pagamento',
      method: 'Método',
      total: 'Total',
      localTotal: 'Total na Moeda Local',
      paymentMethods: { CREDIT: 'Cartão de Crédito', PIX: 'PIX', BALCAO: 'Pagamento no Balcão', VOUCHER: 'Voucher Empresarial' },
      footer: 'Apresente este recibo no balcão de levantamento. Europcar · europcar.com.br',
      printButton: '🖨️ Imprimir / Guardar PDF',
      downloadButton: '⬇️ Descarregar PDF',
    },
  },

  // ──── SUÍÇA ────
  CH: {
    locale: 'fr-CH', currency: 'CHF', currencySymbol: 'CHF', lang: 'fr',
    labels: {
      title: 'Reçu de Réservation',
      confirmed: 'Réservation Confirmée',
      reservationNo: 'N° de Réservation',
      issueDate: 'Date d\'émission',
      customer: 'Informations Client',
      name: 'Nom',
      email: 'E-mail',
      phone: 'Téléphone',
      vehicle: 'Véhicule',
      category: 'Catégorie',
      model: 'Modèle de Référence',
      pickup: 'Prise en Charge',
      return: 'Retour',
      station: 'Station',
      date: 'Date',
      time: 'Heure',
      extras: 'Options et Protections',
      insurances: 'Assurances',
      payment: 'Paiement',
      method: 'Méthode',
      total: 'Total',
      localTotal: 'Total en Devise Locale',
      paymentMethods: { CREDIT: 'Carte de Crédit', PIX: 'PIX', BALCAO: 'Paiement au Comptoir', VOUCHER: 'Bon d\'entreprise' },
      footer: 'Présentez ce reçu au comptoir de prise en charge. Europcar · europcar.com.br',
      printButton: '🖨️ Imprimer / Enregistrer PDF',
      downloadButton: '⬇️ Télécharger PDF',
    },
  },

  // ──── FRANÇA ────
  FR: {
    locale: 'fr-FR', currency: 'EUR', currencySymbol: '€', lang: 'fr',
    labels: {
      title: 'Reçu de Réservation',
      confirmed: 'Réservation Confirmée',
      reservationNo: 'N° de Réservation',
      issueDate: 'Date d\'émission',
      customer: 'Informations Client',
      name: 'Nom',
      email: 'E-mail',
      phone: 'Téléphone',
      vehicle: 'Véhicule',
      category: 'Catégorie',
      model: 'Modèle de Référence',
      pickup: 'Prise en Charge',
      return: 'Retour',
      station: 'Station',
      date: 'Date',
      time: 'Heure',
      extras: 'Options et Protections',
      insurances: 'Assurances',
      payment: 'Paiement',
      method: 'Méthode',
      total: 'Total',
      localTotal: 'Total en Devise Locale',
      paymentMethods: { CREDIT: 'Carte de Crédit', PIX: 'PIX', BALCAO: 'Paiement au Comptoir', VOUCHER: 'Bon d\'entreprise' },
      footer: 'Présentez ce reçu au comptoir de prise en charge. Europcar · europcar.com.br',
      printButton: '🖨️ Imprimer / Enregistrer PDF',
      downloadButton: '⬇️ Télécharger PDF',
    },
  },

  // ──── ALEMANHA ────
  DE: {
    locale: 'de-DE', currency: 'EUR', currencySymbol: '€', lang: 'de',
    labels: {
      title: 'Reservierungsbeleg',
      confirmed: 'Reservierung Bestätigt',
      reservationNo: 'Reservierungsnr.',
      issueDate: 'Ausstellungsdatum',
      customer: 'Kundendaten',
      name: 'Name',
      email: 'E-Mail',
      phone: 'Telefon',
      vehicle: 'Fahrzeug',
      category: 'Kategorie',
      model: 'Referenzmodell',
      pickup: 'Abholung',
      return: 'Rückgabe',
      station: 'Station',
      date: 'Datum',
      time: 'Uhrzeit',
      extras: 'Extras und Schutzpakete',
      insurances: 'Versicherungen',
      payment: 'Zahlung',
      method: 'Zahlungsart',
      total: 'Gesamt',
      localTotal: 'Gesamt in Lokalwährung',
      paymentMethods: { CREDIT: 'Kreditkarte', PIX: 'PIX', BALCAO: 'Zahlung am Schalter', VOUCHER: 'Firmengutschein' },
      footer: 'Bitte legen Sie diesen Beleg am Abholschalter vor. Europcar · europcar.com.br',
      printButton: '🖨️ Drucken / Als PDF speichern',
      downloadButton: '⬇️ PDF herunterladen',
    },
  },

  // ──── ITÁLIA ────
  IT: {
    locale: 'it-IT', currency: 'EUR', currencySymbol: '€', lang: 'it',
    labels: {
      title: 'Ricevuta di Prenotazione',
      confirmed: 'Prenotazione Confermata',
      reservationNo: 'N° Prenotazione',
      issueDate: 'Data di Emissione',
      customer: 'Dati Cliente',
      name: 'Nome',
      email: 'E-mail',
      phone: 'Telefono',
      vehicle: 'Veicolo',
      category: 'Categoria',
      model: 'Modello di Riferimento',
      pickup: 'Ritiro',
      return: 'Restituzione',
      station: 'Stazione',
      date: 'Data',
      time: 'Orario',
      extras: 'Extra e Protezioni',
      insurances: 'Assicurazioni',
      payment: 'Pagamento',
      method: 'Metodo',
      total: 'Totale',
      localTotal: 'Totale in Valuta Locale',
      paymentMethods: { CREDIT: 'Carta di Credito', PIX: 'PIX', BALCAO: 'Pagamento allo Sportello', VOUCHER: 'Voucher Aziendale' },
      footer: 'Presentate questa ricevuta allo sportello di ritiro. Europcar · europcar.com.br',
      printButton: '🖨️ Stampa / Salva PDF',
      downloadButton: '⬇️ Scarica PDF',
    },
  },

  // ──── ESPANHA ────
  ES: {
    locale: 'es-ES', currency: 'EUR', currencySymbol: '€', lang: 'es',
    labels: {
      title: 'Recibo de Reserva',
      confirmed: 'Reserva Confirmada',
      reservationNo: 'Nº de Reserva',
      issueDate: 'Fecha de Emisión',
      customer: 'Datos del Cliente',
      name: 'Nombre',
      email: 'Correo',
      phone: 'Teléfono',
      vehicle: 'Vehículo',
      category: 'Categoría',
      model: 'Modelo de Referencia',
      pickup: 'Recogida',
      return: 'Devolución',
      station: 'Estación',
      date: 'Fecha',
      time: 'Hora',
      extras: 'Extras y Protecciones',
      insurances: 'Seguros',
      payment: 'Pago',
      method: 'Método',
      total: 'Total',
      localTotal: 'Total en Moneda Local',
      paymentMethods: { CREDIT: 'Tarjeta de Crédito', PIX: 'PIX', BALCAO: 'Pago en Mostrador', VOUCHER: 'Bono Corporativo' },
      footer: 'Presente este recibo en el mostrador de recogida. Europcar · europcar.com.br',
      printButton: '🖨️ Imprimir / Guardar PDF',
      downloadButton: '⬇️ Descargar PDF',
    },
  },

  // ──── EUA ────
  US: {
    locale: 'en-US', currency: 'USD', currencySymbol: '$', lang: 'en',
    labels: {
      title: 'Booking Receipt',
      confirmed: 'Booking Confirmed',
      reservationNo: 'Reservation No.',
      issueDate: 'Issue Date',
      customer: 'Customer Details',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      vehicle: 'Vehicle',
      category: 'Category',
      model: 'Reference Model',
      pickup: 'Pick-up',
      return: 'Return',
      station: 'Station',
      date: 'Date',
      time: 'Time',
      extras: 'Extras & Protections',
      insurances: 'Insurances',
      payment: 'Payment',
      method: 'Method',
      total: 'Total',
      localTotal: 'Total in Local Currency',
      paymentMethods: { CREDIT: 'Credit Card', PIX: 'PIX', BALCAO: 'Pay at Counter', VOUCHER: 'Corporate Voucher' },
      footer: 'Please present this receipt at the pick-up counter. Europcar · europcar.com.br',
      printButton: '🖨️ Print / Save as PDF',
      downloadButton: '⬇️ Download PDF',
    },
  },

  // ──── REINO UNIDO ────
  GB: {
    locale: 'en-GB', currency: 'GBP', currencySymbol: '£', lang: 'en',
    labels: {
      title: 'Booking Receipt',
      confirmed: 'Booking Confirmed',
      reservationNo: 'Reservation No.',
      issueDate: 'Issue Date',
      customer: 'Customer Details',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      vehicle: 'Vehicle',
      category: 'Category',
      model: 'Reference Model',
      pickup: 'Pick-up',
      return: 'Return',
      station: 'Station',
      date: 'Date',
      time: 'Time',
      extras: 'Extras & Protections',
      insurances: 'Insurances',
      payment: 'Payment',
      method: 'Method',
      total: 'Total',
      localTotal: 'Total in Local Currency',
      paymentMethods: { CREDIT: 'Credit Card', PIX: 'PIX', BALCAO: 'Pay at Counter', VOUCHER: 'Corporate Voucher' },
      footer: 'Please present this receipt at the pick-up counter. Europcar · europcar.com.br',
      printButton: '🖨️ Print / Save as PDF',
      downloadButton: '⬇️ Download PDF',
    },
  },

  // ──── ARGENTINA ────
  AR: {
    locale: 'es-AR', currency: 'ARS', currencySymbol: '$', lang: 'es',
    labels: {
      title: 'Recibo de Reserva',
      confirmed: 'Reserva Confirmada',
      reservationNo: 'Nº de Reserva',
      issueDate: 'Fecha de Emisión',
      customer: 'Datos del Cliente',
      name: 'Nombre',
      email: 'Correo',
      phone: 'Teléfono',
      vehicle: 'Vehículo',
      category: 'Categoría',
      model: 'Modelo de Referencia',
      pickup: 'Recogida',
      return: 'Devolución',
      station: 'Estación',
      date: 'Fecha',
      time: 'Hora',
      extras: 'Extras y Protecciones',
      insurances: 'Seguros',
      payment: 'Pago',
      method: 'Método',
      total: 'Total',
      localTotal: 'Total en Moneda Local',
      paymentMethods: { CREDIT: 'Tarjeta de Crédito', PIX: 'PIX', BALCAO: 'Pago en Mostrador', VOUCHER: 'Bono Corporativo' },
      footer: 'Presente este recibo en el mostrador de recogida. Europcar · europcar.com.br',
      printButton: '🖨️ Imprimir / Guardar PDF',
      downloadButton: '⬇️ Descargar PDF',
    },
  },

  // ──── AUSTRÁLIA ────
  AU: {
    locale: 'en-AU', currency: 'AUD', currencySymbol: 'A$', lang: 'en',
    labels: {
      title: 'Booking Receipt',
      confirmed: 'Booking Confirmed',
      reservationNo: 'Reservation No.',
      issueDate: 'Issue Date',
      customer: 'Customer Details',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      vehicle: 'Vehicle',
      category: 'Category',
      model: 'Reference Model',
      pickup: 'Pick-up',
      return: 'Return',
      station: 'Station',
      date: 'Date',
      time: 'Time',
      extras: 'Extras & Protections',
      insurances: 'Insurances',
      payment: 'Payment',
      method: 'Method',
      total: 'Total',
      localTotal: 'Total in Local Currency',
      paymentMethods: { CREDIT: 'Credit Card', PIX: 'PIX', BALCAO: 'Pay at Counter', VOUCHER: 'Corporate Voucher' },
      footer: 'Please present this receipt at the pick-up counter. Europcar · europcar.com.br',
      printButton: '🖨️ Print / Save as PDF',
      downloadButton: '⬇️ Download PDF',
    },
  },

  // ──── CANADÁ ────
  CA: {
    locale: 'en-CA', currency: 'CAD', currencySymbol: 'C$', lang: 'en',
    labels: {
      title: 'Booking Receipt',
      confirmed: 'Booking Confirmed',
      reservationNo: 'Reservation No.',
      issueDate: 'Issue Date',
      customer: 'Customer Details',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      vehicle: 'Vehicle',
      category: 'Category',
      model: 'Reference Model',
      pickup: 'Pick-up',
      return: 'Return',
      station: 'Station',
      date: 'Date',
      time: 'Time',
      extras: 'Extras & Protections',
      insurances: 'Insurances',
      payment: 'Payment',
      method: 'Method',
      total: 'Total',
      localTotal: 'Total in Local Currency',
      paymentMethods: { CREDIT: 'Credit Card', PIX: 'PIX', BALCAO: 'Pay at Counter', VOUCHER: 'Corporate Voucher' },
      footer: 'Please present this receipt at the pick-up counter. Europcar · europcar.com.br',
      printButton: '🖨️ Print / Save as PDF',
      downloadButton: '⬇️ Download PDF',
    },
  },

  // ──── JAPÃO ────
  JP: {
    locale: 'ja-JP', currency: 'JPY', currencySymbol: '¥', lang: 'ja',
    labels: {
      title: '予約領収書',
      confirmed: '予約確認済み',
      reservationNo: '予約番号',
      issueDate: '発行日',
      customer: 'お客様情報',
      name: 'お名前',
      email: 'メール',
      phone: '電話番号',
      vehicle: '車両',
      category: 'カテゴリー',
      model: '参考モデル',
      pickup: '貸出',
      return: '返却',
      station: 'ステーション',
      date: '日付',
      time: '時間',
      extras: 'オプションと保険',
      insurances: '保険',
      payment: 'お支払い',
      method: '支払方法',
      total: '合計',
      localTotal: '現地通貨合計',
      paymentMethods: { CREDIT: 'クレジットカード', PIX: 'PIX', BALCAO: '窓口払い', VOUCHER: '企業バウチャー' },
      footer: '貸出カウンターでこの領収書をご提示ください。Europcar · europcar.com.br',
      printButton: '🖨️ 印刷 / PDF保存',
      downloadButton: '⬇️ PDFをダウンロード',
    },
  },

  // ──── DEFAULT (Inglês) ────
  DEFAULT: {
    locale: 'en-US', currency: 'EUR', currencySymbol: '€', lang: 'en',
    labels: {
      title: 'Booking Receipt',
      confirmed: 'Booking Confirmed',
      reservationNo: 'Reservation No.',
      issueDate: 'Issue Date',
      customer: 'Customer Details',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      vehicle: 'Vehicle',
      category: 'Category',
      model: 'Reference Model',
      pickup: 'Pick-up',
      return: 'Return',
      station: 'Station',
      date: 'Date',
      time: 'Time',
      extras: 'Extras & Protections',
      insurances: 'Insurances',
      payment: 'Payment',
      method: 'Method',
      total: 'Total',
      localTotal: 'Total in Local Currency',
      paymentMethods: { CREDIT: 'Credit Card', PIX: 'PIX', BALCAO: 'Pay at Counter', VOUCHER: 'Corporate Voucher' },
      footer: 'Please present this receipt at the pick-up counter. Europcar · europcar.com.br',
      printButton: '🖨️ Print / Save as PDF',
      downloadButton: '⬇️ Download PDF',
    },
  },
};

/**
 * Retorna o locale para o país informado (ISO 3166-1 alpha-2).
 * Se o país não for mapeado, retorna DEFAULT (inglês/EUR).
 */
export function getReceiptLocale(countryCode?: string | null): ReceiptLocale {
  if (!countryCode) return LOCALES.DEFAULT;
  const key = countryCode.toUpperCase();
  return LOCALES[key] || LOCALES.DEFAULT;
}

/**
 * Formata um valor monetário usando o locale e currency do recibo.
 * Ex: formatMoney(285.50, locale) → "CHF 285.50" ou "€ 285,50"
 */
export function formatMoney(amount: number, locale: ReceiptLocale): string {
  try {
    return new Intl.NumberFormat(locale.locale, {
      style: 'currency',
      currency: locale.currency,
      minimumFractionDigits: locale.currency === 'JPY' ? 0 : 2,
      maximumFractionDigits: locale.currency === 'JPY' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${locale.currencySymbol} ${amount.toFixed(2)}`;
  }
}

/**
 * Formata data no padrão local.
 * Aceita strings no formato XRS: "YYYYMMDD" ou ISO "YYYY-MM-DD"
 */
export function formatDate(dateStr: string, localeCode: string): string {
  if (!dateStr) return '—';
  let d: Date | null = null;
  if (/^\d{8}$/.test(dateStr)) {
    d = new Date(`${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`);
  } else {
    d = new Date(dateStr);
  }
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(localeCode, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Formata hora no padrão "HH:MM".
 * Aceita strings XRS: "1000" → "10:00"
 */
export function formatTime(timeStr: string): string {
  if (!timeStr) return '—';
  const t = timeStr.replace(/\D/g, '');
  if (t.length >= 4) return `${t.slice(0, 2)}:${t.slice(2, 4)}`;
  return timeStr;
}

/**
 * getCurrencyFromStation
 *
 * Determina a moeda a partir do prefixo IATA da estação de retirada.
 * O código da estação Europcar/XRS usa os primeiros 3 caracteres como código IATA da cidade.
 *
 * Exemplos:
 *   OPOT01 → OPO → Porto, Portugal → EUR
 *   LIST01 → LIS → Lisboa, Portugal → EUR
 *   ZRHT01 → ZRH → Zurique, Suíça → CHF
 *   CDGT01 → CDG → Paris, França → EUR
 *   GIGT01 → GIG → Rio de Janeiro, Brasil → BRL
 *
 * Retorna null se o prefixo não for reconhecido.
 */
export function getCurrencyFromStation(stationCode?: string | null): string | null {
  if (!stationCode || stationCode.length < 3) return null;
  const prefix = stationCode.slice(0, 3).toUpperCase();

  const stationCurrencyMap: Record<string, string> = {
    // Brasil → BRL
    GRU: 'BRL', CGH: 'BRL', GIG: 'BRL', SDU: 'BRL', BSB: 'BRL',
    CNF: 'BRL', POA: 'BRL', SSA: 'BRL', REC: 'BRL', FOR: 'BRL',
    CWB: 'BRL', FLN: 'BRL', NAT: 'BRL', MAO: 'BRL', BEL: 'BRL',
    VCP: 'BRL', CGB: 'BRL', THE: 'BRL', MCZ: 'BRL', JPA: 'BRL',
    AJU: 'BRL', MGF: 'BRL', LDB: 'BRL', RAO: 'BRL', PVH: 'BRL',
    // Portugal → EUR
    LIS: 'EUR', OPO: 'EUR', FAO: 'EUR', PDL: 'EUR', HOR: 'EUR',
    SMA: 'EUR', TER: 'EUR', FLW: 'EUR', PIX: 'EUR', GRW: 'EUR',
    // Espanha → EUR
    MAD: 'EUR', BCN: 'EUR', AGP: 'EUR', ALC: 'EUR', LPA: 'EUR',
    TFS: 'EUR', PMI: 'EUR', SVQ: 'EUR', VLC: 'EUR', BIO: 'EUR',
    SCQ: 'EUR', IBZ: 'EUR', MAH: 'EUR', FUE: 'EUR', ACE: 'EUR',
    GRX: 'EUR', VIT: 'EUR', ZAZ: 'EUR', REU: 'EUR', GRO: 'EUR',
    // França → EUR
    CDG: 'EUR', ORY: 'EUR', NCE: 'EUR', LYS: 'EUR', TLS: 'EUR',
    BOD: 'EUR', NTE: 'EUR', SXB: 'EUR', BES: 'EUR', BIA: 'EUR',
    // Alemanha → EUR
    FRA: 'EUR', MUC: 'EUR', TXL: 'EUR', HAM: 'EUR', DUS: 'EUR',
    CGN: 'EUR', STR: 'EUR', NUE: 'EUR', LEJ: 'EUR', HAJ: 'EUR',
    BRE: 'EUR', DRS: 'EUR', ERF: 'EUR', PAD: 'EUR', FKB: 'EUR',
    BER: 'EUR',
    // Itália → EUR
    FCO: 'EUR', MXP: 'EUR', LIN: 'EUR', NAP: 'EUR', VCE: 'EUR',
    BGY: 'EUR', CTA: 'EUR', PMO: 'EUR', PSA: 'EUR', BLQ: 'EUR',
    FLR: 'EUR', TRN: 'EUR', GOA: 'EUR', VRN: 'EUR', BRI: 'EUR',
    OLB: 'EUR', CAG: 'EUR',
    // Suíça → CHF
    ZRH: 'CHF', GVA: 'CHF', BSL: 'CHF', BRN: 'CHF', LGN: 'CHF',
    // Reino Unido → GBP
    LHR: 'GBP', LGW: 'GBP', MAN: 'GBP', EDI: 'GBP', GLA: 'GBP',
    BHX: 'GBP', LTN: 'GBP', STN: 'GBP', BRS: 'GBP', NCL: 'GBP',
    LPL: 'GBP', LBA: 'GBP', CWL: 'GBP', ABZ: 'GBP',
    // Irlanda → EUR
    DUB: 'EUR', ORK: 'EUR', SNN: 'EUR',
    // EUA → USD
    JFK: 'USD', LAX: 'USD', ORD: 'USD', MIA: 'USD', SFO: 'USD',
    DFW: 'USD', ATL: 'USD', DEN: 'USD', SEA: 'USD', LAS: 'USD',
    MCO: 'USD', EWR: 'USD', BOS: 'USD', PHX: 'USD', IAH: 'USD',
    FLL: 'USD', DTW: 'USD', MSP: 'USD', CLT: 'USD', LGA: 'USD',
    BWI: 'USD', SAN: 'USD', SLC: 'USD', TPA: 'USD', HNL: 'USD',
    AUS: 'USD', OAK: 'USD', RSW: 'USD', ANC: 'USD',
    // Canadá → CAD
    YYZ: 'CAD', YVR: 'CAD', YUL: 'CAD', YYC: 'CAD', YEG: 'CAD',
    YOW: 'CAD', YHZ: 'CAD', YWG: 'CAD',
    // Austrália → AUD
    SYD: 'AUD', MEL: 'AUD', BNE: 'AUD', PER: 'AUD', ADL: 'AUD',
    CBR: 'AUD', DRW: 'AUD', CNS: 'AUD',
    // Argentina → ARS
    EZE: 'ARS', AEP: 'ARS', COR: 'ARS', MDZ: 'ARS', USH: 'ARS',
    // México → MXN
    MEX: 'MXN', CUN: 'MXN', GDL: 'MXN', MTY: 'MXN', PVR: 'MXN',
    // Japão → JPY
    NRT: 'JPY', HND: 'JPY', KIX: 'JPY', CTS: 'JPY', FUK: 'JPY',
    OKA: 'JPY', NGO: 'JPY',
    // Holanda → EUR
    AMS: 'EUR', EIN: 'EUR', RTM: 'EUR',
    // Bélgica → EUR
    BRU: 'EUR', CRL: 'EUR', LGG: 'EUR',
    // Áustria → EUR
    VIE: 'EUR', SZG: 'EUR', INN: 'EUR', GRZ: 'EUR', LNZ: 'EUR',
    // Grécia → EUR
    ATH: 'EUR', SKG: 'EUR', HER: 'EUR', RHO: 'EUR', CFU: 'EUR',
    ZTH: 'EUR', KGS: 'EUR',
    // Noruega → NOK
    OSL: 'NOK', BGO: 'NOK', TRD: 'NOK', SVG: 'NOK',
    // Suécia → SEK
    ARN: 'SEK', GOT: 'SEK', MMX: 'SEK',
    // Dinamarca → DKK
    CPH: 'DKK', BLL: 'DKK', AAL: 'DKK',
    // Finlândia → EUR
    HEL: 'EUR', TMP: 'EUR', TKU: 'EUR',
    // Polônia → PLN
    WAW: 'PLN', KRK: 'PLN', GDN: 'PLN', KTW: 'PLN', POZ: 'PLN', WRO: 'PLN',
    // República Tcheca → CZK
    PRG: 'CZK', BRQ: 'CZK',
    // Hungria → HUF
    BUD: 'HUF',
    // Romênia → RON
    OTP: 'RON', CLJ: 'RON',
    // Croácia → EUR
    ZAG: 'EUR', SPU: 'EUR', DBV: 'EUR',
    // Turquia → TRY
    IST: 'TRY', SAW: 'TRY', AYT: 'TRY', ESB: 'TRY', ADB: 'TRY',
    // Emirados → AED
    DXB: 'AED', AUH: 'AED',
    // África do Sul → ZAR
    JNB: 'ZAR', CPT: 'ZAR', DUR: 'ZAR',
    // Nova Zelândia → NZD
    AKL: 'NZD', CHC: 'NZD', WLG: 'NZD', ZQN: 'NZD',
    // Chile → CLP
    SCL: 'CLP', PMC: 'CLP',
    // Colômbia → COP
    BOG: 'COP', MDE: 'COP', CLO: 'COP',
    // Peru → PEN
    LIM: 'PEN', CUZ: 'PEN',
    // China → CNY
    PEK: 'CNY', PVG: 'CNY', CAN: 'CNY', CTU: 'CNY',
    // Coreia do Sul → KRW
    ICN: 'KRW', GMP: 'KRW',
    // Índia → INR
    DEL: 'INR', BOM: 'INR', MAA: 'INR', BLR: 'INR', HYD: 'INR',
    // Israel → ILS
    TLV: 'ILS',
    // Marrocos → MAD (Dirham)
    CMN: 'MAD', RAK: 'MAD', AGA: 'MAD',
  };

  return stationCurrencyMap[prefix] || null;
}

/**
 * buildEmailCurrencyVars
 * ─────────────────────────────────────────────────────────────
 * Retorna variáveis de valor prontas para usar em templates de e-mail.
 * Para estações internacionais, exibe o valor na moeda local
 * com uma estimativa em BRL entre parênteses.
 *
 * @param totalBRL        - Valor total em BRL (centavos / 100)
 * @param pickupStation   - Código da estação de retirada (ex: LIST01, CDGT01)
 * @param exchangeRate    - Taxa de câmbio BRL/Moedal (ex: 6.1858 para EUR)
 * @param carCurrency     - Moeda da reserva vinda do XRS (opcional, fallback p/ mapa)
 *
 * Retorna:
 *   VALOR_TOTAL   = "€ 383,74 (≈ R$ 2.373,73)"  |  "R$ 2.373,73"
 *   VALOR_LOCAL   = "€ 383,74"                   |  "R$ 2.373,73"
 *   VALOR_BRL     = "R$ 2.373,73"
 *   MOEDA         = "EUR" | "BRL" | "CHF" …
 */
export function buildEmailCurrencyVars(
  totalBRL: number,
  pickupStation: string | null | undefined,
  exchangeRate: number | null | undefined,
  carCurrency?: string | null,
): { VALOR_TOTAL: string; VALOR_LOCAL: string; VALOR_BRL: string; MOEDA: string } {
  const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
  const valorBRL = fmtBRL(totalBRL);

  // Determina moeda: prioridade = carCurrency > mapa de estação
  const currency =
    (carCurrency && carCurrency !== 'BRL' ? carCurrency : null) ||
    getCurrencyFromStation(pickupStation) ||
    'BRL';

  if (currency === 'BRL' || !(exchangeRate && exchangeRate > 0)) {
    return { VALOR_TOTAL: valorBRL, VALOR_LOCAL: valorBRL, VALOR_BRL: valorBRL, MOEDA: 'BRL' };
  }

  const localAmount = totalBRL / exchangeRate;
  let valorLocal: string;
  try {
    valorLocal = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'JPY' || currency === 'KRW' ? 0 : 2,
    }).format(localAmount);
  } catch {
    valorLocal = `${currency} ${localAmount.toFixed(2)}`;
  }

  return {
    VALOR_TOTAL:  `${valorLocal} (≈ ${valorBRL})`,
    VALOR_LOCAL:  valorLocal,
    VALOR_BRL:    valorBRL,
    MOEDA:        currency,
  };
}
