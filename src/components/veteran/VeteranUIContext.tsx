import React, { createContext, useContext, useState, useEffect } from 'react';
import type { TextSize } from '../../types';

interface VeteranUIContextType {
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
  increaseTextSize: () => void;
  decreaseTextSize: () => void;
  getTextSizeClass: () => string;
}

const VeteranUIContext = createContext<VeteranUIContextType | undefined>(undefined);

export const VeteranUIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [textSize, setTextSizeState] = useState<TextSize>(() => {
    const saved = localStorage.getItem('JPL_TEXT_SIZE') as TextSize;
    return saved || 'besar'; // Default is 'besar' (20px) per prompt
  });

  const setTextSize = (size: TextSize) => {
    setTextSizeState(size);
    localStorage.setItem('JPL_TEXT_SIZE', size);
  };

  const increaseTextSize = () => {
    if (textSize === 'biasa') setTextSize('besar');
    else if (textSize === 'besar') setTextSize('sangat_besar');
  };

  const decreaseTextSize = () => {
    if (textSize === 'sangat_besar') setTextSize('besar');
    else if (textSize === 'besar') setTextSize('biasa');
  };

  const getTextSizeClass = () => {
    switch (textSize) {
      case 'biasa':
        return 'text-lg'; // 18px
      case 'sangat_besar':
        return 'text-2xl'; // 24px
      case 'besar':
      default:
        return 'text-xl'; // 20px
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-text-size', textSize);
  }, [textSize]);

  return (
    <VeteranUIContext.Provider
      value={{
        textSize,
        setTextSize,
        increaseTextSize,
        decreaseTextSize,
        getTextSizeClass,
      }}
    >
      <div className={`${getTextSizeClass()} min-h-screen text-[#1F2A37]`}>
        {children}
      </div>
    </VeteranUIContext.Provider>
  );
};

export const useVeteranUI = () => {
  const context = useContext(VeteranUIContext);
  if (!context) {
    throw new Error('useVeteranUI must be used within VeteranUIProvider');
  }
  return context;
};
