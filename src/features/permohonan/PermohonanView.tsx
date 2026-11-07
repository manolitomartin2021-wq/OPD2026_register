import React, { useState, useEffect } from 'react';
import { getDatabase } from '../../data/db';
import type { ActiveSession, ProfileCorrectionRequest } from '../../types';
import { reviewProfileCorrection } from '../../data/dataService';
import { PageHelp } from '../../components/veteran/PageHelp';
import { CheckCircle, XCircle, AlertTriangle, FileText, Check, X } from 'lucide-react';

interface PermohonanViewProps {
  session: ActiveSession;
}

export const PermohonanView: React.FC<PermohonanViewProps> = ({ session }) => {
  const [requests, setRequests] = useState<ProfileCorrectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState('');
  const [selectedReq, setSelectedReq] = useState<ProfileCorrectionRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    const db = getDatabase();
    try {
      const reqs = await db.profile_corrections.orderBy('tarikh_mohon').reverse().toArray();
      setRequests(reqs);
    } catch (err) {
      console.warn('Fallback profile corrections sorting:', err);
      const reqs = await db.profile_corrections.toArray();
      reqs.sort((a, b) => (b.tarikh_mohon || '').localeCompare(a.tarikh_mohon || ''));
      setRequests(reqs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleExecuteReview = async (approved: boolean) => {
    if (!selectedReq) return;
    try {
      await reviewProfileCorrection(selectedReq.id, approved, reviewNotes);
      setSelectedReq(null);
      setReviewAction(null);
      setReviewNotes('');
      loadRequests();
    } catch (err: any) {
      alert(err.message || 'Ralat semasa memproses permohonan.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHelp
        title="Senarai Permohonan Pembetulan Profil Pesakit"
        points={[
          'Staff Kaunter mengemukakan permohonan pembetulan jika berlaku kesilapan ejaan nama, nombor kad pengenalan, atau alamat pesakit.',
          'Penyelia menyemak bukti dokumen dan meluluskan atau menolak permohonan dengan catatan semakan.',
          'Apabila diluluskan, sistem akan mengemaskini profil pesakit secara automatik dan merekodkannya dalam audit log.',
        ]}
      />

      <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 md:p-8 shadow-sm">
        <h2 className="text-2xl font-black text-gray-900 mb-2">TUGASAN SEMAKAN PEMBETULAN PROFIL</h2>
        <p className="text-base text-gray-600 font-medium">
          Hospital Dalat · Senarai permohonan pindaan data daripada petugas kaunter
        </p>
      </div>

      <div className="bg-white rounded-2xl border-2 border-gray-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300 text-gray-800 text-sm font-black uppercase">
                <th className="p-4">Tarikh Mohon</th>
                <th className="p-4">Dimohon Oleh</th>
                <th className="p-4">Medan Terlibat</th>
                <th className="p-4">Nilai Asal</th>
                <th className="p-4">Nilai Baharu</th>
                <th className="p-4">Sebab Permohonan</th>
                <th className="p-4">Status</th>
                {session.role === 'PENYELIA' && <th className="p-4 text-center">Tindakan</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-base font-medium">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500 font-bold">
                    Tiada permohonan pembetulan profil difailkan.
                  </td>
                </tr>
              ) : (
                requests.map((r) => {
                  const isPending = r.status === 'MENUNGGU';

                  return (
                    <tr key={r.id} className="hover:bg-blue-50/50">
                      <td className="p-4 text-sm font-bold text-gray-700">{r.tarikh_mohon}</td>
                      <td className="p-4 font-bold text-[#2F5D8A]">{r.dimohon_oleh}</td>
                      <td className="p-4 font-mono font-bold text-xs uppercase bg-gray-50">{r.medan}</td>
                      <td className="p-4 text-sm font-semibold text-gray-500 line-through">{r.nilai_lama || '-'}</td>
                      <td className="p-4 text-sm font-black text-green-800">{r.nilai_baharu}</td>
                      <td className="p-4 text-xs font-semibold text-gray-700">{r.sebab}</td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                            r.status === 'DILULUSKAN'
                              ? 'bg-green-100 text-green-800'
                              : r.status === 'DITOLAK'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      {session.role === 'PENYELIA' && (
                        <td className="p-4 text-center">
                          {isPending && (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedReq(r);
                                  setReviewAction('APPROVE');
                                }}
                                className="px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs font-black hover:bg-green-800 flex items-center gap-1 shadow-sm"
                              >
                                <Check className="w-4 h-4" />
                                <span>Lulus</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedReq(r);
                                  setReviewAction('REJECT');
                                }}
                                className="px-3 py-1.5 bg-red-700 text-white rounded-lg text-xs font-black hover:bg-red-800 flex items-center gap-1 shadow-sm"
                              >
                                <X className="w-4 h-4" />
                                <span>Tolak</span>
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {selectedReq && reviewAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 md:p-8 shadow-2xl border-2 border-gray-300 space-y-4">
            <h3 className="text-2xl font-black text-gray-900">
              {reviewAction === 'APPROVE' ? 'LULUSKAN PEMBETULAN' : 'TOLAK PERMOHONAN'}
            </h3>
            <p className="text-base text-gray-700 font-medium">
              Tindakan: {reviewAction === 'APPROVE' ? 'Kemas kini medan pesakit secara automatik.' : 'Tolak permohonan pembetulan.'}
            </p>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                Catatan Penyelia (Pilihan):
              </label>
              <input
                type="text"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="cth: Disemak bersama salinan MyKad fizikal"
                className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-base"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedReq(null);
                  setReviewAction(null);
                }}
                className="w-1/2 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-base text-gray-800"
              >
                BATAL
              </button>
              <button
                type="button"
                onClick={() => handleExecuteReview(reviewAction === 'APPROVE')}
                className={`w-1/2 py-3 rounded-xl text-white font-black text-base shadow ${
                  reviewAction === 'APPROVE' ? 'bg-green-700 hover:bg-green-800' : 'bg-red-700 hover:bg-red-800'
                }`}
              >
                SAHKAN KEPUTUSAN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
