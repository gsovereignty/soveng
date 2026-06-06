import { useEffect } from "react"
import type { Dispatch } from "react"
import { Metadata } from "nostr-tools/kinds"
import { pool, RELAYS } from "@/lib/pool"
import type { NostrAction } from "@/context/NostrContext"

/**
 * Opens a SINGLE batched kind:0 subscription for all rendered author pubkeys.
 * Dispatches PROFILE_RECEIVED for each event that arrives.
 * Profiles upgrade article display in place — no global loading gate (D-08).
 * ONE subscription for ALL authors — never one-sub-per-author (D-09 / Anti-Pattern 3).
 */
export function useProfileFetch(pubkeys: string[], dispatch: Dispatch<NostrAction>): void {
  useEffect(() => {
    // Early-return when no pubkeys — nothing to subscribe to (no cleanup needed)
    if (pubkeys.length === 0) return

    const sub = pool.subscribeMany(
      RELAYS,
      { kinds: [Metadata], authors: pubkeys },
      {
        onevent(event) {
          dispatch({ type: "PROFILE_RECEIVED", event })
        },
        maxWait: 5000,
      }
    )

    return () => {
      sub.close("profile effect cleanup")
    }
  }, [pubkeys.join(",")]) // eslint-disable-line react-hooks/exhaustive-deps
}
