import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { setPageTitle } from '../../../utils/pageTitle.js';
import AcademyShell, { Card, Message } from '../components/AcademyShell.jsx';
import { RESULT_META, api, errorMessage, fmt, fmtDate } from '../academyShared.js';
import { ProgressBadge, SubskillProgress } from './Progress.jsx';

const TABS = [
  ['mentor', 'Mentor'],
  ['pembimbing', 'Pembimbing'],
  ['mine', 'Nilai OJT'],
];

const PHASE = {
  BELUM_MULAI: { label: 'Belum mulai', cls: 'bg-slate-50 text-slate-500 border-slate-200' },
  BERJALAN: { label: 'Berjalan', cls: RESULT_META.LULUS_PERBAIKAN.cls },
  SELESAI: { label: 'Selesai', cls: RESULT_META.LULUS.cls },
};

function PhaseBadge({ phase }) {
  const meta = PHASE[phase];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${meta.cls}`}>{meta.label}</span>;
}

/** Memuat daftar dari satu endpoint penilaian. */
function useList(path, failure) {
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(path)
      .then((res) => setRows(res.data?.data || []))
      .catch((err) => {
        if (err?.response?.status === 401) return navigate('/login');
        setError(errorMessage(err, failure));
      });
  }, [path, failure, navigate]);

  return { rows, error };
}

function ListState({ rows, error, empty }) {
  if (error) return <Message tone="error">{error}</Message>;
  if (!rows) return <Message>Memuat...</Message>;
  if (!rows.length) return <Message>{empty}</Message>;
  return null;
}

function MentorPanel() {
  const navigate = useNavigate();
  const { rows, error } = useList('/academy/penilaian/mentor', 'Gagal memuat penilaian mentor');
  return (
    <>
      <ListState rows={rows} error={error} empty="Kamu belum ditugaskan sebagai mentor" />
      {rows?.map((r) => (
        <button key={r.id} type="button" onClick={() => navigate(`/academy/penilaian/mentor/${r.id}`)} className="w-full text-left">
          <Card className="active:scale-[0.98] transition-transform">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[14px] font-black text-slate-800 leading-tight">{r.full_name}</h2>
                <p className="text-[11.5px] text-slate-500 mt-1">{r.training_name}</p>
                <span
                  className={`inline-flex mt-2 rounded-full border px-2.5 py-1 text-[11px] font-black ${
                    r.scored ? RESULT_META.LULUS.cls : RESULT_META.LULUS_PERBAIKAN.cls
                  }`}
                >
                  {r.scored ? 'Sudah dinilai' : 'Belum dinilai'}
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" aria-hidden="true" />
            </div>
          </Card>
        </button>
      ))}
    </>
  );
}

function PembimbingPanel() {
  const navigate = useNavigate();
  const { rows, error } = useList('/academy/penilaian/ojt', 'Gagal memuat daftar OJT');
  return (
    <>
      <ListState rows={rows} error={error} empty="Kamu belum ditugaskan memantau OJT" />
      {rows?.map((r) => (
        <button key={r.id} type="button" onClick={() => navigate(`/academy/penilaian/ojt/${r.id}`)} className="w-full text-left">
          <Card className="active:scale-[0.98] transition-transform">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[14px] font-black text-slate-800 leading-tight">{r.full_name}</h2>
                <p className="text-[11.5px] text-slate-500 mt-1">
                  {r.training_name} · {fmtDate(r.start_date)} sampai {fmtDate(r.end_date)}
                </p>
                <p className="text-[11.5px] font-bold text-[#5f1340] mt-1">
                  {r.scored_days} dari 2 penilaian
                </p>
                <div className="mt-2">
                  <PhaseBadge phase={r.phase} />
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" aria-hidden="true" />
            </div>
          </Card>
        </button>
      ))}
    </>
  );
}

function MyOjtCard({ ojt }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-black text-slate-800 leading-tight">{ojt.training_name}</h2>
          <p className="text-[11.5px] text-slate-500 mt-1">
            {fmtDate(ojt.start_date)} sampai {fmtDate(ojt.end_date)}
          </p>
        </div>
        <PhaseBadge phase={ojt.phase} />
      </div>
      <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-center">
        <p className="text-[11px] font-bold text-slate-500">Nilai OJT</p>
        <p className="text-2xl font-black text-slate-800">{ojt.average === null ? '-' : `${fmt(ojt.average)} dari 4`}</p>
        <p className="text-[11px] font-medium text-slate-400">{ojt.scored_days} dari 2 penilaian</p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="text-[11px] font-bold text-slate-500">Kemajuan</span>
          <ProgressBadge progress={ojt.progress} />
        </div>
      </div>
      {ojt.days_detail.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="mt-3 flex w-full items-center justify-between text-[12.5px] font-black text-[#5f1340]"
          >
            Rincian penilaian
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {open && ojt.progress && (
            <div className="mt-2 rounded-2xl border border-slate-100 p-3">
              <p className="text-[12.5px] font-black text-slate-800">Kemajuan per sub-skill</p>
              <SubskillProgress criteria={ojt.criteria} />
            </div>
          )}
          {open &&
            ojt.days_detail.map((day) => (
              <div key={day.date} className="mt-2 rounded-2xl border border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-black text-slate-800">
                    {day.kind === 'FIRST' ? 'Hari pertama' : 'Hari terakhir'} · {fmtDate(day.date)}
                  </span>
                  <span className="text-[12.5px] font-black text-slate-800">{fmt(day.average)} dari 4</span>
                </div>
                {day.scores.map((s, index) => (
                  <React.Fragment key={s.subskill_id}>
                    {s.criterion_name !== day.scores[index - 1]?.criterion_name && (
                      <p className="pt-2 text-[11px] font-black uppercase tracking-wider text-[#5f1340]">{s.criterion_name}</p>
                    )}
                    <div className="flex items-center justify-between gap-3 pt-1.5 text-[12px] text-slate-600">
                      <span className="min-w-0">{s.name}</span>
                      <span className="font-black shrink-0">{s.score}</span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            ))}
        </>
      )}
    </Card>
  );
}

function MyOjtPanel() {
  const { rows, error } = useList('/academy/penilaian/ojt-saya', 'Gagal memuat nilai OJT');
  return (
    <>
      <ListState rows={rows} error={error} empty="Belum ada OJT untukmu" />
      {rows?.map((ojt) => (
        <MyOjtCard key={ojt.id} ojt={ojt} />
      ))}
    </>
  );
}

export default function Penilaian() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('mentor');

  useEffect(() => {
    setPageTitle('Penilaian');
    if (!localStorage.getItem('token')) navigate('/login');
  }, [navigate]);

  return (
    <AcademyShell title="Penilaian" subtitle="Mentor, pemantau OJT, dan nilai OJT-mu">
      <div className="bg-white rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-slate-100 p-1.5 grid grid-cols-3 gap-1.5" role="tablist">
        {TABS.map(([value, label]) => (
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

      {tab === 'mentor' && <MentorPanel />}
      {tab === 'pembimbing' && <PembimbingPanel />}
      {tab === 'mine' && <MyOjtPanel />}
    </AcademyShell>
  );
}
