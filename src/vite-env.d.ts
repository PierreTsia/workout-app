/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_PUBLIC_POSTHOG_HOST?: string
  readonly VITE_PUBLIC_POSTHOG_PROJECT_TOKEN?: string
}
