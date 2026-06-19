"use client"

import { useState } from "react"
import { ChevronRight, Mail, Phone, Star, ExternalLink, Target, ArrowUpDown, ArrowUp, ArrowDown, Copy, Check, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { ScoreBadge } from "./score-badge"
import { getTier } from "@/lib/types"
import { formatPhone, daysAgo, truncate, haversineKm, fmtKm } from "@/lib/format"
import type { Lead } from "@/lib/types"

const COL_CLASSES =
  "grid-cols-[32px_16px_minmax(0,2.2fr)_minmax(0,1fr)_116px_minmax(0,1.4fr)_minmax(0,1fr)_32px]"

type SortField = "score_desc" | "score_asc" | "name" | "rating" | "scraped" | "distance"

interface SortableHeaderProps {
  label: string
  field: SortField
  altField?: SortField
  currentSort: SortField
  onSort: (field: SortField) => void
}

function SortableHeader({ label, field, altField, currentSort, onSort }: SortableHeaderProps) {
  const isActive = currentSort === field || currentSort === altField
  const isAsc = currentSort === altField
  return (
    <button
      onClick={() => onSort(isActive && !isAsc ? (altField ?? field) : field)}
      className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.13em] hover:text-foreground transition-colors"
      style={{ color: isActive ? "#C9A85C" : undefined }}
    >
      {label}
      {isActive
        ? isAsc ? <ArrowUp size={10} style={{ color: "#C9A85C" }} /> : <ArrowDown size={10} style={{ color: "#C9A85C" }} />
        : <ArrowUpDown size={9} className="opacity-30" />}
    </button>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation()
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }}
      className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity ml-1 shrink-0"
      title="Copy"
    >
      {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} className="text-muted-foreground" />}
    </button>
  )
}

interface LeadsTableProps {
  leads: Lead[]
  compact: boolean
  onSelectLead: (lead: Lead) => void
  selectedLeadId?: string
  focusedIndex?: number
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAll: () => void
  sortBy: SortField
  onSortChange: (s: SortField) => void
  nearMeLocation?: { lat: number; lng: number } | null
  nearMeDistanceMap?: Record<string, number | null>
  distanceMode?: "near_me" | "search_origin"
}

export function LeadsTable({
  leads, compact, onSelectLead, selectedLeadId, focusedIndex,
  selectedIds, onToggleSelect, onSelectAll, sortBy, onSortChange,
  nearMeLocation = null, nearMeDistanceMap = {}, distanceMode = "near_me",
}: LeadsTableProps) {
  if (leads.length === 0) {
    return (
      <div className="glass-card rounded-2xl py-24 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "rgba(201,168,92,0.08)" }}>
          <Target size={22} style={{ color: "#C9A85C" }} />
        </div>
        <p className="font-display text-lg font-semibold text-foreground mb-1">No leads found</p>
        <p className="text-sm text-muted-foreground">Try adjusting your filters or run a new search</p>
      </div>
    )
  }

  const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.place_id))

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className={cn("grid gap-0 px-5 py-3", COL_CLASSES)}
        style={{ borderBottom: "1px solid rgba(201,168,92,0.15)", background: "var(--surface-table-header)" }}>
        <div className="flex items-center">
          <input type="checkbox" checked={allSelected} onChange={onSelectAll}
            className="w-3.5 h-3.5 rounded accent-amber-600 cursor-pointer" />
        </div>
        {/* Star col header (empty) */}
        <div />
        <SortableHeader label="Business" field="name" currentSort={sortBy} onSort={onSortChange} />
        <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground/65">Category</div>
        <SortableHeader label="Score" field="score_desc" altField="score_asc" currentSort={sortBy} onSort={onSortChange} />
        <div className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground/65">Contact</div>
        <SortableHeader label="Location · Dist" field="distance" currentSort={sortBy} onSort={onSortChange} />
        <div />
      </div>

      {/* Rows */}
      <div>
        {leads.map((lead, i) => (
          <LeadRow
            key={lead.place_id}
            lead={lead}
            index={i}
            compact={compact}
            isSelected={selectedLeadId === lead.place_id}
            isFocused={focusedIndex === i}
            isChecked={selectedIds.has(lead.place_id)}
            onToggleCheck={(e) => { e.stopPropagation(); onToggleSelect(lead.place_id) }}
            onClick={() => onSelectLead(lead)}
            nearMeDistKm={nearMeDistanceMap[lead.place_id]}
            nearMeAerialKm={nearMeLocation
              ? haversineKm(nearMeLocation.lat, nearMeLocation.lng, lead.latitude, lead.longitude)
              : null}
            searchOriginDistKm={haversineKm(lead.source_lat, lead.source_lng, lead.latitude, lead.longitude)}
            distanceMode={distanceMode}
          />
        ))}
      </div>
    </div>
  )
}

function LeadRow({
  lead, index, compact, isSelected, isFocused, isChecked, onToggleCheck, onClick,
  nearMeDistKm, nearMeAerialKm, searchOriginDistKm, distanceMode = "near_me",
}: {
  lead: Lead; index: number; compact: boolean; isSelected: boolean; isFocused: boolean
  isChecked: boolean; onToggleCheck: (e: React.MouseEvent) => void; onClick: () => void
  nearMeDistKm?: number | null      // road distance from near-me (null = unreachable by road)
  nearMeAerialKm?: number | null    // aerial fallback
  searchOriginDistKm?: number | null // aerial from the search pin
  distanceMode?: "near_me" | "search_origin"
}) {
  const [hovered, setHovered] = useState(false)
  const tier = getTier(lead.lead_quality_score)
  const ribbonColors: Record<string, string> = {
    Ready: "#16a34a", Review: "#d97706", Low: "#ea580c", Skip: "#dc2626",
  }

  // Freshness: days since scraped
  const age = daysAgo(lead.scraped_at)
  const isFresh = age < 7
  const isStale = age > 30

  // Outreach status config
  const outreachStatus = lead.best_outreach_status
  const outreachConfig = outreachStatus === "replied"
    ? { label: "Replied", color: "#15803d", bg: "rgba(22,163,74,0.1)", border: "rgba(22,163,74,0.25)" }
    : outreachStatus === "sent"
    ? { label: "Sent", color: "#4f46e5", bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.25)" }
    : null  // draft = just a dot, not a pill

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      data-lead-index={index}
      className={cn(
        "table-row-animate row-divider row-hover grid gap-0 px-5 cursor-pointer transition-colors duration-100 group relative",
        COL_CLASSES,
        compact ? "py-3" : "py-4",
        isFocused ? "row-keyboard-focus" : isSelected ? "bg-amber-50/60" : isChecked ? "bg-amber-50/40" : ""
      )}
      style={{
        animationDelay: `${Math.min(index * 22, 500)}ms`,
        boxShadow: isSelected
          ? `inset 3px 0 0 ${ribbonColors[tier]}`
          : isFocused
          ? "inset 3px 0 0 rgba(201,168,92,0.7)"
          : hovered
          ? "inset 3px 0 0 rgba(201,168,92,0.4)"
          : "inset 3px 0 0 transparent",
        transition: "box-shadow 0.12s ease",
      }}
    >
      {/* Checkbox */}
      <div className="flex items-center" onClick={onToggleCheck}>
        <input type="checkbox" checked={isChecked} onChange={() => {}}
          className={cn("w-3.5 h-3.5 rounded accent-amber-600 cursor-pointer transition-opacity",
            hovered || isChecked ? "opacity-100" : "opacity-0")} />
      </div>

      {/* Star */}
      <div className="flex items-center">
        {lead.is_starred && <Star size={12} fill="#C9A85C" style={{ color: "#C9A85C" }} />}
      </div>

      {/* Business name + freshness + source badge */}
      <div className="min-w-0 pr-4 flex flex-col justify-center">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Freshness dot */}
          {isFresh && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot shrink-0" title="Scraped within last 7 days" />
          )}
          {isStale && !isFresh && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Scraped 30+ days ago — consider re-enriching" />
          )}
          <p className="text-[15px] font-medium text-foreground truncate leading-snug">{lead.business_name}</p>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {lead.google_rating !== null && (
            <span className="flex items-center gap-0.5 text-xs text-amber-500">
              <Star size={9} fill="currentColor" />
              {lead.google_rating}
              {lead.review_count ? <span className="text-muted-foreground ml-0.5">({lead.review_count})</span> : null}
            </span>
          )}
          {/* Source query badge */}
          {lead.source_query && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded italic font-medium shrink-0"
              style={{
                background: "rgba(201,168,92,0.07)",
                border: "1px solid rgba(201,168,92,0.18)",
                color: "#A08040",
              }}
              title={lead.source_query}
            >
              {truncate(lead.source_query, 18)}
            </span>
          )}
          {lead.website && (
            <a href={lead.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              className={cn("flex items-center gap-0.5 text-xs transition-opacity duration-150",
                hovered ? "opacity-100" : "opacity-0")}
              style={{ color: "#C9A85C" }}>
              <ExternalLink size={10} /> site
            </a>
          )}
        </div>
      </div>

      {/* Category */}
      <div className="flex items-center pr-3">
        {lead.category ? (
          <span className="text-xs px-2 py-0.5 rounded-md truncate max-w-full"
            style={{ background: "rgba(201,168,92,0.07)", border: "1px solid rgba(201,168,92,0.18)", color: "#7C6040" }}>
            {lead.category}
          </span>
        ) : <span className="text-xs text-muted-foreground/35">—</span>}
      </div>

      {/* Score */}
      <div className="flex items-center">
        <ScoreBadge score={lead.lead_quality_score} size="sm" showLabel={false} />
        <div className="ml-1.5">
          <span className="text-xs font-semibold"
            style={{ color: tier === "Ready" ? "#15803d" : tier === "Review" ? "#b45309" : tier === "Low" ? "#c2410c" : "#b91c1c" }}>
            {tier}
          </span>
        </div>
      </div>

      {/* Contact — email, phone (formatted), outreach status */}
      <div className="flex flex-col justify-center gap-0.5 pr-3 min-w-0">
        {lead.email ? (
          <div className="flex items-center gap-1.5 text-xs min-w-0 group">
            <Mail size={11} className="text-emerald-500 shrink-0" />
            <span className="text-foreground/80 truncate flex-1">{lead.email}</span>
            {lead.email_valid === "valid" && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400" title="Valid MX" />}
            <CopyBtn text={lead.email} />
          </div>
        ) : lead.enriched_at ? (
          <span className="text-xs text-muted-foreground/50">No email found</span>
        ) : (
          <span className="text-xs text-muted-foreground/40 italic">Not enriched</span>
        )}
        {(lead.phone || lead.website_phone) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 group">
            <Phone size={10} className="shrink-0" />
            <span className="truncate flex-1">
              {formatPhone(lead.website_phone || lead.phone, lead.source_country_code)}
            </span>
            <CopyBtn text={lead.website_phone || lead.phone || ""} />
          </div>
        )}
        {/* Outreach status — pill for sent/replied, amber dot for draft */}
        {outreachStatus && (
          outreachConfig ? (
            <span
              className="text-[9px] font-semibold px-2 py-0.5 rounded-full w-fit mt-0.5"
              style={{ background: outreachConfig.bg, color: outreachConfig.color, border: `1px solid ${outreachConfig.border}` }}
            >
              {outreachConfig.label === "Sent" ? "✈ Sent" : "💬 Replied"}
            </span>
          ) : (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Outreach drafted" />
              <span className="text-[9px] text-amber-600/80">Draft ready</span>
            </div>
          )
        )}
      </div>

      {/* Location + Near-me Distance */}
      <div className="flex flex-col justify-center gap-0.5">
        <span className="text-xs text-muted-foreground truncate">
          {[lead.city, lead.state].filter(Boolean).join(", ") || lead.full_address?.split(",")[0] || "—"}
        </span>
        {(() => {
          // ── Search-origin mode: aerial distance from the search pin ──
          if (distanceMode === "search_origin") {
            if (searchOriginDistKm == null) return null
            const isRemote = searchOriginDistKm > 200
            return (
              <span
                className="flex items-center gap-0.5 text-[10px]"
                style={{ color: isRemote ? "rgba(239,68,68,0.55)" : "rgba(100,100,100,0.5)" }}
                title="Straight-line distance from the original search pin"
              >
                {isRemote ? "🌍" : <MapPin size={8} className="shrink-0" />}
                {fmtKm(searchOriginDistKm)}{isRemote ? " away" : " from pin"}
              </span>
            )
          }

          // ── Near-me mode ──
          // Road distance loaded from OSRM
          if (nearMeDistKm != null) {
            const isRemote = nearMeDistKm > 200
            return (
              <span
                className="flex items-center gap-0.5 text-[10px]"
                style={{ color: isRemote ? "rgba(239,68,68,0.6)" : "rgba(100,100,100,0.55)" }}
                title={isRemote ? "Remote — far from your current location" : "Road distance from your current location"}
              >
                {isRemote ? "🌍" : <MapPin size={8} className="shrink-0" />}
                {fmtKm(nearMeDistKm)}{isRemote ? " away" : " by road"}
              </span>
            )
          }
          // OSRM returned null (cross-continent, no road) → aerial
          if (nearMeDistKm === null && nearMeAerialKm != null) {
            return (
              <span
                className="flex items-center gap-0.5 text-[10px]"
                style={{ color: nearMeAerialKm > 200 ? "rgba(239,68,68,0.5)" : "rgba(100,100,100,0.4)" }}
                title="No road route — straight-line distance shown"
              >
                {nearMeAerialKm > 200 ? "🌍" : <MapPin size={8} className="shrink-0" />}
                {fmtKm(nearMeAerialKm)} aerial
              </span>
            )
          }
          // OSRM not yet fetched — show aerial as placeholder
          if (nearMeAerialKm != null) {
            return (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/35 italic"
                title="Road distance loading…">
                <MapPin size={8} className="shrink-0" />
                {fmtKm(nearMeAerialKm)} aerial
              </span>
            )
          }
          return null
        })()}
      </div>

      {/* Chevron */}
      <div className="flex items-center justify-end">
        <ChevronRight size={13}
          className={cn("transition-all duration-150",
            isSelected ? "text-gold-500" : hovered ? "text-muted-foreground translate-x-0.5" : "text-muted-foreground/20")} />
      </div>
    </div>
  )
}
