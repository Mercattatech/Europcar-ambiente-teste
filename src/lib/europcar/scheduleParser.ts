import { StationScheduleHour, StationScheduleInterval, StationScheduleLunchBreak } from './xrsClient';

// Order: Segunda a Domingo (standard Brazilian business week display)
export const DAY_ORDER = [
  { dayNumber: 2, day: 'Seg', dayCode: 'MON' },
  { dayNumber: 3, day: 'Ter', dayCode: 'TUE' },
  { dayNumber: 4, day: 'Qua', dayCode: 'WED' },
  { dayNumber: 5, day: 'Qui', dayCode: 'THU' },
  { dayNumber: 6, day: 'Sex', dayCode: 'FRI' },
  { dayNumber: 7, day: 'Sáb', dayCode: 'SAT' },
  { dayNumber: 1, day: 'Dom', dayCode: 'SUN' },
];

export function formatTime(t: string): string {
  if (!t) return '';
  const clean = t.replace(':', '');
  if (clean.length === 4) return `${clean.slice(0, 2)}:${clean.slice(2)}`;
  if (clean.length === 3) return `0${clean.slice(0, 1)}:${clean.slice(1)}`;
  return t;
}

/**
 * Parses schedule from XRS getStationSchedule response (<stationDaySched> items).
 * Supports split hours / lunch breaks (e.g. 09:00 - 13:00 and 14:30 - 18:30) as seen on europcar.com.
 */
export function parseStationSchedule(schedItems: any[]): StationScheduleHour[] {
  if (!schedItems || !schedItems.length) return [];

  const generalScheds = schedItems.filter(s => {
    const type = (s?.$?.schedType ?? s?.schedType ?? 'G').toUpperCase();
    return type === 'G';
  });

  if (!generalScheds.length) return [];

  return DAY_ORDER.map(({ dayNumber, day, dayCode }) => {
    const dayMatches = generalScheds.filter(s => {
      const d = parseInt(s?.$?.dayNumber ?? s?.dayNumber ?? 0, 10);
      return d === dayNumber;
    });

    // Check if explicitly marked closed
    const isExplicitlyClosed = dayMatches.some(s => {
      const a = s.$ || s;
      return a.desc === 'CLOSED' && (a.afterHours ?? '') !== 'Y';
    });

    // Regular operating intervals (excluding afterHours and closed)
    const regularItems = dayMatches.filter(s => {
      const a = s.$ || s;
      return (a.afterHours ?? 'N') !== 'Y' && a.desc !== 'CLOSED' && (a.timeBegin || a.timeEnd);
    });

    if (regularItems.length === 0) {
      return {
        day,
        dayCode,
        dayNumber,
        open: '',
        close: '',
        isClosed: true,
        intervals: [],
        hasLunchBreak: false,
        lunchBreak: null,
        display: isExplicitlyClosed ? 'Fechado' : 'Consulte',
      };
    }

    // Sort intervals by timeBegin ascending
    const intervals: StationScheduleInterval[] = regularItems
      .map(item => {
        const a = item.$ || item;
        return {
          open: formatTime(a.timeBegin || ''),
          close: formatTime(a.timeEnd || ''),
        };
      })
      .filter(inv => inv.open && inv.close && inv.open !== inv.close)
      .sort((a, b) => a.open.localeCompare(b.open));

    if (intervals.length === 0) {
      return {
        day,
        dayCode,
        dayNumber,
        open: '',
        close: '',
        isClosed: true,
        intervals: [],
        hasLunchBreak: false,
        lunchBreak: null,
        display: 'Fechado',
      };
    }

    // Detect lunch break if there are 2 intervals
    let lunchBreak: StationScheduleLunchBreak | null = null;
    let hasLunchBreak = false;
    if (intervals.length >= 2) {
      lunchBreak = {
        start: intervals[0].close,
        end: intervals[1].open,
      };
      hasLunchBreak = true;
    }

    const open = intervals[0].open;
    const close = intervals[intervals.length - 1].close;
    const display = intervals.map(inv => `${inv.open} - ${inv.close}`).join(', ');

    return {
      day,
      dayCode,
      dayNumber,
      open,
      close,
      isClosed: false,
      intervals,
      hasLunchBreak,
      lunchBreak,
      display,
    };
  });
}

/**
 * Parses special holiday or exceptional schedules from XRS getStationSchedule (<stationDaySched schedType="E">).
 */
export function parseSpecialSchedule(schedItems: any[]): any[] {
  if (!schedItems || !schedItems.length) return [];
  const exceptional = schedItems.filter(s => {
    const type = (s?.$?.schedType ?? s?.schedType ?? '').toUpperCase();
    return type === 'E';
  });
  if (!exceptional.length) return [];

  const byDate: Record<string, any> = {};
  for (const item of exceptional) {
    const a = item.$ || item;
    const date = a.validPeriodBegin || a.validPeriodEnd || '';
    if (!date) continue;
    if (!byDate[date]) {
      byDate[date] = {
        date,
        dayNumber: parseInt(a.dayNumber ?? 0, 10),
        isClosed: false,
        intervals: [] as StationScheduleInterval[],
        hasLunchBreak: false,
        lunchBreak: null as StationScheduleLunchBreak | null,
      };
    }
    if (a.desc === 'CLOSED') {
      byDate[date].isClosed = true;
    } else if (a.timeBegin && a.timeEnd && (a.afterHours ?? 'N') !== 'Y') {
      byDate[date].intervals.push({
        open: formatTime(a.timeBegin),
        close: formatTime(a.timeEnd),
      });
    }
  }

  return Object.values(byDate).map((entry: any) => {
    entry.intervals.sort((x: any, y: any) => x.open.localeCompare(y.open));
    if (entry.intervals.length >= 2) {
      entry.hasLunchBreak = true;
      entry.lunchBreak = {
        start: entry.intervals[0].close,
        end: entry.intervals[1].open,
      };
    }
    return entry;
  });
}

/**
 * Fallback parser for older or alternative XRS opening hours structures.
 */
export function parseOpeningHours(raw: any): StationScheduleHour[] {
  // Structure A: <openingHoursList><openingHours day="MON" openTime="08:00" closeTime="20:00"/>
  const listA = raw?.openingHoursList?.openingHours;
  if (listA) {
    const arr = Array.isArray(listA) ? listA : [listA];
    const grouped: Record<string, any[]> = {};
    for (const h of arr) {
      const a = h.$ || h;
      const dayRaw = (a.day ?? a.dayOfWeek ?? '').toUpperCase();
      if (!dayRaw) continue;
      if (!grouped[dayRaw]) grouped[dayRaw] = [];
      grouped[dayRaw].push(a);
    }

    const result: StationScheduleHour[] = [];
    for (const { dayNumber, day, dayCode } of DAY_ORDER) {
      const items = grouped[dayCode] || grouped[day.toUpperCase()] || [];
      if (!items.length) {
        result.push({ day, dayCode, dayNumber, open: '', close: '', isClosed: true, intervals: [], hasLunchBreak: false, lunchBreak: null, display: 'Fechado' });
        continue;
      }
      const intervals: StationScheduleInterval[] = items
        .map(a => ({
          open: formatTime(a.openTime ?? a.open ?? ''),
          close: formatTime(a.closeTime ?? a.close ?? ''),
        }))
        .filter(inv => inv.open && inv.close && inv.open !== inv.close && !(inv.open === '00:00' && inv.close === '00:00'))
        .sort((a, b) => a.open.localeCompare(b.open));

      if (!intervals.length) {
        result.push({ day, dayCode, dayNumber, open: '', close: '', isClosed: true, intervals: [], hasLunchBreak: false, lunchBreak: null, display: 'Fechado' });
      } else {
        const hasLunchBreak = intervals.length >= 2;
        const lunchBreak = hasLunchBreak ? { start: intervals[0].close, end: intervals[1].open } : null;
        result.push({
          day,
          dayCode,
          dayNumber,
          open: intervals[0].open,
          close: intervals[intervals.length - 1].close,
          isClosed: false,
          intervals,
          hasLunchBreak,
          lunchBreak,
          display: intervals.map(inv => `${inv.open} - ${inv.close}`).join(', '),
        });
      }
    }
    if (result.some(r => !r.isClosed)) return result;
  }

  // Structure B: <scheduleList><schedule dayOfWeek="1" openTime="..." closeTime="..."/>
  const listB = raw?.scheduleList?.schedule;
  if (listB) {
    const arr = Array.isArray(listB) ? listB : [listB];
    const grouped: Record<number, any[]> = {};
    for (const h of arr) {
      const a = h.$ || h;
      const num = parseInt(a.dayOfWeek ?? a.day ?? 0, 10);
      if (!num) continue;
      if (!grouped[num]) grouped[num] = [];
      grouped[num].push(a);
    }

    const result: StationScheduleHour[] = [];
    for (const { dayNumber, day, dayCode } of DAY_ORDER) {
      const items = grouped[dayNumber] || [];
      if (!items.length) {
        result.push({ day, dayCode, dayNumber, open: '', close: '', isClosed: true, intervals: [], hasLunchBreak: false, lunchBreak: null, display: 'Fechado' });
        continue;
      }
      const intervals: StationScheduleInterval[] = items
        .map(a => ({
          open: formatTime(a.openTime ?? a.open ?? ''),
          close: formatTime(a.closeTime ?? a.close ?? ''),
        }))
        .filter(inv => inv.open && inv.close && inv.open !== inv.close)
        .sort((a, b) => a.open.localeCompare(b.open));

      if (!intervals.length) {
        result.push({ day, dayCode, dayNumber, open: '', close: '', isClosed: true, intervals: [], hasLunchBreak: false, lunchBreak: null, display: 'Fechado' });
      } else {
        const hasLunchBreak = intervals.length >= 2;
        const lunchBreak = hasLunchBreak ? { start: intervals[0].close, end: intervals[1].open } : null;
        result.push({
          day,
          dayCode,
          dayNumber,
          open: intervals[0].open,
          close: intervals[intervals.length - 1].close,
          isClosed: false,
          intervals,
          hasLunchBreak,
          lunchBreak,
          display: intervals.map(inv => `${inv.open} - ${inv.close}`).join(', '),
        });
      }
    }
    if (result.some(r => !r.isClosed)) return result;
  }

  return [];
}
