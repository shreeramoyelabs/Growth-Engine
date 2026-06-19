"use client"

import { Search, Rows3, AlignJustify, Download, RefreshCw, Keyboard, X, ChevronDown, MapPin } from "lucide-react"
import { Input } from "@/components/ui/input"
import { truncate, timeAgo, fmtKm } from "@/lib/format"

export type Filters = {
  search: string
  hasEmail: string
  enriched: string
  sortBy: string
  sourceQuery: string
  runId: string | null
  maxDistKm: number | null    // "within X km" of near-me location
}

export interface RunRecord {
  id: string
  queries: string[] | null
  leads_found: number | null
  completed_at: string | null
  started_at: string
  status?: string
}

const SORT_OPTIONS = [
  { value: "score_desc", label: "Score: High → Low" },
  { value: "score_asc",  label: "Score: Low → High" },
  { value: "name",       label: "Business Name" },
  { value: "rating",     label: "Google Rating" },
  { value: "scraped",    label: "Most Recent" },
  { value: "distance",   label: "Distance: Nearest" },
]

const WITHIN_OPTIONS = [
  { value: "all",  label: "Any distance" },
  { value: "5",    label: "Within 5 km" },
  { value: "10",   label: "Within 10 km" },
  { value: "25",   label: "Within 25 km" },
  { value: "50",   label: "Within 50 km" },
  { value: "100",  label: "Within 100 km" },
]

function formatRunLabel(run: RunRecord, maxLen = 26): string {
  const query = run.queries?.[0] ?? "Search"
  const count = run.leads_found != null ? `${run.leads_found} leads` : "?"
  const when  = run.completed_at ? timeAgo(run.completed_at) : timeAgo(run.started_at)
  return `${truncate(query, maxLen)} · ${count} · ${when}`
}

// ── Reusable styled native <select> ─────────────────────────────
function FilterSelect({
  value, onChange, options, width = 136, active = false,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  width?: number
  active?: boolean
}) {
  return (
    <div className="relative inline-flex shrink-0" style={{ width }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 pl-3 pr-7 text-sm rounded-lg border appearance-none cursor-pointer outline-none transition-colors"
        style={active
          ? { borderColor: "rgba(201,168,92,0.6)", background: "rgba(201,168,92,0.06)", color: "#A8843A" }
          : { borderColor: "rgba(201,168,92,0.5)", background: "rgba(255,255,255,0.75)", color: "inherit" }
        }
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: active ? "#A8843A" : undefined, opacity: active ? 0.8 : 0.45 }}
      />
    </div>
  )
}

interface FilterBarProps {
  filters: Filters
  onChange: (f: Filters) => void
  compact: boolean
  onToggleCompact: () => void
  total: number
  filtered: number
  sources: string[]
  onExportCSV: () => void
  onRefresh: () => void
  refreshing: boolean
  runs?: RunRecord[]
  // Near-me + distance mode
  nearMeLocation?: { lat: number; lng: number } | null
  nearMeLoading?: boolean
  distancesLoading?: boolean
  distanceMode?: "near_me" | "search_origin"
  onDistanceModeChange?: (mode: "near_me" | "search_origin") => void
}

export function FilterBar({
  filters, onChange, compact, onToggleCompact,
  total, filtered, sources, onExportCSV, onRefresh, refreshing,
  runs = [], nearMeLocation = null, nearMeLoading = false, distancesLoading = false,
  distanceMode = "near_me", onDistanceModeChange,
}: FilterBarProps) {
  const set = (key: keyof Filters, value: string | null | number) =>
    onChange({ ...filters, [key]: value } as Filters)

  const clearAll = () => onChange({
    search: "", hasEmail: "all", enriched: "all",
    sortBy: filters.sortBy, sourceQuery: "all", runId: null, maxDistKm: null,
  })

  // Active filter chips
  const selectedRun = runs.find((r) => r.id === filters.runId)
  const activeChips: { label: string; onRemove: () => void }[] = []
  if (filters.runId) {
    const label = selectedRun ? truncate(selectedRun.queries?.[0] ?? "search", 24) : "latest batch"
    activeChips.push({ label: `Batch: ${label}`, onRemove: () => set("runId", null) })
  }
  if (filters.maxDistKm) activeChips.push({ label: `Within ${fmtKm(filters.maxDistKm)}`, onRemove: () => set("maxDistKm", null) })
  if (filters.hasEmail !== "all") {
    const LABELS: Record<string, string> = {
      yes: "Has email", no: "No email", phone: "Has phone", linkedin: "Has LinkedIn",
      instagram: "Has Instagram", twitter: "Has Twitter/X", facebook: "Has Facebook", any_social: "Has any social",
    }
    activeChips.push({ label: LABELS[filters.hasEmail] ?? filters.hasEmail, onRemove: () => set("hasEmail", "all") })
  }
  if (filters.enriched !== "all")    activeChips.push({ label: filters.enriched === "yes" ? "Enriched" : "Not enriched", onRemove: () => set("enriched", "all") })
  if (filters.sourceQuery !== "all") activeChips.push({ label: `Source: ${truncate(filters.sourceQuery, 22)}`, onRemove: () => set("sourceQuery", "all") })

  // Runs dropdown options
  const runsOptions = [
    { value: "all", label: "All searches" },
    ...runs.map((r, i) => ({
      value: r.id,
      label: i === 0 ? `★ ${formatRunLabel(r, 22)}` : formatRunLabel(r, 26),
    })),
  ]

  // Source options
  const sourceOptions = [
    { value: "all", label: "All sources" },
    ...sources.map((s) => ({ value: s, label: truncate(s, 32) })),
  ]

  const hasNearMe = !!nearMeLocation

  return (
    <div className="space-y-2">
      {/* ── Distance mode toggle ── */}
      {hasNearMe && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60 flex-wrap">
          <MapPin size={10} style={{ color: "#C9A85C" }} className="shrink-0" />
          <span className="shrink-0">Distances from:</span>

          {/* Segmented toggle */}
          <div className="flex rounded-lg overflow-hidden shrink-0"
            style={{ border: "1px solid rgba(201,168,92,0.3)", background: "rgba(255,255,255,0.5)" }}>
            <button
              onClick={() => onDistanceModeChange?.("near_me")}
              className="px-2.5 py-1 text-[10px] font-medium transition-colors"
              style={distanceMode === "near_me"
                ? { background: "rgba(201,168,92,0.2)", color: "#A8843A" }
                : { color: "inherit" }
              }
              title="Distances from your current GPS location"
            >
              📍 My location
            </button>
            <button
              onClick={() => onDistanceModeChange?.("search_origin")}
              className="px-2.5 py-1 text-[10px] font-medium transition-colors"
              style={{
                borderLeft: "1px solid rgba(201,168,92,0.2)",
                ...(distanceMode === "search_origin"
                  ? { background: "rgba(201,168,92,0.2)", color: "#A8843A" }
                  : {}),
              }}
              title="Distances from the original search pin for each lead"
            >
              🔍 Search pin
            </button>
          </div>

          {/* Loading indicator (near-me OSRM only) */}
          {(nearMeLoading || distancesLoading) && distanceMode === "near_me" && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 live-dot shrink-0" />
              <span>computing road distances…</span>
            </span>
          )}
          {distanceMode === "search_origin" && (
            <span className="text-muted-foreground/40 italic">aerial · from each search pin</span>
          )}
        </div>
      )}

      {/* ── Main filter row ── */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search businesses, cities, emails…"
            className="pl-9 h-9 text-sm border-gold-200/80 bg-white/75 focus-visible:ring-gold-300 focus-visible:border-gold-300 placeholder:text-muted-foreground/55"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
          />
        </div>

        {/* Within X km (only when near-me is active) */}
        {hasNearMe && (
          <FilterSelect
            value={filters.maxDistKm ? String(filters.maxDistKm) : "all"}
            onChange={(v) => set("maxDistKm", v === "all" ? null : parseInt(v))}
            options={WITHIN_OPTIONS}
            width={140}
            active={!!filters.maxDistKm}
          />
        )}

        {/* Contact filter */}
        <FilterSelect
          value={filters.hasEmail}
          onChange={(v) => set("hasEmail", v)}
          options={[
            { value: "all",        label: "Any contact" },
            { value: "yes",        label: "Has email" },
            { value: "no",         label: "No email" },
            { value: "phone",      label: "Has phone" },
            { value: "linkedin",   label: "Has LinkedIn" },
            { value: "instagram",  label: "Has Instagram" },
            { value: "twitter",    label: "Has Twitter / X" },
            { value: "facebook",   label: "Has Facebook" },
            { value: "any_social", label: "Has any social" },
          ]}
          width={152}
          active={filters.hasEmail !== "all"}
        />

        {/* Enriched filter */}
        <FilterSelect
          value={filters.enriched}
          onChange={(v) => set("enriched", v)}
          options={[
            { value: "all", label: "Any status" },
            { value: "yes", label: "Enriched" },
            { value: "no",  label: "Not enriched" },
          ]}
          width={140}
          active={filters.enriched !== "all"}
        />

        {/* Search Runs dropdown */}
        {runs.length > 0 && (
          <FilterSelect
            value={filters.runId ?? "all"}
            onChange={(v) => onChange({ ...filters, runId: v === "all" ? null : v } as Filters)}
            options={runsOptions}
            width={224}
            active={!!filters.runId}
          />
        )}

        {/* Source query filter */}
        {sources.length > 1 && (
          <FilterSelect
            value={filters.sourceQuery}
            onChange={(v) => set("sourceQuery", v)}
            options={sourceOptions}
            width={164}
            active={filters.sourceQuery !== "all"}
          />
        )}

        {/* Sort */}
        <FilterSelect
          value={filters.sortBy}
          onChange={(v) => set("sortBy", v)}
          options={SORT_OPTIONS}
          width={172}
          active={false}
        />

        {/* Result count */}
        <span className="text-sm text-muted-foreground ml-auto shrink-0">
          {filtered === total ? (
            <>{total} leads</>
          ) : (
            <><span className="font-semibold text-foreground">{filtered}</span> of {total}</>
          )}
        </span>

        {/* Refresh */}
        <button onClick={onRefresh} disabled={refreshing} title="Refresh leads"
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-gold-200/80 bg-white/75 text-muted-foreground hover:text-gold-600 hover:bg-gold-50 transition-colors shrink-0 disabled:opacity-40">
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
        </button>

        {/* CSV Export */}
        <button onClick={onExportCSV} title="Export filtered leads to CSV"
          className="h-9 px-3 flex items-center gap-1.5 rounded-lg border border-gold-200/80 bg-white/75 text-muted-foreground hover:text-gold-600 hover:bg-gold-50 transition-colors shrink-0 text-xs font-medium">
          <Download size={13} /> Export
        </button>

        {/* Density toggle */}
        <button onClick={onToggleCompact} title={compact ? "Comfortable spacing" : "Compact spacing"}
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-gold-200/80 bg-white/75 text-muted-foreground hover:text-gold-600 hover:bg-gold-50 transition-colors shrink-0">
          {compact ? <AlignJustify size={15} /> : <Rows3 size={15} />}
        </button>

        {/* Keyboard hint */}
        <button
          title="Keyboard shortcuts: j/k navigate · Enter open · Esc close · s star"
          className="h-9 w-9 flex items-center justify-center rounded-lg border border-gold-200/80 bg-white/75 text-muted-foreground hover:text-gold-600 hover:bg-gold-50 transition-colors shrink-0"
        >
          <Keyboard size={14} />
        </button>
      </div>

      {/* ── Active filter chips ── */}
      {activeChips.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground/55 uppercase tracking-wide font-semibold">Filters:</span>
          {activeChips.map((chip) => (
            <button
              key={chip.label}
              onClick={chip.onRemove}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
              style={{ background: "rgba(201,168,92,0.1)", border: "1px solid rgba(201,168,92,0.3)", color: "#A8843A" }}
            >
              {chip.label}
              <X size={10} className="opacity-70" />
            </button>
          ))}
          {activeChips.length > 1 && (
            <button onClick={clearAll}
              className="text-xs text-muted-foreground/60 hover:text-destructive transition-colors underline underline-offset-2">
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  )
}
