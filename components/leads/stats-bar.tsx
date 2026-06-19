"use client"

import { useEffect, useRef, useState } from "react"
import { Target, Mail, TrendingUp, Sparkles } from "lucide-react"
import type { Lead } from "@/lib/types"

function useCountUp(target: number, duration = 1000, delay = 0) {
  const [value, setValue] = useState(0)
  const frameRef = useRef<number>()

  useEffect(() => {
    const startTime = performance.now() + delay
    const animate = (now: number) => {
      if (now < startTime) {
        frameRef.current = requestAnimationFrame(animate)
        return
      }
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [target, duration, delay])

  return value
}

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: number
  suffix?: string
  sublabel?: string
  delay?: number
  accentColor?: string
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix = "",
  sublabel,
  delay = 0,
  accentColor = "#C9A85C",
}: StatCardProps) {
  const animated = useCountUp(value, 900, delay)

  return (
    <div
      className="glass-card glass-card-hover rounded-2xl px-6 py-5 flex-1 min-w-0 relative overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Subtle top border accent */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accentColor}40, transparent)`,
        }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2.5">
            {label}
          </p>
          <div className="flex items-end gap-1 leading-none">
            <span className="font-display text-[32px] font-bold text-foreground stat-number">
              {animated}
            </span>
            {suffix && (
              <span
                className="text-lg font-semibold mb-1"
                style={{ color: accentColor }}
              >
                {suffix}
              </span>
            )}
          </div>
          {sublabel && (
            <p className="text-[10px] text-muted-foreground mt-1.5">{sublabel}</p>
          )}
        </div>

        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: `${accentColor}12` }}
        >
          <Icon size={16} style={{ color: accentColor }} />
        </div>
      </div>
    </div>
  )
}

export function StatsBar({ leads }: { leads: Lead[] }) {
  const total = leads.length
  const withEmail = leads.filter((l) => l.email).length
  const emailPct = total > 0 ? Math.round((withEmail / total) * 100) : 0
  const enriched = leads.filter((l) => l.enriched_at).length
  const scoredLeads = leads.filter((l) => l.lead_quality_score !== null)
  const avgScore =
    scoredLeads.length > 0
      ? Math.round(
          scoredLeads.reduce((s, l) => s + (l.lead_quality_score ?? 0), 0) /
            scoredLeads.length
        )
      : 0

  return (
    <div className="flex gap-4">
      <StatCard
        icon={Target}
        label="Total Leads"
        value={total}
        sublabel={`${leads.filter((l) => !l.enriched_at).length} awaiting enrichment`}
        delay={0}
      />
      <StatCard
        icon={Mail}
        label="Email Coverage"
        value={emailPct}
        suffix="%"
        sublabel={`${withEmail} leads with email`}
        delay={70}
        accentColor="#16a34a"
      />
      <StatCard
        icon={TrendingUp}
        label="Avg Quality Score"
        value={avgScore}
        sublabel={`${leads.filter((l) => (l.lead_quality_score ?? 0) >= 75).length} Ready-tier leads`}
        delay={140}
        accentColor="#d97706"
      />
      <StatCard
        icon={Sparkles}
        label="Enriched"
        value={enriched}
        sublabel={`${total - enriched} leads need enrichment`}
        delay={210}
        accentColor="#6366f1"
      />
    </div>
  )
}
