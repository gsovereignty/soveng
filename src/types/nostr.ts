export type NostrStatus = 'streaming' | 'done' | 'empty' | 'error'

export type RelayOutcome = 'pending' | 'clean' | 'error'

export type Article = {
  id: string
  pubkey: string
  coordinate: string       // "30023:pubkey:d"
  d: string                // d-tag value
  title: string | undefined
  summary: string | undefined
  image: string | undefined
  publishedAt: number      // ms epoch (from published_at or created_at)
  createdAt: number        // ms epoch (event.created_at × 1000)
  content: string          // raw Markdown body
  hashtags: string[]       // lowercased t-tag values
}

export type Profile = {
  pubkey: string
  displayName: string | undefined
  picture: string | undefined
  createdAt: number        // Unix seconds (for newest-profile tracking)
}

// Classification labels for ML content filtering (Phase 5).
// 'pending'      — dispatched to worker, awaiting result (fail-open: show)
// 'ham'          — classified as not-spam (show)
// 'non-english'  — franc-min detected confident non-English (hide)
// 'short'        — below 500-word length gate, always on (hide, D-05/D-06)
// 'spam'         — ONNX score >= SPAM_THRESHOLD (hide)
// 'error'        — worker threw or model failed (fail-open: show)
export type ClassificationLabel =
  | 'pending'
  | 'ham'
  | 'non-english'
  | 'short'
  | 'spam'
  | 'error'

// Helper: returns true if an article with this label should be hidden.
// Explicit hide allowlist — everything else (undefined, pending, ham, error) shows (D-03/D-04 fail-open).
export function isHidden(label: ClassificationLabel | undefined): boolean {
  return label === 'spam' || label === 'non-english' || label === 'short'
}
