// Aturan OJT Alora Academy. Salinan dari backend-superapp/controllers/academy/utils/academyOjt.js (di sana ada validateOjtPayload):
// kalau aturan berubah, ubah keduanya bersamaan.
import { averageScore } from "./academyScoring.js";

export const MIN_SCORE = 1;
export const MAX_SCORE = 4;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Tanggal kalender yang nyata (2026-02-30 ditolak), format YYYY-MM-DD. */
export function isValidDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// Dihitung dengan UTC supaya zona waktu server tidak menggeser tanggal.
export function addDays(value, n) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Semua tanggal periode OJT: tanggal mulai sebanyak `days` hari berturut-turut. */
export function dateRange(start, days) {
  return Array.from({ length: days }, (_, i) => addDays(start, i));
}

/** BELUM_MULAI, BERJALAN, atau SELESAI. Tanggal berbentuk YYYY-MM-DD, jadi bisa dibandingkan sebagai teks. */
export function ojtPhase(start, end, today) {
  if (today < start) return "BELUM_MULAI";
  return today > end ? "SELESAI" : "BERJALAN";
}

/** Nilai satu hari: rata-rata nilai kriteria hari itu. */
export const dayAverage = (scores) => averageScore(scores);

/** Nilai akhir OJT: rata-rata nilai harian. Hari yang belum dinilai (null) tidak ikut dihitung. */
export const ojtAverage = (dayAverages) => averageScore(dayAverages.filter((a) => a !== null && a !== undefined));

/** Nilai satu hari harus mencakup persis semua kriteria OJT, masing-masing bilangan bulat 1 sampai 4. */
export function validateDayScores(criterionIds, scores) {
  const submitted = new Map((Array.isArray(scores) ? scores : []).map((s) => [Number(s.criterion_id), Number(s.score)]));
  if (submitted.size !== criterionIds.length || criterionIds.some((id) => !submitted.has(id))) {
    return "Semua kriteria wajib dinilai";
  }
  for (const score of submitted.values()) {
    if (!Number.isInteger(score) || score < MIN_SCORE || score > MAX_SCORE) return "Nilai harus 1 sampai 4";
  }
  return null;
}
