import { useEffect } from "react"
import type { Dispatch } from "react"
import { pool, RELAYS } from "@/lib/pool"
import type { NostrAction } from "@/context/NostrContext"

/**
 * Opens a SINGLE batched #a tag subscription for all rendered article coordinates.
 * Dispatches REPLY_RECEIVED for each referencing event that arrives.
 * Mirrors the useProfileFetch pattern: one sub for all coordinates, maxWait tolerance.
 * ONE subscription for ALL articles — never one-sub-per-article (same rule as D-09).
 *
 * T-vqt-03: maxWait: 5000 ensures slow/hung relays do not block reply count renders.
 * Reply counts degrade gracefully to partial without blocking the UI.
 */
export function useReplyFetch(coordinates: string[], dispatch: Dispatch<NostrAction>): void {
  useEffect(() => {
    // Early-return when no coordinates — nothing to subscribe to (no cleanup needed)
    if (coordinates.length === 0) return

    const sub = pool.subscribeMany(
      RELAYS,
      { "#a": coordinates },
      {
        onevent(event) {
          dispatch({ type: "REPLY_RECEIVED", event })
        },
        maxWait: 5000,
      }
    )

    return () => {
      sub.close("reply effect cleanup")
    }
  }, [coordinates.join(",")]) // eslint-disable-line react-hooks/exhaustive-deps
}
