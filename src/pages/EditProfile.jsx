import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
});

api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

/* ── Helpers ── */
const titleCase = s => (!s ? '' : s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()));
const initials = name => (!name ? '?' : name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase());

/* ── Icons ── */
const IconBack = () => (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="12,15 7,10 12,5" />
    </svg>
);
const IconSave = () => (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15.5 17H4.5A1.5 1.5 0 013 15.5v-11A1.5 1.5 0 014.5 3H13l4 4v8.5A1.5 1.5 0 0115.5 17z" />
        <polyline points="7,3 7,8 13,8" /><polyline points="7,13 7,17 13,17 13,13" />
    </svg>
);
const IconUpload = () => (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16,10 10,4 4,10" /><line x1="10" y1="4" x2="10" y2="16" />
        <line x1="3" y1="17" x2="17" y2="17" />
    </svg>
);
const IconCheck = () => (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4,10 8,14 16,6" />
    </svg>
);
const IconEye = () => (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1.5 10s3.2-5 8.5-5 8.5 5 8.5 5-3.2 5-8.5 5-8.5-5-8.5-5z" />
        <circle cx="10" cy="10" r="2.4" />
    </svg>
);
const IconClose = () => (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="5" x2="15" y2="15" /><line x1="15" y1="5" x2="5" y2="15" />
    </svg>
);
const IconDownload = () => (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 3v10" /><polyline points="5,9 10,14 15,9" /><line x1="3" y1="17" x2="17" y2="17" />
    </svg>
);
const IconFileBig = () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
);

/* ── Document definitions ── */
const DOC_DEFS = [
    { key: 'ktp', label: 'KTP', accept: 'image/*,.pdf' },
    { key: 'kk', label: 'Kartu Keluarga (KK)', accept: 'image/*,.pdf' },
    { key: 'npwp', label: 'NPWP', accept: 'image/*,.pdf' },
    { key: 'bpjs', label: 'BPJS Kesehatan', accept: 'image/*,.pdf' },
    { key: 'bpjs_tk', label: 'BPJS Ketenagakerjaan', accept: 'image/*,.pdf' },
    { key: 'ijazah', label: 'Ijazah Terakhir', accept: 'image/*,.pdf' },
    { key: 'sertifikat', label: 'Sertifikat', accept: 'image/*,.pdf' },
    { key: 'rekomkerja', label: 'Surat Rekomendasi Kerja', accept: 'image/*,.pdf' },
];

/* ── Phone number validation: must start with 0, digits only ── */
const isValidPhone = v => !v || /^0\d{8,13}$/.test(v);

/* ── File type detection from URL ── */
const getFileType = url => {
    if (!url) return 'other';
    const clean = url.split('?')[0].toLowerCase();
    if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(clean)) return 'image';
    if (/\.pdf$/i.test(clean)) return 'pdf';
    return 'other';
};

/* ── Select options ── */
const GENDER_OPTS = [{ v: '', l: '— Pilih —' }, { v: 'L', l: 'Laki-laki' }, { v: 'P', l: 'Perempuan' }];
const MARITAL_OPTS = [
    { v: '', l: '— Pilih —' }, { v: 'Single', l: 'Belum Menikah' },
    { v: 'Married', l: 'Menikah' }, { v: 'Divorced', l: 'Cerai' }, { v: 'Widowed', l: 'Janda/Duda' },
];
const RELIGION_OPTS = [
    { v: '', l: '— Pilih —' }, { v: '1', l: 'Islam' }, { v: '2', l: 'Kristen' },
    { v: '3', l: 'Katolik' }, { v: '4', l: 'Hindu' }, { v: '5', l: 'Buddha' }, { v: '6', l: 'Konghucu' },
];

/* ══════════════════════════════════════════════════════════════════
   Document Preview Modal
══════════════════════════════════════════════════════════════════ */
function DocPreviewModal({ open, onClose, url, label }) {
    const [imgErr, setImgErr] = useState(false);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        if (!open) return;
        setImgErr(false);
        document.body.style.overflow = 'hidden';
        const onKey = e => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', onKey);
        };
    }, [open, onClose]);

    if (!open || !url) return null;

    const fileType = getFileType(url);
    const fileName = decodeURIComponent(url.split('/').pop().split('?')[0]);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const res = await fetch(url, { credentials: 'include' });
            const blob = await res.blob();
            const a = document.createElement('a');
            const objUrl = URL.createObjectURL(blob);
            a.href = objUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(objUrl);
        } catch {
            /* fallback: open in new tab if CORS blocks blob fetch */
            window.open(url, '_blank', 'noopener,noreferrer');
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-[3px]"
            style={{ animation: 'ikm-fade-in .15s ease-out' }}
            onClick={onClose}
        >
            <style>{`
                @keyframes ikm-fade-in { from { opacity:0 } to { opacity:1 } }
                @keyframes ikm-slide-up { from { transform:translateY(40px);opacity:0 } to { transform:translateY(0);opacity:1 } }
            `}</style>

            <div
                className="relative w-full max-w-[430px] bg-white rounded-t-[28px] sm:rounded-[24px] flex flex-col overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,.4)]"
                style={{ maxHeight: '92dvh', animation: 'ikm-slide-up .2s cubic-bezier(.32,.72,0,1)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="flex items-center gap-3 px-4 pt-4 pb-3 flex-shrink-0">
                    <div
                        className="w-10 h-10 rounded-[12px] flex-shrink-0 grid place-items-center text-white shadow-md shadow-[#5f1340]/20"
                        style={{ background: 'linear-gradient(135deg,#450d2e,#5f1340)' }}
                    >
                        {fileType === 'image' ? <IconEye /> : <IconFileBig />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-extrabold text-slate-800 leading-tight truncate">{label}</div>
                        <div className="text-[10.5px] text-slate-400 font-medium truncate mt-0.5">{fileName}</div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-[10px] bg-slate-100 hover:bg-slate-200 text-slate-500 grid place-items-center transition flex-shrink-0"
                        aria-label="Tutup"
                    >
                        <IconClose />
                    </button>
                </div>

                {/* ── Divider ── */}
                <div className="h-px bg-slate-100 flex-shrink-0 mx-4" />

                {/* ── Preview body ── */}
                <div className="flex-1 overflow-auto bg-[#F8F9FB] grid place-items-center p-4" style={{ minHeight: 180 }}>
                    {fileType === 'image' && !imgErr && (
                        <img
                            src={url}
                            alt={label}
                            onError={() => setImgErr(true)}
                            className="max-w-full object-contain rounded-[14px] shadow-[0_4px_24px_rgba(0,0,0,.10)]"
                            style={{ maxHeight: '55dvh' }}
                        />
                    )}
                    {fileType === 'pdf' && (
                        <iframe
                            src={url}
                            title={label}
                            className="w-full rounded-[12px] bg-white border border-slate-200"
                            style={{ height: '55dvh' }}
                        />
                    )}
                    {(fileType === 'other' || (fileType === 'image' && imgErr)) && (
                        <div className="flex flex-col items-center gap-3 py-10 px-6 text-center">
                            <div className="w-[68px] h-[68px] rounded-[20px] bg-blue-50 text-blue-400 grid place-items-center shadow-[inset_0_0_0_1px_rgba(59,130,246,.15)]">
                                <IconFileBig />
                            </div>
                            <div>
                                <div className="text-[13px] font-extrabold text-slate-700">Pratinjau tidak tersedia</div>
                                <div className="text-[11.5px] text-slate-400 font-medium mt-1 max-w-[240px] leading-relaxed">
                                    Format file ini tidak dapat ditampilkan. Silakan unduh untuk membukanya.
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer actions ── */}
                <div className="flex items-center gap-2.5 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] flex-shrink-0 bg-white border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 h-[46px] rounded-[13px] border border-slate-200 bg-slate-50 text-slate-700 text-[13px] font-extrabold flex items-center justify-center gap-1.5 transition hover:bg-slate-100 active:scale-[.97]"
                    >
                        <IconClose /> Tutup
                    </button>
                    <button
                        type="button"
                        onClick={handleDownload}
                        disabled={downloading}
                        className="flex-[1.6] h-[46px] rounded-[13px] text-white text-[13px] font-extrabold flex items-center justify-center gap-1.5 transition hover:opacity-90 active:scale-[.97] disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg,#450d2e,#5f1340)' }}
                    >
                        {downloading
                            ? <><span className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> Mengunduh…</>
                            : <><IconDownload /> Unduh File</>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ── Section wrapper ── */
function Section({ title, children }) {
    return (
        <div className="bg-white rounded-[20px] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,.04),0_0_0_1px_rgba(0,0,0,.03)]">
            <div className="px-4 pt-3 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-[.08em]">{title}</div>
            <div className="flex flex-col">{children}</div>
        </div>
    );
}

/* ── Text/Date/Select field row ── */
function FieldRow({ label, name, type = 'text', value, onChange, options, placeholder, error }) {
    return (
        <div className="px-4 py-2.5 border-b border-slate-50 last:border-b-0">
            <div className="text-[10.5px] font-semibold text-slate-400 mb-1">{label}</div>
            {options ? (
                <select
                    name={name}
                    value={value || ''}
                    onChange={e => onChange(name, e.target.value)}
                    className={`w-full text-[13px] font-semibold text-slate-900 bg-slate-50 border rounded-[10px] px-3 h-[38px] focus:outline-none focus:ring-2 transition ${error ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-[#5f1340]/30 focus:border-[#5f1340]'}`}
                >
                    {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
            ) : (
                <input
                    type={type}
                    name={name}
                    value={value || ''}
                    onChange={e => onChange(name, e.target.value)}
                    placeholder={placeholder || ''}
                    className={`w-full text-[13px] font-semibold text-slate-900 bg-slate-50 border rounded-[10px] px-3 h-[38px] focus:outline-none focus:ring-2 transition placeholder:text-slate-300 ${error ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-[#5f1340]/30 focus:border-[#5f1340]'}`}
                />
            )}
            {error && <div className="text-[10.5px] text-red-500 font-semibold mt-1">{error}</div>}
        </div>
    );
}

/* ── Document upload row ── */
function DocRow({ docKey, label, accept, currentUrl, onUpload, onPreview, uploading }) {
    const fileRef = useRef(null);
    const isLoading = uploading === docKey;
    return (
        <div className="px-4 py-3 border-b border-slate-50 last:border-b-0">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <div className="text-[12.5px] font-semibold text-slate-700">{label}</div>
                    {currentUrl
                        ? <div className="text-[10.5px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-0.5"><IconCheck /> Sudah diunggah</div>
                        : <div className="text-[10.5px] text-slate-400 font-medium mt-0.5">Belum diunggah</div>
                    }
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {currentUrl && (
                        <button
                            type="button"
                            onClick={() => onPreview(currentUrl, label)}
                            className="h-[32px] px-3 rounded-[9px] border border-slate-200 bg-slate-50 text-slate-600 text-[11px] font-bold flex items-center gap-1 transition hover:bg-slate-100"
                        >
                            <IconEye /> Lihat
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={isLoading}
                        className="h-[32px] px-3 rounded-[9px] border border-[#5f1340]/25 bg-[#5f1340]/10 text-[#5f1340] text-[11px] font-bold flex items-center gap-1 transition hover:bg-[#5f1340]/20 disabled:opacity-50"
                    >
                        {isLoading
                            ? <><span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />Unggah…</>
                            : <><IconUpload /> Unggah</>
                        }
                    </button>
                    <input
                        ref={fileRef} type="file" accept={accept} className="hidden"
                        onChange={e => { if (e.target.files?.[0]) onUpload(docKey, e.target.files[0]); e.target.value = ''; }}
                    />
                </div>
            </div>
        </div>
    );
}

/* ════════════════════════════════════════════════════════════════ */
export default function ProfileEditPage() {
    const [detail, setDetail] = useState(null);
    const [form, setForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(null);
    const [toast, setToast] = useState(null);  // { text, ok }
    const [banks, setBanks] = useState([]);
    const [educationLevels, setEducationLevels] = useState([]);
    const [phoneErrors, setPhoneErrors] = useState({});
    const [preview, setPreview] = useState(null); // { url, label }
    const profileFileRef = useRef(null);

    useEffect(() => { document.title = 'Edit Profil | Waschen Mobile'; }, []);

    useEffect(() => {
        api.get('/employee/banks').then(r => setBanks(r.data.data || [])).catch(() => {});
    }, []);

    useEffect(() => {
        api.get('/employee/education-levels').then(r => setEducationLevels(r.data.data || [])).catch(() => {});
    }, []);

    useEffect(() => {
        api.get('/employee/profile-detail').then(r => {
            const d = r.data.data || {};
            setDetail(d);
            setForm({
                gender: d.gender || '',
                birth_place: d.birth_place || '',
                birth_date: d.birth_date ? d.birth_date.slice(0, 10) : '',
                address: d.address || '',
                ktp_number: d.ktp_number || '',
                phone_number: d.phone_number || '',
                private_email: d.private_email || '',
                mother_name: d.mother_name || '',
                emergency_contact: d.emergency_contact || '',
                join_date: d.join_date ? d.join_date.slice(0, 10) : '',
                contract_end_date: d.contract_end_date ? d.contract_end_date.slice(0, 10) : '',
                education_level_id: d.education_level_id ? String(d.education_level_id) : '',
                school_name: d.school_name || '',
                major_name: d.major_name || '',
                religion_id: d.religion_id ? String(d.religion_id) : '',
                marital_status: d.marital_status || '',
                bank_id: d.bank_id ? String(d.bank_id) : '',
                bank_account_number: d.bank_account_number || '',
            });
        }).catch(() => {
            const stored = localStorage.getItem('user');
            if (stored) {
                try {
                    const u = JSON.parse(stored);
                    setDetail({
                        employee_id: u.employee_id || 31,
                        full_name: u.fullName || u.full_name || 'Ananda Prathama Saputra',
                        employee_code: u.employeeCode || u.employee_code || 'WAI2026029',
                        phone_number: u.phone || u.phone_number || '',
                        private_email: u.email || u.private_email || '',
                        join_date: u.join_date || u.join_date_iso || '',
                    });
                    setForm(prev => ({
                        ...prev,
                        phone_number: u.phone || u.phone_number || '',
                        private_email: u.email || u.private_email || '',
                        join_date: u.join_date ? u.join_date.slice(0, 10) : '',
                    }));
                } catch (e) {}
            }
        });
    }, []);

    const handleChange = useCallback((name, value) => {
        setForm(prev => ({ ...prev, [name]: value }));
        if (name === 'phone_number' || name === 'emergency_contact') {
            setPhoneErrors(prev => ({
                ...prev,
                [name]: value && !isValidPhone(value) ? 'Gunakan format lokal, cth. 087770597000' : null,
            }));
        }
    }, []);

    const showToast = (text, ok = true) => {
        setToast({ text, ok });
        setTimeout(() => setToast(null), 3000);
    };

    const handleSave = async () => {
        const phoneFields = ['phone_number', 'emergency_contact'];
        for (const f of phoneFields) {
            if (form[f] && !isValidPhone(form[f])) {
                showToast('Perbaiki format nomor telepon terlebih dahulu.', false);
                return;
            }
        }
        setSaving(true);
        try {
            await api.put('/employee/update-profile', form);
            showToast('Profil berhasil disimpan.');
        } catch (e) {
            showToast(e.response?.data?.message || 'Gagal menyimpan.', false);
        }
        setSaving(false);
    };

    const handleUpload = async (docKey, file) => {
        setUploading(docKey);
        let objectUrl = null;
        if (docKey === 'profile') {
            objectUrl = URL.createObjectURL(file);
            setDetail(prev => ({ ...prev, profile_url: objectUrl }));
        }
        try {
            const fd = new FormData();
            fd.append('doc', file);
            await api.post(`/employee/upload-doc/${docKey}`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const r2 = await api.get('/employee/profile-detail');
            setDetail(r2.data.data || {});
            showToast(`${file.name} berhasil diunggah.`);
        } catch (e) {
            if (objectUrl) setDetail(prev => ({ ...prev, profile_url: null }));
            showToast(e.response?.data?.message || 'Gagal mengunggah file.', false);
        } finally {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        }
        setUploading(null);
    };

    const bankOpts = [
        { v: '', l: '— Pilih Bank —' },
        ...banks.map(b => ({ v: String(b.bank_id), l: b.bank_name })),
    ];

    const educationOpts = [
        { v: '', l: '— Pilih Pendidikan —' },
        ...educationLevels.map(e => ({ v: String(e.education_level_id), l: e.education_level_name })),
    ];

    const name = titleCase(detail?.full_name || '');

    return (
        <div className="min-h-[100dvh] bg-slate-100 flex justify-center">
            <div className="w-full max-w-[430px] min-h-[100dvh] bg-slate-50 flex flex-col shadow-[0_0_0_1px_rgba(0,0,0,.04),0_8px_48px_rgba(0,0,0,.08)] relative overflow-hidden">

                {/* ── Hero ── */}
                <div className="relative overflow-hidden rounded-b-[28px] flex-shrink-0 pb-[22px] bg-gradient-to-br from-[#210415] via-[#450d2e] to-[#5f1340] text-white shadow-xl shadow-[#5f1340]/20">
                    <div className="absolute -top-[70px] -right-[40px] w-[200px] h-[200px] rounded-full"
                        style={{ background: 'radial-gradient(circle, rgba(236,72,153,.25) 0%, transparent 70%)' }} />
                    <div className="absolute inset-0 pointer-events-none opacity-[.04]"
                        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

                    {/* Top bar */}
                    <div className="relative z-[1] flex items-center justify-between px-[18px] pt-[14px]">
                        <Link to="/profile"
                            className="w-9 h-9 rounded-[11px] bg-white/10 border border-white/12 text-white grid place-items-center flex-shrink-0 transition hover:bg-white/20 no-underline backdrop-blur-xl">
                            <IconBack />
                        </Link>
                    </div>

                    {/* Avatar */}
                    <div className="relative z-[1] flex flex-col items-center mt-3 gap-1.5">
                        <button
                            type="button"
                            onClick={() => profileFileRef.current?.click()}
                            className="relative w-16 h-16 rounded-[18px] bg-white/15 border-[2.5px] border-white/25 text-white text-[20px] font-extrabold grid place-items-center shadow-[0_8px_24px_rgba(0,0,0,.2)] backdrop-blur-[8px] overflow-hidden group cursor-pointer"
                            title="Ganti foto profil"
                        >
                            {detail?.profile_url
                                ? <img src={detail.profile_url} alt="foto" className="w-full h-full object-cover" />
                                : <span>{initials(name)}</span>
                            }
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                                    <circle cx="12" cy="13" r="4" />
                                </svg>
                            </div>
                            {uploading === 'profile' && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <span className="w-5 h-5 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                                </div>
                            )}
                        </button>
                        <input
                            ref={profileFileRef} type="file" accept="image/*" className="hidden"
                            onChange={e => { if (e.target.files?.[0]) handleUpload('profile', e.target.files[0]); e.target.value = ''; }}
                        />
                        <div className="text-[11px] text-white/50 font-medium">Ketuk untuk ganti foto</div>
                        <div className="text-[13px] font-extrabold text-white">{name || '—'}</div>
                        {detail?.employee_code && (
                            <div className="text-[10.5px] text-white/45 font-medium">{detail.employee_code}</div>
                        )}
                    </div>
                </div>

                {/* ── Form ── */}
                <div className="flex-1 overflow-y-auto px-3 sm:px-[14px] pt-3 pb-[calc(100px+env(safe-area-inset-bottom))] flex flex-col gap-3">

                    {/* Data Pribadi */}
                    <Section title="Data Pribadi">
                        <FieldRow label="Jenis Kelamin" name="gender" value={form.gender} onChange={handleChange} options={GENDER_OPTS} />
                        <FieldRow label="Tempat Lahir" name="birth_place" value={form.birth_place} onChange={handleChange} placeholder="cth. Jakarta" />
                        <FieldRow label="Tanggal Lahir" name="birth_date" value={form.birth_date} onChange={handleChange} type="date" />
                        <FieldRow label="No. HP" name="phone_number" value={form.phone_number} onChange={handleChange} placeholder="cth. 087770597000" error={phoneErrors.phone_number} />
                        <FieldRow label="Email Pribadi" name="private_email" value={form.private_email} onChange={handleChange} placeholder="cth. nama@email.com" type="email" />
                        <FieldRow label="No. KTP" name="ktp_number" value={form.ktp_number} onChange={handleChange} placeholder="16 digit NIK" />
                        <FieldRow label="Alamat" name="address" value={form.address} onChange={handleChange} placeholder="Alamat lengkap" />
                        <FieldRow label="Status Pernikahan" name="marital_status" value={form.marital_status} onChange={handleChange} options={MARITAL_OPTS} />
                        <FieldRow label="Agama" name="religion_id" value={form.religion_id} onChange={handleChange} options={RELIGION_OPTS} />
                        <FieldRow label="Nama Ibu Kandung" name="mother_name" value={form.mother_name} onChange={handleChange} placeholder="Nama ibu kandung" />
                        <FieldRow label="Nomor Darurat (Yang Dapat Dihubungi)" name="emergency_contact" value={form.emergency_contact} onChange={handleChange} placeholder="cth. 087770597000" error={phoneErrors.emergency_contact} />
                    </Section>

                    {/* Data Pekerjaan */}
                    <Section title="Data Pekerjaan">
                        <FieldRow label="Tanggal Bergabung" name="join_date" value={form.join_date} onChange={handleChange} type="date" />
                        <FieldRow label="Tanggal Kontrak Berakhir" name="contract_end_date" value={form.contract_end_date} onChange={handleChange} type="date" />
                        <FieldRow label="Pendidikan Terakhir" name="education_level_id" value={form.education_level_id} onChange={handleChange} options={educationOpts} />
                        <FieldRow label="Nama Instansi" name="school_name" value={form.school_name} onChange={handleChange} placeholder="Nama sekolah/universitas" />
                        <FieldRow label="Jurusan (Opsional)" name="major_name" value={form.major_name} onChange={handleChange} placeholder="Nama jurusan" />
                    </Section>

                    {/* Rekening Bank */}
                    <Section title="Rekening Bank">
                        <FieldRow label="Nama Bank" name="bank_id" value={form.bank_id} onChange={handleChange} options={bankOpts} />
                        <FieldRow label="No. Rekening" name="bank_account_number" value={form.bank_account_number} onChange={handleChange} placeholder="Nomor rekening" />
                    </Section>

                    {/* Dokumen */}
                    <Section title="Dokumen Pendukung">
                        {DOC_DEFS.map(d => (
                            <DocRow
                                key={d.key}
                                docKey={d.key}
                                label={d.label}
                                accept={d.accept}
                                currentUrl={detail?.[`${d.key}_url`] || null}
                                onUpload={handleUpload}
                                onPreview={(url, label) => setPreview({ url, label })}
                                uploading={uploading}
                            />
                        ))}
                    </Section>

                    <div className="text-[11px] text-slate-400 text-center font-medium">
                        Anda dapat mengisi secara berkala. &bull; Waschen Mobile v1.0
                    </div>
                </div>

                {/* ── Toast ── */}
                {toast && (
                    <div className={`fixed bottom-[90px] left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-[14px] shadow-[0_8px_32px_rgba(0,0,0,.18)] text-[12.5px] font-bold text-white transition-all ${toast.ok ? 'bg-emerald-600' : 'bg-red-500'}`}>
                        {toast.text}
                    </div>
                )}

                {/* ── Bottom save button ── */}
                <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center pointer-events-none">
                    <div className="pointer-events-auto w-full max-w-[430px] bg-white/92 backdrop-blur-[20px] border-t border-slate-200/60 px-5 pt-1.5 shadow-[0_-4px_24px_rgba(0,0,0,.06)]"
                        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full h-[48px] rounded-[14px] text-white text-[13.5px] font-extrabold flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-50 shadow-lg shadow-[#5f1340]/25"
                            style={{ background: 'linear-gradient(135deg, #450d2e, #5f1340)' }}
                        >
                            {saving
                                ? <><span className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" /> Menyimpan…</>
                                : <><IconSave /> Simpan Perubahan</>
                            }
                        </button>
                    </div>
                </div>

            </div>

            {/* ── Document Preview Modal ── */}
            <DocPreviewModal
                open={!!preview}
                url={preview?.url}
                label={preview?.label}
                onClose={() => setPreview(null)}
            />
        </div>
    );
}
