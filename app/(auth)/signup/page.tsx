"use client"

import { useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase/client"
import { Mail, Lock, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState<null | "password" | "google">(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (password.length < 8) {
      setError("Password needs to be at least 8 characters.")
      return
    }
    setLoading("password")
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setLoading(null)
    if (error) {
      setError(error.message)
      return
    }
    // If email confirmations are off, session is immediate.
    // If on, user must confirm via email first.
    if (data.session) {
      setInfo("Account created. Redirecting...")
      setTimeout(() => (window.location.href = "/"), 800)
    } else {
      setInfo("Account created. Check your email to confirm before signing in.")
    }
  }

  async function handleGoogle() {
    setError(null)
    setLoading("google")
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setError(error.message)
      setLoading(null)
    }
  }

  return (
    <div className="glass-card rounded-2xl p-8">
      <h1 className="font-display text-2xl font-semibold text-foreground mb-1">Create your account</h1>
      <p className="text-sm text-muted-foreground mb-6">Free to start. No credit card.</p>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading !== null}
        className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border border-[rgba(201,168,92,0.4)] bg-white hover:bg-[rgba(255,250,235,0.9)] text-sm font-medium text-foreground transition disabled:opacity-50"
      >
        {loading === "google" ? <Loader2 size={16} className="animate-spin" /> : <GoogleIcon />}
        Sign up with Google
      </button>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-[rgba(201,168,92,0.25)]" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-[rgba(201,168,92,0.25)]" />
      </div>

      <form onSubmit={handleSignup} className="space-y-3">
        <Field icon={<Mail size={14} />} type="email" placeholder="you@example.com" value={email} onChange={setEmail} autoComplete="email" required />
        <Field icon={<Lock size={14} />} type="password" placeholder="Password (8+ chars)" value={password} onChange={setPassword} autoComplete="new-password" required />

        <button
          type="submit"
          disabled={loading !== null}
          className="btn-shimmer w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white disabled:opacity-60"
          style={{
            border: "1px solid rgba(120,75,10,0.5)",
            boxShadow: "0 4px 14px rgba(160,100,0,0.30), inset 0 1px 0 rgba(255,255,255,0.22)",
          }}
        >
          {loading === "password" ? <Loader2 size={16} className="animate-spin" /> : "Create account"}
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
        Already have an account? <Link href="/login" className="font-medium text-foreground hover:text-[#A8843A] transition">Sign in</Link>
      </div>
    </div>
  )
}

function Field({ icon, type, placeholder, value, onChange, autoComplete, required }: {
  icon: React.ReactNode; type: string; placeholder: string; value: string; onChange: (v: string) => void; autoComplete?: string; required?: boolean;
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
        required={required}
        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[rgba(201,168,92,0.35)] bg-white text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-[#C9A85C] focus:ring-2 focus:ring-[rgba(201,168,92,0.2)] transition"
      />
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  )
}
