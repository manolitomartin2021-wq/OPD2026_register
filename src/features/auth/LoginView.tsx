import React, { useState } from 'react';
import { loginUser } from '../../data/dataService';
import type { ActiveSession } from '../../types';
import { LogIn, ShieldAlert, KeyRound, AlertTriangle, Building2 } from 'lucide-react';
import { PWAInstallButton } from '../../pwa/PWAInstallButton';

interface LoginViewProps {
  onLoginSuccess: (session: ActiveSession) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!username.trim() || !password) {
      setErrorMsg('Sila masukkan nama pengguna dan kata laluan.');
      return;
    }

    setLoading(true);
    try {
      const session = await loginUser(username, password);
      onLoginSuccess(session);
    } catch (err: any) {
      setErrorMsg(err.message || 'Ralat log masuk.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] flex flex-col justify-between p-4 md:p-8">
      {/* Top Header Bar */}
      <div className="flex justify-between items-center max-w-5xl mx-auto w-full mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#2F5D8A] text-white flex items-center justify-center font-black text-xl shadow-md">
            JPL
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 leading-tight">HOSPITAL DALAT</h1>
            <p className="text-sm font-bold text-gray-600">Sistem Pendaftaran Jabatan Pesakit Luar</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <PWAInstallButton />
        </div>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-2xl border-2 border-gray-300 overflow-hidden my-auto">
        <div className="p-6 md:p-8 bg-[#2F5D8A] text-white text-center">
          <div className="w-16 h-16 bg-white/10 rounded-2xl mx-auto flex items-center justify-center mb-3">
            <Building2 className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-black tracking-wide">LOG MASUK PETUGAS</h2>
          <p className="text-sm text-blue-100 font-medium mt-1">
            Sila masukkan akaun individu anda
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5">
          {errorMsg && (
            <div className="p-4 bg-red-50 border-2 border-[#991B1B] text-[#991B1B] rounded-xl font-bold flex items-center gap-3 text-base">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-base font-bold text-gray-800 mb-1">
              Nama Pengguna (Username):
            </label>
            <input
              type="text"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="cth: OPD atau Incharge"
              className="w-full p-4 rounded-xl border-2 border-gray-400 font-bold text-lg focus:outline-none focus:border-[#2F5D8A] focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="block text-base font-bold text-gray-800 mb-1">
              Kata Laluan:
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="cth: OPD123 atau Incharge123"
              className="w-full p-4 rounded-xl border-2 border-gray-400 font-bold text-lg focus:outline-none focus:border-[#2F5D8A] focus:ring-4 focus:ring-blue-100"
            />
          </div>

          {/* Quick Login Badges */}
          <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 space-y-2">
            <span className="text-xs font-black text-gray-700 uppercase block text-center">
              PILIHAN LOG MASUK PANTAS:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setUsername('OPD');
                  setPassword('OPD123');
                }}
                className="py-2.5 px-3 rounded-lg bg-white hover:bg-blue-100 border-2 border-[#2F5D8A] font-bold text-sm text-[#2F5D8A] text-center transition"
              >
                Kaunter: <strong>OPD</strong>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername('Incharge');
                  setPassword('Incharge123');
                }}
                className="py-2.5 px-3 rounded-lg bg-white hover:bg-purple-100 border-2 border-purple-800 font-bold text-sm text-purple-900 text-center transition"
              >
                Penyelia: <strong>Incharge</strong>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-[#2F5D8A] hover:bg-[#254A6F] text-white font-black text-xl flex items-center justify-center gap-3 shadow-lg transition focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 mt-4 cursor-pointer"
          >
            <LogIn className="w-6 h-6" />
            <span>{loading ? 'MEMERIKSA...' : 'LOG MASUK KE SISTEM'}</span>
          </button>

          <div className="pt-2 text-center text-sm font-semibold text-gray-500">
            Aplikasi PWA Luar Talian · Hospital Dalat · Versi 4.1-WEB
          </div>
        </form>
      </div>

      {/* Footer Info */}
      <div className="text-center text-sm text-gray-500 max-w-3xl mx-auto mt-6">
        <p>
          Data pesakit disimpan dalam storan selamat setempat pelayar (IndexedDB). Tiada panggilan awan atau internet diperlukan.
        </p>
      </div>
    </div>
  );
};
