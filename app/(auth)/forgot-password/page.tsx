"use client"

import { useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase/client"
import { Mail, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setInfo("If an account with that email exists, we've sent a reset link.")
  }

  return (
    <div className="glass-card rounded-2xl p-8">
      <h1 className="font-display text-2xl font-semibold text-foreground mb-1">Reset password</h1>
      <p className="text-sm text-muted-foreground mb-6">We&apos;ll email you a link to set a new one.</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[rgba(201,168,92,0.35)] bg-white text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-[#C9A85C] focus:ring-2 focus:ring-[rgba(201,168,92,0.2)] transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-shimmer w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-60"
          style={{
            border: "1px solid rgba(120,75,10,0.5)",
            boxShadow: "0 4px 14px rgba(160,100,0,0.30), inset 0 1px 0 rgba(255,255,255,0.22)",
          }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Send reset link"}
        </button>
      </form>

      {error && (
        <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {info && (
        <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
          <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
          <span>{info}</span>
        </div>
      )}

      <div className="mt-6 pt-5 border-t border-[rgba(201,168,92,0.18)] text-xs text-muted-foreground text-center">
        Remembered it? <Link href="/login" className="font-medium text-foreground hover:text-[#A8843A] transition">Back to sign in</Link>
      </div>
    </div>
  )
}
