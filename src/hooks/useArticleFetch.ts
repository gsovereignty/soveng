import { useEffect, useRef } from "react"
import type { Dispatch } from "react"
import { LongFormArticle } from "nostr-tools/kinds"
import { pool, RELAYS } from "@/lib/pool"
import { classifyRelayClose } from "@/lib/nostr"
import type { NostrAction } from "@/context/NostrContext"
import type { RelayOutcome } from "@/types/nostr"

type SubCloser = { close: (reason?: string) => void }

export function useArticleFetch(
  fetchKey: number,
  dispatch: Dispatch<NostrAction>,
  articleCount: number
) {
  // Hold the subscription handle in a ref so the freeze watcher effect can close it
  const subRef = useRef<SubCloser | null>(null)

  // Effect 1: open subscription, track per-relay outcomes, set up backstop timer
  useEffect(() => {
    const relayOutcomes = new Map<string, RelayOutcome>()
    RELAYS.forEach(url => relayOutcomes.set(url, "pending"))

    // frozen flag: once set, ignore further onevent calls (safe to set before close resolves)
    let frozen = false

    const sub = pool.subscribeMany(
      RELAYS,
      { kinds: [LongFormArticle], limit: 100 },
      {
        onevent(event) {
          if (frozen) return
          // Skip events with absent/empty d tag (Open Question 3 guard — avoids degenerate coordinates)
          const d = event.tags.find((t: string[]) => t[0] === "d")?.[1]
          if (!d) return
          dispatch({ type: "ARTICLE_RECEIVED", event })
        },
        onclose(reasons: string[]) {
          // Zip RELAYS with reasons by index (Pitfall 2 — preserve relay URL→outcome mapping)
          RELAYS.forEach((url, i) => {
            const reason = reasons[i] ?? "unknown"
            relayOutcomes.set(url, classifyRelayClose(reason))
          })
          // Resolve final status based on article count and relay outcomes
          const outcomes = Array.from(relayOutcomes.values())
          const allError = outcomes.every(o => o === "error")
          if (articleCount > 0) {
            dispatch({ type: "SET_STATUS", status: "done" })
          } else if (allError) {
            dispatch({ type: "SET_STATUS", status: "error" })
          } else {
            dispatch({ type: "SET_STATUS", status: "empty" })
          }
          frozen = true
        },
        maxWait: 8000,
      }
    )

    subRef.current = sub

    // D-04: 9000ms backstop timer — fires if onclose never fires (belt-and-suspenders)
    const timer = setTimeout(() => {
      sub.close("backstop timer fired")
    }, 9000)

    return () => {
      clearTimeout(timer)
      sub.close("effect cleanup")
      frozen = true
      subRef.current = null
    }
  }, [fetchKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Effect 2: freeze watcher — close subscription proactively once 21 articles accumulated (D-02, D-05)
  // Only fires from this watcher or cleanup — NEVER synchronously during setup (Pitfall 5)
  useEffect(() => {
    if (articleCount >= 21 && subRef.current) {
      subRef.current.close("freeze-at-21")
      subRef.current = null
      dispatch({ type: "SET_STATUS", status: "done" })
    }
  }, [articleCount, dispatch])
}
