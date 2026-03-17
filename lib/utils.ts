import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatUSD(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatRut(rut: string): string {
  // Simple formatter: 123456789 -> 12.345.678-9
  let cleanRut = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (cleanRut.length < 2) return cleanRut;
  const dv = cleanRut.slice(-1);
  const start = cleanRut.slice(0, -1);
  return start.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
}

export function calcDiff(fisico: number | null, saldo: number): number | null {
  if (fisico === null || isNaN(fisico)) return null;
  return fisico - saldo;
}

export function generateSlug(text: string): string {
  return text
    .toString()
    .normalize('NFD') // split an accented letter in the base letter and the acent
    .replace(/[\u0300-\u036f]/g, '') // remove all previously split accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, '') // remove all chars not letters, numbers and spaces (to be replaced)
    .replace(/\s+/g, '-');
}
