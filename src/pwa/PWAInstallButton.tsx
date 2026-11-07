import React, { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';
import { Download, Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 rounded-lg bg-[#2F5D8A] text-white px-4 py-2 font-bold text-sm shadow hover:bg-[#254A6F] transition focus:outline-none focus:ring-4 focus:ring-blue-300"
        title="Pasang aplikasi ini pada komputer atau peranti anda untuk kegunaan luar talian"
      >
        <Download className="w-5 h-5 text-white" />
        <span>PASANG APLIKASI (PWA)</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 rounded-lg border-2 border-[#2F5D8A] bg-white text-[#2F5D8A] px-3 py-1.5 font-bold text-sm hover:bg-blue-50 transition"
        >
          <Smartphone className="w-4 h-4" />
          <span>Pasang di iPad/iPhone</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">Cara Memasang di iPad / iPhone</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-md text-gray-500 hover:bg-gray-100"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-base text-gray-700 space-y-2">
                1. Tekan butang <strong>Kongsi (Share)</strong> pada bar Safari.<br />
                2. Tatal ke bawah dan tekan <strong>Tambah ke Skrin Utama (Add to Home Screen)</strong>.<br />
                3. Buka ikon aplikasi terus dari skrin utama anda.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-lg bg-[#2F5D8A] py-3 text-white font-bold text-base hover:bg-[#254A6F]"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
