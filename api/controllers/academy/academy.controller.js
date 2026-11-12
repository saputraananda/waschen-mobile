import { academyPool } from '../../db/pool.js';
import { averageScore, computeParticipantScores, questionMaxPoints } from '../../utils/academyScoring.js';
import { buildAnswerReview, buildImprovements, gradeAnswers } from '../../utils/academyTest.js';
import { toAssetUrl } from '../../utils/assetUrl.js';

const PHASES = ['PRE', 'POST'];
// Status peserta yang boleh mengerjakan tiap test.
const PHASE_FROM_STATUS = { PRE: 'ASSIGNED', POST: 'PRE_DONE' };
const PHASE_TO_STATUS = { PRE: 'PRE_DONE', POST: 'POST_DONE' };

/** Peserta milik karyawan yang login. employee_id selalu dari token, bukan dari parameter. */
async function findOwnParticipant(runQuery, participantId, employeeId, lock = false) {
  const [[participant]] = await runQuery(
    `SELECT p.*, b.version_id, b.training_id, b.start_at, b.status AS batch_status, b.start_at <= NOW() AS started,
            t.name AS training_name
     FROM tr_participant p
     JOIN tr_training_batch b ON b.id = p.batch_id
     JOIN mst_training t ON t.id = b.training_id
     WHERE p.id = ? AND p.employee_id = ? ${lock ? 'FOR UPDATE' : ''}`,
    [participantId, employeeId]
  );
  return participant ?? null;
}

const pool = (sql, params) => academyPool.query(sql, params);

/** Soal test peserta, mengikuti versi batch dan topik yang di-assign. Urutannya juga dipakai untuk nomor soal di rapor. */
async function getQuestions(runQuery, participant, phase) {
  const [questions] = await runQuery(
    `SELECT q.id, q.type, q.question_text, tp.name AS topic_name
     FROM mst_question q
     JOIN tr_participant_topic pt ON pt.topic_id = q.topic_id AND pt.participant_id = ?
     JOIN mst_training_topic tp ON tp.id = q.topic_id
     WHERE q.version_id = ? AND q.phase = ?
     ORDER BY q.sort_order, q.id`,
    [participant.id, participant.version_id, phase]
  );
  if (!questions.length) return [];

  const [options] = await runQuery(
    `SELECT id, question_id, option_text, is_correct FROM mst_question_option
     WHERE question_id IN (?) ORDER BY sort_order, id`,
    [questions.map((q) => q.id)]
  );
  return questions.map((q) => {
    const own = options.filter((o) => o.question_id === q.id);
    return {
      ...q,
      options: own,
      option_ids: own.map((o) => o.id),
      correct_option_ids: own.filter((o) => o.is_correct).map((o) => o.id),
    };
  });
}

/** Sama dengan recalcParticipant di backend-superapp batchController. */
export async function recalcParticipant(conn, participantId) {
  const [[row]] = await conn.query(
    `SELECT p.status, p.post_score, v.pass_score, v.pass_with_fix_score, v.practice_weight, v.attitude_weight
     FROM tr_participant p
     JOIN tr_training_batch b ON b.id = p.batch_id
     JOIN mst_training_version v ON v.id = b.version_id
     WHERE p.id = ?`,
    [participantId]
  );
  // Praktik hanya dari topik yang di-assign. Sikap berlaku untuk semua peserta.
  const [scores] = await conn.query(
    `SELECT i.category, s.score
     FROM tr_mentor_score s
     JOIN mst_mentor_indicator i ON i.id = s.indicator_id
     WHERE s.participant_id = ?
       AND (i.category = 'SIKAP' OR i.topic_id IN (SELECT topic_id FROM tr_participant_topic WHERE participant_id = ?))`,
    [participantId, participantId]
  );
  const result = computeParticipantScores({
    postScore: row.post_score,
    practiceScores: scores.filter((s) => s.category === 'PRAKTIK').map((s) => s.score),
    attitudeScores: scores.filter((s) => s.category === 'SIKAP').map((s) => s.score),
    version: row,
  });
  await conn.query(
    `UPDATE tr_participant
     SET practice_score = ?, attitude_score = ?, mentor_score = ?, final_score = ?, result_status = ?
     WHERE id = ?`,
    [result.practice_score, result.attitude_score, result.mentor_score, result.final_score, result.result_status, participantId]
  );
}

const reportReady = (p) => p.status === 'FEEDBACK_DONE' && p.final_score !== null;

export const listMyTrainings = async (req, res) => {
  try {
    const [rows] = await academyPool.query(
      `SELECT p.id, p.status, p.pre_score, p.post_score, p.mentor_score, p.feedback_score, p.final_score, p.result_status,
              b.start_at, b.start_at <= NOW() AS started, t.name AS training_name
       FROM tr_participant p
       JOIN tr_training_batch b ON b.id = p.batch_id
       JOIN mst_training t ON t.id = b.training_id
       WHERE p.employee_id = ? AND b.status = 'SCHEDULED'
       ORDER BY b.start_at DESC`,
      [req.user.employee_id]
    );
    // Nilai baru ditampilkan setelah rapor lengkap, supaya peserta tidak melihat angka setengah jadi.
    res.json({
      success: true,
      data: rows.map((p) => ({
        id: p.id,
        training_name: p.training_name,
        start_at: p.start_at,
        started: Boolean(p.started),
        status: p.status,
        report_ready: reportReady(p),
        ...(reportReady(p)
          ? {
              pre_score: p.pre_score,
              post_score: p.post_score,
              mentor_score: p.mentor_score,
              feedback_score: p.feedback_score,
              final_score: p.final_score,
              result_status: p.result_status,
            }
          : {}),
      })),
    });
  } catch (err) {
    console.error('listMyTrainings error:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat training' });
  }
};

export const getMyTraining = async (req, res) => {
  try {
    const participant = await findOwnParticipant(pool, req.params.id, req.user.employee_id);
    if (!participant || participant.batch_status === 'CANCELLED') {
      return res.status(404).json({ success: false, message: 'Training tidak ditemukan' });
    }

    const [topics] = await academyPool.query(
      `SELECT tp.name FROM tr_participant_topic pt JOIN mst_training_topic tp ON tp.id = pt.topic_id WHERE pt.participant_id = ?`,
      [participant.id]
    );
    const [materials] = await academyPool.query(
      `SELECT id, file_name, file_path FROM mst_training_material WHERE training_id = ? AND is_active = 1 ORDER BY id DESC`,
      [participant.training_id]
    );

    const data = {
      id: participant.id,
      training_name: participant.training_name,
      start_at: participant.start_at,
      started: Boolean(participant.started),
      status: participant.status,
      topics: topics.map((t) => t.name),
      materials: materials.map((m) => ({ id: m.id, file_name: m.file_name, url: toAssetUrl(m.file_path) })),
      report_ready: reportReady(participant),
    };

    if (data.report_ready) {
      const postQuestions = await getQuestions(pool, participant, 'POST');
      const [answers] = await academyPool.query(
        `SELECT question_id, is_correct FROM tr_test_answer WHERE participant_id = ? AND phase = 'POST'`,
        [participant.id]
      );
      const correctById = new Map(answers.map((a) => [a.question_id, a.is_correct]));
      const [mentorScores] = await academyPool.query(
        `SELECT i.indicator_text, s.score, COALESCE(tp.name, 'Sikap') AS topic_name
         FROM tr_mentor_score s
         JOIN mst_mentor_indicator i ON i.id = s.indicator_id
         LEFT JOIN mst_training_topic tp ON tp.id = i.topic_id
         WHERE s.participant_id = ?
           AND (i.category = 'SIKAP' OR i.topic_id IN (SELECT topic_id FROM tr_participant_topic WHERE participant_id = ?))
         ORDER BY i.sort_order, i.id`,
        [participant.id, participant.id]
      );

      // Batas lulus milik versi batch ini, dipakai frontend untuk warna nilai.
      const [[version]] = await academyPool.query(
        `SELECT pass_score, pass_with_fix_score FROM mst_training_version WHERE id = ?`,
        [participant.version_id]
      );

      Object.assign(data, {
        pass_score: version.pass_score,
        pass_with_fix_score: version.pass_with_fix_score,
        pre_score: participant.pre_score,
        post_score: participant.post_score,
        mentor_score: participant.mentor_score,
        feedback_score: participant.feedback_score,
        final_score: participant.final_score,
        result_status: participant.result_status,
        // Peserta yang ditutup HR tidak punya jawaban, jadi tidak ada nomor soal yang bisa ditunjuk.
        improvements: buildImprovements(
          postQuestions
            .map((q, index) => ({
              id: q.id,
              number: index + 1,
              topic_name: q.topic_name,
              is_correct: correctById.get(q.id),
              max_points: questionMaxPoints(q.type, q.correct_option_ids.length),
            }))
            .filter((q) => correctById.has(q.id)),
          mentorScores
        ),
      });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error('getMyTraining error:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat detail training' });
  }
};

/** Jawaban pre-test dan post-test milik peserta sendiri. Terbuka setelah rapor siap, dengan kunci pilihan ganda dan checkbox (tanpa kunci essay). */
export const getMyAnswers = async (req, res) => {
  try {
    const participant = await findOwnParticipant(pool, req.params.id, req.user.employee_id);
    if (!participant || participant.batch_status === 'CANCELLED') {
      return res.status(404).json({ success: false, message: 'Training tidak ditemukan' });
    }
    if (!reportReady(participant)) {
      return res.status(400).json({ success: false, message: 'Jawaban terbuka setelah rapor siap' });
    }

    const [answerRows] = await academyPool.query(
      `SELECT a.phase, a.question_id, a.answer_text, a.is_correct, ao.option_id
       FROM tr_test_answer a
       LEFT JOIN tr_test_answer_option ao ON ao.answer_id = a.id
       WHERE a.participant_id = ?`,
      [participant.id]
    );
    const [[version]] = await academyPool.query(
      `SELECT pass_score, pass_with_fix_score FROM mst_training_version WHERE id = ?`,
      [participant.version_id]
    );

    const tests = [];
    for (const phase of PHASES) {
      const questions = await getQuestions(pool, participant, phase);
      tests.push({
        phase,
        score: phase === 'PRE' ? participant.pre_score : participant.post_score,
        questions: buildAnswerReview(questions, answerRows.filter((r) => r.phase === phase)),
      });
    }

    res.json({
      success: true,
      data: {
        training_name: participant.training_name,
        pass_score: version.pass_score,
        pass_with_fix_score: version.pass_with_fix_score,
        tests,
      },
    });
  } catch (err) {
    console.error('getMyAnswers error:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat jawaban' });
  }
};

/** Alasan test belum bisa dikerjakan, atau null kalau boleh. */
function testBlocker(participant, phase) {
  if (!participant || participant.batch_status === 'CANCELLED') return [404, 'Training tidak ditemukan'];
  if (!participant.started) return [400, 'Test baru terbuka saat training dimulai'];
  if (participant.status !== PHASE_FROM_STATUS[phase]) {
    return [400, phase === 'POST' && participant.status === 'ASSIGNED' ? 'Kerjakan pre-test dulu' : 'Test ini sudah dikerjakan'];
  }
  return null;
}

export const getTest = async (req, res) => {
  const phase = String(req.params.phase).toUpperCase();
  if (!PHASES.includes(phase)) return res.status(404).json({ success: false, message: 'Test tidak ditemukan' });

  try {
    const participant = await findOwnParticipant(pool, req.params.id, req.user.employee_id);
    const blocker = testBlocker(participant, phase);
    if (blocker) return res.status(blocker[0]).json({ success: false, message: blocker[1] });

    const questions = await getQuestions(pool, participant, phase);
    res.json({
      success: true,
      data: {
        training_name: participant.training_name,
        phase,
        questions: questions.map((q) => ({
          id: q.id,
          type: q.type,
          question_text: q.question_text,
          // Hanya jumlah kunci checkbox, bukan opsi mana yang benar.
          min_answers: q.type === 'MULTI' ? q.correct_option_ids.length : undefined,
          options: q.options.map((o) => ({ id: o.id, option_text: o.option_text })),
        })),
      },
    });
  } catch (err) {
    console.error('getTest error:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat soal' });
  }
};

export const submitTest = async (req, res) => {
  const phase = String(req.params.phase).toUpperCase();
  if (!PHASES.includes(phase)) return res.status(404).json({ success: false, message: 'Test tidak ditemukan' });

  const conn = await academyPool.getConnection();
  const fail = async (status, message) => {
    await conn.rollback();
    res.status(status).json({ success: false, message });
  };

  try {
    await conn.beginTransaction();
    const run = (sql, params) => conn.query(sql, params);
    // Dikunci supaya kirim dua kali (dobel tap atau dua HP) hanya tercatat sekali.
    const participant = await findOwnParticipant(run, req.params.id, req.user.employee_id, true);
    const blocker = testBlocker(participant, phase);
    if (blocker) return await fail(blocker[0], blocker[1]);

    const questions = await getQuestions(run, participant, phase);
    if (!questions.length) return await fail(400, 'Soal test belum tersedia');
    const graded = gradeAnswers(questions, Array.isArray(req.body.answers) ? req.body.answers : []);
    if (graded.error) return await fail(400, graded.error);

    for (const row of graded.rows) {
      const [answer] = await conn.query(
        `INSERT INTO tr_test_answer (participant_id, phase, question_id, answer_text, is_correct, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [participant.id, phase, row.question_id, row.answer_text, row.is_correct, req.user.employee_id]
      );
      for (const optionId of row.option_ids) {
        await conn.query(`INSERT INTO tr_test_answer_option (answer_id, option_id, created_by) VALUES (?, ?, ?)`, [
          answer.insertId,
          optionId,
          req.user.employee_id,
        ]);
      }
    }
    await conn.query(
      `UPDATE tr_participant SET ${phase === 'PRE' ? 'pre_score' : 'post_score'} = ?, status = ? WHERE id = ?`,
      [graded.score, PHASE_TO_STATUS[phase], participant.id]
    );
    if (phase === 'POST') await recalcParticipant(conn, participant.id);

    await conn.commit();
    // score null = masih ada essay yang menunggu penilaian HR.
    res.json({ success: true, data: { score: graded.score, pending: graded.score === null } });
  } catch (err) {
    await conn.rollback();
    console.error('submitTest error:', err);
    res.status(500).json({ success: false, message: 'Gagal menyimpan jawaban' });
  } finally {
    conn.release();
  }
};

/** Rapor skill matrix: penilaian terbaru tiap posisi untuk karyawan yang login. */
export const listMySkills = async (req, res) => {
  try {
    const [assessments] = await academyPool.query(
      `SELECT a.id, sp.name AS position_name, a.score, a.star, a.note, a.assessed_at
       FROM tr_sm_assessment a
       JOIN (SELECT position_id, MAX(id) AS id FROM tr_sm_assessment WHERE employee_id = ? GROUP BY position_id) last ON last.id = a.id
       JOIN mst_sm_position sp ON sp.id = a.position_id
       ORDER BY sp.sort_order, sp.name`,
      [req.user.employee_id]
    );
    if (!assessments.length) return res.json({ success: true, data: [] });

    const [details] = await academyPool.query(
      `SELECT d.assessment_id, d.score, d.category_weight, i.name AS indicator_name, c.id AS category_id, c.name AS category_name
       FROM tr_sm_assessment_detail d
       JOIN mst_sm_indicator i ON i.id = d.indicator_id
       JOIN mst_sm_category c ON c.id = i.category_id
       WHERE d.assessment_id IN (?)
       ORDER BY c.sort_order, c.id, i.sort_order, i.id`,
      [assessments.map((a) => a.id)]
    );

    res.json({
      success: true,
      data: assessments.map((a) => {
        const own = details.filter((d) => d.assessment_id === a.id);
        const categories = [...new Map(own.map((d) => [d.category_id, d])).values()].map((c) => {
          const rows = own.filter((d) => d.category_id === c.category_id);
          return { name: c.category_name, weight: Number(c.category_weight), average: averageScore(rows.map((r) => r.score)) };
        });
        // Indikator dengan nilai paling rendah ditandai perlu diperbaiki, kecuali semuanya sudah nilai 4.
        const lowest = Math.min(...own.map((d) => d.score));
        return {
          id: a.id,
          position_name: a.position_name,
          score: a.score,
          star: a.star,
          note: a.note,
          assessed_at: a.assessed_at,
          categories,
          needs_improvement:
            lowest < 4 ? own.filter((d) => d.score === lowest).map((d) => ({ name: d.indicator_name, score: d.score })) : [],
        };
      }),
    });
  } catch (err) {
    console.error('listMySkills error:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat rapor skill matrix' });
  }
};

export const getFeedbackForm = async (req, res) => {
  try {
    const participant = await findOwnParticipant(pool, req.params.id, req.user.employee_id);
    if (!participant || participant.batch_status === 'CANCELLED') {
      return res.status(404).json({ success: false, message: 'Training tidak ditemukan' });
    }
    if (participant.status !== 'POST_DONE') {
      return res.status(400).json({ success: false, message: 'Feedback terbuka setelah post-test' });
    }

    const [questions] = await academyPool.query(
      `SELECT id, type, question_text FROM mst_feedback_question WHERE version_id = ? ORDER BY sort_order, id`,
      [participant.version_id]
    );
    res.json({ success: true, data: { training_name: participant.training_name, questions } });
  } catch (err) {
    console.error('getFeedbackForm error:', err);
    res.status(500).json({ success: false, message: 'Gagal memuat feedback' });
  }
};

export const submitFeedback = async (req, res) => {
  const conn = await academyPool.getConnection();
  const fail = async (status, message) => {
    await conn.rollback();
    res.status(status).json({ success: false, message });
  };

  try {
    await conn.beginTransaction();
    const participant = await findOwnParticipant((sql, params) => conn.query(sql, params), req.params.id, req.user.employee_id, true);
    if (!participant || participant.batch_status === 'CANCELLED') return await fail(404, 'Training tidak ditemukan');
    if (participant.status !== 'POST_DONE') return await fail(400, 'Feedback sudah diisi atau post-test belum selesai');

    const [questions] = await conn.query(
      `SELECT id, type FROM mst_feedback_question WHERE version_id = ?`,
      [participant.version_id]
    );
    const answers = new Map((Array.isArray(req.body.answers) ? req.body.answers : []).map((a) => [Number(a.feedback_question_id), a]));

    const scaleScores = [];
    for (const question of questions) {
      const answer = answers.get(question.id) ?? {};
      if (question.type === 'SCALE') {
        const score = Number(answer.score);
        if (!Number.isInteger(score) || score < 1 || score > 4) return await fail(400, 'Semua pertanyaan nilai wajib diisi 1 sampai 4');
        scaleScores.push(score);
      }
      await conn.query(
        `INSERT INTO tr_feedback_answer (participant_id, feedback_question_id, score, answer_text, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [
          participant.id,
          question.id,
          question.type === 'SCALE' ? Number(answer.score) : null,
          question.type === 'OPEN' ? String(answer.answer_text ?? '').trim().slice(0, 2000) || null : null,
          req.user.employee_id,
        ]
      );
    }

    await conn.query(`UPDATE tr_participant SET feedback_score = ?, status = 'FEEDBACK_DONE' WHERE id = ?`, [
      averageScore(scaleScores),
      participant.id,
    ]);
    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('submitFeedback error:', err);
    res.status(500).json({ success: false, message: 'Gagal menyimpan feedback' });
  } finally {
    conn.release();
  }
};
