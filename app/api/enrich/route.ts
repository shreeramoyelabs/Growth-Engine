import { NextResponse } from "next/server"
import { callN8nWebhook } from "@/lib/n8n"

// POST /api/enrich — runs Website Enrichment on a batch of leads via n8n.
// Body: { place_ids: string[] }
export const maxDuration = 30

export async function POST(req: Request) {
  let body: { place_ids?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!Array.isArray(body.place_ids) || body.place_ids.length === 0) {
    return NextResponse.json(
      { error: "place_ids must be a non-empty array" },
      { status: 400 },
    )
  }

  const result = await callN8nWebhook({
    path: "mee-enrich",
    body: { place_ids: body.place_ids },
    timeoutMs: 15_000,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

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
