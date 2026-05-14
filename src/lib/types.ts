// src/lib/types.ts
// Toate tipurile folosite în aplicație — un singur loc de adevăr

export type VibeCheck = 'nightmare' | 'rough' | 'meh' | 'decent' | 'solid' | 'impressive'

// Ce returnează Claude API după ce analizează un site
export interface RoastResult {
  total_score: number
  scores: {
    clarity: number      // 0-25
    credibility: number  // 0-25
    design: number       // 0-25
    conversion: number   // 0-25
  }
  pull_quote: string     // fraza shareabilă, max 15 cuvinte
  roast_lines: string[]  // 3-5 probleme specifice
  one_priority: string   // cel mai important lucru de fixat
  vibe_check: VibeCheck
}

// Ce salvăm în baza de date Supabase
export interface RoastRecord {
  id: string
  url: string
  result: RoastResult
  user_id: string | null  // null dacă e anonim
  is_public: boolean      // true dacă userul a ales să distribuie
  created_at: string
}

// Utilizator din Supabase Auth
export interface UserProfile {
  id: string
  email: string
  credits: number         // câte roast-uri mai are disponibile
  is_subscribed: boolean  // plătitor activ
  created_at: string
}

// Request body pentru POST /api/roast
export interface RoastRequest {
  url: string
}

// Response de la POST /api/roast
export type RoastResponse =
  | { success: true; roast_id: string; result: RoastResult }
  | { success: false; error: string }
