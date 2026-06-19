import { createBrowserClient } from "@supabase/ssr"

// Browser-side Supabase client. Reads session from cookies set by the SSR helper,
// so every query automatically carries the user's JWT once they're logged in.
// Import this in any client component as `import { supabase } from "@/lib/supabase/client"`.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
