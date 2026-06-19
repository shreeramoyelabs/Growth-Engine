"use client"

import type { Lead } from "@/lib/types"

export function IndustryBreakdown({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) return null

  // Count by category
  const counts: Record<string, number> = {}
  leads.forEach((l) => {
    const cat = l.category || "Uncategorized"
    counts[cat] = (counts[cat] || 0) + 1
  })

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const max = sorted[0]?.[1] ?? 1

  return (
    <div className="glass-card rounded-2xl px-5 py-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground/55 mb-3">
        Industry Breakdown
      </p>
      <div className="space-y-2">
        {sorted.map(([cat, count]) => (
          <div key={cat} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground/80 w-[130px] truncate shrink-0">{cat}</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(201,168,92,0.1)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(count / max) * 100}%`,
                  background: "linear-gradient(90deg, #D4A853, #C9A85C)",
                }}
              />
            </div>
            <span className="text-xs font-semibold text-foreground/70 w-5 text-right shrink-0">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
