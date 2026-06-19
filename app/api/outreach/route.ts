import { NextResponse } from "next/server"
import { callN8nWebhook } from "@/lib/n8n"

// POST /api/outreach — generates outreach messages via the n8n LLM workflow.
// Body: { profile_id: string, place_ids: string[], channel?: string, tone?: string }
export const maxDuration = 60

export async function POST(req: Request) {
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.profile_id || typeof body.profile_id !== "string") {
    return NextResponse.json({ error: "profile_id is required" }, { status: 400 })
  }
  if (!Array.isArray(body.place_ids) || body.place_ids.length === 0) {
    return NextResponse.json(
      { error: "place_ids must be a non-empty array" },
      { status: 400 },
    )
  }

  const result = await callN8nWebhook({
    path: "mee-outreach",
    body: {
      profile_id: body.profile_id,
      place_ids: body.place_ids,
      channel: body.channel || "email",
      tone: body.tone || "professional",
    },
    timeoutMs: 55_000, // LLM call per lead can be slow; ~2s per lead avg
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
  return NextResponse.json(data)
}
