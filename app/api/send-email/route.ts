import { NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { outreachId, to, subject, body, senderName } = await req.json()

  // Validate required fields
  if (!to || !body) {
    return NextResponse.json({ error: "Missing required fields: to, body" }, { status: 400 })
  }
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return NextResponse.json(
      { error: "Gmail not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local" },
      { status: 500 }
    )
  }

  // If TEST_RECIPIENT is set, redirect all emails there
  const recipient = process.env.GMAIL_TEST_RECIPIENT || to
  const isTest    = !!process.env.GMAIL_TEST_RECIPIENT

  const fromName = senderName || process.env.GMAIL_SENDER_NAME || "GE Outreach"
  const fromAddr = process.env.GMAIL_USER

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: fromAddr,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to:   recipient,
      subject: subject || "(no subject)",
      text: body + (isTest ? `\n\n---\n[TEST MODE — original recipient: ${to}]` : ""),
    })

    // Auto-mark as sent in Supabase if outreachId is provided
    if (outreachId) {
      await supabase
        .from("lead_outreach")
        .update({ status: "sent" })
        .eq("id", outreachId)
    }

    return NextResponse.json({
      success:   true,
      messageId: info.messageId,
      sentTo:    recipient,
      isTest,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
