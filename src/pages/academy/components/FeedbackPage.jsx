import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { setPageTitle } from '../../../utils/pageTitle.js';
import AcademyShell, { Card, Message } from './AcademyShell.jsx';
import { api, errorMessage } from '../academyShared.js';

export default function FeedbackPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPageTitle('Feedback Training');
    api
      .get(`/academy/trainings/${id}/feedback`)
      .then((res) => setForm(res.data.data))
      .catch((err) => setError(errorMessage(err, 'Gagal memuat feedback')));
  }, [id]);

  const setAnswer = (questionId, fields) => setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...fields } }));
  const missingScale = form ? form.questions.some((q) => q.type === 'SCALE' && !answers[q.id]?.score) : true;

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/academy/trainings/${id}/feedback`, {
        answers: Object.entries(answers).map(([feedback_question_id, a]) => ({ feedback_question_id: Number(feedback_question_id), ...a })),
      });
      navigate(`/academy/${id}`);
    } catch (err) {
      setError(errorMessage(err, 'Gagal mengirim feedback'));
      setSubmitting(false);
    }
  };

  return (
    <AcademyShell title="Feedback Training" subtitle={form?.training_name} backTo={`/academy/${id}`}>
      {error && <Message tone="error">{error}</Message>}
      {!form && !error && <Message>Memuat...</Message>}

      {form?.questions.map((q, index) => (
        <Card key={q.id}>
          {q.type === 'SCALE' ? (
            <fieldset>
              <legend className="text-[13px] font-bold text-slate-800 mb-3">
                {index + 1}. {q.question_text}
              </legend>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((value) => (
                  <label
                    key={value}
                    className={`rounded-xl border py-2.5 text-center text-[14px] font-black cursor-pointer ${
                      answers[q.id]?.score === value ? 'border-[#5f1340] bg-[#5f1340] text-white' : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`f-${q.id}`}
                      checked={answers[q.id]?.score === value}
                      onChange={() => setAnswer(q.id, { score: value })}
                      className="sr-only"
                    />
                    {value}
                  </label>
                ))}
              </div>
              <div className="flex justify-between text-[10.5px] text-slate-400 font-semibold mt-1.5">
                <span>Kurang</span>
                <span>Sangat baik</span>
              </div>
            </fieldset>
          ) : (
            <label className="block">
              <span className="block text-[13px] font-bold text-slate-800 mb-2">
                {index + 1}. {q.question_text}
              </span>
              <textarea
                rows={3}
                maxLength={2000}
                value={answers[q.id]?.answer_text ?? ''}
                onChange={(e) => setAnswer(q.id, { answer_text: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12.5px] text-slate-800 outline-none focus:border-[#5f1340]"
              />
            </label>
          )}
        </Card>
      ))}

      {form && (
        <button
          type="button"
          onClick={submit}
          disabled={submitting || missingScale}
          className="w-full rounded-2xl bg-gradient-to-r from-[#5f1340] to-[#8a245c] py-3.5 text-[13px] font-black text-white shadow-lg disabled:opacity-50"
        >
          {submitting ? 'Mengirim...' : missingScale ? 'Isi semua pertanyaan nilai' : 'Kirim Feedback'}
        </button>
      )}
    </AcademyShell>
  );
}
