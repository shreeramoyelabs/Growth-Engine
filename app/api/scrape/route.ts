import { NextResponse } from "next/server"
import { callN8nWebhook } from "@/lib/n8n"

// POST /api/scrape — kicks off a Google Maps scrape via n8n.
// Body: { query?: string, queries?: string[], lat: number, lng: number, zoom?: number, countryCode?: string, language?: string, resultsPerQuery?: number }
// Returns 202 immediately (fire-and-forget) — the workflow runs for 2-3 min
// and writes leads via realtime updates the UI subscribes to.
export const maxDuration = 30

export async function POST(req: Request) {
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const result = await callN8nWebhook({
    path: "mee-run",
    body,
    timeoutMs: 10_000, // fire-and-forget — short timeout, n8n keeps running after
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  // n8n returns 200 with run metadata. Forward it.
  if (!result.response.ok) {
    const text = await result.response.text().catch(() => "")
    return NextResponse.json(
      { error: `n8n returned ${result.response.status}: ${text.slice(0, 500)}` },
      { status: 502 },
    )
  }

  const data = await result.response.json().catch(() => ({}))
  return NextResponse.json({ ok: true, ...data })
}
