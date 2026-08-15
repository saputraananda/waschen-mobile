import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { startAuthentication } from '@simplewebauthn/browser';
import waschenLogo from '../../assets/images/waschen.png';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import { Eye, EyeOff, Lock, User as UserIcon, ScanFace, Fingerprint } from 'lucide-react';

export default function Login() {
    const navigate = useNavigate();

    // Form input states
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isBiometricSupported, setIsBiometricSupported] = useState(true);

    // ConfirmModal states for Login errors / alerts
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [modalErrorData, setModalErrorData] = useState({
        title: 'Gagal Masuk',
        message: 'Username/Email atau Kata Sandi yang Anda masukkan tidak sesuai.',
    });

    // Check WebAuthn support & Redirect to dashboard if token exists
    useEffect(() => {
        document.title = 'Masuk Akun - Waschen Mobile';
        const token = localStorage.getItem('token');
        if (token) {
            navigate('/');
        }
    }, [navigate]);

    // Form submission handler
    const handleLoginSubmit = async (e) => {
        e.preventDefault();

        if (!username.trim() || !password) {
            setModalErrorData({
                title: 'Data Tidak Lengkap',
                message: 'Silakan isi Username/Email dan Kata Sandi Anda sebelum melanjutkan.',
            });
            setShowErrorModal(true);
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await axios.post('/api/auth/login', {
                username: username.trim(),
                password: password
            });

            if (response.data && response.data.success) {
                // Save auth data
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('user', JSON.stringify(response.data.user));
                // Redirect to dashboard
                navigate('/');
            } else {
                throw new Error(response.data?.message || 'Username atau Kata Sandi salah');
            }
        } catch (err) {
            console.error('Login submit error:', err);
            const errMsg = err.response?.data?.message || err.message || 'Koneksi gagal atau kesalahan server saat login.';
            setModalErrorData({
                title: 'Gagal Masuk',
                message: errMsg,
            });
            setShowErrorModal(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    // WebAuthn Face ID / Biometrics login handler
    const handleBiometricLogin = async () => {
        if (typeof window === 'undefined' || !window.PublicKeyCredential) {
            setModalErrorData({
                title: 'Biometrik Tidak Tersedia di Browser Ini',
                message: 'Fitur Face ID / Biometrik memerlukan koneksi aman (HTTPS) atau browser yang mendukung WebAuthn. Jika Anda membuka via IP lokal (HTTP), peramban memblokir biometrik demi keamanan.',
            });
            setShowErrorModal(true);
            return;
        }

        setIsSubmitting(true);

        try {
            // 1. Fetch WebAuthn authentication options
            const optRes = await axios.post('/api/auth/webauthn/login-options', {
                username: username.trim()
            });

            if (!optRes.data || !optRes.data.success || !optRes.data.options) {
                throw new Error(optRes.data?.message || 'Gagal membuat tantangan biometrik');
            }

            // 2. Trigger native Face ID / Touch ID prompt via WebAuthn API
            const asseResp = await startAuthentication({ optionsJSON: optRes.data.options });

            // 3. Verify signature with backend
            const verifyRes = await axios.post('/api/auth/webauthn/login-verify', {
                response: asseResp
            });

            if (verifyRes.data && verifyRes.data.success) {
                localStorage.setItem('token', verifyRes.data.token);
                localStorage.setItem('user', JSON.stringify(verifyRes.data.user));
                navigate('/');
            } else {
                throw new Error(verifyRes.data?.message || 'Verifikasi biometrik tidak valid');
            }
        } catch (err) {
            console.error('Biometric login error:', err);
            if (err.name === 'NotAllowedError') {
                // User explicitly cancelled or closed the WebAuthn prompt
                return;
            }
            const errMsg = err.response?.data?.message || err.message || 'Face ID / Biometrik tidak dikenal. Pastikan Anda sudah memverifikasinya di halaman Profil.';
            setModalErrorData({
                title: 'Masuk Biometrik Gagal',
                message: errMsg,
            });
            setShowErrorModal(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-slate-100 flex justify-center items-stretch antialiased font-sans select-none overflow-y-auto">
            <div className="w-full max-w-[430px] min-h-[100dvh] bg-[#2a051b] overflow-y-auto flex flex-col relative shadow-2xl">

                {/* ==========================================
                    ABSTRACT WAVY BACKDROP WITH BUBBLES
                    ========================================== */}
                <div className="h-[220px] relative overflow-hidden pointer-events-none z-0 flex-shrink-0">
                    <div className="absolute top-0 left-[-20%] right-[-20%] h-[150%] bg-[#3d0a28] rounded-b-[45%] transform scale-x-110 origin-top z-0" />
                    <div className="absolute top-0 left-[-10%] right-[-10%] h-[120%] bg-gradient-to-br from-[#4d0f34] to-[#5f1340] rounded-b-[45%] shadow-[0_12px_36px_rgba(0,0,0,0.18)] z-0" />
                    <div className="absolute top-0 right-0 left-[15%] h-[80%] bg-[#8c2060]/30 rounded-bl-[120px] rounded-br-[60px] z-0" />
                    <div className="absolute top-0 right-[-15%] w-[60%] h-[120px] bg-gradient-to-br from-white/20 to-transparent rounded-bl-[180px] z-0" />

                    {/* Soap Bubbles */}
                    <div className="absolute top-3 left-6 w-24 h-24 rounded-full border border-white/20 bg-gradient-to-br from-white/10 via-[#5f1340]/5 to-white/5 backdrop-blur-[1px] shadow-[inset_-6px_-6px_16px_rgba(255,255,255,0.15),0_12px_28px_rgba(0,0,0,0.2)] pointer-events-none z-10 animate-bubble-1">
                        <div className="absolute top-2.5 left-2.5 w-6 h-3 bg-white/30 rounded-full rotate-[-30deg] blur-[0.5px]" />
                    </div>

                    <div className="absolute top-12 right-[-10px] w-20 h-20 rounded-full border border-white/30 bg-gradient-to-br from-white/20 via-[#8c2060]/10 to-[#5f1340]/15 backdrop-blur-[1px] shadow-[inset_-5px_-5px_14px_rgba(255,255,255,0.2),0_10px_24px_rgba(95,19,64,0.15)] pointer-events-none z-10 animate-bubble-2">
                        <div className="absolute top-2 left-2 w-4 h-2 bg-white/45 rounded-full rotate-[-30deg] blur-[0.5px]" />
                    </div>

                    {/* Centered Waschen Logo */}
                    <div className="absolute inset-0 flex items-center justify-center pb-4 z-20 animate-fade-in-logo">
                        <img
                            src={waschenLogo}
                            alt="Waschen Logo"
                            className="w-32 h-auto object-contain filter drop-shadow-[0_4px_12px_rgba(255,255,255,0.15)]"
                        />
                    </div>
                </div>

                {/* ==========================================
                    LOGIN FORM CARD
                    ========================================== */}
                <div className="bg-white rounded-t-[36px] shadow-[0_-12px_48px_rgba(0,0,0,0.06)] flex flex-col z-10 relative px-6 pt-6 pb-8 mt-[-30px] flex-grow animate-drawer-slide-up">
                    <div className="text-center mb-5">
                        <h2 className="text-[24px] font-black text-[#5f1340] tracking-tight leading-tight">Selamat Datang!</h2>
                        <p className="text-[12px] text-slate-400 font-medium mt-0.5">Masuk ke akun karyawan Anda</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">

                        {/* 1. Username / Email Input */}
                        <div className="relative mt-1">
                            <label className="absolute -top-2.5 left-4 bg-white px-1.5 text-[11px] font-black text-slate-400 tracking-wide transition-all select-none z-10">
                                Username atau Email
                            </label>
                            <div className="relative flex items-center">
                                <input
                                    id="login-username-input"
                                    type="text"
                                    placeholder="Masukkan username atau email..."
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    disabled={isSubmitting}
                                    className="w-full border border-slate-200 rounded-[18px] pl-4 pr-11 py-3.5 text-[15px] text-slate-800 focus:border-[#5f1340] focus:ring-2 focus:ring-[#5f1340]/20 outline-none transition duration-150 font-medium"
                                />
                                <div className="absolute right-4 text-slate-400 pointer-events-none">
                                    <UserIcon className="w-4.5 h-4.5" />
                                </div>
                            </div>
                        </div>

                        {/* 2. Password Input with Eye Hint Toggle */}
                        <div className="relative mt-1">
                            <label className="absolute -top-2.5 left-4 bg-white px-1.5 text-[11px] font-black text-slate-400 tracking-wide transition-all select-none z-10">
                                Kata Sandi
                            </label>
                            <div className="relative flex items-center">
                                <input
                                    id="login-password-input"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Masukkan kata sandi..."
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={isSubmitting}
                                    className="w-full border border-slate-200 rounded-[18px] pl-4 pr-12 py-3.5 text-[15px] text-slate-800 focus:border-[#5f1340] focus:ring-2 focus:ring-[#5f1340]/20 outline-none transition duration-150 font-medium"
                                />
                                <button
                                    id="login-password-toggle"
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 p-1 text-slate-400 hover:text-[#5f1340] focus:outline-none transition-colors rounded-lg"
                                    title={showPassword ? "Sembunyikan Kata Sandi" : "Tampilkan Kata Sandi"}
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-5 h-5 text-[#5f1340]" />
                                    ) : (
                                        <Eye className="w-5 h-5 text-slate-400" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            id="login-submit-btn"
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3.5 rounded-[18px] bg-[#5f1340] hover:bg-[#4d0f34] active:scale-[.98] text-white text-[14px] font-black shadow-lg shadow-[#5f1340]/20 transition-all duration-150 mt-2 flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Memverifikasi...</span>
                                </>
                            ) : (
                                <span>MASUK AKUN</span>
                            )}
                        </button>

                        {/* WebAuthn Face ID / Biometrics Button */}
                        {isBiometricSupported && (
                            <>
                                <div className="relative flex py-1 items-center justify-center">
                                    <div className="flex-grow border-t border-slate-200"></div>
                                    <span className="flex-shrink mx-3 text-[10.5px] font-black text-slate-400 uppercase tracking-wider">Atau</span>
                                    <div className="flex-grow border-t border-slate-200"></div>
                                </div>

                                <button
                                    id="login-biometric-btn"
                                    type="button"
                                    onClick={handleBiometricLogin}
                                    disabled={isSubmitting}
                                    className="w-full py-3 rounded-[18px] bg-slate-50 hover:bg-pink-50/60 border border-slate-200 hover:border-[#5f1340]/40 text-[#5f1340] text-[13.5px] font-bold shadow-sm active:scale-[.98] transition-all duration-150 flex items-center justify-center gap-2.5"
                                >
                                    <ScanFace className="w-5 h-5 text-[#5f1340]" />
                                    <span>Masuk dengan Face ID / Biometrik</span>
                                </button>
                            </>
                        )}

                    </form>

                    {/* Footer Signature */}
                    <div className="pt-6 text-center border-t border-slate-100 text-[10.5px] text-slate-400 font-bold uppercase tracking-wider mt-auto">
                        PT Waschen Alora Indonesia &bull; Team Alora
                    </div>
                </div>

            </div>

            {/* ==========================================
                CONFIRM MODAL FOR LOGIN ERRORS
                ========================================== */}
            <ConfirmModal
                isOpen={showErrorModal}
                onClose={() => setShowErrorModal(false)}
                onConfirm={() => setShowErrorModal(false)}
                title={modalErrorData.title}
                message={modalErrorData.message}
                confirmText="Coba Lagi"
                cancelText="Tutup"
                variant="warning"
                closeOnOverlayClick={true}
            />
        </div>
    );
}
