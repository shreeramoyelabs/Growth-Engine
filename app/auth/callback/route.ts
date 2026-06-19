import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

// OAuth + magic link landing point. Exchanges the auth code in the URL for a
// session, sets cookies via the server client, then redirects into the app.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const redirect = searchParams.get("redirect") || "/"

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${redirect}`)
    }
    // Fall through to login with error.
    const failUrl = new URL("/login", origin)
    failUrl.searchParams.set("error", error.message)
    return NextResponse.redirect(failUrl)
  }

  // No code present. Just bounce home.
  return NextResponse.redirect(`${origin}/login`)
}
