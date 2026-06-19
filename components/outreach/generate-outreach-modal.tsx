"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Sparkles, ChevronDown } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import type { Lead, SenderProfile } from "@/lib/types"

// Native <select> wrapper. base-ui Select silently drops onValueChange events
// when used inside a Dialog — same bug we hit on FilterBar. Native works.
function NativeSelect({
  value, onChange, children,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 pl-3 pr-8 text-sm rounded-md border appearance-none cursor-pointer outline-none transition-colors"
        style={{
          borderColor: "rgba(201,168,92,0.5)",
          background: "rgba(255,255,255,0.85)",
          color: "inherit",
        }}
      >
        {children}
      </select>
      <ChevronDown
        size={13}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50"
      />
    </div>
  )
}

interface GenerateOutreachModalProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  lead: Lead | null
  onComplete?: () => void
}

export function GenerateOutreachModal({
  open,
  onOpenChange,
  lead,
  onComplete,
}: GenerateOutreachModalProps) {
  const [profiles, setProfiles] = useState<SenderProfile[]>([])
  const [profileId, setProfileId] = useState("")
  const [channel, setChannel] = useState("email")
  const [tone, setTone] = useState("professional")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase
      .from("sender_profiles")
      .select("*")
      .order("created_at")
      .then(({ data }) => {
        setProfiles(data || [])
        const def = data?.find((p) => p.is_default) || data?.[0]
        if (def) setProfileId(def.id)
      })
  }, [])

  const handleGenerate = async () => {
    if (!profileId || !lead) return
    setLoading(true)
    try {
      await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: profileId,
          channel,
          tone,
          place_ids: [lead.place_id],
        }),
      })
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onOpenChange(false)
        onComplete?.()
      }, 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[380px]"
        style={{
          background: "var(--surface-modal)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(201,168,92,0.2)",
          boxShadow: "0 4px 6px rgba(160,120,60,0.06), 0 20px 60px rgba(160,120,60,0.14)",
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Generate Outreach</DialogTitle>
          {lead && (
            <p className="text-sm text-muted-foreground truncate">{lead.business_name}</p>
          )}
        </DialogHeader>

        {success ? (
          <div className="py-10 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{
                background: "rgba(22,163,74,0.08)",
                border: "1px solid rgba(22,163,74,0.2)",
              }}
            >
              <Sparkles size={24} className="text-emerald-500" />
            </div>
            <p className="font-display text-lg font-semibold mb-1">Done!</p>
            <p className="text-sm text-muted-foreground">
              Check the Outreach tab in the lead panel.
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Profile */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Sender Profile</Label>
              {profiles.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 rounded-lg bg-gold-50 border border-gold-200">
                  No profiles yet.{" "}
                  <a href="/profiles" className="text-gold-600 hover:underline font-medium">
                    Create one first →
                  </a>
                </p>
              ) : (
                <NativeSelect value={profileId} onChange={setProfileId}>
                  {!profileId && <option value="">Select a profile…</option>}
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.profile_name}{p.is_default ? " ★" : ""}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Channel</Label>
                <NativeSelect value={channel} onChange={setChannel}>
                  <option value="email">✉️ Email</option>
                  <option value="linkedin">💼 LinkedIn</option>
                  <option value="whatsapp">💬 WhatsApp</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Tone</Label>
                <NativeSelect value={tone} onChange={setTone}>
                  <option value="professional">Professional</option>
                  <option value="conversational">Conversational</option>
                  <option value="direct">Direct</option>
                </NativeSelect>
              </div>
            </div>

            <Button
              className="w-full text-white gap-2 h-10"
              style={{
                background:
                  profileId
                    ? "linear-gradient(135deg, #D4A853, #C9A85C)"
                    : undefined,
                boxShadow: profileId ? "0 2px 8px rgba(201,168,92,0.3)" : undefined,
              }}
              onClick={handleGenerate}
              disabled={loading || !profileId}
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Generating with Groq…
                </>
              ) : (
                <>
                  <Sparkles size={15} /> Generate Message
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
