"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { X, Sparkles, SlidersHorizontal, Clock } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { truncate, timeAgo, haversineKm } from "@/lib/format"
import type { Lead } from "@/lib/types"

// ── OSRM road distance (from a single origin to many destinations) ──
// All near-me distances share ONE origin (the user's GPS), so this is
// very efficient: 135 leads = 2 OSRM batch calls, 20 new leads = 1 call.

// v4 cache: previous keys could contain 0-distance values that survived
// across deploys due to hot-reload picking up file edits separately. v4 also
// applies a sanity floor when LOADING from cache, not just when writing — so
// any bogus tiny value gets discarded on read and the lead is re-fetched.
const NEAR_ME_CACHE_KEY = "mee_nearme_dist_v4"
const STALE_CACHE_KEYS = ["mee_nearme_dist_v1", "mee_nearme_dist_v2", "mee_nearme_dist_v3"]
const CACHE_TTL = 24 * 60 * 60 * 1000   // 24 h
const MOVE_THRESHOLD_KM = 1              // invalidate cache if moved >1 km
const OSRM_CHUNK_SIZE = 50               // smaller batches = fewer transient failures
const OSRM_TIMEOUT_MS = 15000
const OSRM_RETRIES = 2
const MIN_VALID_KM = 0.005               // 5m — below this is OSRM garbage, treat as no data

interface NearMeCache {
  cachedLat: number
  cachedLng: number
  updatedAt: number
  data: Record<string, number | null>
}

function loadNearMeCache(lat: number, lng: number): Record<string, number | null> | null {
  try {
    // Sweep stale keys from previous cache versions so they don't clog
    // localStorage forever (each is up to ~30KB)
    STALE_CACHE_KEYS.forEach((k) => {
      try { localStorage.removeItem(k) } catch {}
    })

    const raw = localStorage.getItem(NEAR_ME_CACHE_KEY)
    if (!raw) return null
    const cache: NearMeCache = JSON.parse(raw)
    if (Date.now() - cache.updatedAt > CACHE_TTL) return null
    const moved = haversineKm(lat, lng, cache.cachedLat, cache.cachedLng) ?? Infinity
    if (moved > MOVE_THRESHOLD_KM) return null

    // Defensive read: drop any entry below the sanity floor so it gets
    // re-fetched from OSRM. Belt-and-suspenders for cases where the cache
    // was populated by an older code path without the floor.
    const cleaned: Record<string, number | null> = {}
    let droppedCount = 0
    for (const [placeId, km] of Object.entries(cache.data)) {
      if (km !== null && km < MIN_VALID_KM) {
        droppedCount++
        continue // skip — will be re-fetched
      }
      cleaned[placeId] = km
    }
    if (droppedCount > 0) {
      console.warn(`[OSRM cache] dropped ${droppedCount} entries below ${MIN_VALID_KM}km floor — will re-fetch`)
    }
    return cleaned
  } catch { return null }
}

function saveNearMeCache(lat: number, lng: number, data: Record<string, number | null>) {
  try {
    // Defensive write: filter out any bogus tiny values before persisting
    const cleaned: Record<string, number | null> = {}
    for (const [placeId, km] of Object.entries(data)) {
      cleaned[placeId] = (km !== null && km < MIN_VALID_KM) ? null : km
    }
    localStorage.setItem(NEAR_ME_CACHE_KEY, JSON.stringify({ cachedLat: lat, cachedLng: lng, updatedAt: Date.now(), data: cleaned }))
  } catch {}
}

async function osrmBatch(
  srcLat: number, srcLng: number,
  dests: { place_id: string; lat: number; lng: number }[]
): Promise<Record<string, number | null>> {
  if (dests.length === 0) return {}
  // OSRM uses longitude,latitude order (reversed from standard)
  const coords = [`${srcLng},${srcLat}`, ...dests.map(d => `${d.lng},${d.lat}`)].join(";")
  const destIdx = dests.map((_, i) => i + 1).join(";")
  const url = `https://router.project-osrm.org/table/v1/driving/${coords}?sources=0&destinations=${destIdx}&annotations=distance`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), OSRM_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`)
    const json = await res.json()
    if (json.code !== "Ok" || !Array.isArray(json.distances?.[0])) throw new Error(`OSRM bad response: ${json.code || "unknown"}`)
    const out: Record<string, number | null> = {}
    dests.forEach((d, i) => {
      const m = json.distances[0][i]
      // Valid road distance: 5 meters to 500 km. Anything outside that range
      // is either OSRM garbage (sub-meter responses observed during the v2
      // deploy that broke distances) or genuinely cross-continent → null →
      // UI shows aerial fallback.
      out[d.place_id] = m != null && m >= 5 && m < 500_000 ? m / 1000 : null
    })
    return out
  } finally {
    clearTimeout(timer)
  }
}

async function osrmBatchWithRetry(
  srcLat: number, srcLng: number,
  dests: { place_id: string; lat: number; lng: number }[]
): Promise<Record<string, number | null>> {
  for (let attempt = 0; attempt <= OSRM_RETRIES; attempt++) {
    try {
      return await osrmBatch(srcLat, srcLng, dests)
    } catch (err) {
      if (attempt === OSRM_RETRIES) {
        console.warn(`[OSRM] batch of ${dests.length} failed after ${OSRM_RETRIES + 1} attempts:`, err)
        return {}
      }
      await new Promise(r => setTimeout(r, 500 * Math.pow(3, attempt))) // 500ms, 1500ms
    }
  }
  return {}
}

async function fetchNearMeDistances(
  srcLat: number, srcLng: number,
  leads: Lead[],
  existing: Record<string, number | null>
): Promise<Record<string, number | null>> {
  const todo = leads.filter(l =>
    !(l.place_id in existing) && l.latitude != null && l.longitude != null
  )
  if (todo.length === 0) return existing
  const result = { ...existing }

  for (let i = 0; i < todo.length; i += OSRM_CHUNK_SIZE) {
    const chunk = todo.slice(i, i + OSRM_CHUNK_SIZE)
    const batch = await osrmBatchWithRetry(srcLat, srcLng, chunk.map(l => ({
      place_id: l.place_id, lat: l.latitude!, lng: l.longitude!,
    })))
    Object.assign(result, batch)

    // Per-lead fallback for anything still missing after the batch
    const missing = chunk.filter(l => !(l.place_id in batch))
    if (missing.length > 0) {
      console.warn(`[OSRM] retrying ${missing.length} leads individually`)
      for (const l of missing) {
        const single = await osrmBatchWithRetry(srcLat, srcLng, [{
          place_id: l.place_id, lat: l.latitude!, lng: l.longitude!,
        }])
        Object.assign(result, single)
      }
    }
  }
  return result
}

// ── CSV export util ─────────────────────────────────────────────
import { FilterBar, type Filters, type RunRecord } from "./filter-bar"
import { Greeting } from "./greeting"
import { StatsBar } from "./stats-bar"
import { TierBar } from "./tier-bar"
import { LeadsTable } from "./leads-table"
import { LeadDetailPanel } from "./lead-detail-panel"
import { BulkActionBar } from "./bulk-action-bar"
import { GenerateOutreachModal } from "@/components/outreach/generate-outreach-modal"
import { getTier } from "@/lib/types"

const DEFAULT_FILTERS: Filters = {
  search: "",
  hasEmail: "all",
  enriched: "all",
  sortBy: "score_desc",
  sourceQuery: "all",
  runId: null,
  maxDistKm: null,
}

type SortField = "score_desc" | "score_asc" | "name" | "rating" | "scraped" | "distance"

interface PendingRun {
  runId: string
  leadsFound: number
  query: string
  completedAt: string
}

function exportToCSV(leads: Lead[]) {
  const headers = [
    "Business Name","Category","City","State","Score","Tier",
    "Email","Email Valid","Phone","Website","Google Rating","Reviews",
    "Owner","LinkedIn","Enriched","Scraped At",
  ]
  const rows = leads.map((l) => [
    l.business_name, l.category ?? "", l.city ?? "", l.state ?? "",
    l.lead_quality_score?.toString() ?? "", getTier(l.lead_quality_score),
    l.email ?? "", l.email_valid ?? "",
    l.phone ?? l.website_phone ?? "", l.website ?? "",
    l.google_rating?.toString() ?? "", l.review_count?.toString() ?? "",
    l.owner_name ?? "", l.linkedin ?? "",
    l.enriched_at ? "Yes" : "No",
    l.scraped_at ? new Date(l.scraped_at).toLocaleDateString() : "",
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `mee-leads-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function LeadsPageClient() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [activeTier, setActiveTier] = useState("all")
  const [compact, setCompact] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [outreachTarget, setOutreachTarget] = useState<Lead | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [pendingRun, setPendingRun] = useState<PendingRun | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  // ── Near-me location & distances ─────────────────────────────
  const [nearMeLocation, setNearMeLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [nearMeLoading, setNearMeLoading] = useState(false)
  const [nearMeDistanceMap, setNearMeDistanceMap] = useState<Record<string, number | null>>({})
  // Distance mode: "near_me" = from user's GPS, "search_origin" = from each lead's search pin
  const [distanceMode, setDistanceMode] = useState<"near_me" | "search_origin">("near_me")

  // ── Data loading ─────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("leads_full")
      .select("*")
      .order("lead_quality_score", { ascending: false, nullsFirst: false })
    if (!error) setLeads(data || [])
    setLoading(false)
  }, [])

  const loadRuns = useCallback(async () => {
    const { data } = await supabase
      .from("scrape_runs")
      .select("id, queries, leads_found, status, completed_at, started_at")
      .eq("status", "success")
      .order("started_at", { ascending: false })
      .limit(12)
    setRuns(data || [])
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadRuns() }, [loadRuns])

  // ── Auto-request near-me location on mount ───────────────────
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setNearMeLocation(loc)
        // Load cached distances for this location immediately
        const cached = loadNearMeCache(loc.lat, loc.lng)
        if (cached) setNearMeDistanceMap(cached)
      },
      () => { /* Permission denied — distances stay hidden */ },
      { timeout: 10000, maximumAge: 300000 }
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch OSRM distances when location + leads are ready ─────
  useEffect(() => {
    if (!nearMeLocation || leads.length === 0) return
    const { lat, lng } = nearMeLocation
    const cached = loadNearMeCache(lat, lng) ?? {}
    const uncached = leads.filter(l => !(l.place_id in cached) && l.latitude != null)
    if (uncached.length === 0) return // all cached

    setNearMeLoading(true)
    fetchNearMeDistances(lat, lng, leads, cached)
      .then((updated) => {
        setNearMeDistanceMap(updated)
        saveNearMeCache(lat, lng, updated)
      })
      .catch(() => {})
      .finally(() => setNearMeLoading(false))
  }, [nearMeLocation, leads]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pending banner from last search ──────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem("mee_pending_banner")
      if (!raw) return
      const data: PendingRun = JSON.parse(raw)
      const ageMs = Date.now() - new Date(data.completedAt).getTime()
      if (ageMs < 10 * 60 * 1000 && data.runId) {
        setPendingRun(data)
        setFilters((f) => ({ ...f, runId: data.runId }))
        localStorage.removeItem("mee_pending_banner")
        localStorage.setItem("mee_viewed_run", data.runId)
        window.dispatchEvent(new CustomEvent("mee_run_viewed"))
      }
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pendingRun || bannerDismissed) return
    const t = setTimeout(() => setBannerDismissed(true), 30000)
    return () => clearTimeout(t)
  }, [pendingRun, bannerDismissed])

  // ── Refresh ───────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    const [leadsRes, runsRes] = await Promise.all([
      supabase.from("leads_full").select("*").order("lead_quality_score", { ascending: false, nullsFirst: false }),
      supabase.from("scrape_runs").select("id, queries, leads_found, status, completed_at, started_at").eq("status", "success").order("started_at", { ascending: false }).limit(12),
    ])
    if (leadsRes.data) setLeads(leadsRes.data)
    if (runsRes.data)  setRuns(runsRes.data)
    setRefreshing(false)
  }, [])

  // ── Source queries ────────────────────────────────────────────
  const sources = useMemo(() =>
    Array.from(new Set(leads.map((l) => l.source_query).filter(Boolean) as string[])).sort()
  , [leads])

  // ── Filter + sort ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = [...leads]

    if (filters.runId) {
      result = result.filter((l) => l.scrape_run_id === filters.runId)
    }
    if (activeTier !== "all") {
      result = result.filter((l) => getTier(l.lead_quality_score) === activeTier)
    }
    if (filters.sourceQuery && filters.sourceQuery !== "all") {
      result = result.filter((l) => l.source_query === filters.sourceQuery)
    }
    if (filters.search) {
      const s = filters.search.toLowerCase()
      result = result.filter((l) =>
        l.business_name.toLowerCase().includes(s) ||
        l.city?.toLowerCase().includes(s) ||
        l.state?.toLowerCase().includes(s) ||
        l.category?.toLowerCase().includes(s) ||
        l.email?.toLowerCase().includes(s) ||
        l.source_query?.toLowerCase().includes(s)
      )
    }
    switch (filters.hasEmail) {
      case "yes":        result = result.filter((l) => l.email); break
      case "no":         result = result.filter((l) => !l.email); break
      case "phone":      result = result.filter((l) => l.phone || l.website_phone); break
      case "linkedin":   result = result.filter((l) => l.linkedin); break
      case "instagram":  result = result.filter((l) => l.instagram); break
      case "twitter":    result = result.filter((l) => l.twitter); break
      case "facebook":   result = result.filter((l) => l.facebook); break
      case "any_social": result = result.filter((l) => l.linkedin || l.twitter || l.instagram || l.facebook || l.tiktok || l.youtube); break
    }
    if (filters.enriched === "yes") result = result.filter((l) => l.enriched_at)
    if (filters.enriched === "no")  result = result.filter((l) => !l.enriched_at)

    // "Within X km" — uses near-me distance map, falls back to aerial
    if (filters.maxDistKm && nearMeLocation) {
      result = result.filter((l) => {
        const d = nearMeDistanceMap[l.place_id]
          ?? haversineKm(nearMeLocation.lat, nearMeLocation.lng, l.latitude, l.longitude)
        return d == null || d <= filters.maxDistKm!
      })
    }

    result.sort((a, b) => {
      switch (filters.sortBy as SortField) {
        case "score_asc":  return (a.lead_quality_score ?? -1) - (b.lead_quality_score ?? -1)
        case "score_desc": return (b.lead_quality_score ?? -1) - (a.lead_quality_score ?? -1)
        case "name":       return a.business_name.localeCompare(b.business_name)
        case "rating":     return (b.google_rating ?? 0) - (a.google_rating ?? 0)
        case "scraped":    return new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime()
        case "distance": {
          const distFn = (l: Lead) => distanceMode === "search_origin"
            ? haversineKm(l.source_lat, l.source_lng, l.latitude, l.longitude) ?? Infinity
            : nearMeDistanceMap[l.place_id]
              ?? (nearMeLocation ? haversineKm(nearMeLocation.lat, nearMeLocation.lng, l.latitude, l.longitude) : null)
              ?? Infinity
          return distFn(a) - distFn(b)
        }
        default: return 0
      }
    })
    return result
  }, [leads, filters, activeTier, nearMeLocation, nearMeDistanceMap, distanceMode])

  // ── Bulk selection ────────────────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })

  const selectAll = () =>
    setSelectedIds((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((l) => l.place_id))
    )

  // ── Keyboard navigation ───────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault(); setFocusedIndex((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault(); setFocusedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === "Enter" && focusedIndex >= 0) {
        setSelectedLead(filtered[focusedIndex] ?? null)
      } else if (e.key === "Escape") {
        setSelectedLead(null); setFocusedIndex(-1)
      } else if (e.key === "s" && focusedIndex >= 0) {
        const lead = filtered[focusedIndex]
        if (lead) {
          supabase.from("leads").update({ is_starred: !lead.is_starred }).eq("place_id", lead.place_id)
          setLeads((prev) => prev.map((l) => l.place_id === lead.place_id ? { ...l, is_starred: !l.is_starred } : l))
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [filtered, focusedIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBulkEnrich = async (ids: string[]) => {
    await fetch("/api/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ place_ids: ids }),
    })
    setSelectedIds(new Set())
  }

  // Batch Deep Enrich — sequential, 2 at a time. Each run is 5-30s and uses
  // 2 Groq calls, so we cap concurrency to stay under the 30 RPM rate limit.
  const [deepEnrichProgress, setDeepEnrichProgress] = useState<{ current: number; total: number } | null>(null)
  const handleBulkDeepEnrich = async (ids: string[]) => {
    // Filter to leads that have a website (Deep Enrich requires it)
    const eligible = ids.filter((id) => {
      const lead = leads.find((l) => l.place_id === id)
      return !!lead?.website
    })
    if (eligible.length === 0) {
      alert("None of the selected leads have a website. Deep Enrich needs a website to crawl.")
      return
    }
    const skipped = ids.length - eligible.length

    setDeepEnrichProgress({ current: 0, total: eligible.length })
    const CONCURRENCY = 2
    let done = 0
    let failed = 0

    // Simple worker pool
    const queue = [...eligible]
    const worker = async () => {
      while (queue.length > 0) {
        const id = queue.shift()
        if (!id) break
        try {
          const res = await fetch("/api/deep-enrich", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ place_id: id }),
          })
          if (!res.ok) failed++
        } catch {
          failed++
        }
        done++
        setDeepEnrichProgress({ current: done, total: eligible.length })
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

    setDeepEnrichProgress(null)
    setSelectedIds(new Set())

    const succeeded = eligible.length - failed
    const parts: string[] = []
    parts.push(`Deep Enrich complete: ${succeeded} of ${eligible.length} leads`)
    if (failed > 0) parts.push(`${failed} failed`)
    if (skipped > 0) parts.push(`${skipped} skipped (no website)`)
    alert(parts.join(". "))
  }

  const handleBulkExport = (ids: string[]) => {
    exportToCSV(ids.length > 0 ? leads.filter((l) => ids.includes(l.place_id)) : filtered)
  }

  const showBanner = !!pendingRun && !bannerDismissed

  return (
    <div className="min-h-full p-8 space-y-5">

      {/* Welcome banner */}
      {showBanner && (
        <div className="rounded-2xl overflow-hidden animate-fade-in"
          style={{ border: "1px solid rgba(22,163,74,0.25)", background: "rgba(22,163,74,0.05)" }}>
          <div className="px-5 py-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(22,163,74,0.12)" }}>
              <Sparkles size={16} className="text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground leading-snug">
                {pendingRun.leadsFound} new leads discovered
              </p>
              <p className="text-xs text-muted-foreground/70 truncate">
                From: &ldquo;{pendingRun.query}&rdquo;
              </p>
            </div>
            <button
              onClick={() => setFilters((f) => ({ ...f, runId: f.runId === pendingRun.runId ? null : pendingRun.runId }))}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
              style={filters.runId === pendingRun.runId
                ? { background: "rgba(22,163,74,0.15)", color: "#15803d", border: "1px solid rgba(22,163,74,0.3)" }
                : { background: "rgba(22,163,74,0.07)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.18)" }
              }
            >
              <SlidersHorizontal size={11} />
              {filters.runId === pendingRun.runId ? "Showing only these" : "Show only these"}
            </button>
            <button
              onClick={() => { setBannerDismissed(true); setFilters((f) => ({ ...f, runId: null })) }}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-black/5 transition-colors shrink-0"
            >
              <X size={13} />
            </button>
          </div>
          <div className="h-0.5 w-full" style={{ background: "rgba(22,163,74,0.1)" }}>
            <div className="h-full banner-countdown" style={{ background: "rgba(22,163,74,0.45)" }} />
          </div>
        </div>
      )}

      {/* Greeting */}
      <div className="animate-fade-in"><Greeting leads={leads} /></div>

      {/* Stats */}
      {!loading && leads.length > 0 && (
        <div className="animate-fade-up" style={{ animationDelay: "50ms" }}>
          <StatsBar leads={leads} />
        </div>
      )}

      {/* Tier bar */}
      {!loading && leads.length > 0 && (
        <div className="glass-card rounded-2xl px-5 py-4 animate-fade-up" style={{ animationDelay: "120ms" }}>
          <TierBar leads={leads} activeTier={activeTier} onTierChange={setActiveTier} />
        </div>
      )}

      {/* Latest search pill */}
      {!loading && runs.length > 0 && (
        <div className="flex items-center gap-2.5 animate-fade-up" style={{ animationDelay: "140ms" }}>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">Latest:</span>
          <button
            onClick={() => setFilters((f) => ({ ...f, runId: f.runId === runs[0].id ? null : runs[0].id }))}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all hover:scale-[1.02]"
            style={filters.runId === runs[0].id
              ? { background: "rgba(201,168,92,0.18)", color: "#A8843A", border: "1px solid rgba(201,168,92,0.4)" }
              : { background: "rgba(201,168,92,0.07)", color: "#7C6040", border: "1px solid rgba(201,168,92,0.2)" }
            }
          >
            <span style={{ color: "#C9A85C", fontSize: "11px" }}>★</span>
            <span>{truncate(runs[0].queries?.[0] ?? "Latest search", 24)}</span>
            <span className="opacity-60">·</span>
            <span>{runs[0].leads_found ?? "?"} leads</span>
            <Clock size={9} className="opacity-40 ml-0.5" />
            <span className="opacity-60">{timeAgo(runs[0].completed_at ?? runs[0].started_at)}</span>
            {filters.runId === runs[0].id && <X size={9} className="opacity-60 ml-0.5" />}
          </button>
          {filters.runId === runs[0].id && (
            <span className="text-[10px] text-muted-foreground/50">
              showing {filtered.length} leads from this search
            </span>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div className="animate-fade-up" style={{ animationDelay: "150ms" }}>
        <FilterBar
          filters={filters}
          onChange={setFilters}
          compact={compact}
          onToggleCompact={() => setCompact((c) => !c)}
          total={leads.length}
          filtered={filtered.length}
          sources={sources}
          onExportCSV={() => exportToCSV(filtered)}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          runs={runs}
          nearMeLocation={nearMeLocation}
          nearMeLoading={nearMeLoading}
          distanceMode={distanceMode}
          onDistanceModeChange={setDistanceMode}
        />
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton />
      ) : leads.length === 0 ? (
        <EmptyState />
      ) : (
        <LeadsTable
          leads={filtered}
          compact={compact}
          onSelectLead={(l) => { setSelectedLead(l); setFocusedIndex(filtered.indexOf(l)) }}
          selectedLeadId={selectedLead?.place_id}
          focusedIndex={focusedIndex}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onSelectAll={selectAll}
          sortBy={filters.sortBy as SortField}
          onSortChange={(s) => setFilters((f) => ({ ...f, sortBy: s }))}
          nearMeLocation={nearMeLocation}
          nearMeDistanceMap={nearMeDistanceMap}
          distanceMode={distanceMode}
        />
      )}

      <LeadDetailPanel
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onReenrich={async () => load()}
        onGenerateOutreach={(lead) => setOutreachTarget(lead)}
      />
      <BulkActionBar
        selectedIds={selectedIds}
        onClear={() => setSelectedIds(new Set())}
        onEnrich={handleBulkEnrich}
        onDeepEnrich={handleBulkDeepEnrich}
        deepEnrichProgress={deepEnrichProgress}
        onGenerateOutreach={(ids) => {
          const lead = leads.find((l) => ids.includes(l.place_id))
          if (lead) setOutreachTarget(lead)
        }}
        onExport={handleBulkExport}
      />
      <GenerateOutreachModal
        open={outreachTarget !== null}
        onOpenChange={(v) => { if (!v) setOutreachTarget(null) }}
        lead={outreachTarget}
        onComplete={load}
      />
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gold-100/60 bg-gold-50/30">
        <div className="flex gap-4">
          {[120, 80, 60, 100, 80].map((w, i) => (
            <div key={i} className="h-2 bg-gold-100 rounded animate-pulse" style={{ width: w }} />
          ))}
        </div>
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="px-5 py-4 border-b border-gold-100/40 flex items-center gap-4 animate-pulse"
          style={{ animationDelay: `${i * 40}ms` }}>
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-gold-100 rounded w-2/5" />
            <div className="h-2 bg-gold-50 rounded w-1/4" />
          </div>
          <div className="h-2.5 bg-gold-100 rounded w-1/6" />
          <div className="w-9 h-9 rounded-full bg-gold-100" />
          <div className="h-2.5 bg-gold-100 rounded w-1/4" />
          <div className="h-2.5 bg-gold-50 rounded w-1/6" />
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="glass-card rounded-2xl py-24 text-center animate-fade-up">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
        style={{ background: "rgba(201,168,92,0.08)" }}>
        <span className="text-2xl">🎯</span>
      </div>
      <p className="font-display text-xl font-semibold text-foreground mb-2">No leads yet</p>
      <p className="text-sm text-muted-foreground max-w-xs mx-auto">
        Click <strong className="text-foreground font-medium">New Search</strong> in the sidebar to
        scrape Google Maps and start building your lead database.
      </p>
    </div>
  )
}
