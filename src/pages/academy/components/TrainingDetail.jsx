import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, Minus, TrendingDown, TrendingUp, UserCheck, XCircle } from 'lucide-react';
import { setPageTitle } from '../../../utils/pageTitle.js';
import AcademyShell, { Card, Message } from './AcademyShell.jsx';
import { RESULT_META, api, errorMessage, fmt, fmtDatetime, nextStep, scoreTone } from '../academyShared.js';

function Row({ label, value, tone = 'text-slate-800' }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-[12px] text-slate-500 font-semibold">{label}</span>
      <span className={`text-[13px] font-black ${tone}`}>{value}</span>
    </div>
  );
}

// Kenaikan memakai ikon dan teks, warna hanya penegas. Palet sama dengan RESULT_META.
const TREND = {
  up: { Icon: TrendingUp, cls: RESULT_META.LULUS.cls, text: (g) => `Naik +${g}` },
  down: { Icon: TrendingDown, cls: RESULT_META.TIDAK_LULUS.cls, text: (g) => `Turun ${g}` },
  flat: { Icon: Minus, cls: 'bg-slate-50 text-slate-500 border-slate-200', text: () => 'Tidak berubah' },
};

function ScoreBox({ label, value, tone }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 text-center">
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      <p className={`text-2xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function GroupTitle({ Icon, title }) {
  return (
    <p className="flex items-center gap-1.5 text-[12px] font-black text-slate-500">
      <Icon className="w-4 h-4" aria-hidden="true" />
      {title}
    </p>
  );
}

const actionBtnCls =
  'w-full rounded-2xl bg-gradient-to-r from-[#5f1340] to-[#8a245c] py-3 text-[13px] font-black text-white shadow-lg active:scale-[0.98] transition-transform';

export default function TrainingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [training, setTraining] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setPageTitle('Alora Academy');
    api
      .get(`/academy/trainings/${id}`)
      .then((res) => setTraining(res.data.data))
      .catch((err) => {
        if (err?.response?.status === 401) return navigate('/login');
        setError(errorMessage(err, 'Gagal memuat training'));
      });
  }, [id, navigate]);

  if (!training) {
    return (
      <AcademyShell title="Detail Training" backTo="/academy">
        {error ? <Message tone="error">{error}</Message> : <Message>Memuat...</Message>}
      </AcademyShell>
    );
  }

  const result = RESULT_META[training.result_status];
  const canTest = training.started && ['ASSIGNED', 'PRE_DONE'].includes(training.status);
  const phase = training.status === 'ASSIGNED' ? 'pre' : 'post';
  const gain =
    training.pre_score === null || training.post_score === null ? null : Number(training.post_score) - Number(training.pre_score);
  const trend = gain === null ? null : gain > 0 ? TREND.up : gain < 0 ? TREND.down : TREND.flat;
  // Server lama (cache) masih mengirim daftar teks: kartu disembunyikan, bukan crash.
  const improvements = {
    questions: training.improvements?.questions ?? [],
    mentor: training.improvements?.mentor ?? [],
  };
  const tone = (score) => scoreTone(score, training.pass_score, training.pass_with_fix_score);

  return (
    <AcademyShell title={training.training_name} subtitle={`Mulai ${fmtDatetime(training.start_at)}`} backTo="/academy">
      {training.report_ready ? (
        <Card>
          <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Rapor training</h2>
          <div className="py-3 text-center">
            <p className="text-[11px] font-bold text-slate-500">Nilai akhir</p>
            <p className={`text-5xl font-black ${tone(training.final_score)}`}>{fmt(training.final_score)}</p>
            {result && (
              <span className={`inline-flex mt-2 rounded-full border px-2.5 py-1 text-[11px] font-black ${result.cls}`}>{result.label}</span>
            )}
            <p className="mt-2 text-[11px] text-slate-400">
              Lulus ≥ {Number(training.pass_score)} · Lulus dengan perbaikan ≥ {Number(training.pass_with_fix_score)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ScoreBox label="Pre-test" value={fmt(training.pre_score)} tone={tone(training.pre_score)} />
            <ScoreBox label="Post-test" value={fmt(training.post_score)} tone={tone(training.post_score)} />
          </div>
          {trend && (
            <div className="mt-2 flex justify-center">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black ${trend.cls}`}>
                <trend.Icon className="w-3.5 h-3.5" aria-hidden="true" />
                {trend.text(gain)}
              </span>
            </div>
          )}
          <div className="mt-2">
            <Row label="Penilaian mentor" value={`${fmt(training.mentor_score)} dari 4`} />
            <Row label="Kepuasan training" value={`${fmt(training.feedback_score)} dari 4`} />
          </div>
          <button type="button" onClick={() => navigate(`/academy/${id}/answers`)} className={`${actionBtnCls} mt-4`}>
            Lihat jawaban
          </button>
        </Card>
      ) : (
        <Card>
          <p className="text-[13px] font-black text-slate-800">{nextStep(training)}</p>
          <p className="text-[11.5px] text-slate-400 mt-1">Topik: {training.topics.join(', ')}</p>
          {canTest && (
            <button type="button" onClick={() => navigate(`/academy/${id}/test/${phase}`)} className={`${actionBtnCls} mt-4`}>
              Mulai {phase === 'pre' ? 'Pre-test' : 'Post-test'}
            </button>
          )}
          {training.status === 'POST_DONE' && (
            <button type="button" onClick={() => navigate(`/academy/${id}/feedback`)} className={`${actionBtnCls} mt-4`}>
              Isi Feedback
            </button>
          )}
        </Card>
      )}

      {training.report_ready && (improvements.questions.length > 0 || improvements.mentor.length > 0) && (
        <Card>
          <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Perlu perbaikan</h2>
          {improvements.questions.length > 0 && (
            <div className="mb-3 last:mb-0">
              <GroupTitle Icon={XCircle} title="Soal post-test yang salah" />
              <ul>
                {improvements.questions.map((q) => (
                  <li key={q.topic_name} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
                    <span className="text-[12.5px] font-bold text-slate-800">{q.topic_name}</span>
                    <span className="flex flex-wrap justify-end gap-1">
                      {q.numbers.map((n) => (
                        <span key={n} className={`rounded-full border px-2 py-0.5 text-[11px] font-black ${RESULT_META.TIDAK_LULUS.cls}`}>
                          No. {n}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {improvements.mentor.length > 0 && (
            <div>
              <GroupTitle Icon={UserCheck} title="Praktik dan sikap" />
              <ul>
                {improvements.mentor.map((m) => (
                  <li key={`${m.topic_name}-${m.indicator_text}`} className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold text-slate-400">{m.topic_name}</span>
                      <span className="block text-[12.5px] font-semibold text-slate-700">{m.indicator_text}</span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-black ${
                        m.score < 2 ? RESULT_META.TIDAK_LULUS.cls : RESULT_META.LULUS_PERBAIKAN.cls
                      }`}
                    >
                      Nilai {m.score}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {training.materials.length > 0 && (
        <Card>
          <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">Materi training</h2>
          <ul className="space-y-2">
            {training.materials.map((m) => (
              <li key={m.id}>
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-[12.5px] font-bold text-[#5f1340]"
                >
                  <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{m.file_name}</span>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AcademyShell>
  );
}
