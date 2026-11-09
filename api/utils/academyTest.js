import { testScoreFromAnswers } from './academyScoring.js';

const MAX_ESSAY_LENGTH = 2000;

const sameSet = (a, b) => a.length === b.length && a.every((id) => b.includes(id));

/**
 * Menilai jawaban di server. questions = [{ id, type, correct_option_ids, option_ids }] dari database,
 * jadi kunci jawaban tidak pernah dikirim ke HP peserta.
 * Pilihan ganda dan checkbox dinilai langsung (checkbox: himpunan pilihan harus persis sama dengan kunci).
 * Essay yang diisi menunggu penilaian HR (is_correct null), essay yang dikosongkan otomatis salah.
 */
export function gradeAnswers(questions, answers) {
  const byQuestion = new Map(questions.map((q) => [q.id, q]));
  const sent = new Map();

  for (const answer of answers) {
    const question = byQuestion.get(Number(answer.question_id));
    if (!question) return { error: 'Jawaban tidak valid' };

    if (question.type === 'ESSAY') {
      sent.set(question.id, { option_ids: [], answer_text: String(answer.answer_text ?? '').trim().slice(0, MAX_ESSAY_LENGTH) });
      continue;
    }

    const optionIds = [...new Set((Array.isArray(answer.option_ids) ? answer.option_ids : []).map(Number))];
    if (optionIds.some((id) => !question.option_ids.includes(id)) || (question.type === 'SINGLE' && optionIds.length > 1)) {
      return { error: 'Jawaban tidak valid' };
    }
    sent.set(question.id, { option_ids: optionIds, answer_text: null });
  }

  const rows = questions.map((q) => {
    const given = sent.get(q.id) ?? { option_ids: [], answer_text: q.type === 'ESSAY' ? '' : null };
    const isCorrect =
      q.type === 'ESSAY'
        ? given.answer_text ? null : 0
        : sameSet(given.option_ids, q.correct_option_ids) && given.option_ids.length > 0 ? 1 : 0;
    return { question_id: q.id, type: q.type, option_ids: given.option_ids, answer_text: given.answer_text, is_correct: isCorrect };
  });
  return { rows, score: testScoreFromAnswers(rows) };
}

/**
 * Jawaban peserta untuk halaman riwayat. Kunci jawaban tidak ikut dikirim.
 * Soal tanpa jawaban (peserta ditutup HR) dilewati, tetapi nomornya tetap dihitung agar sama dengan "soal post-test no. N".
 */
export function buildAnswerReview(questions, answerRows) {
  return questions
    .map((q, index) => {
      const rows = answerRows.filter((r) => r.question_id === q.id);
      if (!rows.length) return null;
      const picked = new Set(rows.map((r) => r.option_id).filter((id) => id != null));
      return {
        id: q.id,
        number: index + 1,
        topic_name: q.topic_name,
        type: q.type,
        question_text: q.question_text,
        options:
          q.type === 'ESSAY' ? [] : q.options.map((o) => ({ id: o.id, option_text: o.option_text, selected: picked.has(o.id) })),
        answer_text: q.type === 'ESSAY' ? rows[0].answer_text ?? '' : null,
        is_correct: rows[0].is_correct,
      };
    })
    .filter(Boolean);
}

/**
 * Perlu perbaikan di rapor: nomor soal post-test yang salah per topik, dan indikator mentor di bawah 2,5.
 * Hasil: { questions: [{ topic_name, numbers }], mentor: [{ topic_name, indicator_text, score }] }.
 */
export function buildImprovements(postAnswers, mentorScores) {
  const byTopic = new Map();
  for (const a of postAnswers) {
    // is_correct null = essay belum dinilai, bukan salah.
    if (a.is_correct !== 0) continue;
    if (!byTopic.has(a.topic_name)) byTopic.set(a.topic_name, []);
    byTopic.get(a.topic_name).push(a.number);
  }
  return {
    questions: [...byTopic].map(([topic_name, numbers]) => ({ topic_name, numbers: numbers.sort((x, y) => x - y) })),
    mentor: mentorScores
      .filter((s) => Number(s.score) < 2.5)
      .map((s) => ({ topic_name: s.topic_name, indicator_text: s.indicator_text, score: Number(s.score) })),
  };
}
