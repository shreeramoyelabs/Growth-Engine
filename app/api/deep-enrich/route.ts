import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callN8nWebhook } from "@/lib/n8n"

// Vercel hobby has a 60s timeout. Deep enrich (2 LLM calls + page fetches)
// usually finishes in 15-40s, but the LLM extraction can occasionally hit
// 50s+ on slow Groq responses. If you hit the Vercel limit, switch to a
// fire-and-forget pattern (return 202, poll deep_enrich_id from the client).
export const maxDuration = 120

export async function POST(req: Request) {
  try {
    const { place_id } = await req.json()

    if (!place_id) {
      return NextResponse.json({ error: "place_id is required" }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Look up website + business_name (we don't trust the client to send these).
    // RLS scopes this to the user's own leads automatically.
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("place_id, business_name, website")
      .eq("place_id", place_id)
      .maybeSingle()

    if (leadErr) {
      return NextResponse.json({ error: leadErr.message }, { status: 500 })
    }
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }
    if (!lead.website) {
      return NextResponse.json(
        { error: "Lead has no website. Deep Enrich needs a website to crawl." },
        { status: 400 }
      )
    }

    const result = await callN8nWebhook({
      path: "mee-deep-enrich",
      body: {
        place_id: lead.place_id,
        business_name: lead.business_name,
        website: lead.website,
      },
      timeoutMs: 110_000,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    if (!result.response.ok) {
      const text = await result.response.text().catch(() => "")
      return NextResponse.json(
        { error: `n8n returned ${result.response.status}: ${text.slice(0, 500)}` },
        { status: 502 }
      )
    }

    const data = await result.response.json()
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// GET — fetch the latest deep enrichment for a lead (for the UI to display
// historical results without re-running the LLM).
export async function GET(req: Request) {
  const url = new URL(req.url)
  const place_id = url.searchParams.get("place_id")
  if (!place_id) {
    return NextResponse.json({ error: "place_id query param is required" }, { status: 400 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("lead_deep_enrichment")
    .select("*")
    .eq("place_id", place_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ result: data })
}
