"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"

interface PipelineCounts {
  draft: number
  sent: number
  replied: number
}

export function OutreachPipeline() {
  const [counts, setCounts] = useState<PipelineCounts | null>(null)

  useEffect(() => {
    supabase
      .from("lead_outreach")
      .select("status")
      .then(({ data }) => {
        if (!data) return
        const c: PipelineCounts = { draft: 0, sent: 0, replied: 0 }
        data.forEach((r) => {
          if (r.status === "draft")   c.draft++
          if (r.status === "sent")    c.sent++
          if (r.status === "replied") c.replied++
        })
        setCounts(c)
      })
  }, [])

  if (!counts) return null
  const total = counts.draft + counts.sent + counts.replied
  if (total === 0) return null

  const stages = [
    { key: "draft",   label: "Draft",   emoji: "📨", count: counts.draft,   color: "#C9A85C",  bg: "rgba(201,168,92,0.09)"  },
    { key: "sent",    label: "Sent",    emoji: "✈️", count: counts.sent,    color: "#6366f1",  bg: "rgba(99,102,241,0.08)"  },
    { key: "replied", label: "Replied", emoji: "💬", count: counts.replied, color: "#16a34a",  bg: "rgba(22,163,74,0.08)"   },
  ]

  return (
    <div
      className="glass-card rounded-2xl px-5 py-4"
      style={{ animationDelay: "80ms" }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground/55">
          Outreach Pipeline
        </p>
        <span className="text-[11px] text-muted-foreground/60">{total} messages</span>
      </div>

      <div className="flex items-center gap-3">
        {stages.map((stage, i) => (
          <div key={stage.key} className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: stage.bg, border: `1px solid ${stage.color}22` }}
            >
              <span className="text-base leading-none">{stage.emoji}</span>
              <div>
                <div className="font-display text-xl font-bold leading-none tabular-nums" style={{ color: stage.color }}>
                  {stage.count}
                </div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5">{stage.label}</div>
              </div>
            </div>
            {i < stages.length - 1 && (
              <div className="flex items-center gap-0.5">
                <div className="w-3 h-px" style={{ background: "rgba(201,168,92,0.3)" }} />
                <div className="text-[10px] text-muted-foreground/35">›</div>
                <div className="w-3 h-px" style={{ background: "rgba(201,168,92,0.3)" }} />
              </div>
            )}
          </div>
        ))}

        {/* Conversion rate */}
        {counts.sent > 0 && (
          <div className="ml-auto text-right">
            <div className="text-xs text-muted-foreground">Reply rate</div>
            <div className="font-display text-lg font-bold" style={{ color: "#16a34a" }}>
              {Math.round((counts.replied / Math.max(counts.sent, 1)) * 100)}%
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="flex h-1 rounded-full overflow-hidden gap-px mt-3">
          {counts.draft > 0 && (
            <div className="h-full rounded-full" style={{ width: `${(counts.draft/total)*100}%`, background: "#C9A85C", opacity: 0.6 }} />
          )}
          {counts.sent > 0 && (
            <div className="h-full rounded-full" style={{ width: `${(counts.sent/total)*100}%`, background: "#6366f1" }} />
          )}
          {counts.replied > 0 && (
            <div className="h-full rounded-full" style={{ width: `${(counts.replied/total)*100}%`, background: "#16a34a" }} />
          )}
        </div>
      )}
    </div>
  )
}
