import React, { useState, useEffect } from 'react';
import { getDatabase } from '../../data/db';
import type { Attendance, Patient, ActiveSession, AttendanceCategory } from '../../types';
import { editAttendance, cancelAttendance, closeDay } from '../../data/dataService';
import { PrintModal } from '../../print/PrintModal';
import { PageHelp } from '../../components/veteran/PageHelp';
import { ConfirmModal } from '../../components/veteran/ConfirmModal';
import {
  formatDateDisplay,
  getTodayDateString,
  getCurrentYearMonth,
  getISOWeekString,
} from '../../utils/dateUtils';
import { maskIdentity } from '../../utils/normalize';
import {
  Search,
  Filter,
  Printer,
  Edit2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Lock,
  Download,
  Calendar,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface RekodViewProps {
  session: ActiveSession;
}

export const RekodView: React.FC<RekodViewProps> = ({ session }) => {
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [patientMap, setPatientMap] = useState<Map<string, Patient>>(new Map());
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterDate, setFilterDate] = useState(getTodayDateString());
  const [filterCategory, setFilterCategory] = useState<string>('SEMUA');
  const [filterStatus, setFilterStatus] = useState<string>('SEMUA');
  const [filterSearch, setFilterSearch] = useState('');

  // Modals
  const [reprintRecord, setReprintRecord] = useState<{ attendance: Attendance; patient: Patient } | null>(null);

  // Edit Modal
  const [editRecord, setEditRecord] = useState<Attendance | null>(null);
  const [editCategory, setEditCategory] = useState<AttendanceCategory>('FUP_RUTIN');
  const [editNotes, setEditNotes] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editError, setEditError] = useState('');

  // Cancel Modal
  const [cancelRecordTarget, setCancelRecordTarget] = useState<Attendance | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');

  // Close Day Modal
  const [showCloseDayModal, setShowCloseDayModal] = useState(false);
  const [closeDaySuccess, setCloseDaySuccess] = useState(false);

  const loadRecords = async () => {
    setLoading(true);
    const db = getDatabase();

    let query = db.attendances.toCollection();
    if (filterDate) {
      query = db.attendances.where('tarikh').equals(filterDate);
    }

    const records = await query.reverse().toArray();
    setAttendances(records);

    // Load patients
    const patientIds = Array.from(new Set(records.map((r) => r.patient_id)));
    const patients = await db.patients.where('patient_id').anyOf(patientIds).toArray();
    const map = new Map<string, Patient>(patients.map((p) => [p.patient_id, p]));
    setPatientMap(map);

    setLoading(false);
  };

  useEffect(() => {
    loadRecords();
  }, [filterDate]);

  // Client-side filtering
  const filtered = attendances.filter((a) => {
    if (filterCategory !== 'SEMUA' && a.kategori !== filterCategory) return false;
    if (filterStatus !== 'SEMUA' && a.status !== filterStatus) return false;

    if (filterSearch.trim()) {
      const q = filterSearch.toUpperCase();
      const p = patientMap.get(a.patient_id);
      const matchesNo = a.no_daftar.toUpperCase().includes(q);
      const matchesRN = p ? p.no_rn.toUpperCase().includes(q) : false;
      const matchesName = p ? p.nama_pesakit.toUpperCase().includes(q) : false;
      return matchesNo || matchesRN || matchesName;
    }
    return true;
  });

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRecord) return;
    setEditError('');

    if (!editReason.trim()) {
      setEditError('Sebab pindaan kategori adalah WAJIB.');
      return;
    }

    try {
      await editAttendance(editRecord.attendance_id, editCategory, editNotes, editReason);
      setEditRecord(null);
      loadRecords();
    } catch (err: any) {
      setEditError(err.message || 'Ralat semasa mengemaskini rekod.');
    }
  };

  const handleCancelSubmit = async () => {
    if (!cancelRecordTarget) return;
    setCancelError('');

    if (!cancelReason.trim()) {
      setCancelError('Sebab pembatalan adalah WAJIB diisi.');
      return;
    }

    try {
      await cancelAttendance(cancelRecordTarget.attendance_id, cancelReason);
      setCancelRecordTarget(null);
      setCancelReason('');
      loadRecords();
    } catch (err: any) {
      setCancelError(err.message || 'Ralat semasa membatalkan kehadiran.');
    }
  };

  const handleExecuteCloseDay = async () => {
    try {
      await closeDay(filterDate);
      setShowCloseDayModal(false);
      setCloseDaySuccess(true);
      setTimeout(() => setCloseDaySuccess(false), 5000);
    } catch (err: any) {
      alert(err.message || 'Ralat semasa Tutup Hari.');
    }
  };

  const handleExportExcel = () => {
    const rows = filtered.map((a, i) => {
      const p = patientMap.get(a.patient_id);
      return {
        'Bil': i + 1,
        'No. HDalat': a.no_daftar,
        'No. RN': p ? p.no_rn : '-',
        'Nama Pesakit': p ? p.nama_pesakit : '-',
        'No. KP/Pasport': p ? maskIdentity(p.no_dokumen || p.no_pasport) : '-',
        'Kategori': a.kategori,
        'Tarikh': formatDateDisplay(a.tarikh),
        'Masa': a.masa,
        'Status': a.status,
        'Pesakit Baharu': a.pesakit_baharu ? 'YA' : 'TIDAK',
        'Kewarganegaraan': a.kewarganegaraan,
        'Umur (Tahun)': a.umur_tahun,
        'Petugas': a.registered_by,
        'Catatan': a.catatan || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekod_Harian');
    XLSX.writeFile(wb, `JPL_DAILY_REPORT_${filterDate}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <PageHelp
        title="Senarai Rekod Pendaftaran Harian & Mingguan"
        points={[
          'Gunakan penapis tarikh untuk melihat rekod pendaftaran bagi hari tertentu.',
          'Tekan "Cetak Semula" untuk mencetak semula slip giliran pesakit.',
          'Tindakan "Edit" dibenarkan pada hari sama sahaja untuk membetulkan kategori dengan sebab wajib.',
          'Tindakan "Batal" akan menetapkan status pendaftaran kepada BATAL (soft delete). Nombor HDalat tidak digunakan semula.',
          'Tekan butang "TUTUP HARI" di akhir syif untuk mengesahkan senarai cetakan harian.',
        ]}
      />

      {closeDaySuccess && (
        <div className="p-4 bg-green-50 border-2 border-green-600 text-green-900 rounded-2xl font-bold flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-700" />
          <span>Tutup Hari bagi {formatDateDisplay(filterDate)} telah berjaya disahkan dan direkod dalam audit log!</span>
        </div>
      )}

      {/* Filter and Action Bar */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Pilih Tarikh:</label>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="p-3 rounded-xl border-2 border-gray-400 font-bold text-base focus:outline-none focus:border-[#2F5D8A]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Kategori:</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="p-3 rounded-xl border-2 border-gray-400 font-bold text-base focus:outline-none focus:border-[#2F5D8A]"
              >
                <option value="SEMUA">Semua Kategori</option>
                <option value="FUP_RUTIN">F/UP RUTIN</option>
                <option value="WALK_IN">WALK-IN</option>
                <option value="MEDICAL_CHECKUP">MEDICAL CHECK UP</option>
                <option value="PROCEDURE_ROOM">PROCEDURE ROOM</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Status:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="p-3 rounded-xl border-2 border-gray-400 font-bold text-base focus:outline-none focus:border-[#2F5D8A]"
              >
                <option value="SEMUA">Semua Status</option>
                <option value="SAH">SAH</option>
                <option value="BATAL">BATAL</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-gray-300 text-gray-800 rounded-xl font-bold text-sm hover:bg-gray-100 shadow-sm"
            >
              <Download className="w-5 h-5" />
              <span>Eksport Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCloseDayModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-[#2F5D8A] hover:bg-[#254A6F] text-white rounded-xl font-black text-base shadow"
            >
              <CheckCircle className="w-5 h-5 text-white" />
              <span>TUTUP HARI</span>
            </button>
          </div>
        </div>

        {/* Text Filter Search */}
        <div className="relative">
          <input
            type="text"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            placeholder="Cari dalam senarai hari ini (No. HDalat, No. RN, Nama Pesakit)..."
            className="w-full pl-4 pr-4 py-3 rounded-xl border-2 border-gray-300 font-bold text-base focus:outline-none focus:border-[#2F5D8A]"
          />
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300 text-gray-800 text-sm font-black uppercase">
                <th className="p-4">Bil</th>
                <th className="p-4">No. HDalat</th>
                <th className="p-4">No. RN</th>
                <th className="p-4">Nama Pesakit</th>
                <th className="p-4">Kategori</th>
                <th className="p-4">Masa</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-base font-medium">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500 font-bold">
                    Tiada rekod pendaftaran dijumpai bagi penapis ini.
                  </td>
                </tr>
              ) : (
                filtered.map((a, idx) => {
                  const p = patientMap.get(a.patient_id);
                  const isCancelled = a.status === 'BATAL';

                  return (
                    <tr
                      key={a.attendance_id}
                      className={isCancelled ? 'bg-red-50/50 text-gray-500 line-through' : 'hover:bg-blue-50/50'}
                    >
                      <td className="p-4 font-bold">{idx + 1}</td>
                      <td className="p-4 font-black text-lg text-gray-900">{a.no_daftar}</td>
                      <td className="p-4 font-bold text-[#2F5D8A]">{p ? p.no_rn : '-'}</td>
                      <td className="p-4 font-black text-gray-900 uppercase">
                        {p ? p.nama_pesakit : '-'}
                        {a.kemasukan_lewat && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-200 text-amber-900 uppercase">
                            Lewat
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-gray-200 text-gray-800">
                          {a.kategori.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-sm font-bold text-gray-700">{a.masa}</td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                            isCancelled
                              ? 'bg-red-200 text-red-900'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* Reprint Button */}
                          <button
                            type="button"
                            onClick={() => {
                              if (p) setReprintRecord({ attendance: a, patient: p });
                            }}
                            className="p-2 rounded-lg bg-blue-50 text-[#2F5D8A] hover:bg-blue-100 font-bold text-xs flex items-center gap-1 border border-blue-200"
                            title="Cetak Semula Slip"
                          >
                            <Printer className="w-4 h-4" />
                            <span className="hidden sm:inline">Slip</span>
                          </button>

                          {/* Edit Button */}
                          {!isCancelled && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditRecord(a);
                                setEditCategory(a.kategori);
                                setEditNotes(a.catatan || '');
                                setEditReason('');
                                setEditError('');
                              }}
                              className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-bold text-xs flex items-center gap-1 border border-gray-300"
                              title="Pinda Kategori"
                            >
                              <Edit2 className="w-4 h-4" />
                              <span className="hidden sm:inline">Pinda</span>
                            </button>
                          )}

                          {/* Cancel Button */}
                          {!isCancelled && (
                            <button
                              type="button"
                              onClick={() => {
                                setCancelRecordTarget(a);
                                setCancelReason('');
                                setCancelError('');
                              }}
                              className="p-2 rounded-lg bg-red-50 text-[#991B1B] hover:bg-red-100 font-bold text-xs flex items-center gap-1 border border-red-200"
                              title="Batal Pendaftaran"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="hidden sm:inline">Batal</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Edit Registration */}
      {editRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 md:p-8 shadow-2xl border-2 border-gray-300 space-y-4">
            <h3 className="text-2xl font-black text-gray-900">PINDA KATEGORI PENDAFTARAN</h3>
            <p className="text-sm text-gray-600 font-medium">
              No. HDalat: <strong>{editRecord.no_daftar}</strong>
            </p>

            {editError && (
              <div className="p-3 bg-red-50 border border-red-300 text-red-800 text-sm font-bold rounded-xl">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Pilih Kategori Baharu:
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value as AttendanceCategory)}
                  className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-base focus:outline-none focus:border-[#2F5D8A]"
                >
                  <option value="FUP_RUTIN">F/UP RUTIN</option>
                  <option value="WALK_IN">WALK-IN</option>
                  <option value="MEDICAL_CHECKUP">MEDICAL CHECK UP</option>
                  <option value="PROCEDURE_ROOM">PROCEDURE ROOM</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Catatan Tambahan:</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Sebab Pindaan (WAJIB Diisi):
                </label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="cth: Salah pilih pintu masuk semasa daftar"
                  className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-base focus:border-[#2F5D8A]"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditRecord(null)}
                  className="w-1/2 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-base text-gray-800"
                >
                  KEMBALI
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3 rounded-xl bg-[#2F5D8A] hover:bg-[#254A6F] font-black text-base text-white shadow"
                >
                  SIMPAN PINDAAN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Cancel Registration */}
      {cancelRecordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 md:p-8 shadow-2xl border-4 border-[#991B1B] space-y-4">
            <div className="flex items-center gap-3 text-[#991B1B]">
              <AlertTriangle className="w-10 h-10 flex-shrink-0" />
              <h3 className="text-2xl font-black">BATALKAN PENDAFTARAN</h3>
            </div>
            <p className="text-base text-gray-800 font-medium">
              Adakah anda pasti mahu membatalkan pendaftaran <strong>{cancelRecordTarget.no_daftar}</strong>? Nombor HDalat ini tidak akan digunakan semula.
            </p>

            {cancelError && (
              <p className="text-sm font-bold text-red-700">{cancelError}</p>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Sebab Pembatalan (WAJIB Diisi):
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="cth: Pesakit membatalkan temujanji / tersalah pesakit"
                className="w-full p-3.5 rounded-xl border-2 border-gray-400 font-bold text-base focus:border-[#991B1B]"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setCancelRecordTarget(null)}
                className="w-1/2 py-3.5 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-base text-gray-800"
              >
                TIDAK, KEMBALI
              </button>
              <button
                type="button"
                onClick={handleCancelSubmit}
                className="w-1/2 py-3.5 rounded-xl bg-[#991B1B] hover:bg-red-900 font-black text-base text-white shadow"
              >
                YA, BATALKAN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Close Day */}
      <ConfirmModal
        isOpen={showCloseDayModal}
        title={`PENGESAHAN TUTUP HARI: ${formatDateDisplay(filterDate)}`}
        message={`Tindakan ini mengesahkan senarai pendaftaran bagi tarikh ${formatDateDisplay(filterDate)} sedia untuk ditandatangani. Selepas Tutup Hari, sebarang pindaan atau pembatalan hanya boleh dilakukan oleh Penyelia.`}
        confirmLabel="YA, SAHKAN TUTUP HARI"
        onConfirm={handleExecuteCloseDay}
        onCancel={() => setShowCloseDayModal(false)}
      />

      {/* MODAL: Reprint Slip */}
      {reprintRecord && (
        <PrintModal
          isOpen={true}
          attendance={reprintRecord.attendance}
          patient={reprintRecord.patient}
          isReprint={true}
          onClose={() => setReprintRecord(null)}
        />
      )}
    </div>
  );
};
