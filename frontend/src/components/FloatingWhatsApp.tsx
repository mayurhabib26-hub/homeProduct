import React, { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { Phone, X, MessageSquare, Send } from 'lucide-react';

export const FloatingWhatsApp: React.FC = () => {
  const { generateWhatsAppOrderUrl } = useShop();
  const [isOpen, setIsOpen] = useState(false);
  const [customQuery, setCustomQuery] = useState('');

  const handleSendCustomMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const phoneNumber = '919876543210';
    const text = customQuery.trim()
      ? `Namaste S V Home Products!\n${customQuery}`
      : 'Namaste S V Home Products! I would like to place an order for traditional homemade spice powders.';
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(text)}`, '_blank');
    setIsOpen(false);
    setCustomQuery('');
  };

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-5 z-40 font-sans">
      {/* Popover Card */}
      {isOpen && (
        <div className="mb-3 w-80 bg-[#FAF6F0] rounded-xl shadow-2xl border border-[#EBD9BC] overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="bg-[#483828] text-[#F3E7D0] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#87380F] flex items-center justify-center text-white font-serif font-bold text-lg">
                SV
              </div>
              <div>
                <h4 className="font-serif text-sm font-bold text-[#FAF6F0] leading-tight">
                  S V Home Products
                </h4>
                <span className="text-[10px] text-[#B69A55] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                  Family Kitchen Support
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#EBD9BC]/70 hover:text-white p-1"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3 text-xs text-[#483828]">
            <div className="bg-white p-3 rounded-lg border border-[#EBD9BC] shadow-2xs">
              <p className="font-serif text-xs leading-relaxed">
                Namaste! 🙏 Need help with custom spice quantities, temple-style recipes, or ordering directly?
              </p>
              <span className="text-[9px] text-[#483828]/50 block text-right mt-1">S V Team</span>
            </div>

            <form onSubmit={handleSendCustomMessage} className="flex gap-2">
              <input
                type="text"
                placeholder="Ask us anything or mention spices..."
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                className="flex-1 bg-white border border-[#EBD9BC] rounded px-3 py-1.5 text-xs text-[#483828] focus:outline-none focus:border-[#87380F]"
              />
              <button
                type="submit"
                className="px-3 bg-[#87380F] hover:bg-[#662707] text-white rounded flex items-center justify-center transition-colors"
                aria-label="Send to WhatsApp"
              >
                <Send size={13} />
              </button>
            </form>

            <a
              href={generateWhatsAppOrderUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full block text-center py-2 bg-[#647044] hover:bg-[#4d5733] text-white font-semibold rounded text-xs transition-colors"
            >
              Open Direct WhatsApp Chat
            </a>
          </div>
        </div>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        id="floating-whatsapp-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center gap-2.5 px-4 py-3 bg-[#87380F] hover:bg-[#662707] text-[#FAF6F0] rounded-full shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border border-[#B69A55]/40"
        aria-label="Chat on WhatsApp"
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B69A55] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-[#B69A55]"></span>
        </span>
        <Phone size={18} className="fill-current" />
        <span className="text-xs font-semibold tracking-wider uppercase pr-1 hidden sm:inline">
          Order on WhatsApp
        </span>
      </button>
    </div>
  );
};
