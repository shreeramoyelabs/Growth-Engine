"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { getTier, TIER_CONFIG } from "@/lib/types"
import type { Lead } from "@/lib/types"

interface ScoreBadgeProps {
  score: number | null
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
  className?: string
  lead?: Lead           // optional — enables score breakdown tooltip
}

export function ScoreBadge({ score, size = "sm", showLabel = true, className, lead }: ScoreBadgeProps) {
  const arcRef = useRef<SVGCircleElement>(null)
  const [showTip, setShowTip] = useState(false)

  const displayScore = score ?? 0
  const tier = getTier(score)
  const colors = TIER_CONFIG[tier]

  const dim = size === "sm" ? 36 : size === "md" ? 48 : 72
  const strokeWidth = size === "lg" ? 4.5 : size === "md" ? 3 : 2.5
  const r = dim / 2 - strokeWidth - 1
  const circumference = 2 * Math.PI * r
  const targetOffset = score !== null ? circumference * (1 - displayScore / 100) : circumference
  const fontSize = size === "sm" ? 10 : size === "md" ? 13 : 21

  useEffect(() => {
    const arc = arcRef.current
    if (!arc) return
    arc.style.strokeDashoffset = String(circumference)
    const timer = setTimeout(() => {
      arc.style.strokeDashoffset = String(targetOffset)
    }, 120)
    return () => clearTimeout(timer)
  }, [displayScore, circumference, targetOffset])

  return (
    <div className={cn("flex items-center gap-2 shrink-0 relative", className)}>
      {/* Arc gauge */}
      <div
        className="relative shrink-0 cursor-default"
        style={{ width: dim, height: dim }}
        onMouseEnter={() => lead && setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
      >
        <svg width={dim} height={dim} className="-rotate-90" style={{ overflow: "visible" }}>
          <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke="rgba(201,168,92,0.12)" strokeWidth={strokeWidth} />
          <circle
            ref={arcRef}
            cx={dim / 2} cy={dim / 2} r={r}
            fill="none"
            stroke={score !== null ? colors.stroke : "rgba(201,168,92,0.18)"}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="score-arc"
            style={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-display font-bold tabular-nums leading-none"
            style={{ fontSize, color: score !== null ? colors.text : "rgba(201,168,92,0.4)" }}
          >
            {score !== null ? displayScore : "—"}
          </span>
        </div>

        {/* Score breakdown tooltip */}
        {showTip && lead && (
          <div
            className="absolute left-full ml-3 top-0 z-50 w-56 rounded-xl py-3 px-3.5 text-left"
            style={{
              background: "var(--surface-modal)",
              border: "1px solid rgba(201,168,92,0.25)",
              boxShadow: "0 8px 32px rgba(160,120,60,0.15)",
              backdropFilter: "blur(16px)",
            }}
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-muted-foreground/55 mb-2">
              Score Breakdown
            </p>
            <div className="space-y-1.5">
              <SignalRow label="Email"    ok={!!lead.email}         detail={lead.email_valid === "valid" ? "valid MX" : lead.email ? "unverified" : "missing"} />
              <SignalRow label="Phone"    ok={!!(lead.phone || lead.website_phone)} detail={lead.phone || lead.website_phone || "not found"} />
              <SignalRow label="Owner"    ok={!!lead.owner_name}    detail={lead.owner_name || "not found"} />
              <SignalRow label="Crawled"  ok={(lead.pages_crawled ?? 0) >= 2} detail={`${lead.pages_crawled ?? 0}/3 pages`} />
              <SignalRow label="Rating"   ok={(lead.google_rating ?? 0) >= 4} detail={lead.google_rating ? `${lead.google_rating}★ (${lead.review_count ?? 0} reviews)` : "no rating"} />
              <SignalRow label="LinkedIn" ok={!!lead.linkedin_profiles} detail={lead.linkedin_profiles ? "profiles found" : "none"} />
              <SignalRow label="Description" ok={!!lead.company_description} detail={lead.company_description ? `${lead.company_description.length} chars` : "none"} />
            </div>
            <div
              className="mt-2.5 pt-2.5 flex items-center justify-between"
              style={{ borderTop: "1px solid rgba(201,168,92,0.15)" }}
            >
              <span className="text-[10px] text-muted-foreground">Total score</span>
              <span className="font-display text-lg font-bold" style={{ color: colors.text }}>
                {score ?? "—"}/100
              </span>
            </div>
          </div>
        )}
      </div>

      {showLabel && (
        <span
          className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md shrink-0"
          style={{ color: colors.text, background: colors.bg, border: `1px solid ${colors.border}` }}
        >
          {tier}
        </span>
      )}
    </div>
  )
}

function SignalRow({ label, ok, detail }: { label: string; ok: boolean; detail: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px]">{ok ? "✓" : "–"}</span>
      <span className="text-[11px] text-muted-foreground/80 w-20 shrink-0">{label}</span>
      <span
        className="text-[10px] truncate flex-1"
        style={{ color: ok ? "#15803d" : "#9ca3af" }}
      >
        {detail ?? "—"}
      </span>
    </div>
  )
}
