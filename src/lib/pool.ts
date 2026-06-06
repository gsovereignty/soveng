import { SimplePool } from "nostr-tools/pool"

export const RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
  "wss://relay.primal.net",
]

// Created ONCE at module evaluation time — never inside a React component or hook body
export const pool = new SimplePool()
