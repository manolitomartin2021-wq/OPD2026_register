import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface PageHelpProps {
  title: string;
  points: string[];
}

export const PageHelp: React.FC<PageHelpProps> = ({ title, points }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-4 bg-white border-2 border-blue-200 rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-3.5 flex items-center justify-between text-left bg-blue-50/70 hover:bg-blue-100/70 transition font-bold text-[#1F2A37]"
      >
        <div className="flex items-center gap-3">
          <HelpCircle className="w-6 h-6 text-[#2F5D8A]" />
          <span className="text-lg">Panduan Halaman: {title}</span>
        </div>
        <div className="flex items-center gap-1 text-sm font-semibold text-[#2F5D8A]">
          <span>{isOpen ? 'Sembunyi' : 'Buka Panduan'}</span>
          {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-5 bg-white border-t border-blue-100">
          <ul className="space-y-2 list-disc list-inside text-base text-gray-800">
            {points.map((pt, i) => (
              <li key={i} className="leading-relaxed">
                {pt}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
