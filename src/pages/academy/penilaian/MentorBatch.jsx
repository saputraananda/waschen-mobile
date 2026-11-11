import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { setPageTitle } from '../../../utils/pageTitle.js';
import AcademyShell, { Card, Message } from '../components/AcademyShell.jsx';
import { RESULT_META, api, errorMessage, fmtDatetime } from '../academyShared.js';

export default function MentorBatch() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setPageTitle('Peserta');
    api
      .get(`/academy/penilaian/mentor/batch/${batchId}`)
      .then((res) => setData(res.data?.data))
      .catch((err) => {
        if (err?.response?.status === 401) return navigate('/login');
        setError(errorMessage(err, 'Gagal memuat daftar peserta'));
      });
  }, [batchId, navigate]);

  return (
    <AcademyShell title="Peserta" subtitle={data?.training_name ?? ''} backTo="/academy/penilaian">
      {!data && !error && <Message>Memuat...</Message>}
      {error && <Message tone="error">{error}</Message>}
      {data && !data.started && <Message>Penilaian dibuka {fmtDatetime(data.start_at)}</Message>}
      {data && !data.participants.length && <Message>Belum ada peserta</Message>}
      {data?.participants.map((p) => {
        const open = data.started && !p.absent;
        const badge = p.absent
          ? { label: 'Tidak hadir', cls: 'bg-slate-50 text-slate-500 border-slate-200' }
          : p.scored
            ? { label: 'Sudah dinilai', cls: RESULT_META.LULUS.cls }
            : { label: 'Belum dinilai', cls: RESULT_META.LULUS_PERBAIKAN.cls };
        return (
          <button
            key={p.id}
            type="button"
            disabled={!open}
            onClick={() => navigate(`/academy/penilaian/mentor/${p.id}`)}
            className={`w-full text-left ${open ? '' : 'opacity-50'}`}
          >
            <Card className={open ? 'active:scale-[0.98] transition-transform' : ''}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-[14px] font-black text-slate-800 leading-tight">{p.full_name}</h2>
                  <span className={`inline-flex mt-2 rounded-full border px-2.5 py-1 text-[11px] font-black ${badge.cls}`}>{badge.label}</span>
                </div>
                {open && <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" aria-hidden="true" />}
              </div>
            </Card>
          </button>
        );
      })}
    </AcademyShell>
  );
}
