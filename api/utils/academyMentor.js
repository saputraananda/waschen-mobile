/**
 * Nilai mentor dari HP: semua indikator peserta wajib dinilai, masing-masing bilangan bulat 1 sampai 4.
 * Aturan sama dengan saveMentorScores di backend-superapp.
 * indicators = [{ id }], submitted = [{ indicator_id, score }]. Hasil: { error } atau { scores: Map(indicator_id -> score) }.
 */
export function validateMentorScores(indicators, submitted) {
  const sent = new Map((Array.isArray(submitted) ? submitted : []).map((s) => [Number(s.indicator_id), Number(s.score)]));
  for (const indicator of indicators) {
    const score = sent.get(indicator.id);
    if (!Number.isInteger(score) || score < 1 || score > 4) return { error: 'Semua indikator wajib dinilai 1 sampai 4' };
  }
  return { scores: new Map(indicators.map((i) => [i.id, sent.get(i.id)])) };
}
