import { academyPool, mainPool } from '../../db/pool.js';
import {
  addDays,
  buildSubskillProgress,
  dayAverage,
  isValidDate,
  ojtAverage,
  ojtPhase,
  scorableDates,
  scoreProgress,
  validateDayScores,
} from '../../utils/academyOjt.js';
import { validateMentorScores } from '../../utils/academyMentor.js';
import { recalcParticipant } from './academy.controller.js';

const pool = (sql, params) => academyPool.query(sql, params);

async function getToday() {
  const [[row]] = await pool('SELECT CURDATE() AS today');
  return row.today;
}

async function getNames(employeeIds) {
  if (!employeeIds.length) return new Map();
  const [rows] = await mainPool.query('SELECT employee_id, full_name FROM mst_employee WHERE employee_id IN (?)', [
    [...new Set(employeeIds)],
  ]);
  return new Map(rows.map((r) => [r.employee_id, r.full_name]));
}

const fail = (res, status, message) => res.status(status).json({ success: false, message });

// ─── Penilaian mentor ─────────────────────────────────────────────────────

/** Peserta di batch yang mentornya karyawan ini (kolom employee_id, bukan vendor). Kosong kalau bukan mentornya. */
async function findMentoredParticipant(runQuery, participantId, employeeId, lock = false) {
  const [[participant]] = await runQuery(
    `SELECT p.id, p.employee_id, p.status, t.name AS training_name, b.start_at <= NOW() AS started
     FROM tr_participant p
     JOIN tr_training_batch b ON b.id = p.batch_id
     JOIN mst_training t ON t.id = b.training_id
     WHERE p.id = ? AND b.status = 'SCHEDULED'
       AND EXISTS (SELECT 1 FROM tr_batch_mentor m WHERE m.batch_id = b.id AND m.employee_id = ?)
     ${lock ? 'FOR UPDATE' : ''}`,
    [participantId, employeeId]
  );
  return participant ?? null;
}

/** Indikator mentor milik peserta: Praktik dari topik yang di-assign, Sikap untuk semua. Sama dengan backend-superapp. */
async function getParticipantIndicators(runQuery, participantId) {
  const [indicators] = await runQuery(
    `SELECT i.id, i.category, i.indicator_text, COALESCE(tp.name, 'Sikap') AS topic_name
     FROM tr_participant p
     JOIN tr_training_batch b ON b.id = p.batch_id
     JOIN mst_mentor_indicator i ON i.version_id = b.version_id
     LEFT JOIN mst_training_topic tp ON tp.id = i.topic_id
     WHERE p.id = ?
       AND (i.category = 'SIKAP' OR i.topic_id IN (SELECT topic_id FROM tr_participant_topic WHERE participant_id = p.id))
     ORDER BY i.category, i.sort_order, i.id`,
    [participantId]
  );
  return indicators;
}

export const listMentoring = async (req, res) => {
  try {
    const [rows] = await pool(
      `SELECT p.id, p.employee_id, p.status, t.name AS training_name, b.start_at,
              (SELECT COUNT(*) FROM mst_mentor_indicator i
                 WHERE i.version_id = b.version_id
                   AND (i.category = 'SIKAP' OR i.topic_id IN (SELECT topic_id FROM tr_participant_topic pt WHERE pt.participant_id = p.id))
              ) AS indicator_count,
              (SELECT COUNT(*) FROM tr_mentor_score s
                 JOIN mst_mentor_indicator i ON i.id = s.indicator_id
                 WHERE s.participant_id = p.id
                   AND (i.category = 'SIKAP' OR i.topic_id IN (SELECT topic_id FROM tr_participant_topic pt WHERE pt.participant_id = p.id))
              ) AS scored_count
       FROM tr_participant p
       JOIN tr_training_batch b ON b.id = p.batch_id
       JOIN mst_training t ON t.id = b.training_id
       WHERE b.status = 'SCHEDULED' AND b.start_at <= NOW() AND p.status <> 'ABSENT'
         AND EXISTS (SELECT 1 FROM tr_batch_mentor m WHERE m.batch_id = b.id AND m.employee_id = ?)
       ORDER BY b.start_at DESC, p.id`,
      [req.user.employee_id]
    );
    const names = await getNames(rows.map((r) => r.employee_id));
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        full_name: names.get(r.employee_id) ?? 'Karyawan tidak ditemukan',
        training_name: r.training_name,
        start_at: r.start_at,
        scored: r.indicator_count > 0 && r.scored_count >= r.indicator_count,
      })),
    });
  } catch (err) {
    console.error('listMentoring error:', err);
    fail(res, 500, 'Gagal memuat daftar penilaian mentor');
  }
};

export const getMentoringForm = async (req, res) => {
  try {
    const participant = await findMentoredParticipant(pool, req.params.participantId, req.user.employee_id);
    if (!participant || !participant.started) return fail(res, 404, 'Peserta tidak ditemukan');

    const indicators = await getParticipantIndicators(pool, participant.id);
    const [scores] = await pool('SELECT indicator_id, score FROM tr_mentor_score WHERE participant_id = ?', [participant.id]);
    const scoreById = new Map(scores.map((s) => [s.indicator_id, s.score]));
    const names = await getNames([participant.employee_id]);
    res.json({
      success: true,
      data: {
        id: participant.id,
        full_name: names.get(participant.employee_id) ?? 'Karyawan tidak ditemukan',
        training_name: participant.training_name,
        absent: participant.status === 'ABSENT',
        indicators: indicators.map((i) => ({ ...i, score: scoreById.get(i.id) ?? null })),
      },
    });
  } catch (err) {
    console.error('getMentoringForm error:', err);
    fail(res, 500, 'Gagal memuat form penilaian');
  }
};

/** Nilai mentor bisa diisi kapan saja setelah batch mulai. Nilai akhir terisi kalau post-test sudah ada. */
export const saveMentoring = async (req, res) => {
  const conn = await academyPool.getConnection();
  const abort = async (status, message) => {
    await conn.rollback();
    fail(res, status, message);
  };

  try {
    await conn.beginTransaction();
    const run = (sql, params) => conn.query(sql, params);
    const participant = await findMentoredParticipant(run, req.params.participantId, req.user.employee_id, true);
    if (!participant || !participant.started) return await abort(404, 'Peserta tidak ditemukan');
    if (participant.status === 'ABSENT') return await abort(400, 'Peserta ditandai tidak hadir');

    const indicators = await getParticipantIndicators(run, participant.id);
    const checked = validateMentorScores(indicators, req.body.scores);
    if (checked.error) return await abort(400, checked.error);

    for (const indicator of indicators) {
      await conn.query(
        `INSERT INTO tr_mentor_score (participant_id, indicator_id, score, created_by) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE score = VALUES(score)`,
        [participant.id, indicator.id, checked.scores.get(indicator.id), req.user.employee_id]
      );
    }
    await recalcParticipant(conn, participant.id);
    await conn.commit();
    res.json({ success: true, message: 'Tersimpan' });
  } catch (err) {
    await conn.rollback();
    console.error('saveMentoring error:', err);
    fail(res, 500, 'Gagal menyimpan penilaian');
  } finally {
    conn.release();
  }
};

// ─── OJT ──────────────────────────────────────────────────────────────────

const endDateOf = (ojt) => addDays(ojt.start_date, ojt.days - 1);

/** Nilai per tanggal: { tanggal: [{ ojt_subskill_id, score }] }. */
function groupByDate(scoreRows) {
  const byDate = new Map();
  for (const row of scoreRows) {
    if (!byDate.has(row.score_date)) byDate.set(row.score_date, []);
    byDate.get(row.score_date).push(row);
  }
  return byDate;
}

/** Nilai OJT, jumlah penilaian (maksimal 2: hari pertama dan hari terakhir), dan kemajuan rata-rata. Sama dengan summarize di backend-superapp. */
function summarize(scoreRows, ojt) {
  const byDate = groupByDate(scoreRows);
  const averages = scorableDates(ojt.start_date, ojt.days).map((date) =>
    byDate.has(date) ? dayAverage(byDate.get(date).map((r) => r.score)) : null
  );
  return {
    scored_days: averages.filter((a) => a !== null).length,
    average: ojtAverage(averages),
    progress: scoreProgress(averages[0], averages[1]),
  };
}

/** Dua entri: hari pertama dan hari terakhir OJT, terisi atau belum. `subskills` = baris tr_ojt_subskill OJT itu (urut kriteria lalu nama). */
function buildDays(ojt, scoreRows, subskills, today) {
  const byDate = groupByDate(scoreRows);
  const order = new Map(subskills.map((s, index) => [s.id, { ...s, order: index }]));
  return scorableDates(ojt.start_date, ojt.days).map((date, index) => {
    const rows = byDate.get(date);
    return {
      date,
      kind: index === 0 ? 'FIRST' : 'LAST',
      can_score: date <= today,
      scored: Boolean(rows),
      average: rows ? dayAverage(rows.map((r) => r.score)) : null,
      scores: rows
        ? rows
            .map((r) => ({ ...order.get(r.ojt_subskill_id), score: r.score }))
            .sort((a, b) => a.order - b.order)
            .map((s) => ({ subskill_id: s.id, name: s.name, criterion_name: s.criterion_name, score: s.score }))
        : [],
    };
  });
}

/** OJT yang dipantau karyawan ini. */
async function findObservedOjt(runQuery, ojtId, employeeId) {
  const [[ojt]] = await runQuery(
    `SELECT o.id, o.employee_id, o.start_date, o.days, t.name AS training_name
     FROM tr_ojt o
     JOIN tr_participant p ON p.id = o.participant_id
     JOIN tr_training_batch b ON b.id = p.batch_id
     JOIN mst_training t ON t.id = b.training_id
     WHERE o.id = ? AND EXISTS (SELECT 1 FROM tr_ojt_observer ob WHERE ob.ojt_id = o.id AND ob.employee_id = ?)`,
    [ojtId, employeeId]
  );
  return ojt ?? null;
}

/** Sub-skill salinan OJT ini, urut kriteria lalu nama. */
const getSubskills = async (runQuery, ojtId) => {
  const [rows] = await runQuery(
    `SELECT id, criterion_id, criterion_name, name FROM tr_ojt_subskill WHERE ojt_id = ? ORDER BY criterion_name, name`,
    [ojtId]
  );
  return rows;
};

export const listObserving = async (req, res) => {
  try {
    const [ojts] = await pool(
      `SELECT o.id, o.employee_id, o.start_date, o.days, t.name AS training_name
       FROM tr_ojt o
       JOIN tr_participant p ON p.id = o.participant_id
       JOIN tr_training_batch b ON b.id = p.batch_id
       JOIN mst_training t ON t.id = b.training_id
       WHERE EXISTS (SELECT 1 FROM tr_ojt_observer ob WHERE ob.ojt_id = o.id AND ob.employee_id = ?)
       ORDER BY o.start_date DESC, o.id DESC`,
      [req.user.employee_id]
    );
    if (!ojts.length) return res.json({ success: true, data: [] });

    const [scores] = await pool('SELECT ojt_id, score_date, score FROM tr_ojt_score WHERE ojt_id IN (?)', [ojts.map((o) => o.id)]);
    const names = await getNames(ojts.map((o) => o.employee_id));
    const today = await getToday();
    res.json({
      success: true,
      data: ojts.map((o) => {
        const end = endDateOf(o);
        return {
          id: o.id,
          full_name: names.get(o.employee_id) ?? 'Karyawan tidak ditemukan',
          training_name: o.training_name,
          start_date: o.start_date,
          end_date: end,
          days: o.days,
          phase: ojtPhase(o.start_date, end, today),
          scored_days: summarize(scores.filter((s) => s.ojt_id === o.id), o).scored_days,
        };
      }),
    });
  } catch (err) {
    console.error('listObserving error:', err);
    fail(res, 500, 'Gagal memuat daftar OJT');
  }
};

export const getObservingDetail = async (req, res) => {
  try {
    const ojt = await findObservedOjt(pool, req.params.id, req.user.employee_id);
    if (!ojt) return fail(res, 404, 'OJT tidak ditemukan');

    const subskills = await getSubskills(pool, ojt.id);
    const [scores] = await pool('SELECT score_date, ojt_subskill_id, score FROM tr_ojt_score WHERE ojt_id = ?', [ojt.id]);
    const names = await getNames([ojt.employee_id]);
    const today = await getToday();
    res.json({
      success: true,
      data: {
        id: ojt.id,
        full_name: names.get(ojt.employee_id) ?? 'Karyawan tidak ditemukan',
        training_name: ojt.training_name,
        start_date: ojt.start_date,
        end_date: endDateOf(ojt),
        criteria: buildSubskillProgress(subskills, scores, ...scorableDates(ojt.start_date, ojt.days)),
        days: buildDays(ojt, scores, subskills, today),
        ...summarize(scores, ojt),
      },
    });
  } catch (err) {
    console.error('getObservingDetail error:', err);
    fail(res, 500, 'Gagal memuat OJT');
  }
};

/** Hanya hari pertama dan hari terakhir yang dinilai. Satu penilai cukup mewakili satu hari: isian baru menimpa isian sebelumnya. */
export const saveObservingDay = async (req, res) => {
  const date = req.params.date;
  if (!isValidDate(date)) return fail(res, 400, 'Tanggal tidak valid');

  const conn = await academyPool.getConnection();
  const abort = async (status, message) => {
    await conn.rollback();
    fail(res, status, message);
  };

  try {
    await conn.beginTransaction();
    const run = (sql, params) => conn.query(sql, params);
    const ojt = await findObservedOjt(run, req.params.id, req.user.employee_id);
    if (!ojt) return await abort(404, 'OJT tidak ditemukan');
    if (!scorableDates(ojt.start_date, ojt.days).includes(date)) {
      return await abort(400, 'Hanya hari pertama dan hari terakhir yang dinilai');
    }
    const [[{ today }]] = await conn.query('SELECT CURDATE() AS today');
    if (date > today) return await abort(400, 'Tanggal itu belum bisa dinilai');

    const subskills = await getSubskills(run, ojt.id);
    const invalid = validateDayScores(subskills.map((s) => s.id), req.body.scores);
    if (invalid) return await abort(400, invalid);

    for (const { subskill_id, score } of req.body.scores) {
      await conn.query(
        `INSERT INTO tr_ojt_score (ojt_id, score_date, ojt_subskill_id, score, assessor_id, created_by) VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE score = VALUES(score), assessor_id = VALUES(assessor_id)`,
        [ojt.id, date, Number(subskill_id), Number(score), req.user.employee_id, req.user.employee_id]
      );
    }
    await conn.commit();
    res.json({ success: true, message: 'Tersimpan' });
  } catch (err) {
    await conn.rollback();
    console.error('saveObservingDay error:', err);
    fail(res, 500, 'Gagal menyimpan penilaian');
  } finally {
    conn.release();
  }
};

/** OJT milik karyawan yang login, beserta nilai akhir dan rincian per hari. */
export const getMyOjt = async (req, res) => {
  try {
    const [ojts] = await pool(
      `SELECT o.id, o.start_date, o.days, t.name AS training_name
       FROM tr_ojt o
       JOIN tr_participant p ON p.id = o.participant_id
       JOIN tr_training_batch b ON b.id = p.batch_id
       JOIN mst_training t ON t.id = b.training_id
       WHERE o.employee_id = ?
       ORDER BY o.start_date DESC, o.id DESC`,
      [req.user.employee_id]
    );
    const today = await getToday();
    const data = [];
    for (const ojt of ojts) {
      const subskills = await getSubskills(pool, ojt.id);
      const [scores] = await pool('SELECT score_date, ojt_subskill_id, score FROM tr_ojt_score WHERE ojt_id = ?', [ojt.id]);
      const end = endDateOf(ojt);
      data.push({
        id: ojt.id,
        training_name: ojt.training_name,
        start_date: ojt.start_date,
        end_date: end,
        days: ojt.days,
        phase: ojtPhase(ojt.start_date, end, today),
        ...summarize(scores, ojt),
        criteria: buildSubskillProgress(subskills, scores, ...scorableDates(ojt.start_date, ojt.days)),
        days_detail: buildDays(ojt, scores, subskills, today).filter((d) => d.scored),
      });
    }
    res.json({ success: true, data });
  } catch (err) {
    console.error('getMyOjt error:', err);
    fail(res, 500, 'Gagal memuat nilai OJT');
  }
};
