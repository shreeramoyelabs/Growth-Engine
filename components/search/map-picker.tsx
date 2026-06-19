"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

// Custom gold dot marker — avoids webpack icon issues
const goldMarker = L.divIcon({
  html: `<div style="width:16px;height:16px;background:#C9A85C;border:2.5px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(201,168,92,0.6)"></div>`,
  className: "",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

interface GeoResult {
  display_name: string
  lat: number
  lng: number
}

interface MapPickerProps {
  lat: string
  lng: string
  onChange: (lat: string, lng: string, label?: string) => void
}

// Handles map clicks
function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) { onMapClick(e.latlng.lat, e.latlng.lng) },
  })
  return null
}

// Flies map to new coordinates — uses provided zoom or keeps current
function MapFlyTo({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap()
  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], zoom ?? Math.max(map.getZoom(), 11), { duration: 0.9 })
    }
  }, [lat, lng, zoom, map])
  return null
}

export function MapPicker({ lat, lng, onChange }: MapPickerProps) {
  const [searchQuery, setSearchQuery]   = useState("")
  const [results, setResults]           = useState<GeoResult[]>([])
  const [searching, setSearching]       = useState(false)
  const [geoLoading, setGeoLoading]     = useState(false)
  const [flyZoom, setFlyZoom]           = useState<number | undefined>()
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const markerLat = parseFloat(lat) || 0
  const markerLng = parseFloat(lng) || 0
  const hasMarker  = !!lat && !!lng

  // Forward geocode — find coordinates from address text
  const geocode = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
        { headers: { "User-Agent": "GE-Dashboard/1.0 (growth-engine)" } }
      )
      const data = await res.json()
      setResults(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.map((d: any) => ({ display_name: d.display_name, lat: parseFloat(d.lat), lng: parseFloat(d.lon) }))
      )
    } catch { setResults([]) }
    finally { setSearching(false) }
  }, [])

  const handleSearchInput = (value: string) => {
    setSearchQuery(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => geocode(value), 600)
  }

  const selectResult = (r: GeoResult) => {
    setFlyZoom(12) // city-level zoom when selecting a place
    onChange(r.lat.toFixed(6), r.lng.toFixed(6), r.display_name)
    setSearchQuery(r.display_name.split(",")[0])
    setResults([])
  }

  // Geolocation — zoom all the way in (street-level 15)
  const useMyLocation = () => {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFlyZoom(15) // street-level zoom for "my location"
        onChange(pos.coords.latitude.toFixed(6), pos.coords.longitude.toFixed(6))
        setGeoLoading(false)
      },
      () => setGeoLoading(false)
    )
  }

  return (
    <div className="relative h-full flex flex-col">
      {/* ── Search bar — starts AFTER the leaflet zoom controls (~38px) ── */}
      <div className="absolute top-3 z-[1000] flex gap-2" style={{ left: "46px", right: "12px" }}>
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search city, address…"
            className="w-full h-9 pl-3 pr-8 text-sm rounded-xl border shadow-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.96)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(201,168,92,0.3)",
              color: "#1C1410",
            }}
          />
          {searching && (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          )}
          {/* Dropdown results */}
          {results.length > 0 && (
            <div
              className="absolute top-full mt-1 left-0 right-0 rounded-xl overflow-hidden shadow-lg z-[1001]"
              style={{ background: "rgba(255,255,255,0.97)", border: "1px solid rgba(201,168,92,0.25)" }}
            >
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => selectResult(r)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50 transition-colors border-b border-gold-100/60 last:border-0"
                  style={{ color: "#2d2415" }}
                >
                  {r.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={useMyLocation}
          disabled={geoLoading}
          title="Use my current location"
          className="h-9 px-3 text-xs rounded-xl font-medium transition-colors shrink-0"
          style={{
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(201,168,92,0.3)",
            color: "#7C5C28",
          }}
        >
          {geoLoading ? "…" : "📍 My Location"}
        </button>
      </div>

      {/* Map */}
      <div className="flex-1 rounded-2xl overflow-hidden" style={{ minHeight: "360px" }}>
        <MapContainer
          center={hasMarker ? [markerLat, markerLng] : [20, 0]}
          zoom={hasMarker ? 12 : 2}
          className="h-full w-full"
          style={{ height: "100%", minHeight: "360px" }}
          zoomControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onMapClick={(la, ln) => {
            setFlyZoom(undefined) // keep current zoom on click
            onChange(la.toFixed(6), ln.toFixed(6))
          }} />
          {hasMarker && (
            <>
              <Marker position={[markerLat, markerLng]} icon={goldMarker} />
              <MapFlyTo lat={markerLat} lng={markerLng} zoom={flyZoom} />
            </>
          )}
        </MapContainer>
      </div>

      {/* Coordinate pill */}
      {hasMarker && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs font-mono z-[1000] pointer-events-none"
          style={{
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(201,168,92,0.25)",
            color: "#7C5C28",
          }}
        >
          {parseFloat(lat).toFixed(4)}, {parseFloat(lng).toFixed(4)}
        </div>
      )}
    </div>
  )
}
