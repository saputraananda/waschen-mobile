import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Check } from 'lucide-react';
import { setPageTitle } from '../../../utils/pageTitle.js';
import AcademyShell, { Card, Message } from '../components/AcademyShell.jsx';
import { api, errorMessage, fmt, fmtDate } from '../academyShared.js';
import ScoreButtons from './ScoreButtons.jsx';

export default function OjtObserve() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ojt, setOjt] = useState(null);
  const [error, setError] = useState('');
  const [openDate, setOpenDate] = useState(null);
  const [scores, setScores] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    () =>
      api
        .get(`/academy/penilaian/ojt/${id}`)
        .then((res) => setOjt(res.data?.data))
        .catch((err) => {
          if (err?.response?.status === 401) return navigate('/login');
          setError(errorMessage(err, 'Gagal memuat OJT'));
        }),
    [id, navigate]
  );

  useEffect(() => {
    setPageTitle('Penilaian OJT');
    load();
  }, [load]);

  const open = (day) => {
    setError('');
    setOpenDate(day.date);
    setScores(Object.fromEntries(day.scores.map((s) => [s.criterion_id, s.score])));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.put(`/academy/penilaian/ojt/${id}/days/${openDate}`, {
        scores: ojt.criteria.map((c) => ({ criterion_id: c.id, score: scores[c.id] })),
      });
      setOpenDate(null);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Gagal menyimpan penilaian'));
    } finally {
      setSaving(false);
    }
  };

  const complete = ojt && ojt.criteria.every((c) => scores[c.id]);

  return (
    <AcademyShell
      title="Penilaian OJT"
      subtitle={ojt ? `${ojt.full_name} · ${fmtDate(ojt.start_date)} sampai ${fmtDate(ojt.end_date)}` : ''}
      backTo="/academy/penilaian"
    >
      {!ojt && !error && <Message>Memuat OJT...</Message>}
      {error && <Message tone="error">{error}</Message>}

      {ojt?.days.map((day, index) => (
        <Card key={day.date}>
          <button
            type="button"
            disabled={!day.can_score}
            onClick={() => (openDate === day.date ? setOpenDate(null) : open(day))}
            aria-expanded={openDate === day.date}
            className="flex w-full items-center justify-between gap-3 text-left disabled:opacity-50"
          >
            <span className="flex items-center gap-3 min-w-0">
              <CalendarDays className="w-5 h-5 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[13px] font-black text-slate-800">Hari ke-{index + 1}</span>
                <span className="block text-[11.5px] font-medium text-slate-500">{fmtDate(day.date)}</span>
              </span>
            </span>
            <span className="shrink-0 text-right">
              {!day.can_score ? (
                <span className="text-[11.5px] font-bold text-slate-400">Belum bisa dinilai</span>
              ) : day.scored ? (
                <span className="inline-flex items-center gap-1 text-[12.5px] font-black text-emerald-700">
                  <Check className="w-4 h-4" aria-hidden="true" />
                  {fmt(day.average)} dari 4
                </span>
              ) : (
                <span className="text-[11.5px] font-bold text-[#5f1340]">Belum dinilai</span>
              )}
            </span>
          </button>

          {openDate === day.date && (
            <div className="mt-3 border-t border-slate-100 pt-1">
              {ojt.criteria.map((c) => (
                <div key={c.id} className="py-3 border-b border-slate-100 last:border-0">
                  <p className="text-[12.5px] font-semibold text-slate-700 mb-2">{c.name}</p>
                  <ScoreButtons
                    value={scores[c.id] ?? null}
                    label={c.name}
                    onChange={(n) => setScores((prev) => ({ ...prev, [c.id]: n }))}
                  />
                </div>
              ))}
              <button
                type="button"
                disabled={!complete || saving}
                onClick={save}
                className="mt-3 w-full rounded-2xl bg-[#5f1340] py-3 text-[13px] font-black text-white disabled:opacity-40"
              >
                {saving ? 'Menyimpan...' : 'Simpan penilaian'}
              </button>
            </div>
          )}
        </Card>
      ))}
    </AcademyShell>
  );
}
