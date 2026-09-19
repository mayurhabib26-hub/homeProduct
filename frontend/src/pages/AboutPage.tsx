import React from 'react';
import { useShop } from '../context/ShopContext';
import { comboTrioImg } from '../content/site';
import { ArrowRight, Sparkles, Heart, Shield, Flame, Wheat, Leaf } from 'lucide-react';
import { ScrollReveal } from '../components/ScrollReveal';
import { Link } from 'react-router-dom';

export const AboutPage: React.FC = () => {

  return (
    <div className="bg-[#FAF6F0] min-h-screen py-10 md:py-16 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Editorial Hero */}
        <ScrollReveal animation="fade-up">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F3E7D0] border border-[#B69A55]/40 text-xs font-semibold tracking-wider uppercase text-[#87380F]">
              <Sparkles size={14} className="text-gold-ink" />
              <span>Our Heritage & Journey</span>
            </div>

            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-[#483828] leading-[1.15]">
              MORE THAN SPICES.<br />
              <span className="text-[#87380F] italic font-normal">A TASTE OF HOME.</span>
            </h1>

            <p className="text-base sm:text-lg text-[#483828]/85 font-sans leading-relaxed">
              In every South Indian home, the kitchen is where memories are simmered. S V Home Products was born from a desire to preserve the authentic, comforting flavours that have nourished our families for generations.
            </p>
          </div>
        </ScrollReveal>

        {/* Story Section 1: The Kitchen Roots */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center mb-20">
          <div className="lg:col-span-6 relative">
            <ScrollReveal animation="slide-right">
              <div>
                <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-xl border border-[#EBD9BC] bg-[#EBD9BC]">
                  <img
                    src={comboTrioImg}
                    alt="S V Home Products handcrafted pouches with traditional brass lamp and whole roasted spices"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="absolute -bottom-6 -right-4 sm:right-6 bg-[#FAF6F0] p-4 rounded-xl border-2 border-[#B69A55] shadow-lg max-w-xs">
                  <span className="font-serif italic text-sm text-[#87380F] font-bold block">
                    “When food is made with love and time, you taste the difference in every spoon.”
                  </span>
                </div>
              </div>
            </ScrollReveal>
          </div>

          <div className="lg:col-span-6 space-y-6">
            <ScrollReveal animation="slide-left">
              <div className="space-y-6">
                <span className="text-xs uppercase tracking-widest font-sans font-semibold text-[#87380F]">
                  WHERE IT ALL BEGAN
                </span>
                <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#483828]">
                  Born in a Traditional Family Kitchen
                </h2>
                <div className="space-y-4 text-sm sm:text-base text-[#483828]/85 leading-relaxed font-sans">
                  <p>
                    Our founders grew up watching mothers and grandmothers carefully roast whole spices under the morning sun, grinding small quantities every fortnight so that every bowl of Rasam or Sambar sparkled with fresh aroma.
                  </p>
                  <p>
                    As life accelerated, commercial supermarket spices took over — but they traded slow roasting for industrial heat, authentic Byadagi chillies for chemical dyes, and freshness for long-sitting warehouse storage.
                  </p>
                  <p>
                    S V Home Products was founded to return to the roots: genuine heirloom ratios, sun-warmed spices, gentle wood and iron roasting, and batches so fresh you can smell the warmth the moment you open the seal.
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>

        {/* Story Section 2: The Spice Craft Process */}
        <div className="bg-[#F7EFE1] rounded-2xl border border-[#EBD9BC] p-8 md:p-14 mb-20">
          <ScrollReveal animation="fade-up">
            <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
              <span className="text-xs uppercase tracking-widest font-sans font-semibold text-[#87380F]">
                THE ARTISANAL PROCESS
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#483828]">
                How We Craft Every Batch
              </h2>
              <p className="text-sm text-[#483828]/80 font-sans">
                We never cut corners. Our 4-step preparation honours traditional wisdom.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <ScrollReveal animation="fade-up" delay={0.05}>
              <div className="bg-[#FAF6F0] p-6 rounded-xl border border-[#EBD9BC] text-center h-full">
                <span className="font-serif text-3xl font-bold text-[#87380F] block mb-2">01</span>
                <h4 className="font-serif text-lg font-bold text-[#483828] mb-2">Single-Origin Sourcing</h4>
                <p className="text-xs text-[#483828]/75 leading-relaxed">
                  Byadagi chillies from Karnataka, Tellicherry black pepper from Kerala, and coriander seeds from select traditional growers.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal animation="fade-up" delay={0.1}>
              <div className="bg-[#FAF6F0] p-6 rounded-xl border border-[#EBD9BC] text-center h-full">
                <span className="font-serif text-3xl font-bold text-[#87380F] block mb-2">02</span>
                <h4 className="font-serif text-lg font-bold text-[#483828] mb-2">Gentle Sun-Drying</h4>
                <p className="text-xs text-[#483828]/75 leading-relaxed">
                  Whole spices are naturally sun-warmed on clean cotton sheets to eliminate moisture while preserving volatile aromatic oils.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal animation="fade-up" delay={0.15}>
              <div className="bg-[#FAF6F0] p-6 rounded-xl border border-[#EBD9BC] text-center h-full">
                <span className="font-serif text-3xl font-bold text-[#87380F] block mb-2">03</span>
                <h4 className="font-serif text-lg font-bold text-[#483828] mb-2">Slow Kadai Roasting</h4>
                <p className="text-xs text-[#483828]/75 leading-relaxed">
                  Each spice is roasted individually at low temperatures to its optimal aroma point — never burned or flash-heated.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal animation="fade-up" delay={0.2}>
              <div className="bg-[#FAF6F0] p-6 rounded-xl border border-[#EBD9BC] text-center h-full">
                <span className="font-serif text-3xl font-bold text-[#87380F] block mb-2">04</span>
                <h4 className="font-serif text-lg font-bold text-[#483828] mb-2">Coarse Fresh Milling</h4>
                <p className="text-xs text-[#483828]/75 leading-relaxed">
                  Ground into a slightly textured grain (not an overly fine dusty powder) to ensure deep, lingering flavor when simmered.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>

        {/* Values and Commitments */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          <ScrollReveal animation="fade-up" delay={0.05}>
            <div className="bg-white p-8 rounded-xl border border-[#EBD9BC] shadow-xs space-y-3 h-full">
              <div className="w-12 h-12 rounded-full bg-[#87380F]/15 text-[#87380F] flex items-center justify-center">
                <Leaf size={24} />
              </div>
              <h3 className="font-serif text-xl font-bold text-[#483828]">100% Preservative Free</h3>
              <p className="text-xs sm:text-sm text-[#483828]/80 leading-relaxed font-sans">
                No artificial colors, added MSG, synthetic preservatives or fillers. Pure food as it was meant to be enjoyed.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal animation="fade-up" delay={0.15}>
            <div className="bg-white p-8 rounded-xl border border-[#EBD9BC] shadow-xs space-y-3 h-full">
              <div className="w-12 h-12 rounded-full bg-[#647044]/15 text-[#647044] flex items-center justify-center">
                <Flame size={24} />
              </div>
              <h3 className="font-serif text-xl font-bold text-[#483828]">Small-Batch Dedication</h3>
              <p className="text-xs sm:text-sm text-[#483828]/80 leading-relaxed font-sans">
                We roast in modest 15kg-20kg batches so you receive freshly crafted spice blends, never boxes that languished on warehouse shelves.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal animation="fade-up" delay={0.25}>
            <div className="bg-white p-8 rounded-xl border border-[#EBD9BC] shadow-xs space-y-3 h-full">
              <div className="w-12 h-12 rounded-full bg-[#B69A55]/15 text-gold-ink flex items-center justify-center">
                <Heart size={24} />
              </div>
              <h3 className="font-serif text-xl font-bold text-[#483828]">Heirloom Family Recipes</h3>
              <p className="text-xs sm:text-sm text-[#483828]/80 leading-relaxed font-sans">
                Recipes refined over generations to bring comforting harmony of spice, tang, aroma, and digestion.
              </p>
            </div>
          </ScrollReveal>
        </div>

        {/* CTA banner */}
        <ScrollReveal animation="fade-up">
          <div className="text-center py-12 bg-[#87380F] text-[#FAF6F0] rounded-2xl p-8 shadow-xl">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold mb-3">
              Bring Authentic South Indian Flavours to Your Table
            </h2>
            <p className="text-sm sm:text-base text-[#EBD9BC] max-w-xl mx-auto mb-6">
              Taste the craftsmanship in every meal. Delivered freshly to your doorstep across India.
            </p>
            <Link to="/shop"
                className="px-8 py-3.5 bg-[#FAF6F0] hover:bg-[#EBD9BC] text-[#87380F] font-sans text-xs font-bold tracking-widest uppercase rounded-md transition-colors inline-flex items-center gap-2 cursor-pointer">
              <span>EXPLORE OUR PRODUCTS</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
};
