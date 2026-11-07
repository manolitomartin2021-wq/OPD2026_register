import React, { useState, useEffect } from 'react';
import { getDatabase } from '../../data/db';
import type { ActiveSession, MonthStatus, MonthlySummary, RetenDefinition } from '../../types';
import {
  calculateMonthlyReten,
  closeMonth,
  calculateOPD212Reten,
  type OPD212Report,
} from '../../data/dataService';
import { PageHelp } from '../../components/veteran/PageHelp';
import { ConfirmModal } from '../../components/veteran/ConfirmModal';
import {
  formatYearMonthDisplay,
  formatDateDisplay,
  getCurrentYearMonth,
} from '../../utils/dateUtils';
import {
  FileText,
  Calendar,
  Printer,
  Download,
  CheckCircle,
  AlertTriangle,
  Lock,
  ShieldCheck,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface LaporanRetenViewProps {
  session: ActiveSession;
}

export const LaporanRetenView: React.FC<LaporanRetenViewProps> = ({ session }) => {
  const [selectedYearMonth, setSelectedYearMonth] = useState(getCurrentYearMonth());
  const [activeTab, setActiveTab] = useState<'OPD212' | 'RINGKASAN_OPERASI'>('OPD212');

  // OPD 212 Report State (Official KKM Reten)
  const [opd212Report, setOpd212Report] = useState<OPD212Report | null>(null);

  // Operational Reten State
  const [currentReten, setCurrentReten] = useState<MonthlySummary['data_json'] | null>(null);
  const [prevReten, setPrevReten] = useState<MonthlySummary['data_json'] | null>(null);
  const [monthStatus, setMonthStatus] = useState<MonthStatus | null>(null);
  const [retenDefinitions, setRetenDefinitions] = useState<RetenDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  // Month Close Modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeSuccessMsg, setCloseSuccessMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    const db = getDatabase();

    // 1. OPD 212 Official KKM Report
    try {
      const opd = await calculateOPD212Reten(selectedYearMonth);
      setOpd212Report(opd);
    } catch (err) {
      console.error('Error calculating OPD 212 reten:', err);
    }

    // 2. Operational Reten
    const data = await calculateMonthlyReten(selectedYearMonth);
    setCurrentReten(data);

    // 3. Previous month data
    const [y, m] = selectedYearMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevYM = `${prevDate.getFullYear()}-${(prevDate.getMonth() + 1).toString().padStart(2, '0')}`;
    const prevSummary = await db.monthly_summaries.where('tahun_bulan').equals(prevYM).last();
    if (prevSummary) {
      setPrevReten(prevSummary.data_json);
    } else {
      const prevCalculated = await calculateMonthlyReten(prevYM);
      setPrevReten(prevCalculated);
    }

    // 4. Month status
    const ms = await db.month_status.get(selectedYearMonth);
    setMonthStatus(ms || null);

    // 5. Reten definitions
    const defs = await db.reten_definitions.toArray();
    setRetenDefinitions(defs);

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedYearMonth]);

  const changeMonth = (offset: number) => {
    const [y, m] = selectedYearMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + offset, 1);
    const newYM = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    setSelectedYearMonth(newYM);
  };

  const allDefinitionsVerified =
    retenDefinitions.length > 0 && retenDefinitions.every((d) => !!d.disahkan_oleh);

  const handleVerifyAllDefinitions = async () => {
    const db = getDatabase();
    await db.transaction('rw', db.reten_definitions, async () => {
      for (const d of retenDefinitions) {
        await db.reten_definitions.update(d.kod_indikator, {
          disahkan_oleh: session.username,
          tarikh_pengesahan: formatDateDisplay(new Date().toISOString()),
        });
      }
    });
    loadData();
  };

  const handleExecuteCloseMonth = async () => {
    setClosing(true);
    try {
      const res = await closeMonth(selectedYearMonth);
      setMonthStatus(res);
      setShowCloseModal(false);
      setCloseSuccessMsg(
        `Bulan ${formatYearMonthDisplay(selectedYearMonth)} telah ditutup rasmi! Tarikh layak bersih dikira: ${formatDateDisplay(res.tarikh_layak_bersih)}.`
      );
      loadData();
    } catch (err: any) {
      alert(err.message || 'Ralat semasa menutup bulan.');
    } finally {
      setClosing(false);
    }
  };

  // Export Official KKM OPD 212 Excel format
  const handleExportOPD212Excel = () => {
    if (!opd212Report) return;

    const data: any[][] = [
      ['SISTEM MAKLUMAT PENGURUSAN KESIHATAN'],
      ['KEMENTERIAN KESIHATAN MALAYSIA'],
      [],
      ['Laporan Bulanan/Tahunan Kedatangan Pesakit Luar Mengikut Umur/Jantina dan Kumpulan Etnik'],
      [`Bagi Bulan ${opd212Report.monthName} Tahun ${opd212Report.year}`],
      [],
      ['Unit/Klinik : OUTPATIENT DEPARTMENT'],
      ['Hospital : DALAT'],
      ['Negeri : SARAWAK'],
      [],
      [],
      [
        'Kumpulan Ethnic',
        '< 10 tahun',
        '',
        '10-19 tahun',
        '',
        '20-59 tahun',
        '',
        '>= 60 tahun',
        '',
        'JUMLAH',
        '',
        'JUMLAH BESAR',
      ],
      [
        '',
        'Lelaki',
        'Perempuan',
        'Lelaki',
        'Perempuan',
        'Lelaki',
        'Perempuan',
        'Lelaki',
        'Perempuan',
        'Lelaki',
        'Perempuan',
        '',
      ],
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
    ];

    for (const r of opd212Report.rows) {
      const label =
        r.id === 'BUKAN_WARGA_DENGAN_IZIN'
          ? 'Bukan Warganegara: Dengan Izin'
          : r.id === 'BUKAN_WARGA_TANPA_IZIN'
          ? 'Bukan Warganegara: Tanpa Izin'
          : r.label;

      data.push([
        label,
        r.u10_l || 0,
        r.u10_p || 0,
        r.u19_l || 0,
        r.u19_p || 0,
        r.u59_l || 0,
        r.u59_p || 0,
        r.u60_l || 0,
        r.u60_p || 0,
        r.total_l || 0,
        r.total_p || 0,
        r.grand_total || 0,
      ]);
    }

    // Row Jumlah Keseluruhan
    const tot = opd212Report.totalRow;
    data.push([
      'JUMLAH',
      tot.u10_l || 0,
      tot.u10_p || 0,
      tot.u19_l || 0,
      tot.u19_p || 0,
      tot.u59_l || 0,
      tot.u59_p || 0,
      tot.u60_l || 0,
      tot.u60_p || 0,
      tot.total_l || 0,
      tot.total_p || 0,
      tot.grand_total || 0,
    ]);

    const ws = XLSX.utils.aoa_to_sheet(data);

    ws['!merges'] = [
      { s: { r: 11, c: 0 }, e: { r: 12, c: 0 } },
      { s: { r: 11, c: 1 }, e: { r: 11, c: 2 } },
      { s: { r: 11, c: 3 }, e: { r: 11, c: 4 } },
      { s: { r: 11, c: 5 }, e: { r: 11, c: 6 } },
      { s: { r: 11, c: 7 }, e: { r: 11, c: 8 } },
      { s: { r: 11, c: 9 }, e: { r: 11, c: 10 } },
      { s: { r: 11, c: 11 }, e: { r: 12, c: 11 } },
    ];

    ws['!cols'] = [
      { wch: 30 },
      { wch: 9 },
      { wch: 11 },
      { wch: 9 },
      { wch: 11 },
      { wch: 9 },
      { wch: 11 },
      { wch: 9 },
      { wch: 11 },
      { wch: 10 },
      { wch: 11 },
      { wch: 15 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `OPD 212 - ${opd212Report.monthName} ${opd212Report.year}.xlsx`);
  };

  // Export Summary Operations Excel
  const handleExportSummaryExcel = () => {
    if (!currentReten) return;

    const summaryRows = [
      { Indikator: 'Jumlah Kehadiran Sah', Bulan_Ini: currentReten.jumlah_kehadiran_sah, Bulan_Lepas: prevReten?.jumlah_kehadiran_sah || 0 },
      { Indikator: 'Kategori: F/UP RUTIN', Bulan_Ini: currentReten.kategori_fup, Bulan_Lepas: prevReten?.kategori_fup || 0 },
      { Indikator: 'Kategori: WALK-IN', Bulan_Ini: currentReten.kategori_walkin, Bulan_Lepas: prevReten?.kategori_walkin || 0 },
      { Indikator: 'Kategori: MEDICAL CHECK UP', Bulan_Ini: currentReten.kategori_checkup, Bulan_Lepas: prevReten?.kategori_checkup || 0 },
      { Indikator: 'Kategori: PROCEDURE ROOM', Bulan_Ini: currentReten.kategori_procedure, Bulan_Lepas: prevReten?.kategori_procedure || 0 },
      { Indikator: 'Pesakit Baharu', Bulan_Ini: currentReten.pesakit_baharu, Bulan_Lepas: prevReten?.pesakit_baharu || 0 },
      { Indikator: 'Pesakit Sedia Ada', Bulan_Ini: currentReten.pesakit_sedia_ada, Bulan_Lepas: prevReten?.pesakit_sedia_ada || 0 },
      { Indikator: 'Pesakit Unik', Bulan_Ini: currentReten.pesakit_unik, Bulan_Lepas: prevReten?.pesakit_unik || 0 },
      { Indikator: 'Warganegara Malaysia', Bulan_Ini: currentReten.warganegara, Bulan_Lepas: prevReten?.warganegara || 0 },
      { Indikator: 'Bukan Warganegara', Bulan_Ini: currentReten.bukan_warganegara, Bulan_Lepas: prevReten?.bukan_warganegara || 0 },
      { Indikator: 'Jantina Lelaki', Bulan_Ini: currentReten.lelaki, Bulan_Lepas: prevReten?.lelaki || 0 },
      { Indikator: 'Jantina Perempuan', Bulan_Ini: currentReten.perempuan, Bulan_Lepas: prevReten?.perempuan || 0 },
      { Indikator: 'Umur Bawah 12 Tahun', Bulan_Ini: currentReten.umur_bawah_12, Bulan_Lepas: prevReten?.umur_bawah_12 || 0 },
      { Indikator: 'Umur 12 - 59 Tahun', Bulan_Ini: currentReten.umur_12_59, Bulan_Lepas: prevReten?.umur_12_59 || 0 },
      { Indikator: 'Umur 60 Tahun Ke Atas', Bulan_Ini: currentReten.umur_60_keatas, Bulan_Lepas: prevReten?.umur_60_keatas || 0 },
      { Indikator: 'Pendaftaran Dibatalkan (Asing)', Bulan_Ini: currentReten.jumlah_batal, Bulan_Lepas: prevReten?.jumlah_batal || 0 },
    ];

    const ws = XLSX.utils.json_to_sheet(summaryRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reten_Bulanan');
    XLSX.writeFile(wb, `JPL_RETEN_OPERASI_${selectedYearMonth}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <PageHelp
        title="Laporan Reten Rasmi KKM (OPD 212) & Penutupan Bulan"
        points={[
          'Reten Rasmi KKM OPD 212 menjana jadual kedatangan pesakit luar mengikut Kumpulan Etnik, Jantina dan 4 Kumpulan Umur secara tepat daripada data mentah kehadiran.',
          'Fail Excel rasmi (OPD 212.xlsx) boleh dimuat turun terus dengan susunan lajur dan format piawai Kementerian Kesihatan Malaysia.',
          'Penyelia boleh menutup bulan rasmi untuk mengunci rekod bulanan bagi tujuan pematuhan audit.',
        ]}
      />

      {closeSuccessMsg && (
        <div className="p-5 bg-green-50 border-2 border-green-600 rounded-2xl text-green-900 font-bold flex items-center gap-3">
          <CheckCircle className="w-8 h-8 text-green-700 flex-shrink-0" />
          <span>{closeSuccessMsg}</span>
        </div>
      )}

      {/* Control Header */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-8 h-8 text-[#2F5D8A]" />
            <h2 className="text-2xl font-black text-gray-900">
              LAPORAN RETEN BULANAN HOSPITAL DALAT
            </h2>
          </div>
          <p className="text-base text-gray-600 font-medium mt-1">
            Format Piawai KKM: <strong>OPD 212</strong> · Bulan:{' '}
            <strong>{formatYearMonthDisplay(selectedYearMonth)}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Month Selector with buttons */}
          <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-2xl border border-gray-300">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="p-2 rounded-xl hover:bg-white text-gray-700 transition cursor-pointer"
              title="Bulan Sebelumnya"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-3 py-1 text-base font-black text-[#2F5D8A] whitespace-nowrap">
              {formatYearMonthDisplay(selectedYearMonth)}
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

          {/* Action buttons */}
          {activeTab === 'OPD212' ? (
            <button
              type="button"
              onClick={handleExportOPD212Excel}
              className="flex items-center gap-2 px-5 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black text-base shadow cursor-pointer transition"
            >
              <Download className="w-5 h-5" />
              <span>Muat Turun OPD 212 (Excel)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExportSummaryExcel}
              className="flex items-center gap-2 px-5 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-black text-base shadow cursor-pointer transition"
            >
              <Download className="w-5 h-5" />
              <span>Eksport Ringkasan (Excel)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-gray-300 text-gray-800 rounded-xl font-bold text-base hover:bg-gray-100 shadow-sm cursor-pointer"
          >
            <Printer className="w-5 h-5" />
            <span>Cetak</span>
          </button>
        </div>
      </div>

      {/* Tabs: OPD 212 vs Ringkasan Operasi */}
      <div className="flex gap-2 border-b-2 border-gray-300">
        <button
          type="button"
          onClick={() => setActiveTab('OPD212')}
          className={`py-3 px-6 font-black text-lg border-b-4 transition cursor-pointer ${
            activeTab === 'OPD212'
              ? 'border-[#2F5D8A] text-[#2F5D8A] bg-blue-50/50 rounded-t-xl'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          1. Reten Rasmi KKM: OPD 212 (Mengikut Etnik, Umur & Jantina)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('RINGKASAN_OPERASI')}
          className={`py-3 px-6 font-black text-lg border-b-4 transition cursor-pointer ${
            activeTab === 'RINGKASAN_OPERASI'
              ? 'border-[#2F5D8A] text-[#2F5D8A] bg-blue-50/50 rounded-t-xl'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          2. Ringkasan Operasi Reten & Penutupan Bulan
        </button>
      </div>

      {/* TAB 1: RETEN RASMI KKM OPD 212 */}
      {activeTab === 'OPD212' && opd212Report && (
        <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 md:p-8 shadow-sm space-y-6">
          {/* Header Rasmi KKM */}
          <div className="border-b-2 border-gray-300 pb-4 text-center sm:text-left">
            <h3 className="text-xl font-black text-gray-900 tracking-wide uppercase">
              SISTEM MAKLUMAT PENGURUSAN KESIHATAN
            </h3>
            <h4 className="text-lg font-black text-gray-800 tracking-wide uppercase">
              KEMENTERIAN KESIHATAN MALAYSIA
            </h4>
            <div className="text-base font-bold text-gray-700 mt-2">
              Laporan Bulanan/Tahunan Kedatangan Pesakit Luar Mengikut Umur/Jantina dan Kumpulan Etnik
            </div>
            <div className="text-sm font-black text-pink-700 uppercase mt-0.5">
              Bagi Bulan {opd212Report.monthName} Tahun {opd212Report.year}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4 pt-3 border-t border-gray-200 text-sm font-bold">
              <div>
                Unit / Klinik : <span className="text-red-700 font-black">OUTPATIENT DEPARTMENT</span>
              </div>
              <div>
                Hospital : <span className="text-gray-900 font-black">DALAT</span>
              </div>
              <div>
                Negeri : <span className="text-red-700 font-black">SARAWAK</span>
              </div>
            </div>
          </div>

          {/* JADUAL RASMI OPD 212 */}
          <div className="overflow-x-auto rounded-xl border-2 border-gray-400">
            <table className="w-full text-center border-collapse text-sm">
              <thead>
                {/* Header Row 1 */}
                <tr className="bg-[#2F5D8A] text-white font-black text-xs uppercase divide-x divide-blue-800">
                  <th rowSpan={2} className="py-3 px-4 text-left border-r border-blue-800 w-64">
                    Kumpulan Ethnic
                  </th>
                  <th colSpan={2} className="py-2 px-2 bg-[#254A6F]">
                    &lt; 10 tahun
                  </th>
                  <th colSpan={2} className="py-2 px-2 bg-[#1d5b50]">
                    10-19 tahun
                  </th>
                  <th colSpan={2} className="py-2 px-2 bg-[#7a4c10]">
                    20-59 tahun
                  </th>
                  <th colSpan={2} className="py-2 px-2 bg-[#493d63]">
                    &gt;= 60 tahun
                  </th>
                  <th colSpan={2} className="py-2 px-2 bg-[#1E3A5F]">
                    JUMLAH
                  </th>
                  <th rowSpan={2} className="py-3 px-3 bg-blue-950 font-black text-sm text-yellow-300">
                    JUMLAH BESAR
                  </th>
                </tr>
                {/* Subheaders: Lelaki & Perempuan */}
                <tr className="bg-[#254A6F] text-white font-bold text-xs uppercase divide-x divide-blue-800">
                  <th className="py-2 px-2 bg-blue-900">Lelaki</th>
                  <th className="py-2 px-2 bg-blue-800">Perempuan</th>
                  <th className="py-2 px-2 bg-teal-900">Lelaki</th>
                  <th className="py-2 px-2 bg-teal-800">Perempuan</th>
                  <th className="py-2 px-2 bg-amber-900">Lelaki</th>
                  <th className="py-2 px-2 bg-amber-800">Perempuan</th>
                  <th className="py-2 px-2 bg-purple-900">Lelaki</th>
                  <th className="py-2 px-2 bg-purple-800">Perempuan</th>
                  <th className="py-2 px-2 bg-blue-950">Lelaki</th>
                  <th className="py-2 px-2 bg-blue-900">Perempuan</th>
                </tr>
                {/* Column Numbers (1 to 12) per KKM standard */}
                <tr className="bg-gray-200 text-gray-800 font-black text-xs border-y border-gray-400 divide-x divide-gray-300">
                  <th className="py-1 text-center">1</th>
                  <th className="py-1">2</th>
                  <th className="py-1">3</th>
                  <th className="py-1">4</th>
                  <th className="py-1">5</th>
                  <th className="py-1">6</th>
                  <th className="py-1">7</th>
                  <th className="py-1">8</th>
                  <th className="py-1">9</th>
                  <th className="py-1">10</th>
                  <th className="py-1">11</th>
                  <th className="py-1">12</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 bg-white font-medium text-gray-900">
                {opd212Report.rows.map((r) => {
                  const hasData = r.grand_total > 0;
                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-blue-50/80 transition divide-x divide-gray-200 ${
                        r.isBukanWargaGroup ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4 text-left font-bold text-gray-900 whitespace-nowrap">
                        {r.isBukanWargaGroup ? (
                          <div className="flex items-center gap-1.5 pl-3">
                            <span className="text-gray-400">&bull;</span>
                            <span className="text-amber-900 font-bold">
                              Bukan Warganegara: {r.label}
                            </span>
                          </div>
                        ) : (
                          <span>{r.label}</span>
                        )}
                      </td>
                      <td className="py-2 px-2">{r.u10_l || '-'}</td>
                      <td className="py-2 px-2">{r.u10_p || '-'}</td>
                      <td className="py-2 px-2">{r.u19_l || '-'}</td>
                      <td className="py-2 px-2">{r.u19_p || '-'}</td>
                      <td className="py-2 px-2">{r.u59_l || '-'}</td>
                      <td className="py-2 px-2">{r.u59_p || '-'}</td>
                      <td className="py-2 px-2">{r.u60_l || '-'}</td>
                      <td className="py-2 px-2">{r.u60_p || '-'}</td>
                      <td className="py-2 px-2 font-bold text-blue-900 bg-blue-50/40">
                        {r.total_l || '-'}
                      </td>
                      <td className="py-2 px-2 font-bold text-purple-900 bg-purple-50/40">
                        {r.total_p || '-'}
                      </td>
                      <td className={`py-2 px-3 font-black text-base ${hasData ? 'bg-blue-100 text-[#2F5D8A]' : 'text-gray-400'}`}>
                        {r.grand_total || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* FOOTER TOTAL (JUMLAH) */}
              <tfoot className="bg-gray-100 font-black text-gray-900 border-t-3 border-gray-500 divide-x divide-gray-300">
                <tr>
                  <td className="py-3.5 px-4 text-left uppercase text-base text-gray-900 font-black">
                    JUMLAH
                  </td>
                  <td className="py-2 px-2 text-base">{opd212Report.totalRow.u10_l}</td>
                  <td className="py-2 px-2 text-base">{opd212Report.totalRow.u10_p}</td>
                  <td className="py-2 px-2 text-base">{opd212Report.totalRow.u19_l}</td>
                  <td className="py-2 px-2 text-base">{opd212Report.totalRow.u19_p}</td>
                  <td className="py-2 px-2 text-base">{opd212Report.totalRow.u59_l}</td>
                  <td className="py-2 px-2 text-base">{opd212Report.totalRow.u59_p}</td>
                  <td className="py-2 px-2 text-base">{opd212Report.totalRow.u60_l}</td>
                  <td className="py-2 px-2 text-base">{opd212Report.totalRow.u60_p}</td>
                  <td className="py-2 px-2 text-base text-blue-900 bg-blue-100 font-black">
                    {opd212Report.totalRow.total_l}
                  </td>
                  <td className="py-2 px-2 text-base text-purple-900 bg-purple-100 font-black">
                    {opd212Report.totalRow.total_p}
                  </td>
                  <td className="py-3 px-3 text-xl bg-[#2F5D8A] text-white font-black">
                    {opd212Report.totalRow.grand_total}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: RINGKASAN RETEN OPERASI & PENUTUPAN BULAN */}
      {activeTab === 'RINGKASAN_OPERASI' && (
        <div className="space-y-6">
          {/* Status Banner */}
          <div className="p-6 rounded-2xl border-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border-gray-300 shadow-sm">
            <div className="flex items-center gap-4">
              {monthStatus?.status === 'DITUTUP' || monthStatus?.status === 'DIARKIB' ? (
                <div className="p-3 bg-green-100 text-green-800 rounded-2xl">
                  <CheckCircle className="w-8 h-8" />
                </div>
              ) : (
                <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl">
                  <AlertTriangle className="w-8 h-8" />
                </div>
              )}
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-gray-500 block">
                  STATUS RASMI BULANAN
                </span>
                <h3 className="text-2xl font-black text-gray-900">
                  {monthStatus ? monthStatus.status : 'BELUM DITUTUP (DRAF)'}
                </h3>
                {monthStatus?.tarikh_tutup && (
                  <p className="text-sm font-bold text-gray-600 mt-0.5">
                    Ditutup oleh {monthStatus.ditutup_oleh} pada {formatDateDisplay(monthStatus.tarikh_tutup)}
                  </p>
                )}
              </div>
            </div>

            {session.role === 'PENYELIA' && (!monthStatus || monthStatus.status === 'TERBUKA') && (
              <button
                type="button"
                onClick={() => setShowCloseModal(true)}
                className="py-4 px-6 rounded-xl bg-purple-800 hover:bg-purple-900 text-white font-black text-base shadow-lg cursor-pointer"
              >
                TUTUP BULAN INI RASMI
              </button>
            )}
          </div>

          {/* Operational Indicators Table */}
          <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 md:p-8 shadow-sm space-y-4">
            <h3 className="text-xl font-black text-gray-900">8 INDIKATOR KEHADIRAN OPERASI</h3>
            <div className="overflow-x-auto rounded-xl border border-gray-300">
              <table className="w-full text-left divide-y divide-gray-200">
                <thead className="bg-[#2F5D8A] text-white text-xs font-black uppercase">
                  <tr>
                    <th className="py-3 px-4">Indikator</th>
                    <th className="py-3 px-4 text-center">Bulan Semasa</th>
                    <th className="py-3 px-4 text-center">Bulan Lepas</th>
                    <th className="py-3 px-4 text-center">Perbezaan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm font-bold">
                  <tr>
                    <td className="py-3 px-4">Jumlah Kehadiran Sah</td>
                    <td className="py-3 px-4 text-center text-lg font-black text-[#2F5D8A]">
                      {currentReten?.jumlah_kehadiran_sah || 0}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-600">
                      {prevReten?.jumlah_kehadiran_sah || 0}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {(currentReten?.jumlah_kehadiran_sah || 0) - (prevReten?.jumlah_kehadiran_sah || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4">F/UP Rutin</td>
                    <td className="py-3 px-4 text-center">{currentReten?.kategori_fup || 0}</td>
                    <td className="py-3 px-4 text-center text-gray-600">{prevReten?.kategori_fup || 0}</td>
                    <td className="py-3 px-4 text-center">
                      {(currentReten?.kategori_fup || 0) - (prevReten?.kategori_fup || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4">Walk-In</td>
                    <td className="py-3 px-4 text-center">{currentReten?.kategori_walkin || 0}</td>
                    <td className="py-3 px-4 text-center text-gray-600">{prevReten?.kategori_walkin || 0}</td>
                    <td className="py-3 px-4 text-center">
                      {(currentReten?.kategori_walkin || 0) - (prevReten?.kategori_walkin || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4">Medical Check Up</td>
                    <td className="py-3 px-4 text-center">{currentReten?.kategori_checkup || 0}</td>
                    <td className="py-3 px-4 text-center text-gray-600">{prevReten?.kategori_checkup || 0}</td>
                    <td className="py-3 px-4 text-center">
                      {(currentReten?.kategori_checkup || 0) - (prevReten?.kategori_checkup || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4">Procedure Room</td>
                    <td className="py-3 px-4 text-center">{currentReten?.kategori_procedure || 0}</td>
                    <td className="py-3 px-4 text-center text-gray-600">{prevReten?.kategori_procedure || 0}</td>
                    <td className="py-3 px-4 text-center">
                      {(currentReten?.kategori_procedure || 0) - (prevReten?.kategori_procedure || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4">Pesakit Baharu</td>
                    <td className="py-3 px-4 text-center text-emerald-700">
                      {currentReten?.pesakit_baharu || 0}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-600">{prevReten?.pesakit_baharu || 0}</td>
                    <td className="py-3 px-4 text-center">
                      {(currentReten?.pesakit_baharu || 0) - (prevReten?.pesakit_baharu || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4">Pesakit Sedia Ada</td>
                    <td className="py-3 px-4 text-center">{currentReten?.pesakit_sedia_ada || 0}</td>
                    <td className="py-3 px-4 text-center text-gray-600">{prevReten?.pesakit_sedia_ada || 0}</td>
                    <td className="py-3 px-4 text-center">
                      {(currentReten?.pesakit_sedia_ada || 0) - (prevReten?.pesakit_sedia_ada || 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4">Dibatalkan (Diasingkan)</td>
                    <td className="py-3 px-4 text-center text-red-700">{currentReten?.jumlah_batal || 0}</td>
                    <td className="py-3 px-4 text-center text-gray-600">{prevReten?.jumlah_batal || 0}</td>
                    <td className="py-3 px-4 text-center">
                      {(currentReten?.jumlah_batal || 0) - (prevReten?.jumlah_batal || 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Close Month Modal */}
      <ConfirmModal
        isOpen={showCloseModal}
        onCancel={() => setShowCloseModal(false)}
        onConfirm={handleExecuteCloseMonth}
        title={`PENGESAHAN PENUTUPAN BULAN: ${formatYearMonthDisplay(selectedYearMonth)}`}
        message="Penutupan bulan adalah tindakan KEKAL bagi Penyelia. Ringkasan bulanan akan dibekukan, dikunci, dan tarikh layak pembersihan 4 bulan akan dikira secara automatik. Adakah anda pasti?"
        confirmLabel={closing ? 'SEDANG MENUTUP...' : 'YA, TUTUP BULAN INI KEKAL'}
        variant="danger"
      />
    </div>
  );
};
