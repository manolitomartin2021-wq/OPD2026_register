import React, { useEffect, useState } from 'react';
import { getDatabase } from '../../data/db';
import type { ActiveSession, MonthStatus, BackupHistory, ProfileCorrectionRequest } from '../../types';
import {
  Users,
  CalendarCheck,
  UserCheck,
  Stethoscope,
  Activity,
  AlertTriangle,
  Clock,
  ShieldCheck,
  CheckCircle,
  Database,
  Archive,
  Bell,
  RefreshCw,
  Calendar,
  Download,
  Search,
  Filter,
  FileSpreadsheet,
  Printer,
  ChevronLeft,
  ChevronRight,
  UserPlus,
} from 'lucide-react';
import {
  getTodayDateString,
  getCurrentYearMonth,
  formatDateDisplay,
  formatYearMonthDisplay,
} from '../../utils/dateUtils';
import {
  checkFridayReminder,
  snoozeFridayReminder,
  markReminderCompleted,
  type FridayReminderState,
} from '../../services/reminderService';
import {
  getMonthlyDetailedReport,
  type DailyAttendanceSummary,
  type MonthlyDetailedReport,
} from '../../data/dataService';
import { PageHelp } from '../../components/veteran/PageHelp';
import * as XLSX from 'xlsx';

interface DashboardViewProps {
  session: ActiveSession;
  onNavigate: (page: string) => void;
  onOpenWeeklyBackup?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  session,
  onNavigate,
  onOpenWeeklyBackup,
}) => {
  const [loading, setLoading] = useState(true);
  const [totalPatients, setTotalPatients] = useState(0);
  const [inactivePatients, setInactivePatients] = useState(0);
  const [todayAttendances, setTodayAttendances] = useState<any[]>([]);
  const [monthStatusList, setMonthStatusList] = useState<MonthStatus[]>([]);
  const [lastWeeklyBackup, setLastWeeklyBackup] = useState<BackupHistory | null>(null);
  const [pendingCorrections, setPendingCorrections] = useState<ProfileCorrectionRequest[]>([]);
  const [supervisorCount, setSupervisorCount] = useState(1);
  const [fridayReminder, setFridayReminder] = useState<FridayReminderState>({
    isActive: false,
    isOverdue: false,
    isoWeek: '',
    message: '',
  });

  // State untuk Laporan Bulanan & Senarai Pesakit Sebulan (Requirement 5)
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth());
  const [monthlyReport, setMonthlyReport] = useState<MonthlyDetailedReport | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('SEMUA');
  const [activeTab, setActiveTab] = useState<'HARIAN' | 'SENARAI_PESAKIT'>('HARIAN');

  const loadData = async () => {
    setLoading(true);
    const db = getDatabase();
    const today = getTodayDateString();

    // 1. Patients count
    const allPatients = await db.patients.toArray();
    setTotalPatients(allPatients.length);
    const inactive = allPatients.filter((p) => p.status_pesakit === 'TIDAK AKTIF').length;
    setInactivePatients(inactive);

    // 2. Today attendances
    const todays = await db.attendances.where('tarikh').equals(today).toArray();
    setTodayAttendances(todays);

    // 3. Month statuses
    const ms = await db.month_status.toArray();
    setMonthStatusList(ms);

    // 4. Last weekly backup
    const lastBackup = await db.backup_history.where('jenis').equals('MINGGUAN').last();
    setLastWeeklyBackup(lastBackup || null);

    // 5. Pending corrections
    const pendings = await db.profile_corrections.where('status').equals('MENUNGGU').toArray();
    setPendingCorrections(pendings);

    // 6. Supervisor accounts count
    const superUsers = await db.users.where('role').equals('PENYELIA').toArray();
    setSupervisorCount(superUsers.length);

    // 7. Friday reminder check
    const reminder = await checkFridayReminder();
    setFridayReminder(reminder);

    // 8. Load Monthly Detailed Report (Requirement 5)
    try {
      const rep = await getMonthlyDetailedReport(selectedMonth);
      setMonthlyReport(rep);
    } catch (err) {
      console.error('Error loading monthly detailed report:', err);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      checkFridayReminder().then(setFridayReminder);
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedMonth]);

  const changeMonth = (offset: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + offset, 1);
    const newYM = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    setSelectedMonth(newYM);
  };

  const validToday = todayAttendances.filter((a) => a.status === 'SAH');
  const cancelledToday = todayAttendances.filter((a) => a.status === 'BATAL');
  const newPatientsToday = validToday.filter((a) => a.pesakit_baharu);
  const existingPatientsToday = validToday.filter((a) => !a.pesakit_baharu);

  const fupCount = validToday.filter((a) => a.kategori === 'FUP_RUTIN').length;
  const walkinCount = validToday.filter((a) => a.kategori === 'WALK_IN').length;
  const checkupCount = validToday.filter((a) => a.kategori === 'MEDICAL_CHECKUP').length;
  const procedureCount = validToday.filter((a) => a.kategori === 'PROCEDURE_ROOM').length;

  // Monthly totals calculation from dailySummaries
  const monthDailySummaries = monthlyReport?.dailySummaries || [];
  const totalSahMonth = monthDailySummaries.reduce((acc, curr) => acc + curr.jumlah_sah, 0);
  const totalFupMonth = monthDailySummaries.reduce((acc, curr) => acc + curr.fup, 0);
  const totalWalkinMonth = monthDailySummaries.reduce((acc, curr) => acc + curr.walkin, 0);
  const totalCheckupMonth = monthDailySummaries.reduce((acc, curr) => acc + curr.checkup, 0);
  const totalProcedureMonth = monthDailySummaries.reduce((acc, curr) => acc + curr.procedure, 0);
  const totalBaharuMonth = monthDailySummaries.reduce((acc, curr) => acc + curr.baharu, 0);
  const totalSediaAdaMonth = monthDailySummaries.reduce((acc, curr) => acc + curr.sedia_ada, 0);
  const totalBatalMonth = monthDailySummaries.reduce((acc, curr) => acc + curr.batal, 0);

  // Filtered Monthly Patient List
  const allPatientsMonth = monthlyReport?.patientList || [];
  const filteredMonthPatients = allPatientsMonth.filter((p) => {
    const matchCat = categoryFilter === 'SEMUA' || p.kategori === categoryFilter;
    if (!matchCat) return false;
    if (!patientSearch.trim()) return true;
    const q = patientSearch.toLowerCase();
    return (
      p.nama_pesakit.toLowerCase().includes(q) ||
      p.no_rn.toLowerCase().includes(q) ||
      p.no_daftar.toLowerCase().includes(q)
    );
  });

  // Export Daily Breakdown to Excel
  const exportDailyExcel = () => {
    if (!monthlyReport) return;
    const rows = monthlyReport.dailySummaries.map((d) => ({
      Tarikh: d.tarikh,
      Hari: d.hari,
      'FUP Rutin': d.fup,
      'Walk-In': d.walkin,
      'Medical Check-Up': d.checkup,
      'Procedure Room': d.procedure,
      'Pesakit Baharu': d.baharu,
      'Pesakit Sedia Ada': d.sedia_ada,
      Dibatalkan: d.batal,
      'Jumlah Sah': d.jumlah_sah,
      'Status Tutup Hari': d.tutup_hari ? 'TUTUP HARI' : 'BELUM',
    }));

    // Add summary row
    rows.push({
      Tarikh: 'JUMLAH KESELURUHAN',
      Hari: '',
      'FUP Rutin': totalFupMonth,
      'Walk-In': totalWalkinMonth,
      'Medical Check-Up': totalCheckupMonth,
      'Procedure Room': totalProcedureMonth,
      'Pesakit Baharu': totalBaharuMonth,
      'Pesakit Sedia Ada': totalSediaAdaMonth,
      Dibatalkan: totalBatalMonth,
      'Jumlah Sah': totalSahMonth,
      'Status Tutup Hari': '',
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan Harian');
    XLSX.writeFile(wb, `Laporan_Harian_JPL_${selectedMonth}.xlsx`);
  };

  // Export Monthly Patient List to Excel
  const exportPatientListExcel = () => {
    if (!monthlyReport) return;
    const rows = filteredMonthPatients.map((p, idx) => ({
      Bil: idx + 1,
      'No. HDalat': p.no_daftar,
      'No. RN': p.no_rn,
      'Nama Pesakit': p.nama_pesakit,
      Kategori: p.kategori,
      Tarikh: p.tarikh,
      Masa: p.masa ? p.masa.substring(0, 5) : '',
      'Pesakit Baharu/Ulangan': p.pesakit_baharu ? 'BAHARU' : 'ULANGAN',
      'Umur (Tahun)': p.umur_tahun,
      Kewarganegaraan: p.kewarganegaraan,
      Status: p.status,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Senarai Pesakit');
    XLSX.writeFile(wb, `Senarai_Pesakit_JPL_${selectedMonth}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <PageHelp
        title="Dashboard Utama JPL Hospital Dalat"
        points={[
          'Papan Pemuka memaparkan ringkasan kehadiran pesakit hari ini dan pecahan 4 kategori utama.',
          'Bahagian Laporan Bulanan menyediakan senarai jumlah pesakit yang hadir sebulan serta pecahan harian (1 hingga 31 hari).',
          'Anda boleh memilih mana-mana bulan untuk menyemak dan memuat turun laporan dalam format Excel.',
        ]}
      />

      {/* Friday 4:00 PM Reminder Banner */}
      {fridayReminder.isActive && (
        <div
          className={`p-6 rounded-2xl border-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 ${
            fridayReminder.isOverdue
              ? 'bg-red-50 border-[#991B1B] text-[#991B1B]'
              : 'bg-amber-50 border-[#B45309] text-[#B45309]'
          }`}
        >
          <div className="flex items-start gap-4">
            <Bell className="w-10 h-10 flex-shrink-0 animate-bounce" />
            <div>
              <h3 className="text-xl font-black uppercase">
                {fridayReminder.isOverdue ? 'PERINGATAN TERTUNGGAK SALIN DATA' : 'PERINGATAN JUMAAT 4.00 PETANG'}
              </h3>
              <p className="text-base font-bold mt-1 text-gray-800">
                {fridayReminder.message}
              </p>
            </div>
          </div>

          {session.role === 'PENYELIA' ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (onOpenWeeklyBackup) onOpenWeeklyBackup();
                  else onNavigate('backup');
                }}
                className="py-3 px-5 rounded-xl bg-[#2F5D8A] hover:bg-[#254A6F] text-white font-black text-base shadow-md cursor-pointer"
              >
                BUAT BACKUP MINGGUAN SEKARANG
              </button>
              <button
                type="button"
                onClick={() => {
                  snoozeFridayReminder(30);
                  setFridayReminder({ ...fridayReminder, isActive: false });
                }}
                className="py-3 px-4 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-base cursor-pointer"
              >
                INGATKAN 30 MINIT LAGI
              </button>
              <button
                type="button"
                onClick={async () => {
                  await markReminderCompleted('Disahkan oleh Penyelia di Dashboard');
                  setFridayReminder({ ...fridayReminder, isActive: false });
                }}
                className="py-3 px-4 rounded-xl bg-green-700 hover:bg-green-800 text-white font-bold text-base cursor-pointer"
              >
                TANDAKAN SUDAH DISALIN
              </button>
            </div>
          ) : (
            <div className="text-base font-bold text-gray-700 bg-white/80 p-3 rounded-xl border">
              Peringatan kepada Penyelia: Sila salin data minggu ini ke PC Penyelia.
            </div>
          )}
        </div>
      )}

      {/* Top Stat Cards (Big, High-Contrast & Clear) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-6 bg-white rounded-2xl border-2 border-gray-300 shadow-sm flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-blue-50 text-[#2F5D8A]">
            <CalendarCheck className="w-10 h-10" />
          </div>
          <div>
            <span className="text-sm font-bold text-gray-500 uppercase block">KEHADIRAN HARI INI</span>
            <span className="text-4xl font-black text-gray-900 block mt-1">{validToday.length}</span>
            <span className="text-xs font-bold text-gray-600 block mt-0.5">
              {newPatientsToday.length} Baharu · {existingPatientsToday.length} Sedia Ada
            </span>
          </div>
        </div>

        <div className="p-6 bg-white rounded-2xl border-2 border-gray-300 shadow-sm flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-teal-50 text-teal-700">
            <Users className="w-10 h-10" />
          </div>
          <div>
            <span className="text-sm font-bold text-gray-500 uppercase block">MASTER PATIENT DATABASE</span>
            <span className="text-4xl font-black text-gray-900 block mt-1">{totalPatients}</span>
            <span className="text-xs font-bold text-gray-600 block mt-0.5">
              Kekal Selamanya · {inactivePatients} Tidak Aktif
            </span>
          </div>
        </div>

        <div className="p-6 bg-white rounded-2xl border-2 border-gray-300 shadow-sm flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-amber-50 text-amber-700">
            <Clock className="w-10 h-10" />
          </div>
          <div>
            <span className="text-sm font-bold text-gray-500 uppercase block">TARIKH & MASA OPERASI</span>
            <span className="text-2xl font-black text-gray-900 block mt-1">{formatDateDisplay(getTodayDateString())}</span>
            <span className="text-xs font-bold text-gray-600 block mt-0.5">
              Zon: Asia/Kuching (UTC+8)
            </span>
          </div>
        </div>

        <div className="p-6 bg-white rounded-2xl border-2 border-gray-300 shadow-sm flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-red-50 text-[#991B1B]">
            <AlertTriangle className="w-10 h-10" />
          </div>
          <div>
            <span className="text-sm font-bold text-gray-500 uppercase block">DIBATALKAN HARI INI</span>
            <span className="text-4xl font-black text-[#991B1B] block mt-1">{cancelledToday.length}</span>
            <span className="text-xs font-bold text-gray-600 block mt-0.5">
              Diasingkan Dari Reten Sah
            </span>
          </div>
        </div>
      </div>

      {/* 4 Category Breakdown Box */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 md:p-8 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-2xl font-black text-gray-900">PECAHAN 4 KATEGORI PENDAFTARAN HARI INI</h3>
            <p className="text-base text-gray-600 font-medium">Statistik kehadiran sah mengikut pintu masuk perkhidmatan JPL</p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Kemaskini</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl border-3 border-[#2F5D8A] bg-blue-50/60">
            <div className="flex items-center justify-between">
              <span className="font-black text-lg text-[#2F5D8A]">F/UP RUTIN</span>
              <CalendarCheck className="w-7 h-7 text-[#2F5D8A]" />
            </div>
            <span className="text-4xl font-black text-gray-900 block mt-3">{fupCount}</span>
            <span className="text-xs font-bold text-gray-600 mt-1 block">Temujanji Rawatan Ulangan</span>
          </div>

          <div className="p-5 rounded-2xl border-3 border-[#256D60] bg-teal-50/60">
            <div className="flex items-center justify-between">
              <span className="font-black text-lg text-[#256D60]">WALK-IN</span>
              <UserCheck className="w-7 h-7 text-[#256D60]" />
            </div>
            <span className="text-4xl font-black text-gray-900 block mt-3">{walkinCount}</span>
            <span className="text-xs font-bold text-gray-600 mt-1 block">Pesakit Hadir Terus</span>
          </div>

          <div className="p-5 rounded-2xl border-3 border-[#9A6014] bg-amber-50/60">
            <div className="flex items-center justify-between">
              <span className="font-black text-lg text-[#9A6014]">MEDICAL CHECK UP</span>
              <Stethoscope className="w-7 h-7 text-[#9A6014]" />
            </div>
            <span className="text-4xl font-black text-gray-900 block mt-3">{checkupCount}</span>
            <span className="text-xs font-bold text-gray-600 mt-1 block">Pemeriksaan Kesihatan</span>
          </div>

          <div className="p-5 rounded-2xl border-3 border-[#5C4D7D] bg-purple-50/60">
            <div className="flex items-center justify-between">
              <span className="font-black text-lg text-[#5C4D7D]">PROCEDURE ROOM</span>
              <Activity className="w-7 h-7 text-[#5C4D7D]" />
            </div>
            <span className="text-4xl font-black text-gray-900 block mt-3">{procedureCount}</span>
            <span className="text-xs font-bold text-gray-600 mt-1 block">Rawatan & Prosedur Ringkas</span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* BAHAGIAN LAPORAN BULANAN & SENARAI PESAKIT SEBULAN (REQ 5) */}
      {/* ======================================================== */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 md:p-8 shadow-sm space-y-6">
        {/* Header & Pemilih Bulan */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b-2 border-gray-200">
          <div>
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-[#2F5D8A]" />
              <h3 className="text-2xl font-black text-gray-900 uppercase">
                LAPORAN KEHADIRAN & SENARAI PESAKIT BULANAN
              </h3>
            </div>
            <p className="text-base text-gray-600 font-medium mt-1">
              Pecahan harian sepanjang bulan dan senarai lengkap pesakit yang hadir bagi tempoh sebulan
            </p>
          </div>

          {/* Pengawal Pemilihan Bulan */}
          <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-2xl border border-gray-300">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="p-2 rounded-xl hover:bg-white text-gray-700 transition cursor-pointer"
              title="Bulan Sebelumnya"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <span className="px-4 py-1 text-base font-black text-[#2F5D8A] whitespace-nowrap">
              {formatYearMonthDisplay(selectedMonth)}
            </span>

            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="p-2 rounded-xl hover:bg-white text-gray-700 transition cursor-pointer"
              title="Bulan Berikutnya"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Kad Ringkasan Bulan Terpilih */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-blue-50/50 rounded-2xl border-2 border-blue-200">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase block">JUMLAH KEHADIRAN SEBULAN:</span>
            <span className="text-3xl font-black text-[#2F5D8A] block mt-0.5">{totalSahMonth}</span>
            <span className="text-xs text-gray-600 font-semibold">{totalBatalMonth} Dibatalkan</span>
          </div>
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase block">PESAKIT UNIK:</span>
            <span className="text-3xl font-black text-gray-900 block mt-0.5">
              {monthlyReport?.totalUniquePatients || 0}
            </span>
            <span className="text-xs text-gray-600 font-semibold">Individu Berasingan</span>
          </div>
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase block">PESAKIT BAHARU:</span>
            <span className="text-3xl font-black text-emerald-700 block mt-0.5">{totalBaharuMonth}</span>
            <span className="text-xs text-gray-600 font-semibold">Daftar Pertama Kali</span>
          </div>
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase block">PESAKIT SEDIA ADA:</span>
            <span className="text-3xl font-black text-teal-700 block mt-0.5">{totalSediaAdaMonth}</span>
            <span className="text-xs text-gray-600 font-semibold">Lawatan Ulangan</span>
          </div>
        </div>

        {/* Tab Penukar: 1. Laporan Jumlah Harian Secara Bulanan vs 2. Senarai Pesakit Sebulan */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
          <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-xl border border-gray-300">
            <button
              type="button"
              onClick={() => setActiveTab('HARIAN')}
              className={`px-5 py-2.5 rounded-xl font-black text-sm transition cursor-pointer ${
                activeTab === 'HARIAN'
                  ? 'bg-[#2F5D8A] text-white shadow-md'
                  : 'text-gray-700 hover:bg-white'
              }`}
            >
              1. Laporan Jumlah Harian Secara Bulanan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('SENARAI_PESAKIT')}
              className={`px-5 py-2.5 rounded-xl font-black text-sm transition cursor-pointer ${
                activeTab === 'SENARAI_PESAKIT'
                  ? 'bg-[#2F5D8A] text-white shadow-md'
                  : 'text-gray-700 hover:bg-white'
              }`}
            >
              2. Senarai Pesakit Hadir ({allPatientsMonth.length})
            </button>
          </div>

          {/* Butang Export Excel */}
          <div>
            {activeTab === 'HARIAN' ? (
              <button
                type="button"
                onClick={exportDailyExcel}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-sm shadow cursor-pointer transition"
              >
                <Download className="w-4 h-4" />
                <span>Eksport Laporan Harian (Excel)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={exportPatientListExcel}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-sm shadow cursor-pointer transition"
              >
                <Download className="w-4 h-4" />
                <span>Eksport Senarai Pesakit (Excel)</span>
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: LAPORAN JUMLAH HARIAN PESAKIT SECARA BULANAN (BREAKDOWN 1-31 HARI) */}
        {activeTab === 'HARIAN' && (
          <div className="space-y-4">
            <div className="text-sm font-bold text-gray-700 flex items-center justify-between">
              <span>Jadual Pecahan Kehadiran Harian Sepanjang Bulan {formatYearMonthDisplay(selectedMonth)}</span>
              <span className="text-xs text-gray-500 font-semibold">*Rekod yang dibatalkan tidak dikira dalam jumlah sah</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border-2 border-gray-300">
              <table className="w-full text-left divide-y divide-gray-300 text-sm">
                <thead className="bg-[#2F5D8A] text-white text-xs font-black uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3">Tarikh</th>
                    <th className="py-3 px-2">Hari</th>
                    <th className="py-3 px-3 text-center bg-[#254A6F]">F/UP Rutin</th>
                    <th className="py-3 px-3 text-center bg-[#1d5b50]">Walk-In</th>
                    <th className="py-3 px-3 text-center bg-[#7a4c10]">Check Up</th>
                    <th className="py-3 px-3 text-center bg-[#493d63]">Procedure</th>
                    <th className="py-3 px-3 text-center">Baharu</th>
                    <th className="py-3 px-3 text-center">Sedia Ada</th>
                    <th className="py-3 px-3 text-center text-red-200">Batal</th>
                    <th className="py-3 px-4 text-center bg-blue-950 font-black text-white text-sm">JUMLAH SAH</th>
                    <th className="py-3 px-3 text-center">Tutup Hari</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white font-medium">
                  {monthDailySummaries.map((day) => {
                    const isWeekend = day.hari === 'Ahad' || day.hari === 'Sabtu';
                    const hasPatients = day.jumlah_sah > 0;
                    return (
                      <tr
                        key={day.tarikh}
                        className={`hover:bg-blue-50/70 transition ${
                          isWeekend ? 'bg-gray-50/80' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                          {day.tarikh}
                        </td>
                        <td className={`py-2.5 px-2 font-bold whitespace-nowrap ${isWeekend ? 'text-amber-800' : 'text-gray-700'}`}>
                          {day.hari}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-blue-900 bg-blue-50/30">
                          {day.fup > 0 ? day.fup : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-teal-900 bg-teal-50/30">
                          {day.walkin > 0 ? day.walkin : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-amber-900 bg-amber-50/30">
                          {day.checkup > 0 ? day.checkup : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-purple-900 bg-purple-50/30">
                          {day.procedure > 0 ? day.procedure : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-emerald-700">
                          {day.baharu > 0 ? day.baharu : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-gray-700">
                          {day.sedia_ada > 0 ? day.sedia_ada : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-red-600">
                          {day.batal > 0 ? day.batal : '-'}
                        </td>
                        <td className="py-2.5 px-4 text-center font-black text-base text-[#2F5D8A] bg-blue-50">
                          {day.jumlah_sah}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {day.tutup_hari ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-black bg-green-100 text-green-800">
                              SELESAI
                            </span>
                          ) : hasPatients ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
                              BELUM
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* FOOTER TOTAL BULANAN */}
                <tfoot className="bg-gray-100 font-black text-gray-900 border-t-3 border-gray-400">
                  <tr>
                    <td colSpan={2} className="py-3 px-3 uppercase text-base text-gray-900">
                      JUMLAH KESELURUHAN BULAN INI:
                    </td>
                    <td className="py-3 px-3 text-center text-base text-blue-900">{totalFupMonth}</td>
                    <td className="py-3 px-3 text-center text-base text-teal-900">{totalWalkinMonth}</td>
                    <td className="py-3 px-3 text-center text-base text-amber-900">{totalCheckupMonth}</td>
                    <td className="py-3 px-3 text-center text-base text-purple-900">{totalProcedureMonth}</td>
                    <td className="py-3 px-3 text-center text-base text-emerald-800">{totalBaharuMonth}</td>
                    <td className="py-3 px-3 text-center text-base text-gray-800">{totalSediaAdaMonth}</td>
                    <td className="py-3 px-3 text-center text-base text-red-700">{totalBatalMonth}</td>
                    <td className="py-3 px-4 text-center text-xl text-white bg-[#2F5D8A] font-black">
                      {totalSahMonth}
                    </td>
                    <td className="py-3 px-3 text-center text-xs text-gray-600">-</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: SENARAI JUMLAH PESAKIT YG HADIR UTK TEMPOH SEBULAN */}
        {activeTab === 'SENARAI_PESAKIT' && (
          <div className="space-y-4">
            {/* Filter & Cari Pesakit Sebulan */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Cari dalam senarai sebulan (RN, Nama atau No. HDalat)..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-gray-300 font-bold text-sm focus:outline-none focus:border-[#2F5D8A]"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="p-2.5 rounded-xl border-2 border-gray-300 font-bold text-sm bg-white cursor-pointer"
                >
                  <option value="SEMUA">Semua Kategori</option>
                  <option value="FUP_RUTIN">F/UP Rutin</option>
                  <option value="WALK_IN">Walk-In</option>
                  <option value="MEDICAL_CHECKUP">Medical Check-Up</option>
                  <option value="PROCEDURE_ROOM">Procedure Room</option>
                </select>
              </div>
            </div>

            {/* Jadual Senarai Pesakit Sebulan */}
            {filteredMonthPatients.length === 0 ? (
              <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                {allPatientsMonth.length === 0
                  ? `Tiada rekod kehadiran pesakit bagi bulan ${selectedMonth}.`
                  : `Tiada pesakit menepati carian atau penapis kategori.`}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-300 max-h-[600px] overflow-y-auto">
                <table className="w-full text-left divide-y divide-gray-200 text-sm">
                  <thead className="bg-[#2F5D8A] text-white text-xs font-black uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="py-3 px-3 w-12 text-center">Bil</th>
                      <th className="py-3 px-3">No. HDalat</th>
                      <th className="py-3 px-3">No. RN</th>
                      <th className="py-3 px-4">Nama Pesakit</th>
                      <th className="py-3 px-3">Kategori</th>
                      <th className="py-3 px-3">Tarikh & Masa</th>
                      <th className="py-3 px-3">Jenis</th>
                      <th className="py-3 px-2 text-center">Umur</th>
                      <th className="py-3 px-3">Warganegara</th>
                      <th className="py-3 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white font-medium">
                    {filteredMonthPatients.map((p, idx) => (
                      <tr
                        key={p.attendance_id}
                        className={`hover:bg-blue-50/70 transition ${
                          p.status === 'BATAL' ? 'bg-red-50/50 opacity-60' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center font-bold text-gray-500">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-black text-[#2F5D8A]">
                          {p.no_daftar}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-gray-900">
                          {p.no_rn}
                        </td>
                        <td className="py-2.5 px-4 font-black text-gray-900 uppercase">
                          {p.nama_pesakit}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {p.kategori === 'FUP_RUTIN' && (
                            <span className="px-2 py-0.5 rounded text-xs font-black bg-blue-100 text-[#2F5D8A]">F/UP RUTIN</span>
                          )}
                          {p.kategori === 'WALK_IN' && (
                            <span className="px-2 py-0.5 rounded text-xs font-black bg-teal-100 text-[#256D60]">WALK-IN</span>
                          )}
                          {p.kategori === 'MEDICAL_CHECKUP' && (
                            <span className="px-2 py-0.5 rounded text-xs font-black bg-amber-100 text-[#9A6014]">CHECK UP</span>
                          )}
                          {p.kategori === 'PROCEDURE_ROOM' && (
                            <span className="px-2 py-0.5 rounded text-xs font-black bg-purple-100 text-[#5C4D7D]">PROCEDURE</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap font-bold text-gray-700">
                          {p.tarikh} ({p.masa ? p.masa.substring(0, 5) : '-'})
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {p.pesakit_baharu ? (
                            <span className="px-2 py-0.5 rounded text-xs font-black bg-emerald-100 text-emerald-800">
                              Baharu
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-700">
                              Ulangan
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center font-bold text-gray-800">
                          {p.umur_tahun} thn
                        </td>
                        <td className="py-2.5 px-3 text-xs font-bold text-gray-700">
                          {p.kewarganegaraan}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {p.status === 'SAH' ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-green-100 text-green-800">
                              SAH
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-black bg-red-100 text-red-800">
                              BATAL
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Supervisor Status Panel */}
      {session.role === 'PENYELIA' && (
        <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 md:p-8 shadow-sm space-y-4">
          <h3 className="text-2xl font-black text-gray-900">PANEL STATUS KAWALAN PENYELIA</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-sm font-bold text-gray-500 block">BACKUP MINGGUAN TERAKHIR</span>
              {lastWeeklyBackup ? (
                <div className="mt-2">
                  <span className="text-lg font-black text-gray-900 block">{lastWeeklyBackup.nama_fail}</span>
                  <span className="text-xs font-bold text-green-700 block mt-1">
                    {lastWeeklyBackup.status_pengesahan} ({formatDateDisplay(lastWeeklyBackup.tarikh)})
                  </span>
                </div>
              ) : (
                <span className="text-sm font-bold text-amber-700 mt-2 block">
                  Tiada rekod backup mingguan dibuat lagi.
                </span>
              )}
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-sm font-bold text-gray-500 block">PERMOHONAN PEMBETULAN PROFIL</span>
              <span className="text-3xl font-black text-gray-900 block mt-2">{pendingCorrections.length}</span>
              <button
                type="button"
                onClick={() => onNavigate('permohonan')}
                className="text-xs font-bold text-[#2F5D8A] hover:underline mt-1 block cursor-pointer"
              >
                Lihat Senarai Menunggu &rarr;
              </button>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-sm font-bold text-gray-500 block">STATUS PEMBERSIHAN 4 BULAN</span>
              <span className="text-lg font-black text-gray-900 block mt-2">
                {monthStatusList.filter((m) => m.status === 'DIARKIB').length} Bulan Berstatus Diarkib
              </span>
              <button
                type="button"
                onClick={() => onNavigate('penutupan')}
                className="text-xs font-bold text-[#2F5D8A] hover:underline mt-1 block cursor-pointer"
              >
                Urus Penutupan & Arkib &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
