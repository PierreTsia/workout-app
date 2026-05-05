// Centralized outbound URLs to the public docs site (https://docs.gymlogic.me).
//
// The host is intentionally module-private: every callsite must reference a
// named entry, not concatenate a path. When we add new bridge targets, add a
// new property here so the surfaces only ever import a typed identifier.
const PUBLIC_SITE_URL = "https://docs.gymlogic.me"

export const publicSite = {
  home: PUBLIC_SITE_URL,
  about: `${PUBLIC_SITE_URL}/about`,
  connectClaude: `${PUBLIC_SITE_URL}/connect/claude`,
} as const

export type PublicSiteLink = (typeof publicSite)[keyof typeof publicSite]
