/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Digits only, country code included, no '+'. Public by design. */
  readonly VITE_WHATSAPP_NUMBER?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_RAZORPAY_KEY_ID?: string;
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}
