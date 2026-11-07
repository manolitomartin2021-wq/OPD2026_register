import React, { useState, useEffect } from 'react';
import { initializeSystem } from '../../data/dataService';
import { ShieldCheck, HardDrive, AlertTriangle, Key, CheckCircle, ArrowRight, Printer } from 'lucide-react';

interface SetupWizardProps {
  onCompleted: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onCompleted }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [currentOrigin, setCurrentOrigin] = useState('');
  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);
  const [storageQuota, setStorageQuota] = useState<string>('');

  // Mode and form states
  const [installationMode, setInstallationMode] = useState<'MOD_KAUNTER' | 'MOD_PENYELIA_ARKIB'>('MOD_KAUNTER');
  const [supervisorUsername, setSupervisorUsername] = useState('penyelia1');
  const [supervisorFullName, setSupervisorFullName] = useState('');
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [supervisorPasswordConfirm, setSupervisorPasswordConfirm] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);

      // Check and request persistent storage
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().then((persisted) => {
          setStoragePersisted(persisted);
        });
      }
      if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then((est) => {
          if (est.quota) {
            const mb = Math.round(est.quota / (1024 * 1024));
            setStorageQuota(`${mb} MB`);
          }
        });
      }

      // Generate random 24-character recovery key
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let key = '';
      for (let i = 0; i < 24; i++) {
        if (i > 0 && i % 4 === 0) key += '-';
        key += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setRecoveryKey(key);
    }
  }, []);

  const handleFinishSetup = async () => {
    setErrorMsg('');
    if (!supervisorFullName.trim()) {
      setErrorMsg('Sila masukkan Nama Penuh Penyelia.');
      return;
    }
    if (supervisorPassword.length < 8 || !/\d/.test(supervisorPassword) || !/[a-zA-Z]/.test(supervisorPassword)) {
      setErrorMsg('Kata laluan mestilah sekurang-kurangnya 8 aksara dan mengandungi kombinasi huruf dan nombor.');
      return;
    }
    if (supervisorPassword !== supervisorPasswordConfirm) {
      setErrorMsg('Pengesahan kata laluan tidak sepadan.');
      return;
    }

    setLoading(true);
    try {
      await initializeSystem({
        supervisorUsername,
        supervisorFullName,
        supervisorPassword,
        installationMode,
        recoveryKey,
      });
      onCompleted();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ralat semasa memulakan sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-xl border-2 border-gray-300 overflow-hidden">
        {/* Wizard Header */}
        <div className="p-6 md:p-8 bg-[#2F5D8A] text-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-2xl">
              <ShieldCheck className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-wide">
                PANDUAN PERSEDIAAN AWAL (WIZARD)
              </h1>
              <p className="text-base text-blue-100 font-medium mt-1">
                JPL REGISTRATION SYSTEM – Hospital Dalat, Sarawak
              </p>
            </div>
          </div>

          {/* Stepper */}
          <div className="mt-6 flex items-center justify-between text-sm font-bold border-t border-white/20 pt-4">
            <span className={step >= 1 ? 'text-white' : 'text-white/50'}>1. Alamat & Storan</span>
            <span>&rarr;</span>
            <span className={step >= 2 ? 'text-white' : 'text-white/50'}>2. Mod Pemasangan</span>
            <span>&rarr;</span>
            <span className={step >= 3 ? 'text-white' : 'text-white/50'}>3. Akaun Penyelia</span>
            <span>&rarr;</span>
            <span className={step >= 4 ? 'text-white' : 'text-white/50'}>4. Kunci Pemulihan</span>
          </div>
        </div>

        {/* Wizard Content */}
        <div className="p-6 md:p-10 space-y-6">
          {errorMsg && (
            <div className="p-4 bg-red-50 border-2 border-[#991B1B] text-[#991B1B] rounded-xl font-bold flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Step 1: Origin & Storage */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="p-5 bg-amber-50 border-2 border-amber-300 rounded-2xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-8 h-8 text-amber-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xl font-black text-amber-900">
                      PERHATIAN PENTING: ALAMAT SISTEM (ORIGIN)
                    </h3>
                    <p className="text-base text-amber-800 mt-2 font-medium">
                      Data pesakit dalam IndexedDB terikat kepada alamat ini. Jika alamat atau port bertukar, data lama tidak akan kelihatan.
                    </p>
                    <div className="mt-3 p-3 bg-white rounded-xl border border-amber-300 font-mono font-bold text-lg text-gray-900 select-all">
                      {currentOrigin}
                    </div>
                    <p className="text-sm font-bold text-amber-900 mt-2">
                      CATAT ALAMAT INI. JANGAN TUKAR SEPANJANG PENGGUNAAN.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-blue-50 border-2 border-blue-200 rounded-2xl">
                <div className="flex items-center gap-3">
                  <HardDrive className="w-8 h-8 text-[#2F5D8A]" />
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-gray-900">Status Storan Pelayar</h4>
                    <p className="text-base text-gray-700">
                      Ketahanan Storan:{' '}
                      <strong className={storagePersisted ? 'text-green-700' : 'text-amber-700'}>
                        {storagePersisted ? 'DIKEKALKAN (PERSISTENT)' : 'TIDAK DIKEKALKAN (Lalai Pelayar)'}
                      </strong>
                    </p>
                    {storageQuota && (
                      <p className="text-sm text-gray-600">Anggaran Ruang Diperuntukkan: {storageQuota}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="py-4 px-8 rounded-2xl bg-[#2F5D8A] hover:bg-[#254A6F] text-white font-bold text-xl flex items-center gap-3 shadow-lg"
                >
                  <span>SETERUSNYA: PILIH MOD</span>
                  <ArrowRight className="w-6 h-6" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Mode Selection */}
          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-2xl font-black text-gray-900">Pilih Mod Pemasangan PC Ini</h3>
              <p className="text-base text-gray-700 font-medium">
                Pilih mod mengikut peranan fizikal komputer ini di Hospital Dalat:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  onClick={() => setInstallationMode('MOD_KAUNTER')}
                  className={`p-6 rounded-2xl border-4 cursor-pointer transition ${
                    installationMode === 'MOD_KAUNTER'
                      ? 'border-[#2F5D8A] bg-blue-50/80 shadow-md ring-2 ring-blue-300'
                      : 'border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-[#2F5D8A]">MOD KAUNTER</span>
                    {installationMode === 'MOD_KAUNTER' && <CheckCircle className="w-7 h-7 text-[#2F5D8A]" />}
                  </div>
                  <p className="text-base text-gray-700 mt-2">
                    Untuk <strong>PC Kaunter Pendaftaran JPL</strong>. Mempunyai fungsi pendaftaran pesakit harian, 4 kategori kehadiran, cetakan slip, dan rekod operasi.
                  </p>
                </div>

                <div
                  onClick={() => setInstallationMode('MOD_PENYELIA_ARKIB')}
                  className={`p-6 rounded-2xl border-4 cursor-pointer transition ${
                    installationMode === 'MOD_PENYELIA_ARKIB'
                      ? 'border-[#2F5D8A] bg-blue-50/80 shadow-md ring-2 ring-blue-300'
                      : 'border-gray-300 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-[#2F5D8A]">MOD PENYELIA-ARKIB</span>
                    {installationMode === 'MOD_PENYELIA_ARKIB' && <CheckCircle className="w-7 h-7 text-[#2F5D8A]" />}
                  </div>
                  <p className="text-base text-gray-700 mt-2">
                    Untuk <strong>PC Penyelia Rekod</strong>. Tiada fungsi daftar kehadiran. Khusus untuk pengesahan backup, pembinaan arkib digital, Archive Viewer, dan reten rasmi.
                  </p>
                </div>
              </div>

              <div className="flex justify-between pt-6">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="py-4 px-6 rounded-2xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-lg"
                >
                  KEMBALI
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="py-4 px-8 rounded-2xl bg-[#2F5D8A] hover:bg-[#254A6F] text-white font-bold text-xl flex items-center gap-3 shadow-lg"
                >
                  <span>SETERUSNYA: CIPTA AKAUN</span>
                  <ArrowRight className="w-6 h-6" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Create Initial Supervisor Account */}
          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-2xl font-black text-gray-900">Cipta Akaun Penyelia Pertama</h3>
              <p className="text-base text-gray-700 font-medium">
                Penyelia mempunyai kawalan penuh terhadap reten, backup, pembetulan profil dan pembersihan.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-base font-bold text-gray-800 mb-1">
                    Nama Penuh Pegawai Penyelia (Huruf Besar):
                  </label>
                  <input
                    type="text"
                    value={supervisorFullName}
                    onChange={(e) => setSupervisorFullName(e.target.value)}
                    placeholder="CONTOH: MOHD ROSLI BIN AHMAD"
                    className="w-full p-4 rounded-xl border-2 border-gray-400 font-bold text-lg focus:outline-none focus:border-[#2F5D8A]"
                  />
                </div>

                <div>
                  <label className="block text-base font-bold text-gray-800 mb-1">
                    Nama Pengguna (Username):
                  </label>
                  <input
                    type="text"
                    value={supervisorUsername}
                    onChange={(e) => setSupervisorUsername(e.target.value)}
                    className="w-full p-4 rounded-xl border-2 border-gray-400 font-bold text-lg focus:outline-none focus:border-[#2F5D8A]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-base font-bold text-gray-800 mb-1">
                      Kata Laluan (Min. 8 Aksara + Huruf & Nombor):
                    </label>
                    <input
                      type="password"
                      value={supervisorPassword}
                      onChange={(e) => setSupervisorPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full p-4 rounded-xl border-2 border-gray-400 font-bold text-lg focus:outline-none focus:border-[#2F5D8A]"
                    />
                  </div>
                  <div>
                    <label className="block text-base font-bold text-gray-800 mb-1">
                      Sahkan Kata Laluan:
                    </label>
                    <input
                      type="password"
                      value={supervisorPasswordConfirm}
                      onChange={(e) => setSupervisorPasswordConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="w-full p-4 rounded-xl border-2 border-gray-400 font-bold text-lg focus:outline-none focus:border-[#2F5D8A]"
                    />
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-xl border border-amber-300 text-sm text-amber-900 font-medium">
                  <strong>Peringatan Dasar Keselamatan:</strong> Sistem akan memaparkan peringatan berterusan sehingga akaun <strong>Penyelia Kedua</strong> dicipta bagi mengelakkan situasi terkunci.
                </div>
              </div>

              <div className="flex justify-between pt-6">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="py-4 px-6 rounded-2xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-lg"
                >
                  KEMBALI
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!supervisorFullName.trim()) {
                      setErrorMsg('Sila isi nama penuh Penyelia.');
                      return;
                    }
                    if (supervisorPassword.length < 8) {
                      setErrorMsg('Kata laluan mestilah minimum 8 aksara.');
                      return;
                    }
                    if (supervisorPassword !== supervisorPasswordConfirm) {
                      setErrorMsg('Kata laluan tidak sepadan.');
                      return;
                    }
                    setErrorMsg('');
                    setStep(4);
                  }}
                  className="py-4 px-8 rounded-2xl bg-[#2F5D8A] hover:bg-[#254A6F] text-white font-bold text-xl flex items-center gap-3 shadow-lg"
                >
                  <span>SETERUSNYA: KUNCI PEMULIHAN</span>
                  <ArrowRight className="w-6 h-6" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Recovery Key */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="p-6 bg-blue-50 border-2 border-[#2F5D8A] rounded-2xl text-center space-y-3">
                <Key className="w-12 h-12 text-[#2F5D8A] mx-auto" />
                <h3 className="text-2xl font-black text-gray-900">KUNCI PEMULIHAN KECEMASAN (RECOVERY KEY)</h3>
                <p className="text-base text-gray-700 max-w-xl mx-auto font-medium">
                  Kunci ini dijana HANYA SEKALI untuk membuka sistem jika semua akaun Penyelia terkunci. Sila cetak atau catat dan simpan dalam sampul berlakri di pejabat Penyelia.
                </p>

                <div className="my-4 p-4 bg-white rounded-xl border-2 border-dashed border-[#2F5D8A] inline-block font-mono text-2xl md:text-3xl font-black tracking-widest text-[#2F5D8A] select-all">
                  {recoveryKey}
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border-2 border-gray-300 font-bold text-base text-gray-800 hover:bg-gray-100 shadow-sm"
                  >
                    <Printer className="w-5 h-5" />
                    <span>Cetak Slip Kunci Pemulihan</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-between pt-6">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="py-4 px-6 rounded-2xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-lg"
                >
                  KEMBALI
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleFinishSetup}
                  className="py-4 px-10 rounded-2xl bg-green-700 hover:bg-green-800 text-white font-black text-xl flex items-center gap-3 shadow-xl disabled:opacity-50"
                >
                  <CheckCircle className="w-7 h-7 text-white" />
                  <span>{loading ? 'MENYIMPAN DATA...' : 'SELESAIKAN & MULA SISTEM'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
