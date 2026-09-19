import React from 'react';
import { BrandLogo } from './BrandLogo';
import { useShop } from '../context/ShopContext';
import { Phone, Mail, MapPin, Instagram, Facebook, ShieldCheck, Truck, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { telHref, formatPhoneForDisplay, FSSAI_LICENCE, SELLER_LEGAL_NAME } from '../lib/contact';

export const Footer: React.FC = () => {
  const { generateWhatsAppOrderUrl } = useShop();

  return (
    <footer className="bg-[#382B1E] text-[#EBD9BC] pt-16 pb-12 border-t-2 border-[#B69A55]/30 relative overflow-hidden font-sans">
      {/* Decorative botanical background motifs inspired by logo */}
      <div className="absolute top-0 right-0 w-96 h-96 opacity-5 pointer-events-none transform translate-x-1/3 -translate-y-1/3">
        <svg viewBox="0 0 200 200" fill="currentColor">
          <path d="M45,100 C45,60 70,30 100,20 C130,30 155,60 155,100 C155,140 130,170 100,180 C70,170 45,140 45,100 Z" />
          <path d="M100,20 L100,180" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>

      {/* Trust Highlights Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 border-b border-[#5E4A35]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center sm:text-left">
          <div className="flex items-center gap-4 bg-[#2C2117]/60 p-4 rounded-lg border border-[#B69A55]/15">
            <div className="w-11 h-11 rounded-full bg-[#87380F]/20 text-gold-on-dark flex items-center justify-center shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h4 className="font-serif text-base text-[#FAF6F0] font-semibold">100% Authentic</h4>
              <p className="text-xs text-[#EBD9BC]/70 mt-0.5">No artificial colors, MSG, or chemicals</p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-[#2C2117]/60 p-4 rounded-lg border border-[#B69A55]/15">
            <div className="w-11 h-11 rounded-full bg-[#87380F]/20 text-gold-on-dark flex items-center justify-center shrink-0">
              <Truck size={22} />
            </div>
            <div>
              <h4 className="font-serif text-base text-[#FAF6F0] font-semibold">Pan-India Delivery</h4>
              <p className="text-xs text-[#EBD9BC]/70 mt-0.5">Free shipping on orders above ₹499</p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-[#2C2117]/60 p-4 rounded-lg border border-[#B69A55]/15">
            <div className="w-11 h-11 rounded-full bg-[#87380F]/20 text-gold-on-dark flex items-center justify-center shrink-0">
              <RefreshCw size={22} />
            </div>
            <div>
              <h4 className="font-serif text-base text-[#FAF6F0] font-semibold">Fresh Small Batches</h4>
              <p className="text-xs text-[#EBD9BC]/70 mt-0.5">Slow-roasted & freshly milled to order</p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-[#2C2117]/60 p-4 rounded-lg border border-[#B69A55]/15">
            <div className="w-11 h-11 rounded-full bg-[#87380F]/20 text-gold-on-dark flex items-center justify-center shrink-0">
              <Phone size={22} />
            </div>
            <div>
              <h4 className="font-serif text-base text-[#FAF6F0] font-semibold">Direct Kitchen Care</h4>
              <p className="text-xs text-[#EBD9BC]/70 mt-0.5">WhatsApp support for easy repeat orders</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links & Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Col 1: Brand & Philosophy (Spans 2 cols on desktop) */}
          <div className="lg:col-span-2 space-y-4">
            <BrandLogo
              size="md"
              showText={true}
              textColor="text-[#FAF6F0]"
              subtextColor="text-gold-on-dark"
            />
            <p className="text-sm text-[#EBD9BC]/80 leading-relaxed max-w-sm pt-2">
              Authentic flavours inspired by the warmth of South Indian kitchens.
              Rooted in time-honoured heritage recipes, handcrafted with handpicked spices
              and traditional roasting techniques.
            </p>

            <div className="pt-2 flex items-center gap-3">
              <a
                href="https://www.instagram.com/s_v_homeproduct/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-[#483828] border border-[#B69A55]/30 text-[#EBD9BC] hover:text-[#FAF6F0] hover:bg-[#87380F] flex items-center justify-center transition-colors"
                aria-label="Instagram Profile"
              >
                <Instagram size={17} />
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-[#483828] border border-[#B69A55]/30 text-[#EBD9BC] hover:text-[#FAF6F0] hover:bg-[#87380F] flex items-center justify-center transition-colors"
                aria-label="Facebook Profile"
              >
                <Facebook size={17} />
              </a>
              <a
                href={generateWhatsAppOrderUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-[#483828] border border-[#B69A55]/30 text-[#EBD9BC] hover:text-[#FAF6F0] hover:bg-[#87380F] flex items-center justify-center transition-colors"
                aria-label="WhatsApp Us"
              >
                <Phone size={17} />
              </a>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div>
            <h3 className="font-serif text-lg text-[#FAF6F0] tracking-wide font-semibold mb-4 border-b border-[#B69A55]/20 pb-2">
              Explore
            </h3>
            <ul className="space-y-2.5 text-sm text-[#EBD9BC]/80">
              <li>
                <Link to="/"
                className="hover:text-[#FAF6F0] hover:underline underline-offset-4 transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/shop"
                className="hover:text-[#FAF6F0] hover:underline underline-offset-4 transition-colors">
                  Shop All Spices
                </Link>
              </li>
              <li>
                <Link to="/about"
                className="hover:text-[#FAF6F0] hover:underline underline-offset-4 transition-colors">
                  Our Heritage Story
                </Link>
              </li>
              <li>
                <Link to="/recipes"
                className="hover:text-[#FAF6F0] hover:underline underline-offset-4 transition-colors">
                  Kitchen Recipes
                </Link>
              </li>
              <li>
                <Link to="/contact"
                className="hover:text-[#FAF6F0] hover:underline underline-offset-4 transition-colors">
                  Contact & Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Traditional Classics */}
          <div>
            <h3 className="font-serif text-lg text-[#FAF6F0] tracking-wide font-semibold mb-4 border-b border-[#B69A55]/20 pb-2">
              Our Specialties
            </h3>
            <ul className="space-y-2.5 text-sm text-[#EBD9BC]/80">
              <li>
                <Link to="/shop"
                className="hover:text-[#FAF6F0] hover:underline underline-offset-4 transition-colors text-left">
                  Authentic Rasam Powder
                </Link>
              </li>
              <li>
                <Link to="/shop"
                className="hover:text-[#FAF6F0] hover:underline underline-offset-4 transition-colors text-left">
                  Temple Puliyogare Powder
                </Link>
              </li>
              <li>
                <Link to="/shop"
                className="hover:text-[#FAF6F0] hover:underline underline-offset-4 transition-colors text-left">
                  Home-Style Sambar Powder
                </Link>
              </li>
              <li>
                <Link to="/shop"
                className="hover:text-[#FAF6F0] hover:underline underline-offset-4 transition-colors text-left">
                  Idli Gunpowder Podi
                </Link>
              </li>
              <li>
                <Link to="/shop"
                className="hover:text-[#FAF6F0] hover:underline underline-offset-4 transition-colors text-left">
                  Festive Combo Gift Boxes
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Customer Support & Contact */}
          <div>
            <h3 className="font-serif text-lg text-[#FAF6F0] tracking-wide font-semibold mb-4 border-b border-[#B69A55]/20 pb-2">
              Customer Support
            </h3>
            <ul className="space-y-3 text-sm text-[#EBD9BC]/80">
              <li className="flex items-start gap-2.5">
                <MapPin size={16} className="text-gold-on-dark shrink-0 mt-0.5" />
                <span>Handcrafted in Karnataka & Tamil Nadu kitchens, delivering across India.</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone size={16} className="text-gold-on-dark shrink-0" />
                <a href={telHref()} className="inline-flex items-center min-h-11 hover:text-[#FAF6F0] transition-colors">
                  {formatPhoneForDisplay()}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail size={16} className="text-gold-on-dark shrink-0" />
                <a href="mailto:care@svhomeproducts.com" className="inline-flex items-center min-h-11 hover:text-[#FAF6F0] transition-colors">
                  care@svhomeproducts.com
                </a>
              </li>
              <li className="pt-2">
                <a
                  href={generateWhatsAppOrderUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#87380F] hover:bg-[#9E4515] text-[#FAF6F0] text-xs font-semibold rounded-md transition-colors"
                >
                  <Phone size={12} />
                  <span>Chat on WhatsApp</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Legal & Payment Options */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 border-t border-[#5E4A35]/80 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#EBD9BC]/60">
        <p>© {new Date().getFullYear()} S V HOME PRODUCTS. All rights reserved. Handcrafted with love.</p>

        {/* Accepted Payment badges for India */}
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <span className="text-[11px] text-[#EBD9BC]/70">Accepted Payments:</span>
          <span className="px-2 py-0.5 bg-[#483828] border border-[#B69A55]/30 rounded text-[10px] font-semibold text-[#F3E7D0]">
            UPI (GPay / PhonePe / Paytm)
          </span>
          <span className="px-2 py-0.5 bg-[#483828] border border-[#B69A55]/30 rounded text-[10px] font-semibold text-[#F3E7D0]">
            RuPay
          </span>
          <span className="px-2 py-0.5 bg-[#483828] border border-[#B69A55]/30 rounded text-[10px] font-semibold text-[#F3E7D0]">
            Visa / Master
          </span>
          <span className="px-2 py-0.5 bg-[#483828] border border-[#B69A55]/30 rounded text-[10px] font-semibold text-[#F3E7D0]">
            Cash on Delivery
          </span>
        </div>
      </div>
          {/* FSSAI licence must appear on every page, not buried in an About
          section. Legal declaration, not decoration. docs/COMPLIANCE.md §2 */}
      <div className="border-t border-[#FAF6F0]/15 mt-8 pt-6 pb-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[11px] text-[#EBD9BC]/70">
          <p>
            {SELLER_LEGAL_NAME} &middot; FSSAI Licence No.{' '}
            <span className="font-mono">{FSSAI_LICENCE}</span>
          </p>
          <nav className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Policies">
            <Link to="/policies/shipping" className="inline-flex items-center min-h-11 hover:text-[#FAF6F0] transition-colors">Shipping</Link>
            <Link to="/policies/refunds" className="inline-flex items-center min-h-11 hover:text-[#FAF6F0] transition-colors">Refunds &amp; Cancellation</Link>
            <Link to="/policies/privacy" className="inline-flex items-center min-h-11 hover:text-[#FAF6F0] transition-colors">Privacy</Link>
            <Link to="/policies/terms" className="inline-flex items-center min-h-11 hover:text-[#FAF6F0] transition-colors">Terms</Link>
            <Link to="/policies/grievance" className="inline-flex items-center min-h-11 hover:text-[#FAF6F0] transition-colors">Grievances</Link>
          </nav>
        </div>
      </div>
</footer>
  );
};
