import React, { useState, useEffect } from 'react';
import { getDatabase } from '../../data/db';
import type { ActiveSession, User, UserRole } from '../../types';
import { hashPasswordWithSalt, generateRandomSalt } from '../../crypto/webCrypto';
import { formatDateTimeKuching, formatDateDisplay } from '../../utils/dateUtils';
import { PageHelp } from '../../components/veteran/PageHelp';
import {
  Users,
  UserPlus,
  Shield,
  KeyRound,
  Unlock,
  AlertTriangle,
  CheckCircle,
  X,
} from 'lucide-react';

interface PenggunaViewProps {
  session: ActiveSession;
}

export const PenggunaView: React.FC<PenggunaViewProps> = ({ session }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Create User Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('STAFF');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // Reset Password Modal
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);
  const [resetPass, setResetPass] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    const db = getDatabase();
    const all = await db.users.toArray();
    setUsers(all);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const supervisorCount = users.filter((u) => u.role === 'PENYELIA').length;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (!newUsername.trim() || !newFullName.trim()) {
      setCreateError('Sila isi nama pengguna dan nama penuh.');
      return;
    }
    if (newPassword.length < 8 || !/\d/.test(newPassword) || !/[a-zA-Z]/.test(newPassword)) {
      setCreateError('Kata laluan mestilah minimum 8 aksara dengan kombinasi huruf dan nombor.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setCreateError('Pengesahan kata laluan tidak sepadan.');
      return;
    }

    setCreating(true);
    const db = getDatabase();

    try {
      const cleanUser = newUsername.trim().toLowerCase();
      const existing = await db.users.where('username').equals(cleanUser).first();
      if (existing) {
        throw new Error('Nama pengguna ini telah wujud.');
      }

      const salt = generateRandomSalt(16);
      const hash = await hashPasswordWithSalt(newPassword, salt);

      await db.users.add({
        user_id: crypto.randomUUID(),
        username: cleanUser,
        nama_penuh: newFullName.trim().toUpperCase(),
        role: newRole,
        password_hash: hash,
        salt,
        aktif: true,
        gagal_login: 0,
        dikunci_hingga: null,
        wajib_tukar_password: false,
        last_login: null,
        created_at: formatDateTimeKuching(),
      });

      setShowCreateModal(false);
      setNewUsername('');
      setNewFullName('');
      setNewPassword('');
      setNewPasswordConfirm('');
      loadUsers();
      alert('Akaun pengguna berjaya dicipta!');
    } catch (err: any) {
      setCreateError(err.message || 'Ralat mencipta pengguna.');
    } finally {
      setCreating(false);
    }
  };

  const handleUnlockUser = async (user: User) => {
    const db = getDatabase();
    await db.users.update(user.user_id, {
      gagal_login: 0,
      dikunci_hingga: null,
    });
    loadUsers();
    alert(`Akaun ${user.username} berjaya dibuka kuncinya!`);
  };

  const handleExecuteResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    setResetMsg('');

    if (resetPass.length < 8) {
      setResetMsg('Kata laluan baharu mestilah sekurang-kurangnya 8 aksara.');
      return;
    }

    const db = getDatabase();
    try {
      const salt = generateRandomSalt(16);
      const hash = await hashPasswordWithSalt(resetPass, salt);

      await db.users.update(resetTargetUser.user_id, {
        password_hash: hash,
        salt,
        gagal_login: 0,
        dikunci_hingga: null,
        wajib_tukar_password: true,
      });

      setResetMsg('Kata laluan berjaya ditetapkan semula!');
      setTimeout(() => {
        setResetTargetUser(null);
        setResetPass('');
        setResetMsg('');
        loadUsers();
      }, 1500);
    } catch (err: any) {
      setResetMsg(err.message || 'Ralat menetapkan semula kata laluan.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHelp
        title="Pengurusan Akaun Petugas & Kawalan Akses (RBAC)"
        points={[
          'Setiap petugas kaunter menggunakan akaun individu untuk memastikan ketelusan audit log.',
          'Penyelia mempunyai akses penuh terhadap konfigurasi sistem, reten, backup, dan pembersihan.',
          'Akaun yang tersalah masukkan kata laluan 5 kali berturut-turut akan dikunci selama 5 minit secara automatik dan boleh dibuka kunci oleh Penyelia di sini.',
          'Sistem mewajibkan sekurang-kurangnya DUA (2) akaun Penyelia bagi mengelakkan situasi terkunci sekiranya seorang pegawai bercuti.',
        ]}
      />

      {/* Warning if only 1 supervisor */}
      {supervisorCount < 2 && (
        <div className="p-5 bg-amber-50 border-3 border-amber-400 text-amber-900 rounded-2xl font-bold flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-amber-700 flex-shrink-0" />
            <div>
              <h4 className="text-lg font-black">AMARAN DASAR KESELAMATAN KKM</h4>
              <p className="text-sm font-medium mt-0.5">
                Sistem mengesan hanya terdapat <strong>1 akaun Penyelia</strong>. Sila cipta akaun <strong>Penyelia Kedua</strong> sekarang bagi mematuhi garis panduan kesinambungan operasi Hospital Dalat.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setNewRole('PENYELIA');
              setShowCreateModal(true);
            }}
            className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-black text-sm rounded-xl flex-shrink-0 ml-4 shadow-sm"
          >
            Cipta Penyelia Kedua Sekarang
          </button>
        </div>
      )}

      {/* Header and Add Button */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 p-6 md:p-8 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900">PENGURUSAN AKAUN PENGGUNA</h2>
          <p className="text-base text-gray-600 font-medium">
            Hospital Dalat · Senarai Petugas Kaunter dan Pegawai Penyelia
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setNewRole('STAFF');
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-6 py-3.5 bg-[#2F5D8A] hover:bg-[#254A6F] text-white rounded-xl font-black text-base shadow-md cursor-pointer"
        >
          <UserPlus className="w-6 h-6 text-white" />
          <span>TAMBAH PETUGAS BAHARU</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border-2 border-gray-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300 text-gray-800 text-sm font-black uppercase">
                <th className="p-4">Nama Pengguna</th>
                <th className="p-4">Nama Penuh Pegawai</th>
                <th className="p-4">Peranan (Role)</th>
                <th className="p-4">Status Akaun</th>
                <th className="p-4">Log Masuk Terakhir</th>
                <th className="p-4 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-base font-semibold">
              {users.map((u) => {
                const isLocked = u.dikunci_hingga && new Date(u.dikunci_hingga).getTime() > Date.now();

                return (
                  <tr key={u.user_id} className="hover:bg-blue-50/50">
                    <td className="p-4 font-mono font-bold text-gray-900">{u.username}</td>
                    <td className="p-4 font-black uppercase text-gray-900">{u.nama_penuh}</td>
                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-lg text-xs font-black ${
                          u.role === 'PENYELIA'
                            ? 'bg-purple-100 text-purple-900'
                            : 'bg-blue-100 text-[#2F5D8A]'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4">
                      {isLocked ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-red-100 text-red-800">
                          DIKUNCI ({u.gagal_login} kali gagal)
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-green-100 text-green-800">
                          AKTIF
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-gray-600 font-bold">{u.last_login || 'Belum pernah'}</td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {isLocked && (
                          <button
                            type="button"
                            onClick={() => handleUnlockUser(u)}
                            className="px-3 py-1.5 bg-green-700 text-white rounded-lg text-xs font-black hover:bg-green-800 flex items-center gap-1 shadow-sm"
                          >
                            <Unlock className="w-4 h-4" />
                            <span>Buka Kunci</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setResetTargetUser(u);
                            setResetPass('');
                            setResetMsg('');
                          }}
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 border border-gray-300"
                        >
                          Tukar Kata Laluan
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Create New User */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 md:p-8 shadow-2xl border-2 border-gray-300 space-y-4">
            <h3 className="text-2xl font-black text-gray-900">DAFTAR AKAUN PETUGAS BAHARU</h3>
            <p className="text-sm text-gray-600 font-medium">
              Cipta akaun individu dengan kata laluan selamat (minimum 8 aksara).
            </p>

            {createError && (
              <div className="p-3 bg-red-50 text-red-900 border border-red-300 rounded-xl text-sm font-bold">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Nama Penuh Pegawai (Huruf Besar):
                </label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value.toUpperCase())}
                  placeholder="CONTOH: NORAINI BINTI SAID"
                  className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nama Pengguna:</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                    placeholder="cth: noraini"
                    className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold lowercase"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Peranan (Role):</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold"
                  >
                    <option value="STAFF">STAFF (Kaunter Pendaftaran)</option>
                    <option value="PENYELIA">PENYELIA (Akses Penuh)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Kata Laluan:</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Sahkan Kata Laluan:</label>
                  <input
                    type="password"
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-3 rounded-xl border-2 border-gray-400 font-bold text-base"
                  />
                </div>
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
                  {creating ? 'MENYIMPAN...' : 'CIPTA AKAUN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reset Password */}
      {resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 md:p-8 shadow-2xl border-2 border-gray-300 space-y-4">
            <h3 className="text-2xl font-black text-gray-900">TETAPKAN SEMULA KATA LALUAN</h3>
            <p className="text-sm font-bold text-gray-600">
              Pegawai: {resetTargetUser.nama_penuh} ({resetTargetUser.username})
            </p>

            {resetMsg && (
              <div className="p-3 bg-blue-50 text-blue-900 border border-blue-300 rounded-xl text-sm font-bold">
                {resetMsg}
              </div>
            )}

            <form onSubmit={handleExecuteResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Kata Laluan Baharu (Min. 8 Aksara):
                </label>
                <input
                  type="password"
                  value={resetPass}
                  onChange={(e) => setResetPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-3.5 rounded-xl border-2 border-gray-400 font-bold text-lg"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="w-1/2 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-base text-gray-800"
                >
                  BATAL
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3 rounded-xl bg-[#2F5D8A] hover:bg-[#254A6F] font-black text-base text-white shadow"
                >
                  SIMPAN KATA LALUAN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
