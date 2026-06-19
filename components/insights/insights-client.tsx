"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { getTier } from "@/lib/types"
import type { Lead } from "@/lib/types"

export function InsightsClient() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from("leads_full").select("*").then(({ data }) => {
      setLeads(data || [])
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 bg-gold-100 rounded w-40 animate-pulse mb-2" />
        <div className="h-4 bg-gold-50 rounded w-56 animate-pulse" />
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card rounded-2xl h-48 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const total = leads.length
  if (total === 0) {
    return (
      <div className="p-8 min-h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">📊</div>
          <p className="font-display text-xl font-semibold">No data yet</p>
          <p className="text-sm text-muted-foreground mt-1">Run a search to generate insights</p>
        </div>
      </div>
    )
  }

  // ── Computations ─────────────────────────────────────────────
  const enriched  = leads.filter((l) => l.enriched_at)
  const withEmail = leads.filter((l) => l.email)
  const withPhone = leads.filter((l) => l.phone || l.website_phone)
  const withWebsite = leads.filter((l) => l.website)
  const withLinkedIn = leads.filter((l) => l.linkedin || l.linkedin_profiles)
  const withOwner  = leads.filter((l) => l.owner_name)
  const withDesc   = leads.filter((l) => l.company_description)
  const withRating = leads.filter((l) => l.google_rating !== null)

  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0

  // Score distribution used by scatter plot instead of histogram

  // Tier counts
  const tierCounts = {
    Ready:  leads.filter((l) => getTier(l.lead_quality_score) === "Ready").length,
    Review: leads.filter((l) => getTier(l.lead_quality_score) === "Review").length,
    Low:    leads.filter((l) => getTier(l.lead_quality_score) === "Low").length,
    Skip:   leads.filter((l) => getTier(l.lead_quality_score) === "Skip").length,
  }

  // Industry breakdown
  const industryCounts: Record<string, number> = {}
  leads.forEach((l) => {
    const k = l.category || "Uncategorized"
    industryCounts[k] = (industryCounts[k] || 0) + 1
  })
  const industryList = Object.entries(industryCounts).sort((a, b) => b[1] - a[1])
  const industryMax = industryList[0]?.[1] ?? 1

  // Geographic breakdown
  const geoCounts: Record<string, number> = {}
  leads.forEach((l) => {
    const k = [l.city, l.state].filter(Boolean).join(", ") || l.source_country_code?.toUpperCase() || "Unknown"
    geoCounts[k] = (geoCounts[k] || 0) + 1
  })
  const geoList = Object.entries(geoCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const geoMax = geoList[0]?.[1] ?? 1

  // Source queries
  const queryCounts: Record<string, number> = {}
  leads.forEach((l) => {
    if (l.source_query) queryCounts[l.source_query] = (queryCounts[l.source_query] || 0) + 1
  })
  const queryList = Object.entries(queryCounts).sort((a, b) => b[1] - a[1])

  // Top leads
  const topLeads = [...leads]
    .filter((l) => l.lead_quality_score !== null)
    .sort((a, b) => (b.lead_quality_score ?? 0) - (a.lead_quality_score ?? 0))
    .slice(0, 5)

  const avgScore = enriched.length > 0
    ? Math.round(enriched.reduce((s, l) => s + (l.lead_quality_score ?? 0), 0) / enriched.length)
    : 0

  return (
    <div className="min-h-full p-8 space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="font-display text-[30px] font-bold text-foreground tracking-tight">Insights</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Analytics across {total} leads · {enriched.length} enriched
        </p>
      </div>

      {/* Score overview + tier donut-like display */}
      <div className="grid grid-cols-3 gap-4 animate-fade-up" style={{ animationDelay: "40ms" }}>
        {/* Avg score card */}
        <div className="glass-card rounded-2xl p-5 flex items-center gap-5">
          <div className="relative w-20 h-20 shrink-0">
            <svg width="80" height="80" className="-rotate-90">
              <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(201,168,92,0.12)" strokeWidth="6" />
              <circle cx="40" cy="40" r="32" fill="none" stroke="#C9A85C" strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 32}`}
                strokeDashoffset={`${2 * Math.PI * 32 * (1 - avgScore / 100)}`}
                style={{ transition: "stroke-dashoffset 1s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-display text-2xl font-bold" style={{ color: "#C9A85C" }}>{avgScore}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55 mb-1">Avg Score</p>
            <p className="text-sm text-muted-foreground">{enriched.length} enriched leads</p>
            <p className="text-xs text-muted-foreground/60 mt-1">of 100 possible</p>
          </div>
        </div>

        {/* Tier breakdown */}
        <div className="glass-card rounded-2xl p-5 col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55 mb-4">
            Score Tier Breakdown
          </p>
          <div className="grid grid-cols-4 gap-3">
            {[
              { tier: "Ready",  count: tierCounts.Ready,  color: "#16a34a", bg: "#f0fdf4", range: "75–100" },
              { tier: "Review", count: tierCounts.Review, color: "#d97706", bg: "#fffbeb", range: "50–74"  },
              { tier: "Low",    count: tierCounts.Low,    color: "#ea580c", bg: "#fff7ed", range: "25–49"  },
              { tier: "Skip",   count: tierCounts.Skip,   color: "#dc2626", bg: "#fef2f2", range: "0–24"   },
            ].map(({ tier, count, color, bg, range }) => (
              <div key={tier} className="rounded-xl p-3 text-center" style={{ background: bg, border: `1px solid ${color}22` }}>
                <div className="font-display text-2xl font-bold" style={{ color }}>{count}</div>
                <div className="text-xs font-semibold mt-0.5" style={{ color }}>{tier}</div>
                <div className="text-[10px] text-muted-foreground/60 mt-0.5">{range}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tier donut chart */}
      <div className="glass-card rounded-2xl p-5 animate-fade-up" style={{ animationDelay: "80ms" }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55 mb-4">
          Lead Quality Distribution
        </p>
        <DonutChart
          data={[
            { label: "Ready (75–100)",   value: tierCounts.Ready,  color: "#16a34a" },
            { label: "Review (50–74)",   value: tierCounts.Review, color: "#d97706" },
            { label: "Low (25–49)",      value: tierCounts.Low,    color: "#ea580c" },
            { label: "Skip (0–24)",      value: tierCounts.Skip,   color: "#dc2626" },
          ]}
          centerValue={total}
          centerLabel="leads"
        />
      </div>

      {/* Industry + Geo side by side */}
      <div className="grid grid-cols-2 gap-4 animate-fade-up" style={{ animationDelay: "120ms" }}>
        {/* Industry — full names, scroll if needed */}
        <div className="glass-card rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55 mb-4">
            Industry Breakdown
          </p>
          {/* pr-5 reserves space for the scrollbar so it never overlaps the % values */}
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-5" style={{ scrollbarGutter: "stable" }}>
            {industryList.map(([cat, count]) => (
              <div key={cat} className="group">
                <div className="flex items-center justify-between mb-1">
                  {/* Full name, wraps if needed */}
                  <span className="text-xs text-muted-foreground/80 leading-tight flex-1 pr-3">{cat}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-semibold text-foreground/70 tabular-nums w-6 text-right">{count}</span>
                    <span className="text-[10px] text-muted-foreground/50 w-9 text-right">
                      {pct(count)}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(201,168,92,0.1)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${(count / industryMax) * 100}%`, background: "linear-gradient(90deg, #D4A853, #C9A85C)" }}
                  />
                </div>
              </div>
            ))}
          </div>
          {industryList.length > 8 && (
            <p className="text-[10px] text-muted-foreground/50 mt-2 text-center">
              {industryList.length} total industries
            </p>
          )}
        </div>

        {/* Geographic breakdown */}
        <div className="glass-card rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55 mb-4">
            Geographic Distribution
          </p>
          <div className="space-y-2.5">
            {geoList.map(([loc, count]) => (
              <div key={loc}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground/80">{loc}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground/70 tabular-nums">{count}</span>
                    <span className="text-[10px] text-muted-foreground/50">{pct(count)}%</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(201,168,92,0.1)" }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${(count / geoMax) * 100}%`, background: "#6366f1" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Data completeness + Top leads */}
      <div className="grid grid-cols-2 gap-4 animate-fade-up" style={{ animationDelay: "160ms" }}>
        {/* Data completeness — simple grid */}
        <div className="glass-card rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55 mb-4">
            Data Completeness
          </p>
          <div className="grid grid-cols-2 gap-x-5 gap-y-3">
            {[
              { label: "Enriched",   count: enriched.length,     color: "#C9A85C" },
              { label: "Email",      count: withEmail.length,    color: "#16a34a" },
              { label: "Phone",      count: withPhone.length,    color: "#0891b2" },
              { label: "Website",    count: withWebsite.length,  color: "#6366f1" },
              { label: "LinkedIn",   count: withLinkedIn.length, color: "#0a66c2" },
              { label: "Owner",      count: withOwner.length,    color: "#d97706" },
              { label: "Description",count: withDesc.length,     color: "#7c3aed" },
              { label: "Rating",     count: withRating.length,   color: "#f59e0b" },
            ].map(({ label, count, color }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-xs font-bold tabular-nums" style={{ color }}>{pct(count)}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(201,168,92,0.1)" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct(count)}%`, background: color, transition: "width 0.8s ease" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 leads */}
        <div className="glass-card rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55 mb-4">
            Top 5 Leads by Score
          </p>
          <div className="space-y-2">
            {topLeads.map((l, i) => {
              const tier = getTier(l.lead_quality_score)
              const tierColor = tier === "Ready" ? "#16a34a" : tier === "Review" ? "#d97706" : tier === "Low" ? "#ea580c" : "#dc2626"
              return (
                <div key={l.place_id} className="flex items-center gap-3 py-2 px-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(201,168,92,0.12)" }}>
                  <span className="text-xs text-muted-foreground/50 font-semibold w-4">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{l.business_name}</p>
                    <p className="text-[10px] text-muted-foreground/60">
                      {l.city ? `${l.city}` : ""}{l.category ? ` · ${l.category}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-display text-lg font-bold" style={{ color: tierColor }}>
                      {l.lead_quality_score}
                    </span>
                    <div className="text-[9px] font-semibold uppercase" style={{ color: tierColor }}>{tier}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Source queries summary */}
          {queryList.length > 0 && (
            <div className="mt-4 pt-3" style={{ borderTop: "1px solid rgba(201,168,92,0.12)" }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55 mb-2">
                Source Queries
              </p>
              <div className="flex flex-wrap gap-1.5">
                {queryList.slice(0, 4).map(([q, c]) => (
                  <span key={q} className="text-[11px] px-2 py-0.5 rounded-md"
                    style={{ background: "rgba(201,168,92,0.08)", border: "1px solid rgba(201,168,92,0.2)", color: "#7C5C28" }}>
                    {q} ({c})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Donut chart ───────────────────────────────────────────────────
function DonutChart({
  data,
  centerValue,
  centerLabel,
}: {
  data: { label: string; value: number; color: string }[]
  centerValue?: number | string
  centerLabel?: string
}) {
  const r = 40, strokeW = 13, cx = 54, cy = 54
  const circumference = 2 * Math.PI * r
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <div className="text-center py-6 text-sm text-muted-foreground/60">No data</div>

  let offset = 0
  const GAP = circumference * 0.015

  return (
    // max-w-sm keeps the chart compact — prevents legend from stretching full card width
    <div className="flex items-center gap-6 max-w-sm">
      <svg width="108" height="108" viewBox="0 0 108 108" className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(201,168,92,0.1)" strokeWidth={strokeW} />
        {data.map((d) => {
          if (d.value === 0) return null
          const segLen = (d.value / total) * circumference - GAP
          const dashOffset = -(offset + GAP / 2)
          offset += (d.value / total) * circumference
          return (
            <circle key={d.label} cx={cx} cy={cy} r={r} fill="none"
              stroke={d.color} strokeWidth={strokeW} strokeLinecap="round"
              strokeDasharray={`${segLen} ${circumference}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: "stroke-dasharray 0.7s ease" }} />
          )
        })}
        {centerValue !== undefined && (
          <text x={cx} y={centerLabel ? cy - 5 : cy} textAnchor="middle" dominantBaseline="middle"
            fontSize="17" fontWeight="700" fontFamily="Georgia, serif" fill="currentColor">
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text x={cx} y={cy + 11} textAnchor="middle" dominantBaseline="middle"
            fontSize="8" fontFamily="system-ui" fill="rgba(0,0,0,0.4)"
            style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {centerLabel}
          </text>
        )}
      </svg>
      {/* Legend — fixed width so items stay close to the chart */}
      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-xs text-muted-foreground leading-tight w-28 shrink-0">{d.label}</span>
            <span className="text-sm font-semibold tabular-nums ml-1" style={{ color: d.color }}>{d.value}</span>
            <span className="text-[10px] text-muted-foreground/50 w-7 text-right shrink-0">
              {Math.round((d.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
