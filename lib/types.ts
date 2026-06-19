export interface Lead {
  place_id: string
  business_name: string
  category: string | null
  full_address: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  website: string | null
  google_rating: number | null
  review_count: number | null
  maps_description: string | null
  opening_hours: string | null
  google_maps_url: string | null
  latitude: number | null
  longitude: number | null
  source_query: string | null
  source_lat: number | null
  source_lng: number | null
  source_country_code: string | null
  source_language: string | null
  scrape_run_id: string | null
  scraped_at: string
  created_at: string
  updated_at: string
  // Enrichment (from leads_full view)
  email: string | null
  all_emails_found: string | null
  website_phone: string | null
  all_phones_found: string | null
  owner_name: string | null
  linkedin_profiles: string | null
  linkedin: string | null
  facebook: string | null
  instagram: string | null
  twitter: string | null
  youtube: string | null
  tiktok: string | null
  company_description: string | null
  email_valid: string | null
  crawl_status: string | null
  sitemap_used: boolean | null
  pages_crawled: number | null
  enriched_at: string | null
  // Computed
  best_personalization_score: number | null
  best_outreach_status: "draft" | "sent" | "replied" | null
  lead_quality_score: number | null
  // User data
  notes: string | null
  is_starred: boolean | null
}

export interface LeadOutreach {
  id: string
  place_id: string
  profile_id: string | null
  channel: "email" | "linkedin" | "whatsapp"
  tone: "professional" | "conversational" | "direct"
  subject_line: string | null
  message_body: string
  linkedin_connection_note: string | null
  whatsapp_link: string | null
  personalization_score: number | null
  personalization_notes: string | null
  status: "draft" | "sent" | "replied"
  sent_at: string | null
  model_used: string | null
  generated_at: string
  created_at: string
}

export interface SenderProfile {
  id: string
  profile_name: string
  owner_name: string
  company_name: string
  service_description: string
  value_proposition: string | null
  target_industry: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export type Tier = "Ready" | "Review" | "Low" | "Skip"

export function getTier(score: number | null): Tier {
  if (score === null || score === undefined) return "Skip"
  if (score >= 75) return "Ready"
  if (score >= 50) return "Review"
  if (score >= 25) return "Low"
  return "Skip"
}

export const TIER_CONFIG: Record<
  Tier,
  { stroke: string; text: string; bg: string; border: string; ribbon: string }
> = {
  Ready: {
    stroke: "#16a34a",
    text: "#15803d",
    bg: "#f0fdf4",
    border: "rgba(22,163,74,0.22)",
    ribbon: "#16a34a",
  },
  Review: {
    stroke: "#d97706",
    text: "#b45309",
    bg: "#fffbeb",
    border: "rgba(217,119,6,0.22)",
    ribbon: "#d97706",
  },
  Low: {
    stroke: "#ea580c",
    text: "#c2410c",
    bg: "#fff7ed",
    border: "rgba(234,88,12,0.22)",
    ribbon: "#ea580c",
  },
  Skip: {
    stroke: "#dc2626",
    text: "#b91c1c",
    bg: "#fef2f2",
    border: "rgba(220,38,38,0.22)",
    ribbon: "#dc2626",
  },
}
