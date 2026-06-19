"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Sun, Moon } from "lucide-react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="w-8 h-8" />

  const isDark = theme === "dark"

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 text-muted-foreground hover:text-foreground"
      style={{
        background: isDark ? "rgba(201,168,92,0.12)" : "rgba(201,168,92,0.07)",
        border: "1px solid rgba(201,168,92,0.2)",
      }}
    >
      {isDark ? <Sun size={14} style={{ color: "#C9A85C" }} /> : <Moon size={14} />}
    </button>
  )
}
