"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutGrid, Users, Zap, Clock, Send, BarChart2, Search, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase/client"
import { ThemeToggle } from "@/components/layout/theme-toggle"

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const navItems = [
  { href: "/",          label: "Intelligence", icon: LayoutGrid, description: "Leads & enrichment"    },
  { href: "/outreach",  label: "Outreach",     icon: Send,       description: "Pipeline & messages"  },
  { href: "/insights",  label: "Insights",     icon: BarChart2,  description: "Analytics & breakdown" },
  { href: "/profiles",  label: "Profiles",     icon: Users,      description: "Sender identities"    },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [lastRun, setLastRun] = useState<{ completed_at: string; leads_found: number } | null>(null)
  const [hasBadge, setHasBadge] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null)
    })
    return () => { sub.subscription.unsubscribe() }
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  useEffect(() => {
    supabase
      .from("scrape_runs")
      .select("completed_at, leads_found")
      .eq("status", "success")
      .order("completed_at", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => { if (data) setLastRun(data) })
  }, [])

  // Badge: show when there's a completed run the user hasn't viewed yet
  useEffect(() => {
    const checkBadge = () => {
      try {
        const raw = localStorage.getItem("mee_last_run")
        const viewed = localStorage.getItem("mee_viewed_run")
        if (raw) {
          const { runId } = JSON.parse(raw)
          setHasBadge(runId !== viewed)
        }
      } catch {}
    }
    checkBadge()
    window.addEventListener("mee_run_complete", checkBadge)
    window.addEventListener("mee_run_viewed", checkBadge)
    return () => {
      window.removeEventListener("mee_run_complete", checkBadge)
      window.removeEventListener("mee_run_viewed", checkBadge)
    }
  }, [])

  // Clear badge when user is on Intelligence page
  useEffect(() => {
    if (pathname === "/") setHasBadge(false)
  }, [pathname])

  return (
    <aside
      className="w-[220px] h-screen flex flex-col shrink-0 relative"
      style={{
        background: "var(--surface-sidebar)",
        borderRight: "1px solid rgba(201,168,92,0.18)",
        backdropFilter: "blur(20px)",
      }}
    >
      {/* Top gold accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold-400 to-transparent opacity-60" />

      {/* Logo */}
      <div className="px-5 pt-7 pb-5" style={{ borderBottom: "1px solid rgba(201,168,92,0.14)" }}>
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-[30px] font-bold tracking-tight text-foreground">GE</span>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] mb-0.5" style={{ color: "#C9A85C" }}>
            Intel
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">Growth Engine</p>
      </div>

      {/* ── New Search CTA — rectangular shimmer ── */}
      <div className="px-3.5 pt-4 pb-2">
        <button
          onClick={() => router.push("/search")}
          className="btn-shimmer w-full flex items-center gap-2.5 px-4 py-3 text-sm font-bold text-white group"
          style={{
            borderRadius: "5px",
            border: "1px solid rgba(120,75,10,0.5)",
            boxShadow:
              "0 4px 14px rgba(160,100,0,0.40), 0 1px 3px rgba(160,100,0,0.25), inset 0 1px 0 rgba(255,255,255,0.22)",
          }}
        >
          <Search size={15} className="shrink-0" />
          <span className="flex-1 text-left tracking-wide">New Search</span>
          <span className="text-white/55 text-xs group-hover:translate-x-0.5 transition-transform">→</span>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pt-2 space-y-0.5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] px-3 pt-2 pb-1.5"
          style={{ color: "rgba(201,168,92,0.7)" }}>
          Navigation
        </p>
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group relative",
                isActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              )}
              style={isActive ? { background: "rgba(201,168,92,0.1)", boxShadow: "inset 2px 0 0 #C9A85C" } : undefined}
              onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(201,168,92,0.05)" }}
              onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "" }}
            >
              <item.icon size={15} style={{ color: isActive ? "#C9A85C" : undefined }}
                className={cn(!isActive && "text-muted-foreground group-hover:text-foreground")} />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] leading-tight">{item.label}</div>
                <div className="text-[11px] text-muted-foreground/70 leading-none mt-0.5">{item.description}</div>
              </div>
              {/* New-leads badge on Intelligence */}
              {item.href === "/" && hasBadge && (
                <span
                  className="w-2 h-2 rounded-full shrink-0 live-dot"
                  style={{ background: "#16a34a" }}
                  title="New leads waiting"
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 space-y-2.5" style={{ borderTop: "1px solid rgba(201,168,92,0.14)" }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot" />
          <span className="text-xs text-muted-foreground font-medium flex-1">Live</span>
          <ThemeToggle />
          <Zap size={10} className="text-gold-400" />
        </div>
        {lastRun ? (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
            <Clock size={10} />
            <span>Last run {timeAgo(lastRun.completed_at)}</span>
            <span className="text-gold-400 font-medium ml-auto">· {lastRun.leads_found} leads</span>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground/55">n8n · Supabase · SerpAPI · Groq</p>
        )}

        {/* User row */}
        {userEmail && (
          <div className="pt-2.5 mt-1 flex items-center gap-2" style={{ borderTop: "1px solid rgba(201,168,92,0.12)" }}>
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg, #D4A853, #A8843A)" }}
              title={userEmail}
            >
              {userEmail[0].toUpperCase()}
            </div>
            <span className="text-[11px] text-muted-foreground truncate flex-1" title={userEmail}>
              {userEmail}
            </span>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="p-1.5 rounded-md hover:bg-[rgba(201,168,92,0.12)] text-muted-foreground hover:text-foreground transition disabled:opacity-50"
              title="Sign out"
            >
              <LogOut size={12} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
