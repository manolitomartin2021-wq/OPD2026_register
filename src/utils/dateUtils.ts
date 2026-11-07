/**
 * Date and Time Utilities for Hospital Dalat (Asia/Kuching UTC+8)
 */

export function getNowInKuching(): Date {
  // Returns current date adjusted to Asia/Kuching
  return new Date();
}

export function formatDateTimeKuching(date = new Date()): string {
  // Returns YYYY-MM-DD HH:mm:ss
  const pad = (n: number) => n.toString().padStart(2, '0');
  const d = new Date(date);
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function getTodayDateString(date = new Date()): string {
  // Returns YYYY-MM-DD
  const pad = (n: number) => n.toString().padStart(2, '0');
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getCurrentTimeString(date = new Date()): string {
  // Returns HH:mm:ss
  const pad = (n: number) => n.toString().padStart(2, '0');
  const d = new Date(date);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function getCurrentYearMonth(date = new Date()): string {
  // Returns YYYY-MM
  const pad = (n: number) => n.toString().padStart(2, '0');
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function getCurrentYear(date = new Date()): string {
  return new Date(date).getFullYear().toString();
}

/**
 * Format YYYY-MM-DD into DD/MM/YYYY for UI display
 */
export function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Format YYYY-MM into Month Year Malay string, e.g. "November 2026"
 */
export const MALAY_MONTHS = [
  'Januari',
  'Februari',
  'Mac',
  'April',
  'Mei',
  'Jun',
  'Julai',
  'Ogos',
  'September',
  'Oktober',
  'November',
  'Disember',
];

export function formatYearMonthDisplay(yearMonthStr: string): string {
  const [year, month] = yearMonthStr.split('-');
  const monthIndex = parseInt(month, 10) - 1;
  const monthName = MALAY_MONTHS[monthIndex] || month;
  return `${monthName} ${year}`;
}

/**
 * Get ISO 8601 week number: YYYY-Wxx (Monday - Sunday)
 */
export function getISOWeekString(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

/**
 * Calculate age dynamically from birth date string (YYYY-MM-DD)
 * Returns object with years and display string (including months for babies < 2 years)
 */
export function calculateAge(birthDateStr: string, atDateStr?: string): { years: number; display: string } {
  if (!birthDateStr) return { years: 0, display: '-' };

  const birth = new Date(birthDateStr);
  const atDate = atDateStr ? new Date(atDateStr) : new Date();

  if (isNaN(birth.getTime()) || isNaN(atDate.getTime())) {
    return { years: 0, display: '-' };
  }

  let years = atDate.getFullYear() - birth.getFullYear();
  let months = atDate.getMonth() - birth.getMonth();
  const days = atDate.getDate() - birth.getDate();

  if (days < 0) {
    months--;
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  if (years < 0) {
    return { years: 0, display: '0 tahun' };
  }

  if (years < 2) {
    const totalMonths = years * 12 + months;
    if (totalMonths === 0) {
      return { years: 0, display: 'Baru Lahir (< 1 bulan)' };
    }
    return { years: 0, display: `${totalMonths} bulan` };
  }

  return { years, display: `${years} tahun` };
}

/**
 * Calculate if a last visit date is more than 6 calendar months ago
 */
export function isMoreThan6MonthsAgo(lastVisitStr: string | null, referenceDate = new Date()): boolean {
  if (!lastVisitStr) return true;
  const lastVisit = new Date(lastVisitStr);
  if (isNaN(lastVisit.getTime())) return true;

  // Subtract 6 calendar months from reference date
  const threshold = new Date(referenceDate);
  threshold.setMonth(threshold.getMonth() - 6);

  return lastVisit < threshold;
}

/**
 * Calculate the exact last day of a given YYYY-MM
 */
export function getLastDayOfMonth(yearMonthStr: string): string {
  const [y, m] = yearMonthStr.split('-').map(Number);
  // day 0 of month m+1 is the last day of month m
  const lastDayDate = new Date(y, m, 0);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${y}-${pad(m)}-${pad(lastDayDate.getDate())}`;
}

/**
 * Calculate Purge Eligibility Date:
 * Last day of month + 4 calendar months.
 * Example: November 2026 (last day 30/11/2026) -> + 4 calendar months = 30/03/2027.
 * If target month has fewer days (e.g. Feb), clamps to last day of target month.
 */
export function calculatePurgeEligibilityDate(yearMonthStr: string): string {
  const [y, m] = yearMonthStr.split('-').map(Number);
  const lastDayDate = new Date(y, m, 0);
  const originalDay = lastDayDate.getDate();

  // Target month is m + 4 (1-indexed)
  let targetYear = y;
  let targetMonth = m + 4;
  if (targetMonth > 12) {
    targetYear += Math.floor((targetMonth - 1) / 12);
    targetMonth = ((targetMonth - 1) % 12) + 1;
  }

  // Maximum days in target month
  const maxDaysInTarget = new Date(targetYear, targetMonth, 0).getDate();
  const finalDay = Math.min(originalDay, maxDaysInTarget);

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${targetYear}-${pad(targetMonth)}-${pad(finalDay)}`;
}

/**
 * Check if today has passed the purge eligibility date
 */
export function isEligibleForPurge(tarikhLayakBersih: string | null, todayStr = getTodayDateString()): boolean {
  if (!tarikhLayakBersih) return false;
  return todayStr > tarikhLayakBersih;
}
