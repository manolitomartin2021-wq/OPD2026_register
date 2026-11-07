import React, { useState, useEffect } from 'react';
import { getDatabase } from '../../data/db';
import type { ActiveSession, MonthStatus, ArchiveHistory, ArchiveReceipt } from '../../types';
import {
  buildMonthlyArchive,
  verifyAndImportArchiveReceipt,
  readArchiveFile,
  type ArchivedMonthlyRecord,
} from '../../services/archiveService';
import { downloadFile } from '../../services/backupService';
import { PageHelp } from '../../components/veteran/PageHelp';
import { formatDateDisplay, formatYearMonthDisplay } from '../../utils/dateUtils';
import {
  Archive,
  FileCheck,
  Search,
  CheckCircle,
  AlertTriangle,
  Download,
  Upload,
  Lock,
  Layers,
} from 'lucide-react';

interface ArkibViewProps {
  session: ActiveSession;
}

export const ArkibView: React.FC<ArkibViewProps> = ({ session }) => {
  const [closedMonths, setClosedMonths] = useState<MonthStatus[]>([]);
  const [archiveHistory, setArchiveHistory] = useState<ArchiveHistory[]>([]);
  const [archiveReceipts, setArchiveReceipts] = useState<ArchiveReceipt[]>([]);
  const [loading, setLoading] = useState(true);

  // Build archive modal
  const [showBuildModal, setShowBuildModal] = useState(false);
  const [selectedMonthToArchive, setSelectedMonthToArchive] = useState('');
  const [secondaryPath, setSecondaryPath] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [building, setBuilding] = useState(false);
  const [buildMsg, setBuildMsg] = useState('');

  // Import receipt modal (Counter PC)
  const [showImportReceiptModal, setShowImportReceiptModal] = useState(false);
  const [receiptJsonText, setReceiptJsonText] = useState('');
  const [receiptPassphrase, setReceiptPassphrase] = useState('');
  const [importReceiptMsg, setImportReceiptMsg] = useState('');

  // Archive Viewer
  const [showViewerModal, setShowViewerModal] = useState(false);
  const [viewedArchive, setViewedArchive] = useState<ArchivedMonthlyRecord | null>(null);
  const [viewerSearch, setViewerSearch] = useState('');
  const [viewerPassphrase, setViewerPassphrase] = useState('');
  const [viewerFile, setViewerFile] = useState<any>(null);
  const [readingArchive, setReadingArchive] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const db = getDatabase();
    const months = await db.month_status.where('status').equals('DITUTUP').toArray();
    setClosedMonths(months);

    try {
      const archives = await db.archive_history.orderBy('tarikh_arkib').reverse().toArray();
      setArchiveHistory(archives);
    } catch (err) {
      console.warn('Fallback archive history sorting:', err);
      const archives = await db.archive_history.toArray();
      archives.sort((a, b) => (b.tarikh_arkib || '').localeCompare(a.tarikh_arkib || ''));
      setArchiveHistory(archives);
    }

    const receipts = await db.archive_receipts.toArray();
    setArchiveReceipts(receipts);

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExecuteBuildArchive = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuildMsg('');

    if (!selectedMonthToArchive || !passphrase) {
      setBuildMsg('Sila pilih bulan dan masukkan frasa laluan.');
      return;
    }

    setBuilding(true);
    try {
      const res = await buildMonthlyArchive(selectedMonthToArchive, passphrase, secondaryPath);

      // Download archive package (.jplarc)
      const arcJson = JSON.stringify(res.encryptedPkg, null, 2);
      downloadFile(arcJson, res.fileName, 'application/json');

      // Download archive receipt (.receipt.json)
      const receiptJson = JSON.stringify(res.receipt, null, 2);
      downloadFile(receiptJson, `JPL_RECEIPT_${selectedMonthToArchive}.json`, 'application/json');

      setBuildMsg(`Arkib ${res.fileName} dan Resit Arkib berjaya dijana dan dimuat turun!`);
      loadData();
      setTimeout(() => {
        setShowBuildModal(false);
        setBuildMsg('');
        setPassphrase('');
      }, 3000);
    } catch (err: any) {
      setBuildMsg(err.message || 'Ralat membina arkib.');
    } finally {
      setBuilding(false);
    }
  };

  const handleImportReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportReceiptMsg('');

    if (!receiptJsonText || !receiptPassphrase) {
      setImportReceiptMsg('Sila muat naik fail resit dan masukkan frasa laluan.');
      return;
    }

    try {
      await verifyAndImportArchiveReceipt(receiptJsonText, receiptPassphrase);
      setImportReceiptMsg('Resit Arkib berjaya disahkan dan diimport! Bulan kini berstatus DIARKIB.');
      loadData();
      setTimeout(() => {
        setShowImportReceiptModal(false);
        setImportReceiptMsg('');
      }, 2000);
    } catch (err: any) {
      setImportReceiptMsg(err.message || 'Ralat mengimport resit arkib.');
    }
  };

  const handleOpenArchiveFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewerFile || !viewerPassphrase) return;

    setReadingArchive(true);
    try {
      const record = await readArchiveFile(viewerFile, viewerPassphrase);
      setViewedArchive(record);
    } catch (err: any) {
      alert(err.message || 'Gagal membaca arkib. Frasa laluan mungkin tidak tepat.');
    } finally {
      setReadingArchive(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHelp
        title="Pengurusan Arkib Digital & Archive Viewer"
        points={[
          'Arkib bulanan (.jplarc) menyimpan rekod kehadiran bersama petikan identiti pesakit (demographic snapshot) untuk carian berasingan.',
          'Resit Arkib (.json) ditandatangani secara kriptografi menggunakan HMAC-SHA256 untuk dibawa ke PC Kaunter.',
          'PC Kaunter memerlukan Resit Arkib ini untuk mengesahkan bahawa arkib telah selamat disimpan di PC Penyelia sebelum pembersihan 4 bulan dibenarkan.',
          'Gunakan "Archive Viewer" untuk mencari rekod pesakit lama yang telah dipadam dari database operasi.',
        ]}
      />

      {/* Control Header */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 md:p-8 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900">ARKIB DIGITAL & ARCHIVE VIEWER</h2>
          <p className="text-base text-gray-600 font-medium">
            Hospital Dalat · Penyimpanan Arkib Berasingan & Resit HMAC
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowViewerModal(true)}
            className="flex items-center gap-2 px-5 py-3.5 bg-white border-2 border-[#2F5D8A] text-[#2F5D8A] rounded-xl font-bold text-base hover:bg-blue-50 shadow-sm"
          >
            <Search className="w-5 h-5" />
            <span>ARCHIVE VIEWER (CARI ARKIB)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowImportReceiptModal(true)}
            className="flex items-center gap-2 px-5 py-3.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl font-black text-base shadow-md"
          >
            <Upload className="w-5 h-5 text-white" />
            <span>IMPORT RESIT ARKIB</span>
          </button>

          <button
            type="button"
            onClick={() => setShowBuildModal(true)}
            className="flex items-center gap-2 px-6 py-3.5 bg-[#2F5D8A] hover:bg-[#254A6F] text-white rounded-xl font-black text-base shadow-md cursor-pointer"
          >
            <Archive className="w-6 h-6 text-white" />
            <span>BINA ARKIB BULANAN (.JPLARC)</span>
          </button>
        </div>
      </div>

      {/* Archive History Table */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-xl font-black text-gray-900">SEJARAH FAIL ARKIB BULANAN</h3>
          <span className="text-sm font-bold text-gray-500">{archiveHistory.length} Fail Arkib</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300 text-gray-800 text-sm font-black uppercase">
                <th className="p-4">Bulan Arkib</th>
                <th className="p-4">Nama Fail</th>
                <th className="p-4">Jumlah Rekod</th>
                <th className="p-4">Jumlah Pesakit</th>
                <th className="p-4">Salinan Kedua</th>
                <th className="p-4">Tarikh Dijana</th>
                <th className="p-4">Disahkan Oleh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-base font-medium">
              {archiveHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500 font-bold">
                    Tiada fail arkib bulanan dijana lagi.
                  </td>
                </tr>
              ) : (
                archiveHistory.map((arc) => (
                  <tr key={arc.archive_id} className="hover:bg-blue-50/50">
                    <td className="p-4 font-black text-gray-900">
                      {formatYearMonthDisplay(arc.tahun_bulan)}
                    </td>
                    <td className="p-4 font-mono font-bold text-sm text-[#2F5D8A]">{arc.nama_fail}</td>
                    <td className="p-4 font-black">{arc.jumlah_rekod}</td>
                    <td className="p-4 font-bold">{arc.jumlah_pesakit}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-black ${
                          arc.salinan_2_disahkan
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {arc.salinan_2_disahkan ? 'DISAHKAN' : 'BELUM DISAHKAN'}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-bold text-gray-700">{arc.tarikh_arkib}</td>
                    <td className="p-4 text-sm font-bold text-gray-600">{arc.disahkan_oleh}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Build Monthly Archive */}
      {showBuildModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 md:p-8 shadow-2xl border-2 border-gray-300 space-y-4">
            <h3 className="text-2xl font-black text-gray-900">BINA ARKIB DIGITAL (.JPLARC)</h3>
            <p className="text-sm text-gray-600 font-medium">
              Mengekstrak rekod kehadiran bulan DITUTUP bersama snapshot profil pesakit dan menjana resit HMAC.
            </p>

            {buildMsg && (
              <div className="p-3 bg-blue-50 border border-blue-300 text-blue-900 text-sm font-bold rounded-xl">
                {buildMsg}
              </div>
            )}

            <form onSubmit={handleExecuteBuildArchive} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Pilih Bulan Ditutup:</label>
                <select
                  value={selectedMonthToArchive}
                  onChange={(e) => setSelectedMonthToArchive(e.target.value)}
                  className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold"
                >
                  <option value="">-- Pilih Bulan --</option>
                  {closedMonths.map((m) => (
                    <option key={m.tahun_bulan} value={m.tahun_bulan}>
                      {formatYearMonthDisplay(m.tahun_bulan)} (Status: {m.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Lokasi Salinan Kedua (Pemacu Luaran / USB):
                </label>
                <input
                  type="text"
                  value={secondaryPath}
                  onChange={(e) => setSecondaryPath(e.target.value)}
                  placeholder="cth: E:\JPL_ARCHIVE_SECONDARY\2026"
                  className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Frasa Laluan Sulit Arkib:</label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-lg"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBuildModal(false)}
                  className="w-1/2 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-base text-gray-800"
                >
                  BATAL
                </button>
                <button
                  type="submit"
                  disabled={building}
                  className="w-1/2 py-3 rounded-xl bg-[#2F5D8A] hover:bg-[#254A6F] font-black text-base text-white shadow disabled:opacity-50"
                >
                  {building ? 'MEMBINA ARKIB...' : 'BINA & SULITKAN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Import Archive Receipt */}
      {showImportReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 md:p-8 shadow-2xl border-2 border-gray-300 space-y-4">
            <h3 className="text-2xl font-black text-gray-900">IMPORT RESIT ARKIB DIGITAL</h3>
            <p className="text-sm text-gray-600 font-medium">
              Pindahkan fail resit dari PC Penyelia ke PC Kaunter untuk mengesahkan arkib bagi pembersihan 4 bulan.
            </p>

            {importReceiptMsg && (
              <div className="p-3 bg-blue-50 border border-blue-300 text-blue-900 text-sm font-bold rounded-xl">
                {importReceiptMsg}
              </div>
            )}

            <form onSubmit={handleImportReceipt} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Pilih Fail Resit (.json):</label>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      setReceiptJsonText(evt.target?.result as string);
                    };
                    reader.readAsText(file);
                  }}
                  className="w-full p-2.5 rounded-xl border-2 border-gray-400 font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Frasa Laluan Backup (Untuk Mengesahkan HMAC):
                </label>
                <input
                  type="password"
                  value={receiptPassphrase}
                  onChange={(e) => setReceiptPassphrase(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-lg"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowImportReceiptModal(false)}
                  className="w-1/2 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-base text-gray-800"
                >
                  BATAL
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3 rounded-xl bg-amber-700 hover:bg-amber-800 font-black text-base text-white shadow"
                >
                  SAHKAN & IMPORT RESIT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Archive Viewer */}
      {showViewerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border-2 border-gray-300 overflow-hidden my-6">
            <div className="p-6 bg-[#2F5D8A] text-white flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black">ARCHIVE VIEWER (CARIAN REKOD ARKIB)</h3>
                <p className="text-sm text-blue-100 font-medium">
                  Cari rekod kehadiran yang telah diarkibkan atau dibersihkan dari database operasi
                </p>
              </div>
              <button
                onClick={() => setShowViewerModal(false)}
                className="p-2 text-white hover:bg-white/20 rounded-xl"
              >
                Tutup
              </button>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              {!viewedArchive ? (
                <form onSubmit={handleOpenArchiveFile} className="space-y-4 max-w-md mx-auto py-8">
                  <div className="text-center mb-6">
                    <Archive className="w-16 h-16 text-[#2F5D8A] mx-auto mb-2" />
                    <h4 className="text-xl font-black text-gray-900">Buka Fail Arkib (.jplarc)</h4>
                    <p className="text-sm text-gray-600">Pilih fail arkib untuk dinyahsulit dan dicari</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Pilih Fail Arkib:</label>
                    <input
                      type="file"
                      accept=".jplarc, .json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          try {
                            const parsed = JSON.parse(evt.target?.result as string);
                            setViewerFile(parsed);
                          } catch {
                            alert('Fail bukan JSON sah.');
                          }
                        };
                        reader.readAsText(file);
                      }}
                      className="w-full p-2.5 rounded-xl border-2 border-gray-400 font-bold text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Frasa Laluan Arkib:</label>
                    <input
                      type="password"
                      value={viewerPassphrase}
                      onChange={(e) => setViewerPassphrase(e.target.value)}
                      placeholder="••••••••"
                      className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-lg"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={readingArchive || !viewerFile}
                    className="w-full py-4 rounded-xl bg-[#2F5D8A] hover:bg-[#254A6F] text-white font-black text-lg shadow-md disabled:opacity-50"
                  >
                    {readingArchive ? 'MEMBUKA ARKIB...' : 'BUKA & CARI ARKIB'}
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-200">
                    <div>
                      <span className="text-xs font-bold text-gray-500 uppercase block">ARKIB DIBUKA:</span>
                      <span className="text-xl font-black text-gray-900">
                        {formatYearMonthDisplay(viewedArchive.yearMonth)} ({viewedArchive.totalRecords} Rekod)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewedArchive(null)}
                      className="px-4 py-2 rounded-xl bg-gray-200 text-gray-800 font-bold text-sm hover:bg-gray-300"
                    >
                      Tukar Fail Arkib
                    </button>
                  </div>

                  {/* Search inside archive */}
                  <div className="relative">
                    <input
                      type="text"
                      value={viewerSearch}
                      onChange={(e) => setViewerSearch(e.target.value)}
                      placeholder="Cari dalam arkib (Nama, No. RN, No. HDalat)..."
                      className="w-full p-3.5 rounded-xl border-2 border-gray-400 font-bold text-base focus:border-[#2F5D8A]"
                    />
                  </div>

                  {/* Records Table inside Archive */}
                  <div className="max-h-96 overflow-y-auto border border-gray-300 rounded-xl">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-100 font-black text-gray-800 border-b">
                        <tr>
                          <th className="p-3">No. HDalat</th>
                          <th className="p-3">RN</th>
                          <th className="p-3">Nama Pesakit</th>
                          <th className="p-3">Kategori</th>
                          <th className="p-3">Tarikh & Masa</th>
                          <th className="p-3">Dokumen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 font-semibold">
                        {viewedArchive.records
                          .filter((r) => {
                            if (!viewerSearch.trim()) return true;
                            const q = viewerSearch.toUpperCase();
                            return (
                              r.attendance.no_daftar.toUpperCase().includes(q) ||
                              r.patient_snapshot.no_rn.toUpperCase().includes(q) ||
                              r.patient_snapshot.nama_pesakit.toUpperCase().includes(q)
                            );
                          })
                          .map((r, i) => (
                            <tr key={i} className="hover:bg-blue-50">
                              <td className="p-3 font-black text-[#2F5D8A]">{r.attendance.no_daftar}</td>
                              <td className="p-3 font-bold">{r.patient_snapshot.no_rn}</td>
                              <td className="p-3 font-black text-gray-900 uppercase">
                                {r.patient_snapshot.nama_pesakit}
                              </td>
                              <td className="p-3">{r.attendance.kategori}</td>
                              <td className="p-3">
                                {formatDateDisplay(r.attendance.tarikh)} {r.attendance.masa}
                              </td>
                              <td className="p-3 text-gray-600 font-mono">
                                {r.patient_snapshot.dokumen_bertopeng}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
