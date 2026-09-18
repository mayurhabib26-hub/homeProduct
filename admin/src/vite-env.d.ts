/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Absolute API origin. The admin is on its own subdomain, so this is
   * cross-origin — there is no relative /api to fall back on.
   */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
