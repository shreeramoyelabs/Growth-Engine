"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { Send, MessageSquare, Reply, Mail } from "lucide-react"
import type { LeadOutreach } from "@/lib/types"

interface OutreachRow extends LeadOutreach {
  business_name?: string
  city?: string
  lead_quality_score?: number | null
}

type Channel = "email" | "linkedin" | "whatsapp"

export function OutreachClient() {
  const [rows, setRows]       = useState<OutreachRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from("lead_outreach").select("*").order("generated_at", { ascending: false }),
      supabase.from("leads_full").select("place_id, business_name, city, lead_quality_score"),
    ]).then(([{ data: outreach }, { data: leads }]) => {
      const leadMap = new Map((leads ?? []).map((l) => [l.place_id, l]))
      setRows(
        (outreach ?? []).map((o) => ({
          ...o,
          business_name: leadMap.get(o.place_id)?.business_name,
          city:          leadMap.get(o.place_id)?.city ?? undefined,
          lead_quality_score: leadMap.get(o.place_id)?.lead_quality_score,
        }))
      )
      setLoading(false)
    })
  }, [])

  const total    = rows.length
  const drafts   = rows.filter((r) => r.status === "draft").length
  const sent     = rows.filter((r) => r.status === "sent").length
  const replied  = rows.filter((r) => r.status === "replied").length
  const replyRate = sent > 0 ? Math.round((replied / sent) * 100) : 0

  const byChannel = (ch: Channel) => rows.filter((r) => r.channel === ch)

  const channelData: { ch: Channel; emoji: string; label: string; color: string }[] = [
    { ch: "email",    emoji: "✉️", label: "Email",    color: "#6366f1" },
    { ch: "linkedin", emoji: "💼", label: "LinkedIn", color: "#0a66c2" },
    { ch: "whatsapp", emoji: "💬", label: "WhatsApp", color: "#16a34a" },
  ]

  const toneData = ["professional", "conversational", "direct"].map((t) => ({
    tone: t, count: rows.filter((r) => r.tone === t).length, label: t[0].toUpperCase() + t.slice(1),
  }))

  const topPersonalized = [...rows]
    .filter((r) => r.personalization_score !== null)
    .sort((a, b) => (b.personalization_score ?? 0) - (a.personalization_score ?? 0))
    .slice(0, 5)

  const recentDrafts = rows.filter((r) => r.status === "draft").slice(0, 8)

  if (loading) {
    return (
      <div className="p-8 min-h-full">
        <div className="mb-8 animate-pulse">
          <div className="h-8 bg-gold-100 rounded w-48 mb-2" />
          <div className="h-4 bg-gold-50 rounded w-64" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card rounded-2xl h-24 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (total === 0) {
    return (
      <div className="p-8 min-h-full flex flex-col items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
            style={{ background: "rgba(201,168,92,0.08)" }}>
            <Send size={32} style={{ color: "#C9A85C" }} />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">No outreach yet</h2>
          <p className="text-sm text-muted-foreground">
            Go to a lead in Intelligence, click Generate Outreach, and your pipeline will appear here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full p-8 space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="font-display text-[30px] font-bold text-foreground tracking-tight">Outreach</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {total} messages across {new Set(rows.map((r) => r.place_id)).size} leads
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4 animate-fade-up" style={{ animationDelay: "40ms" }}>
        {[
          { label: "Total Messages", value: total,   icon: MessageSquare, color: "#C9A85C" },
          { label: "Drafts",         value: drafts,  icon: Mail,          color: "#C9A85C" },
          { label: "Sent",           value: sent,    icon: Send,          color: "#6366f1" },
          { label: "Replied",        value: replied, icon: Reply,         color: "#16a34a" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card glass-card-hover rounded-2xl px-5 py-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55 mb-2">{label}</p>
                <span className="font-display text-[34px] font-bold leading-none tabular-nums" style={{ color }}>
                  {value}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}12` }}>
                <Icon size={16} style={{ color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline donut + Channel + Tone */}
      <div className="grid grid-cols-3 gap-4 animate-fade-up" style={{ animationDelay: "80ms" }}>
        {/* Donut: pipeline breakdown */}
        <div className="glass-card rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55 mb-4">
            Pipeline Breakdown
          </p>
          <DonutChart
            data={[
              { label: "Draft",   value: drafts,  color: "#C9A85C" },
              { label: "Sent",    value: sent,    color: "#6366f1" },
              { label: "Replied", value: replied, color: "#16a34a" },
            ]}
            centerValue={total}
            centerLabel="total"
          />
          {replyRate > 0 && (
            <div className="mt-4 pt-3 flex items-center justify-between"
              style={{ borderTop: "1px solid rgba(201,168,92,0.15)" }}>
              <span className="text-xs text-muted-foreground">Reply rate</span>
              <span className="font-display text-xl font-bold" style={{ color: "#16a34a" }}>{replyRate}%</span>
            </div>
          )}
        </div>

        {/* Channel breakdown */}
        <div className="glass-card rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55 mb-4">
            By Channel
          </p>
          <div className="space-y-3">
            {channelData.map(({ ch, emoji, label, color }) => {
              const count = byChannel(ch).length
              const pct   = total > 0 ? (count / total) * 100 : 0
              const sentN = byChannel(ch).filter((r) => r.status === "sent").length
              return (
                <div key={ch}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-2 text-sm"><span>{emoji}</span>{label}</span>
                    <div className="text-right">
                      <span className="text-sm font-semibold" style={{ color }}>{count}</span>
                      {sentN > 0 && <span className="text-[10px] text-muted-foreground ml-1.5">({sentN} sent)</span>}
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(201,168,92,0.1)" }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tone breakdown */}
        <div className="glass-card rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55 mb-4">
            By Tone
          </p>
          <div className="space-y-3">
            {toneData.map(({ tone, count, label }) => {
              const pct = total > 0 ? (count / total) * 100 : 0
              return (
                <div key={tone}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="text-sm font-semibold text-foreground/80">{count}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(201,168,92,0.1)" }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: "linear-gradient(90deg, #D4A853, #C9A85C)" }} />
                  </div>
                </div>
              )
            })}
          </div>
          {rows.some((r) => r.personalization_score) && (() => {
            const scores = rows.filter((r) => r.personalization_score).map((r) => r.personalization_score ?? 0)
            const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
            return (
              <div className="mt-4 pt-3 flex items-center justify-between"
                style={{ borderTop: "1px solid rgba(201,168,92,0.15)" }}>
                <span className="text-xs text-muted-foreground">Avg personalization</span>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map((i) => (
                    <div key={i} className="w-2 h-2 rounded-full"
                      style={{ background: i <= Math.round(parseFloat(avg)) ? "#C9A85C" : "rgba(201,168,92,0.15)" }} />
                  ))}
                  <span className="text-sm font-semibold ml-1" style={{ color: "#C9A85C" }}>{avg}/5</span>
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Top personalized + Drafts ready */}
      <div className="grid grid-cols-2 gap-4 animate-fade-up" style={{ animationDelay: "120ms" }}>
        <div className="glass-card rounded-2xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55 mb-4">
            Top Personalized
          </p>
          <div className="space-y-2.5">
            {topPersonalized.length === 0 ? (
              <p className="text-sm text-muted-foreground/60 text-center py-4">No scores yet</p>
            ) : topPersonalized.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 py-1.5 px-2 rounded-xl hover:bg-gold-50/50 transition-colors">
                <span className="text-xs text-muted-foreground/50 w-4 text-center font-semibold">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.business_name || r.place_id}</p>
                  <p className="text-[10px] text-muted-foreground/60">
                    {r.channel === "email" ? "✉️" : r.channel === "linkedin" ? "💼" : "💬"} {r.channel}
                    {r.city ? ` · ${r.city}` : ""}
                  </p>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  {[1,2,3,4,5].map((d) => (
                    <div key={d} className="w-2 h-2 rounded-full"
                      style={{ background: d <= (r.personalization_score ?? 0) ? "#C9A85C" : "rgba(201,168,92,0.15)" }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55">
              Drafts Ready to Send
            </p>
            <span className="text-xs text-muted-foreground">{drafts} waiting</span>
          </div>
          <div className="space-y-2">
            {recentDrafts.length === 0 ? (
              <p className="text-sm text-muted-foreground/60 text-center py-4">No drafts</p>
            ) : recentDrafts.map((r) => (
              <DraftRow key={r.id} row={r}
                onStatusChange={() => setRows((prev) => prev.map((p) => p.id === r.id ? { ...p, status: "sent" } : p))} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Donut chart ────────────────────────────────────────────────────
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

  if (total === 0) return <div className="text-center py-6 text-sm text-muted-foreground/60">No data yet</div>

  let offset = 0
  const GAP = circumference * 0.015

  return (
    <div className="flex items-center gap-5">
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
      <div className="space-y-2.5 flex-1">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-sm text-muted-foreground flex-1">{d.label}</span>
            <span className="text-sm font-semibold tabular-nums" style={{ color: d.color }}>{d.value}</span>
            <span className="text-[10px] text-muted-foreground/50 w-8 text-right">
              {Math.round((d.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Draft row ──────────────────────────────────────────────────────
function DraftRow({ row, onStatusChange }: { row: OutreachRow; onStatusChange: () => void }) {
  const [marking, setMarking] = useState(false)

  const handleMark = async () => {
    setMarking(true)
    await supabase.from("lead_outreach").update({ status: "sent" }).eq("id", row.id)
    onStatusChange()
    setMarking(false)
  }

  const chEmoji = row.channel === "email" ? "✉️" : row.channel === "linkedin" ? "💼" : "💬"

  return (
    <div className="flex items-center gap-3 py-2 px-2.5 rounded-xl"
      style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(201,168,92,0.12)" }}>
      <span className="text-base shrink-0">{chEmoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground truncate">{row.business_name || row.place_id}</p>
        {row.subject_line && (
          <p className="text-[10px] text-muted-foreground/60 truncate">{row.subject_line}</p>
        )}
      </div>
      {row.channel === "whatsapp" && row.whatsapp_link ? (
        <a href={row.whatsapp_link} target="_blank" rel="noopener noreferrer"
          className="text-[11px] px-2.5 py-1 rounded-lg font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-colors shrink-0">
          Open
        </a>
      ) : (
        <button onClick={handleMark} disabled={marking}
          className="text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0"
          style={{ background: "rgba(201,168,92,0.12)", color: "#A8843A", border: "1px solid rgba(201,168,92,0.25)" }}>
          {marking ? "…" : "Sent"}
        </button>
      )}
    </div>
  )
}
