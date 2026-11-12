import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { setPageTitle } from '../../../utils/pageTitle.js';
import AcademyShell, { Card, Message } from './AcademyShell.jsx';
import { AlertModal } from '../../../components/ConfirmModal.jsx';
import { api, errorMessage } from '../academyShared.js';

const INCOMPLETE_MESSAGE = 'Jawaban Anda masih ada yang belum lengkap';

const hintFor = (q) => {
  if (q.type === 'MULTI') return `Pilih minimal ${q.min_answers} jawaban`;
  return q.type === 'ESSAY' ? 'Jawab dengan kalimatmu sendiri' : null;
};
const optionCls = (selected) =>
  `flex items-center gap-3 rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold cursor-pointer ${
    selected ? 'border-[#5f1340] bg-[#5f1340]/5 text-[#5f1340]' : 'border-slate-200 text-slate-700'
  }`;

// Jawaban per soal: { option_ids: [], answer_text: '' }. Soal dianggap terjawab kalau ada pilihan atau teks.
const isAnswered = (q, answer) => (q.type === 'ESSAY' ? Boolean(answer?.answer_text?.trim()) : Boolean(answer?.option_ids?.length));

export default function TestPage() {
  const { id, phase } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  // Popup untuk kegagalan kirim, karena tombol Kirim ada di bawah halaman dan teks error di atas tidak terlihat.
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const label = phase === 'pre' ? 'Pre-test' : 'Post-test';

  useEffect(() => {
    setPageTitle(label);
    api
      .get(`/academy/trainings/${id}/test/${phase}`)
      .then((res) => setTest(res.data.data))
      .catch((err) => setError(errorMessage(err, 'Gagal memuat soal')));
  }, [id, phase, label]);

  const setAnswer = (questionId, fields) => setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...fields } }));

  const toggleOption = (q, optionId) => {
    const current = answers[q.id]?.option_ids ?? [];
    if (q.type === 'SINGLE') return setAnswer(q.id, { option_ids: [optionId] });
    setAnswer(q.id, { option_ids: current.includes(optionId) ? current.filter((o) => o !== optionId) : [...current, optionId] });
  };

  const unanswered = test ? test.questions.filter((q) => !isAnswered(q, answers[q.id])).length : 0;

  const submit = async () => {
    const incomplete = test.questions.some((q) => q.type === 'MULTI' && (answers[q.id]?.option_ids?.length ?? 0) < q.min_answers);
    if (incomplete) return setNotice(INCOMPLETE_MESSAGE);
    if (unanswered &&!window.confirm(`${unanswered} soal belum dijawab dan akan dihitung salah. Kirim sekarang?`)) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/academy/trainings/${id}/test/${phase}`, {
        answers: test.questions.map((q) => ({
          question_id: q.id,
          option_ids: answers[q.id]?.option_ids ?? [],
          answer_text: answers[q.id]?.answer_text ?? '',
        })),
      });
      setResult(res.data.data);
    } catch (err) {
      setNotice(errorMessage(err, 'Gagal mengirim jawaban'));
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <AcademyShell title={`${label} selesai`} backTo={`/academy/${id}`}>
        <Card className="text-center">
          {result.pending ? (
            <>
              <p className="text-[13px] font-black text-slate-800">Jawabanmu sudah terkirim</p>
              <p className="text-[12px] text-slate-500 mt-1.5">Nilai muncul setelah jawaban essay dinilai.</p>
            </>
          ) : (
            <>
              <p className="text-[12px] text-slate-500 font-semibold">Nilai kamu</p>
              <p className="text-[40px] font-black text-[#5f1340] leading-none my-2">{result.score}</p>
            </>
          )}
          <button
            type="button"
            onClick={() => navigate(`/academy/${id}`)}
            className="w-full rounded-2xl bg-gradient-to-r from-[#5f1340] to-[#8a245c] py-3 text-[13px] font-black text-white mt-3"
          >
            Lanjut
          </button>
        </Card>
      </AcademyShell>
    );
  }

  return (
    <AcademyShell title={label} subtitle={test?.training_name} backTo={`/academy/${id}`}>
      {error && <Message tone="error">{error}</Message>}
      {!test && !error && <Message>Memuat soal...</Message>}

      {test?.questions.map((q, index) => (
        <Card key={q.id}>
          <fieldset>
            <legend className="text-[13px] font-bold text-slate-800 mb-1">
              {index + 1}. {q.question_text}
            </legend>
            {hintFor(q) && <p className="text-[11px] text-slate-400 font-semibold mb-3">{hintFor(q)}</p>}
            {q.type === 'ESSAY' ? (
              <textarea
                rows={5}
                maxLength={2000}
                value={answers[q.id]?.answer_text ?? ''}
                onChange={(e) => setAnswer(q.id, { answer_text: e.target.value })}
                aria-label={`Jawaban soal ${index + 1}`}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12.5px] text-slate-800 outline-none focus:border-[#5f1340]"
              />
            ) : (
              <div className={`space-y-2 ${hintFor(q) ? '' : 'mt-3'}`}>
                {q.options.map((o) => {
                  const selected = answers[q.id]?.option_ids?.includes(o.id) ?? false;
                  return (
                    <label key={o.id} className={optionCls(selected)}>
                      <input
                        type={q.type === 'MULTI' ? 'checkbox' : 'radio'}
                        name={`q-${q.id}`}
                        checked={selected}
                        onChange={() => toggleOption(q, o.id)}
                        className="accent-[#5f1340] w-4 h-4 shrink-0"
                      />
                      {o.option_text}
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>
        </Card>
      ))}

      {test?.questions.length > 0 && (
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="w-full rounded-2xl bg-gradient-to-r from-[#5f1340] to-[#8a245c] py-3.5 text-[13px] font-black text-white shadow-lg disabled:opacity-60"
        >
          {submitting ? 'Mengirim...' : `Kirim Jawaban${unanswered ? ` (${unanswered} belum dijawab)` : ''}`}
        </button>
      )}
      <AlertModal
        message={notice}
        onClose={() => setNotice('')}
        variant={notice === INCOMPLETE_MESSAGE ? 'warning' : 'danger'}
        title={notice === INCOMPLETE_MESSAGE ? 'Belum lengkap' : 'Gagal'}
      />
    </AcademyShell>
  );
}
