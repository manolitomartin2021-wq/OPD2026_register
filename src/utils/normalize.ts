/**
 * Normalization and String Utilities
 */

import type { Gender } from '../types';

/**
 * Normalize patient name:
 * 1. Convert to UPPERCASE
 * 2. Collapse multiple spaces into one
 * 3. Preserve A/L, A/P, @, apostrophes, hyphens cleanly
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .toUpperCase()
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[^\w\s@/'\-]/g, ' ') // keep alphanumeric, spaces, @, /, apostrophe, hyphen
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate tokens from normalized name for multiEntry partial search
 */
export function generateNameTokens(normalizedName: string): string[] {
  if (!normalizedName) return [];
  const words = normalizedName
    .replace(/[@/'\-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);

  return Array.from(new Set(words));
}

/**
 * Normalize identity document number:
 * Remove spaces, hyphens, and convert to uppercase.
 */
export function normalizeDocNumber(docNo?: string | null): string {
  if (!docNo) return '';
  return docNo.toUpperCase().replace(/[\s\-_]/g, '').trim();
}

/**
 * Mask document number for slip printing and display:
 * Shows only the last 4 characters, masks previous characters.
 */
export function maskIdentity(idNumber?: string | null): string {
  if (!idNumber) return '-';
  const clean = idNumber.trim();
  if (clean.length <= 4) return clean;
  const visible = clean.slice(-4);
  const maskedCount = Math.min(clean.length - 4, 8);
  return '*'.repeat(maskedCount) + visible;
}

/**
 * Extract Gender and Date of Birth from 12-digit Malaysian MyKad (YYMMDD-PB-###G)
 */
export interface MyKadParsed {
  isValid: boolean;
  birthDate?: string; // YYYY-MM-DD
  gender?: Gender;
  ageYears?: number;
}

export function parseMyKad(icNumber: string): MyKadParsed {
  const clean = normalizeDocNumber(icNumber);
  if (!/^\d{12}$/.test(clean)) {
    return { isValid: false };
  }

  const yy = parseInt(clean.substring(0, 2), 10);
  const mm = parseInt(clean.substring(2, 4), 10);
  const dd = parseInt(clean.substring(4, 6), 10);
  const lastDigit = parseInt(clean.substring(11, 12), 10);

  // Month and day validity check
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
    return { isValid: false };
  }

  // Determine century:
  // Current year is 2026. If yy <= 26, birth year is likely 20yy. If yy > 26, 19yy.
  const currentYearYY = new Date().getFullYear() % 100;
  const century = yy <= currentYearYY ? 2000 : 1900;
  const fullYear = century + yy;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const birthDate = `${fullYear}-${pad(mm)}-${pad(dd)}`;

  // Odd last digit = LELAKI, Even last digit = PEREMPUAN
  const gender: Gender = lastDigit % 2 !== 0 ? 'LELAKI' : 'PEREMPUAN';

  return {
    isValid: true,
    birthDate,
    gender,
  };
}
