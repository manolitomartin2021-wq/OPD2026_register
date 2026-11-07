import React, { useState, useEffect } from 'react';
import type { ActiveSession } from './types';
import { isSystemInitialized, getCurrentSession, unlockCurrentSession } from './data/dataService';
import { SetupWizard } from './features/setup/SetupWizard';
import { LoginView } from './features/auth/LoginView';
import { AutoLockOverlay } from './features/auth/AutoLockOverlay';
import { AppLayout } from './app/AppLayout';
import { VeteranUIProvider } from './components/veteran/VeteranUIContext';

// Feature Views
import { DashboardView } from './features/dashboard/DashboardView';
import { PendaftaranView } from './features/pendaftaran/PendaftaranView';
import { RekodView } from './features/rekod/RekodView';
import { LaporanRetenView } from './features/laporan/LaporanRetenView';
import { PesakitView } from './features/pesakit/PesakitView';
import { PermohonanView } from './features/permohonan/PermohonanView';
import { BackupView } from './features/backup/BackupView';
import { PenutupanPurgeView } from './features/penutupan/PenutupanPurgeView';
import { ArkibView } from './features/arkib/ArkibView';
import { ImportView } from './features/import/ImportView';
import { PenggunaView } from './features/pengguna/PenggunaView';
import { AuditView } from './features/audit/AuditView';
import { TetapanView } from './features/tetapan/TetapanView';

import { ShieldAlert, AlertTriangle } from 'lucide-react';

export const App: React.FC = () => {
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isLocked, setIsLocked] = useState(false);
  const [isTabDuplicate, setIsTabDuplicate] = useState(false);

  // Check Web Locks API (Single Tab Guard per Section 4.2)
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'locks' in navigator) {
      navigator.locks.request(
        'jpl_dalat_exclusive_counter_lock',
        { ifAvailable: true },
        async (lock) => {
          if (!lock) {
            setIsTabDuplicate(true);
            return new Promise(() => {}); // hold forever
          }
          // Lock acquired successfully
          return new Promise(() => {});
        }
      );
    }
  }, []);

  // System initialization & session checks
  useEffect(() => {
    const checkInit = async () => {
      try {
        const init = await isSystemInitialized();
        setInitialized(init);
        const s = getCurrentSession();
        setSession(s);
      } catch (err) {
        console.error(err);
        setInitialized(false);
      }
    };
    checkInit();

    // Listen for Auto-Lock custom events
    const handleLock = () => {
      setIsLocked(true);
    };
    window.addEventListener('JPL_SESSION_LOCKED', handleLock);
    return () => window.removeEventListener('JPL_SESSION_LOCKED', handleLock);
  }, []);

  // Keyboard shortcut listener (F1-F4)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setCurrentPage('pendaftaran');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setCurrentPage('pendaftaran');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setCurrentPage('pendaftaran');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setCurrentPage('pendaftaran');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isTabDuplicate) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white text-center">
        <div className="max-w-lg bg-white text-gray-900 rounded-3xl p-8 shadow-2xl border-4 border-red-600 space-y-4">
          <ShieldAlert className="w-16 h-16 text-red-600 mx-auto" />
          <h2 className="text-2xl font-black">APLIKASI TELAH DIBUKA DI TETINGKAP LAIN</h2>
          <p className="text-base text-gray-700 font-medium leading-relaxed">
            Sistem Pendaftaran JPL dihadkan kepada <strong>satu tetingkap pelayar sahaja</strong> pada PC ini untuk mengelakkan percanggahan jujukan penomboran HDalat dan Master RN.
          </p>
          <p className="text-sm font-bold text-gray-500">
            Sila tutup tetingkap ini dan kembali ke tetingkap yang telah dibuka sebelum ini.
          </p>
        </div>
      </div>
    );
  }

  if (initialized === null) {
    return (
      <div className="min-h-screen bg-[#F4F7FA] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-[#2F5D8A] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-lg font-bold text-[#2F5D8A]">Memuatkan Sistem JPL Hospital Dalat...</p>
        </div>
      </div>
    );
  }

  // First time setup wizard
  if (!initialized) {
    return (
      <VeteranUIProvider>
        <SetupWizard onCompleted={() => setInitialized(true)} />
      </VeteranUIProvider>
    );
  }

  // Not logged in
  if (!session) {
    return (
      <VeteranUIProvider>
        <LoginView
          onLoginSuccess={(s) => {
            setSession(s);
            setIsLocked(false);
          }}
        />
      </VeteranUIProvider>
    );
  }

  return (
    <VeteranUIProvider>
      {/* Auto-Lock Overlay */}
      {isLocked && (
        <AutoLockOverlay
          session={session}
          onUnlocked={() => setIsLocked(false)}
          onLogout={() => {
            setSession(null);
            setIsLocked(false);
          }}
        />
      )}

      {/* Main Application Layout */}
      <AppLayout
        session={session}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onLogout={() => setSession(null)}
      >
        {currentPage === 'dashboard' && (
          <DashboardView
            session={session}
            onNavigate={setCurrentPage}
            onOpenWeeklyBackup={() => setCurrentPage('backup')}
          />
        )}
        {currentPage === 'pendaftaran' && <PendaftaranView session={session} />}
        {currentPage === 'rekod' && <RekodView session={session} />}
        {currentPage === 'laporan' && <LaporanRetenView session={session} />}
        {currentPage === 'pesakit' && <PesakitView session={session} />}
        {currentPage === 'permohonan' && <PermohonanView session={session} />}
        {currentPage === 'backup' && <BackupView session={session} />}
        {currentPage === 'penutupan' && <PenutupanPurgeView session={session} />}
        {currentPage === 'arkib' && <ArkibView session={session} />}
        {currentPage === 'import' && <ImportView session={session} />}
        {currentPage === 'pengguna' && <PenggunaView session={session} />}
        {currentPage === 'audit' && <AuditView session={session} />}
        {currentPage === 'tetapan' && <TetapanView session={session} />}
      </AppLayout>
    </VeteranUIProvider>
  );
};

export default App;
