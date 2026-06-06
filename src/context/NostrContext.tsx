import { createContext, useCallback, useContext, useMemo, useReducer } from "react"
import type { ReactNode } from "react"
import type { Article, NostrStatus, Profile } from "@/types/nostr"
import { nostrReducer, initialState } from "@/context/nostrReducer"
import type { NostrAction, NostrState } from "@/context/nostrReducer"

export type { NostrAction }

type NostrContextValue = NostrState & { refetch: () => void }

const NostrContext = createContext<NostrContextValue | null>(null)

export function NostrProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(nostrReducer, initialState)

  const refetch = useCallback(() => dispatch({ type: "RESET" }), [])

  const value = useMemo(
    () => ({ ...state, refetch }),
    [state, refetch]
  )

  return <NostrContext.Provider value={value}>{children}</NostrContext.Provider>
}

export function useNostr(): NostrState & {
  refetch: () => void
  articles: Article[]
  profiles: Map<string, Profile>
  status: NostrStatus
} {
  const ctx = useContext(NostrContext)
  if (!ctx) throw new Error("useNostr must be used inside <NostrProvider>")
  return ctx
}
