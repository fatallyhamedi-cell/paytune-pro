import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    // @ts-ignore
    import.meta.env.VITE_SUPABASE_URL!,
    // @ts-ignore
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!
  )
}
