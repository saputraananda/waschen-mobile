import React from 'react';

/** Pilihan nilai 1 sampai 4. value kosong (null) = belum dinilai. legend menampilkan arti skala di bawah tombol. */
export default function ScoreButtons({ value, onChange, label, legend = false }) {
  return (
    <div>
      <div className="grid grid-cols-4 gap-2" role="group" aria-label={label}>
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            aria-label={`Nilai ${n}`}
            onClick={() => onChange(n)}
            className={`rounded-xl border py-2.5 text-[14px] font-black transition active:scale-[0.97] ${
              value === n ? 'border-[#5f1340] bg-[#5f1340] text-white' : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {legend && (
        <div className="mt-1.5 flex justify-between text-[10.5px] font-semibold text-slate-400">
          <span>1 = Tidak baik</span>
          <span>4 = Sangat baik</span>
        </div>
      )}
    </div>
  );
}
