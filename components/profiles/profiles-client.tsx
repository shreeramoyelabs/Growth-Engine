"use client"

import { useState, useEffect } from "react"
import { Plus, Pencil, Trash2, Check, Building2, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase/client"
import type { SenderProfile } from "@/lib/types"

export function ProfilesClient() {
  const [profiles, setProfiles] = useState<SenderProfile[]>([])
  const [editing, setEditing] = useState<SenderProfile | null>(null)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { data } = await supabase
      .from("sender_profiles")
      .select("*")
      .order("created_at")
    setProfiles(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this profile? This cannot be undone.")) return
    await supabase.from("sender_profiles").delete().eq("id", id)
    load()
  }

  const handleSetDefault = async (id: string) => {
    await supabase.from("sender_profiles").update({ is_default: false }).neq("id", id)
    await supabase.from("sender_profiles").update({ is_default: true }).eq("id", id)
    load()
  }

  return (
    <div className="min-h-full p-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="font-display text-[28px] font-bold text-foreground tracking-tight">
            Sender Profiles
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Named outreach identities — each with a unique pitch and audience
          </p>
        </div>
        <Button
          className="text-white gap-2 h-9"
          style={{
            background: "linear-gradient(135deg, #D4A853, #C9A85C)",
            boxShadow: "0 2px 8px rgba(201,168,92,0.3)",
          }}
          onClick={() => setCreating(true)}
        >
          <Plus size={14} /> New Profile
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-muted-foreground text-sm">Loading…</div>
      ) : profiles.length === 0 ? (
        <div className="glass-card rounded-2xl py-24 text-center animate-fade-up">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "rgba(201,168,92,0.08)" }}
          >
            <Building2 size={26} style={{ color: "#C9A85C" }} />
          </div>
          <p className="font-display text-xl font-semibold text-foreground mb-2">
            No profiles yet
          </p>
          <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
            Create a sender profile to generate personalized outreach messages for your leads
          </p>
          <Button
            className="text-white gap-2"
            style={{ background: "linear-gradient(135deg, #D4A853, #C9A85C)" }}
            onClick={() => setCreating(true)}
          >
            <Plus size={14} /> Create First Profile
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile, i) => (
            <div
              key={profile.id}
              className={cn(
                "glass-card glass-card-hover rounded-2xl p-5 group relative animate-fade-up"
              )}
              style={{
                animationDelay: `${i * 60}ms`,
                borderColor: profile.is_default
                  ? "rgba(201,168,92,0.35)"
                  : undefined,
              }}
            >
              {/* Default badge */}
              {profile.is_default && (
                <div className="absolute top-4 right-4 flex items-center gap-1">
                  <Star size={10} fill="#C9A85C" style={{ color: "#C9A85C" }} />
                  <span
                    className="text-[9px] font-bold uppercase tracking-wide"
                    style={{ color: "#A8843A" }}
                  >
                    Default
                  </span>
                </div>
              )}

              <h3 className="font-display text-base font-semibold text-foreground mb-0.5 pr-16">
                {profile.profile_name}
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                {profile.owner_name} · {profile.company_name}
              </p>
              <p className="text-xs text-foreground/65 leading-relaxed line-clamp-2 mb-3">
                {profile.service_description}
              </p>

              <div className="flex items-center gap-2 flex-wrap">
                {profile.target_industry && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-md"
                    style={{
                      background: "rgba(201,168,92,0.08)",
                      border: "1px solid rgba(201,168,92,0.2)",
                      color: "#7C5C28",
                    }}
                  >
                    {profile.target_industry}
                  </span>
                )}
                {profile.value_proposition && (
                  <span className="text-[10px] text-muted-foreground/60 italic truncate max-w-[120px]">
                    {profile.value_proposition}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 mt-4 pt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                style={{ borderTop: "1px solid rgba(201,168,92,0.12)" }}
              >
                {!profile.is_default && (
                  <button
                    onClick={() => handleSetDefault(profile.id)}
                    className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg hover:bg-gold-50 text-muted-foreground hover:text-gold-600 transition-colors"
                  >
                    <Check size={11} /> Set default
                  </button>
                )}
                <div className="flex gap-1 ml-auto">
                  <button
                    onClick={() => setEditing(profile)}
                    className="p-1.5 rounded-lg hover:bg-gold-50 text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(profile.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProfileFormDialog
        open={creating || editing !== null}
        profile={editing}
        onOpenChange={(v) => {
          if (!v) {
            setCreating(false)
            setEditing(null)
          }
        }}
        onSave={() => {
          setCreating(false)
          setEditing(null)
          load()
        }}
      />
    </div>
  )
}

function ProfileFormDialog({
  open,
  profile,
  onOpenChange,
  onSave,
}: {
  open: boolean
  profile: SenderProfile | null
  onOpenChange: (v: boolean) => void
  onSave: () => void
}) {
  const blank = {
    profile_name: "",
    owner_name: "",
    company_name: "",
    service_description: "",
    value_proposition: "",
    target_industry: "",
  }
  const [form, setForm] = useState({ ...blank })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        profile_name: profile.profile_name,
        owner_name: profile.owner_name,
        company_name: profile.company_name,
        service_description: profile.service_description,
        value_proposition: profile.value_proposition || "",
        target_industry: profile.target_industry || "",
      })
    } else {
      setForm({ ...blank })
    }
  }, [profile, open])

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.profile_name || !form.owner_name || !form.company_name || !form.service_description)
      return
    setLoading(true)
    if (profile) {
      await supabase.from("sender_profiles").update(form).eq("id", profile.id)
    } else {
      await supabase.from("sender_profiles").insert(form)
    }
    setLoading(false)
    onSave()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[500px]"
        style={{
          background: "var(--surface-modal)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(201,168,92,0.2)",
          boxShadow: "0 4px 6px rgba(160,120,60,0.06), 0 20px 60px rgba(160,120,60,0.14)",
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {profile ? "Edit Profile" : "New Sender Profile"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Used by the LLM to personalize outreach messages
          </p>
        </DialogHeader>

        <div className="space-y-3.5 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Profile Name <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="My agency pitch"
                className="border-gold-200 focus-visible:ring-gold-300 text-sm"
                value={form.profile_name}
                onChange={(e) => set("profile_name", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Your Name <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Samarth Kumar"
                className="border-gold-200 text-sm"
                value={form.owner_name}
                onChange={(e) => set("owner_name", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Company <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="OyeLabs"
                className="border-gold-200 text-sm"
                value={form.company_name}
                onChange={(e) => set("company_name", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Target Industry</Label>
              <Input
                placeholder="property management"
                className="border-gold-200 text-sm"
                value={form.target_industry}
                onChange={(e) => set("target_industry", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Service Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="We build marketing automation systems for local service businesses"
              className="border-gold-200 focus-visible:ring-gold-300 text-sm h-[72px] resize-none"
              value={form.service_description}
              onChange={(e) => set("service_description", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Value Proposition</Label>
            <Input
              placeholder="Done-for-you setup, no monthly retainer"
              className="border-gold-200 text-sm"
              value={form.value_proposition}
              onChange={(e) => set("value_proposition", e.target.value)}
            />
          </div>

          <Button
            className="w-full text-white gap-2 h-10"
            style={{
              background: "linear-gradient(135deg, #D4A853, #C9A85C)",
              boxShadow: "0 2px 8px rgba(201,168,92,0.3)",
            }}
            onClick={handleSave}
            disabled={
              loading ||
              !form.profile_name ||
              !form.owner_name ||
              !form.company_name ||
              !form.service_description
            }
          >
            {loading ? "Saving…" : profile ? "Save Changes" : "Create Profile"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
