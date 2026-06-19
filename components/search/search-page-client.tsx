"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import {
  Loader2, Sparkles, Search, ChevronRight, Target,
  RotateCcw, MapPin, Globe, AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase/client"
import { timeAgo } from "@/lib/format"

// Zoom 12 ≈ 10 km radius. Clamped to [8, 18].
function kmToZoom(km: number): number {
  return Math.max(8, Math.min(18, Math.round(12 + Math.log2(10 / km))))
}

const RADIUS_MIN = 1, RADIUS_MAX = 50, RADIUS_DEFAULT = 5
const SUPPORTED_CC = ["us", "in", "gb", "ca", "au", "sg", "ae"]

const CC_LABELS: Record<string, string> = {
  us: "🇺🇸 United States", in: "🇮🇳 India", gb: "🇬🇧 United Kingdom",
  ca: "🇨🇦 Canada", au: "🇦🇺 Australia", sg: "🇸🇬 Singapore", ae: "🇦🇪 UAE",
}

type SearchMode = "near_me" | "anywhere"
type LocationStatus = "idle" | "detecting" | "detected" | "failed"
type Stage = "idle" | "firing" | "watching" | "complete" | "launched"

interface RunRecord {
  id: string
  queries: string[] | null
  leads_found: number | null
  status: string
  completed_at: string | null
  started_at: string
}

interface RunResult {
  runId: string
  leadsFound: number
  query: string
}

function formatElapsed(secs: number): string {
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

// ── Radius stepper ──────────────────────────────────────────────
function RadiusInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const adjust = (delta: number) =>
    onChange(Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, value + delta)))

  return (
    <div className="flex items-center h-10 rounded-xl overflow-hidden bg-white/70"
      style={{ border: "1px solid rgba(201,168,92,0.5)" }}>
      <button type="button" onClick={() => adjust(-1)} disabled={value <= RADIUS_MIN}
        className="w-10 h-full flex items-center justify-center text-xl font-light text-muted-foreground hover:bg-gold-50 hover:text-gold-600 transition-colors disabled:opacity-25"
        style={{ borderRight: "1px solid rgba(201,168,92,0.35)" }}>−</button>
      <div className="flex-1 flex items-center justify-center gap-1.5">
        <input type="text" inputMode="numeric" value={value}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, "")
            if (!raw) { onChange(RADIUS_MIN); return }
            const v = parseInt(raw)
            if (!isNaN(v)) onChange(Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, v)))
          }}
          className="w-10 text-center text-base font-semibold bg-transparent outline-none tabular-nums text-foreground"
        />
        <span className="text-sm text-muted-foreground/65 font-medium">km</span>
      </div>
      <button type="button" onClick={() => adjust(1)} disabled={value >= RADIUS_MAX}
        className="w-10 h-full flex items-center justify-center text-xl font-light text-muted-foreground hover:bg-gold-50 hover:text-gold-600 transition-colors disabled:opacity-25"
        style={{ borderLeft: "1px solid rgba(201,168,92,0.35)" }}>+</button>
    </div>
  )
}

// ── Lazy map (leaflet needs window) ────────────────────────────
const MapPicker = dynamic(
  () => import("./map-picker").then((m) => ({ default: m.MapPicker })),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 rounded-2xl flex items-center justify-center"
        style={{ minHeight: 360, background: "var(--surface-card-inner)", border: "1px solid rgba(201,168,92,0.2)" }}>
        <div className="text-sm text-muted-foreground">Loading map…</div>
      </div>
    ),
  }
)

export function SearchPageClient() {
  const router = useRouter()

  // ── Search mode ──────────────────────────────────────────────
  const [searchMode, setSearchMode] = useState<SearchMode>("near_me")
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle")
  const [detectedPlace, setDetectedPlace] = useState<string | null>(null)

  // ── Form ─────────────────────────────────────────────────────
  const [form, setForm] = useState({
    query: "", lat: "", lng: "", radiusKm: RADIUS_DEFAULT, countryCode: "in",
  })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  // ── Pipeline stage ───────────────────────────────────────────
  const [stage, setStage] = useState<Stage>("idle")
  const [runResult, setRunResult] = useState<RunResult | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [runs, setRuns] = useState<RunRecord[]>([])

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Geolocation ──────────────────────────────────────────────
  const requestGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus("failed")
      return
    }
    setLocationStatus("detecting")
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const la = pos.coords.latitude.toFixed(6)
        const ln = pos.coords.longitude.toFixed(6)
        setForm((f) => ({ ...f, lat: la, lng: ln }))
        setLocationStatus("detected")
        // Reverse geocode for a human-readable place name
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${ln}&format=json`,
            { headers: { "User-Agent": "GE-Dashboard/1.0" } }
          )
          const data = await res.json()
          const city = data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.suburb
          const country = data?.address?.country
          setDetectedPlace([city, country].filter(Boolean).join(", ") || null)
          const cc = data?.address?.country_code?.toLowerCase()
          if (cc && SUPPORTED_CC.includes(cc)) {
            setForm((f) => ({ ...f, lat: la, lng: ln, countryCode: cc }))
          }
        } catch {}
      },
      (err) => {
        setLocationStatus("failed")
        // If permission denied, switch to Anywhere so user isn't stuck
        if (err.code === 1) setSearchMode("anywhere")
      },
      { timeout: 10000, maximumAge: 300000 }
    )
  }, [])

  // Auto-detect on mount
  useEffect(() => { requestGeolocation() }, [requestGeolocation])

  const handleModeChange = (mode: SearchMode) => {
    setSearchMode(mode)
    if (mode === "near_me") {
      // Always re-detect + fly map to current GPS when switching back to Near me
      requestGeolocation()
    }
  }

  // Map click — works in both modes; in "anywhere" mode also updates country
  const handleMapClick = useCallback(async (la: string, ln: string) => {
    setForm((f) => ({ ...f, lat: la, lng: ln }))
    if (searchMode === "anywhere") {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${ln}&format=json`,
          { headers: { "User-Agent": "GE-Dashboard/1.0" } }
        )
        const data = await res.json()
        const cc = data?.address?.country_code?.toLowerCase()
        if (cc && SUPPORTED_CC.includes(cc)) {
          setForm((f) => ({ ...f, lat: la, lng: ln, countryCode: cc }))
        }
      } catch {}
    }
  }, [searchMode])

  // ── Elapsed timer while watching ────────────────────────────
  useEffect(() => {
    if (stage === "watching") {
      setElapsed(0)
      elapsedTimerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } else {
      if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null }
    }
  }, [stage])

  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe()
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
    }
  }, [])

  // ── Recent runs ─────────────────────────────────────────────
  const loadRuns = useCallback(async () => {
    const { data } = await supabase
      .from("scrape_runs")
      .select("id, queries, leads_found, status, completed_at, started_at")
      .order("started_at", { ascending: false })
      .limit(8)
    setRuns(data || [])
  }, [])
  useEffect(() => { loadRuns() }, [loadRuns])

  // ── Pipeline helpers ─────────────────────────────────────────
  const saveRunToStorage = (result: RunResult) => {
    try {
      const payload = { ...result, completedAt: new Date().toISOString() }
      localStorage.setItem("mee_last_run", JSON.stringify(payload))
      localStorage.setItem("mee_pending_banner", JSON.stringify(payload))
      window.dispatchEvent(new CustomEvent("mee_run_complete"))
    } catch {}
  }

  const resetToIdle = () => {
    channelRef.current?.unsubscribe()
    channelRef.current = null
    setStage("idle")
    setRunResult(null)
    setElapsed(0)
  }

  // ── Fire pipeline ─────────────────────────────────────────────
  const handleRun = async () => {
    if (!form.query || !form.lat || !form.lng) return
    const savedQuery = form.query
    setStage("firing")

    const payload = {
      query: savedQuery,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      zoom: kmToZoom(form.radiusKm),
      countryCode: form.countryCode,
    }

    fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {})

    let run: RunRecord | null = null
    const startedAfter = new Date(Date.now() - 30000).toISOString()
    for (let attempt = 0; attempt < 4; attempt++) {
      await new Promise((r) => setTimeout(r, attempt === 0 ? 2000 : 2500))
      const { data } = await supabase
        .from("scrape_runs")
        .select("id, queries, leads_found, status, completed_at, started_at")
        .in("status", ["running", "success"])
        .gte("started_at", startedAfter)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) { run = data; break }
    }

    if (!run) {
      setStage("launched"); loadRuns(); return
    }

    if (run.status === "success") {
      const count = run.leads_found ?? 0
      const result: RunResult = { runId: run.id, leadsFound: count, query: savedQuery }
      setRunResult(result); setStage("complete"); loadRuns(); saveRunToStorage(result)
      return
    }

    setStage("watching")
    const runId = run.id
    const channel = supabase
      .channel(`mee-run-${runId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "scrape_runs", filter: `id=eq.${runId}` },
        (payload) => {
          const updated = payload.new as RunRecord
          if (updated.status === "success") {
            const count = updated.leads_found ?? 0
            const result: RunResult = { runId, leadsFound: count, query: savedQuery }
            setRunResult(result); setStage("complete")
            channelRef.current?.unsubscribe()
            loadRuns(); saveRunToStorage(result)
          }
        }
      )
      .subscribe()
    channelRef.current = channel
  }

  const isRunning = stage === "firing" || stage === "watching"
  const canRun = !!form.query && !!form.lat && !!form.lng && !isRunning

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-full p-8">
      {/* Header */}
      <div className="mb-6 animate-fade-in">
        <h1 className="font-display text-[30px] font-bold tracking-tight">New Search</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Discover leads around you or explore any location in the world
        </p>
      </div>

      <div className="flex gap-6 animate-fade-up" style={{ minHeight: "520px" }}>

        {/* ── Left: Form ── */}
        <div className="w-[380px] shrink-0 flex flex-col gap-4">

          {/* Mode toggle */}
          <div
            className="flex rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(201,168,92,0.35)", background: "rgba(255,255,255,0.4)" }}
          >
            {([
              { mode: "near_me" as SearchMode, icon: MapPin,  label: "Near me"  },
              { mode: "anywhere" as SearchMode, icon: Globe,  label: "Anywhere" },
            ]).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => handleModeChange(mode)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all",
                  searchMode === mode ? "text-amber-700" : "text-muted-foreground hover:text-foreground"
                )}
                style={{
                  borderLeft: mode === "anywhere" ? "1px solid rgba(201,168,92,0.25)" : undefined,
                  ...(searchMode === mode ? { background: "rgba(201,168,92,0.12)" } : {}),
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Near me: location chip */}
          {searchMode === "near_me" && (
            <div className="glass-card rounded-2xl px-4 py-3.5">
              {locationStatus === "detecting" && (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Loader2 size={14} className="animate-spin shrink-0" style={{ color: "#C9A85C" }} />
                  <span>Detecting your location…</span>
                </div>
              )}
              {locationStatus === "detected" && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {detectedPlace || "Current location"}
                      </p>
                      {form.lat && (
                        <p className="text-[10px] text-muted-foreground/55 font-mono">
                          {parseFloat(form.lat).toFixed(4)}°, {parseFloat(form.lng).toFixed(4)}°
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={requestGeolocation}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground/55 hover:text-gold-600 transition-colors shrink-0"
                  >
                    <RotateCcw size={10} /> refresh
                  </button>
                </div>
              )}
              {(locationStatus === "failed" || locationStatus === "idle") && (
                <div className="flex items-start gap-2 text-sm text-amber-600/90">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>
                    Location access blocked.{" "}
                    <button onClick={requestGeolocation} className="underline">Try again</button>
                    {" "}or{" "}
                    <button onClick={() => setSearchMode("anywhere")} className="underline">
                      set location manually →
                    </button>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Anywhere: lat/lng + country */}
          {searchMode === "anywhere" && (
            <div className="glass-card rounded-2xl p-5 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55">
                Location
                {form.lat && form.lng && (
                  <span className="normal-case font-normal ml-2 text-gold-500">
                    · {parseFloat(form.lat).toFixed(4)}, {parseFloat(form.lng).toFixed(4)}
                  </span>
                )}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Latitude</Label>
                  <Input placeholder="Click map" className="border-gold-200 text-sm h-9"
                    value={form.lat} onChange={(e) => set("lat", e.target.value)} disabled={isRunning} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Longitude</Label>
                  <Input placeholder="Click map" className="border-gold-200 text-sm h-9"
                    value={form.lng} onChange={(e) => set("lng", e.target.value)} disabled={isRunning} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Country</Label>
                <Select value={form.countryCode} onValueChange={(v) => v && set("countryCode", v)} disabled={isRunning}>
                  <SelectTrigger className="border-gold-200 text-sm h-9">
                    <span className="text-sm">{CC_LABELS[form.countryCode] ?? form.countryCode.toUpperCase()}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CC_LABELS).map(([cc, label]) => (
                      <SelectItem key={cc} value={cc}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!form.lat && (
                <p className="text-xs text-muted-foreground/55 text-center py-1">
                  ↗ Click anywhere on the map to set location
                </p>
              )}
            </div>
          )}

          {/* Query */}
          <div className="glass-card rounded-2xl p-5 space-y-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55">
              What are you looking for?
            </p>
            <Input
              placeholder="e.g. cafes, dental clinics, property managers…"
              className="border-gold-200 focus-visible:ring-gold-300 text-sm h-10"
              value={form.query}
              onChange={(e) => set("query", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canRun && handleRun()}
              disabled={isRunning}
              autoFocus={searchMode === "near_me"}
            />
            <p className="text-xs text-muted-foreground/50">
              Type a business type, service, or industry
            </p>
          </div>

          {/* Radius */}
          <div className="glass-card rounded-2xl p-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55">
                Search radius
              </p>
              <span className="text-[10px] font-mono text-muted-foreground/40">
                z{kmToZoom(form.radiusKm)}
              </span>
            </div>
            <RadiusInput
              value={form.radiusKm}
              onChange={(v) => setForm((f) => ({ ...f, radiusKm: v }))}
            />
            <p className="text-xs text-muted-foreground/50">
              {searchMode === "near_me"
                ? `Searches within ~${form.radiusKm} km of your location`
                : "Sets map viewport · Google may include results from beyond this area"}
            </p>
          </div>

          {/* ── Stage: idle → Run button ── */}
          {stage === "idle" && (
            <Button
              className="w-full h-12 text-white gap-2 text-sm font-semibold"
              style={{
                background: canRun
                  ? "linear-gradient(135deg, #D4A853, #C9A85C)"
                  : "rgba(201,168,92,0.25)",
                boxShadow: canRun ? "0 2px 10px rgba(180,120,0,0.3)" : "none",
                borderRadius: "6px",
              }}
              onClick={handleRun}
              disabled={!canRun}
            >
              <Search size={16} />
              {searchMode === "near_me"
                ? (form.lat ? "Find Businesses Nearby" : "Waiting for location…")
                : "Run Full Pipeline"}
            </Button>
          )}

          {/* ── Stage: firing ── */}
          {stage === "firing" && (
            <div className="rounded-2xl px-5 py-4 flex items-center gap-3 animate-fade-in"
              style={{ background: "rgba(201,168,92,0.06)", border: "1px solid rgba(201,168,92,0.2)" }}>
              <Loader2 size={18} className="animate-spin shrink-0" style={{ color: "#C9A85C" }} />
              <div>
                <p className="text-sm font-semibold text-foreground">Launching pipeline…</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Connecting to n8n · Google Maps API</p>
              </div>
            </div>
          )}

          {/* ── Stage: watching ── */}
          {stage === "watching" && (
            <div className="glass-card rounded-2xl p-5 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 live-dot shrink-0" />
                  <p className="text-sm font-semibold text-foreground">Scraping Google Maps…</p>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">{formatElapsed(elapsed)}</span>
              </div>
              <p className="text-xs text-muted-foreground/70 truncate">
                <span className="font-medium text-foreground/70">&quot;{form.query}&quot;</span>
                {form.lat && ` · ${parseFloat(form.lat).toFixed(2)}°, ${parseFloat(form.lng).toFixed(2)}°`}
              </p>
              <div className="h-1.5 rounded-full overflow-hidden relative" style={{ background: "rgba(201,168,92,0.15)" }}>
                <div
                  className="animate-progress absolute inset-y-0 left-0 rounded-full"
                  style={{ background: "linear-gradient(90deg, transparent, #C9A85C, #E8C878, #C9A85C, transparent)" }}
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground/50">Finding businesses · enriching data · ~2 min</p>
                <button onClick={resetToIdle}
                  className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                  ✕ cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Stage: complete ── */}
          {stage === "complete" && runResult && (
            <div className="rounded-2xl p-5 space-y-4 animate-fade-in"
              style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.22)" }}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(22,163,74,0.12)" }}>
                  <Target size={20} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-3xl font-bold tabular-nums leading-none" style={{ color: "#15803d" }}>
                    {runResult.leadsFound}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">new leads discovered</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground/70">
                Query: <span className="font-medium text-foreground/60">&quot;{runResult.query}&quot;</span>
              </p>
              <button
                onClick={() => router.push("/")}
                className="w-full h-10 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.01]"
                style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 2px 10px rgba(22,163,74,0.3)" }}
              >
                <Sparkles size={14} />
                View {runResult.leadsFound} new leads
                <ChevronRight size={14} />
              </button>
              <button onClick={resetToIdle}
                className="w-full text-xs text-muted-foreground/55 hover:text-muted-foreground transition-colors text-center py-0.5">
                Run another search
              </button>
            </div>
          )}

          {/* ── Stage: launched (fallback) ── */}
          {stage === "launched" && (
            <div className="rounded-2xl px-5 py-4 flex items-center gap-3 animate-fade-in"
              style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.25)" }}>
              <Sparkles size={18} className="text-emerald-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-700">Pipeline launched!</p>
                <p className="text-xs text-emerald-600/70">Leads appear in Intelligence in ~2 min</p>
              </div>
              <button onClick={() => router.push("/")}
                className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5 shrink-0">
                View <ChevronRight size={11} />
              </button>
            </div>
          )}

          {/* Recent runs */}
          {runs.length > 0 && (
            <div className="glass-card rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55 mb-3">
                Recent Runs
              </p>
              <div className="space-y-2">
                {runs.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 py-1">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: r.status === "success" ? "#16a34a" : r.status === "running" ? "#d97706" : "#dc2626" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground/80 truncate">{r.queries?.[0] ?? "Unknown"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-semibold" style={{ color: "#C9A85C" }}>
                        {r.leads_found != null ? `${r.leads_found} leads` : "…"}
                      </span>
                      <div className="text-[9px] text-muted-foreground/60">
                        {timeAgo(r.completed_at ?? r.started_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Map (always visible) ── */}
        <div className="flex-1 relative">
          <div className="glass-card rounded-2xl overflow-hidden h-full" style={{ minHeight: "520px" }}>
            <MapPicker
              lat={form.lat}
              lng={form.lng}
              onChange={handleMapClick}
            />
          </div>

          {/* Near me: "viewing only" hint */}
          {searchMode === "near_me" && locationStatus === "detected" && !form.lat && (
            <div className="absolute bottom-4 right-4 px-3 py-2 rounded-xl text-xs pointer-events-none"
              style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(201,168,92,0.25)", color: "#7C5C28" }}>
              📍 Your detected location
            </div>
          )}

          {/* Anywhere: click hint */}
          {searchMode === "anywhere" && !form.lat && (
            <div className="absolute bottom-4 right-4 px-3 py-2 rounded-xl text-xs pointer-events-none flex items-center gap-2"
              style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(201,168,92,0.25)", color: "#7C5C28" }}>
              <ChevronRight size={12} /> Click anywhere to set search location
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
