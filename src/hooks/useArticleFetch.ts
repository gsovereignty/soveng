import { useEffect, useRef } from "react"
import type { Dispatch } from "react"
import { LongFormArticle } from "nostr-tools/kinds"
import { pool, RELAYS } from "@/lib/pool"
import { classifyRelayClose, resolveArticleStatus } from "@/lib/nostr"
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

  // CR-01: track the LIVE article count in a ref. Effect 1 only depends on
  // [fetchKey], so any value captured in its closure (like the articleCount
  // parameter) is frozen at effect-creation time, when no articles have arrived
  // yet (count === 0). Articles arrive asynchronously via dispatch and update
  // this ref on every render, so onclose/backstop read the current count here
  // rather than a stale closure snapshot.
  const countRef = useRef(articleCount)
  countRef.current = articleCount

  // Effect 1: open subscription, track per-relay outcomes, set up backstop timer
  useEffect(() => {
    const relayOutcomes = new Map<string, RelayOutcome>()
    RELAYS.forEach(url => relayOutcomes.set(url, "pending"))

    // frozen flag: once set, ignore further onevent calls (safe to set before close resolves)
    let frozen = false

    // CR-03: guard against double terminal dispatch. Both onclose and the
    // backstop timer can resolve the status; whichever fires first wins, and the
    // other becomes a no-op. Without this guard a real onclose and the backstop
    // could dispatch conflicting statuses.
    let resolved = false

    // Resolve the final terminal status from the LIVE article count (CR-01) and
    // the relay outcomes. Idempotent via the `resolved` guard (CR-03).
    const resolveStatus = (allError: boolean) => {
      if (resolved) return
      resolved = true
      frozen = true
      dispatch({
        type: "SET_STATUS",
        status: resolveArticleStatus(countRef.current, allError),
      })
    }

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
          const outcomes = Array.from(relayOutcomes.values())
          const allError = outcomes.every(o => o === "error")
          resolveStatus(allError)
        },
        maxWait: 8000,
      }
    )

    subRef.current = sub

    // CR-03 / D-04: 9000ms backstop. In nostr-tools, onclose only fires once
    // EVERY relay has reported a close — a single hung relay means onclose never
    // fires and SubCloser.close() does not synthesize one, so without an explicit
    // dispatch here the UI would stay stuck on `streaming` forever. The backstop
    // therefore both closes the subscription AND forces a terminal status. It is
    // guarded by `resolved`, so if onclose already ran this is a no-op.
    const timer = setTimeout(() => {
      sub.close("backstop timer fired")
      // We have no per-relay reasons here; if no articles arrived treat it as a
      // timeout with no data (empty), not error, matching the no-relay-reason path.
      resolveStatus(false)
    }, 9000)

    return () => {
      clearTimeout(timer)
      sub.close("effect cleanup")
      frozen = true
      // Mark resolved so a late onclose triggered by this cleanup-close does not
      // dispatch a status into an unmounted/re-keyed effect.
      resolved = true
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
