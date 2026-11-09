import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { setPageTitle } from '../../utils/pageTitle.js';
import AcademyShell, { Card, Message } from './components/AcademyShell.jsx';
import SkillReport from './components/SkillReport.jsx';
import { RESULT_META, api, errorMessage, fmt, nextStep } from './academyShared.js';

export default function Academy() {
  const navigate = useNavigate();
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('training');

  useEffect(() => {
    setPageTitle('Alora Academy');
    if (!localStorage.getItem('token')) {
      navigate('/login');
      return;
    }
    api
      .get('/academy/trainings')
      .then((res) => setTrainings(res.data?.data || []))
      .catch((err) => {
        if (err?.response?.status === 401) return navigate('/login');
        setError(errorMessage(err, 'Gagal memuat training'));
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  return (
    <AcademyShell
      title={tab === 'training' ? 'Training Saya' : 'Rapor Skill Matrix'}
      subtitle={tab === 'training' ? 'Test, feedback, rapor, dan materi training' : 'Terpisah dari rapor training'}
    >
      <div className="bg-white rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-slate-100 p-1.5 grid grid-cols-2 gap-1.5" role="tablist">
        {[
          ['training', 'Training'],
          ['skill', 'Skill Matrix'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`rounded-2xl py-2.5 text-[12.5px] font-black transition ${tab === value ? 'bg-[#5f1340] text-white' : 'text-slate-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'skill' && <SkillReport />}

      {tab === 'training' && loading && <Message>Memuat training...</Message>}
      {tab === 'training' && error && <Message tone="error">{error}</Message>}
      {tab === 'training' && !loading && !error && trainings.length === 0 && <Message>Belum ada training untukmu</Message>}

      {tab === 'training' && trainings.map((t) => {
        const result = RESULT_META[t.result_status];
        const step = nextStep(t);
        return (
          <button key={t.id} type="button" onClick={() => navigate(`/academy/${t.id}`)} className="w-full text-left">
            <Card className="active:scale-[0.98] transition-transform">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[14px] font-black text-slate-800 leading-tight">{t.training_name}</h2>
                  {t.report_ready ? (
                    <p className="text-[11.5px] text-slate-500 mt-1.5 leading-relaxed">
                      Pre {fmt(t.pre_score)} · Post {fmt(t.post_score)} · Naik {t.post_score - t.pre_score >= 0 ? '+' : ''}
                      {t.post_score - t.pre_score}
                      <br />
                      Mentor {fmt(t.mentor_score)} · Nilai akhir {fmt(t.final_score)}
                      <br />
                      Kepuasan {fmt(t.feedback_score)} dari 4
                    </p>
                  ) : (
                    <p className={`text-[11.5px] font-bold mt-1.5 ${t.status === 'ABSENT' ? 'text-slate-400' : 'text-[#5f1340]'}`}>{step}</p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" aria-hidden="true" />
              </div>
              {result && (
                <span className={`inline-flex mt-3 rounded-full border px-2.5 py-1 text-[11px] font-black ${result.cls}`}>
                  {result.label}
                </span>
              )}
            </Card>
          </button>
        );
      })}
    </AcademyShell>
  );
}
