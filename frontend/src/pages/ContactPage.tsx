import React, { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { Phone, Mail, MapPin, Clock, Send, ChevronDown, CheckCircle2, MessageSquare } from 'lucide-react';
import { ScrollReveal } from '../components/ScrollReveal';

export const ContactPage: React.FC = () => {
  const { showToast } = useShop();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'Order Inquiry',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.message) {
      showToast('Please fill all required fields');
      return;
    }
    setSubmitted(true);
    showToast('Your message has been sent to our family kitchen!');
  };

  const faqs = [
    {
      q: 'How long do S V Home Products spice powders stay fresh?',
      a: 'Because our spices are slowly roasted on iron kadais to remove residual moisture and milled fresh, they maintain peak aroma and flavor for 6 to 9 months when stored in an airtight jar away from direct sunlight.',
    },
    {
      q: 'Do you add any preservatives, artificial colors, or MSG?',
      a: 'Never. Our core philosophy is pure homemade food. We use 100% whole natural spices. The vibrant deep red in our Rasam and Sambar powders comes solely from authentic Byadagi and Guntur chillies.',
    },
    {
      q: 'How long does shipping take across India?',
      a: 'We dispatch all packages within 24-48 hours. Metro cities (Bengaluru, Chennai, Hyderabad, Mumbai, Delhi) typically receive delivery in 2-3 business days. Other regions take 4-6 business days.',
    },
    {
      q: 'Can I place bulk orders for weddings, return gifts, or festivals?',
      a: 'Yes! We frequently customize traditional spice powder sets in festive packaging for weddings, housewarmings, and festive occasions. Contact us on WhatsApp for custom quantity pricing.',
    },
    {
      q: 'Can I order directly on WhatsApp without paying on the website?',
      a: 'Yes, absolutely. We welcome WhatsApp orders! You can click any "Order on WhatsApp" button, confirm your list with us, and pay via direct UPI or Cash on Delivery.',
    },
  ];

  return (
    <div className="bg-[#FAF6F0] min-h-screen py-10 md:py-16 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <ScrollReveal animation="fade-up">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-3">
            <span className="text-xs uppercase tracking-widest font-sans font-semibold text-[#87380F]">
              GET IN TOUCH
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#483828]">
              WE’D LOVE TO HEAR FROM YOU
            </h1>
            <p className="text-sm sm:text-base text-[#483828]/80 leading-relaxed font-sans">
              Questions about our spices, custom quantity orders, or traditional recipes? Reach out to our family kitchen directly.
            </p>
          </div>
        </ScrollReveal>

        {/* Contact Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-16">
          {/* Left: Contact Info & WhatsApp CTA */}
          <div className="lg:col-span-5 space-y-6">
            <ScrollReveal animation="slide-right">
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EBD9BC] shadow-xs space-y-6">
                <h3 className="font-serif text-2xl font-bold text-[#483828]">
                  Kitchen & Workshop
                </h3>

                <div className="space-y-4 text-xs sm:text-sm text-[#483828]/85">
                  <div className="flex items-start gap-3">
                    <MapPin size={18} className="text-[#87380F] shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-[#483828] font-semibold">Address</strong>
                      <span>S V Home Products, Traditional Spice House,<br />Bengaluru, Karnataka 560004, India</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone size={18} className="text-[#87380F] shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-[#483828] font-semibold">Phone / WhatsApp</strong>
                      <a href="tel:+919876543210" className="hover:text-[#87380F] transition-colors">
                        +91 98765 43210
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail size={18} className="text-[#87380F] shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-[#483828] font-semibold">Email</strong>
                      <a href="mailto:care@svhomeproducts.in" className="hover:text-[#87380F] transition-colors">
                        care@svhomeproducts.in
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock size={18} className="text-[#87380F] shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-[#483828] font-semibold">Customer Support Hours</strong>
                      <span>Monday to Saturday: 9:00 AM – 7:00 PM IST</span>
                    </div>
                  </div>
                </div>

                {/* Direct WhatsApp Callout */}
                <div className="pt-4 border-t border-[#EBD9BC]">
                  <div className="bg-[#F7EFE1] p-4 rounded-xl border border-[#EBD9BC] space-y-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-[#87380F] block">
                      FASTEST RESPONSE
                    </span>
                    <p className="text-xs text-[#483828]/80">
                      Prefer speaking to us directly? We assist orders and recipe advice on WhatsApp.
                    </p>
                    <a
                      href="https://wa.me/919876543210?text=Namaste%20S%20V%20Home%20Products!%20I%20have%20an%20inquiry."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#647044] hover:bg-[#4d5733] text-white text-xs font-semibold rounded transition-colors mt-1"
                    >
                      <MessageSquare size={14} />
                      <span>Chat on WhatsApp</span>
                    </a>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* Right: Interactive Contact Form */}
          <div className="lg:col-span-7">
            <ScrollReveal animation="slide-left">
              <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#EBD9BC] shadow-xs">
                <h3 className="font-serif text-2xl font-bold text-[#483828] mb-2">
                  Send Us a Note
                </h3>
                <p className="text-xs text-[#483828]/70 mb-6">
                  Fill in the details below and someone from our family kitchen will reply within 24 hours.
                </p>

                {submitted ? (
                  <div className="p-8 text-center space-y-3 bg-[#F7EFE1] rounded-xl border border-[#EBD9BC]">
                    <CheckCircle2 size={36} className="text-[#647044] mx-auto" />
                    <h4 className="font-serif text-xl font-bold text-[#483828]">
                      Thank You for Contacting Us!
                    </h4>
                    <p className="text-xs text-[#483828]/80 max-w-sm mx-auto">
                      We have received your message and will reach out to you promptly at {formData.phone || formData.email}.
                    </p>
                    <button
                      onClick={() => {
                        setSubmitted(false);
                        setFormData({ name: '', email: '', phone: '', subject: 'Order Inquiry', message: '' });
                      }}
                      className="mt-4 text-xs font-semibold text-[#87380F] hover:underline cursor-pointer"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-[#483828] mb-1">
                          Your Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g. Ramesh Kumar"
                          className="w-full bg-[#FAF6F0] border border-[#EBD9BC] rounded-md px-3.5 py-2.5 text-[#483828] focus:outline-none focus:border-[#87380F]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-[#483828] mb-1">
                          Phone / WhatsApp Number *
                        </label>
                        <input
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="+91 98765 43210"
                          className="w-full bg-[#FAF6F0] border border-[#EBD9BC] rounded-md px-3.5 py-2.5 text-[#483828] focus:outline-none focus:border-[#87380F]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-[#483828] mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="name@example.com"
                          className="w-full bg-[#FAF6F0] border border-[#EBD9BC] rounded-md px-3.5 py-2.5 text-[#483828] focus:outline-none focus:border-[#87380F]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-[#483828] mb-1">
                          Subject
                        </label>
                        <select
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          className="w-full bg-[#FAF6F0] border border-[#EBD9BC] rounded-md px-3.5 py-2.5 text-[#483828] focus:outline-none focus:border-[#87380F]"
                        >
                          <option value="Order Inquiry">Order Inquiry / Tracking</option>
                          <option value="Bulk Order">Bulk / Festive Wedding Order</option>
                          <option value="Recipe Advice">Traditional Recipe Advice</option>
                          <option value="Feedback">Product Feedback</option>
                          <option value="Other">Other Query</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#483828] mb-1">
                        Your Message *
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder="Tell us about the spice blend or question you have in mind..."
                        className="w-full bg-[#FAF6F0] border border-[#EBD9BC] rounded-md px-3.5 py-2.5 text-[#483828] focus:outline-none focus:border-[#87380F]"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-[#87380F] hover:bg-[#662707] text-white font-sans text-xs font-bold tracking-widest uppercase rounded-md transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                    >
                      <Send size={14} />
                      <span>SEND MESSAGE</span>
                    </button>
                  </form>
                )}
              </div>
            </ScrollReveal>
          </div>
        </div>

        {/* FAQ Accordion Section */}
        <div className="max-w-4xl mx-auto pt-8">
          <ScrollReveal animation="fade-up">
            <div className="text-center mb-8 space-y-2">
              <span className="text-xs uppercase tracking-widest font-sans font-semibold text-[#87380F]">
                KITCHEN INQUIRIES
              </span>
              <h2 className="font-serif text-3xl font-bold text-[#483828]">
                Frequently Asked Questions
              </h2>
            </div>
          </ScrollReveal>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <ScrollReveal key={idx} animation="fade-up" delay={Math.min(idx * 0.05, 0.2)}>
                <div
                  className="bg-white rounded-xl border border-[#EBD9BC] overflow-hidden shadow-2xs"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full p-4 sm:p-5 text-left flex justify-between items-center gap-4 transition-colors hover:bg-[#FAF6F0] cursor-pointer"
                  >
                    <span className="font-serif text-base sm:text-lg font-bold text-[#483828]">
                      {faq.q}
                    </span>
                    <ChevronDown
                      size={18}
                      className={`text-[#87380F] transition-transform duration-300 shrink-0 ${
                        openFaq === idx ? 'transform rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openFaq === idx && (
                    <div className="px-4 sm:px-5 pb-5 pt-1 text-xs sm:text-sm text-[#483828]/80 font-sans leading-relaxed border-t border-[#EBD9BC]/50 bg-[#FAF6F0]/40">
                      {faq.a}
                    </div>
                  )}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
