import React, { useState, useEffect } from 'react';
import { getDatabase } from '../../data/db';
import type { Patient, ActiveSession, Citizenship, DocumentType, Gender } from '../../types';
import { requestProfileCorrection, mergeDuplicatePatients } from '../../data/dataService';
import { PageHelp } from '../../components/veteran/PageHelp';
import { formatDateDisplay, calculateAge, formatDateTimeKuching } from '../../utils/dateUtils';
import { maskIdentity, normalizeName, generateNameTokens, normalizeDocNumber } from '../../utils/normalize';
import {
  Users,
  Search,
  UserCheck,
  AlertTriangle,
  GitMerge,
  FileEdit,
  CheckCircle,
  X,
  Phone,
  Home,
  ShieldAlert,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface PesakitViewProps {
  session: ActiveSession;
}

export const PesakitView: React.FC<PesakitViewProps> = ({ session }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Selected Patient Details Modal
  const [viewPatient, setViewPatient] = useState<Patient | null>(null);

  // Correction Request Modal (Staff & Supervisor)
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionField, setCorrectionField] = useState('nama_pesakit');
  const [correctionNewVal, setCorrectionNewVal] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionMsg, setCorrectionMsg] = useState('');

  // Merge Modal (Supervisor Only)
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeKeepPatient, setMergeKeepPatient] = useState<Patient | null>(null);
  const [mergeDuplicateId, setMergeDuplicateId] = useState('');
  const [mergeReason, setMergeReason] = useState('');
  const [mergeError, setMergeError] = useState('');

  // Import Modal State (Requirement 5)
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [validImportPatients, setValidImportPatients] = useState<Patient[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState('');

  const loadPatients = async () => {
    setLoading(true);
    const db = getDatabase();
    try {
      const all = await db.patients.orderBy('tarikh_dicipta').reverse().limit(100).toArray();
      setPatients(all);
    } catch (err) {
      console.warn('Fallback patient sorting:', err);
      const all = await db.patients.toArray();
      all.sort((a, b) => (b.tarikh_dicipta || '').localeCompare(a.tarikh_dicipta || ''));
      setPatients(all.slice(0, 100));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    const db = getDatabase();
    if (!q.trim()) {
      loadPatients();
      return;
    }
    const clean = q.toUpperCase();
    const results = await db.patients
      .filter((p) => {
        return (
          p.no_rn.toUpperCase().includes(clean) ||
          p.nama_pesakit.toUpperCase().includes(clean) ||
          p.no_dokumen.toUpperCase().includes(clean) ||
          p.no_pasport.toUpperCase().includes(clean)
        );
      })
      .limit(100)
      .toArray();
    setPatients(results);
  };

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewPatient) return;
    setCorrectionMsg('');

    if (!correctionNewVal.trim() || !correctionReason.trim()) {
      setCorrectionMsg('Sila lengkapkan nilai baharu dan sebab permohonan.');
      return;
    }

    try {
      const oldVal = (viewPatient as any)[correctionField] || '';
      await requestProfileCorrection(
        viewPatient.patient_id,
        correctionField,
        oldVal,
        correctionNewVal,
        correctionReason
      );
      setCorrectionMsg('Permohonan berjaya dihantar ke senarai semakan Penyelia!');
      setTimeout(() => {
        setShowCorrectionModal(false);
        setCorrectionMsg('');
      }, 2000);
    } catch (err: any) {
      setCorrectionMsg(err.message || 'Ralat menghantar permohonan.');
    }
  };

  const handleMergeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeKeepPatient) return;
    setMergeError('');

    if (!mergeDuplicateId.trim() || !mergeReason.trim()) {
      setMergeError('Sila pilih pesakit pendua dan nyatakan sebab penggabungan.');
      return;
    }

    try {
      await mergeDuplicatePatients(mergeKeepPatient.patient_id, mergeDuplicateId, mergeReason);
      setShowMergeModal(false);
      setViewPatient(null);
      loadPatients();
      alert('Penggabungan rekod pesakit berjaya!');
    } catch (err: any) {
      setMergeError(err.message || 'Ralat semasa menggabungkan pesakit.');
    }
  };

  // Muat Turun Templat Import Excel
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        NO_RN: 'HD-RN/2026/0001',
        NAMA_PESAKIT: 'AWANG KASSIM BIN ABDULLAH',
        NO_KP: '880512-13-5566',
        NO_PASPORT: '',
        KEWARGANEGARAAN: 'WARGANEGARA',
        JANTINA: 'LELAKI',
        TARIKH_LAHIR: '1988-05-12',
        ETNIK: 'MELANAU',
        NO_TELEFON: '013-8889999',
        ALAMAT: 'Kampung Tellian Tengah, Dalat',
      },
      {
        NO_RN: 'HD-RN/2026/0002',
        NAMA_PESAKIT: 'FLORENCE ANAK JELANI',
        NO_KP: '920314-13-6677',
        NO_PASPORT: '',
        KEWARGANEGARAAN: 'WARGANEGARA',
        JANTINA: 'PEREMPUAN',
        TARIKH_LAHIR: '1992-03-14',
        ETNIK: 'IBAN',
        NO_TELEFON: '019-7776655',
        ALAMAT: 'Kampung Sungai Ud, Dalat',
      },
      {
        NO_RN: 'HD-RN/2026/0003',
        NAMA_PESAKIT: 'ROBERT SMITH',
        NO_KP: '',
        NO_PASPORT: 'A98765432',
        KEWARGANEGARAAN: 'BUKAN WARGANEGARA',
        JANTINA: 'LELAKI',
        TARIKH_LAHIR: '1980-11-20',
        ETNIK: 'LAIN-LAIN',
        NO_TELEFON: '012-3334444',
        ALAMAT: 'Pekan Dalat, Sarawak',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Pesakit');
    XLSX.writeFile(wb, 'Template_Import_Pesakit.xlsx');
  };

  // Baca & Sahkan Fail Import
  const handleImportFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setValidImportPatients([]);
    setImportErrors([]);
    setImportSuccessMsg('');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', raw: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

        if (rows.length === 0) {
          setImportErrors(['Fail Excel/CSV kosong.']);
          return;
        }

        const db = getDatabase();
        const existing = await db.patients.toArray();
        const existingRNs = new Set(existing.map((p) => p.no_rn.toUpperCase()));
        const existingDocs = new Set(existing.map((p) => p.no_dokumen_normalized).filter(Boolean));
        const seenRNsInFile = new Set<string>();

        const valid: Patient[] = [];
        const errs: string[] = [];
        const nowStr = formatDateTimeKuching();

        for (let idx = 0; idx < rows.length; idx++) {
          const r = rows[idx];
          const rowNum = idx + 2; // header is row 1

          // Cari lajur berkaitan
          let rawRN = '';
          let rawName = '';
          let rawDoc = '';
          let rawPassport = '';
          let rawCitizen = 'WARGANEGARA';
          let rawGender = 'LELAKI';
          let rawDob = '';
          let rawEthnic = 'MELANAU';
          let rawPhone = '';
          let rawAddress = '';

          for (const key of Object.keys(r)) {
            const k = key.toUpperCase();
            const val = String(r[key] || '').trim();
            if (k.includes('RN')) rawRN = val;
            else if (k.includes('NAMA')) rawName = val;
            else if (k.includes('KP') || k.includes('MYKAD') || k.includes('DOKUMEN')) rawDoc = val;
            else if (k.includes('PASPORT')) rawPassport = val;
            else if (k.includes('WARGA')) rawCitizen = val;
            else if (k.includes('JANTINA') || k.includes('SEX')) rawGender = val;
            else if (k.includes('LAHIR') || k.includes('DOB')) rawDob = val;
            else if (k.includes('ETNIK') || k.includes('BANGSA')) rawEthnic = val;
            else if (k.includes('TEL') || k.includes('PHONE')) rawPhone = val;
            else if (k.includes('ALAMAT') || k.includes('ADDRESS')) rawAddress = val;
          }

          if (!rawRN) {
            errs.push(`Baris ${rowNum}: Tiada No. RN.`);
            continue;
          }
          if (!rawName) {
            errs.push(`Baris ${rowNum} (RN: ${rawRN}): Tiada Nama Pesakit.`);
            continue;
          }

          const cleanRN = rawRN.toUpperCase();
          if (seenRNsInFile.has(cleanRN)) {
            errs.push(`Baris ${rowNum}: No. RN bertindih dalam fail (${cleanRN}).`);
            continue;
          }
          seenRNsInFile.add(cleanRN);

          if (existingRNs.has(cleanRN)) {
            errs.push(`Baris ${rowNum}: No. RN telah wujud dalam Master Database (${cleanRN}).`);
            continue;
          }

          const normDoc = normalizeDocNumber(rawDoc);
          if (normDoc && existingDocs.has(normDoc)) {
            errs.push(`Baris ${rowNum}: No. Dokumen telah wujud dalam pangkalan data (${rawDoc}).`);
            continue;
          }

          const normName = normalizeName(rawName);
          const citizenship: Citizenship = rawCitizen.toUpperCase().includes('BUKAN')
            ? 'BUKAN WARGANEGARA'
            : 'WARGANEGARA';
          const gender: Gender = rawGender.toUpperCase().startsWith('P') ? 'PEREMPUAN' : 'LELAKI';

          let formattedDob = rawDob;
          if (rawDob.includes('/')) {
            const parts = rawDob.split('/');
            if (parts.length === 3) {
              if (parts[2].length === 4) {
                formattedDob = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            }
          }

          // Ubah Orang Ulu ke Bumiputera Sarawak jika ada dalam fail lama
          let normalizedEthnic = rawEthnic.toUpperCase();
          if (normalizedEthnic.includes('ORANG ULU')) {
            normalizedEthnic = 'BUMIPUTERA SARAWAK';
          }

          const newPatient: Patient = {
            patient_id: crypto.randomUUID(),
            no_rn: cleanRN,
            jenis_dokumen: normDoc ? 'MYKAD' : rawPassport ? 'PASPORT' : 'TIADA DOKUMEN',
            no_dokumen: rawDoc,
            no_dokumen_normalized: normDoc,
            nama_pesakit: normName,
            nama_normalized: normName,
            nama_tokens: generateNameTokens(normName),
            jantina: gender,
            tarikh_lahir: formattedDob || '1990-01-01',
            etnik: normalizedEthnic || 'MELANAU',
            kewarganegaraan: citizenship,
            no_pasport: rawPassport,
            no_pasport_normalized: normalizeDocNumber(rawPassport),
            alamat: rawAddress,
            nombor_telefon: rawPhone,
            nama_waris: '',
            telefon_waris: '',
            status_pesakit: 'AKTIF',
            tarikh_kehadiran_terakhir: null,
            first_visit_date: null,
            dicipta_melalui: 'IMPORT',
            merged_into_patient_id: null,
            tarikh_dicipta: nowStr,
            tarikh_dikemaskini: nowStr,
            created_by: session.username,
            updated_by: session.username,
          };

          valid.push(newPatient);
        }

        setValidImportPatients(valid);
        setImportErrors(errs);
      } catch (err: any) {
        setImportErrors(['Ralat membaca fail: ' + (err.message || 'Format fail tidak sah.')]);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Simpan data sah ke dalam database
  const handleExecuteImport = async () => {
    if (validImportPatients.length === 0) return;
    setImporting(true);
    try {
      const db = getDatabase();
      await db.transaction('rw', [db.patients, db.audit_logs], async () => {
        await db.patients.bulkAdd(validImportPatients);
      });

      setImportSuccessMsg(`Berjaya mengimport ${validImportPatients.length} rekod pesakit ke dalam Master Patient Database!`);
      await loadPatients();
      setTimeout(() => {
        setShowImportModal(false);
        setValidImportPatients([]);
        setImportFileName('');
        setImportSuccessMsg('');
      }, 2500);
    } catch (err: any) {
      alert('Ralat semasa mengimport: ' + (err.message || 'Sila cuba lagi.'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHelp
        title="Pangkalan Data Induk Pesakit (Master Patient Database)"
        points={[
          'Master Patient Database adalah KEKAL selamanya di Hospital Dalat dan tidak pernah dipadam.',
          'Staff Kaunter boleh menggunakan fungsi "IMPORT DATA PESAKIT" untuk memuat naik data pesakit pukal melalui fail Excel/CSV.',
          'Staff Kaunter boleh menghantar "Permohonan Pembetulan Profil" jika terdapat kesilapan ejaan atau nombor kad pengenalan.',
          'Penyelia boleh meluluskan permohonan pembetulan dan menggabungkan rekod pesakit yang bertindih (Merge).',
        ]}
      />

      {/* Top Search & Actions Card */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-2xl font-black text-gray-900">MASTER PATIENT DATABASE</h2>
            <p className="text-sm font-bold text-gray-600">Hospital Dalat · Rekod Induk Pesakit Kekal</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Butang Import Data Pesakit (Requirement 5) */}
            <button
              type="button"
              onClick={() => {
                setShowImportModal(true);
                setImportFileName('');
                setValidImportPatients([]);
                setImportErrors([]);
                setImportSuccessMsg('');
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-black text-sm shadow cursor-pointer transition"
            >
              <Upload className="w-5 h-5" />
              <span>IMPORT DATA PESAKIT (EXCEL)</span>
            </button>

            <span className="text-sm font-bold bg-blue-100 text-[#2F5D8A] px-4 py-3 rounded-xl whitespace-nowrap">
              {patients.length} Rekod Dipaparkan
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
            <Search className="w-6 h-6 text-[#2F5D8A]" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Cari Pesakit Induk (No. RN, Nama, No. Kad Pengenalan, No. Pasport)..."
            className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 border-gray-400 font-bold text-lg focus:outline-none focus:border-[#2F5D8A]"
          />
        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300 text-gray-800 text-sm font-black uppercase">
                <th className="p-4">No. RN</th>
                <th className="p-4">Nama Pesakit</th>
                <th className="p-4">No. Dokumen/Pasport</th>
                <th className="p-4">Umur & Jantina</th>
                <th className="p-4">Etnik</th>
                <th className="p-4">Kewarganegaraan</th>
                <th className="p-4">Kehadiran Terakhir</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-base font-medium">
              {patients.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-500 font-bold">
                    Tiada rekod pesakit dijumpai. Anda boleh menambah pesakit baharu atau menggunakan fungsi Import di atas.
                  </td>
                </tr>
              ) : (
                patients.map((p) => {
                  const age = calculateAge(p.tarikh_lahir);
                  const isMerged = p.status_pesakit === 'DIGABUNG';

                  return (
                    <tr
                      key={p.patient_id}
                      className={`hover:bg-blue-50/50 ${isMerged ? 'bg-gray-100 opacity-60' : ''}`}
                    >
                      <td className="p-4 font-black text-[#2F5D8A]">{p.no_rn}</td>
                      <td className="p-4 font-black text-gray-900 uppercase">{p.nama_pesakit}</td>
                      <td className="p-4 font-bold text-gray-700">
                        {maskIdentity(p.no_dokumen || p.no_pasport)}
                      </td>
                      <td className="p-4 text-sm font-bold text-gray-700">
                        {age.display} · {p.jantina}
                      </td>
                      <td className="p-4 text-sm font-bold text-gray-700">
                        {p.etnik}
                      </td>
                      <td className="p-4 text-sm font-bold">{p.kewarganegaraan}</td>
                      <td className="p-4 text-sm font-bold text-gray-600">
                        {formatDateDisplay(p.tarikh_kehadiran_terakhir)}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                            p.status_pesakit === 'AKTIF'
                              ? 'bg-green-100 text-green-800'
                              : p.status_pesakit === 'TIDAK AKTIF'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {p.status_pesakit}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => setViewPatient(p)}
                          className="px-3 py-1.5 bg-[#2F5D8A] text-white rounded-lg font-bold text-xs hover:bg-[#254A6F] shadow-sm cursor-pointer"
                        >
                          Lihat Profil
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Import Data Pesakit (Requirement 5) */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border-2 border-gray-300 overflow-hidden my-6">
            <div className="p-6 bg-teal-800 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Upload className="w-8 h-8" />
                <div>
                  <h3 className="text-2xl font-black">IMPORT DATA MASTER PESAKIT</h3>
                  <p className="text-sm text-teal-100 font-medium">
                    Muat naik fail Excel (.xlsx, .xls) atau CSV untuk mendaftar profil pesakit secara pukal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-1.5 text-white hover:bg-white/20 rounded-xl cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              {importSuccessMsg && (
                <div className="p-4 bg-green-50 border-2 border-green-600 text-green-900 rounded-xl font-bold flex items-center gap-3">
                  <CheckCircle2 className="w-7 h-7 text-green-700 flex-shrink-0" />
                  <span>{importSuccessMsg}</span>
                </div>
              )}

              {/* Step 1: Download Template */}
              <div className="p-5 bg-blue-50/70 border-2 border-blue-200 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <span className="text-xs font-black uppercase text-[#2F5D8A] tracking-wider block">
                    LANGKAH 1: FORMAT & TEMPLAT RASMI
                  </span>
                  <h4 className="text-lg font-black text-gray-900 mt-0.5">
                    Muat Turun Templat Excel Piawai
                  </h4>
                  <p className="text-sm font-semibold text-gray-600">
                    Templat mengandungi susunan lajur No. RN, Nama Pesakit, No. KP, Tarikh Lahir, Etnik, dan Maklumat Asas.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-[#2F5D8A] text-[#2F5D8A] hover:bg-blue-100 rounded-xl font-bold text-sm shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  <span>Muat Turun Templat (.xlsx)</span>
                </button>
              </div>

              {/* Step 2: Upload File */}
              <div className="p-5 bg-gray-50 border-2 border-dashed border-gray-400 rounded-2xl text-center space-y-3">
                <FileSpreadsheet className="w-12 h-12 text-teal-700 mx-auto" />
                <div>
                  <label className="text-base font-black text-gray-900 block">
                    Pilih Fail Excel / CSV Untuk Diimport:
                  </label>
                  <span className="text-xs text-gray-500 font-bold block mt-0.5">
                    Sistem akan menyemak format dan menapis sebarang rekod pendua secara automatik.
                  </span>
                </div>

                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleImportFileUpload}
                  className="mx-auto block text-sm font-bold text-gray-700 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-sm file:font-black file:bg-teal-700 file:text-white hover:file:bg-teal-800 cursor-pointer"
                />

                {importFileName && (
                  <div className="text-sm font-black text-teal-800">
                    Fail Dipilih: {importFileName}
                  </div>
                )}
              </div>

              {/* Validation Results & Preview */}
              {(validImportPatients.length > 0 || importErrors.length > 0) && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 border border-green-300 rounded-xl">
                      <span className="text-xs font-bold text-green-700 uppercase block">REKOD SAH SEDIA DIIMPORT</span>
                      <span className="text-3xl font-black text-green-900 block mt-1">
                        {validImportPatients.length}
                      </span>
                    </div>

                    <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl">
                      <span className="text-xs font-bold text-amber-700 uppercase block">REKOD DITOLAK / PENDUA</span>
                      <span className="text-3xl font-black text-amber-900 block mt-1">
                        {importErrors.length}
                      </span>
                    </div>
                  </div>

                  {importErrors.length > 0 && (
                    <div className="p-4 bg-red-50 border border-red-300 rounded-xl max-h-40 overflow-y-auto space-y-1">
                      <span className="text-xs font-black text-red-800 uppercase block">SENARAI AMARAN / KESILAPAN:</span>
                      {importErrors.slice(0, 10).map((err, i) => (
                        <p key={i} className="text-xs font-bold text-red-700">
                          &bull; {err}
                        </p>
                      ))}
                      {importErrors.length > 10 && (
                        <p className="text-xs font-bold text-red-800 italic">
                          ... dan {importErrors.length - 10} ralat lain.
                        </p>
                      )}
                    </div>
                  )}

                  {validImportPatients.length > 0 && (
                    <div className="p-4 bg-white rounded-xl border border-gray-300 max-h-48 overflow-y-auto">
                      <span className="text-xs font-black text-gray-700 uppercase block mb-2">
                        Pratonton 5 Rekod Pertama Yang Akan Dimasukkan:
                      </span>
                      <div className="divide-y divide-gray-200 text-xs">
                        {validImportPatients.slice(0, 5).map((p, idx) => (
                          <div key={idx} className="py-1.5 flex justify-between items-center">
                            <div>
                              <span className="font-black text-[#2F5D8A] mr-2">{p.no_rn}</span>
                              <span className="font-bold text-gray-900 uppercase">{p.nama_pesakit}</span>
                            </div>
                            <span className="text-gray-500 font-semibold">
                              {p.jantina} · {p.etnik} · {p.tarikh_lahir}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 flex justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="py-3 px-6 rounded-xl font-bold text-base bg-gray-200 hover:bg-gray-300 text-gray-800 cursor-pointer"
                >
                  BATAL
                </button>
                <button
                  type="button"
                  disabled={validImportPatients.length === 0 || importing}
                  onClick={handleExecuteImport}
                  className="py-3 px-8 rounded-xl font-black text-base bg-teal-700 hover:bg-teal-800 text-white flex items-center gap-2 shadow-lg transition disabled:opacity-40 cursor-pointer"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>
                    {importing
                      ? 'SEDANG MENGIMPORT...'
                      : `SAHKAN & MASUKKAN (${validImportPatients.length}) REKOD`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: View Patient Details */}
      {viewPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border-2 border-gray-300 overflow-hidden my-6">
            <div className="p-6 bg-[#2F5D8A] text-white flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-blue-200 uppercase tracking-widest block">
                  PROFIL MASTER PATIENT
                </span>
                <h3 className="text-2xl font-black uppercase mt-0.5">{viewPatient.nama_pesakit}</h3>
              </div>
              <button
                onClick={() => setViewPatient(null)}
                className="p-1.5 text-white hover:bg-white/20 rounded-xl cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-300">
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase block">NO. RN:</span>
                  <span className="text-xl font-black text-[#2F5D8A] block">{viewPatient.no_rn}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase block">JENIS DOKUMEN:</span>
                  <span className="text-base font-bold text-gray-900 block">{viewPatient.jenis_dokumen}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase block">NO. DOKUMEN:</span>
                  <span className="text-base font-bold text-gray-900 block">
                    {maskIdentity(viewPatient.no_dokumen || viewPatient.no_pasport)}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase block">TARIKH LAHIR:</span>
                  <span className="text-base font-bold text-gray-900 block">
                    {formatDateDisplay(viewPatient.tarikh_lahir)} ({calculateAge(viewPatient.tarikh_lahir).display})
                  </span>
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase block">JANTINA:</span>
                  <span className="text-base font-bold text-gray-900 block">{viewPatient.jantina}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase block">ETNIK / BANGSA:</span>
                  <span className="text-base font-bold text-gray-900 block">{viewPatient.etnik}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-base text-gray-800">
                  <Phone className="w-5 h-5 text-[#2F5D8A]" />
                  <span>Telefon Pesakit: <strong>{viewPatient.nombor_telefon || '-'}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-base text-gray-800">
                  <Home className="w-5 h-5 text-[#2F5D8A]" />
                  <span>Alamat: <strong>{viewPatient.alamat || '-'}</strong></span>
                </div>
                <div className="p-3 bg-gray-100 rounded-xl border border-gray-300 text-xs text-gray-600">
                  Sumber: Dicipta melalui {viewPatient.dicipta_melalui} pada {viewPatient.tarikh_dicipta}
                </div>
              </div>

              {/* Action buttons on Profile */}
              <div className="pt-4 flex flex-wrap gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowCorrectionModal(true);
                    setCorrectionField('nama_pesakit');
                    setCorrectionNewVal('');
                    setCorrectionReason('');
                  }}
                  className="py-3 px-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-base flex items-center gap-2 cursor-pointer"
                >
                  <FileEdit className="w-5 h-5" />
                  <span>Mohon Pembetulan Profil</span>
                </button>

                {session.role === 'PENYELIA' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMergeKeepPatient(viewPatient);
                      setShowMergeModal(true);
                      setMergeDuplicateId('');
                      setMergeReason('');
                    }}
                    className="py-3 px-5 rounded-xl bg-[#5C4D7D] hover:bg-purple-900 text-white font-bold text-base flex items-center gap-2 cursor-pointer"
                  >
                    <GitMerge className="w-5 h-5" />
                    <span>Gabung Rekod Pendua</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Request Profile Correction */}
      {showCorrectionModal && viewPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 md:p-8 shadow-2xl border-2 border-gray-300 space-y-4">
            <h3 className="text-2xl font-black text-gray-900">PERMOHONAN PEMBETULAN PROFIL</h3>
            <p className="text-sm font-semibold text-gray-600">
              Pesakit: <strong>{viewPatient.nama_pesakit}</strong> ({viewPatient.no_rn})
            </p>

            {correctionMsg && (
              <div className="p-3 bg-blue-50 text-blue-900 border border-blue-300 rounded-xl text-sm font-bold">
                {correctionMsg}
              </div>
            )}

            <form onSubmit={handleCorrectionSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Medan Untuk Dibetulkan:</label>
                <select
                  value={correctionField}
                  onChange={(e) => setCorrectionField(e.target.value)}
                  className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold"
                >
                  <option value="nama_pesakit">Nama Pesakit</option>
                  <option value="no_dokumen">Nombor Kad Pengenalan / Dokumen</option>
                  <option value="no_pasport">Nombor Pasport</option>
                  <option value="tarikh_lahir">Tarikh Lahir</option>
                  <option value="jantina">Jantina</option>
                  <option value="etnik">Etnik / Bangsa</option>
                  <option value="nombor_telefon">Nombor Telefon</option>
                  <option value="alamat">Alamat Kediaman</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nilai Baharu Yang Betul:</label>
                <input
                  type="text"
                  value={correctionNewVal}
                  onChange={(e) => setCorrectionNewVal(e.target.value)}
                  placeholder="Masukkan nilai yang betul..."
                  className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Sebab Pembetulan (WAJIB):</label>
                <input
                  type="text"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="cth: Salah ejaan satu huruf pada kad pengenalan sebenar"
                  className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="w-1/2 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-base text-gray-800 cursor-pointer"
                >
                  BATAL
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 font-black text-base text-white shadow cursor-pointer"
                >
                  HANTAR PERMOHONAN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Merge Duplicate Patients (Supervisor Only) */}
      {showMergeModal && mergeKeepPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 md:p-8 shadow-2xl border-4 border-[#5C4D7D] space-y-4">
            <h3 className="text-2xl font-black text-gray-900">GABUNG REKOD PENDUA (MERGE)</h3>
            <p className="text-sm font-medium text-gray-700">
              Rekod Utama Yang Dikekalkan: <strong>{mergeKeepPatient.nama_pesakit}</strong> ({mergeKeepPatient.no_rn})
            </p>

            {mergeError && (
              <p className="text-sm font-bold text-red-700">{mergeError}</p>
            )}

            <form onSubmit={handleMergeSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Pilih Pesakit Pendua (Yang Akan Digabungkan Ke Rekod Utama):
                </label>
                <select
                  value={mergeDuplicateId}
                  onChange={(e) => setMergeDuplicateId(e.target.value)}
                  className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold"
                >
                  <option value="">-- Pilih Rekod Pendua --</option>
                  {patients
                    .filter((p) => p.patient_id !== mergeKeepPatient.patient_id && p.status_pesakit !== 'DIGABUNG')
                    .map((p) => (
                      <option key={p.patient_id} value={p.patient_id}>
                        {p.no_rn} - {p.nama_pesakit} ({maskIdentity(p.no_dokumen || p.no_pasport)})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Sebab Penggabungan (WAJIB):
                </label>
                <input
                  type="text"
                  value={mergeReason}
                  onChange={(e) => setMergeReason(e.target.value)}
                  placeholder="cth: Pesakit didaftar dua kali dengan ejaan berbeza"
                  className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowMergeModal(false)}
                  className="w-1/2 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-base text-gray-800 cursor-pointer"
                >
                  BATAL
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3 rounded-xl bg-[#5C4D7D] hover:bg-purple-900 font-black text-base text-white shadow cursor-pointer"
                >
                  LULUSKAN PENGGABUNGAN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
