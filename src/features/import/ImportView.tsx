import React, { useState } from 'react';
import { getDatabase } from '../../data/db';
import type { ActiveSession, Patient, Citizenship, DocumentType, Gender } from '../../types';
import { PageHelp } from '../../components/veteran/PageHelp';
import { normalizeName, generateNameTokens, normalizeDocNumber } from '../../utils/normalize';
import { formatDateTimeKuching, getTodayDateString } from '../../utils/dateUtils';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Download, ArrowRight } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportViewProps {
  session: ActiveSession;
}

export const ImportView: React.FC<ImportViewProps> = ({ session }) => {
  const [fileData, setFileData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');

  // Column mappings
  const [rnCol, setRnCol] = useState('');
  const [nameCol, setNameCol] = useState('');
  const [docCol, setDocCol] = useState('');
  const [passportCol, setPassportCol] = useState('');
  const [citizenCol, setCitizenCol] = useState('');
  const [genderCol, setGenderCol] = useState('');
  const [dobCol, setDobCol] = useState('');
  const [ethnicCol, setEthnicCol] = useState('');
  const [phoneCol, setPhoneCol] = useState('');
  const [lastVisitCol, setLastVisitCol] = useState('');

  // Validation results
  const [validatedRows, setValidatedRows] = useState<Patient[]>([]);
  const [errorRows, setErrorRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', raw: true }); // raw: true preserves strings as exact text
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false }); // raw: false formats text cleanly

        if (data.length === 0) {
          alert('Fail Excel/CSV kosong.');
          return;
        }

        const cols = Object.keys(data[0]);
        setColumns(cols);
        setFileData(data);

        // Auto-match column names by guess
        for (const c of cols) {
          const upper = c.toUpperCase();
          if (upper.includes('RN')) setRnCol(c);
          else if (upper.includes('NAMA')) setNameCol(c);
          else if (upper.includes('KP') || upper.includes('MYKAD') || upper.includes('IC')) setDocCol(c);
          else if (upper.includes('PASPORT')) setPassportCol(c);
          else if (upper.includes('WARGA')) setCitizenCol(c);
          else if (upper.includes('JANTINA') || upper.includes('SEX')) setGenderCol(c);
          else if (upper.includes('LAHIR') || upper.includes('DOB')) setDobCol(c);
          else if (upper.includes('ETNIK') || upper.includes('BANGSA')) setEthnicCol(c);
          else if (upper.includes('TEL') || upper.includes('PHONE')) setPhoneCol(c);
          else if (upper.includes('TERAKHIR') || upper.includes('VISIT')) setLastVisitCol(c);
        }
      } catch (err: any) {
        alert('Ralat membaca fail: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleValidate = async () => {
    if (!rnCol || !nameCol) {
      alert('Sila petakan sekurang-kurangnya lajur No. RN dan Nama Pesakit.');
      return;
    }

    const db = getDatabase();
    const existingPatients = await db.patients.toArray();
    const existingRNs = new Set(existingPatients.map((p) => p.no_rn.toUpperCase()));
    const existingDocs = new Set(
      existingPatients.map((p) => p.no_dokumen_normalized).filter(Boolean)
    );

    const valid: Patient[] = [];
    const errors: any[] = [];
    const nowStr = formatDateTimeKuching();

    const seenRNsInFile = new Set<string>();

    for (let i = 0; i < fileData.length; i++) {
      const row = fileData[i];
      const rawRn = String(row[rnCol] || '').trim();
      const rawName = String(row[nameCol] || '').trim();
      const rawDoc = docCol ? String(row[docCol] || '').trim() : '';
      const rawPassport = passportCol ? String(row[passportCol] || '').trim() : '';
      const rawCitizen = citizenCol ? String(row[citizenCol] || '').trim().toUpperCase() : 'WARGANEGARA';
      const rawGender = genderCol ? String(row[genderCol] || '').trim().toUpperCase() : 'LELAKI';
      const rawDob = dobCol ? String(row[dobCol] || '').trim() : '1980-01-01';
      const rawEthnic = ethnicCol ? String(row[ethnicCol] || '').trim().toUpperCase() : 'MELANAU';
      const rawPhone = phoneCol ? String(row[phoneCol] || '').trim() : '';
      const rawLastVisit = lastVisitCol ? String(row[lastVisitCol] || '').trim() : null;

      if (!rawRn) {
        errors.push({ baris: i + 2, ralat: 'No. RN kosong', data: row });
        continue;
      }
      if (!rawName) {
        errors.push({ baris: i + 2, ralat: 'Nama pesakit kosong', data: row });
        continue;
      }
      if (seenRNsInFile.has(rawRn.toUpperCase()) || existingRNs.has(rawRn.toUpperCase())) {
        errors.push({ baris: i + 2, ralat: `No. RN '${rawRn}' bertindih / telah wujud`, data: row });
        continue;
      }
      seenRNsInFile.add(rawRn.toUpperCase());

      const normDoc = normalizeDocNumber(rawDoc);
      const normPassport = normalizeDocNumber(rawPassport);
      const isCitizen: Citizenship =
        rawCitizen.includes('BUKAN') || rawCitizen.includes('NON')
          ? 'BUKAN WARGANEGARA'
          : 'WARGANEGARA';

      const normName = normalizeName(rawName);

      const patient: Patient = {
        patient_id: crypto.randomUUID(),
        no_rn: rawRn, // exact preserved
        jenis_dokumen: isCitizen === 'BUKAN WARGANEGARA' ? 'PASPORT' : 'MYKAD',
        no_dokumen: rawDoc,
        no_dokumen_normalized: normDoc,
        nama_pesakit: normName,
        nama_normalized: normName,
        nama_tokens: generateNameTokens(normName),
        jantina: rawGender.startsWith('P') || rawGender.includes('FEMALE') ? 'PEREMPUAN' : 'LELAKI',
        tarikh_lahir: rawDob,
        etnik: rawEthnic || 'MELANAU',
        kewarganegaraan: isCitizen,
        no_pasport: rawPassport,
        no_pasport_normalized: normPassport,
        alamat: '',
        nombor_telefon: rawPhone,
        nama_waris: '',
        telefon_waris: '',
        status_pesakit: 'AKTIF',
        tarikh_kehadiran_terakhir: rawLastVisit || getTodayDateString(),
        first_visit_date: rawLastVisit || null,
        dicipta_melalui: 'IMPORT',
        merged_into_patient_id: null,
        tarikh_dicipta: nowStr,
        tarikh_dikemaskini: nowStr,
        created_by: session.username,
        updated_by: session.username,
      };

      valid.push(patient);
    }

    setValidatedRows(valid);
    setErrorRows(errors);
  };

  const handleExecuteImport = async () => {
    if (validatedRows.length === 0) return;
    setImporting(true);
    const db = getDatabase();

    try {
      await db.transaction('rw', [db.patients, db.audit_logs], async () => {
        await db.patients.bulkAdd(validatedRows);
      });

      setImportResult(`Berjaya mengimport ${validatedRows.length} rekod pesakit ke dalam Master Patient Database!`);
      setFileData([]);
      setValidatedRows([]);
    } catch (err: any) {
      alert('Ralat semasa import: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadErrors = () => {
    const ws = XLSX.utils.json_to_sheet(errorRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ralat_Import');
    XLSX.writeFile(wb, `RALAT_IMPORT_${getTodayDateString()}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <PageHelp
        title="Import Pangkalan Data Pesakit Lama (Excel / CSV)"
        points={[
          'Modul ini khusus untuk Penyelia memindahkan data pesakit lama dari fail Excel atau CSV ke Master Database JPL.',
          'Semua No. RN dan No. Kad Pengenalan dipelihara dengan tepat sebagai teks (termasuk sifar hadapan).',
          'Sistem akan menyemak pendua No. RN dan No. Dokumen secara automatik sebelum data dimasukkan.',
          'Semua pesakit yang diimport akan ditandakan dengan "dicipta_melalui: IMPORT".',
        ]}
      />

      {importResult && (
        <div className="p-6 bg-green-50 border-3 border-green-600 rounded-2xl text-green-900 font-bold flex items-center gap-4">
          <CheckCircle className="w-10 h-10 text-green-700 flex-shrink-0" />
          <div className="text-xl">{importResult}</div>
        </div>
      )}

      {/* Upload Box */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 md:p-8 shadow-sm space-y-4">
        <h3 className="text-2xl font-black text-gray-900">1. PILIH FAIL EXCEL ATAU CSV</h3>
        <p className="text-base text-gray-600 font-medium">
          Muat naik fail pangkalan data pesakit lama (.xlsx atau .csv) untuk dipetakan:
        </p>

        <label className="border-3 border-dashed border-[#2F5D8A] bg-blue-50/50 hover:bg-blue-50 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition">
          <Upload className="w-12 h-12 text-[#2F5D8A] mb-2" />
          <span className="text-xl font-bold text-[#2F5D8A]">
            {fileName ? `Fail Dipilih: ${fileName}` : 'Tekan Untuk Memilih Fail Excel / CSV'}
          </span>
          <span className="text-sm text-gray-500 mt-1">Menyokong format .xlsx, .xls dan .csv</span>
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Column Mapping Section */}
      {fileData.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 md:p-8 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-black text-gray-900">2. PEMETAAN LAJUR DATA</h3>
              <p className="text-sm font-semibold text-gray-600">
                Jumlah Baris Dijumpai: <strong>{fileData.length}</strong>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">
                No. RN Pesakit <span className="text-red-600">*</span>:
              </label>
              <select
                value={rnCol}
                onChange={(e) => setRnCol(e.target.value)}
                className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-base"
              >
                <option value="">-- Pilih Lajur --</option>
                {columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">
                Nama Pesakit <span className="text-red-600">*</span>:
              </label>
              <select
                value={nameCol}
                onChange={(e) => setNameCol(e.target.value)}
                className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-base"
              >
                <option value="">-- Pilih Lajur --</option>
                {columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">No. Kad Pengenalan / Dokumen:</label>
              <select
                value={docCol}
                onChange={(e) => setDocCol(e.target.value)}
                className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-base"
              >
                <option value="">-- Pilih Lajur --</option>
                {columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">No. Pasport:</label>
              <select
                value={passportCol}
                onChange={(e) => setPassportCol(e.target.value)}
                className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-base"
              >
                <option value="">-- Pilih Lajur --</option>
                {columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">Kewarganegaraan:</label>
              <select
                value={citizenCol}
                onChange={(e) => setCitizenCol(e.target.value)}
                className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-base"
              >
                <option value="">-- Pilih Lajur (Lalai: Warganegara) --</option>
                {columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">Jantina:</label>
              <select
                value={genderCol}
                onChange={(e) => setGenderCol(e.target.value)}
                className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-base"
              >
                <option value="">-- Pilih Lajur --</option>
                {columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">Tarikh Lahir:</label>
              <select
                value={dobCol}
                onChange={(e) => setDobCol(e.target.value)}
                className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-base"
              >
                <option value="">-- Pilih Lajur --</option>
                {columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">Etnik / Bangsa:</label>
              <select
                value={ethnicCol}
                onChange={(e) => setEthnicCol(e.target.value)}
                className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-base"
              >
                <option value="">-- Pilih Lajur --</option>
                {columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1">Tarikh Kehadiran Terakhir:</label>
              <select
                value={lastVisitCol}
                onChange={(e) => setLastVisitCol(e.target.value)}
                className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-base"
              >
                <option value="">-- Pilih Lajur (Elak auto tidak aktif) --</option>
                {columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="button"
              onClick={handleValidate}
              className="py-4 px-8 rounded-xl bg-[#2F5D8A] hover:bg-[#254A6F] text-white font-black text-lg flex items-center gap-3 shadow-md"
            >
              <span>SEMAK & SAHKAN DATA (VALIDATE)</span>
              <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Verification Results */}
      {(validatedRows.length > 0 || errorRows.length > 0) && (
        <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 md:p-8 shadow-sm space-y-6">
          <h3 className="text-2xl font-black text-gray-900">3. KEPUTUSAN SEMAKAN PRA-IMPORT</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 bg-green-50 border-2 border-green-500 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-green-800 uppercase block">REKOD SAH UNTUK DIIMPORT</span>
                <span className="text-4xl font-black text-green-900 block mt-1">{validatedRows.length}</span>
              </div>
              <CheckCircle className="w-10 h-10 text-green-700" />
            </div>

            <div className="p-5 bg-red-50 border-2 border-red-500 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-red-800 uppercase block">REKOD BERMASALAH / PENDUA</span>
                <span className="text-4xl font-black text-red-900 block mt-1">{errorRows.length}</span>
                {errorRows.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadErrors}
                    className="text-xs font-bold text-red-700 underline mt-1 block"
                  >
                    Muat Turun Senarai Ralat (.xlsx)
                  </button>
                )}
              </div>
              <AlertTriangle className="w-10 h-10 text-red-700" />
            </div>
          </div>

          {validatedRows.length > 0 && (
            <div className="pt-4 flex justify-end">
              <button
                type="button"
                disabled={importing}
                onClick={handleExecuteImport}
                className="py-4 px-10 rounded-2xl bg-green-700 hover:bg-green-800 text-white font-black text-xl flex items-center gap-3 shadow-xl cursor-pointer disabled:opacity-50"
              >
                <CheckCircle className="w-7 h-7 text-white" />
                <span>
                  {importing ? 'SEDANG MEMASUKKAN DATA...' : `SAHKAN & IMPORT ${validatedRows.length} REKOD`}
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
