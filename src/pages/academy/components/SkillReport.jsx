import React, { useEffect, useState } from 'react';
import { ChevronDown, Star } from 'lucide-react';
import { Card, Message } from './AcademyShell.jsx';
import { api, errorMessage, fmt } from '../academyShared.js';

const STAR_LABEL = { 1: 'Basic', 2: 'Intermediate', 3: 'Proficient', 4: 'Master' };

function Stars({ count }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Bintang ${count} dari 4`}>
      {[1, 2, 3, 4].map((n) => (
        <Star key={n} className={`w-4 h-4 ${n <= count ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} aria-hidden="true" />
      ))}
    </span>
  );
}

export default function SkillReport() {
  const [skills, setSkills] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/academy/skills')
      .then((res) => setSkills(res.data?.data || []))
      .catch((err) => setError(errorMessage(err, 'Gagal memuat rapor skill matrix')));
  }, []);

  if (error) return <Message tone="error">{error}</Message>;
  if (!skills) return <Message>Memuat rapor skill matrix...</Message>;
  if (!skills.length) return <Message>Belum ada penilaian skill matrix</Message>;

  return skills.map((s) => {
    const open = openId === s.id;
    return (
      <Card key={s.id}>
        <button
          type="button"
          onClick={() => setOpenId(open ? null : s.id)}
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-3 text-left"
        >
          <span className="min-w-0">
            <span className="block text-[14px] font-black text-slate-800">{s.position_name}</span>
            <span className="flex items-center gap-2 mt-1">
              <Stars count={s.star} />
              <span className="text-[11.5px] font-bold text-slate-500">
                {STAR_LABEL[s.star]} · {fmt(s.score)} dari 4
              </span>
            </span>
          </span>
          <ChevronDown className={`w-5 h-5 text-slate-300 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>

        {open && (
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Nilai per kategori</h3>
              {s.categories.map((c) => (
                <div key={c.name} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-[12px] text-slate-600 font-semibold">
                    {c.name} ({fmt(c.weight)}%)
                  </span>
                  <span className="text-[13px] text-slate-800 font-black">{fmt(c.average)}</span>
                </div>
              ))}
            </div>

            {s.needs_improvement.length > 0 && (
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Perlu diperbaiki</h3>
                {s.needs_improvement.map((i) => (
                  <div key={i.name} className="flex items-center justify-between py-1.5">
                    <span className="text-[12px] text-slate-700 font-semibold">{i.name}</span>
                    <span className="text-[13px] text-rose-600 font-black">{i.score}</span>
                  </div>
                ))}
                <p className="text-[10.5px] text-slate-400">Nilai indikator paling rendah</p>
              </div>
            )}

            {s.note && (
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">Catatan manajemen</h3>
                <p className="text-[12.5px] text-slate-700">{s.note}</p>
              </div>
            )}
          </div>
        )}
      </Card>
    );
  });
}
