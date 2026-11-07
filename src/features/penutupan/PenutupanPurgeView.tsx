import React, { useState, useEffect } from 'react';
import { getDatabase } from '../../data/db';
import type { ActiveSession, MonthStatus, PurgeBatch } from '../../types';
import {
  checkPurgePrerequisites,
  executePurge,
  type PurgePrerequisiteStatus,
} from '../../data/dataService';
import { createEncryptedBackup } from '../../services/backupService';
import { PageHelp } from '../../components/veteran/PageHelp';
import { formatDateDisplay, formatYearMonthDisplay, getTodayDateString } from '../../utils/dateUtils';
import {
  Trash2,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  Lock,
  Archive,
  FileCheck,
  RefreshCw,
} from 'lucide-react';

interface PenutupanPurgeViewProps {
  session: ActiveSession;
}

export const PenutupanPurgeView: React.FC<PenutupanPurgeViewProps> = ({ session }) => {
  const [closedMonths, setClosedMonths] = useState<MonthStatus[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [prereqStatus, setPrereqStatus] = useState<PurgePrerequisiteStatus | null>(null);
  const [purgeBatches, setPurgeBatches] = useState<PurgeBatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Purge execution modal
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [purgeError, setPurgeError] = useState('');
  const [purging, setPurging] = useState(false);
  const [purgeSuccess, setPurgeSuccess] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const db = getDatabase();
    const months = await db.month_status.toArray();
    setClosedMonths(months);

    const batches = await db.purge_batches.orderBy('tarikh').reverse().toArray();
    setPurgeBatches(batches);

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectMonth = async (ym: string) => {
    setSelectedMonth(ym);
    setPrereqStatus(null);
    setPurgeSuccess(null);
    if (!ym) return;

    try {
      const status = await checkPurgePrerequisites(ym);
      setPrereqStatus(status);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExecutePurgeAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setPurgeError('');

    if (!selectedMonth || !supervisorPassword || !passphrase) {
      setPurgeError('Sila masukkan semua kata laluan dan frasa laluan pengesahan.');
      return;
    }

    setPurging(true);
    try {
      // 1. Take PRA_RESET backup automatically before purge
      const backupRes = await createEncryptedBackup(passphrase, 'PRA_RESET');

      // 2. Execute purge
      await executePurge(selectedMonth, backupRes.backupId, supervisorPassword);

      setPurgeSuccess(
        `FOUR-MONTH CONTROLLED PURGE BERJAYA: Rekod kehadiran bulan ${formatYearMonthDisplay(selectedMonth)} telah dibersihkan. Master Patient Database dan ringkasan bulanan kekal utuh!`
      );
      setShowPurgeModal(false);
      setSelectedMonth('');
      setPrereqStatus(null);
      loadData();
    } catch (err: any) {
      setPurgeError(err.message || 'Ralat semasa melaksanakan pembersihan.');
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHelp
        title="Pembersihan Terkawal Selepas Genap 4 Bulan (Four-Month Controlled Purge)"
        points={[
          'Sistem TIDAK PERNAH memadam rekod secara automatik. Modul ini menyemak semua 8 prasyarat keselamatan sebelum membenarkan pembersihan.',
          'Hanya rekod kehadiran (attendances) bagi bulan yang telah genap 4 bulan kalendar dan berstatus DIARKIB sahaja yang boleh dibersihkan.',
          'Master Patient Database, No. RN, jujukan nombor HDalat, ringkasan bulanan dan audit log TIDAK AKAN PERNAH dipadam.',
          'Sistem akan mengambil backup PRA_RESET secara automatik dan menyemak bilangan pesakit sebelum dan selepas untuk keselamatan mutlak.',
        ]}
      />

      {purgeSuccess && (
        <div className="p-6 bg-green-50 border-3 border-green-600 rounded-2xl text-green-900 font-bold flex items-center gap-4">
          <CheckCircle className="w-10 h-10 text-green-700 flex-shrink-0" />
          <div className="text-xl">{purgeSuccess}</div>
        </div>
      )}

      {/* Month Selection and Verification */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-gray-900">FOUR-MONTH CONTROLLED PURGE</h2>
            <p className="text-base text-gray-600 font-medium">
              Hospital Dalat · Modul Pembersihan Terkawal Data Kehadiran
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Kemaskini</span>
          </button>
        </div>

        <div>
          <label className="block text-base font-bold text-gray-800 mb-2">
            Pilih Bulan Yang Hendak Disemak Untuk Pembersihan:
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => handleSelectMonth(e.target.value)}
            className="w-full max-w-md p-4 rounded-xl border-2 border-gray-400 font-black text-lg focus:outline-none focus:border-[#2F5D8A]"
          >
            <option value="">-- Sila Pilih Bulan --</option>
            {closedMonths.map((m) => (
              <option key={m.tahun_bulan} value={m.tahun_bulan}>
                {formatYearMonthDisplay(m.tahun_bulan)} · Status: {m.status} (Layak: {formatDateDisplay(m.tarikh_layak_bersih)})
              </option>
            ))}
          </select>
        </div>

        {/* Prerequisites Status Box */}
        {selectedMonth && prereqStatus && (
          <div
            className={`p-6 rounded-2xl border-3 space-y-4 ${
              prereqStatus.canPurge
                ? 'bg-green-50/70 border-green-600 text-green-900'
                : 'bg-amber-50/70 border-amber-600 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-3">
              {prereqStatus.canPurge ? (
                <CheckCircle className="w-8 h-8 text-green-700 flex-shrink-0" />
              ) : (
                <ShieldAlert className="w-8 h-8 text-amber-700 flex-shrink-0" />
              )}
              <h3 className="text-2xl font-black">
                {prereqStatus.canPurge
                  ? 'SEMUA PRASYARAT KESELAMATAN DIPENUHI'
                  : 'PEMBERSIHAN DISEKAT OLEH SISTEM (PRASYARAT BELUM LENGKAP)'}
              </h3>
            </div>

            <p className="text-base font-semibold">
              Jumlah rekod kehadiran yang akan dibersihkan:{' '}
              <strong className="text-2xl font-black">{prereqStatus.recordsToPurgeCount}</strong> rekod.
            </p>

            {!prereqStatus.canPurge && (
              <div className="bg-white p-4 rounded-xl border border-amber-300">
                <span className="text-sm font-bold text-red-800 uppercase block mb-1">
                  Sebab Sistem Menyekat Pembersihan:
                </span>
                <ul className="list-disc list-inside space-y-1 text-sm font-bold text-gray-800">
                  {prereqStatus.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {prereqStatus.canPurge && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowPurgeModal(true)}
                  className="py-4 px-8 rounded-2xl bg-[#991B1B] hover:bg-red-900 text-white font-black text-xl flex items-center gap-3 shadow-xl cursor-pointer"
                >
                  <Trash2 className="w-6 h-6 text-white" />
                  <span>TERUSKAN PEMBERSIHAN BULAN INI</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Past Purge Batches Table */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-black text-gray-900">REKOD SEJARAH PEMBERSIHAN (PURGE BATCHES)</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300 text-gray-800 text-sm font-black uppercase">
                <th className="p-4">Tarikh Pembersihan</th>
                <th className="p-4">Bulan Dibersihkan</th>
                <th className="p-4">Jumlah Rekod Dipadam</th>
                <th className="p-4">Diluluskan Oleh</th>
                <th className="p-4">Hasil</th>
                <th className="p-4">Catatan Laporan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-base font-medium">
              {purgeBatches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500 font-bold">
                    Tiada rekod pembersihan dilakukan lagi.
                  </td>
                </tr>
              ) : (
                purgeBatches.map((b) => (
                  <tr key={b.batch_id} className="hover:bg-blue-50/50">
                    <td className="p-4 font-bold text-gray-900">{formatDateDisplay(b.tarikh)}</td>
                    <td className="p-4 font-black text-[#2F5D8A]">
                      {b.bulan_dibersihkan.map(formatYearMonthDisplay).join(', ')}
                    </td>
                    <td className="p-4 font-black">{b.jumlah_rekod_dipadam}</td>
                    <td className="p-4 font-bold">{b.diluluskan_oleh}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-green-100 text-green-800">
                        {b.hasil}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-bold text-gray-600">{b.laporan}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Execute Purge Confirmation */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 md:p-8 shadow-2xl border-4 border-[#991B1B] space-y-4">
            <div className="flex items-center gap-3 text-[#991B1B]">
              <AlertTriangle className="w-10 h-10 flex-shrink-0" />
              <h3 className="text-2xl font-black">PENGESAHAN KELULUSAN PEMBERSIHAN</h3>
            </div>
            <p className="text-base text-gray-800 font-medium">
              Sistem akan memadam <strong>{prereqStatus?.recordsToPurgeCount}</strong> rekod kehadiran bagi bulan <strong>{formatYearMonthDisplay(selectedMonth)}</strong>.
            </p>
            <p className="text-sm text-gray-600">
              Satu backup automatik <strong>PRA_RESET</strong> akan diambil sebelum pemadaman. Sila masukkan kata laluan Penyelia dan frasa laluan backup.
            </p>

            {purgeError && (
              <div className="p-3 bg-red-50 text-red-900 border border-red-300 rounded-xl text-sm font-bold">
                {purgeError}
              </div>
            )}

            <form onSubmit={handleExecutePurgeAction} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Frasa Laluan Backup PRA_RESET (Untuk Menjana Backup Kecemasan):
                </label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Kata Laluan Log Masuk Penyelia (Sahkan Identiti):
                </label>
                <input
                  type="password"
                  value={supervisorPassword}
                  onChange={(e) => setSupervisorPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-base"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPurgeModal(false)}
                  className="w-1/2 py-3.5 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-base text-gray-800"
                >
                  BATAL
                </button>
                <button
                  type="submit"
                  disabled={purging}
                  className="w-1/2 py-3.5 rounded-xl bg-[#991B1B] hover:bg-red-900 font-black text-base text-white shadow disabled:opacity-50"
                >
                  {purging ? 'MEMPROSES...' : 'LULUSKAN & PADAM REKOD'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
