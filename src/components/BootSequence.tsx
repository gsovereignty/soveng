import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const DEFAULT_LINES = [
  "soveng v0.1 — nostr long-form reader",
  "initializing relay pool...",
  "connecting to wss://relay.damus.io       [OK]",
  "connecting to wss://nos.lol              [OK]",
  "connecting to wss://relay.nostr.band     [OK]",
  "connecting to wss://relay.primal.net     [OK]",
  "fetching kind:30023 articles...",
  "received 21 long-form articles           [OK]",
  "resolving author profiles (kind:0)...    [OK]",
  "ready.",
]

interface BootSequenceProps {
  lines?: string[]
  lineDelay?: number
  className?: string
}

export function BootSequence({
  lines = DEFAULT_LINES,
  lineDelay = 180,
  className,
}: BootSequenceProps) {
  const [visibleCount, setVisibleCount] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (visibleCount < lines.length) {
      const timer = setTimeout(() => {
        setVisibleCount((n) => n + 1)
      }, lineDelay)
      return () => clearTimeout(timer)
    } else {
      // Small pause before showing the prompt
      const timer = setTimeout(() => setDone(true), 400)
      return () => clearTimeout(timer)
    }
  }, [visibleCount, lines.length, lineDelay])

  return (
    <Card
      className={cn(
        "border-terminal-border bg-terminal-surface w-full max-w-2xl",
        className
      )}
    >
      <CardContent className="p-6 font-mono text-sm leading-relaxed">
        {lines.slice(0, visibleCount).map((line, i) => (
          <div
            key={i}
            className="line-reveal crt-glow text-terminal-green whitespace-pre"
            style={{ animationDelay: "0ms" }}
          >
            <span className="text-terminal-green-dim select-none">{">"} </span>
            {line}
          </div>
        ))}
        {done && (
          <div className="mt-2 crt-glow text-terminal-green flex items-center gap-1">
            <span className="text-terminal-green-dim select-none">{">"} </span>
            <span className="cursor-blink inline-block w-2 h-4 bg-terminal-green" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
