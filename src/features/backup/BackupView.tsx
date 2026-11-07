import React, { useState, useEffect } from 'react';
import { getDatabase } from '../../data/db';
import type { ActiveSession, BackupHistory } from '../../types';
import {
  createEncryptedBackup,
  verifyBackupFile,
  restoreDatabase,
  downloadFile,
  type VerifyResult,
} from '../../services/backupService';
import { PageHelp } from '../../components/veteran/PageHelp';
import { formatDateDisplay } from '../../utils/dateUtils';
import {
  ShieldCheck,
  Download,
  Upload,
  CheckCircle,
  AlertTriangle,
  Folder,
  RotateCcw,
  Key,
  FileCheck,
} from 'lucide-react';

interface BackupViewProps {
  session: ActiveSession;
  openWeeklyModalDirectly?: boolean;
}

export const BackupView: React.FC<BackupViewProps> = ({ session, openWeeklyModalDirectly = false }) => {
  const [history, setHistory] = useState<BackupHistory[]>([]);
  const [loading, setLoading] = useState(true);

  // Backup creation modal
  const [showCreateModal, setShowCreateModal] = useState(openWeeklyModalDirectly);
  const [backupType, setBackupType] = useState<'MINGGUAN' | 'HARIAN'>('MINGGUAN');
  const [passphrase, setPassphrase] = useState('');
  const [passphraseConfirm, setPassphraseConfirm] = useState('');
  const [createMsg, setCreateMsg] = useState('');
  const [creating, setCreating] = useState(false);

  // Verification tool
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyFileContent, setVerifyFileContent] = useState<any>(null);
  const [verifyPassphrase, setVerifyPassphrase] = useState('');
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Restore tool
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreFileContent, setRestoreFileContent] = useState<any>(null);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [highestPrintedNumber, setHighestPrintedNumber] = useState<number>(0);
  const [restoreTargetMonth, setRestoreTargetMonth] = useState('');
  const [restoreMsg, setRestoreMsg] = useState('');
  const [restoring, setRestoring] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    const db = getDatabase();
    const records = await db.backup_history.orderBy('tarikh').reverse().toArray();
    setHistory(records);
    setLoading(false);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateMsg('');

    if (passphrase.length < 8) {
      setCreateMsg('Frasa laluan backup mestilah sekurang-kurangnya 8 aksara.');
      return;
    }
    if (passphrase !== passphraseConfirm) {
      setCreateMsg('Pengesahan frasa laluan tidak sepadan.');
      return;
    }

    setCreating(true);
    try {
      const res = await createEncryptedBackup(passphrase, backupType);

      // Download backup package (.jplbak)
      const packageJson = JSON.stringify(res.encryptedPkg, null, 2);
      downloadFile(packageJson, res.fileName, 'application/json');

      // Download manifest (.manifest.json)
      const manifestJson = JSON.stringify(res.manifest, null, 2);
      downloadFile(manifestJson, `${res.fileName}.manifest.json`, 'application/json');

      setCreateMsg(`Backup ${res.fileName} berjaya dijana dan fail telah dimuat turun!`);
      loadHistory();
      setTimeout(() => {
        setShowCreateModal(false);
        setCreateMsg('');
        setPassphrase('');
        setPassphraseConfirm('');
      }, 3000);
    } catch (err: any) {
      setCreateMsg(err.message || 'Ralat membuat backup.');
    } finally {
      setCreating(false);
    }
  };

  const handleFileUploadForVerify = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        setVerifyFileContent(parsed);
        setVerifyResult(null);
      } catch (err) {
        alert('Format fail backup rosak atau bukan JSON sah.');
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyFileContent || !verifyPassphrase) return;

    setVerifying(true);
    try {
      const result = await verifyBackupFile(verifyFileContent, verifyPassphrase, true);
      setVerifyResult(result);
    } catch (err: any) {
      setVerifyResult({
        isValid: false,
        errors: [err.message || 'Ralat semasa mengesahkan backup.'],
        status: 'GAGAL',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleFileUploadForRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);
        setRestoreFileContent(parsed);
      } catch (err) {
        alert('Fail tidak sah.');
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    setRestoreMsg('');

    if (!restoreFileContent || !restorePassphrase || !supervisorPassword) {
      setRestoreMsg('Sila isi semua maklumat pengesahan.');
      return;
    }

    setRestoring(true);
    try {
      const highestMap = restoreTargetMonth && highestPrintedNumber > 0
        ? { [restoreTargetMonth]: highestPrintedNumber }
        : undefined;

      await restoreDatabase(
        restoreFileContent,
        restorePassphrase,
        supervisorPassword,
        highestMap
      );

      setRestoreMsg('Database berjaya dipulihkan sepenuhnya! Halaman akan dimuat semula...');
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (err: any) {
      setRestoreMsg(err.message || 'Ralat memulihkan database.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHelp
        title="Pengurusan Backup Bersulit & Pemulihan Bencana"
        points={[
          'Backup mingguan disulitkan menggunakan AES-256-GCM dengan kunci WebCrypto daripada frasa laluan anda.',
          'Eksport fail BUKAN backup yang disahkan sehingga fungsi "VERIFY" lulus sepenuhnya.',
          'Penyelia wajib menyalin fail backup mingguan ke PC Penyelia setiap minggu (peringatan automatik setiap Jumaat 4.00 petang).',
          'Alat pemulihan (Restore) dilengkapi perlindungan jujukan nombor HDalat bagi mengelakkan nombor yang dicetak pada slip digunakan semula.',
        ]}
      />

      {/* Action Header */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 md:p-8 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900">BACKUP BERSULIT & VERIFY</h2>
          <p className="text-base text-gray-600 font-medium">
            Hospital Dalat · Perlindungan Integriti Data Pesakit
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setShowVerifyModal(true);
              setVerifyResult(null);
            }}
            className="flex items-center gap-2 px-5 py-3.5 bg-white border-2 border-[#2F5D8A] text-[#2F5D8A] rounded-xl font-bold text-base hover:bg-blue-50 shadow-sm"
          >
            <FileCheck className="w-5 h-5" />
            <span>SAHKAN FAIL (VERIFY)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowCreateModal(true);
              setBackupType('MINGGUAN');
            }}
            className="flex items-center gap-2 px-6 py-3.5 bg-[#2F5D8A] hover:bg-[#254A6F] text-white rounded-xl font-black text-base shadow-md cursor-pointer"
          >
            <ShieldCheck className="w-6 h-6 text-white" />
            <span>BUAT BACKUP SEKARANG</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRestoreModal(true)}
            className="flex items-center gap-2 px-5 py-3.5 bg-red-800 hover:bg-red-900 text-white rounded-xl font-black text-base shadow-md"
          >
            <RotateCcw className="w-5 h-5 text-white" />
            <span>PULIHKAN (RESTORE)</span>
          </button>
        </div>
      </div>

      {/* Backup History Table */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-xl font-black text-gray-900">SEJARAH BACKUP DISIMPAN</h3>
          <span className="text-sm font-bold text-gray-500">{history.length} Rekod Backup</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300 text-gray-800 text-sm font-black uppercase">
                <th className="p-4">Tarikh & Masa</th>
                <th className="p-4">Nama Fail</th>
                <th className="p-4">Jenis</th>
                <th className="p-4">Jumlah Pesakit</th>
                <th className="p-4">Kehadiran</th>
                <th className="p-4">Status Pengesahan</th>
                <th className="p-4">Dilakukan Oleh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-base font-medium">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500 font-bold">
                    Tiada rekod backup dijumpai. Sila buat backup mingguan pertama anda.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.backup_id} className="hover:bg-blue-50/50">
                    <td className="p-4 font-bold text-gray-900">
                      {formatDateDisplay(h.tarikh)} {h.masa}
                    </td>
                    <td className="p-4 font-mono font-bold text-sm text-[#2F5D8A]">{h.nama_fail}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded text-xs font-black bg-blue-100 text-[#2F5D8A]">
                        {h.jenis}
                      </span>
                    </td>
                    <td className="p-4 font-bold">{h.jumlah_pesakit}</td>
                    <td className="p-4 font-bold">{h.jumlah_kehadiran}</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                          h.status_pengesahan === 'GAGAL'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {h.status_pengesahan}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-bold text-gray-600">{h.performed_by}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Create Encrypted Backup */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 md:p-8 shadow-2xl border-2 border-gray-300 space-y-4">
            <h3 className="text-2xl font-black text-gray-900">BUAT BACKUP BERSULIT</h3>
            <p className="text-sm text-gray-600 font-medium">
              Data akan disulitkan menggunakan AES-256-GCM. Pastikan frasa laluan disimpan dengan selamat.
            </p>

            {createMsg && (
              <div className="p-3 bg-blue-50 border border-blue-300 text-blue-900 text-sm font-bold rounded-xl">
                {createMsg}
              </div>
            )}

            <form onSubmit={handleCreateBackup} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Jenis Backup:</label>
                <select
                  value={backupType}
                  onChange={(e) => setBackupType(e.target.value as any)}
                  className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold"
                >
                  <option value="MINGGUAN">Backup Mingguan (Disalin ke PC Penyelia)</option>
                  <option value="HARIAN">Backup Harian</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Frasa Laluan Backup (Min. 8 Aksara):
                </label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Sahkan Frasa Laluan:
                </label>
                <input
                  type="password"
                  value={passphraseConfirm}
                  onChange={(e) => setPassphraseConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-lg"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-xs font-bold text-amber-900">
                Peringatan: Kehilangan frasa laluan bermakna fail backup tidak akan dapat dibuka sama sekali.
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-1/2 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-base text-gray-800"
                >
                  BATAL
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="w-1/2 py-3 rounded-xl bg-[#2F5D8A] hover:bg-[#254A6F] font-black text-base text-white shadow disabled:opacity-50"
                >
                  {creating ? 'MENYULITKAN...' : 'SULITKAN & MUAT TURUN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Verify Backup */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 md:p-8 shadow-2xl border-2 border-gray-300 space-y-4">
            <h3 className="text-2xl font-black text-gray-900">PENGESAHAN FAIL BACKUP (VERIFY)</h3>
            <p className="text-sm text-gray-600 font-medium">
              Sahkan integriti checksum, ketepatan bilangan rekod dan dekripsi tanpa menyimpan data ke storan.
            </p>

            <form onSubmit={handleExecuteVerify} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Pilih Fail Backup (.jplbak):</label>
                <input
                  type="file"
                  accept=".jplbak, .json"
                  onChange={handleFileUploadForVerify}
                  className="w-full p-2.5 rounded-xl border-2 border-gray-400 font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Frasa Laluan Backup:</label>
                <input
                  type="password"
                  value={verifyPassphrase}
                  onChange={(e) => setVerifyPassphrase(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-lg"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVerifyModal(false)}
                  className="w-1/2 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-base text-gray-800"
                >
                  TUTUP
                </button>
                <button
                  type="submit"
                  disabled={verifying || !verifyFileContent}
                  className="w-1/2 py-3 rounded-xl bg-green-700 hover:bg-green-800 font-black text-base text-white shadow disabled:opacity-50"
                >
                  {verifying ? 'MEMERIKSA...' : 'JALANKAN VERIFY'}
                </button>
              </div>

              {verifyResult && (
                <div
                  className={`mt-4 p-4 rounded-xl border-2 ${
                    verifyResult.isValid
                      ? 'bg-green-50 border-green-500 text-green-900'
                      : 'bg-red-50 border-red-500 text-red-900'
                  }`}
                >
                  <div className="flex items-center gap-2 font-black text-lg">
                    {verifyResult.isValid ? (
                      <CheckCircle className="w-6 h-6 text-green-700" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-red-700" />
                    )}
                    <span>STATUS: {verifyResult.status}</span>
                  </div>
                  {verifyResult.manifest && (
                    <div className="mt-2 text-xs space-y-1 font-bold">
                      <p>Nama Fail: {verifyResult.manifest.nama_fail}</p>
                      <p>Jumlah Pesakit: {verifyResult.manifest.jumlah_pesakit}</p>
                      <p>Jumlah Kehadiran: {verifyResult.manifest.jumlah_kehadiran}</p>
                      <p>Checksum SHA-256: {verifyResult.manifest.checksum_sha256.substring(0, 16)}...</p>
                    </div>
                  )}
                  {verifyResult.errors.length > 0 && (
                    <ul className="mt-2 text-xs list-disc list-inside font-bold text-red-800">
                      {verifyResult.errors.map((e, idx) => (
                        <li key={idx}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Restore Database */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 md:p-8 shadow-2xl border-4 border-[#991B1B] space-y-4">
            <div className="flex items-center gap-3 text-[#991B1B]">
              <AlertTriangle className="w-10 h-10 flex-shrink-0" />
              <h3 className="text-2xl font-black">PEMULIHAN DATA (RESTORE)</h3>
            </div>
            <p className="text-sm text-gray-700 font-medium">
              AMARAN: Memulihkan database akan menggantikan seluruh rekod semasa dengan data dari backup. Sistem akan membuat snapshot PRA_RESTORE secara automatik sebelum penggantian.
            </p>

            {restoreMsg && (
              <div className="p-3 bg-red-50 border border-red-300 text-red-900 text-sm font-bold rounded-xl">
                {restoreMsg}
              </div>
            )}

            <form onSubmit={handleExecuteRestore} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Pilih Fail Backup (.jplbak):</label>
                <input
                  type="file"
                  accept=".jplbak, .json"
                  onChange={handleFileUploadForRestore}
                  className="w-full p-2.5 rounded-xl border-2 border-gray-400 font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Frasa Laluan Fail Backup:</label>
                <input
                  type="password"
                  value={restorePassphrase}
                  onChange={(e) => setRestorePassphrase(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-lg"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 space-y-2">
                <span className="text-xs font-black text-amber-900 uppercase block">
                  Perlindungan Jujukan Nombor HDalat Bercetak:
                </span>
                <p className="text-xs text-amber-800 font-medium">
                  Jika anda memulihkan data lama, masukkan nombor HDalat tertinggi yang telah dicetak pada slip fizikal supaya tiada nombor bertindih.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="month"
                    value={restoreTargetMonth}
                    onChange={(e) => setRestoreTargetMonth(e.target.value)}
                    className="p-2 rounded border border-gray-400 font-bold text-xs"
                    placeholder="Bulan Terjejas"
                  />
                  <input
                    type="number"
                    value={highestPrintedNumber || ''}
                    onChange={(e) => setHighestPrintedNumber(parseInt(e.target.value, 10) || 0)}
                    className="p-2 rounded border border-gray-400 font-bold text-xs"
                    placeholder="No. HDalat Tertinggi"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Kata Laluan Penyelia Semasa (Sahkan Kuasa):
                </label>
                <input
                  type="password"
                  value={supervisorPassword}
                  onChange={(e) => setSupervisorPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-lg"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRestoreModal(false)}
                  className="w-1/2 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-base text-gray-800"
                >
                  BATAL
                </button>
                <button
                  type="submit"
                  disabled={restoring || !restoreFileContent}
                  className="w-1/2 py-3 rounded-xl bg-[#991B1B] hover:bg-red-900 font-black text-base text-white shadow disabled:opacity-50"
                >
                  {restoring ? 'MEMULIHKAN...' : 'SAHKAN RESTORE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
