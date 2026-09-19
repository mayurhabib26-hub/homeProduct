import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ScrollReveal } from '../components/ScrollReveal';
import { useShop } from '../context/ShopContext';
import {
  rasamPackImg,
  sambarPackImg,
  puliyogarePackImg,
  chutneyPudiPackImg,
  bisiBelePackImg,
  comboTrioPackImg,
  comboTrioImg,
  byadagiChilliPackImg,
  corianderPackImg,
  traditionalCraftImg,
} from '../content/site';
import { useProducts, useRecipes } from '../api/queries';
import { ProductCardSkeleton } from '../components/QueryStates';
import { INGREDIENTS_STORY, CLIENT_REVIEWS } from '../content/site';
import { ProductCard } from '../components/ProductCard';
import { Link } from 'react-router-dom';
import { whatsappUrl } from '../lib/contact';
import {
  ArrowRight,
  Sparkles,
  Star,
  CheckCircle2,
  Clock,
  ChefHat,
  Heart,
  Flame,
  Wheat,
  Leaf,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Check,
  X,
  Sun,
  Layers,
  Award,
  Phone,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const {
    addToCart,
    showToast,
  } = useShop();

  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);

  // Selected favorites
  const { data: catalogue, isLoading: productsLoading } = useProducts({ limit: 60 });
  const { data: recipeList } = useRecipes();
  const allProducts = catalogue?.data ?? [];
  const favouriteProducts = allProducts.slice(0, 4);

  // Signature Rasam Product
  const rasamProduct = allProducts.find((p) => p.slug === 'rasam-powder');

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim() || !newsletterEmail.includes('@')) {
      showToast('Please enter a valid email address');
      return;
    }
    setNewsletterSubscribed(true);
    showToast('Thank you for subscribing to S V Home Products!');
    setNewsletterEmail('');
  };

  return (
    <div className="bg-[#FAF6F0] text-[#483828] font-sans selection:bg-[#EBD9BC] selection:text-[#87380F]">
      {/* =========================================================================
          SECTION 1 — PREMIUM CINEMATIC HERO
      ========================================================================= */}
      <section className="relative overflow-hidden pt-8 pb-16 md:pt-14 md:pb-24 border-b border-[#EBD9BC]/70">
        {/* Subtle decorative background watermarks & botanical rings */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full border border-[#B69A55]/15 pointer-events-none -z-0" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full border border-[#87380F]/10 pointer-events-none -z-0" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Left Hero Editorial Copy */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="lg:col-span-6 space-y-6 text-center lg:text-left"
            >
              {/* Trust Tag */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F3E7D0] border border-[#B69A55]/40 text-xs font-semibold tracking-wider uppercase text-[#87380F]">
                <Sparkles size={14} className="text-gold-ink" />
                <span>Handcrafted South Indian Spice House</span>
              </div>

              {/* Main Headline */}
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-[#483828] leading-[1.12] tracking-tight">
                AUTHENTIC TASTE.<br />
                <span className="text-[#87380F] italic font-normal">ROOTED IN TRADITION.</span>
              </h1>

              {/* Supporting Copy */}
              <p className="text-base sm:text-lg text-[#483828]/85 font-sans leading-relaxed max-w-xl mx-auto lg:mx-0">
                Traditional South Indian flavours, thoughtfully prepared and packed for the modern kitchen.
                Pure ingredients, family heirloom recipes, and slow roasted aromas that bring home to every meal.
              </p>

              {/* CTAs */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Link to="/shop"
                id="hero-shop-cta"
                className="w-full sm:w-auto px-8 py-3.5 bg-[#87380F] hover:bg-[#662707] text-[#FAF6F0] rounded-md font-sans text-sm font-semibold tracking-widest uppercase transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer">
                  <ShoppingBag size={16} />
                  <span>SHOP OUR PRODUCTS</span>
                </Link>

                <Link to="/about"
                id="hero-story-cta"
                className="w-full sm:w-auto px-8 py-3.5 bg-transparent border border-[#87380F] text-[#87380F] hover:bg-[#EBD9BC]/50 rounded-md font-sans text-sm font-semibold tracking-widest uppercase transition-colors flex items-center justify-center gap-2 cursor-pointer">
                  <span>EXPLORE OUR STORY</span>
                  <ArrowRight size={16} />
                </Link>
              </div>

              {/* Trust Line */}
              <div className="pt-4 flex items-center justify-center lg:justify-start gap-3 text-xs sm:text-sm text-[#483828]/80 font-serif italic border-t border-[#EBD9BC]/60">
                <span>Traditional Recipes</span>
                <span className="text-gold-ink">•</span>
                <span>Carefully Selected Spices</span>
                <span className="text-gold-ink">•</span>
                <span>Made with Love</span>
              </div>
            </motion.div>

            {/* Right Hero Cinematic Food Editorial Showcase */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.65, delay: 0.15, ease: 'easeOut' }}
              className="lg:col-span-6 relative"
            >
              <div className="relative mx-auto max-w-lg lg:max-w-none">
                {/* Main Arch Frame with Warm Spices Photography */}
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-[#FAF6F0] aspect-[4/3] sm:aspect-[5/4] bg-[#EBD9BC]">
                  <img
                    src={rasamPackImg}
                    alt="S V Home Products Authentic Rasam Powder Pouch with traditional brass bowls and whole spices"
                    className="w-full h-full object-cover object-center transform hover:scale-102 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  {/* Subtle vignette gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#483828]/40 via-transparent to-transparent" />

                  {/* Floating Highlight Card on Hero Image */}
                  <div className="absolute bottom-4 left-4 right-4 bg-[#FAF6F0]/95 backdrop-blur-md p-3.5 rounded-lg border border-[#EBD9BC] shadow-lg flex items-center justify-between">
                    <div>
                      <span className="text-[10px] tracking-widest font-sans uppercase font-bold text-[#87380F]">
                        Small Batch Roasted
                      </span>
                      <p className="font-serif text-sm sm:text-base font-bold text-[#483828] leading-tight">
                        Rasam • Puliyogare • Sambar • Podi
                      </p>
                    </div>
                    <Link
                      to="/product/rasam-powder"
                      className="text-xs text-[#87380F] font-semibold hover:underline inline-flex items-center gap-1 font-sans min-h-11"
                    >
                      <span>Explore</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>

                {/* Decorative Side Floating Badge */}
                <div className="hidden sm:flex absolute -top-5 -left-5 bg-[#FAF6F0] p-3 rounded-xl border border-[#B69A55]/40 shadow-xl items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#87380F]/15 text-[#87380F] flex items-center justify-center font-bold text-lg">
                    ✨
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-[#647044]">
                      100% Homemade
                    </span>
                    <p className="font-serif text-xs font-bold text-[#483828]">Heirloom Flavours</p>
                  </div>
                </div>

                {/* Decorative Bottom Floating Badge */}
                <div className="hidden sm:flex absolute -bottom-5 -right-5 bg-[#FAF6F0] px-4 py-2.5 rounded-xl border border-[#B69A55]/40 shadow-xl items-center gap-2 text-xs font-serif text-[#483828]">
                  <span className="text-gold-ink font-bold">★ 4.9</span>
                  <span>Loved by 1,200+ South Indian Homes</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2 — BRAND INTRODUCTION
      ========================================================================= */}
      <section className="py-16 md:py-24 bg-[#FAF6F0] border-b border-[#EBD9BC]/70 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Editorial Photo */}
            <div className="lg:col-span-6 order-2 lg:order-1">
              <ScrollReveal animation="slide-right" duration={0.65}>
                <div className="relative">
                  <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-lg border border-[#EBD9BC] bg-[#EBD9BC]">
                    <img
                      src={comboTrioImg}
                      alt="S V Home Products handcrafted spice pouches with traditional deepam and fresh curry leaves"
                      className="w-full h-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  {/* Small handwritten-style accent */}
                  <div className="absolute -bottom-5 -right-3 sm:right-6 bg-[#FAF6F0] px-5 py-3 rounded-lg border-2 border-[#B69A55] shadow-md transform rotate-1">
                    <span className="font-serif italic text-lg sm:text-xl font-bold text-[#87380F]">
                      “Made with tradition.”
                    </span>
                  </div>
                </div>
              </ScrollReveal>
            </div>

            {/* Right Text Editorial */}
            <div className="lg:col-span-6 space-y-6 order-1 lg:order-2">
              <ScrollReveal animation="slide-left" duration={0.65}>
                <div className="space-y-6">
                  <div className="inline-block text-xs uppercase tracking-widest font-sans font-semibold text-[#87380F] border-b border-[#87380F] pb-1">
                    OUR PHILOSOPHY
                  </div>

                  <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#483828] leading-[1.18]">
                    FROM OUR KITCHEN<br />
                    <span className="text-[#87380F]">TO YOUR TABLE</span>
                  </h2>

                  <div className="space-y-4 text-base sm:text-lg text-[#483828]/85 font-sans leading-relaxed">
                    <p>
                      At <strong className="text-[#483828] font-serif">S V Home Products</strong>, we believe the best flavours begin with simple ingredients, time-honoured recipes and the warmth of a home kitchen.
                    </p>
                    <p>
                      Our products are inspired by the authentic tastes of South India — created for families who cherish traditional food and for a new generation discovering it.
                    </p>
                    <p className="text-sm text-[#483828]/75">
                      Every batch of our Rasam, Puliyogare, and Sambar powders is crafted just as it has always been: roasting whole spices on gentle flames to release natural oils, grinding in small quantities, and packaging promptly so that comforting aroma fills your house the moment the lid is opened.
                    </p>
                  </div>

                  <div className="pt-2">
                    <Link to="/about"
                id="brand-intro-story-cta"
                className="inline-flex items-center gap-2 min-h-11 text-sm font-semibold tracking-wider uppercase text-[#87380F] hover:text-[#662707] transition-colors group cursor-pointer">
                      <span>Read our full family story</span>
                      <ArrowRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3 — SHOP OUR FAVOURITES
      ========================================================================= */}
      <section className="py-16 md:py-24 bg-[#F7EFE1] border-b border-[#EBD9BC]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal animation="fade-up">
            <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
              <span className="text-xs uppercase tracking-widest font-sans font-semibold text-[#87380F]">
                KITCHEN STAPLES
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#483828]">
                THE FLAVOURS EVERY KITCHEN LOVES
              </h2>
              <p className="text-sm sm:text-base text-[#483828]/80 font-sans">
                Discover our most-loved traditional spice blends, carefully roasted and balanced for daily meals.
              </p>
            </div>
          </ScrollReveal>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {favouriteProducts.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>

          <ScrollReveal animation="fade-up" delay={0.1}>
            <div className="mt-12 text-center">
              <Link to="/shop"
                id="view-all-spices-btn"
                className="px-8 py-3.5 bg-[#87380F] hover:bg-[#662707] text-white rounded-md font-sans text-xs font-semibold tracking-widest uppercase transition-colors shadow-sm inline-flex items-center gap-2 cursor-pointer">
                <span>EXPLORE ALL SPICE BLENDS</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4 — PRODUCT CATEGORY EXPLORATION
      ========================================================================= */}
      <section className="py-16 md:py-24 bg-[#FAF6F0] border-b border-[#EBD9BC]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal animation="fade-up">
            <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
              <span className="text-xs uppercase tracking-widest font-sans font-semibold text-[#87380F]">
                HANDCRAFTED COLLECTIONS
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#483828]">
                EXPLORE THE TASTE OF HOME
              </h2>
              <p className="text-sm text-[#483828]/80">
                Four thoughtfully curated collections to complete your South Indian spice cabinet.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Category 1: Classics */}
            <ScrollReveal animation="fade-up" delay={0.05}>
              <Link to="/shop"
                className="group relative rounded-xl overflow-hidden shadow-sm border border-[#EBD9BC] bg-white cursor-pointer hover:shadow-md transition-all duration-300 flex flex-col h-full">
                <div className="aspect-[4/3] overflow-hidden bg-[#F3E7D0]">
                  <img
                    src={sambarPackImg}
                    alt="South Indian Classics - S V Home Products Sambar and Rasam Powders"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#483828] group-hover:text-[#87380F] transition-colors">
                      SOUTH INDIAN CLASSICS
                    </h3>
                    <ul className="mt-2 space-y-1 text-xs text-[#483828]/75 font-sans">
                      <li>• Rasam Powder</li>
                      <li>• Sambar Powder</li>
                      <li>• Puliyogare Powder</li>
                    </ul>
                  </div>
                  <div className="pt-4 mt-2 border-t border-[#EBD9BC]/50 flex items-center justify-between text-xs font-semibold text-[#87380F]">
                    <span>Explore Classics</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            </ScrollReveal>

            {/* Category 2: Pure Spice Powders */}
            <ScrollReveal animation="fade-up" delay={0.1}>
              <Link to="/shop"
                className="group relative rounded-xl overflow-hidden shadow-sm border border-[#EBD9BC] bg-white cursor-pointer hover:shadow-md transition-all duration-300 flex flex-col h-full">
                <div className="aspect-[4/3] overflow-hidden bg-[#F3E7D0]">
                  <img
                    src={byadagiChilliPackImg}
                    alt="Spice Powders - S V Byadagi Chilli Powder and Whole Spices"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#483828] group-hover:text-[#87380F] transition-colors">
                      SPICE POWDERS
                    </h3>
                    <ul className="mt-2 space-y-1 text-xs text-[#483828]/75 font-sans">
                      <li>• Byadagi Chilli Powder</li>
                      <li>• Roasted Coriander Powder</li>
                      <li>• Stone-Milled Cumin Powder</li>
                      <li>• Pure Turmeric Powder</li>
                    </ul>
                  </div>
                  <div className="pt-4 mt-2 border-t border-[#EBD9BC]/50 flex items-center justify-between text-xs font-semibold text-[#87380F]">
                    <span>Explore Spices</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            </ScrollReveal>

            {/* Category 3: Chutney & Podi */}
            <ScrollReveal animation="fade-up" delay={0.15}>
              <Link to="/shop"
                className="group relative rounded-xl overflow-hidden shadow-sm border border-[#EBD9BC] bg-white cursor-pointer hover:shadow-md transition-all duration-300 flex flex-col h-full">
                <div className="aspect-[4/3] overflow-hidden bg-[#F3E7D0]">
                  <img
                    src={chutneyPudiPackImg}
                    alt="Chutney and Podi - S V Gunpowder and Chutney Pudi"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#483828] group-hover:text-[#87380F] transition-colors">
                      CHUTNEY & PODI
                    </h3>
                    <ul className="mt-2 space-y-1 text-xs text-[#483828]/75 font-sans">
                      <li>• Idli Gunpowder Podi</li>
                      <li>• Curry Leaf Chutney Podi</li>
                      <li>• Traditional Sesame Podi</li>
                    </ul>
                  </div>
                  <div className="pt-4 mt-2 border-t border-[#EBD9BC]/50 flex items-center justify-between text-xs font-semibold text-[#87380F]">
                    <span>Explore Podis</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            </ScrollReveal>

            {/* Category 4: Combo Collections */}
            <ScrollReveal animation="fade-up" delay={0.2}>
              <Link to="/shop"
                className="group relative rounded-xl overflow-hidden shadow-sm border border-[#EBD9BC] bg-white cursor-pointer hover:shadow-md transition-all duration-300 flex flex-col h-full">
                <div className="aspect-[4/3] overflow-hidden bg-[#F3E7D0]">
                  <img
                    src={comboTrioPackImg}
                    alt="Combo Collections - S V Traditional Kitchen Trio Gift Pack"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#483828] group-hover:text-[#87380F] transition-colors">
                      COMBO COLLECTIONS
                    </h3>
                    <ul className="mt-2 space-y-1 text-xs text-[#483828]/75 font-sans">
                      <li>• Family Essentials Pack</li>
                      <li>• Festive Combination Box</li>
                      <li>• South Indian Kitchen Trio</li>
                    </ul>
                  </div>
                  <div className="pt-4 mt-2 border-t border-[#EBD9BC]/50 flex items-center justify-between text-xs font-semibold text-[#87380F]">
                    <span>Explore Combos</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5 — WHY S V HOME PRODUCTS
      ========================================================================= */}
      <section className="py-16 md:py-24 bg-[#F7EFE1] border-b border-[#EBD9BC]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal animation="fade-up">
            <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
              <span className="text-xs uppercase tracking-widest font-sans font-semibold text-[#87380F]">
                OUR COMMITMENT TO QUALITY
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#483828]">
                WHAT MAKES OUR FLAVOURS SPECIAL?
              </h2>
              <p className="text-sm text-[#483828]/75">
                Handcrafted in the spirit of a traditional South Indian home.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 01 */}
            <ScrollReveal animation="fade-up" delay={0.05}>
              <div className="bg-[#FAF6F0] p-6 rounded-xl border border-[#EBD9BC] relative group hover:border-[#B69A55] transition-colors h-full">
                <span className="font-serif text-3xl font-bold text-[#87380F]/30 block mb-2">01</span>
                <div className="w-12 h-12 rounded-full bg-[#EBD9BC]/60 text-[#87380F] flex items-center justify-center mb-4">
                  <ChefHat size={24} />
                </div>
                <h3 className="font-serif text-lg font-bold text-[#483828] mb-1">
                  TRADITIONAL RECIPES
                </h3>
                <p className="text-xs text-[#483828]/80 leading-relaxed font-sans">
                  Inspired by authentic South Indian kitchens and time-tested ratios that celebrate natural taste.
                </p>
              </div>
            </ScrollReveal>

            {/* Feature 02 */}
            <ScrollReveal animation="fade-up" delay={0.1}>
              <div className="bg-[#FAF6F0] p-6 rounded-xl border border-[#EBD9BC] relative group hover:border-[#B69A55] transition-colors h-full">
                <span className="font-serif text-3xl font-bold text-[#87380F]/30 block mb-2">02</span>
                <div className="w-12 h-12 rounded-full bg-[#EBD9BC]/60 text-[#87380F] flex items-center justify-center mb-4">
                  <Wheat size={24} />
                </div>
                <h3 className="font-serif text-lg font-bold text-[#483828] mb-1">
                  CAREFULLY SELECTED SPICES
                </h3>
                <p className="text-xs text-[#483828]/80 leading-relaxed font-sans">
                  Quality ingredients chosen for aroma, natural essential oils, and unadulterated purity.
                </p>
              </div>
            </ScrollReveal>

            {/* Feature 03 */}
            <ScrollReveal animation="fade-up" delay={0.15}>
              <div className="bg-[#FAF6F0] p-6 rounded-xl border border-[#EBD9BC] relative group hover:border-[#B69A55] transition-colors h-full">
                <span className="font-serif text-3xl font-bold text-[#87380F]/30 block mb-2">03</span>
                <div className="w-12 h-12 rounded-full bg-[#EBD9BC]/60 text-[#87380F] flex items-center justify-center mb-4">
                  <Flame size={24} />
                </div>
                <h3 className="font-serif text-lg font-bold text-[#483828] mb-1">
                  FRESHLY PREPARED
                </h3>
                <p className="text-xs text-[#483828]/80 leading-relaxed font-sans">
                  Made in mindful small batches with meticulous attention to slow roasting and uniform consistency.
                </p>
              </div>
            </ScrollReveal>

            {/* Feature 04 */}
            <ScrollReveal animation="fade-up" delay={0.2}>
              <div className="bg-[#FAF6F0] p-6 rounded-xl border border-[#EBD9BC] relative group hover:border-[#B69A55] transition-colors h-full">
                <span className="font-serif text-3xl font-bold text-[#87380F]/30 block mb-2">04</span>
                <div className="w-12 h-12 rounded-full bg-[#EBD9BC]/60 text-[#87380F] flex items-center justify-center mb-4">
                  <Leaf size={24} />
                </div>
                <h3 className="font-serif text-lg font-bold text-[#483828] mb-1">
                  THE TASTE OF HOME
                </h3>
                <p className="text-xs text-[#483828]/80 leading-relaxed font-sans">
                  Comforting flavours created for everyday family meals, free from synthetic colors or preservatives.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 6 — INGREDIENT STORY ("THE SPICES BEHIND THE FLAVOUR")
      ========================================================================= */}
      <section className="py-16 md:py-24 bg-[#FAF6F0] border-b border-[#EBD9BC]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal animation="fade-up">
            <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
              <span className="text-xs uppercase tracking-widest font-sans font-semibold text-[#87380F]">
                BOTANICAL HARVEST
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#483828]">
                THE SPICES BEHIND THE FLAVOUR
              </h2>
              <p className="text-sm text-[#483828]/80 font-sans">
                Each whole spice is inspected, sun-warmed, and roasted to its precise temperature.
              </p>
            </div>
          </ScrollReveal>

          {/* 8 Botanical Ingredient Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {INGREDIENTS_STORY.map((item, idx) => (
              <ScrollReveal key={item.id} animation="fade-up" delay={Math.min(idx * 0.05, 0.3)}>
                <div className="bg-white rounded-xl p-5 border border-[#EBD9BC] hover:border-[#B69A55] transition-all hover:shadow-sm flex flex-col justify-between relative overflow-hidden group h-full">
                  {/* Subtle gold decorative top bar */}
                  <div className="h-1 bg-[#B69A55]/30 group-hover:bg-[#87380F] transition-colors -mx-5 -mt-5 mb-4" />

                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-serif text-lg font-bold text-[#483828]">
                          {item.name}
                        </h3>
                        <p className="text-xs text-gold-ink font-serif font-medium">
                          {item.regionalName}
                        </p>
                      </div>
                      <span className="text-[9px] font-sans italic text-[#483828]/60 bg-[#FAF6F0] px-2 py-0.5 rounded border border-[#EBD9BC]">
                        {item.botanicalName}
                      </span>
                    </div>

                    <p className="text-[11px] font-semibold text-[#87380F] uppercase tracking-wider mb-2 font-sans">
                      {item.role}
                    </p>

                    <p className="text-xs text-[#483828]/75 leading-relaxed font-sans mb-3">
                      {item.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#EBD9BC]/50 text-[11px] text-[#647044] font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#647044]"></span>
                    <span>{item.flavorNote}</span>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 7 — SIGNATURE PRODUCT FEATURE (Rasam Powder)
          Terracotta background with cream typography
      ========================================================================= */}
      {rasamProduct && (
      <section className="py-16 md:py-24 bg-[#87380F] text-[#FAF6F0] relative overflow-hidden">
        {/* Subtle decorative background ring */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full border-8 border-white/5 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Left: Product Image */}
            <div className="lg:col-span-6">
              <ScrollReveal animation="slide-right">
                <div className="relative max-w-md mx-auto">
                  <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border-4 border-[#FAF6F0]/20 bg-[#483828]">
                    <img
                      src={rasamProduct?.image}
                      alt="S V Home Products Authentic Rasam Powder"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Floating badge */}
                  <div className="absolute -bottom-4 -left-4 bg-[#483828] text-[#F3E7D0] p-4 rounded-xl border border-[#B69A55]/40 shadow-xl">
                    <span className="text-[10px] uppercase tracking-widest font-sans text-gold-on-dark font-bold">
                      HERITAGE BLEND
                    </span>
                    <p className="font-serif text-sm font-bold">100g • 250g • 500g</p>
                  </div>
                </div>
              </ScrollReveal>
            </div>

            {/* Right: Copy & Features */}
            <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
              <ScrollReveal animation="slide-left">
                <div className="space-y-6">
                  <div className="inline-block text-xs uppercase tracking-widest font-sans font-semibold text-gold-on-dark border-b border-[#B69A55] pb-1">
                    SIGNATURE CREATION
                  </div>

                  <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight text-[#FAF6F0]">
                    THE COMFORT OF A<br />
                    <span className="italic font-normal text-[#EBD9BC]">PERFECT RASAM</span>
                  </h2>

                  <p className="text-base sm:text-lg text-[#EBD9BC]/90 font-sans leading-relaxed">
                    “Rasam is more than a dish. It is warmth, comfort and the familiar aroma of home.”
                  </p>

                  <div className="space-y-3 text-xs sm:text-sm text-[#FAF6F0]/80 font-sans">
                    <div className="flex items-center gap-2 justify-center lg:justify-start">
                      <CheckCircle2 size={16} className="text-gold-ink" />
                      <span>Slow-roasted coriander seeds & Byadagi chillies for vibrant color</span>
                    </div>
                    <div className="flex items-center gap-2 justify-center lg:justify-start">
                      <CheckCircle2 size={16} className="text-gold-ink" />
                      <span>Tellicherry black pepper for throat-soothing digestive clarity</span>
                    </div>
                    <div className="flex items-center gap-2 justify-center lg:justify-start">
                      <CheckCircle2 size={16} className="text-gold-ink" />
                      <span>Serving suggestion: Simmer with ripe tomatoes, finish with ghee tadka</span>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                    <Link
                      to="/product/rasam-powder"
                      id="signature-shop-rasam-btn"
                      className="px-8 py-3.5 bg-[#FAF6F0] hover:bg-[#EBD9BC] text-[#87380F] rounded-md font-sans text-xs font-bold tracking-widest uppercase transition-colors shadow-lg"
                    >
                      SHOP RASAM POWDER (FROM ₹110)
                    </Link>

                    <Link
                      to="/recipes/authentic-rasam"
                      id="signature-view-recipe-btn"
                      className="px-6 py-3.5 border border-[#FAF6F0]/50 hover:border-[#FAF6F0] text-[#FAF6F0] rounded-md font-sans text-xs font-semibold tracking-widest uppercase transition-colors"
                    >
                      VIEW RASAM RECIPE
                    </Link>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* =========================================================================
          SECTION 8 — HOW TO USE OUR PRODUCTS
      ========================================================================= */}
      <section className="py-16 md:py-24 bg-[#FAF6F0] border-b border-[#EBD9BC]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal animation="fade-up">
            <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
              <span className="text-xs uppercase tracking-widest font-sans font-semibold text-[#87380F]">
                EFFORTLESS HOME DINING
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#483828]">
                FROM POWDER TO PLATE
              </h2>
              <p className="text-sm text-[#483828]/75 font-sans">
                Example: How to prepare authentic temple-style Puliyogare in 3 easy steps.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 01 */}
            <ScrollReveal animation="fade-up" delay={0.05}>
              <div className="bg-[#F7EFE1] p-8 rounded-xl border border-[#EBD9BC] text-center relative flex flex-col items-center h-full">
                <div className="w-14 h-14 rounded-full bg-[#87380F] text-white flex items-center justify-center font-serif text-2xl font-bold mb-4 shadow-sm">
                  01
                </div>
                <h3 className="font-serif text-xl font-bold text-[#483828] mb-2">Cook Your Rice</h3>
                <p className="text-xs text-[#483828]/80 font-sans leading-relaxed">
                  Cook sona masoori or raw rice until grains are soft yet separate. Spread on a wide platter to cool.
                </p>
              </div>
            </ScrollReveal>

            {/* Step 02 */}
            <ScrollReveal animation="fade-up" delay={0.15}>
              <div className="bg-[#F7EFE1] p-8 rounded-xl border border-[#EBD9BC] text-center relative flex flex-col items-center h-full">
                <div className="w-14 h-14 rounded-full bg-[#87380F] text-white flex items-center justify-center font-serif text-2xl font-bold mb-4 shadow-sm">
                  02
                </div>
                <h3 className="font-serif text-xl font-bold text-[#483828] mb-2">Add Puliyogare Blend</h3>
                <p className="text-xs text-[#483828]/80 font-sans leading-relaxed">
                  Simmer tamarind paste, temper crunchy peanuts and mustard in sesame oil, and add 2 tbsp of S V Puliyogare Powder.
                </p>
              </div>
            </ScrollReveal>

            {/* Step 03 */}
            <ScrollReveal animation="fade-up" delay={0.25}>
              <div className="bg-[#F7EFE1] p-8 rounded-xl border border-[#EBD9BC] text-center relative flex flex-col items-center h-full">
                <div className="w-14 h-14 rounded-full bg-[#87380F] text-white flex items-center justify-center font-serif text-2xl font-bold mb-4 shadow-sm">
                  03
                </div>
                <h3 className="font-serif text-xl font-bold text-[#483828] mb-2">Mix, Serve & Enjoy</h3>
                <p className="text-xs text-[#483828]/80 font-sans leading-relaxed">
                  Toss gently with cooled rice, allow flavours to marry for 30 minutes, and relish authentic temple taste!
                </p>
              </div>
            </ScrollReveal>
          </div>

          <ScrollReveal animation="fade-up" delay={0.1}>
            <div className="mt-12 text-center">
              <Link to="/recipes"
                id="how-to-use-recipes-cta"
                className="px-8 py-3.5 bg-[#483828] hover:bg-[#87380F] text-white rounded-md font-sans text-xs font-semibold tracking-widest uppercase transition-colors inline-flex items-center gap-2 cursor-pointer shadow-sm">
                <span>EXPLORE ALL RECIPES</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* =========================================================================
          SECTION 9 — OUR HERITAGE CRAFT & THE S V DIFFERENCE
      ========================================================================= */}
      <section className="py-16 md:py-24 bg-[#F7EFE1] border-b border-[#EBD9BC]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Header */}
          <ScrollReveal animation="fade-up">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <span className="text-xs uppercase tracking-widest font-sans font-semibold text-[#87380F]">
                  TRADITIONAL ROASTING & STONE MILLING
                </span>
                <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#483828]">
                  THE ART OF SLOW-ROASTED PURITY
                </h2>
                <p className="text-sm text-[#483828]/80 font-sans leading-relaxed">
                  Factory brands use high-speed blade pulverizers that overheat and scorch natural aromatic oils. At S V Home Products, we stay faithful to our family’s centuries-old roasting and slow-milling tradition.
                </p>
              </div>

              <Link to="/shop"
                id="heritage-craft-shop-cta"
                className="px-6 py-3 bg-[#87380F] hover:bg-[#662707] text-white text-xs font-semibold tracking-widest uppercase rounded shadow-sm flex items-center gap-2 self-start md:self-auto cursor-pointer transition-colors">
                <span>EXPLORE ALL BLENDS</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </ScrollReveal>

          {/* Editorial Visual Feature Banner */}
          <ScrollReveal animation="fade-up" delay={0.1}>
            <div className="relative rounded-2xl overflow-hidden border border-[#EBD9BC] shadow-lg bg-[#483828]">
              <div className="aspect-[21/9] sm:aspect-[2.4/1] w-full relative">
                <img
                  src={traditionalCraftImg}
                  alt="Traditional Indian spice roasting in cast iron kadai with brass vessels"
                  className="w-full h-full object-cover object-center"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#483828]/90 via-[#483828]/35 to-transparent" />
              </div>

              {/* Floating Banner Details */}
              <div className="absolute bottom-4 sm:bottom-8 left-4 sm:left-8 right-4 sm:right-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 text-white">
                <div className="space-y-1 max-w-xl">
                  <span className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold text-gold-on-dark">
                    THE GRANDMOTHER'S STANDARD
                  </span>
                  <h3 className="font-serif text-xl sm:text-2xl lg:text-3xl font-bold text-[#FAF6F0]">
                    Gently Roasted in Heavy Cast-Iron Kadai
                  </h3>
                  <p className="text-xs sm:text-sm text-[#FAF6F0]/85 font-sans hidden sm:block">
                    Each spice has a precise flame threshold. Slow roasting coaxes out delicate volatile oils without burning or bitterness.
                  </p>
                </div>

                <div className="bg-[#FAF6F0]/95 text-[#483828] backdrop-blur-xs px-4 py-2.5 rounded-xl border border-[#B69A55]/40 text-xs font-sans font-semibold flex items-center gap-2 shadow-md">
                  <Sparkles size={16} className="text-[#87380F]" />
                  <span>Zero Starch • Zero Additives</span>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* 4-Step Craftsmanship Journey */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <ScrollReveal animation="fade-up" delay={0.05}>
              <div className="bg-white p-6 rounded-xl border border-[#EBD9BC] shadow-xs space-y-3 hover:border-[#B69A55] transition-colors h-full">
                <div className="w-10 h-10 rounded-full bg-[#87380F]/10 text-[#87380F] flex items-center justify-center">
                  <Sun size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#87380F] uppercase tracking-wider block">STAGE 01</span>
                  <h4 className="font-serif font-bold text-base text-[#483828]">Sun-Dried & Hand-Sorted</h4>
                </div>
                <p className="text-xs text-[#483828]/75 leading-relaxed font-sans">
                  Single-origin Byadagi chillies and Tellicherry pepper are thoroughly hand-cleaned to discard dust, stems, and impurities.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal animation="fade-up" delay={0.1}>
              <div className="bg-white p-6 rounded-xl border border-[#EBD9BC] shadow-xs space-y-3 hover:border-[#B69A55] transition-colors h-full">
                <div className="w-10 h-10 rounded-full bg-[#87380F]/10 text-[#87380F] flex items-center justify-center">
                  <Flame size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#87380F] uppercase tracking-wider block">STAGE 02</span>
                  <h4 className="font-serif font-bold text-base text-[#483828]">Low-Flame Kadai Roasting</h4>
                </div>
                <p className="text-xs text-[#483828]/75 leading-relaxed font-sans">
                  Each spice is roasted separately in seasoned iron vessels until aromatic oils pop, developing deep comforting flavour.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal animation="fade-up" delay={0.15}>
              <div className="bg-white p-6 rounded-xl border border-[#EBD9BC] shadow-xs space-y-3 hover:border-[#B69A55] transition-colors h-full">
                <div className="w-10 h-10 rounded-full bg-[#87380F]/10 text-[#87380F] flex items-center justify-center">
                  <Layers size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#87380F] uppercase tracking-wider block">STAGE 03</span>
                  <h4 className="font-serif font-bold text-base text-[#483828]">Slow Ambient Milling</h4>
                </div>
                <p className="text-xs text-[#483828]/75 leading-relaxed font-sans">
                  Gently milled without overheating blades to retain authentic coarse South Indian texture and fragile volatile aromas.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal animation="fade-up" delay={0.2}>
              <div className="bg-white p-6 rounded-xl border border-[#EBD9BC] shadow-xs space-y-3 hover:border-[#B69A55] transition-colors h-full">
                <div className="w-10 h-10 rounded-full bg-[#647044]/15 text-[#647044] flex items-center justify-center">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#647044] uppercase tracking-wider block">STAGE 04</span>
                  <h4 className="font-serif font-bold text-base text-[#483828]">Aroma-Lock Kraft Pouches</h4>
                </div>
                <p className="text-xs text-[#483828]/75 leading-relaxed font-sans">
                  Immediately hand-weighed and packed in moisture-resistant ziplock barrier pouches so every pinch smells freshly ground.
                </p>
              </div>
            </ScrollReveal>
          </div>

          {/* Comparison Card: Industrial Brands vs S V Home Products */}
          <ScrollReveal animation="fade-up" delay={0.1}>
            <div className="bg-[#FAF6F0] rounded-2xl border border-[#EBD9BC] p-6 sm:p-10 shadow-xs">
              <div className="text-center max-w-xl mx-auto mb-8 space-y-2">
                <span className="text-xs uppercase tracking-widest font-sans font-semibold text-[#87380F]">
                  THE KITCHEN TEST
                </span>
                <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#483828]">
                  How We Compare to Mass Market Brands
                </h3>
                <p className="text-xs text-[#483828]/70">
                  Notice the difference in color, aroma, and lingering aftertaste in every preparation.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Industrial Brands */}
                <div className="bg-white/80 p-6 rounded-xl border border-red-200/80 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#EBD9BC] pb-3">
                    <span className="font-serif font-bold text-base text-[#483828]">Commercial Factory Spices</span>
                    <span className="text-[11px] font-bold text-red-700 bg-red-50 px-2.5 py-0.5 rounded">Mass Produced</span>
                  </div>
                  <ul className="space-y-3 text-xs text-[#483828]/80">
                    <li className="flex items-start gap-2.5">
                      <X size={15} className="text-red-500 shrink-0 mt-0.5" />
                      <span>Mixed with cheap fillers like rice flour, starch, or husk to increase volume.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <X size={15} className="text-red-500 shrink-0 mt-0.5" />
                      <span>High-speed industrial blades generate heat, evaporating delicate fragrant oils.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <X size={15} className="text-red-500 shrink-0 mt-0.5" />
                      <span>Artificial red colorants, extracts, or preservatives added for shelf longevity.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <X size={15} className="text-red-500 shrink-0 mt-0.5" />
                      <span>Sit in distributor warehouses for months before arriving on store shelves.</span>
                    </li>
                  </ul>
                </div>

                {/* S V Home Products */}
                <div className="bg-white p-6 rounded-xl border-2 border-[#B69A55] shadow-xs space-y-4 relative">
                  <div className="absolute -top-3 right-4 bg-[#87380F] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-xs">
                    S V Standard
                  </div>
                  <div className="flex items-center justify-between border-b border-[#EBD9BC] pb-3">
                    <span className="font-serif font-bold text-base text-[#87380F]">S V Home Products</span>
                    <span className="text-[11px] font-bold text-[#647044] bg-[#647044]/10 px-2.5 py-0.5 rounded">Handmade</span>
                  </div>
                  <ul className="space-y-3 text-xs text-[#483828]">
                    <li className="flex items-start gap-2.5">
                      <Check size={15} className="text-[#647044] shrink-0 mt-0.5 font-bold" />
                      <span><strong>100% Whole Native Spices:</strong> Never adulterated with flour, starch, or powders.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check size={15} className="text-[#647044] shrink-0 mt-0.5 font-bold" />
                      <span><strong>Low-Flame Cast Iron Roasting:</strong> Captures and locks in rich natural digestive aromas.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check size={15} className="text-[#647044] shrink-0 mt-0.5 font-bold" />
                      <span><strong>Natural Byadagi Ruby Red:</strong> Zero artificial dyes or chemicals; pure sun-dried harvest.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check size={15} className="text-[#647044] shrink-0 mt-0.5 font-bold" />
                      <span><strong>Fresh Weekly Micro-Batches:</strong> Roasted and packaged in small quantities for direct dispatch.</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Bottom Quick Action Strip */}
              <div className="mt-8 pt-6 border-t border-[#EBD9BC] flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                <div className="flex items-center gap-2 text-xs text-[#483828] font-medium">
                  <Award size={18} className="text-gold-ink" />
                  <span>Taste the difference in your very first meal or request a custom gift pack.</span>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={whatsappUrl("Namaste S V Home Products! I would like to know more about your fresh spice batches.")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-[#FAF6F0] hover:bg-[#EBD9BC] border border-[#EBD9BC] text-[#483828] text-xs font-semibold rounded flex items-center gap-1.5 transition-colors"
                  >
                    <Phone size={13} className="text-[#647044]" />
                    <span>WhatsApp Inquiry</span>
                  </a>
                  <Link to="/shop"
                className="px-5 py-2 bg-[#87380F] hover:bg-[#662707] text-white text-xs font-bold uppercase tracking-wider rounded transition-colors cursor-pointer">
                    Shop Now
                  </Link>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* =========================================================================
          SECTION 10 — CUSTOMER REVIEWS
      ========================================================================= */}
      <section className="py-16 md:py-24 bg-[#FAF6F0] border-b border-[#EBD9BC]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal animation="fade-up">
            <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
              <span className="text-xs uppercase tracking-widest font-sans font-semibold text-[#87380F]">
                KITCHEN MEMORIES
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#483828]">
                LOVED IN HOME KITCHENS
              </h2>
              <p className="text-sm text-[#483828]/75">
                Honest reflections from South Indian families who trust our homemade powders.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {CLIENT_REVIEWS.map((rev, idx) => (
              <ScrollReveal key={rev.id} animation="fade-up" delay={idx * 0.05}>
                <div
                  className="bg-[#F7EFE1] p-6 rounded-xl border border-[#EBD9BC] flex flex-col justify-between h-full"
                >
                  <div>
                    <div className="flex items-center gap-1 text-gold-ink mb-3">
                      {[...Array(rev.rating)].map((_, i) => (
                        <Star key={i} size={14} className="fill-[#7E6420]" />
                      ))}
                    </div>
                    <p className="font-serif italic text-sm text-[#483828] leading-relaxed mb-4">
                      “{rev.comment}”
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#EBD9BC]/60">
                    <h3 className="font-sans text-xs font-bold text-[#483828]">{rev.name}</h3>
                    <span className="text-[10px] text-[#483828]/60 block">{rev.location}</span>
                    <span className="text-[9px] text-[#647044] font-medium block mt-1">
                      Verified: {rev.productPurchased}
                    </span>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <div className="mt-8 text-center text-xs text-[#483828]/60 italic">
            * Selected customer feedback. Client can easily update with new verified kitchen reviews.
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 11 — NEWSLETTER
      ========================================================================= */}
      <section className="py-16 md:py-20 bg-[#FAF6F0]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <ScrollReveal animation="fade-up">
            <div className="space-y-6">
              <span className="text-xs uppercase tracking-widest font-sans font-semibold text-[#87380F]">
                FAMILY KITCHEN CLUB
              </span>

              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#483828]">
                BRING MORE FLAVOUR HOME
              </h2>

              <p className="text-sm sm:text-base text-[#483828]/80 font-sans max-w-lg mx-auto">
                Sign up for traditional recipes, festive spice offers, and new seasonal small-batch releases.
              </p>

              {newsletterSubscribed ? (
                <div className="p-4 bg-[#647044]/15 border border-[#647044]/30 rounded-lg text-sm text-[#647044] font-semibold">
                  ✓ Welcome to our family kitchen! Check your inbox soon for authentic recipe secrets.
                </div>
              ) : (
                <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-2.5 max-w-md mx-auto">
                  <input
                    type="email"
                    required
                    aria-label="Email address for recipe newsletter"
                    placeholder="Enter your email address"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    className="flex-1 bg-white border border-[#EBD9BC] rounded-md px-4 py-3 text-sm text-[#483828] placeholder-[#483828]/50 focus:outline-none focus:border-[#87380F]"
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-[#87380F] hover:bg-[#662707] text-white rounded-md text-xs font-semibold tracking-widest uppercase transition-colors cursor-pointer shrink-0"
                  >
                    SUBSCRIBE
                  </button>
                </form>
              )}

              <p className="text-[11px] text-[#483828]/60">
                We respect your privacy. No spam — only traditional South Indian food goodness.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
};
