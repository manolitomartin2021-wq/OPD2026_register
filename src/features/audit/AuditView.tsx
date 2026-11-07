import React, { useState, useEffect } from 'react';
import { getDatabase } from '../../data/db';
import type { ActiveSession, AuditLog } from '../../types';
import { calculateAuditRowHash } from '../../crypto/webCrypto';
import { PageHelp } from '../../components/veteran/PageHelp';
import { formatDateDisplay } from '../../utils/dateUtils';
import { ShieldCheck, Search, Filter, AlertTriangle, CheckCircle, RefreshCw, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface AuditViewProps {
  session: ActiveSession;
}

export const AuditView: React.FC<AuditViewProps> = ({ session }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('SEMUA');

  // Integrity Check State
  const [checkingChain, setCheckingChain] = useState(false);
  const [chainResult, setChainResult] = useState<{
    valid: boolean;
    brokenIndex?: number;
    brokenAuditId?: string;
    totalChecked: number;
  } | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    const db = getDatabase();
    const all = await db.audit_logs.orderBy('timestamp').reverse().toArray();
    setLogs(all);
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleVerifyChain = async () => {
    setCheckingChain(true);
    setChainResult(null);
    const db = getDatabase();
    const allChronological = await db.audit_logs.orderBy('timestamp').toArray();

    let expectedPrev = '0000000000000000000000000000000000000000000000000000000000000000';
    let broken = false;
    let brokenId = '';
    let brokenIdx = -1;

    for (let i = 0; i < allChronological.length; i++) {
      const row = allChronological[i];
      if (row.prev_hash !== expectedPrev) {
        broken = true;
        brokenId = row.audit_id;
        brokenIdx = i + 1;
        break;
      }

      const calculated = await calculateAuditRowHash(row);
      if (calculated !== row.row_hash) {
        broken = true;
        brokenId = row.audit_id;
        brokenIdx = i + 1;
        break;
      }

      expectedPrev = row.row_hash;
    }

    setChainResult({
      valid: !broken,
      brokenIndex: brokenIdx,
      brokenAuditId: brokenId,
      totalChecked: allChronological.length,
    });
    setCheckingChain(false);
  };

  const filteredLogs = logs.filter((l) => {
    if (filterAction !== 'SEMUA' && l.tindakan !== filterAction) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toUpperCase();
      return (
        l.username.toUpperCase().includes(q) ||
        l.modul.toUpperCase().includes(q) ||
        (l.sebab && l.sebab.toUpperCase().includes(q)) ||
        (l.record_id && l.record_id.toUpperCase().includes(q))
      );
    }
    return true;
  });

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredLogs);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audit_Log');
    XLSX.writeFile(wb, `JPL_AUDIT_LOG_${new Date().toISOString().substring(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <PageHelp
        title="Audit Log Berantai Hash & Semakan Integriti Forensik"
        points={[
          'Semua aktiviti penting sistem direkodkan dalam audit log kekal yang berantai secara kriptografi (row_hash = SHA-256(data + prev_hash)).',
          'Audit log tidak boleh diubah atau dipadam oleh sebarang fungsi dalam aplikasi.',
          'Tekan butang "SEMAK INTEGRITI RANTAIAN HASH" untuk mengesahkan tiada baris log yang diusik secara luaran di dalam pelayar.',
        ]}
      />

      {/* Header and Verification Button */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 md:p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900">AUDIT LOG BERANTAI HASH</h2>
          <p className="text-base text-gray-600 font-medium">
            Hospital Dalat · Rekod Forensik Transaksi & Ketelusan KKM
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-gray-300 text-gray-800 rounded-xl font-bold text-sm hover:bg-gray-100 shadow-sm"
          >
            <Download className="w-5 h-5" />
            <span>Eksport Log</span>
          </button>

          <button
            type="button"
            disabled={checkingChain}
            onClick={handleVerifyChain}
            className="flex items-center gap-2 px-6 py-3.5 bg-green-700 hover:bg-green-800 text-white rounded-xl font-black text-base shadow-md disabled:opacity-50"
          >
            <ShieldCheck className="w-6 h-6 text-white" />
            <span>{checkingChain ? 'MENYEMAK RANTAIAN...' : 'SEMAK INTEGRITI RANTAIAN HASH'}</span>
          </button>
        </div>
      </div>

      {/* Chain Integrity Result Banner */}
      {chainResult && (
        <div
          className={`p-6 rounded-2xl border-3 flex items-start gap-4 ${
            chainResult.valid
              ? 'bg-green-50 border-green-600 text-green-900'
              : 'bg-red-50 border-red-600 text-red-900'
          }`}
        >
          {chainResult.valid ? (
            <CheckCircle className="w-10 h-10 text-green-700 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-10 h-10 text-red-700 flex-shrink-0" />
          )}
          <div>
            <h3 className="text-2xl font-black">
              {chainResult.valid
                ? 'INTEGRITI RANTAIAN HASH DISAHKAN SAH (100% UTUH)'
                : 'AMARAN: PENGUBAHAN ATAU KEPUTUSAN RANTAIAN DIKESAN!'}
            </h3>
            <p className="text-base font-bold mt-1">
              {chainResult.valid
                ? `Semua ${chainResult.totalChecked} rekod audit disahkan terikat secara kriptografi tanpa sebarang pengubahsuaian.`
                : `Rantaian audit terputus pada rekod #${chainResult.brokenIndex} (ID: ${chainResult.brokenAuditId}).`}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="w-full md:w-1/3">
          <label className="block text-xs font-bold text-gray-700 mb-1">Tapis Mengikut Tindakan:</label>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-base"
          >
            <option value="SEMUA">Semua Tindakan</option>
            <option value="LOGIN">LOGIN</option>
            <option value="REGISTER">REGISTER</option>
            <option value="EDIT">EDIT</option>
            <option value="CANCEL">CANCEL</option>
            <option value="BACKUP">BACKUP</option>
            <option value="PURGE">PURGE</option>
            <option value="TUTUP_HARI">TUTUP_HARI</option>
            <option value="TUTUP_BULAN">TUTUP_BULAN</option>
          </select>
        </div>

        <div className="w-full md:w-2/3">
          <label className="block text-xs font-bold text-gray-700 mb-1">Cari Kata Kunci:</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama pengguna, modul, sebab..."
            className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-base"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300 text-gray-800 text-xs font-black uppercase">
                <th className="p-3">Masa (Kuching)</th>
                <th className="p-3">Pengguna</th>
                <th className="p-3">Role</th>
                <th className="p-3">Tindakan</th>
                <th className="p-3">Modul</th>
                <th className="p-3">Catatan / Sebab</th>
                <th className="p-3">Hash Rantaian (SHA-256)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm font-semibold">
              {filteredLogs.map((l) => (
                <tr key={l.audit_id} className="hover:bg-blue-50/50">
                  <td className="p-3 font-mono text-xs">{l.timestamp}</td>
                  <td className="p-3 font-bold text-gray-900">{l.username}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[11px] font-black bg-gray-200 text-gray-800">
                      {l.role}
                    </span>
                  </td>
                  <td className="p-3 font-black text-[#2F5D8A]">{l.tindakan}</td>
                  <td className="p-3 font-mono text-xs uppercase">{l.modul}</td>
                  <td className="p-3 text-xs text-gray-700 max-w-xs truncate" title={l.sebab || ''}>
                    {l.sebab || '-'}
                  </td>
                  <td className="p-3 font-mono text-[10px] text-gray-500" title={l.row_hash}>
                    {l.row_hash.substring(0, 16)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
