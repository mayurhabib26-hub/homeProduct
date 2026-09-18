import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { POLICIES, policyBySlug } from '../content/policies';
import { fillPolicyText, FSSAI_LICENCE, SELLER_LEGAL_NAME } from '../lib/contact';

/**
 * Policy pages, required before launch by the Consumer Protection
 * (E-Commerce) Rules — and by Razorpay's KYC, which needs a live refund
 * policy URL. See docs/COMPLIANCE.md §5.
 */
export const PolicyPage: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const policy = policyBySlug(slug);

  if (!policy) return <Navigate to="/policies/terms" replace />;

  return (
    <div className="bg-[#FAF6F0] min-h-screen py-12 md:py-16 font-sans">
      <div className="max-w-3xl mx-auto px-4">
        <nav className="flex flex-wrap gap-1.5 mb-8" aria-label="Policies">
          {POLICIES.map((p) => (
            <Link
              key={p.slug}
              to={`/policies/${p.slug}`}
              aria-current={p.slug === slug ? 'page' : undefined}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                p.slug === slug
                  ? 'bg-[#87380F] text-white'
                  : 'bg-white border border-[#EBD9BC] text-[#483828] hover:bg-[#F3E7D0]/50'
              }`}
            >
              {p.title}
            </Link>
          ))}
        </nav>

        <article className="bg-white border border-[#EBD9BC] rounded-xl p-6 sm:p-10">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#483828]">{policy.title}</h1>
          <p className="text-sm text-[#483828]/70 mt-2">{policy.summary}</p>

          <div className="mt-8 space-y-7">
            {policy.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="font-serif text-lg font-bold text-[#483828]">{section.heading}</h2>
                {section.body.map((paragraph, i) => (
                  <p key={i} className="text-sm text-[#483828]/80 leading-relaxed mt-2">
                    {fillPolicyText(paragraph)}
                  </p>
                ))}
              </section>
            ))}
          </div>

          <footer className="mt-10 pt-6 border-t border-[#EBD9BC] text-xs text-[#483828]/60 space-y-1">
            <p>{SELLER_LEGAL_NAME}</p>
            <p>FSSAI Licence: {FSSAI_LICENCE}</p>
          </footer>
        </article>
      </div>
    </div>
  );
};
