/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** where the Partners › Shortlist is emailed; no email button when unset */
  readonly VITE_PARTNER_EMAIL?: string;
  /** cloud save (src/net/cloud.ts): the Supabase project and its publishable key; the published game defaults to Mela Press */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_KEY?: string;
  /** 'off' turns cloud saving off */
  readonly VITE_CLOUD_SAVE?: string;
  /** Mixpanel (src/analytics): another project's token, or 'off' to send nothing */
  readonly VITE_MIXPANEL_TOKEN?: string;
  readonly VITE_MIXPANEL?: string;
}
