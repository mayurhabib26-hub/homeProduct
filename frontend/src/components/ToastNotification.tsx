import React from 'react';
import { useShop } from '../context/ShopContext';
import { CheckCircle2 } from 'lucide-react';

export const ToastNotification: React.FC = () => {
  const { toastMessage } = useShop();

  if (!toastMessage) return null;

  return (
    <div className="fixed top-20 right-4 sm:right-8 z-50 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
      <div className="bg-[#FAF6F0] text-[#483828] border-2 border-[#B69A55] rounded-lg px-4 py-3 shadow-xl flex items-center gap-2.5 font-sans text-xs font-semibold">
        <CheckCircle2 size={16} className="text-[#87380F] shrink-0" />
        <span>{toastMessage}</span>
      </div>
    </div>
  );
};
