import React, { useState, useEffect } from 'react';
import type { ActiveSession } from '../types';
import { lockCurrentSession, logoutUser } from '../data/dataService';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import {
  LayoutDashboard,
  UserPlus,
  CalendarCheck,
  FileSpreadsheet,
  Users,
  FileEdit,
  ShieldCheck,
  Trash2,
  Archive,
  Upload,
  UserCog,
  History,
  Settings,
  LogOut,
  Lock,
  Wifi,
  WifiOff,
  Maximize2,
  Minimize2,
  ChevronDown,
} from 'lucide-react';

interface AppLayoutProps {
  session: ActiveSession;
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  session,
  currentPage,
  onNavigate,
  onLogout,
  children,
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [originStr, setOriginStr] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supervisorMenuOpen, setSupervisorMenuOpen] = useState(false);

  useEffect(() => {
    // Pastikan font size sistem sentiasa kekal BESAR (20px)
    document.documentElement.setAttribute('data-text-size', 'besar');
    localStorage.setItem('JPL_TEXT_SIZE', 'besar');

    if (typeof window !== 'undefined') {
      setOriginStr(window.location.origin);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen error:', err);
    }
  };

  // Menu Utama Operasi Kaunter
  const mainMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'pendaftaran', label: 'Pendaftaran Pesakit', icon: <UserPlus className="w-5 h-5" /> },
    { id: 'rekod', label: 'Rekod Pendaftaran', icon: <CalendarCheck className="w-5 h-5" /> },
    { id: 'laporan', label: 'Laporan Reten', icon: <FileSpreadsheet className="w-5 h-5" /> },
    { id: 'pesakit', label: 'Master Pesakit', icon: <Users className="w-5 h-5" /> },
    { id: 'permohonan', label: 'Permohonan', icon: <FileEdit className="w-5 h-5" /> },
  ];

  // Menu Kawalan Penyelia (Incharge)
  const supervisorItems = [
    { id: 'backup', label: 'Backup & Verify', icon: <ShieldCheck className="w-5 h-5" /> },
    { id: 'penutupan', label: 'Penutupan & Purge', icon: <Trash2 className="w-5 h-5" /> },
    { id: 'arkib', label: 'Arkib Digital', icon: <Archive className="w-5 h-5" /> },
    { id: 'import', label: 'Import Pesakit', icon: <Upload className="w-5 h-5" /> },
    { id: 'pengguna', label: 'Pengurusan Pengguna', icon: <UserCog className="w-5 h-5" /> },
    { id: 'audit', label: 'Audit Log', icon: <History className="w-5 h-5" /> },
    { id: 'tetapan', label: 'Tetapan', icon: <Settings className="w-5 h-5" /> },
  ];

  const isCurrentSupervisorPage = supervisorItems.some((s) => s.id === currentPage);

  return (
    <div className="min-h-screen bg-[#F4F7FA] flex flex-col justify-between text-gray-900">
      {/* HEADER NAVIGASI SEBELAH ATAS (TOP BAR NAVIGATION) */}
      <header className="bg-white border-b-2 border-gray-300 sticky top-0 z-40 shadow-md print:hidden">
        {/* Baris 1: Logo, Tajuk Hospital & Utiliti */}
        <div className="w-full max-w-[98%] mx-auto px-4 py-2.5 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#2F5D8A] text-white flex items-center justify-center font-black text-2xl shadow-md">
              JPL
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-gray-900 leading-none tracking-tight">
                  HOSPITAL DALAT
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-[#2F5D8A] text-xs font-black uppercase tracking-wider">
                  V4.1-WEB
                </span>
              </div>
              <span className="text-sm font-bold text-gray-600 block mt-0.5">
                Sistem Pendaftaran Pesakit Luar (JPL)
              </span>
            </div>
          </div>

          {/* Sebelah Kanan: PWA, Skrin Penuh, Status Pengguna & Butang Keluar */}
          <div className="flex items-center gap-2 sm:gap-3">
            <PWAInstallButton />

            {/* Butang Skrin Penuh (Full Screen Toggle) */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 text-[#2F5D8A] hover:bg-blue-100 border-2 border-blue-200 font-black text-sm cursor-pointer transition shadow-sm"
              title={isFullscreen ? 'Keluar Skrin Penuh' : 'Buka Skrin Penuh'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-5 h-5" />
                  <span className="hidden md:inline">Keluar Penuh</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-5 h-5" />
                  <span className="hidden md:inline">Skrin Penuh</span>
                </>
              )}
            </button>

            {/* Profil Pengguna Semasa (OPD / Incharge) */}
            <div className="hidden sm:flex items-center gap-3 bg-gray-100 border-2 border-gray-300 px-3.5 py-1.5 rounded-xl">
              <div>
                <span className="text-base font-black text-gray-900 block leading-tight">
                  {session.nama_penuh}
                </span>
                <span className="text-xs font-black text-[#2F5D8A] uppercase block">
                  {session.role} ({session.username})
                </span>
              </div>
            </div>

            {/* Kunci Sesi */}
            <button
              type="button"
              onClick={() => {
                lockCurrentSession();
                window.dispatchEvent(new CustomEvent('JPL_SESSION_LOCKED'));
              }}
              className="p-2.5 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-gray-300 cursor-pointer"
              title="Kunci Sesi Kaunter"
            >
              <Lock className="w-5 h-5" />
            </button>

            {/* Log Keluar */}
            <button
              type="button"
              onClick={() => {
                logoutUser();
                onLogout();
              }}
              className="p-2.5 rounded-xl bg-red-50 text-[#991B1B] hover:bg-red-100 border-2 border-red-200 cursor-pointer"
              title="Log Keluar"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Baris 2: Menu Navigasi Sudut Atas (Horizontal Nav Bar) */}
        <div className="bg-[#2F5D8A] text-white border-t border-[#254A6F]">
          <div className="w-full max-w-[98%] mx-auto px-2 flex items-center justify-between overflow-x-auto py-1">
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              {mainMenuItems.map((item) => {
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-base transition whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-white text-[#2F5D8A] shadow-md scale-102 font-black'
                        : 'text-blue-100 hover:bg-[#254A6F] hover:text-white'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}

              {/* Menu Dropdown / Tambahan Kawalan Penyelia */}
              {session.role === 'PENYELIA' && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSupervisorMenuOpen(!supervisorMenuOpen)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-base transition cursor-pointer whitespace-nowrap ${
                      isCurrentSupervisorPage
                        ? 'bg-amber-400 text-gray-900 shadow-md font-black'
                        : 'text-amber-200 hover:bg-[#254A6F] hover:text-white'
                    }`}
                  >
                    <ShieldCheck className="w-5 h-5" />
                    <span>Kawalan Penyelia</span>
                    <ChevronDown className="w-4 h-4 ml-0.5" />
                  </button>

                  {supervisorMenuOpen && (
                    <div
                      className="absolute left-0 mt-1 w-64 bg-white text-gray-900 rounded-2xl shadow-2xl border-2 border-gray-300 py-2 z-50 animate-in fade-in slide-in-from-top-2"
                      onClick={() => setSupervisorMenuOpen(false)}
                    >
                      <div className="px-3 py-1 text-xs font-black uppercase text-purple-900 border-b border-gray-200 tracking-wider">
                        Menu Eksekutif / Penyelia
                      </div>
                      {supervisorItems.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => onNavigate(sub.id)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left font-bold text-sm hover:bg-blue-50 transition ${
                            currentPage === sub.id ? 'bg-blue-100 text-[#2F5D8A] font-black' : 'text-gray-800'
                          }`}
                        >
                          {sub.icon}
                          <span>{sub.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Indikator Rangkaian Kompak di Bar Navigasi */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 text-xs font-bold text-blue-200">
              {isOnline ? (
                <>
                  <Wifi className="w-4 h-4 text-green-300" />
                  <span className="text-white">Rangkaian Setempat</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-amber-300" />
                  <span className="text-amber-200">Luar Talian (Offline)</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* KANDUNGAN UTAMA (FULL SCREEN FOCUSED - TIADA GANGGUAN SIDEBAR) */}
      <main className="w-full max-w-[98%] mx-auto px-2 sm:px-4 py-4 flex-1">
        {children}
      </main>

      {/* FOOTER RINGKAS */}
      <footer className="bg-white border-t-2 border-gray-300 py-2.5 px-4 text-xs font-bold text-gray-600 print:hidden">
        <div className="w-full max-w-[98%] mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="font-mono text-gray-700">
            HOSPITAL DALAT · SISTEM PENDAFTARAN PESAKIT LUAR (JPL)
          </div>
          <div className="flex items-center gap-4">
            <span>Zon Masa: Asia/Kuching (UTC+8)</span>
            <span>·</span>
            <span>Saiz Font: BESAR (20px)</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
