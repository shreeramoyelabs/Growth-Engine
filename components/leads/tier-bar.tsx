"use client"

import { cn } from "@/lib/utils"
import { getTier, TIER_CONFIG, type Tier } from "@/lib/types"
import type { Lead } from "@/lib/types"

const TIERS: Tier[] = ["Ready", "Review", "Low", "Skip"]

const TIER_EMOJI: Record<Tier, string> = {
  Ready:  "🟢",
  Review: "🟡",
  Low:    "🟠",
  Skip:   "🔴",
}

interface TierBarProps {
  leads: Lead[]
  activeTier: string
  onTierChange: (tier: string) => void
}

export function TierBar({ leads, activeTier, onTierChange }: TierBarProps) {
  const total = leads.length
  if (total === 0) return null

  const counts = TIERS.reduce(
    (acc, t) => {
      acc[t] = leads.filter((l) => getTier(l.lead_quality_score) === t).length
      return acc
    },
    {} as Record<Tier, number>
  )

  return (
    <div className="space-y-2.5">
      {/* Segmented distribution bar */}
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
        {TIERS.map((tier) => {
          const count = counts[tier]
          if (count === 0) return null
          const pct = (count / total) * 100
          const isActive = activeTier === tier
          const isFiltered = activeTier !== "all" && activeTier !== tier
          return (
            <div
              key={tier}
              className="h-full cursor-pointer transition-opacity duration-200"
              style={{
                width: `${pct}%`,
                background: TIER_CONFIG[tier].stroke,
                opacity: isFiltered ? 0.25 : isActive ? 1 : 0.65,
                borderRadius: "9999px",
              }}
              onClick={() => onTierChange(activeTier === tier ? "all" : tier)}
              title={`${tier}: ${count} of ${total} leads`}
            />
          )
        })}
      </div>

      {/* Clickable tier pills */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onTierChange("all")}
          className={cn(
            "text-xs px-3 py-1 rounded-full font-medium transition-all duration-150 border",
            activeTier === "all"
              ? "bg-foreground text-white border-foreground"
              : "bg-white/70 border-gold-200/80 text-muted-foreground hover:text-foreground hover:bg-gold-50"
          )}
        >
          All&nbsp;{total}
        </button>

        {TIERS.map((tier) => {
          const count = counts[tier]
          if (count === 0) return null
          const c = TIER_CONFIG[tier]
          const isActive = activeTier === tier

          return (
            <button
              key={tier}
              onClick={() => onTierChange(activeTier === tier ? "all" : tier)}
              className="text-xs px-3 py-1 rounded-full font-medium transition-all duration-150"
              style={
                isActive
                  ? {
                      background: c.stroke,
                      color: "#fff",
                      border: `1px solid ${c.stroke}`,
                    }
                  : {
                      background: c.bg,
                      color: c.text,
                      border: `1px solid ${c.border}`,
                    }
              }
            >
              {TIER_EMOJI[tier]}&nbsp;{tier}&nbsp;{count}
            </button>
          )
        })}
      </div>
    </div>
  )
}
