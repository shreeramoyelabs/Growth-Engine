// Server-side helper for calling n8n webhooks.
// Centralizes the webhook URL, shared secret, owner_id, and timeout handling.
// Never import this from a client component — it reads server-only env vars.

import { createClient } from "@/lib/supabase/server"

export type N8nCallOptions = {
  /** Webhook path, e.g. "mee-enrich" (no leading slash) */
  path: string
  /** Body fields (owner_id is added automatically from the session) */
  body: Record<string, unknown>
  /** Milliseconds before aborting. Default 30s. Set higher for long-running workflows. */
  timeoutMs?: number
}

export type N8nCallResult =
  | { ok: true; user_id: string; response: Response }
  | { ok: false; status: number; error: string }

/**
 * Calls an n8n webhook with the shared secret + the authenticated user's owner_id.
 * Returns 401 if the caller isn't logged in.
 * Caller is responsible for reading/streaming the Response body.
 */
export async function callN8nWebhook({
  path,
  body,
  timeoutMs = 30_000,
}: N8nCallOptions): Promise<N8nCallResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" }
  }

  const n8nBase = process.env.NEXT_PUBLIC_N8N_URL || process.env.N8N_URL
  if (!n8nBase) {
    return { ok: false, status: 500, error: "n8n URL not configured" }
  }

  const secret = process.env.MEE_WEBHOOK_SECRET
  if (!secret) {
    return { ok: false, status: 500, error: "MEE_WEBHOOK_SECRET not configured" }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${n8nBase}/webhook/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": secret,
      },
      body: JSON.stringify({ ...body, owner_id: user.id }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return { ok: true, user_id: user.id, response }
  } catch (err: unknown) {
    clearTimeout(timeoutId)
    const msg = err instanceof Error ? err.message : "Unknown fetch error"
    return { ok: false, status: 502, error: `n8n webhook failed: ${msg}` }
  }
}
