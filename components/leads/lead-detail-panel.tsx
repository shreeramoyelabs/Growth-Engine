"use client"

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, ExternalLink, RefreshCw, MessageSquare, Star, Mail,
  MapPin, Globe, Link2, Copy, Check, FileText, Sparkles, Phone, User,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ScoreBadge } from "./score-badge"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase/client"
import type { Lead, LeadOutreach } from "@/lib/types"

interface LeadDetailPanelProps {
  lead: Lead | null
  onClose: () => void
  onReenrich: (placeId: string) => void
  onGenerateOutreach: (lead: Lead) => void
}

export function LeadDetailPanel({
  lead,
  onClose,
  onReenrich,
  onGenerateOutreach,
}: LeadDetailPanelProps) {
  const [outreach, setOutreach] = useState<LeadOutreach[]>([])
  const [loadingOutreach, setLoadingOutreach] = useState(false)
  const [reenriching, setReenriching] = useState(false)
  const [isStarred, setIsStarred] = useState(false)

  // Deep Enrich state — latest result + run controls
  const [deepEnrich, setDeepEnrich] = useState<DeepEnrichRow | null>(null)
  const [deepEnriching, setDeepEnriching] = useState(false)
  const [deepEnrichError, setDeepEnrichError] = useState<string | null>(null)

  // Sync starred state when lead changes
  useEffect(() => { setIsStarred(!!lead?.is_starred) }, [lead?.place_id, lead?.is_starred]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleStar = async () => {
    if (!lead) return
    const next = !isStarred
    setIsStarred(next)
    await supabase.from("leads").update({ is_starred: next }).eq("place_id", lead.place_id)
  }

  // Load outreach whenever lead changes
  useEffect(() => {
    if (!lead) { setOutreach([]); return }
    setLoadingOutreach(true)
    supabase
      .from("lead_outreach")
      .select("*")
      .eq("place_id", lead.place_id)
      .then(({ data }) => {
        setOutreach(data || [])
        setLoadingOutreach(false)
      })
  }, [lead?.place_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load latest Deep Enrich result whenever lead changes
  useEffect(() => {
    if (!lead) { setDeepEnrich(null); setDeepEnrichError(null); return }
    setDeepEnrichError(null)
    fetch(`/api/deep-enrich?place_id=${encodeURIComponent(lead.place_id)}`)
      .then((r) => r.json())
      .then((data) => setDeepEnrich(data.result || null))
      .catch(() => setDeepEnrich(null))
  }, [lead?.place_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeepEnrich = async () => {
    if (!lead || !lead.website) return
    setDeepEnriching(true)
    setDeepEnrichError(null)
    try {
      const res = await fetch("/api/deep-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ place_id: lead.place_id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDeepEnrichError(data.error || "Deep Enrich failed")
      } else {
        // Refresh the persisted row so the UI shows from the DB, not the response
        const r = await fetch(`/api/deep-enrich?place_id=${encodeURIComponent(lead.place_id)}`)
        const persisted = await r.json()
        setDeepEnrich(persisted.result || null)
      }
    } catch (err) {
      setDeepEnrichError(err instanceof Error ? err.message : "Network error")
    } finally {
      setDeepEnriching(false)
    }
  }

  const handleReenrich = async () => {
    if (!lead) return
    setReenriching(true)
    try {
      await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ place_ids: [lead.place_id] }),
      })
      onReenrich(lead.place_id)
    } finally {
      setReenriching(false)
    }
  }

  return (
    <AnimatePresence>
      {lead && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(20,15,5,0.07)", backdropFilter: "blur(1px)" }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 h-full w-[460px] z-50 flex flex-col"
            style={{
              background: "var(--surface-panel)",
              backdropFilter: "blur(28px) saturate(200%)",
              borderLeft: "1px solid rgba(201,168,92,0.22)",
              boxShadow: "-8px 0 48px rgba(160,120,60,0.12), -1px 0 0 rgba(201,168,92,0.14)",
            }}
          >
            {/* Gold accent top line */}
            <div
              className="absolute top-0 left-0 right-0 h-0.5"
              style={{
                background:
                  "linear-gradient(90deg, transparent 5%, rgba(201,168,92,0.55) 40%, rgba(201,168,92,0.55) 60%, transparent 95%)",
              }}
            />
            {/* Gold band at the top — strong horizontal strip */}
            <div
              className="absolute top-0 left-0 right-0 pointer-events-none z-0"
              style={{
                height: "30%",
                background:
                  "linear-gradient(180deg, rgba(212,175,90,0.35) 0%, rgba(212,175,90,0.20) 30%, rgba(212,175,90,0.05) 70%, transparent 100%)",
              }}
            />
            {/* Side vignette — same gold color, diffused across the full width */}
            <div
              className="absolute inset-0 pointer-events-none z-0"
              style={{
                background:
                  "linear-gradient(90deg, rgba(201,168,92,0.14) 0%, rgba(201,168,92,0.05) 28%, transparent 48%, transparent 52%, rgba(201,168,92,0.05) 72%, rgba(201,168,92,0.14) 100%)",
              }}
            />

            {/* ── Header ── */}
            <div className="px-6 pt-6 pb-4" style={{ borderBottom: "1px solid rgba(201,168,92,0.14)" }}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="font-display text-[22px] font-bold text-foreground leading-tight">
                    {lead.business_name}
                  </h2>
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5">
                    {lead.city && (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin size={11} />
                        {[lead.city, lead.state].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {lead.google_rating !== null && (
                      <span className="flex items-center gap-1 text-sm text-amber-500">
                        <Star size={10} fill="currentColor" />
                        {lead.google_rating}
                        {lead.review_count ? (
                          <span className="text-muted-foreground">({lead.review_count})</span>
                        ) : null}
                      </span>
                    )}
                    {lead.category && (
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-md"
                        style={{
                          background: "rgba(201,168,92,0.08)",
                          border: "1px solid rgba(201,168,92,0.2)",
                          color: "#7C5C28",
                        }}
                      >
                        {lead.category}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={toggleStar}
                    title={isStarred ? "Unstar lead" : "Star lead"}
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                    style={{
                      background: isStarred ? "rgba(201,168,92,0.15)" : "transparent",
                      border: isStarred ? "1px solid rgba(201,168,92,0.3)" : "1px solid transparent",
                    }}
                  >
                    <Star
                      size={15}
                      fill={isStarred ? "#C9A85C" : "none"}
                      style={{ color: isStarred ? "#C9A85C" : undefined }}
                      className={cn(!isStarred && "text-muted-foreground hover:text-gold-400")}
                    />
                  </button>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-gold-50 hover:text-foreground transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Score + links */}
              <div className="flex items-center justify-between mt-5">
                {/* key forces remount → arc reanimates on each new lead */}
                <ScoreBadge key={lead.place_id} score={lead.lead_quality_score} size="md" showLabel lead={lead} />
                <div className="flex gap-2">
                  {lead.website && (
                    <a href={lead.website} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="h-8 text-xs border-gold-200 hover:bg-gold-50 gap-1.5 px-3">
                        <Globe size={12} /> Website
                      </Button>
                    </a>
                  )}
                  {lead.google_maps_url && (
                    <a href={lead.google_maps_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="h-8 text-xs border-gold-200 hover:bg-gold-50 gap-1.5 px-3">
                        <MapPin size={12} /> Maps
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* ── Action bar ── */}
            <div
              className="px-5 py-3 flex gap-2"
              style={{ borderBottom: "1px solid rgba(201,168,92,0.1)" }}
            >
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs border-gold-200 hover:bg-gold-50 gap-1.5"
                onClick={handleReenrich}
                disabled={reenriching}
              >
                <RefreshCw size={12} className={reenriching ? "animate-spin" : ""} />
                {reenriching ? "Enriching…" : "Re-Enrich"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs gap-1.5"
                style={{
                  background: deepEnrich ? "rgba(168,85,247,0.06)" : undefined,
                  borderColor: "rgba(168,85,247,0.35)",
                  color: "#7c3aed",
                }}
                onClick={handleDeepEnrich}
                disabled={deepEnriching || !lead.website}
                title={!lead.website ? "Lead has no website" : "LLM-driven multi-page crawl"}
              >
                <Sparkles size={12} className={deepEnriching ? "animate-pulse" : ""} />
                {deepEnriching ? "Crawling…" : deepEnrich ? "Re-run Deep" : "Deep Enrich"}
              </Button>
              <Button
                size="sm"
                className="flex-1 h-9 text-xs text-white gap-1.5"
                style={{ background: "linear-gradient(135deg, #D4A853, #C9A85C)" }}
                onClick={() => onGenerateOutreach(lead)}
              >
                <MessageSquare size={12} />
                Outreach
              </Button>
            </div>

            {/* ── Tabs ── */}
            {/* Native overflow-y-auto. Previously used base-ui's ScrollArea
                which silently swallowed wheel events inside framer-motion's
                transformed parent. Native scroll always responds. */}
            <div className="flex-1 overflow-y-auto overscroll-contain relative z-10">
              <Tabs defaultValue="contact" className="px-5 py-5">
                <TabsList className="h-9 w-full mb-5 rounded-xl bg-gold-50/60 border border-gold-200/50">
                  {["contact", "company", "outreach"].map((tab) => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      className="flex-1 text-sm capitalize data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gold-600"
                    >
                      {tab}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* ── Contact tab ── */}
                <TabsContent value="contact" className="space-y-4 mt-0">
                  {/* Deep Enrich panel — shows latest LLM-extracted contacts */}
                  <DeepEnrichCard
                    data={deepEnrich}
                    running={deepEnriching}
                    error={deepEnrichError}
                    onRetry={handleDeepEnrich}
                    hasWebsite={!!lead.website}
                  />

                  <Card title="Contact Details">
                    <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                      {/* Email always full width — prevents character-level wrapping */}
                      <Field label="Email" value={lead.email} tag={lead.email_valid === "valid" ? "✓ valid" : undefined} span truncate />
                      <Field label="Phone" value={lead.phone || lead.website_phone} truncate />
                      <Field label="Owner / Contact" value={lead.owner_name} truncate />
                      {lead.all_emails_found && lead.all_emails_found !== lead.email && (
                        <Field label="All emails found" value={lead.all_emails_found} span small truncate />
                      )}
                    </div>
                  </Card>

                  {(lead.linkedin || lead.facebook || lead.instagram || lead.twitter || lead.youtube || lead.tiktok) && (
                    <Card title="Social Presence">
                      <div className="flex flex-wrap gap-2">
                        {lead.linkedin  && <SocialChip href={lead.linkedin}  emoji="💼" label="LinkedIn" />}
                        {lead.facebook  && <SocialChip href={lead.facebook}  emoji="📘" label="Facebook" />}
                        {lead.instagram && <SocialChip href={lead.instagram} emoji="📸" label="Instagram" />}
                        {lead.twitter   && <SocialChip href={lead.twitter}   emoji="𝕏"  label="Twitter / X" />}
                        {lead.youtube   && <SocialChip href={lead.youtube}   emoji="▶️" label="YouTube" />}
                        {lead.tiktok    && <SocialChip href={lead.tiktok}    emoji="🎵" label="TikTok" />}
                      </div>
                      {lead.linkedin_profiles && (
                        <div className="mt-3 space-y-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/55 mb-2">
                            Individual Profiles
                          </p>
                          {lead.linkedin_profiles.split("\n").filter(Boolean).slice(0, 4).map((url) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 py-0.5"
                            >
                              <span className="text-xs">💼</span>
                              <span className="truncate">{url.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, "")}</span>
                              <ExternalLink size={10} className="shrink-0 opacity-50" />
                            </a>
                          ))}
                        </div>
                      )}
                    </Card>
                  )}

                  {/* Notes */}
                  <NotesField placeId={lead.place_id} initialNotes={lead.notes} />

                  <Card title="Enrichment Status">
                    <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                      <Field label="Crawl status" value={lead.crawl_status || (lead.enriched_at ? "Enriched" : "Not enriched")} span />
                      {lead.pages_crawled !== null && <Field label="Pages crawled" value={`${lead.pages_crawled} / 3`} />}
                      {lead.enriched_at && <Field label="Last enriched" value={new Date(lead.enriched_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} />}
                    </div>
                  </Card>
                </TabsContent>

                {/* ── Company tab ── */}
                <TabsContent value="company" className="space-y-4 mt-0">
                  {lead.company_description && (
                    <Card title="About This Business">
                      <p className="text-sm text-muted-foreground leading-relaxed">{lead.company_description}</p>
                    </Card>
                  )}
                  {lead.maps_description && (
                    <Card title="Google Description">
                      <p className="text-sm text-muted-foreground leading-relaxed">{lead.maps_description}</p>
                    </Card>
                  )}
                  <Card title="Business Details">
                    <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                      <Field label="Category" value={lead.category} />
                      <Field label="Country" value={lead.source_country_code?.toUpperCase()} />
                      <Field label="Address" value={lead.full_address} span />
                      {lead.opening_hours && <Field label="Hours" value={lead.opening_hours} span small />}
                      <Field label="Source query" value={lead.source_query} span />
                      <Field label="Scraped" value={new Date(lead.scraped_at).toLocaleDateString()} />
                    </div>
                  </Card>
                </TabsContent>

                {/* ── Outreach tab ── */}
                <TabsContent value="outreach" className="mt-0 pb-8">
                  {loadingOutreach ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
                  ) : outreach.length === 0 ? (
                    <Card title="No Messages Yet">
                      <div className="text-center py-4">
                        <MessageSquare size={28} className="text-gold-300 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground mb-4">
                          Generate personalized outreach using your sender profiles and Groq AI.
                        </p>
                        <Button
                          size="sm"
                          className="text-sm text-white"
                          style={{ background: "linear-gradient(135deg, #D4A853, #C9A85C)" }}
                          onClick={() => onGenerateOutreach(lead)}
                        >
                          Generate Messages
                        </Button>
                      </div>
                    </Card>
                  ) : (
                    <Tabs defaultValue={outreach[0]?.channel}>
                      <TabsList className="h-9 w-full mb-4 rounded-xl bg-gold-50/60 border border-gold-200/50">
                        {outreach.map((o) => (
                          <TabsTrigger
                            key={o.channel}
                            value={o.channel}
                            className="flex-1 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gold-600"
                          >
                            {o.channel === "email" ? "✉️" : o.channel === "linkedin" ? "💼" : "💬"} {o.channel}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {outreach.map((o) => (
                        <TabsContent key={o.channel} value={o.channel} className="mt-0">
                          <OutreachCard outreach={o} lead={lead} />
                        </TabsContent>
                      ))}
                    </Tabs>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Sub-components ──────────────────────────────────────────────────

// Shape returned by GET /api/deep-enrich?place_id=...
type DeepEnrichRow = {
  id: string
  place_id: string
  status: "running" | "completed" | "failed"
  personal_contacts: Array<{
    name?: string
    title?: string
    email?: string
    phone?: string
    linkedin?: string
    source_url?: string
  }>
  generic_contacts: { emails?: string[]; phones?: string[]; address?: string }
  social_profiles: Record<string, string>
  confidence: number | null
  llm_notes: string | null
  page_selection_rationale: string | null
  pages_visited: Array<{ url: string; status: string; bytes: number; reason?: string }>
  personal_contact_count: number
  has_personal_email: boolean
  has_personal_phone: boolean
  has_owner_name: boolean
  model_used: string | null
  duration_ms: number | null
  completed_at: string | null
  error_message: string | null
  created_at: string
}

function DeepEnrichCard({
  data,
  running,
  error,
  onRetry,
  hasWebsite,
}: {
  data: DeepEnrichRow | null
  running: boolean
  error: string | null
  onRetry: () => void
  hasWebsite: boolean
}) {
  // Loading state during a new run
  if (running) {
    return (
      <div
        className="rounded-2xl p-4 space-y-2"
        style={{
          background: "rgba(168,85,247,0.04)",
          border: "1px solid rgba(168,85,247,0.25)",
        }}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-purple-600 animate-pulse" />
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-purple-700">
            Deep Enriching…
          </p>
        </div>
        <p className="text-xs text-purple-700/70 leading-relaxed">
          Fetching homepage, picking pages with LLM, crawling, extracting contacts. This usually takes 15-45 seconds.
        </p>
      </div>
    )
  }

  // Error from last attempt
  if (error) {
    return (
      <div
        className="rounded-2xl p-4 space-y-2"
        style={{
          background: "rgba(220,38,38,0.05)",
          border: "1px solid rgba(220,38,38,0.25)",
        }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-red-700">
            Deep Enrich Failed
          </p>
          <button onClick={onRetry} className="text-xs text-red-700 underline hover:no-underline">
            Retry
          </button>
        </div>
        <p className="text-xs text-red-700/80 leading-relaxed break-words">{error}</p>
      </div>
    )
  }

  // No deep enrich done yet
  if (!data) {
    return (
      <div
        className="rounded-2xl p-4"
        style={{
          background: "rgba(168,85,247,0.03)",
          border: "1px dashed rgba(168,85,247,0.3)",
        }}
      >
        <div className="flex items-start gap-2.5">
          <Sparkles size={13} className="text-purple-600/70 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-purple-700 mb-0.5">No Deep Enrichment yet</p>
            <p className="text-[11px] text-purple-700/60 leading-relaxed">
              {hasWebsite
                ? "Use the Deep Enrich button above to crawl the website with an LLM-driven graph for personal contacts."
                : "Lead has no website. Deep Enrich is unavailable."}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show results
  const social = data.social_profiles || {}
  const generic = data.generic_contacts || {}
  const pagesCrawled = (data.pages_visited || []).filter((p) => p.status === "ok").length
  const personal = data.personal_contacts || []

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{
        background: "rgba(168,85,247,0.04)",
        border: "1px solid rgba(168,85,247,0.25)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-purple-600" />
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-purple-700">
            Deep Enrichment
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-purple-700/60">
          <span>{pagesCrawled} pages</span>
          <span>·</span>
          <span>{data.duration_ms ? `${Math.round(data.duration_ms / 1000)}s` : "—"}</span>
          {data.confidence !== null && (
            <>
              <span>·</span>
              <span>conf {Math.round((data.confidence || 0) * 100)}%</span>
            </>
          )}
        </div>
      </div>

      {/* Personal contacts */}
      {personal.length > 0 ? (
        <div className="space-y-2">
          {personal.map((p, i) => (
            <div
              key={i}
              className="rounded-xl p-2.5 bg-white/40"
              style={{ border: "1px solid rgba(168,85,247,0.18)" }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <User size={10} className="text-purple-600/70" />
                <p className="text-sm font-semibold text-foreground truncate">
                  {p.name || "(no name)"}
                </p>
                {p.title && (
                  <span className="text-[10px] text-purple-700/70 ml-1 truncate">{p.title}</span>
                )}
              </div>
              <div className="space-y-0.5 pl-4">
                {p.email && (
                  <div className="flex items-center gap-1.5 text-[11px] text-foreground/75">
                    <Mail size={9} className="text-emerald-500" />
                    <span className="truncate">{p.email}</span>
                  </div>
                )}
                {p.phone && (
                  <div className="flex items-center gap-1.5 text-[11px] text-foreground/75">
                    <Phone size={9} className="text-muted-foreground" />
                    <span className="truncate">{p.phone}</span>
                  </div>
                )}
                {p.linkedin && (
                  <div className="flex items-center gap-1.5 text-[11px] text-blue-600">
                    <Link2 size={9} />
                    <a
                      href={p.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate hover:underline"
                    >
                      {p.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\//, "")}
                    </a>
                  </div>
                )}
                {p.source_url && (
                  <p className="text-[10px] text-muted-foreground/55 truncate">
                    found on {p.source_url.split("/").slice(3).join("/") || "homepage"}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-purple-700/60 italic">
          No personal contacts found in the crawled pages.
        </p>
      )}

      {/* Generic contacts */}
      {(generic.emails?.length || generic.phones?.length || generic.address) && (
        <div className="pt-1 border-t border-purple-300/15 space-y-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-purple-700/55">
            Generic / Company
          </p>
          {generic.emails?.length ? (
            <p className="text-[11px] text-foreground/70 break-words">
              <span className="text-muted-foreground/60">Emails: </span>
              {generic.emails.slice(0, 3).join(", ")}
              {generic.emails.length > 3 && ` +${generic.emails.length - 3} more`}
            </p>
          ) : null}
          {generic.phones?.length ? (
            <p className="text-[11px] text-foreground/70 break-words">
              <span className="text-muted-foreground/60">Phones: </span>
              {generic.phones.slice(0, 3).join(", ")}
            </p>
          ) : null}
          {generic.address ? (
            <p className="text-[11px] text-foreground/70 break-words">
              <span className="text-muted-foreground/60">Address: </span>
              {generic.address}
            </p>
          ) : null}
        </div>
      )}

      {/* Social profiles found by deep enrich (separate from regex-found socials) */}
      {Object.values(social).some(Boolean) && (
        <div className="pt-1 border-t border-purple-300/15">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-purple-700/55 mb-1.5">
            Social Profiles
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(social)
              .filter(([, v]) => !!v)
              .map(([k, v]) => (
                <a
                  key={k}
                  href={v}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] px-2 py-0.5 rounded-full hover:underline"
                  style={{
                    background: "rgba(168,85,247,0.08)",
                    border: "1px solid rgba(168,85,247,0.2)",
                    color: "#7c3aed",
                  }}
                >
                  {k}
                </a>
              ))}
          </div>
        </div>
      )}

      {/* LLM notes (collapsed-ish) */}
      {data.llm_notes && (
        <p className="text-[10px] text-purple-700/55 italic leading-relaxed border-t border-purple-300/15 pt-2">
          {data.llm_notes}
        </p>
      )}

      <p className="text-[9px] text-muted-foreground/40 pt-1">
        {data.model_used || "unknown model"} ·{" "}
        {new Date(data.created_at).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
    </div>
  )
}

function OutreachCard({ outreach, lead }: { outreach: LeadOutreach; lead: Lead }) {
  const [status, setStatus]   = useState(outreach.status)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const updateStatus = async (s: "sent" | "replied") => {
    await supabase.from("lead_outreach").update({ status: s }).eq("id", outreach.id)
    setStatus(s)
  }

  const handleSendEmail = async () => {
    if (!lead.email) return
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outreachId: outreach.id,
          to:         lead.email,
          subject:    outreach.subject_line || `${lead.business_name} — quick intro`,
          body:       outreach.message_body,
          senderName: undefined, // uses GMAIL_SENDER_NAME env var
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSendError(data.error || "Send failed")
      } else {
        setStatus("sent")
        if (data.isTest) {
          setSendError(`✓ Test mode — sent to ${data.sentTo} instead of ${lead.email}`)
        }
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Network error")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-3">
      {outreach.subject_line && (
        <Card title="Subject Line">
          <p className="text-sm font-medium text-foreground">{outreach.subject_line}</p>
        </Card>
      )}
      <Card title="Message">
        <p className="text-sm text-foreground/75 leading-relaxed whitespace-pre-wrap">
          {outreach.message_body}
        </p>
      </Card>

      {outreach.personalization_score !== null && (
        <div className="flex items-center gap-2.5 px-1">
          <span className="text-xs text-muted-foreground">Personalization</span>
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{ background: i < (outreach.personalization_score ?? 0) ? "#C9A85C" : "rgba(201,168,92,0.15)" }}
              />
            ))}
          </div>
          {outreach.personalization_notes && (
            <span className="text-xs text-muted-foreground/70 truncate">{outreach.personalization_notes}</span>
          )}
        </div>
      )}

      {/* Error / test-mode feedback */}
      {sendError && (
        <div
          className="px-3 py-2 rounded-lg text-xs"
          style={{
            background: sendError.startsWith("✓")
              ? "rgba(22,163,74,0.08)"
              : "rgba(220,38,38,0.08)",
            border: `1px solid ${sendError.startsWith("✓") ? "rgba(22,163,74,0.2)" : "rgba(220,38,38,0.2)"}`,
            color: sendError.startsWith("✓") ? "#15803d" : "#b91c1c",
          }}
        >
          {sendError}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1 flex-wrap">
        {/* Email channel — Send Email button */}
        {outreach.channel === "email" && (
          <Button
            size="sm"
            className="flex-1 h-9 text-sm text-white gap-2"
            style={
              status === "sent"
                ? { background: "rgba(22,163,74,0.15)", color: "#15803d", boxShadow: "none" }
                : { background: "linear-gradient(135deg, #D4A853, #C9A85C)" }
            }
            onClick={handleSendEmail}
            disabled={sending || !lead.email}
            title={!lead.email ? "No email address found for this lead" : undefined}
          >
            <Mail size={13} />
            {sending ? "Sending…" : status === "sent" ? "✓ Email Sent" : "Send Email"}
          </Button>
        )}

        {outreach.channel === "whatsapp" && outreach.whatsapp_link && (
          <a href={outreach.whatsapp_link} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button size="sm" className="w-full h-9 text-sm bg-emerald-500 hover:bg-emerald-600 text-white gap-2">
              <span>💬</span> Open WhatsApp
            </Button>
          </a>
        )}
        {outreach.channel === "linkedin" && lead.linkedin && (
          <a href={lead.linkedin} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button size="sm" variant="outline" className="w-full h-9 text-sm border-blue-200 text-blue-600 hover:bg-blue-50 gap-2">
              <Link2 size={12} /> Open LinkedIn
            </Button>
          </a>
        )}

        <div className="flex gap-1.5 ml-auto">
          {(["sent", "replied"] as const).map((s) => (
            <button
              key={s}
              onClick={() => updateStatus(s)}
              disabled={status === s}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                status === s
                  ? "bg-gold-100 text-gold-700 border border-gold-200"
                  : "text-muted-foreground hover:bg-gold-50 border border-transparent hover:border-gold-200"
              )}
            >
              {status === s ? "✓ " : ""}
              {s === "sent" ? "Mark Sent" : "Replied"}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Card wrapper for each section — gives depth inside the panel */
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "var(--surface-card-inner)",
        border: "1px solid var(--surface-card-border)",
        boxShadow: "0 1px 3px rgba(160,120,60,0.04), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/55 mb-3">
        {title}
      </p>
      {children}
    </div>
  )
}

/** Vertical label-above-value field — uses full width, no squishing */
function Field({
  label,
  value,
  tag,
  span,
  small,
  truncate,
}: {
  label: string
  value: string | null | undefined
  tag?: string
  span?: boolean
  small?: boolean
  truncate?: boolean
}) {
  if (!value) return null
  return (
    <div className={cn("min-w-0 space-y-0.5", span && "col-span-2")}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/55">
        {label}
      </p>
      <div className="flex items-start gap-2 min-w-0">
        <p
          className={cn(
            "text-foreground/85 leading-snug flex-1 min-w-0",
            small ? "text-xs" : "text-[13px]",
            truncate ? "truncate" : "break-words"
          )}
          title={truncate ? value : undefined}
        >
          {value}
        </p>
        {tag && (
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0 mt-0.5">
            {tag}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Notes field ──────────────────────────────────────────────────
function NotesField({ placeId, initialNotes }: { placeId: string; initialNotes: string | null }) {
  const [notes, setNotes] = useState(initialNotes || "")
  const [saving, setSaving] = useState(false)
  const saveRef = useRef<ReturnType<typeof setTimeout>>()

  const handleChange = (v: string) => {
    setNotes(v)
    clearTimeout(saveRef.current)
    saveRef.current = setTimeout(async () => {
      setSaving(true)
      await supabase.from("leads").update({ notes: v || null }).eq("place_id", placeId)
      setSaving(false)
    }, 800)
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--surface-card-inner)",
        border: "1px solid var(--surface-card-border)",
        boxShadow: "0 1px 3px rgba(160,120,60,0.04)",
      }}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <FileText size={11} className="text-muted-foreground/60" />
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/55">Notes</p>
        </div>
        {saving && <span className="text-[9px] text-muted-foreground/50">Saving…</span>}
      </div>
      <textarea
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Add private notes about this lead…"
        rows={3}
        className="w-full px-4 pb-3 text-[13px] text-foreground/80 bg-transparent resize-none outline-none placeholder:text-muted-foreground/40"
        style={{ lineHeight: "1.5" }}
      />
    </div>
  )
}

// ── Copy button ──────────────────────────────────────────────────
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation()
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }}
      title="Copy"
      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-gold-600"
    >
      {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
    </button>
  )
}

function SocialChip({ href, emoji, label }: { href: string; emoji: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm text-foreground/80 hover:text-foreground transition-colors"
      style={{
        background: "rgba(201,168,92,0.07)",
        border: "1px solid rgba(201,168,92,0.18)",
      }}
    >
      <span>{emoji}</span>
      {label}
    </a>
  )
}
