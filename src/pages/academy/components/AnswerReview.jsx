import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Clock, Minus, X } from 'lucide-react';
import { setPageTitle } from '../../../utils/pageTitle.js';
import AcademyShell, { Card, Message } from './AcademyShell.jsx';
import { RESULT_META, api, errorMessage, fmt, scoreTone } from '../academyShared.js';

const PHASE_LABEL = { PRE: 'Pre-test', POST: 'Post-test' };

// Benar dan Salah memakai palet RESULT_META. Warna tidak berdiri sendiri: ada ikon dan teks.
const VERDICT = {
  1: { label: 'Benar', Icon: Check, cls: RESULT_META.LULUS.cls },
  0: { label: 'Salah', Icon: X, cls: RESULT_META.TIDAK_LULUS.cls },
  partial: { label: 'Benar, kurang lengkap', Icon: Minus, cls: RESULT_META.LULUS_PERBAIKAN.cls },
  pending: { label: 'Menunggu penilaian', Icon: Clock, cls: 'bg-slate-50 text-slate-500 border-slate-200' },
};

// Essay dinilai 0, 1, 2 oleh HR; pilihan ganda dan checkbox 0 atau 1.
function verdictKey({ type, is_correct }) {
  if (is_correct === null) return 'pending';
  if (type === 'ESSAY') return is_correct === 2 ? 1 : is_correct === 1 ? 'partial' : 0;
  return is_correct;
}

function Question({ question }) {
  const verdict = VERDICT[verdictKey(question)];
  return (
    <div className="py-3 border-b border-slate-100 last:border-0">
      <p className="text-[13px] font-bold text-slate-800">
        {question.number}. {question.question_text}
      </p>
      {question.type === 'ESSAY' ? (
        <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[12.5px] text-slate-700 whitespace-pre-wrap">
          {question.answer_text || 'Tidak dijawab'}
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {question.options.map((o) => (
            <li
              key={o.id}
              className={`rounded-xl border px-3 py-2 text-[12.5px] font-semibold ${
                o.selected ? 'border-[#5f1340] bg-[#5f1340]/5 text-[#5f1340]' : 'border-slate-200 text-slate-500'
              }`}
            >
              {o.option_text}
              {o.selected && <span className="ml-1.5 text-[11px] font-black">(jawabanmu)</span>}
            </li>
          ))}
        </ul>
      )}
      <span className={`inline-flex items-center gap-1 mt-2 rounded-full border px-2.5 py-1 text-[11px] font-black ${verdict.cls}`}>
        <verdict.Icon className="w-3.5 h-3.5" aria-hidden="true" />
        {verdict.label}
      </span>
    </div>
  );
}

export default function AnswerReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('PRE');

  useEffect(() => {
    setPageTitle('Jawaban saya');
    api
      .get(`/academy/trainings/${id}/answers`)
      .then((res) => setReview(res.data.data))
      .catch((err) => {
        if (err?.response?.status === 401) return navigate('/login');
        setError(errorMessage(err, 'Gagal memuat jawaban'));
      });
  }, [id, navigate]);

  if (!review) {
    return (
      <AcademyShell title="Jawaban saya" backTo={`/academy/${id}`}>
        {error ? <Message tone="error">{error}</Message> : <Message>Memuat...</Message>}
      </AcademyShell>
    );
  }

  return (
    <AcademyShell title="Jawaban saya" subtitle={review.training_name} backTo={`/academy/${id}`}>
      <div role="group" aria-label="Pilih test" className="flex gap-2">
        {review.tests.map((test) => (
          <button
            key={test.phase}
            type="button"
            aria-pressed={phase === test.phase}
            onClick={() => setPhase(test.phase)}
            className={`flex-1 rounded-2xl py-3 text-[13px] font-black ${
              phase === test.phase
                ? 'bg-gradient-to-r from-[#5f1340] to-[#8a245c] text-white shadow-lg'
                : 'bg-white border border-slate-200 text-slate-500'
            }`}
          >
            {PHASE_LABEL[test.phase]}
          </button>
        ))}
      </div>

      {review.tests
        .filter((test) => test.phase === phase)
        .map((test) => (
        <Card key={test.phase}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[11px] font-black uppercase tracking-wider text-slate-400">{PHASE_LABEL[test.phase]}</h2>
            <span className={`text-[13px] font-black ${scoreTone(test.score, review.pass_score, review.pass_with_fix_score)}`}>
              Nilai {fmt(test.score)}
            </span>
          </div>
          {test.questions.length ? (
            test.questions.map((q) => <Question key={q.id} question={q} />)
          ) : (
            <p className="text-[12px] text-slate-400 font-semibold py-2">Tidak ada jawaban tercatat</p>
          )}
        </Card>
      ))}
    </AcademyShell>
  );
}
