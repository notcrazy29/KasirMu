/**
 * Timezone & Date Helper Utilities for Asia/Jakarta (WIB - UTC+7)
 */

// Get current date string formatted as YYYY-MM-DD in Asia/Jakarta timezone
export function getWibDateString(date: Date = new Date()): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

// Convert YYYY-MM-DD start of day in Asia/Jakarta (00:00:00.000) to Date object
export function getWibStartOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000+07:00`);
}

// Convert YYYY-MM-DD end of day in Asia/Jakarta (23:59:59.999) to Date object
export function getWibEndOfDay(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999+07:00`);
}

export type DatePeriod = 'today' | 'yesterday' | '7days' | 'week' | '30days' | 'month' | 'year' | 'custom' | 'all';

export interface PeriodRange {
  period: DatePeriod;
  startDate?: Date;
  endDate?: Date;
  dateStr?: string;
}

export function getDateRangeForPeriod(
  period: string = 'today',
  customStartDate?: string,
  customEndDate?: string
): PeriodRange {
  const now = new Date();
  const todayWibStr = getWibDateString(now); // e.g. "2026-08-06"
  const parts = todayWibStr.split('-');
  const yearStr = parts[0];
  const monthStr = parts[1];
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const cleanPeriod = (period || 'today').toLowerCase() as DatePeriod;

  if (cleanPeriod === 'today' || cleanPeriod === ('day' as any)) {
    return {
      period: 'today',
      startDate: getWibStartOfDay(todayWibStr),
      endDate: getWibEndOfDay(todayWibStr),
      dateStr: todayWibStr,
    };
  }

  if (cleanPeriod === 'yesterday') {
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayWibStr = getWibDateString(yesterdayDate);
    return {
      period: 'yesterday',
      startDate: getWibStartOfDay(yesterdayWibStr),
      endDate: getWibEndOfDay(yesterdayWibStr),
      dateStr: yesterdayWibStr,
    };
  }

  if (cleanPeriod === '7days' || cleanPeriod === 'week') {
    const past6Days = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    const past6Str = getWibDateString(past6Days);
    return {
      period: '7days',
      startDate: getWibStartOfDay(past6Str),
      endDate: getWibEndOfDay(todayWibStr),
    };
  }

  if (cleanPeriod === '30days') {
    const past29Days = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    const past29Str = getWibDateString(past29Days);
    return {
      period: '30days',
      startDate: getWibStartOfDay(past29Str),
      endDate: getWibEndOfDay(todayWibStr),
    };
  }

  if (cleanPeriod === 'month') {
    const firstDayStr = `${yearStr}-${monthStr}-01`;
    // Last day of month
    const lastDayNum = new Date(year, month, 0).getDate();
    const lastDayStr = `${yearStr}-${monthStr}-${String(lastDayNum).padStart(2, '0')}`;

    return {
      period: 'month',
      startDate: getWibStartOfDay(firstDayStr),
      endDate: getWibEndOfDay(lastDayStr),
    };
  }

  if (cleanPeriod === 'year') {
    const startYearStr = `${yearStr}-01-01`;
    const endYearStr = `${yearStr}-12-31`;
    return {
      period: 'year',
      startDate: getWibStartOfDay(startYearStr),
      endDate: getWibEndOfDay(endYearStr),
    };
  }

  if (cleanPeriod === 'custom' && (customStartDate || customEndDate)) {
    const startStr = customStartDate ? getWibDateString(new Date(customStartDate)) : todayWibStr;
    const endStr = customEndDate ? getWibDateString(new Date(customEndDate)) : startStr;
    return {
      period: 'custom',
      startDate: getWibStartOfDay(startStr),
      endDate: getWibEndOfDay(endStr),
    };
  }

  if (cleanPeriod === 'all') {
    return {
      period: 'all',
      startDate: undefined,
      endDate: undefined,
    };
  }

  // Default fallback
  return {
    period: 'today',
    startDate: getWibStartOfDay(todayWibStr),
    endDate: getWibEndOfDay(todayWibStr),
    dateStr: todayWibStr,
  };
}
