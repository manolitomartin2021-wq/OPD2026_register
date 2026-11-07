import React, { useState } from 'react';
import type { Attendance, Patient } from '../types';
import { Printer, X, FileText, CheckCircle } from 'lucide-react';
import { formatDateDisplay } from '../utils/dateUtils';
import { maskIdentity } from '../utils/normalize';

interface PrintModalProps {
  isOpen: boolean;
  attendance: Attendance;
  patient: Patient;
  onClose: () => void;
  isReprint?: boolean;
}

export const PrintModal: React.FC<PrintModalProps> = ({
  isOpen,
  attendance,
  patient,
  onClose,
  isReprint = false,
}) => {
  const [printFormat, setPrintFormat] = useState<'A4' | 'THERMAL'>('THERMAL');

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const maskedDoc = maskIdentity(patient.no_dokumen || patient.no_pasport);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden my-6">
        {/* Header - Hidden in Print */}
        <div className="p-5 bg-[#2F5D8A] text-white flex justify-between items-center print:hidden">
          <div className="flex items-center gap-3">
            <Printer className="w-7 h-7 text-white" />
            <div>
              <h2 className="text-xl font-bold">
                {isReprint ? 'CETAK SEMULA SLIP PENDAFTARAN' : 'PENDAFTARAN BERJAYA DISIMPAN'}
              </h2>
              <p className="text-sm text-blue-100">Pratonton Slip Sebelum Mencetak</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white hover:bg-white/20 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Format Selector - Hidden in Print */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-700 text-sm">Format Cetakan:</span>
            <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
              <button
                type="button"
                onClick={() => setPrintFormat('THERMAL')}
                className={`px-3 py-1.5 text-sm font-bold rounded-md transition ${
                  printFormat === 'THERMAL' ? 'bg-[#2F5D8A] text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Thermal (80mm)
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('A4')}
                className={`px-3 py-1.5 text-sm font-bold rounded-md transition ${
                  printFormat === 'A4' ? 'bg-[#2F5D8A] text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                A4 Standard
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-green-700 text-sm font-bold">
            <CheckCircle className="w-5 h-5" />
            <span>Rekod Tersimpan Selamat (IndexedDB)</span>
          </div>
        </div>

        {/* Printable Slip Area */}
        <div className="p-6 bg-gray-100 flex justify-center">
          <div
            id="printable-slip"
            className={`bg-white border-2 border-dashed border-gray-400 p-6 shadow-md text-gray-900 ${
              printFormat === 'THERMAL' ? 'w-[320px]' : 'w-full max-w-md'
            }`}
          >
            {/* Header */}
            <div className="text-center border-b-2 border-black pb-3">
              <h1 className="text-xl font-black uppercase tracking-wider">HOSPITAL DALAT</h1>
              <p className="text-sm font-bold">JABATAN PESAKIT LUAR (JPL)</p>
              <p className="text-xs text-gray-600">SLIP GILIRAN & PENDAFTARAN</p>
              {isReprint && (
                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-black bg-gray-200 border border-black uppercase">
                  SALINAN CETAK SEMULA
                </span>
              )}
            </div>

            {/* Giant HDalat Number */}
            <div className="text-center my-4 py-2 bg-gray-50 border border-gray-300 rounded">
              <span className="text-xs font-bold uppercase text-gray-600 block">NOMBOR GILIRAN</span>
              <span className="text-4xl font-black tracking-widest text-black block my-1">
                {attendance.no_daftar}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-black text-white inline-block">
                {attendance.kategori.replace('_', ' ')}
              </span>
            </div>

            {/* Patient Details */}
            <div className="space-y-2 text-sm border-b-2 border-black pb-4">
              <div>
                <span className="text-xs font-bold text-gray-500 block">NAMA PESAKIT:</span>
                <span className="text-base font-black uppercase block leading-tight">
                  {patient.nama_pesakit}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs font-bold text-gray-500 block">NO. RN:</span>
                  <span className="font-bold">{patient.no_rn}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500 block">NO. DOKUMEN:</span>
                  <span className="font-bold">{maskedDoc}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs font-bold text-gray-500 block">UMUR:</span>
                  <span className="font-bold">{attendance.umur_tahun} Tahun</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-500 block">JANTINA:</span>
                  <span className="font-bold">{patient.jantina}</span>
                </div>
              </div>
              <div>
                <span className="text-xs font-bold text-gray-500 block">KEWARGANEGARAAN:</span>
                <span className="font-bold">{attendance.kewarganegaraan}</span>
              </div>
            </div>

            {/* Timestamp & Footer */}
            <div className="mt-3 text-xs text-center space-y-1 text-gray-600">
              <p>
                Tarikh: <strong>{formatDateDisplay(attendance.tarikh)}</strong> | Masa: <strong>{attendance.masa}</strong>
              </p>
              <p>Petugas: {attendance.registered_by}</p>
              <p className="text-[10px] mt-2 italic">
                Sila tunggu nombor giliran anda dipanggil. Terima kasih.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons - Hidden in Print */}
        <div className="p-5 bg-white border-t border-gray-200 flex flex-col sm:flex-row justify-end gap-3 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="py-3 px-6 rounded-xl font-bold text-base bg-gray-200 hover:bg-gray-300 text-gray-800 transition"
          >
            TUTUP
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="py-3 px-8 rounded-xl font-bold text-base bg-[#2F5D8A] hover:bg-[#254A6F] text-white flex items-center justify-center gap-2 shadow-md transition"
          >
            <Printer className="w-5 h-5 text-white" />
            <span>CETAK SLIP SEKARANG</span>
          </button>
        </div>
      </div>
    </div>
  );
};
