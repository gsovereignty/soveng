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
