import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com"];

async function checkAdmin() {
   const session = await getServerSession(authOptions);
   if (!session?.user?.email) return false;
   if (ADMIN_EMAILS.includes(session.user.email)) return true;
   const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
   return dbUser?.role === 'ADMIN';
}

const OP_STATUS_LABELS: Record<string, string> = {
   R: "On Request",
   S: "Sold",
   CF: "Confirmed",
   CC: "Cancelled",
   CP: "Cancelled Prepaid",
   CO: "Checked Out",
   TD: "Turn Down",
   NS: "No Show",
};

const STATUS_LABELS: Record<string, string> = {
   CONFIRMED_PREPAID: "Pago Online",
   PENDING_PIX: "PIX Pendente",
   CONFIRMED_NON_PREPAID: "Pagar no Balcão",
   CANCELLED: "Cancelada",
};

function formatDateBR(dateStr?: string): string {
   if (!dateStr || dateStr.length < 8) return "";
   return `${dateStr.slice(6, 8)}/${dateStr.slice(4, 6)}/${dateStr.slice(0, 4)}`;
}

function formatTimeBR(timeStr?: string): string {
   if (!timeStr || timeStr.length < 4) return "";
   return `${timeStr.slice(0, 2)}:${timeStr.slice(2)}`;
}

function getPaymentMethodLabel(res: any, parsed: any): string {
   const pm = parsed?.paymentMethod || (parsed?.cieloPaymentId && res.status === 'PENDING_PIX' ? 'PIX' : null);
   if (pm === 'PIX' || res.status === 'PENDING_PIX') {
      if (res.status === 'CONFIRMED_PREPAID' || res.status === 'CONFIRMED' || res.status === 'ON_REQUEST') {
         return 'PIX (Pago)';
      }
      if (res.status === 'PENDING_PIX') {
         return 'PIX (Pendente)';
      }
      return 'PIX (Pago)';
   }
   if (res.status === 'CONFIRMED_PREPAID' || pm === 'CREDIT') {
      return 'Cartão de Crédito';
   }
   if (res.status === 'CONFIRMED_NON_PREPAID' || pm === 'BALCAO') {
      return 'Pagar no Balcão';
   }
   if (res.status === 'CANCELLED' || res.status === 'CANCELLED_GREENWAY') {
      return 'Cancelada';
   }
   return res.status || '—';
}

function escapeCSV(val: any): string {
   if (val === null || val === undefined) return "";
   let str = String(val);
   // Neutralize leading =, +, -, @ to prevent CSV/formula injection when opened in Excel
   if (/^[=+\-@]/.test(str)) str = `'${str}`;
   if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
   }
   return str;
}

export async function GET(req: Request) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }

   try {
      const { searchParams } = new URL(req.url);
      const type = searchParams.get('type') || 'operational'; // operational | financial
      const opStatusFilter = searchParams.get('operationalStatus');
      const statusFilter = searchParams.get('status');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      // Build where clause with AND conditions to prevent OR collisions
      const andConditions: any[] = [];

      if (statusFilter && statusFilter !== 'ALL') {
         if (statusFilter === 'CANCELLED') {
            andConditions.push({ status: { in: ['CANCELLED', 'CANCELLED_GREENWAY'] } });
         } else if (statusFilter === 'PIX_PAID') {
            andConditions.push({
               status: { in: ['CONFIRMED_PREPAID', 'CONFIRMED', 'ON_REQUEST'] },
               customerData: { contains: '"paymentMethod":"PIX"' }
            });
         } else if (statusFilter === 'CREDIT_CARD') {
            andConditions.push({
               status: 'CONFIRMED_PREPAID',
               NOT: { customerData: { contains: '"paymentMethod":"PIX"' } }
            });
         } else {
            andConditions.push({ status: statusFilter });
         }
      }

      if (opStatusFilter && opStatusFilter !== 'ALL') {
         if (opStatusFilter === 'R') {
            andConditions.push({
               OR: [
                  { operationalStatus: 'R' },
                  { operationalStatus: null }
               ]
            });
         } else if (opStatusFilter === 'ACTIVE') {
            andConditions.push({
               OR: [
                  { operationalStatus: { in: ['R', 'S', 'CF'] } },
                  { operationalStatus: null }
               ]
            });
         } else if (opStatusFilter === 'DONE') {
            andConditions.push({
               operationalStatus: { in: ['CC', 'CP', 'CO', 'TD', 'NS'] }
            });
         } else {
            andConditions.push({ operationalStatus: opStatusFilter });
         }
      }

      if (startDate || endDate) {
         const dateClause: any = {};
         if (startDate) {
            dateClause.gte = /^\d{4}-\d{2}-\d{2}$/.test(startDate)
               ? new Date(`${startDate}T00:00:00-03:00`)
               : new Date(startDate);
         }
         if (endDate) {
            dateClause.lte = /^\d{4}-\d{2}-\d{2}$/.test(endDate)
               ? new Date(`${endDate}T23:59:59.999-03:00`)
               : new Date(endDate);
         }
         andConditions.push({ createdAt: dateClause });
      }

      const where = andConditions.length > 0 ? { AND: andConditions } : {};

      const reservations = await prisma.localReservation.findMany({
         where,
         orderBy: { createdAt: 'desc' },
      });

      let csv = "";

      if (type === "financial") {
         // RELATÓRIO FINANCEIRO
         const headers = [
            "Código Reserva",
            "Data Reserva",
            "Horário Reserva",
            "Data Retirada",
            "Horário Retirada",
            "Data Devolução",
            "Horário Devolução",
            "Valor Net (EUR)",
            "Comissão",
            "Valor Total (BRL)",
            "Valor Pago Previamente",
            "Valor Pago Balcão",
            "Tipo Pagamento",
            "Câmbio",
            "Moeda",
            "País Retirada",
            "Cidade Retirada",
            "Estação Retirada",
            "País Devolução",
            "Cidade Devolução",
            "Estação Devolução",
            "Categoria Veículo",
            "Nome Cliente",
            "Telefone",
            "Email",
            "CPF",
            "Código Desconto",
            "CID",
            "Status Operacional",
            "Status Pagamento",
         ];

         csv = headers.join(",") + "\n";

         let activeTotalEUR = 0;
         let activeTotalBRL = 0;
         let activePrepaidBRL = 0;
         let activeCounterBRL = 0;
         let activeCount = 0;

         let cancelledTotalEUR = 0;
         let cancelledTotalBRL = 0;
         let cancelledCount = 0;

         for (const res of reservations) {
            let parsed: any = {};
            try {
               parsed = typeof res.customerData === "string" ? JSON.parse(res.customerData) : res.customerData;
            } catch (e) {}

            const booking = parsed?.booking || {};
            const car = booking?.car || {};
            const isPrepaid = res.status === "CONFIRMED_PREPAID";
            const opStatus = (res as any).operationalStatus || "R";
            const isCancelled =
               ["CANCELLED", "CANCELLED_GREENWAY", "ON_REQUEST_REJECTED"].includes(res.status) ||
               ["CC", "CP", "TD"].includes(opStatus);

            let totalBRLNum = 0;
            if (res.amountInCents && Number(res.amountInCents) > 0) {
               totalBRLNum = Number(res.amountInCents) / 100;
            } else if (car?.totalRateInBookingCurrency && !isNaN(parseFloat(car.totalRateInBookingCurrency))) {
               totalBRLNum = parseFloat(car.totalRateInBookingCurrency);
            } else if (car?.totalRateEstimate && car?.exchangeRate && !isNaN(parseFloat(car.totalRateEstimate)) && !isNaN(parseFloat(car.exchangeRate))) {
               totalBRLNum = parseFloat(car.totalRateEstimate) * parseFloat(car.exchangeRate);
            }

            let totalEURNum = 0;
            if (car?.totalRateEstimate && !isNaN(parseFloat(car.totalRateEstimate))) {
               totalEURNum = parseFloat(car.totalRateEstimate);
            } else if (totalBRLNum > 0 && car?.exchangeRate && parseFloat(car.exchangeRate) > 0) {
               totalEURNum = totalBRLNum / parseFloat(car.exchangeRate);
            }

            if (isCancelled) {
               cancelledCount++;
               cancelledTotalEUR += totalEURNum;
               cancelledTotalBRL += totalBRLNum;
            } else {
               activeCount++;
               activeTotalEUR += totalEURNum;
               activeTotalBRL += totalBRLNum;
               if (isPrepaid) activePrepaidBRL += totalBRLNum;
               else activeCounterBRL += totalBRLNum;
            }

            const totalBRLStr = totalBRLNum > 0 ? totalBRLNum.toFixed(2) : "";
            const totalEURStr = totalEURNum > 0 ? totalEURNum.toFixed(2) : "";

            const row = [
               res.resNumber || "",
               new Date(res.createdAt).toLocaleDateString("pt-BR"),
               new Date(res.createdAt).toLocaleTimeString("pt-BR"),
               formatDateBR(booking?.pickupDate),
               formatTimeBR(booking?.pickupTime),
               formatDateBR(booking?.returnDate),
               formatTimeBR(booking?.returnTime),
               totalEURStr,
               "", // Comissão - a ser preenchido manualmente se necessário
               totalBRLStr,
               isPrepaid && !isCancelled ? totalBRLStr : "",
               !isPrepaid && !isCancelled ? totalBRLStr : "",
               getPaymentMethodLabel(res, parsed),
               car?.exchangeRate ? parseFloat(car.exchangeRate).toFixed(4) : "",
               car?.exchangeRate ? "EUR/BRL" : "",
               booking?.country || "BR",
               booking?.pickupCity || "",
               booking?.pickupStation || "",
               booking?.country || "BR",
               booking?.returnCity || "",
               booking?.returnStation || booking?.pickupStation || "",
               car?.carCategorySample || car?.carCategoryName || car?.carCategoryCode || "",
               `${parsed?.nome || ""} ${parsed?.sobrenome || ""}`.trim(),
               parsed?.telefone || "",
               parsed?.email || "",
               parsed?.cpf || "",
               parsed?.contractID || booking?.contractID || "",
               parsed?.customer?.loyaltyProgramId || parsed?.loyaltyProgramId || "",
               OP_STATUS_LABELS[opStatus] || opStatus,
               STATUS_LABELS[res.status] || res.status,
            ];

            csv += row.map(escapeCSV).join(",") + "\n";
         }

         // Footer / Totais
         csv += "\n";
         csv += [
            escapeCSV(`TOTAL ATIVO / CONFIRMADO (${activeCount} reservas)`),
            "", "", "", "", "", "",
            escapeCSV(activeTotalEUR.toFixed(2)),
            "",
            escapeCSV(activeTotalBRL.toFixed(2)),
            escapeCSV(activePrepaidBRL.toFixed(2)),
            escapeCSV(activeCounterBRL.toFixed(2)),
            escapeCSV("Exclui canceladas"),
         ].join(",") + "\n";

         if (cancelledCount > 0) {
            csv += [
               escapeCSV(`TOTAL CANCELADO (${cancelledCount} reservas)`),
               "", "", "", "", "", "",
               escapeCSV(cancelledTotalEUR.toFixed(2)),
               "",
               escapeCSV(cancelledTotalBRL.toFixed(2)),
               "", "",
               escapeCSV("Canceladas (não somado na receita)"),
            ].join(",") + "\n";
         }

         csv += [
            escapeCSV(`TOTAL GERAL FILTRADO (${reservations.length} registros)`),
            "", "", "", "", "", "",
            escapeCSV((activeTotalEUR + cancelledTotalEUR).toFixed(2)),
            "",
            escapeCSV((activeTotalBRL + cancelledTotalBRL).toFixed(2)),
         ].join(",") + "\n";

      } else {
         // RELATÓRIO OPERACIONAL
         const headers = [
            "Código Reserva",
            "Status Operacional",
            "Código Status",
            "Status Pagamento",
            "Tipo Pagamento",
            "Data Criação",
            "Data Retirada",
            "Data Devolução",
            "Dias",
            "Nome Cliente",
            "Email",
            "CPF",
            "Telefone",
            "Veículo",
            "Categoria",
            "Estação Retirada",
            "Estação Devolução",
            "Valor (BRL)",
         ];

         csv = headers.join(",") + "\n";

         let activeTotalBRL = 0;
         let activeTotalDays = 0;
         let activeCount = 0;
         let cancelledTotalBRL = 0;
         let cancelledCount = 0;

         for (const res of reservations) {
            let parsed: any = {};
            try {
               parsed = typeof res.customerData === "string" ? JSON.parse(res.customerData) : res.customerData;
            } catch (e) {}

            const booking = parsed?.booking || {};
            const car = booking?.car || {};
            const opStatus = (res as any).operationalStatus || "R";
            const isCancelled =
               ["CANCELLED", "CANCELLED_GREENWAY", "ON_REQUEST_REJECTED"].includes(res.status) ||
               ["CC", "CP", "TD"].includes(opStatus);

            let totalBRLNum = 0;
            if (res.amountInCents && Number(res.amountInCents) > 0) {
               totalBRLNum = Number(res.amountInCents) / 100;
            } else if (car?.totalRateInBookingCurrency && !isNaN(parseFloat(car.totalRateInBookingCurrency))) {
               totalBRLNum = parseFloat(car.totalRateInBookingCurrency);
            } else if (car?.totalRateEstimate && car?.exchangeRate && !isNaN(parseFloat(car.totalRateEstimate)) && !isNaN(parseFloat(car.exchangeRate))) {
               totalBRLNum = parseFloat(car.totalRateEstimate) * parseFloat(car.exchangeRate);
            }

            const daysNum = booking?.days ? parseInt(booking.days, 10) : 0;

            if (isCancelled) {
               cancelledCount++;
               cancelledTotalBRL += totalBRLNum;
            } else {
               activeCount++;
               activeTotalBRL += totalBRLNum;
               activeTotalDays += daysNum;
            }

            const row = [
               res.resNumber || "",
               OP_STATUS_LABELS[opStatus] || opStatus,
               opStatus,
               STATUS_LABELS[res.status] || res.status,
               getPaymentMethodLabel(res, parsed),
               new Date(res.createdAt).toLocaleDateString("pt-BR") + " " + new Date(res.createdAt).toLocaleTimeString("pt-BR"),
               formatDateBR(booking?.pickupDate) + (booking?.pickupTime ? " " + formatTimeBR(booking.pickupTime) : ""),
               formatDateBR(booking?.returnDate) + (booking?.returnTime ? " " + formatTimeBR(booking.returnTime) : ""),
               booking?.days || "",
               `${parsed?.nome || ""} ${parsed?.sobrenome || ""}`.trim(),
               parsed?.email || "",
               parsed?.cpf || "",
               parsed?.telefone || "",
               car?.carCategorySample || car?.carCategoryName || "",
               car?.carCategoryCode || "",
               booking?.pickupStation || "",
               booking?.returnStation || booking?.pickupStation || "",
               totalBRLNum > 0 ? totalBRLNum.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "",
            ];

            csv += row.map(escapeCSV).join(",") + "\n";
         }

         // Footer / Totais Operacionais
         csv += "\n";
         csv += [
            escapeCSV(`TOTAL ATIVO / CONFIRMADO (${activeCount} reservas)`),
            "", "", "", "", "", "",
            escapeCSV(`${activeTotalDays} dias`),
            "", "", "", "", "", "", "", "",
            escapeCSV(`R$ ${activeTotalBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`),
         ].join(",") + "\n";

         if (cancelledCount > 0) {
            csv += [
               escapeCSV(`TOTAL CANCELADO (${cancelledCount} reservas)`),
               "", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
               escapeCSV(`R$ ${cancelledTotalBRL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`),
            ].join(",") + "\n";
         }

         csv += [
            escapeCSV(`TOTAL GERAL FILTRADO (${reservations.length} registros)`),
         ].join(",") + "\n";
      }

      // BOM for Excel compatibility with UTF-8
      const bom = "\uFEFF";
      const fileName = type === "financial"
         ? `relatorio_financeiro_${new Date().toISOString().slice(0, 10)}.csv`
         : `relatorio_operacional_${new Date().toISOString().slice(0, 10)}.csv`;

      return new Response(bom + csv, {
         headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${fileName}"`,
         },
      });
   } catch (error: any) {
      console.error("Error exporting reservations:", error);
      return NextResponse.json({ error: "Erro ao exportar" }, { status: 500 });
   }
}
