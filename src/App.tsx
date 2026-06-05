import { BootSequence } from "@/components/BootSequence"

function App() {
  return (
    <div className="crt-scanlines crt-flicker min-h-screen bg-terminal-bg flex flex-col items-center justify-center p-8">
      <header className="w-full max-w-2xl mb-6">
        <p className="crt-glow text-terminal-green-dim text-xs tracking-widest uppercase">
          soveng // nostr long-form reader
        </p>
      </header>
      <main className="w-full max-w-2xl">
        <BootSequence />
      </main>
      <footer className="w-full max-w-2xl mt-6">
        <p className="text-terminal-muted text-xs">
          powered by nostr · built with react + vite · zero backend
        </p>
      </footer>
    </div>
  )
}

export default App
