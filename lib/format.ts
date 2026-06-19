/**
 * Format a raw phone number string into a human-readable format.
 * Uses the lead's source_country_code for context.
 * Falls back gracefully when the number doesn't match known patterns.
 */
export function formatPhone(
  phone: string | null | undefined,
  countryCode?: string | null
): string | null {
  if (!phone) return null
  const raw = phone.trim()
  if (!raw) return null

  // Already has international prefix — try to reformat, else return as-is
  if (raw.startsWith("+")) {
    const d = raw.replace(/\D/g, "")
    if (d.startsWith("1") && d.length === 11)
      return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
    if (d.startsWith("91") && d.length === 12)
      return `+91 ${d.slice(2, 7)} ${d.slice(7)}`
    if (d.startsWith("44") && d.length >= 11)
      return `+44 ${d.slice(2, 6)} ${d.slice(6)}`
    if (d.startsWith("61") && d.length === 11)
      return `+61 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`
    if (d.startsWith("65") && d.length === 10)
      return `+65 ${d.slice(2, 6)} ${d.slice(6)}`
    if (d.startsWith("971") && d.length >= 11)
      return `+971 ${d.slice(3, 5)} ${d.slice(5)}`
    return raw
  }

  const d = raw.replace(/\D/g, "")
  const cc = (countryCode ?? "").toLowerCase()

  // US / Canada (NANP): 10 digits or 11 starting with 1
  if (cc === "us" || cc === "ca" || cc === "") {
    if (d.length === 10)
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
    if (d.length === 11 && d[0] === "1")
      return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  }

  // India: 10 digits (mobile starts 6-9) or 12 with 91 prefix
  if (cc === "in") {
    if (d.length === 10) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`
    if (d.length === 12 && d.startsWith("91"))
      return `+91 ${d.slice(2, 7)} ${d.slice(7)}`
  }

  // UK: 11 digits starting 07 (mobile) or 01/02 (geographic)
  if (cc === "gb") {
    if (d.length === 11 && d.startsWith("07"))
      return `${d.slice(0, 5)} ${d.slice(5)}`
    if (d.length === 11)
      return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`
  }

  // Australia: 10 digits starting 04 (mobile) or 02/03 (geographic)
  if (cc === "au") {
    if (d.length === 10) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`
  }

  // Singapore: 8 digits
  if (cc === "sg") {
    if (d.length === 8) return `${d.slice(0, 4)} ${d.slice(4)}`
  }

  // UAE: 9 digits after country code, or 10 starting 05 (mobile)
  if (cc === "ae") {
    if (d.length === 9) return `+971 ${d.slice(0, 2)} ${d.slice(2)}`
    if (d.length === 10 && d.startsWith("05"))
      return `+971 ${d.slice(1, 3)} ${d.slice(3)}`
  }

  // Generic 10-digit fallback
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`

  return raw
}

/**
 * Truncate a string to maxLen chars with ellipsis.
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + "…"
}

/**
 * Relative time string for scraped_at dates.
 * Used for freshness indicators.
 */
export function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

/**
 * Haversine distance in kilometres between two lat/lng points.
 * Returns null if any coordinate is missing.
 */
export function haversineKm(
  lat1: number | null | undefined,
  lon1: number | null | undefined,
  lat2: number | null | undefined,
  lon2: number | null | undefined
): number | null {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

/**
 * Format a distance in km for display ("0.3 km", "2.1 km", "15 km").
 */
export function fmtKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

/**
 * Human-readable relative time ("2m ago", "3h ago", "5d ago").
 */
export function timeAgo(dateStr: string): string {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (d < 60)    return `${d}s ago`
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}
