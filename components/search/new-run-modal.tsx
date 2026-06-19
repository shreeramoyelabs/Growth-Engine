"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Loader2, Sparkles, Search, MapPin } from "lucide-react"

function kmToZoom(km: number): number {
  return Math.max(8, Math.min(18, Math.round(12 + Math.log2(10 / km))))
}

const RADIUS_MIN = 1, RADIUS_MAX = 50, RADIUS_DEFAULT = 5

function RadiusInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const adjust = (delta: number) =>
    onChange(Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, value + delta)))

  return (
    <div
      className="flex items-center h-9 rounded-lg overflow-hidden bg-white/70"
      style={{ border: "1px solid rgba(201,168,92,0.5)" }}
    >
      <button type="button" onClick={() => adjust(-1)} disabled={value <= RADIUS_MIN}
        className="w-9 h-full flex items-center justify-center text-lg font-light text-muted-foreground hover:bg-gold-50 hover:text-gold-600 transition-colors disabled:opacity-25"
        style={{ borderRight: "1px solid rgba(201,168,92,0.35)" }}>−</button>
      <div className="flex-1 flex items-center justify-center gap-1 px-1">
        <input
          type="text" inputMode="numeric" value={value}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, "")
            if (raw === "") { onChange(RADIUS_MIN); return }
            const v = parseInt(raw)
            if (!isNaN(v)) onChange(Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, v)))
          }}
          className="w-9 text-center text-sm font-semibold bg-transparent outline-none tabular-nums text-foreground"
        />
        <span className="text-xs text-muted-foreground/65 font-medium">km</span>
      </div>
      <button type="button" onClick={() => adjust(1)} disabled={value >= RADIUS_MAX}
        className="w-9 h-full flex items-center justify-center text-lg font-light text-muted-foreground hover:bg-gold-50 hover:text-gold-600 transition-colors disabled:opacity-25"
        style={{ borderLeft: "1px solid rgba(201,168,92,0.35)" }}>+</button>
    </div>
  )
}

interface NewRunModalProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onComplete?: () => void
}

const CC_LABELS: Record<string, string> = {
  us: "🇺🇸 United States", in: "🇮🇳 India", gb: "🇬🇧 United Kingdom",
  ca: "🇨🇦 Canada", au: "🇦🇺 Australia", sg: "🇸🇬 Singapore", ae: "🇦🇪 UAE",
}

const PRESETS = [
  { label: "Dallas, TX", lat: "32.7767", lng: "-96.7970", cc: "us" },
  { label: "New York, NY", lat: "40.7128", lng: "-74.0060", cc: "us" },
  { label: "Los Angeles, CA", lat: "34.0522", lng: "-118.2437", cc: "us" },
  { label: "Chicago, IL", lat: "41.8781", lng: "-87.6298", cc: "us" },
  { label: "Lucknow, India", lat: "26.8467", lng: "80.9462", cc: "in" },
  { label: "London, UK", lat: "51.5074", lng: "-0.1278", cc: "gb" },
  { label: "Toronto, CA", lat: "43.6532", lng: "-79.3832", cc: "ca" },
  { label: "Sydney, AU", lat: "-33.8688", lng: "151.2093", cc: "au" },
]

export function NewRunModal({ open, onOpenChange, onComplete }: NewRunModalProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({
    query: "",
    lat: "",
    lng: "",
    radiusKm: RADIUS_DEFAULT,
    countryCode: "us",
  })

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  const applyPreset = (p: (typeof PRESETS)[0]) =>
    setForm((f) => ({ ...f, lat: p.lat, lng: p.lng, countryCode: p.cc }))

  const handleSubmit = () => {
    if (!form.query || !form.lat || !form.lng) return
    setLoading(true)

    // Fire-and-forget — pipeline takes 2-3 min, don't block the UI.
    // Goes through /api/scrape which adds the auth + secret + owner_id.
    fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: form.query,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        zoom: kmToZoom(form.radiusKm),
        countryCode: form.countryCode,
      }),
    }).catch(() => {})

    setTimeout(() => {
      setLoading(false)
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onOpenChange(false)
        onComplete?.()
        setForm({ query: "", lat: "", lng: "", radiusKm: RADIUS_DEFAULT, countryCode: "us" })
      }, 2500)
    }, 800)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[460px]"
        style={{
          background: "var(--surface-modal)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(201,168,92,0.2)",
          boxShadow: "0 4px 6px rgba(160,120,60,0.06), 0 20px 60px rgba(160,120,60,0.14)",
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {success ? "Pipeline Running" : "New Lead Search"}
          </DialogTitle>
          {!success && (
            <p className="text-sm text-muted-foreground">
              Scrape Google Maps then auto-enrich all results
            </p>
          )}
        </DialogHeader>

        {success ? (
          <div className="py-10 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.2)" }}
            >
              <Sparkles size={26} className="text-emerald-500" />
            </div>
            <p className="font-display text-lg font-semibold text-foreground mb-1">
              Search launched!
            </p>
            <p className="text-sm text-muted-foreground">
              New leads will appear in your table in 2–3 minutes.
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Query */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Business Type <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. property management companies"
                className="border-gold-200 focus-visible:ring-gold-300 text-sm"
                value={form.query}
                onChange={(e) => set("query", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>

            {/* Location presets */}
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <MapPin size={11} /> Location
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    className="text-[11px] px-2.5 py-1 rounded-lg border transition-colors"
                    style={
                      form.lat === p.lat
                        ? {
                            background: "rgba(201,168,92,0.12)",
                            borderColor: "rgba(201,168,92,0.4)",
                            color: "#A8843A",
                            fontWeight: 500,
                          }
                        : {
                            background: "rgba(253,248,238,0.6)",
                            borderColor: "rgba(201,168,92,0.2)",
                            color: "#7C6040",
                          }
                    }
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Latitude</Label>
                  <Input
                    placeholder="32.7767"
                    className="border-gold-200 text-sm"
                    value={form.lat}
                    onChange={(e) => set("lat", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Longitude</Label>
                  <Input
                    placeholder="-96.7970"
                    className="border-gold-200 text-sm"
                    value={form.lng}
                    onChange={(e) => set("lng", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Options row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center justify-between">
                  <span>Search Radius</span>
                  <span className="text-[10px] text-muted-foreground/55 font-normal">1 – 50 km</span>
                </Label>
                <RadiusInput
                  value={form.radiusKm}
                  onChange={(v) => setForm((f) => ({ ...f, radiusKm: v }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Country</Label>
                <Select value={form.countryCode} onValueChange={(v) => v && set("countryCode", v)}>
                  <SelectTrigger className="border-gold-200 text-sm">
                    <span className="text-foreground text-sm">{CC_LABELS[form.countryCode] ?? form.countryCode.toUpperCase()}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="us">🇺🇸 United States</SelectItem>
                    <SelectItem value="in">🇮🇳 India</SelectItem>
                    <SelectItem value="gb">🇬🇧 United Kingdom</SelectItem>
                    <SelectItem value="ca">🇨🇦 Canada</SelectItem>
                    <SelectItem value="au">🇦🇺 Australia</SelectItem>
                    <SelectItem value="sg">🇸🇬 Singapore</SelectItem>
                    <SelectItem value="ae">🇦🇪 UAE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              className="w-full text-white gap-2 h-10"
              style={{
                background: "linear-gradient(135deg, #D4A853, #C9A85C)",
                boxShadow: "0 2px 8px rgba(201,168,92,0.3)",
              }}
              onClick={handleSubmit}
              disabled={loading || !form.query || !form.lat || !form.lng}
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Running pipeline…
                </>
              ) : (
                <>
                  <Search size={15} /> Run Full Pipeline
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
