"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import type { Lead } from "@/lib/types"

function getGreeting(): string {
  const h = new Date().getHours()
  if (h >= 0 && h < 5)  return "Good evening"   // midnight → 4:59 am
  if (h < 12)            return "Good morning"  // 5 am → 11:59 am
  if (h < 18)            return "Good afternoon" // noon → 5:59 pm
  return "Good evening"                          // 6 pm → 11:59 pm
}

function getDateLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

interface GreetingProps {
  leads: Lead[]
}

export function Greeting({ leads }: GreetingProps) {
  const [firstName, setFirstName] = useState<string | null>(null)
  const text = getGreeting()

  useEffect(() => {
    supabase
      .from("sender_profiles")
      .select("owner_name, is_default")
      .order("is_default", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]?.owner_name) {
          setFirstName(data[0].owner_name.trim().split(" ")[0])
        }
      })
  }, [])

  const readyCount = leads.filter((l) => (l.lead_quality_score ?? 0) >= 75).length
  const withEmail  = leads.filter((l) => l.email).length
  const enriched   = leads.filter((l) => l.enriched_at).length

  return (
    <div>
      {/* Greeting line */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="font-display text-[30px] font-bold text-foreground tracking-tight leading-none">
          {text}
          {firstName ? (
            <span style={{ color: "#C9A85C" }}>, {firstName}</span>
          ) : null}
          .
        </h1>
        <span className="text-sm text-muted-foreground hidden sm:block">{getDateLabel()}</span>
      </div>

      {/* Summary line */}
      {leads.length > 0 ? (
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          <StatPill value={leads.length}  label="leads total" />
          <Divider />
          <StatPill value={readyCount}   label="ready to contact" color="#16a34a" />
          <Divider />
          <StatPill value={withEmail}    label="with email" />
          <Divider />
          <StatPill value={enriched}     label="enriched" />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground mt-1.5">
          Run your first search to populate leads.
        </p>
      )}
    </div>
  )
}

function StatPill({
  value,
  label,
  color,
}: {
  value: number
  label: string
  color?: string
}) {
  return (
    <span className="text-sm text-muted-foreground">
      <span
        className="font-semibold tabular-nums"
        style={{ color: color ?? "inherit" }}
      >
        {value}
      </span>{" "}
      {label}
    </span>
  )
}

function Divider() {
  return (
    <span
      className="w-px h-3 rounded-full shrink-0"
      style={{ background: "rgba(201,168,92,0.3)" }}
    />
  )
}
