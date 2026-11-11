import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { setPageTitle } from '../../../utils/pageTitle.js';
import AcademyShell, { Card, Message } from '../components/AcademyShell.jsx';
import { api, errorMessage } from '../academyShared.js';
import ScoreButtons from './ScoreButtons.jsx';

export default function MentorScore() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [scores, setScores] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPageTitle('Penilaian Mentor');
    api
      .get(`/academy/penilaian/mentor/${id}`)
      .then((res) => {
        const data = res.data?.data;
        setForm(data);
        setScores(Object.fromEntries(data.indicators.filter((i) => i.score !== null).map((i) => [i.id, i.score])));
      })
      .catch((err) => {
        if (err?.response?.status === 401) return navigate('/login');
        setError(errorMessage(err, 'Gagal memuat form penilaian'));
      });
  }, [id, navigate]);

  const complete = form && form.indicators.every((i) => scores[i.id]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.put(`/academy/penilaian/mentor/${id}`, {
        scores: form.indicators.map((i) => ({ indicator_id: i.id, score: scores[i.id] })),
      });
      navigate(`/academy/penilaian/mentor/batch/${form.batch_id}`);
    } catch (err) {
      setError(errorMessage(err, 'Gagal menyimpan penilaian'));
      setSaving(false);
    }
  };

  const topics = form ? [...new Set(form.indicators.map((i) => i.topic_name))] : [];

  return (
    <AcademyShell
      title="Penilaian Mentor"
      subtitle={form ? `${form.full_name} · ${form.training_name}` : ''}
      backTo={form ? `/academy/penilaian/mentor/batch/${form.batch_id}` : '/academy/penilaian'}
    >
      {!form && !error && <Message>Memuat penilaian...</Message>}
      {error && <Message tone="error">{error}</Message>}
      {form?.absent && <Message>Peserta ditandai tidak hadir</Message>}

      {form && !form.absent && (
        <>
          {topics.map((topic) => (
            <Card key={topic}>
              <h2 className="text-[13px] font-black text-slate-800 mb-1">{topic}</h2>
              {form.indicators
                .filter((i) => i.topic_name === topic)
                .map((i) => (
                  <div key={i.id} className="py-3 border-b border-slate-100 last:border-0">
                    <p className="text-[12.5px] font-semibold text-slate-700 mb-2">{i.indicator_text}</p>
                    <ScoreButtons
                      value={scores[i.id] ?? null}
                      label={i.indicator_text}
                      onChange={(n) => setScores((prev) => ({ ...prev, [i.id]: n }))}
                    />
                  </div>
                ))}
            </Card>
          ))}
          <button
            type="button"
            disabled={!complete || saving}
            onClick={save}
            className="w-full rounded-2xl bg-[#5f1340] py-3.5 text-[13.5px] font-black text-white disabled:opacity-40"
          >
            {saving ? 'Menyimpan...' : 'Simpan penilaian'}
          </button>
          {!complete && (
            <p className="text-center text-[11.5px] font-semibold text-slate-400">Semua indikator wajib dinilai 1 sampai 4</p>
          )}
        </>
      )}
    </AcademyShell>
  );
}
