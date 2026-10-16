import prisma from '@/lib/prisma';
import { callXRS, DEFAULT_POA_CID } from '@/lib/europcar/xrsClient';
import { escapeXml } from '@/lib/europcar/xmlEscape';

export const STATIONS_TO_SYNC = [
  // Brasil (principais aeroportos e lojas de capitais)
  'CGHO03', 'GRUO02', 'POAO03', 'SSAC03', 'VCPT02', 'BSBC02',
  // Europa / Internacional (Lisboa, Paris, Milão, Munique, Madri, Genebra)
  'LIST01', 'PARC01', 'MILC01', 'MUCC01', 'MADT01', 'GVAC01',
];

export interface SyncCategoryResult {
  totalFound: number;
  created: number;
  updated: number;
  unchanged: number;
  onRequestCount: number;
  categories: Array<{
    carCode: string;
    friendlyName: string;
    onRequest: boolean;
    status: 'created' | 'updated' | 'unchanged';
  }>;
}

/**
 * Consulta a API XRS da Europcar para estações de referência (Brasil e exterior),
 * recupera os códigos ACRISS vigentes, modelos/nomes oficiais e status on-request (R),
 * e sincroniza com a tabela CarCategoryOverride preservando customizações manuais.
 */
export async function syncCategoriesFromXRS(): Promise<SyncCategoryResult> {
  const pickup = new Date();
  pickup.setDate(pickup.getDate() + 30);
  const ret = new Date(pickup);
  ret.setDate(ret.getDate() + 3);

  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  };

  const pickupDateStr = formatDate(pickup);
  const returnDateStr = formatDate(ret);

  const config = {
    callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
    password: process.env.XRS_PASSWORD || 'DEMO',
  };

  const categoriesMap = new Map<string, {
    carCode: string;
    friendlyName: string;
    onRequest: boolean;
  }>();

  for (const station of STATIONS_TO_SYNC) {
    try {
      // 1. getCarCategories: lista todos os veículos operados pela estação com seus nomes
      const catXml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getCarCategories">
    <serviceContext language="pt_PT"/>
    <serviceParameters>
      <reservation contractID="${DEFAULT_POA_CID}" type="C">
        <checkout stationID="${escapeXml(station)}" date="${pickupDateStr}" time="1000"/>
        <checkin stationID="${escapeXml(station)}" date="${returnDateStr}" time="1000"/>
      </reservation>
    </serviceParameters>
  </serviceRequest>
</message>`;

      const catParsed = await callXRS(catXml, {
        ...config,
        action: 'getCarCategories',
        sourceFile: 'syncCategories.ts',
      });

      const rawCatList =
        catParsed?.message?.serviceResponse?.carCategoryList?.carCategory ||
        catParsed?.serviceResponse?.carCategoryList?.carCategory || [];
      const catArr = Array.isArray(rawCatList) ? rawCatList : rawCatList ? [rawCatList] : [];

      const codesFromStation: string[] = [];

      for (const item of catArr) {
        const a = item.$ || item;
        const carCode = (a.carCategoryCode || '').toString().trim().toUpperCase();
        if (!carCode) continue;

        codesFromStation.push(carCode);
        const name = (a.carCategoryName || a.carCategorySample || carCode).trim();

        if (!categoriesMap.has(carCode)) {
          categoriesMap.set(carCode, {
            carCode,
            friendlyName: name,
            onRequest: false,
          });
        } else {
          const existingEntry = categoriesMap.get(carCode)!;
          if ((!existingEntry.friendlyName || existingEntry.friendlyName === carCode) && name !== carCode) {
            existingEntry.friendlyName = name;
          }
        }
      }

      // 2. getMultipleRates: verifica se a Europcar devolve statusCode 'R' (Request / On-Request)
      if (codesFromStation.length > 0) {
        const ratesXml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getMultipleRates">
    <serviceContext language="PT"/>
    <serviceParameters>
      <reservation rateDetails="Y" chargesDetail="TRE" contractID="${DEFAULT_POA_CID}" type="C">
        <checkout stationID="${escapeXml(station)}" date="${pickupDateStr}" time="1000"/>
        <checkin stationID="${escapeXml(station)}" date="${returnDateStr}" time="1000"/>
      </reservation>
      <driver countryOfResidence="BR" />
    </serviceParameters>
  </serviceRequest>
</message>`;

        try {
          const ratesParsed = await callXRS(ratesXml, {
            ...config,
            action: 'getMultipleRates',
            sourceFile: 'syncCategories.ts',
          });

          const rawRateList =
            ratesParsed?.message?.serviceResponse?.reservationRateList?.reservationRate ||
            ratesParsed?.serviceResponse?.reservationRateList?.reservationRate || [];
          const rateArr = Array.isArray(rawRateList) ? rawRateList : rawRateList ? [rawRateList] : [];

          for (const rate of rateArr) {
            const attrs = rate.$ || rate;
            const code = (attrs.carCategoryCode || '').toString().trim().toUpperCase();
            if (!code) continue;

            const statusCode = (attrs.statusCode || '').toString().trim().toUpperCase();
            const sample = (attrs.carCategorySample || attrs.carCategoryName || '').trim();

            if (categoriesMap.has(code)) {
              const entry = categoriesMap.get(code)!;
              if (statusCode === 'R') {
                entry.onRequest = true;
              }
              if ((!entry.friendlyName || entry.friendlyName === code) && sample) {
                entry.friendlyName = sample;
              }
            } else {
              categoriesMap.set(code, {
                carCode: code,
                friendlyName: sample || code,
                onRequest: statusCode === 'R',
              });
            }
          }
        } catch (ratesErr) {
          console.warn(`[syncCategories] Falha ao consultar rates para estação ${station}:`, ratesErr);
        }
      }
    } catch (stationErr) {
      console.warn(`[syncCategories] Falha ao consultar categorias para estação ${station}:`, stationErr);
    }
  }

  // 3. Persistência no banco de dados
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let onRequestCount = 0;

  const resultDetails: SyncCategoryResult['categories'] = [];

  for (const [carCode, catInfo] of categoriesMap.entries()) {
    try {
      const existing = await prisma.carCategoryOverride.findUnique({ where: { carCode } });
      if (!existing) {
        await prisma.carCategoryOverride.create({
          data: {
            carCode,
            friendlyName: catInfo.friendlyName || carCode,
            onRequest: catInfo.onRequest,
          },
        });
        created++;
        if (catInfo.onRequest) onRequestCount++;
        resultDetails.push({
          carCode,
          friendlyName: catInfo.friendlyName || carCode,
          onRequest: catInfo.onRequest,
          status: 'created',
        });
      } else {
        const updates: { friendlyName?: string; onRequest?: boolean } = {};
        // Se o nome gravado anteriormente for apenas o código ACRISS, atualiza com a descrição oficial
        if ((!existing.friendlyName || existing.friendlyName === carCode) && catInfo.friendlyName && catInfo.friendlyName !== carCode) {
          updates.friendlyName = catInfo.friendlyName;
        }
        // Se a Europcar agora marcou como onRequest ('R'), atualiza para true
        if (catInfo.onRequest && !existing.onRequest) {
          updates.onRequest = true;
        }

        if (Object.keys(updates).length > 0) {
          const res = await prisma.carCategoryOverride.update({
            where: { carCode },
            data: updates,
          });
          updated++;
          if (res.onRequest) onRequestCount++;
          resultDetails.push({
            carCode,
            friendlyName: res.friendlyName,
            onRequest: res.onRequest,
            status: 'updated',
          });
        } else {
          unchanged++;
          if (existing.onRequest) onRequestCount++;
          resultDetails.push({
            carCode,
            friendlyName: existing.friendlyName,
            onRequest: existing.onRequest,
            status: 'unchanged',
          });
        }
      }
    } catch (dbErr) {
      console.error(`[syncCategories] Erro ao salvar categoria ${carCode}:`, dbErr);
    }
  }

  return {
    totalFound: categoriesMap.size,
    created,
    updated,
    unchanged,
    onRequestCount,
    categories: resultDetails,
  };
}
