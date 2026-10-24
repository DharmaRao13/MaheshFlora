import { DatePreset, DateRangeResult } from '@/types';

export const BUSINESS_TIMEZONE = 'Asia/Kolkata';

export interface ISTDateComponents {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

/**
 * Returns the current date components in Asia/Kolkata time zone.
 */
export function getISTDateComponents(date: Date = new Date()): ISTDateComponents {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parseInt(parts.find((p) => p.type === 'year')?.value || '1970', 10);
  const month = parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10);
  const day = parseInt(parts.find((p) => p.type === 'day')?.value || '1', 10);

  return { year, month, day };
}

/**
 * Formats year, month, day into YYYY-MM-DD string.
 */
export function formatYYYYMMDD(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * Converts a Date or ISO string to a business date string (YYYY-MM-DD) in Asia/Kolkata.
 */
export function toISTDateString(dateInput: Date | string | number): string {
  const d = typeof dateInput === 'object' && dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) {
    return '1970-01-01';
  }
  const { year, month, day } = getISTDateComponents(d);
  return formatYYYYMMDD(year, month, day);
}

/**
 * Add or subtract days from a YYYY-MM-DD string safely in UTC.
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  dateObj.setUTCDate(dateObj.getUTCDate() + days);
  return formatYYYYMMDD(
    dateObj.getUTCFullYear(),
    dateObj.getUTCMonth() + 1,
    dateObj.getUTCDate()
  );
}

/**
 * Calculates the number of days (inclusive) between two YYYY-MM-DD date strings.
 */
export function getDaysDifference(fromDate: string, toDate: string): number {
  const [y1, m1, d1] = fromDate.split('-').map(Number);
  const [y2, m2, d2] = toDate.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  const diffTime = t2 - t1;
  return Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);
}

/**
 * Formats a YYYY-MM-DD date string to a human-readable display string in Indian English.
 * e.g. "24 Oct 2026"
 */
export function formatHumanDate(dateStr: string, options: { includeYear?: boolean; shortMonth?: boolean } = {}): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[m - 1] || '';
  if (options.includeYear === false) {
    return `${d} ${monthName}`;
  }
  return `${d} ${monthName} ${y}`;
}

/**
 * Calculates start, end, and preceding comparison dates for dashboard filters.
 */
export function calculateDateRange(
  preset: DatePreset,
  customFrom?: string,
  customTo?: string,
  nowInput: Date = new Date()
): DateRangeResult {
  const todayComponents = getISTDateComponents(nowInput);
  const todayStr = formatYYYYMMDD(todayComponents.year, todayComponents.month, todayComponents.day);

  switch (preset) {
    case 'today': {
      const fromDate = todayStr;
      const toDate = todayStr;
      const previousFromDate = addDaysToDateString(todayStr, -1);
      const previousToDate = previousFromDate;
      return {
        preset,
        label: 'Today',
        fromDate,
        toDate,
        previousFromDate,
        previousToDate,
        previousLabel: 'Yesterday',
        durationDays: 1,
      };
    }

    case 'yesterday': {
      const yesterdayStr = addDaysToDateString(todayStr, -1);
      const fromDate = yesterdayStr;
      const toDate = yesterdayStr;
      const previousFromDate = addDaysToDateString(yesterdayStr, -1);
      const previousToDate = previousFromDate;
      return {
        preset,
        label: 'Yesterday',
        fromDate,
        toDate,
        previousFromDate,
        previousToDate,
        previousLabel: 'Day Before Yesterday',
        durationDays: 1,
      };
    }

    case 'last_7_days': {
      const fromDate = addDaysToDateString(todayStr, -6);
      const toDate = todayStr;
      const previousToDate = addDaysToDateString(fromDate, -1);
      const previousFromDate = addDaysToDateString(previousToDate, -6);
      return {
        preset,
        label: 'Last 7 Days',
        fromDate,
        toDate,
        previousFromDate,
        previousToDate,
        previousLabel: 'Prior 7 Days',
        durationDays: 7,
      };
    }

    case 'last_30_days': {
      const fromDate = addDaysToDateString(todayStr, -29);
      const toDate = todayStr;
      const previousToDate = addDaysToDateString(fromDate, -1);
      const previousFromDate = addDaysToDateString(previousToDate, -29);
      return {
        preset,
        label: 'Last 30 Days',
        fromDate,
        toDate,
        previousFromDate,
        previousToDate,
        previousLabel: 'Prior 30 Days',
        durationDays: 30,
      };
    }

    case 'this_month': {
      const fromDate = formatYYYYMMDD(todayComponents.year, todayComponents.month, 1);
      const toDate = todayStr;
      const elapsedDays = todayComponents.day; // 1 to 31
      // Previous period: same elapsed days in previous month
      // First find previous month
      const prevMonthLastDay = addDaysToDateString(fromDate, -1);
      const [prevY, prevM, prevTotalDays] = prevMonthLastDay.split('-').map(Number);
      const prevFromDate = formatYYYYMMDD(prevY, prevM, 1);
      // Cap at previous month's max days
      const prevEndDay = Math.min(elapsedDays, prevTotalDays);
      const previousToDate = formatYYYYMMDD(prevY, prevM, prevEndDay);
      return {
        preset,
        label: 'This Month',
        fromDate,
        toDate,
        previousFromDate: prevFromDate,
        previousToDate,
        previousLabel: 'Last Month (Same Elapsed Days)',
        durationDays: getDaysDifference(fromDate, toDate),
      };
    }

    case 'last_month': {
      const thisMonthFirstDay = formatYYYYMMDD(todayComponents.year, todayComponents.month, 1);
      const lastMonthLastDayStr = addDaysToDateString(thisMonthFirstDay, -1);
      const [prevY, prevM] = lastMonthLastDayStr.split('-').map(Number);
      const fromDate = formatYYYYMMDD(prevY, prevM, 1);
      const toDate = lastMonthLastDayStr;
      const durationDays = getDaysDifference(fromDate, toDate);

      // Previous period: the month before last month
      const monthBeforeLastDayStr = addDaysToDateString(fromDate, -1);
      const [mby, mbm] = monthBeforeLastDayStr.split('-').map(Number);
      const previousFromDate = formatYYYYMMDD(mby, mbm, 1);
      const previousToDate = monthBeforeLastDayStr;

      return {
        preset,
        label: 'Last Month',
        fromDate,
        toDate,
        previousFromDate,
        previousToDate,
        previousLabel: 'Month Prior',
        durationDays,
      };
    }

    case 'this_year': {
      const fromDate = formatYYYYMMDD(todayComponents.year, 1, 1);
      const toDate = todayStr;
      const durationDays = getDaysDifference(fromDate, toDate);

      // Prior year equivalent period
      const previousFromDate = formatYYYYMMDD(todayComponents.year - 1, 1, 1);
      const previousToDate = formatYYYYMMDD(
        todayComponents.year - 1,
        todayComponents.month,
        // Handle leap year Feb 29
        todayComponents.month === 2 && todayComponents.day === 29 ? 28 : todayComponents.day
      );

      return {
        preset,
        label: 'This Year',
        fromDate,
        toDate,
        previousFromDate,
        previousToDate,
        previousLabel: 'Last Year (Same Period)',
        durationDays,
      };
    }

    case 'custom':
    default: {
      const cleanFrom = customFrom && /^\d{4}-\d{2}-\d{2}$/.test(customFrom) ? customFrom : addDaysToDateString(todayStr, -6);
      const cleanTo = customTo && /^\d{4}-\d{2}-\d{2}$/.test(customTo) ? customTo : todayStr;

      // Ensure from <= to
      const [finalFrom, finalTo] = cleanFrom <= cleanTo ? [cleanFrom, cleanTo] : [cleanTo, cleanFrom];
      const durationDays = getDaysDifference(finalFrom, finalTo);

      // Preceding interval of equal length
      const previousToDate = addDaysToDateString(finalFrom, -1);
      const previousFromDate = addDaysToDateString(previousToDate, -(durationDays - 1));

      return {
        preset: 'custom',
        label: `Custom (${formatHumanDate(finalFrom)} - ${formatHumanDate(finalTo)})`,
        fromDate: finalFrom,
        toDate: finalTo,
        previousFromDate,
        previousToDate,
        previousLabel: `Preceding ${durationDays} Days`,
        durationDays,
      };
    }
  }
}
