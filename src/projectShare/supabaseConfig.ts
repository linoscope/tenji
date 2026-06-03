/** Resolved Supabase config for share-by-link. The publishable key is
 *  browser-safe (protected by RLS). */
export type SupabaseConfig = {
  url: string
  publishableKey: string
}

/**
 * Pure resolver: returns a config only when BOTH values are present and
 * non-blank, otherwise null ("not configured"). Kept pure so tests drive
 * present/absent directly without touching `import.meta.env`.
 */
export function resolveSupabaseConfig(env: {
  url?: string | null
  publishableKey?: string | null
}): SupabaseConfig | null {
  const url = env.url?.trim()
  const publishableKey = env.publishableKey?.trim()
  if (url && publishableKey) return { url, publishableKey }
  return null
}

/** Boundary helper — reads Vite env. Used only in main.tsx, never in App,
 *  so App stays env-free and deterministic under test. */
export function resolveSupabaseConfigFromEnv(): SupabaseConfig | null {
  return resolveSupabaseConfig({
    url: import.meta.env.VITE_SUPABASE_URL,
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  })
}
