import React from 'react';
import { AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel = 'TIDAK, KEMBALI',
  variant = 'primary',
  onConfirm,
  onCancel,
  loading = false,
}) => {
  if (!isOpen) return null;

  const getConfirmButtonClasses = () => {
    switch (variant) {
      case 'danger':
        return 'bg-[#991B1B] hover:bg-[#7F1D1D] text-white focus:ring-red-400';
      case 'warning':
        return 'bg-[#B45309] hover:bg-[#92400E] text-white focus:ring-amber-400';
      case 'primary':
      default:
        return 'bg-[#2F5D8A] hover:bg-[#254A6F] text-white focus:ring-blue-400';
    }
  };

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <AlertTriangle className="w-12 h-12 text-[#991B1B]" />;
      case 'warning':
        return <AlertTriangle className="w-12 h-12 text-[#B45309]" />;
      case 'primary':
      default:
        return <HelpCircle className="w-12 h-12 text-[#2F5D8A]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 md:p-8 shadow-2xl border-2 border-gray-300">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-gray-100 rounded-full flex-shrink-0">{getIcon()}</div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
            <p className="mt-3 text-lg text-gray-700 whitespace-pre-line leading-relaxed font-medium">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row-reverse gap-4">
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`w-full sm:w-1/2 py-4 px-6 rounded-xl font-bold text-lg shadow-md transition focus:outline-none focus:ring-4 ${getConfirmButtonClasses()} disabled:opacity-50`}
          >
            {loading ? 'Sila tunggu...' : confirmLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="w-full sm:w-1/2 py-4 px-6 rounded-xl font-bold text-lg bg-gray-200 hover:bg-gray-300 text-gray-800 transition focus:outline-none focus:ring-4 focus:ring-gray-300 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
