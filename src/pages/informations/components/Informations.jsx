import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Sun,
  CreditCard,
  Timer,
  RefreshCw,
  Truck,
  UserRound,
  ChevronDown,
  Lightbulb,
  MapPin,
  Camera,
  ScanLine,
  CheckCircle2
} from 'lucide-react';
import formatName from '../../../utils/FormatName.js';
import getDisplayRole from '../../../utils/getDisplayRole.js';
import { setPageTitle } from '../../../utils/pageTitle.js';

const SECTIONS = [
  {
    id: 'awal',
    title: 'Mulai Pakai Aplikasi',
    icon: BookOpen,
    color: 'text-[#5f1340]',
    bg: 'bg-[#5f1340]/10',
    steps: [
      'Login memakai akun karyawan Waschen yang sudah didaftarkan.',
      'Di beranda, nama dan jabatan Anda akan tampil di bagian atas.',
      'Pilih menu sesuai pekerjaan hari ini (Absensi, Progress, Delivery, dan lain-lain).',
      'Kalau bingung, buka lagi halaman petunjuk ini lewat tombol (i) di beranda.'
    ]
  },
  {
    id: 'absensi',
    title: 'Absensi',
    icon: Calendar,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    steps: [
      'Buka menu Absensi untuk absen masuk dan pulang.',
      'Pastikan GPS aktif dan Anda berada di sekitar outlet.',
      'Ambil foto selfie sesuai instruksi di layar, lalu kirim.',
      'Cek status absen hari ini di halaman yang sama (sudah masuk / sudah pulang).'
    ]
  },
  {
    id: 'izin',
    title: 'Izin / Libur',
    icon: Sun,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    steps: [
      'Pakai menu ini jika Anda sakit, izin, atau cuti.',
      'Isi jenis pengajuan, tanggal, dan alasan dengan jelas.',
      'Unggah bukti bila diminta (misalnya surat dokter).',
      'Tunggu persetujuan atasan. Status bisa dicek di riwayat pengajuan.'
    ]
  },
  {
    id: 'kasbon',
    title: 'Kasbon & Pinjaman',
    icon: CreditCard,
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    steps: [
      'Buka menu Kasbon & Pinjaman untuk mengajukan dana.',
      'Pilih jenis: Kasbon (cepat) atau Pinjaman (bisa dicicil).',
      'Isi jumlah dan tujuan pengajuan dengan jujur.',
      'Kirim, lalu pantau status: pengajuan → diproses → disetujui/ditolak.'
    ]
  },
  {
    id: 'lembur',
    title: 'Lembur',
    icon: Timer,
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    steps: [
      'Jika kerja di luar jam normal, buka menu Lembur.',
      'Mulai sesi lembur saat mulai kerja tambahan.',
      'Tutup sesi lembur setelah selesai — jangan lupa ditutup.',
      'Jika lewat tengah malam belum ditutup, menu lain bisa terkunci sampai lembur ditutup.'
    ]
  },
  {
    id: 'progress',
    title: 'Update Progress (QC)',
    icon: RefreshCw,
    color: 'text-[#5f1340]',
    bg: 'bg-[#5f1340]/10',
    steps: [
      'Menu ini untuk mengecek dan memajukan status cucian (antrian → cuci → setrika → packing).',
      'Pilih tab sesuai tugas Anda (Frontliner, Washing, Ironing, atau Packing).',
      'Bisa cari nota dengan ketik nomor/nama, atau scan barcode/QR nota.',
      'Klik item → isi QC (foto bila perlu) → pilih lanjut / hold / kembalikan sesuai kondisi.',
      'Nota delivery di tahap antrian punya tanda "Pickup Delivery" — frontliner juga boleh QC jika tim delivery berhalangan.'
    ]
  },
  {
    id: 'delivery',
    title: 'Delivery (khusus Delivery Staff)',
    icon: Truck,
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    steps: [
      'Menu Delivery hanya muncul jika jabatan Anda Delivery Staff.',
      'Tab Pickup: nota antar yang baru masuk (belum diproses). Lakukan QC seperti frontliner.',
      'Setelah cucian selesai packing dan berstatus Siap Diantar + sudah Lunas, nota masuk Tab Delivery.',
      'Di Tab Delivery, lakukan QC final. Aman atau temuan dengan catatan lanjut → status jadi Sedang Diantar (nota tetap di tab). Temuan fatal → dikembalikan ke packing.',
      'Item Sedang Diantar bisa diketuk lagi untuk Serah Terima (tampilan seperti QC). Lampirkan foto bukti sudah diantar, lalu Tandai Selesai.',
      'Setelah Selesai, nota hilang dari Tab Delivery.',
      'Alamat lengkap, landmark, dan nomor HP customer ditampilkan supaya pengantaran lebih mudah.',
      'Gunakan kolom cari atau scan barcode bila ingin menemukan nota lebih cepat.'
    ]
  },
  {
    id: 'profil',
    title: 'Profil',
    icon: UserRound,
    color: 'text-slate-700',
    bg: 'bg-slate-100',
    steps: [
      'Ketuk foto/inisial di beranda untuk membuka Profil.',
      'Di sini Anda bisa melihat data diri dan outlet yang ditetapkan.',
      'Edit profil jika ada data yang perlu diperbarui.',
      'Logout hanya jika diminta atau saat ganti perangkat/akun.'
    ]
  }
];

const TIPS = [
  {
    icon: MapPin,
    title: 'GPS & lokasi',
    text: 'Absensi butuh lokasi akurat. Kalau gagal, cek izin lokasi HP lalu coba lagi.'
  },
  {
    icon: Camera,
    title: 'Foto yang jelas',
    text: 'Untuk absen dan QC, pastikan foto terang dan tidak buram.'
  },
  {
    icon: ScanLine,
    title: 'Scan nota',
    text: 'Lebih cepat scan QR/barcode nota daripada mengetik nomor manual.'
  },
  {
    icon: CheckCircle2,
    title: 'Kerjakan sesuai tahap',
    text: 'Jangan loncat tahap. Ikuti status yang tampil di aplikasi agar alur cucian tetap rapi.'
  }
];

function SectionCard({ section, open, onToggle }) {
  const Icon = section.icon;
  return (
    <div className="bg-white rounded-[20px] border border-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.03)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3.5 flex items-center gap-3 active:bg-slate-50 transition"
      >
        <span className={`w-10 h-10 rounded-2xl ${section.bg} ${section.color} grid place-items-center flex-shrink-0`}>
          <Icon className="w-5 h-5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="text-[13.5px] font-black text-slate-800 block leading-tight">{section.title}</span>
          <span className="text-[10.5px] text-slate-400 font-medium">
            {open ? 'Ketuk untuk tutup' : 'Ketuk untuk lihat langkah'}
          </span>
        </span>
        <ChevronDown className={`w-4.5 h-4.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4">
          <ol className="space-y-2.5">
            {section.steps.map((step, idx) => (
              <li key={idx} className="flex gap-2.5 items-start">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-[#5f1340] text-white text-[10px] font-black grid place-items-center flex-shrink-0">
                  {idx + 1}
                </span>
                <p className="text-[12.5px] text-slate-600 font-medium leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export default function Informations() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState({ fullName: 'Karyawan Waschen' });
  const [openId, setOpenId] = useState('awal');

  useEffect(() => {
    setPageTitle('Petunjuk Penggunaan');
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        setCurrentUser(JSON.parse(stored));
      } catch (_) { /* ignore */ }
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center items-start antialiased font-sans">
      <div className="w-full max-w-[430px] min-h-screen bg-slate-50 shadow-2xl flex flex-col relative pb-[max(16px,env(safe-area-inset-bottom))]">

        <div className="bg-gradient-to-br from-[#210415] via-[#450d2e] to-[#5f1340] pt-safe-header pb-12 px-5 relative overflow-hidden flex-shrink-0 text-white rounded-b-[32px] shadow-xl shadow-[#5f1340]/25">
          <div className="absolute inset-0 opacity-[0.07] pointer-events-none z-0 overflow-hidden select-none">
            <BookOpen className="absolute -top-2 left-2 w-20 h-20 text-white -rotate-12" />
            <Lightbulb className="absolute top-3 right-10 w-16 h-16 text-white rotate-12" />
          </div>
          <div className="absolute top-0 right-0 w-[220px] h-[220px] bg-gradient-to-br from-pink-500/20 to-transparent rounded-full blur-2xl pointer-events-none z-0" />

          <div className="flex items-center gap-3 relative z-10 mb-5 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center flex-shrink-0 active:scale-95 transition-all"
              aria-label="Kembali"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-white leading-snug truncate tracking-tight">
                {formatName(currentUser.fullName || currentUser.full_name)}
              </h2>
              <span className="text-[11px] text-pink-200/80 font-medium truncate block">
                {[getDisplayRole(currentUser), currentUser.employeeCode].filter(Boolean).join(' · ')}
              </span>
            </div>
          </div>

          <div className="relative z-10 text-center py-2">
            <span className="text-[11px] text-pink-200/80 font-bold uppercase tracking-wider block">Bantuan Aplikasi</span>
            <span className="text-[22px] font-black text-white tracking-tight leading-tight block mt-0.5">
              Petunjuk Penggunaan
            </span>
            <p className="text-[11.5px] text-pink-100/75 font-medium mt-2 leading-relaxed max-w-[300px] mx-auto">
              Panduan singkat cara memakai Waschen Mobile, ditulis dengan bahasa yang mudah dipahami.
            </p>
          </div>
        </div>

        <div className="px-4 -mt-6 relative z-20 flex flex-col gap-3 pb-6">
          <div className="bg-white rounded-[20px] border border-slate-100 shadow-[0_8px_24px_rgba(95,19,64,0.08)] px-4 py-3.5">
            <p className="text-[12px] text-slate-600 font-medium leading-relaxed">
              Ketuk setiap judul di bawah untuk membuka langkah-langkahnya. Mulai dari
              {' '}<span className="font-extrabold text-[#5f1340]">Mulai Pakai Aplikasi</span> jika Anda baru pertama kali memakai aplikasi ini.
            </p>
          </div>

          {SECTIONS.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              open={openId === section.id}
              onToggle={() => setOpenId((prev) => (prev === section.id ? null : section.id))}
            />
          ))}

          <div className="mt-2">
            <div className="flex items-center gap-2 px-1 mb-2.5">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Tips singkat</h3>
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              {TIPS.map((tip) => {
                const Icon = tip.icon;
                return (
                  <div
                    key={tip.title}
                    className="bg-white rounded-[18px] border border-slate-100 px-3.5 py-3 flex gap-3 items-start"
                  >
                    <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 grid place-items-center flex-shrink-0">
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-black text-slate-800 leading-tight">{tip.title}</p>
                      <p className="text-[11.5px] text-slate-500 font-medium leading-relaxed mt-0.5">{tip.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-center text-[10.5px] text-slate-400 font-medium px-4 pt-2 pb-1 leading-relaxed">
            Masih ada yang kurang jelas? Tanyakan ke Leader / SPV outlet Anda.
          </p>
        </div>
      </div>
    </div>
  );
}
