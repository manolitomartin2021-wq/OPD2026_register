import React, { useState, useEffect, useRef } from 'react';
import type { Attendance, AttendanceCategory, Patient, ActiveSession } from '../../types';
import {
  searchPatients,
  registerAttendance,
  getPatientById,
} from '../../data/dataService';
import { getDatabase } from '../../data/db';
import { CategoryButton } from '../../components/veteran/CategoryButton';
import { NewPatientModal } from './NewPatientModal';
import { PrintModal } from '../../print/PrintModal';
import { PageHelp } from '../../components/veteran/PageHelp';
import { calculateAge, formatDateDisplay, getTodayDateString, getCurrentTimeString } from '../../utils/dateUtils';
import { maskIdentity } from '../../utils/normalize';
import {
  Search,
  UserPlus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Printer,
  X,
  Lock,
  Calendar,
  RefreshCw,
  FileText,
  UserCheck,
} from 'lucide-react';

interface PendaftaranViewProps {
  session: ActiveSession;
}

interface TodayAttendanceItem extends Attendance {
  patient?: Patient;
}

export const PendaftaranView: React.FC<PendaftaranViewProps> = ({ session }) => {
  const [kategori, setKategori] = useState<AttendanceCategory>('FUP_RUTIN');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Late Entry Mode
  const [isLateEntry, setIsLateEntry] = useState(false);
  const [actualDate, setActualDate] = useState(getTodayDateString());
  const [actualTime, setActualTime] = useState(getCurrentTimeString().substring(0, 5));
  const [manualSlipRef, setManualSlipRef] = useState('');
  const [notes, setNotes] = useState('');

  // Modals
  const [showNewPatientModal, setShowNewPatientModal] = useState(false);
  const [printAttendance, setPrintAttendance] = useState<Attendance | null>(null);
  const [printPatient, setPrintPatient] = useState<Patient | null>(null);
  const [registeredSuccess, setRegisteredSuccess] = useState<{ attendance: Attendance; patient: Patient } | null>(null);

  // Same Day Duplicate Override Modal
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateErrorDetails, setDuplicateErrorDetails] = useState('');
  const [supervisorUsername, setSupervisorUsername] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState('');

  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState('');

  // Senarai Pesakit Didaftarkan Sepanjang Hari (Requirement 4)
  const [todayAttendances, setTodayAttendances] = useState<TodayAttendanceItem[]>([]);
  const [todayFilter, setTodayFilter] = useState('');
  const [loadingToday, setLoadingToday] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadTodayAttendances = async () => {
    setLoadingToday(true);
    try {
      const db = getDatabase();
      const today = getTodayDateString();
      const list = await db.attendances.where('tarikh').equals(today).toArray();
      // Susun mengikut masa terkini di atas
      list.sort((a, b) => b.masa.localeCompare(a.masa));

      const pIds = Array.from(new Set(list.map((a) => a.patient_id)));
      const patients = await db.patients.where('patient_id').anyOf(pIds).toArray();
      const map = new Map(patients.map((p) => [p.patient_id, p]));

      const enriched: TodayAttendanceItem[] = list.map((a) => ({
        ...a,
        patient: map.get(a.patient_id),
      }));

      setTodayAttendances(enriched);
    } catch (err) {
      console.error('Error loading today attendances:', err);
    } finally {
      setLoadingToday(false);
    }
  };

  useEffect(() => {
    // Focus search on mount
    searchInputRef.current?.focus();
    loadTodayAttendances();
  }, []);

  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (val.trim().length >= 2) {
      setIsSearching(true);
      try {
        const res = await searchPatients(val);
        setSearchResults(res);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setSearchResults([]);
    setGeneralError('');
  };

  const handleRegister = async (isOverridden = false) => {
    if (!selectedPatient) {
      setGeneralError('Sila cari dan pilih pesakit terlebih dahulu.');
      return;
    }

    setGeneralError('');
    setSaving(true);

    try {
      const payload: any = {
        patient_id: selectedPatient.patient_id,
        kategori,
        catatan: notes,
        kemasukan_lewat: isLateEntry,
        tarikh_sebenar: isLateEntry ? actualDate : undefined,
        masa_sebenar: isLateEntry ? `${actualTime}:00` : undefined,
        no_rujukan_manual: isLateEntry ? manualSlipRef : undefined,
      };

      if (isOverridden) {
        payload.pengecualian_oleh = supervisorUsername || session.username;
        payload.sebab_pengecualian = overrideReason;
      }

      const attendance = await registerAttendance(payload);

      // Successfully saved! Paparkan pop up berjaya didaftarkan (abaikan auto pop-up cetak slip)
      setRegisteredSuccess({
        attendance,
        patient: selectedPatient,
      });

      // Reset selection
      setSelectedPatient(null);
      setSearchQuery('');
      setNotes('');
      setIsLateEntry(false);
      setManualSlipRef('');
      setShowDuplicateModal(false);

      // Kemaskini senarai pendaftaran hari ini dengan segera
      await loadTodayAttendances();
    } catch (err: any) {
      const msg = err.message || 'Ralat pendaftaran.';
      if (msg.includes('Kelulusan Penyelia diperlukan')) {
        setDuplicateErrorDetails(msg);
        setShowDuplicateModal(true);
      } else {
        setGeneralError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const patientAge = selectedPatient ? calculateAge(selectedPatient.tarikh_lahir) : { display: '-' };
  const maskedDoc = selectedPatient ? maskIdentity(selectedPatient.no_dokumen || selectedPatient.no_pasport) : '-';

  // Filtered Today List
  const filteredToday = todayAttendances.filter((item) => {
    if (!todayFilter.trim()) return true;
    const q = todayFilter.toLowerCase();
    const nama = (item.patient?.nama_pesakit || '').toLowerCase();
    const rn = (item.patient?.no_rn || '').toLowerCase();
    const hdalat = item.no_daftar.toLowerCase();
    const doc = (item.patient?.no_dokumen || item.patient?.no_pasport || '').toLowerCase();
    return nama.includes(q) || rn.includes(q) || hdalat.includes(q) || doc.includes(q);
  });

  const getCategoryBadge = (kat: AttendanceCategory) => {
    switch (kat) {
      case 'FUP_RUTIN':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-blue-100 text-[#2F5D8A]">F/UP RUTIN</span>;
      case 'WALK_IN':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-teal-100 text-[#256D60]">WALK-IN</span>;
      case 'MEDICAL_CHECKUP':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-100 text-[#9A6014]">CHECK UP</span>;
      case 'PROCEDURE_ROOM':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-purple-100 text-[#5C4D7D]">PROCEDURE</span>;
      default:
        return <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-gray-100 text-gray-800">{kat}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHelp
        title="Pendaftaran Kehadiran Pesakit JPL"
        points={[
          'Langkah 1: Tekan salah satu daripada 4 Kategori Pendaftaran (F/UP Rutin, Walk-In, Medical Check Up, atau Procedure Room).',
          'Langkah 2: Taip No. RN, No. KP (MyKad), No. Pasport atau Nama Pesakit. Tekan pesakit daripada senarai keputusan.',
          'Langkah 3: Sahkan butiran pesakit, kemudian tekan butang besar "DAFTAR KEHADIRAN (CETAK SLIP)".',
          'Senarai Pesakit Didaftarkan Sepanjang Hari dipaparkan di bawah untuk semakan giliran dan cetakan semula slip.',
        ]}
      />

      {/* STEP 1: FOUR GIANT CATEGORY BUTTONS */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 shadow-sm">
        <label className="block text-base font-black text-gray-800 uppercase tracking-wide mb-3">
          1. PILIH KATEGORI PENDAFTARAN:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CategoryButton
            category="FUP_RUTIN"
            isSelected={kategori === 'FUP_RUTIN'}
            onClick={() => setKategori('FUP_RUTIN')}
            shortcut="F1"
          />
          <CategoryButton
            category="WALK_IN"
            isSelected={kategori === 'WALK_IN'}
            onClick={() => setKategori('WALK_IN')}
            shortcut="F2"
          />
          <CategoryButton
            category="MEDICAL_CHECKUP"
            isSelected={kategori === 'MEDICAL_CHECKUP'}
            onClick={() => setKategori('MEDICAL_CHECKUP')}
            shortcut="F3"
          />
          <CategoryButton
            category="PROCEDURE_ROOM"
            isSelected={kategori === 'PROCEDURE_ROOM'}
            onClick={() => setKategori('PROCEDURE_ROOM')}
            shortcut="F4"
          />
        </div>
      </div>

      {/* STEP 2: SEARCH OR SELECT PATIENT */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 md:p-8 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <label className="text-xl font-black text-gray-900 uppercase">
            2. CARI PESAKIT DALAM MASTER DATABASE:
          </label>
          <button
            type="button"
            onClick={() => setShowNewPatientModal(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-black text-base shadow transition cursor-pointer"
          >
            <UserPlus className="w-5 h-5 text-white" />
            <span>DAFTAR PESAKIT BAHARU</span>
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
            <Search className="w-7 h-7 text-[#2F5D8A]" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Taip No. RN, No. KP (MyKad), No. Pasport, atau Nama Pesakit..."
            className="w-full pl-14 pr-4 py-4 rounded-2xl border-3 border-gray-400 font-bold text-xl focus:outline-none focus:border-[#2F5D8A] focus:ring-4 focus:ring-blue-100"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-800 cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown List */}
        {searchResults.length > 0 && (
          <div className="border-3 border-[#2F5D8A] rounded-2xl bg-white shadow-xl max-h-80 overflow-y-auto divide-y divide-gray-200">
            {searchResults.map((p) => {
              const age = calculateAge(p.tarikh_lahir);
              return (
                <div
                  key={p.patient_id}
                  onClick={() => handleSelectPatient(p)}
                  className="p-4 hover:bg-blue-50 cursor-pointer transition flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-xl text-gray-900 uppercase">
                        {p.nama_pesakit}
                      </span>
                      <span className="px-2.5 py-0.5 rounded text-xs font-black bg-blue-100 text-[#2F5D8A]">
                        {p.no_rn}
                      </span>
                      {p.status_pesakit === 'TIDAK AKTIF' && (
                        <span className="px-2 py-0.5 rounded text-xs font-black bg-amber-100 text-amber-800">
                          TIDAK AKTIF
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-gray-600 mt-1">
                      Dokumen: {maskIdentity(p.no_dokumen || p.no_pasport)} · {age.display} · {p.jantina} · {p.kewarganegaraan}
                    </div>
                  </div>
                  <span className="px-4 py-2 bg-[#2F5D8A] text-white font-bold text-sm rounded-xl">
                    PILIH PESAKIT
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Selected Patient Confirmation Card */}
        {selectedPatient ? (
          <div className="p-6 rounded-2xl border-3 border-green-600 bg-green-50/70 space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-700 flex-shrink-0" />
                <div>
                  <span className="text-xs font-black uppercase text-green-800 tracking-wider">
                    PESAKIT DIPILIH (SILA SAHKAN IDENTITI):
                  </span>
                  <h3 className="text-3xl font-black text-gray-900 uppercase mt-0.5">
                    {selectedPatient.nama_pesakit}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                className="px-3 py-1.5 rounded-lg border border-gray-400 bg-white font-bold text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
              >
                Tukar Pesakit
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-white rounded-xl border border-green-200">
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase block">NO. RN:</span>
                <span className="text-xl font-black text-[#2F5D8A] block">{selectedPatient.no_rn}</span>
              </div>
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase block">NO. DOKUMEN:</span>
                <span className="text-lg font-bold text-gray-900 block">{maskedDoc}</span>
              </div>
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase block">UMUR & JANTINA:</span>
                <span className="text-lg font-bold text-gray-900 block">
                  {patientAge.display} · {selectedPatient.jantina}
                </span>
              </div>
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase block">STATUS PESAKIT:</span>
                <span
                  className={`text-lg font-black block ${
                    selectedPatient.status_pesakit === 'AKTIF'
                      ? 'text-green-700'
                      : selectedPatient.status_pesakit === 'TIDAK AKTIF'
                      ? 'text-amber-700'
                      : 'text-red-700'
                  }`}
                >
                  {selectedPatient.status_pesakit}
                  {selectedPatient.status_pesakit === 'TIDAK AKTIF' && (
                    <span className="text-xs font-bold block text-amber-800">
                      (Akan diaktifkan semula automatik)
                    </span>
                  )}
                </span>
              </div>
            </div>

            {selectedPatient.tarikh_kehadiran_terakhir && (
              <div className="text-sm font-bold text-gray-600">
                Tarikh Kehadiran Terakhir: {formatDateDisplay(selectedPatient.tarikh_kehadiran_terakhir)}
              </div>
            )}
          </div>
        ) : (
          !isSearching &&
          searchQuery.trim().length >= 2 &&
          searchResults.length === 0 && (
            <div className="p-6 bg-amber-50 rounded-2xl border-2 border-amber-300 text-center space-y-3">
              <p className="text-lg font-bold text-amber-900">
                Tiada pesakit dijumpai dengan carian "{searchQuery}".
              </p>
              <button
                type="button"
                onClick={() => setShowNewPatientModal(true)}
                className="py-3 px-6 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-black text-base shadow cursor-pointer"
              >
                Daftar Sebagai Pesakit Baharu Sekarang
              </button>
            </div>
          )
        )}
      </div>

      {/* STEP 3: REGISTRATION OPTIONS & SUBMIT */}
      {selectedPatient && (
        <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 md:p-8 shadow-sm space-y-6">
          <h3 className="text-xl font-black text-gray-900 uppercase">
            3. BUTIRAN PENDAFTARAN & KEMASUKAN:
          </h3>

          {/* Late Entry Checkbox */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-300 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isLateEntry}
                onChange={(e) => setIsLateEntry(e.target.checked)}
                className="w-6 h-6 rounded border-gray-400 text-[#2F5D8A] focus:ring-blue-400 cursor-pointer"
              />
              <span className="text-base font-bold text-gray-900">
                Mod Kemasukan Lewat (PC Rosak / Gangguan Bekalan Kuasa)
              </span>
            </label>

            {isLateEntry && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-200">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Tarikh Sebenar Kehadiran:
                  </label>
                  <input
                    type="date"
                    value={actualDate}
                    onChange={(e) => setActualDate(e.target.value)}
                    className="w-full p-2.5 rounded-lg border-2 border-gray-400 font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Masa Sebenar Kehadiran (HH:mm):
                  </label>
                  <input
                    type="time"
                    value={actualTime}
                    onChange={(e) => setActualTime(e.target.value)}
                    className="w-full p-2.5 rounded-lg border-2 border-gray-400 font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    No. Rujukan Borang Manual:
                  </label>
                  <input
                    type="text"
                    value={manualSlipRef}
                    onChange={(e) => setManualSlipRef(e.target.value)}
                    placeholder="cth: MAN-2026/045"
                    className="w-full p-2.5 rounded-lg border-2 border-gray-400 font-bold text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-base font-bold text-gray-800 mb-1">
              Catatan Pendaftaran (Pilihan):
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="cth: Temujanji Dr. Wong / Rujukan Klinik Kesihatan Belawai"
              className="w-full p-3.5 rounded-xl border-2 border-gray-400 font-bold text-base focus:outline-none focus:border-[#2F5D8A]"
            />
          </div>

          {generalError && (
            <div className="p-4 bg-red-50 border-2 border-[#991B1B] text-[#991B1B] rounded-xl font-bold flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          {/* Giant Register Button */}
          <div className="pt-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleRegister(false)}
              className="w-full py-5 rounded-2xl bg-[#2F5D8A] hover:bg-[#254A6F] text-white font-black text-2xl flex items-center justify-center gap-4 shadow-xl transition focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle className="w-8 h-8 text-emerald-300" />
              <span>
                {saving ? 'MENYIMPAN PENDAFTARAN...' : 'DAFTAR KEHADIRAN PESAKIT'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: SENARAI PESAKIT YG TELAH DIDAFTARKAN SEPANJANG HARI (REQUIREMENT 4) */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 md:p-8 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-2 border-b-2 border-gray-200">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-2xl font-black text-gray-900 uppercase">
                SENARAI PENDAFTARAN PESAKIT SEPANJANG HARI INI
              </h3>
              <span className="px-3 py-1 rounded-full bg-blue-100 text-[#2F5D8A] font-black text-sm">
                {todayAttendances.filter((a) => a.status === 'SAH').length} Pesakit Sah
              </span>
              {todayAttendances.some((a) => a.status === 'BATAL') && (
                <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 font-black text-sm">
                  {todayAttendances.filter((a) => a.status === 'BATAL').length} Batal
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-600 mt-1">
              Tarikh: {formatDateDisplay(getTodayDateString())} · Paparan langsung masa-nyata untuk kaunter pendaftaran
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <input
                type="text"
                value={todayFilter}
                onChange={(e) => setTodayFilter(e.target.value)}
                placeholder="Cari RN, Nama, No. HDalat..."
                className="w-full pl-10 pr-4 py-2.5 text-sm font-bold border-2 border-gray-300 rounded-xl focus:outline-none focus:border-[#2F5D8A]"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
            </div>

            <button
              type="button"
              onClick={loadTodayAttendances}
              disabled={loadingToday}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm flex items-center gap-2 border border-gray-300 cursor-pointer disabled:opacity-50"
              title="Segar semula senarai hari ini"
            >
              <RefreshCw className={`w-4 h-4 ${loadingToday ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Segar Semula</span>
            </button>
          </div>
        </div>

        {/* Jadual Pendaftaran Sepanjang Hari */}
        {filteredToday.length === 0 ? (
          <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
            {todayAttendances.length === 0
              ? 'Belum ada pendaftaran dibuat sepanjang hari ini. Mulakan pendaftaran di atas.'
              : `Tiada pendaftaran menepati carian "${todayFilter}".`}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-left divide-y divide-gray-200">
              <thead className="bg-[#2F5D8A] text-white text-xs font-black uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3 w-12 text-center">Bil</th>
                  <th className="py-3 px-3">No. HDalat</th>
                  <th className="py-3 px-3">No. RN</th>
                  <th className="py-3 px-4">Nama Pesakit</th>
                  <th className="py-3 px-3">Kategori</th>
                  <th className="py-3 px-3">Masa</th>
                  <th className="py-3 px-3">Jenis</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white text-sm font-medium">
                {filteredToday.map((item, idx) => (
                  <tr
                    key={item.attendance_id}
                    className={`hover:bg-blue-50/60 transition ${
                      item.status === 'BATAL' ? 'bg-red-50/50 opacity-60' : ''
                    }`}
                  >
                    <td className="py-3 px-3 text-center font-bold text-gray-500">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono font-black text-base text-[#2F5D8A]">
                        {item.no_daftar}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono font-bold text-gray-900">
                        {item.patient?.no_rn || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-black text-gray-900 uppercase">
                        {item.patient?.nama_pesakit || 'Pesakit'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.patient?.no_dokumen ? maskIdentity(item.patient.no_dokumen) : item.patient?.no_pasport || '-'} · {item.umur_tahun} thn
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getCategoryBadge(item.kategori)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap font-bold text-gray-700">
                      {item.masa ? item.masa.substring(0, 5) : '-'}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {item.pesakit_baharu ? (
                        <span className="px-2 py-0.5 rounded text-xs font-black bg-emerald-100 text-emerald-800">
                          Baharu
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-700">
                          Ulangan
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {item.status === 'SAH' ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-green-100 text-green-800">
                          SAH
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-red-100 text-red-800">
                          BATAL
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setPrintAttendance(item);
                          setPrintPatient(item.patient || null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-[#2F5D8A] hover:bg-blue-100 border border-blue-200 font-bold text-xs cursor-pointer"
                        title="Cetak semula slip giliran"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Slip</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: Same Day Duplicate Category Supervisor Override */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 md:p-8 shadow-2xl border-4 border-amber-600 space-y-4">
            <div className="flex items-center gap-3 text-amber-800">
              <AlertTriangle className="w-10 h-10 flex-shrink-0" />
              <h3 className="text-2xl font-black">PENDAFTARAN BERGANDA DIKESAN</h3>
            </div>
            <p className="text-base text-gray-800 font-medium whitespace-pre-line">
              {duplicateErrorDetails}
            </p>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-300 text-sm font-bold text-amber-900 space-y-3">
              <p>Kelulusan Penyelia di kaunter diperlukan untuk pendaftaran kali kedua bagi kategori yang sama pada hari yang sama.</p>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nama Pengguna Penyelia:
                </label>
                <input
                  type="text"
                  value={supervisorUsername}
                  onChange={(e) => setSupervisorUsername(e.target.value)}
                  placeholder="Incharge"
                  className="w-full p-2.5 rounded-lg border border-gray-400 font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Kata Laluan Penyelia:
                </label>
                <input
                  type="password"
                  value={supervisorPassword}
                  onChange={(e) => setSupervisorPassword(e.target.value)}
                  placeholder="Incharge123"
                  className="w-full p-2.5 rounded-lg border border-gray-400 font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Sebab Kelulusan Pengecualian (WAJIB):
                </label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="cth: Pesakit hadir semula selepas ujian makmal petang"
                  className="w-full p-2.5 rounded-lg border border-gray-400 font-bold"
                />
              </div>
            </div>

            {overrideError && (
              <p className="text-sm font-bold text-red-700">{overrideError}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="w-1/2 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-base text-gray-800 cursor-pointer"
              >
                BATAL
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!overrideReason.trim()) {
                    setOverrideError('Sila isi sebab pengecualian.');
                    return;
                  }
                  handleRegister(true);
                }}
                className="w-1/2 py-3 rounded-xl bg-amber-700 hover:bg-amber-800 font-black text-base text-white shadow cursor-pointer"
              >
                LULUSKAN PENDAFTARAN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: New Patient */}
      <NewPatientModal
        isOpen={showNewPatientModal}
        onClose={() => setShowNewPatientModal(false)}
        initialQuery={searchQuery}
        onPatientCreated={(newP) => {
          setSelectedPatient(newP);
          setShowNewPatientModal(false);
        }}
      />

      {/* POP-UP: BERJAYA DIDAFTARKAN (PENGGANTI AUTO-SLIP CETAK) */}
      {registeredSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 md:p-8 shadow-2xl border-4 border-green-600 space-y-5 text-center">
            <div className="w-20 h-20 bg-green-100 text-green-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle className="w-12 h-12" />
            </div>

            <div>
              <span className="text-xs font-black uppercase tracking-wider text-green-700 bg-green-100 px-3 py-1 rounded-full">
                PENDAFTARAN SELESAI
              </span>
              <h3 className="text-2xl font-black text-gray-900 mt-2 uppercase">
                PESAKIT BERJAYA DIDAFTARKAN!
              </h3>
              <p className="text-sm font-semibold text-gray-600 mt-1">
                Data kehadiran pesakit telah disimpan ke dalam sistem Hospital Dalat.
              </p>
            </div>

            <div className="p-5 bg-green-50/80 rounded-2xl border-2 border-green-200 text-left space-y-3">
              <div className="flex justify-between items-center border-b border-green-200 pb-2">
                <span className="text-xs font-black text-gray-600 uppercase">NO. GILIRAN / HDALAT:</span>
                <span className="text-2xl font-black text-[#2F5D8A] font-mono">
                  {registeredSuccess.attendance.no_daftar}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-600 uppercase">NAMA PESAKIT:</span>
                <span className="text-base font-black text-gray-900 uppercase">
                  {registeredSuccess.patient.nama_pesakit}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-600 uppercase">NO. RN:</span>
                <span className="text-sm font-black text-gray-800 font-mono">
                  {registeredSuccess.patient.no_rn}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-600 uppercase">KATEGORI:</span>
                <div>{getCategoryBadge(registeredSuccess.attendance.kategori)}</div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-gray-600 uppercase">MASA DAFTAR:</span>
                <span className="text-sm font-bold text-gray-800">
                  {registeredSuccess.attendance.masa ? registeredSuccess.attendance.masa.substring(0, 5) : '-'} (Hari Ini)
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPrintAttendance(registeredSuccess.attendance);
                  setPrintPatient(registeredSuccess.patient);
                }}
                className="w-full sm:w-1/2 py-3.5 px-4 rounded-xl border-2 border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Slip (Pilihan)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRegisteredSuccess(null);
                  searchInputRef.current?.focus();
                }}
                className="w-full sm:w-1/2 py-3.5 px-4 rounded-xl bg-green-700 hover:bg-green-800 text-white font-black text-base shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle className="w-5 h-5" />
                <span>DAFTAR SETERUSNYA</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Print Slip (Cetak Semula Manual Sahaja) */}
      {printAttendance && printPatient && (
        <PrintModal
          isOpen={true}
          attendance={printAttendance}
          patient={printPatient}
          onClose={() => {
            setPrintAttendance(null);
            setPrintPatient(null);
          }}
        />
      )}
    </div>
  );
};
