import React, { useState } from 'react';
import { unlockWithPassword } from '../../data/dataService';
import type { ActiveSession } from '../../types';
import { Lock, Unlock, AlertTriangle } from 'lucide-react';

interface AutoLockOverlayProps {
  session: ActiveSession;
  onUnlocked: () => void;
  onLogout: () => void;
}

export const AutoLockOverlay: React.FC<AutoLockOverlayProps> = ({
  session,
  onUnlocked,
  onLogout,
}) => {
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!password) {
      setErrorMsg('Sila masukkan kata laluan.');
      return;
    }

    setLoading(true);
    try {
      const ok = await unlockWithPassword(password);
      if (ok) {
        onUnlocked();
      } else {
        setErrorMsg('Kata laluan tidak tepat.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ralat membuka kunci.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border-4 border-[#2F5D8A] text-center space-y-6">
        <div className="w-20 h-20 bg-blue-50 text-[#2F5D8A] rounded-full mx-auto flex items-center justify-center border-4 border-[#2F5D8A]">
          <Lock className="w-10 h-10" />
        </div>

        <div>
          <h2 className="text-2xl font-black text-gray-900">SESI TELAH DIKUNCI</h2>
          <p className="text-base text-gray-600 font-medium mt-1">
            Tiada aktiviti dikesan. Sila masukkan kata laluan untuk meneruskan operasi kaunter.
          </p>
          <div className="mt-3 p-3 bg-gray-100 rounded-xl font-bold text-gray-800 text-lg">
            Petugas: {session.nama_penuh} ({session.username})
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border-2 border-[#991B1B] text-[#991B1B] rounded-xl font-bold text-sm flex items-center justify-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-4">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Kata Laluan"
            className="w-full p-4 rounded-xl border-2 border-gray-400 font-bold text-xl text-center focus:outline-none focus:border-[#2F5D8A]"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl bg-[#2F5D8A] hover:bg-[#254A6F] text-white font-black text-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
          >
            <Unlock className="w-6 h-6" />
            <span>{loading ? 'MEMERIKSA...' : 'BUKA KUNCI SESI'}</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="w-full py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-base transition"
          >
            Log Keluar Petugas
          </button>
        </form>
      </div>
    </div>
  );
};
