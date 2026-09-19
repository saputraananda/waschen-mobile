/**
 * Konstanta & helper Phase 12 — Grooming & Kebersihan
 */
import { getWibHoursMinutes } from './wib.js';

export const GROOMING_ROLES = ['Frontliner', 'Delivery Staff'];

export const GROOMING_STEPS = [
  { code: 'depan_setengah', label: 'Tampak Depan - Setengah Badan', order: 1 },
  { code: 'closeup_wajah', label: 'Close-Up Wajah', order: 2 },
  { code: 'samping', label: 'Tampak Samping', order: 3 },
  { code: 'belakang', label: 'Tampak Belakang', order: 4 },
  { code: 'celana', label: 'Tampilan Celana', order: 5 },
  { code: 'kuku', label: 'Close-Up Kuku', order: 6 }
];

export const GROOMING_STEP_CODES = GROOMING_STEPS.map((s) => s.code);

/** Jendela buka foto grooming (menit dari tengah malam WIB) */
export const GROOMING_WINDOWS = [
  { start: 5 * 60, end: 9 * 60 }, // 05:00–09:00
  { start: 10 * 60, end: 11 * 60 + 30 } // 10:00–11:30
];

export const GROOMING_LOCK_AFTER_MIN = 11 * 60 + 30; // 11:30

export const CLEANLINESS_ROLE_LABEL = {
  Frontliner: 'Frontliner / Area Outlet',
  'Delivery Staff': 'Delivery',
  'Washing Staff': 'Bagian Cuci',
  'Ironing Staff': 'Bagian Setrika',
  'Packing Staff': 'Bagian Packing'
};

export const CLEANLINESS_ROLES = Object.keys(CLEANLINESS_ROLE_LABEL);

export function requiresGrooming(role) {
  return GROOMING_ROLES.includes(String(role || '').trim());
}

export function requiresCleanliness(role) {
  return CLEANLINESS_ROLES.includes(String(role || '').trim());
}

export function cleanlinessAreaLabel(role) {
  const r = String(role || '').trim();
  return CLEANLINESS_ROLE_LABEL[r] || r || 'Area Kerja';
}

export function wibMinutesNow(date = new Date()) {
  const { hours, minutes } = getWibHoursMinutes(date);
  return hours * 60 + minutes;
}

export function isGroomingWindowOpen(date = new Date()) {
  const m = wibMinutesNow(date);
  return GROOMING_WINDOWS.some((w) => m >= w.start && m < w.end);
}

export function isGroomingPastLock(date = new Date()) {
  return wibMinutesNow(date) >= GROOMING_LOCK_AFTER_MIN;
}

export function deriveGroomingStatus(photoCount, role) {
  if (!requiresGrooming(role)) return 'tidak_wajib';
  const n = Number(photoCount) || 0;
  if (n >= GROOMING_STEP_CODES.length) return 'lengkap';
  if (n === 0) return 'kosong';
  return 'kurang';
}

export function groomingStatusLabel(status) {
  const map = {
    lengkap: 'Lengkap',
    kurang: 'Kurang',
    kosong: 'Kosong',
    tidak_wajib: 'Tidak Wajib'
  };
  return map[status] || status || '—';
}
