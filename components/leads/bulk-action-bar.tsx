"use client"

import { RefreshCw, MessageSquare, Download, X, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface BulkActionBarProps {
  selectedIds: Set<string>
  onClear: () => void
  onEnrich: (placeIds: string[]) => void
  onDeepEnrich: (placeIds: string[]) => void
  onGenerateOutreach: (placeIds: string[]) => void
  onExport: (placeIds: string[]) => void
  deepEnrichProgress?: { current: number; total: number } | null
}

export function BulkActionBar({
  selectedIds,
  onClear,
  onEnrich,
  onDeepEnrich,
  onGenerateOutreach,
  onExport,
  deepEnrichProgress = null,
}: BulkActionBarProps) {
  const count = selectedIds.size
  const ids = Array.from(selectedIds)
  const deepRunning = !!deepEnrichProgress

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        >
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-2xl shadow-glass-lg"
            style={{
              background: "rgba(28, 20, 10, 0.95)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(201,168,92,0.3)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(201,168,92,0.15)",
            }}
          >
            {/* Count badge */}
            <div
              className="px-2.5 py-1 rounded-lg text-sm font-semibold"
              style={{ background: "rgba(201,168,92,0.2)", color: "#E8D5A3" }}
            >
              {count} selected
            </div>

            <div className="w-px h-5 mx-1" style={{ background: "rgba(201,168,92,0.2)" }} />

            <ActionBtn
              icon={RefreshCw}
              label="Enrich"
              onClick={() => onEnrich(ids)}
            />
            <ActionBtn
              icon={Sparkles}
              label={
                deepRunning
                  ? `Deep ${deepEnrichProgress!.current}/${deepEnrichProgress!.total}`
                  : "Deep Enrich"
              }
              onClick={() => onDeepEnrich(ids)}
              disabled={deepRunning}
              accent="purple"
              pulse={deepRunning}
            />
            <ActionBtn
              icon={MessageSquare}
              label="Outreach"
              onClick={() => onGenerateOutreach(ids)}
            />
            <ActionBtn
              icon={Download}
              label="Export CSV"
              onClick={() => onExport(ids)}
            />

            <div className="w-px h-5 mx-1" style={{ background: "rgba(201,168,92,0.2)" }} />

            <button
              onClick={onClear}
              className="p-1.5 rounded-lg text-white/50 hover:text-white/90 hover:bg-white/10 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ActionBtn({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  accent,
  pulse = false,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  disabled?: boolean
  accent?: "purple"
  pulse?: boolean
}) {
  const accentStyle =
    accent === "purple"
      ? { color: "#d8b4fe" }
      : undefined
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      style={accentStyle}
    >
      <Icon size={13} className={pulse ? "animate-pulse" : ""} />
      {label}
    </button>
  )
}
