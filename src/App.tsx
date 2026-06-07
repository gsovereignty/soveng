import { BootSequence } from "@/components/BootSequence"
import { ArticleList } from "@/components/ArticleList"
import { NostrProvider } from "@/context/NostrContext"
import { useNostr } from "@/context/NostrContext"

// AppShell reads context — must live inside NostrProvider
function AppShell() {
  const { status, articles, profiles, refetch } = useNostr()

  return (
    <div className="crt-scanlines crt-flicker min-h-screen bg-terminal-bg flex flex-col items-center justify-center p-8">
      <header className="w-full max-w-2xl mb-6">
        <p className="crt-glow text-terminal-green-dim text-xs tracking-widest uppercase">
          soveng // nostr long-form reader
        </p>
      </header>
      <main className="w-full max-w-2xl">
        {/* Phase 3: progressive boot-then-stream (D-01) */}
        {status === "streaming" && articles.length === 0 ? (
          <BootSequence />
        ) : status === "error" ? (
          <div className="font-mono text-sm">
            <p className="text-terminal-amber mb-4">
              [ERR] relay connection failed — all relays returned errors
            </p>
            <button
              onClick={refetch}
              className="crt-glow border border-terminal-border text-terminal-green font-mono text-xs px-4 py-2 hover:bg-terminal-surface transition-colors cursor-pointer"
            >
              &gt; retry connection
            </button>
          </div>
        ) : status === "empty" ? (
          <div className="font-mono text-sm">
            <p className="text-terminal-muted mb-4">
              [EMPTY] relays responded but no articles found
            </p>
            <button
              onClick={refetch}
              className="crt-glow border border-terminal-border text-terminal-green font-mono text-xs px-4 py-2 hover:bg-terminal-surface transition-colors cursor-pointer"
            >
              &gt; retry fetch
            </button>
          </div>
        ) : (
          /* articles.length > 0 — streaming with articles, or done */
          <ArticleList articles={articles} profiles={profiles} status={status} />
        )}
      </main>
      <footer className="w-full max-w-2xl mt-6">
        <p className="text-terminal-muted text-xs">
          powered by nostr · built with react + vite · zero backend
        </p>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <NostrProvider>
      <AppShell />
    </NostrProvider>
  )
}
