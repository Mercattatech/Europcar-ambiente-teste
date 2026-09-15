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
