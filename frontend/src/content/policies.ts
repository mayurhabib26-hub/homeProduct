/**
 * Policy page content.
 *
 * ────────────────────────────────────────────────────────────────────────
 * THESE ARE DRAFTS. A lawyer must review them before launch.
 *
 * They are written to be accurate to how this system actually behaves — the
 * refund window matches the refund code, the data list matches what the
 * database stores — so a reviewer is correcting law, not fiction. Values in
 * {{BRACES}} come from configuration and must be filled before publishing.
 * See docs/COMPLIANCE.md §5.
 * ────────────────────────────────────────────────────────────────────────
 */

export interface PolicySection {
  heading: string;
  body: string[];
}

export interface Policy {
  slug: string;
  title: string;
  summary: string;
  sections: PolicySection[];
}

const BUSINESS = '{{SELLER_LEGAL_NAME}}';
const ADDRESS = '{{SELLER_ADDRESS}}';
const EMAIL = '{{GRIEVANCE_EMAIL}}';
const OFFICER = '{{GRIEVANCE_OFFICER}}';

export const POLICIES: Policy[] = [
  {
    slug: 'shipping',
    title: 'Shipping Policy',
    summary: 'Where we deliver, how long it takes, and what it costs.',
    sections: [
      {
        heading: 'Where we deliver',
        body: [
          `${BUSINESS} ships across India through third-party courier partners. Serviceability is checked against your pincode at checkout; if your pincode cannot be served, you will be told before you pay.`,
        ],
      },
      {
        heading: 'Charges',
        body: [
          'Delivery is free on orders of ₹499 or more. Below that, a flat delivery charge of ₹60 applies.',
          'Cash on Delivery carries an additional handling charge of ₹30 and is available on orders up to ₹2,000. Above that, please choose an online payment method.',
          'All charges are shown in full before you pay. Nothing is added at the final step.',
        ],
      },
      {
        heading: 'Dispatch and delivery times',
        body: [
          'Orders are prepared in small batches and usually dispatched within 2–3 working days. Delivery typically takes a further 3–7 working days depending on your location.',
          'You will receive the courier name and tracking number by WhatsApp once your order is dispatched.',
        ],
      },
      {
        heading: 'Delays',
        body: [
          'Festival periods, weather and courier disruptions can delay delivery. If your order is significantly delayed, contact us and we will trace it with the courier.',
        ],
      },
    ],
  },

  {
    slug: 'refunds',
    title: 'Refund & Cancellation Policy',
    summary: 'When you can cancel, what we replace, and how long refunds take.',
    sections: [
      {
        heading: 'Cancellation',
        body: [
          'You may cancel an order at any time before it is dispatched, by contacting us with your order number. Prepaid orders are refunded in full.',
          'Once an order has been handed to the courier it cannot be cancelled, but see returns below.',
        ],
      },
      {
        heading: 'Food products and returns',
        body: [
          'Because these are packaged food products, we cannot accept returns simply because you changed your mind — an opened or unsealed food package cannot be resold.',
          'We will always replace or refund an item that arrives damaged, leaking, expired, or is not what you ordered. This is your right and nothing in this policy limits it.',
        ],
      },
      {
        heading: 'How to raise a claim',
        body: [
          `Contact us within 48 hours of delivery at ${EMAIL} with your order number and a photograph of the item and its packaging. A photograph lets us resolve most claims immediately and also helps us trace the batch.`,
        ],
      },
      {
        heading: 'Refund timelines',
        body: [
          'Approved refunds are returned to the original payment method and typically appear within 5–7 working days, depending on your bank.',
          'Cash on Delivery orders are refunded by bank transfer. We will ask for your account details only for this purpose.',
        ],
      },
    ],
  },

  {
    slug: 'privacy',
    title: 'Privacy Policy',
    summary: 'What we collect, why, how long we keep it, and your rights.',
    sections: [
      {
        heading: 'What we collect',
        body: [
          'To deliver your order we collect your name, phone number, delivery address and, optionally, your email address. If you choose to receive order updates on WhatsApp, we use the phone number you gave us.',
          'We do not collect or store your card, UPI or bank details. Payments are handled by our payment gateway, and those details never reach our servers.',
        ],
      },
      {
        heading: 'Why we collect it',
        body: [
          'Solely to process, deliver and support your order, and to meet our tax and record-keeping obligations. We do not sell your data and we do not share it except with the courier and payment partners who need it to complete your order.',
        ],
      },
      {
        heading: 'Marketing',
        body: [
          'We will only send you promotional messages if you separately opt in. That consent is never bundled with placing an order, and you can withdraw it at any time by replying STOP or contacting us.',
        ],
      },
      {
        heading: 'How long we keep it',
        body: [
          'Order and invoice records are retained for eight years, as required by GST law. You may ask us to erase your personal information at any time; where an order record must legally be retained, we anonymise it — your name, phone, email and address are removed and only the financial record remains.',
        ],
      },
      {
        heading: 'Your rights',
        body: [
          `Under the Digital Personal Data Protection Act, 2023 you may ask what we hold about you, ask us to correct it, or ask us to erase it. Write to ${EMAIL} and we will respond within a reasonable period.`,
        ],
      },
    ],
  },

  {
    slug: 'terms',
    title: 'Terms & Conditions',
    summary: 'The terms on which we sell to you.',
    sections: [
      {
        heading: 'Who you are buying from',
        body: [`${BUSINESS}, ${ADDRESS}.`],
      },
      {
        heading: 'Orders and pricing',
        body: [
          'All prices are in Indian Rupees and inclusive of GST. The price charged is the price shown at the time you place your order.',
          'We may decline or cancel an order if an item is unavailable, if the delivery address cannot be served, or if we suspect fraud. If we cancel a prepaid order, you are refunded in full.',
          'Product photographs are representative. Natural variation in colour and aroma between batches is expected in handmade spice blends and is not a defect.',
        ],
      },
      {
        heading: 'Food safety',
        body: [
          'Please read the ingredients listed on every product page before ordering, particularly if you have an allergy. Store products as described on the pack.',
        ],
      },
      {
        heading: 'Governing law',
        body: ['These terms are governed by Indian law, and disputes are subject to the jurisdiction of the courts at Bengaluru, Karnataka.'],
      },
    ],
  },

  {
    slug: 'grievance',
    title: 'Grievance Redressal',
    summary: 'Who to contact, and how quickly we will respond.',
    sections: [
      {
        heading: 'Grievance Officer',
        body: [
          `${OFFICER}`,
          `${BUSINESS}, ${ADDRESS}`,
          `Email: ${EMAIL}`,
        ],
      },
      {
        heading: 'How we handle complaints',
        body: [
          'We acknowledge every complaint within 48 hours and aim to resolve it within 15 days, as required by the Consumer Protection (E-Commerce) Rules, 2020.',
          'Please include your order number so we can find your order immediately.',
        ],
      },
    ],
  },
];

export const policyBySlug = (slug: string) => POLICIES.find((p) => p.slug === slug);
