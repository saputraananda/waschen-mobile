import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import ConfirmModal from '../components/ConfirmModal';
import { User, Mail, Phone, MapPin, Edit3, LogOut, ChevronRight, CreditCard, Home, Building2 } from 'lucide-react';

export default function Profile() {
    const navigate = useNavigate();

    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [currentUser, setCurrentUser] = useState({
        employee_id: 31,
        fullName: 'Ananda Prathama Saputra',
        employee_code: 'WAI2026029',
        company_id: 2,
        is_leader: 1,
        role: 'admin',
        username: 'putraalora',
        email: 'saputraananda@waschenalora.com',
        phone: '+62 812-3456-7890',
        address: 'Jl. Terusan Hang Lekir I No. 25, Kebayoran Baru, Jakarta Selatan',
        assignedOutletName: 'Waschen Head Office',
        join_date: null,
    });

    useEffect(() => {
        document.title = 'Profil Saya - Waschen Mobile';
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        const storedUser = localStorage.getItem('user');
        let email = '';
        let empId = 0;

        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                email = parsed.email || parsed.user_email || '';
                empId = parsed.employeeId || parsed.employee_id || 0;
                setCurrentUser(prev => ({
                    ...prev,
                    ...parsed,
                    join_date: parsed.join_date || parsed.join_date_iso || parsed.joinDate || prev.join_date
                }));
            } catch (e) {
                console.error('Failed to parse stored user:', e);
            }
        }

        // Fetch exact employee profile & join_date directly from database mst_employee mainpool
        axios.get(`/api/auth/profile?email=${encodeURIComponent(email)}&employeeId=${empId}`)
            .then(res => {
                if (res.data?.success && res.data?.data) {
                    const dbData = res.data.data;
                    setCurrentUser(prev => ({
                        ...prev,
                        ...dbData,
                        fullName: dbData.full_name || prev.fullName,
                        join_date: dbData.join_date || prev.join_date,
                        phone: dbData.phone_number || prev.phone
                    }));
                    if (storedUser) {
                        try {
                            const parsed = JSON.parse(storedUser);
                            parsed.join_date = dbData.join_date;
                            parsed.joinDate = dbData.join_date;
                            localStorage.setItem('user', JSON.stringify(parsed));
                        } catch (e) {}
                    }
                }
            })
            .catch(() => {});
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const getInitials = (name) => {
        if (!name) return 'WS';
        const parts = String(name).trim().split(' ').filter(Boolean);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return String(name).slice(0, 2).toUpperCase() || 'WS';
    };

    // Role / Jabatan display logic: company_id = 1 -> Management
    const getRoleDisplay = (user) => {
        const cid = user?.company_id !== undefined && user?.company_id !== null ? String(user.company_id) : '';
        const empId = user?.employee_id !== undefined && user?.employee_id !== null ? String(user.employee_id) : '';
        const nameUpper = String(user?.fullName || user?.full_name || '').toUpperCase();

        // Rule: Employees with company_id = 1 or Management employees (e.g. Rida Nurul Anjani, emp_id = 25) -> Management
        if (cid === '1' || empId === '25' || nameUpper.includes('RIDA')) {
            return 'Management';
        }

        if (user?.role === 'Management' || user?.role_name === 'Management') {
            return 'Management';
        }

        const roleName = user?.roleName || user?.role_name || user?.role || 'Frontliner';
        const isLeader = user?.is_leader === 1 || user?.is_leader === true || user?.isLeader === 1 || user?.is_leader === '1';

        if (isLeader) {
            return `Leader | ${roleName}`;
        }
        return `Staff | ${roleName}`;
    };

    // Indonesian Date Formatter for join_date
    const formatIndonesianDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    // Dynamic Masa Kerja Calculation (Current Date - join_date)
    const getMasaKerja = (dateStr) => {
        if (!dateStr) return '-';
        const start = new Date(dateStr);
        if (isNaN(start.getTime())) return '-';
        const now = new Date();
        
        let years = now.getFullYear() - start.getFullYear();
        let months = now.getMonth() - start.getMonth();
        let days = now.getDate() - start.getDate();
        
        if (days < 0) {
            months--;
        }
        if (months < 0) {
            years--;
            months += 12;
        }
        
        if (years <= 0 && months <= 0) return 'Kurang dari 1 Bulan';
        if (years <= 0) return `${months} Bulan`;
        if (months === 0) return `${years} Tahun`;
        return `${years} Tahun ${months} Bulan`;
    };

    return (
        <div className="min-h-screen bg-slate-100 flex justify-center items-start antialiased font-sans select-none">
            <div className="w-full max-w-[430px] min-h-screen bg-slate-50 shadow-2xl flex flex-col relative pb-[90px]">

                {/* ===== HERO HEADER WITH PROFILE IDENTITY ===== */}
                <div className="bg-gradient-to-br from-[#210415] via-[#450d2e] to-[#5f1340] pt-7 pb-14 px-5 relative overflow-hidden flex-shrink-0 text-white rounded-b-[36px] shadow-xl shadow-[#5f1340]/25">
                    {/* Wavy layers */}
                    <div className="absolute top-0 left-[-20%] right-[-20%] h-[75%] bg-[#360823]/90 rounded-b-[50%] transform scale-x-110 origin-top pointer-events-none z-0" />
                    <div className="absolute top-0 left-[-10%] right-[-10%] h-[58%] bg-gradient-to-br from-[#4d0f34] to-[#5f1340]/90 rounded-b-[45%] pointer-events-none z-0" />
                    <div className="absolute top-0 right-[-15%] w-[55%] h-[130px] bg-gradient-to-br from-white/10 to-transparent rounded-bl-[180px] pointer-events-none z-0" />

                    {/* Big Avatar + Name */}
                    <div className="relative z-20 flex flex-col items-center text-center pt-2">
                        {/* Avatar ring */}
                        <div className="relative mb-3">
                            <div className="w-[80px] h-[80px] rounded-full bg-gradient-to-br from-pink-300/50 via-[#8a1c5d] to-[#450d2e] border-[3px] border-white/40 flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
                                <span className="text-[28px] font-black text-white">{getInitials(currentUser.fullName)}</span>
                            </div>
                            <span className="absolute bottom-0.5 right-0.5 w-4.5 h-4.5 bg-emerald-400 rounded-full border-2 border-[#450d2e] shadow-sm" />
                        </div>

                        {/* Name */}
                        <h2 className="text-[19px] font-black text-white tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                            {currentUser.fullName}
                        </h2>

                        {/* Subtitle / Role Display according to rule #4 */}
                        <span className="text-[12.5px] text-pink-100/90 font-bold mt-1 px-3 py-1 rounded-full bg-white/12 border border-white/15 backdrop-blur-md">
                            {getRoleDisplay(currentUser)}
                        </span>
                    </div>

                    {/* Profile stats strip (Bergabung & Masa Kerja) */}
                    <div className="relative z-20 grid grid-cols-2 gap-2.5 mt-6">
                        <div className="bg-white/12 backdrop-blur-md border border-white/15 rounded-[18px] px-3.5 py-3 flex items-center gap-2.5">
                            <div className="w-8.5 h-8.5 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4.5 h-4.5 text-pink-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div className="min-w-0">
                                <span className="text-[9px] text-pink-200/80 font-bold uppercase tracking-wider block">Bergabung</span>
                                <span className="text-[12px] text-white font-extrabold truncate block">
                                    {formatIndonesianDate(currentUser.join_date)}
                                </span>
                            </div>
                        </div>

                        <div className="bg-white/12 backdrop-blur-md border border-white/15 rounded-[18px] px-3.5 py-3 flex items-center gap-2.5">
                            <div className="w-8.5 h-8.5 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4.5 h-4.5 text-pink-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div className="min-w-0">
                                <span className="text-[9px] text-pink-200/80 font-bold uppercase tracking-wider block">Masa Kerja</span>
                                <span className="text-[12px] text-white font-extrabold truncate block">
                                    {getMasaKerja(currentUser.join_date)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ===== CONTENT AREA ===== */}
                <div className="w-full relative">

                    {/* INFORMASI AKUN CARD (Beautified) */}
                    <div className="mx-4 -mt-6 relative z-20 bg-white rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden">
                        <div className="px-5 pt-4 pb-2 border-b border-slate-100 flex justify-between items-center">
                            <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider">Informasi Akun</span>
                            <span className="text-[10px] text-[#5f1340] font-black uppercase tracking-wider bg-[#5f1340]/10 px-2 py-0.5 rounded-full">Waschen HR</span>
                        </div>

                        <div className="divide-y divide-slate-100/80">
                            {/* 1. Nama */}
                            <div className="flex items-center gap-3.5 px-5 py-3.5">
                                <div className="w-9 h-9 rounded-xl bg-[#5f1340]/10 text-[#5f1340] flex items-center justify-center flex-shrink-0">
                                    <User className="w-4.5 h-4.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Nama</span>
                                    <span className="text-[13px] text-slate-800 font-bold truncate block">{currentUser.fullName || currentUser.full_name || '-'}</span>
                                </div>
                            </div>

                            {/* 2. Employee Code */}
                            <div className="flex items-center gap-3.5 px-5 py-3.5">
                                <div className="w-9 h-9 rounded-xl bg-[#5f1340]/10 text-[#5f1340] flex items-center justify-center flex-shrink-0">
                                    <CreditCard className="w-4.5 h-4.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Nomor Induk Karyawan</span>
                                    <span className="text-[13px] text-slate-800 font-bold truncate block">{currentUser.employee_code || currentUser.employeeCode || '-'}</span>
                                </div>
                            </div>

                            {/* 3. Alamat */}
                            <div className="flex items-center gap-3.5 px-5 py-3.5">
                                <div className="w-9 h-9 rounded-xl bg-[#5f1340]/10 text-[#5f1340] flex items-center justify-center flex-shrink-0">
                                    <Home className="w-4.5 h-4.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Alamat</span>
                                    <span className="text-[12.5px] text-slate-800 font-bold leading-snug block">{currentUser.address || '-'}</span>
                                </div>
                            </div>

                            {/* 4. No. Telp */}
                            <div className="flex items-center gap-3.5 px-5 py-3.5">
                                <div className="w-9 h-9 rounded-xl bg-[#5f1340]/10 text-[#5f1340] flex items-center justify-center flex-shrink-0">
                                    <Phone className="w-4.5 h-4.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">No. Telp</span>
                                    <span className="text-[13px] text-slate-800 font-bold truncate block">{currentUser.phone || currentUser.phone_number || '-'}</span>
                                </div>
                            </div>

                            {/* 5. Email */}
                            <div className="flex items-center gap-3.5 px-5 py-3.5">
                                <div className="w-9 h-9 rounded-xl bg-[#5f1340]/10 text-[#5f1340] flex items-center justify-center flex-shrink-0">
                                    <Mail className="w-4.5 h-4.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Email</span>
                                    <span className="text-[13px] text-slate-800 font-bold truncate block">{currentUser.email || '-'}</span>
                                </div>
                            </div>

                            {/* 6. Outlet */}
                            <div className="flex items-center gap-3.5 px-5 py-3.5">
                                <div className="w-9 h-9 rounded-xl bg-[#5f1340]/10 text-[#5f1340] flex items-center justify-center flex-shrink-0">
                                    <Building2 className="w-4.5 h-4.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Outlet</span>
                                    <span className="text-[13px] text-slate-800 font-bold truncate block">{currentUser.assignedOutletName || 'Waschen Head Office'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* QUICK ACTIONS SECTION */}
                    <div className="mx-4 mt-5">
                        <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2.5 px-1">Pengaturan Akun</span>
                        <div className="flex flex-col gap-3">

                            {/* Edit Profil (Direct Route to /edit-profile) */}
                            <button
                                id="edit-profile-btn"
                                onClick={() => navigate('/edit-profile')}
                                className="bg-white border border-slate-100 rounded-[22px] shadow-[0_4px_16px_rgba(0,0,0,0.03)] p-4 flex items-center gap-3.5 hover:shadow-[0_8px_24px_rgba(95,19,64,0.12)] hover:-translate-y-0.5 active:scale-[.98] transition-all group"
                            >
                                <div className="w-10 h-10 rounded-2xl bg-[#5f1340]/10 text-[#5f1340] flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
                                    <Edit3 className="w-5 h-5" />
                                </div>
                                <div className="flex-1 text-left min-w-0">
                                    <span className="text-[13.5px] font-black text-slate-800 group-hover:text-[#5f1340] transition-colors block leading-tight">
                                        Edit Profil Lengkap
                                    </span>
                                    <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
                                        Perbarui data pribadi & dokumen KTP/KK
                                    </span>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#5f1340] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                            </button>

                            {/* Logout button */}
                            <button
                                id="profile-logout-btn"
                                onClick={() => setShowLogoutModal(true)}
                                className="w-full py-3.5 rounded-[22px] bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-[13.5px] font-black shadow-lg shadow-red-500/20 active:scale-[.97] transition-all flex items-center justify-center gap-2 mt-1 cursor-pointer"
                            >
                                <LogOut className="w-4 h-4" />
                                <span>KELUAR AKUN</span>
                            </button>

                        </div>
                    </div>

                    {/* Footer signature */}
                    <div className="text-center mt-6 mb-3">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Waschen Mobile v1.0 &bull; HRIS & Laundry Ops</span>
                    </div>
                </div>

                {/* ===== BOTTOM NAVBAR ===== */}
                <Navbar />

                {/* ===== CONFIRM LOGOUT MODAL ===== */}
                <ConfirmModal
                    isOpen={showLogoutModal}
                    onClose={() => setShowLogoutModal(false)}
                    onConfirm={handleLogout}
                    title="Keluar dari Akun?"
                    message="Apakah Anda yakin ingin keluar dari akun Waschen Mobile ini?"
                    confirmText="Ya, Keluar"
                    cancelText="Batal"
                    variant="danger"
                    closeOnOverlayClick={true}
                />

            </div>
        </div>
    );
}
