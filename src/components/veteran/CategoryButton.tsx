import React from 'react';
import type { AttendanceCategory } from '../../types';
import { CalendarCheck, UserCheck, Stethoscope, Activity } from 'lucide-react';

interface CategoryButtonProps {
  category: AttendanceCategory;
  isSelected?: boolean;
  onClick: () => void;
  shortcut?: string;
}

export const CategoryButton: React.FC<CategoryButtonProps> = ({
  category,
  isSelected = false,
  onClick,
  shortcut,
}) => {
  const getCategoryDetails = () => {
    switch (category) {
      case 'FUP_RUTIN':
        return {
          label: 'F/UP RUTIN',
          desc: 'Temujanji rawatan ulangan berjadual',
          bg: isSelected ? 'bg-[#2F5D8A] text-white border-blue-900 ring-4 ring-blue-300' : 'bg-blue-50/80 text-[#2F5D8A] border-[#2F5D8A] hover:bg-blue-100',
          icon: <CalendarCheck className="w-10 h-10 mb-1" />,
        };
      case 'WALK_IN':
        return {
          label: 'WALK-IN',
          desc: 'Pesakit datang terus tanpa temujanji',
          bg: isSelected ? 'bg-[#256D60] text-white border-teal-900 ring-4 ring-teal-300' : 'bg-teal-50/80 text-[#256D60] border-[#256D60] hover:bg-teal-100',
          icon: <UserCheck className="w-10 h-10 mb-1" />,
        };
      case 'MEDICAL_CHECKUP':
        return {
          label: 'MEDICAL CHECK UP',
          desc: 'Pemeriksaan kesihatan / lesen / kerja',
          bg: isSelected ? 'bg-[#9A6014] text-white border-amber-900 ring-4 ring-amber-300' : 'bg-amber-50/80 text-[#9A6014] border-[#9A6014] hover:bg-amber-100',
          icon: <Stethoscope className="w-10 h-10 mb-1" />,
        };
      case 'PROCEDURE_ROOM':
        return {
          label: 'PROCEDURE ROOM',
          desc: 'Rawatan luka / suntikan / prosedur',
          bg: isSelected ? 'bg-[#5C4D7D] text-white border-purple-900 ring-4 ring-purple-300' : 'bg-purple-50/80 text-[#5C4D7D] border-[#5C4D7D] hover:bg-purple-100',
          icon: <Activity className="w-10 h-10 mb-1" />,
        };
    }
  };

  const { label, desc, bg, icon } = getCategoryDetails();

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border-4 text-center transition shadow-md focus:outline-none min-h-[140px] cursor-pointer ${bg}`}
    >
      {shortcut && (
        <span className="absolute top-2 right-3 text-xs font-black uppercase px-2 py-0.5 rounded bg-black/20 tracking-wider">
          {shortcut}
        </span>
      )}
      {icon}
      <span className="text-2xl font-black tracking-wide mt-1">{label}</span>
      <span className="text-sm font-medium mt-1 opacity-90">{desc}</span>
    </button>
  );
};
