import React, { useState, useEffect } from 'react';
import { getDatabase } from '../../data/db';
import type { ActiveSession } from '../../types';
import { runIntegrityCheck, type IntegrityCheckResult } from '../../data/dataService';
import { PageHelp } from '../../components/veteran/PageHelp';
import {
  Settings,
  Clock,
  Printer,
  Bell,
  HardDrive,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Save,
} from 'lucide-react';

interface TetapanViewProps {
  session: ActiveSession;
}

export const TetapanView: React.FC<TetapanViewProps> = ({ session }) => {
  const [autoLockMinutes, setAutoLockMinutes] = useState(5);
  const [printerFormat, setPrinterFormat] = useState<'A4' | 'THERMAL_80MM'>('A4');
  const [fridayTime, setFridayTime] = useState('16:00');
  const [snoozeMinutes, setSnoozeMinutes] = useState(30);
  const [etnikList, setEtnikList] = useState<string[]>([]);
  const [newEtnik, setNewEtnik] = useState('');

  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);
  const [storageQuota, setStorageQuota] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  // Integrity Check
  const [integrityResult, setIntegrityResult] = useState<IntegrityCheckResult | null>(null);
  const [runningCheck, setRunningCheck] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const db = getDatabase();
      const lockS = await db.system_settings.get('tempoh_auto_lock');
      if (lockS) setAutoLockMinutes(lockS.value);

      const printS = await db.system_settings.get('printer_settings');
      if (printS) setPrinterFormat(printS.value);

      const friTimeS = await db.system_settings.get('peringatan_masa');
      if (friTimeS) setFridayTime(friTimeS.value);

      const snoozeS = await db.system_settings.get('peringatan_tunda_minit');
      if (snoozeS) setSnoozeMinutes(snoozeS.value);

      const etnikS = await db.system_settings.get('ref_etnik');
      if (etnikS && Array.isArray(etnikS.value)) {
        setEtnikList(etnikS.value);
      }

      if (navigator.storage && navigator.storage.persisted) {
        navigator.storage.persisted().then(setStoragePersisted);
      }
      if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then((est) => {
          if (est.quota) {
            const mb = Math.round(est.quota / (1024 * 1024));
            setStorageQuota(`${mb} MB`);
          }
        });
      }
    };
    loadSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const db = getDatabase();
    await db.transaction('rw', db.system_settings, async () => {
      await db.system_settings.put({ key: 'tempoh_auto_lock', value: autoLockMinutes, updated_at: new Date().toISOString() });
      await db.system_settings.put({ key: 'printer_settings', value: printerFormat, updated_at: new Date().toISOString() });
      await db.system_settings.put({ key: 'peringatan_masa', value: fridayTime, updated_at: new Date().toISOString() });
      await db.system_settings.put({ key: 'peringatan_tunda_minit', value: snoozeMinutes, updated_at: new Date().toISOString() });
      await db.system_settings.put({ key: 'ref_etnik', value: etnikList, updated_at: new Date().toISOString() });
    });

    setSavedMsg('Tetapan sistem berjaya disimpan!');
    setTimeout(() => setSavedMsg(''), 3000);
  };

  const handleAddEtnik = () => {
    if (!newEtnik.trim()) return;
    const clean = newEtnik.trim().toUpperCase();
    if (!etnikList.includes(clean)) {
      setEtnikList([...etnikList, clean]);
      setNewEtnik('');
    }
  };

  const handleRemoveEtnik = (val: string) => {
    setEtnikList(etnikList.filter((e) => e !== val));
  };

  const handleRunIntegrityCheck = async () => {
    setRunningCheck(true);
    setIntegrityResult(null);
    try {
      const res = await runIntegrityCheck();
      setIntegrityResult(res);
    } catch (err: any) {
      alert('Ralat semakan: ' + err.message);
    } finally {
      setRunningCheck(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHelp
        title="Tetapan Sistem JPL Hospital Dalat"
        points={[
          'Konfigurasikan masa peringatan salin data mingguan Jumaat (lalai 16:00).',
          'Tetapkan tempoh auto-lock antara 2 hingga 15 minit bagi keselamatan semasa PC ditinggalkan tanpa pengawasan.',
          'Uruskan senarai etnik tempatan Sarawak untuk borang pendaftaran pesakit.',
          'Jalankan Semakan Integriti Penuh untuk mengesahkan tiada rekod yatim atau nombor jujukan bertindih.',
        ]}
      />

      {savedMsg && (
        <div className="p-4 bg-green-50 border-2 border-green-600 rounded-2xl text-green-900 font-bold flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-700" />
          <span>{savedMsg}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Basic Preferences Card */}
        <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 md:p-8 shadow-sm space-y-6">
          <h3 className="text-2xl font-black text-gray-900">TETAPAN OPERASI KAUNTER</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-base font-bold text-gray-800 mb-1">
                Tempoh Kunci Automatik (Auto-Lock):
              </label>
              <select
                value={autoLockMinutes}
                onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                className="w-full p-3.5 rounded-xl border-2 border-gray-400 font-bold text-base"
              >
                <option value={2}>2 Minit</option>
                <option value={5}>5 Minit (Lalai)</option>
                <option value={10}>10 Minit</option>
                <option value={15}>15 Minit</option>
              </select>
            </div>

            <div>
              <label className="block text-base font-bold text-gray-800 mb-1">
                Format Cetakan Slip Lalai:
              </label>
              <select
                value={printerFormat}
                onChange={(e) => setPrinterFormat(e.target.value as any)}
                className="w-full p-3.5 rounded-xl border-2 border-gray-400 font-bold text-base"
              >
                <option value="A4">A4 Standard (Laser / Inkjet)</option>
                <option value="THERMAL_80MM">Thermal 80mm (Kiosk Giliran)</option>
              </select>
            </div>

            <div>
              <label className="block text-base font-bold text-gray-800 mb-1">
                Masa Peringatan Salin Data (Jumaat):
              </label>
              <input
                type="time"
                value={fridayTime}
                onChange={(e) => setFridayTime(e.target.value)}
                className="w-full p-3.5 rounded-xl border-2 border-gray-400 font-bold text-base"
              />
            </div>

            <div>
              <label className="block text-base font-bold text-gray-800 mb-1">
                Tempoh Tunda Peringatan (Minit):
              </label>
              <select
                value={snoozeMinutes}
                onChange={(e) => setSnoozeMinutes(Number(e.target.value))}
                className="w-full p-3.5 rounded-xl border-2 border-gray-400 font-bold text-base"
              >
                <option value={15}>15 Minit</option>
                <option value={30}>30 Minit (Lalai)</option>
                <option value={60}>60 Minit (1 Jam)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Reference: Ethnic list */}
        <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 md:p-8 shadow-sm space-y-4">
          <h3 className="text-2xl font-black text-gray-900">SENARAI RUJUKAN ETNIK (SARAWAK)</h3>
          <p className="text-sm font-semibold text-gray-600">
            Senarai pilihan etnik yang dipaparkan dalam borang pendaftaran pesakit baharu:
          </p>

          <div className="flex flex-wrap gap-2">
            {etnikList.map((e) => (
              <span
                key={e}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-100 text-[#2F5D8A] font-black text-sm"
              >
                {e}
                <button
                  type="button"
                  onClick={() => handleRemoveEtnik(e)}
                  className="text-red-600 hover:text-red-900 font-bold"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2 max-w-md pt-2">
            <input
              type="text"
              value={newEtnik}
              onChange={(e) => setNewEtnik(e.target.value.toUpperCase())}
              placeholder="Tambah Etnik Baharu..."
              className="p-3 rounded-xl border-2 border-gray-400 font-bold text-sm flex-1 uppercase"
            />
            <button
              type="button"
              onClick={handleAddEtnik}
              className="px-5 py-3 rounded-xl bg-[#2F5D8A] hover:bg-[#254A6F] text-white font-bold text-sm"
            >
              Tambah
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="py-4 px-8 rounded-2xl bg-[#2F5D8A] hover:bg-[#254A6F] text-white font-black text-xl flex items-center gap-3 shadow-lg"
          >
            <Save className="w-6 h-6 text-white" />
            <span>SIMPAN TETAPAN SISTEM</span>
          </button>
        </div>
      </form>

      {/* System Integrity & Storage Check Section */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 md:p-8 shadow-sm space-y-4">
        <h3 className="text-2xl font-black text-gray-900">STATUS STORAN & INTEGRITI SISTEM</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <span className="text-xs font-bold text-gray-500 uppercase block">STATUS KETAHANAN STORAN:</span>
            <span
              className={`text-lg font-black block mt-1 ${
                storagePersisted ? 'text-green-700' : 'text-amber-700'
              }`}
            >
              {storagePersisted ? 'DIKEKALKAN (PERSISTENT STORAGE AKTIF)' : 'TIDAK DIKEKALKAN'}
            </span>
            {storageQuota && (
              <span className="text-xs text-gray-600 block mt-1">Kuota Pelayar: {storageQuota}</span>
            )}
          </div>

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <span className="text-xs font-bold text-gray-500 uppercase block">ALAMAT ASAL APLIKASI:</span>
            <span className="text-sm font-mono font-black text-gray-900 block mt-1">
              {typeof window !== 'undefined' ? window.location.origin : '-'}
            </span>
            <span className="text-xs font-bold text-amber-800 block mt-1">
              Data IndexedDB terikat kepada alamat ini. Jangan tukar origin.
            </span>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="button"
            disabled={runningCheck}
            onClick={handleRunIntegrityCheck}
            className="py-3 px-6 rounded-xl bg-green-700 hover:bg-green-800 text-white font-bold text-base shadow"
          >
            {runningCheck ? 'Menyemak...' : 'Jalankan Semakan Integriti Penuh (Bahagian 23)'}
          </button>
        </div>

        {integrityResult && (
          <div
            className={`mt-4 p-5 rounded-xl border-2 ${
              integrityResult.passed ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'
            }`}
          >
            <div className="flex items-center gap-2 font-black text-lg">
              {integrityResult.passed ? (
                <CheckCircle className="w-6 h-6 text-green-700" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-red-700" />
              )}
              <span>{integrityResult.passed ? 'SEMAKAN INTEGRITI BERJAYA: SEMUA STORE UTUH' : 'ISU INTEGRITI DIKESAN'}</span>
            </div>
            <div className="mt-2 text-sm space-y-1 font-bold text-gray-800">
              <p>Jumlah Pesakit Master: {integrityResult.summary.totalPatients}</p>
              <p>Jumlah Kehadiran: {integrityResult.summary.totalAttendances}</p>
              <p>Rantaian Hash Audit: {integrityResult.summary.auditChainValid ? 'SAH & KONSISTEN' : 'TIDAK SAH'}</p>
            </div>
            {integrityResult.issues.length > 0 && (
              <ul className="mt-2 list-disc list-inside text-xs text-red-800 font-bold">
                {integrityResult.issues.map((iss, i) => (
                  <li key={i}>{iss}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
