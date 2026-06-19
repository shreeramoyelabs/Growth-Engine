"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Lock, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (password.length < 8) {
      setError("Password needs to be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setInfo("Password updated. Redirecting...")
    setTimeout(() => {
      router.push("/")
      router.refresh()
    }, 800)
  }

  return (
    <div className="glass-card rounded-2xl p-8">
      <h1 className="font-display text-2xl font-semibold text-foreground mb-1">Set a new password</h1>
      <p className="text-sm text-muted-foreground mb-6">Pick something at least 8 characters long.</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Field icon={<Lock size={14} />} type="password" placeholder="New password" value={password} onChange={setPassword} autoComplete="new-password" />
        <Field icon={<Lock size={14} />} type="password" placeholder="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />

        <button
          type="submit"
          disabled={loading}
          className="btn-shimmer w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-60"
          style={{
            border: "1px solid rgba(120,75,10,0.5)",
            boxShadow: "0 4px 14px rgba(160,100,0,0.30), inset 0 1px 0 rgba(255,255,255,0.22)",
          }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Update password"}
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
    </div>
  )
}

function Field({ icon, type, placeholder, value, onChange, autoComplete }: {
  icon: React.ReactNode; type: string; placeholder: string; value: string; onChange: (v: string) => void; autoComplete?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[rgba(201,168,92,0.35)] bg-white text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-[#C9A85C] focus:ring-2 focus:ring-[rgba(201,168,92,0.2)] transition"
      />
    </div>
  )
}
