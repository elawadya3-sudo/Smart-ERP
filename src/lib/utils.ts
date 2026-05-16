import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  try {
    const result = twMerge(clsx(inputs));
    return typeof result === 'string' ? result : '';
  } catch (e) {
    console.error('Error in cn utility:', e);
    return "";
  }
}

export function formatCurrency(amount: number, currency: string = 'EGP') {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export function formatDate(date: any) {
  if (!date) return '';
  
  let d: Date;
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'string') {
    d = new Date(date);
  } else if (date && typeof date === 'object' && 'seconds' in date) {
    // Firestore Timestamp
    d = new Date(date.seconds * 1000);
  } else {
    // Attempt to parse as date if it's something else
    d = new Date(date);
  }

  // Check if date is valid
  if (isNaN(d.getTime())) return String(date);

  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
  }).format(d);
}
