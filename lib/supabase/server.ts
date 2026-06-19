import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// Server-side Supabase client for server components, server actions, and route handlers.
// Reads the user's session from cookies, so RLS policies fire as the logged-in user.
// Always call this inside a request scope. Do not module-cache it.
export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // setAll throws when called from a server component (read-only cookies).
            // That's fine: middleware refreshes the session on every request, so
            // we don't strictly need to write from server components.
          }
        },
      },
    },
  )
}

// Service-role client for trusted server-side operations that need to bypass RLS.
// Use sparingly: only for things like cross-user admin reads or webhook-receivers
// that already authenticated the request via a different shared secret.
// SUPABASE_SERVICE_ROLE_KEY must NEVER be exposed to the browser. Server-only.
export function createServiceRoleClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // no-op
        },
      },
    },
  )
}
