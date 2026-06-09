import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

const CAP = 10

interface FilterBarProps {
  facets: { tag: string; count: number }[]
  dynamicCounts: Map<string, number>
  selectedTags: Set<string>
  matchMode: 'OR' | 'AND'
  onTagToggle: (tag: string) => void
  onMatchModeChange: (mode: 'OR' | 'AND') => void
}

export function FilterBar({
  facets,
  dynamicCounts,
  selectedTags,
  matchMode,
  onTagToggle,
  onMatchModeChange,
}: FilterBarProps) {
  const [showAll, setShowAll] = useState(false)
  const visibleFacets = showAll ? facets : facets.slice(0, CAP)
  const hiddenCount = facets.length - CAP

  return (
    <div className="bg-terminal-bg border-b border-terminal-border py-2 px-0 mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className={cn("crt-glow text-terminal-green-dim text-xs tracking-widest uppercase")}>
          &gt; filter by tag
        </p>
        <ToggleGroup
          type="single"
          value={matchMode === 'OR' ? 'or' : 'all'}
          onValueChange={(val) => {
            // Guard: ignore val === '' (user clicked already-selected item — Pitfall 2)
            if (val === 'or' || val === 'all') onMatchModeChange(val === 'or' ? 'OR' : 'AND')
          }}
          className="font-mono text-xs border border-terminal-border rounded-none"
        >
          <ToggleGroupItem
            value="or"
            className="px-3 py-1 text-xs font-mono rounded-none data-[state=on]:bg-terminal-surface data-[state=on]:text-terminal-green"
          >
            Match ANY
          </ToggleGroupItem>
          <ToggleGroupItem
            value="all"
            className="px-3 py-1 text-xs font-mono rounded-none data-[state=on]:bg-terminal-surface data-[state=on]:text-terminal-green"
          >
            Match ALL
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {visibleFacets.map(({ tag }) => (
          <div key={tag} className="flex items-center gap-2">
            <Checkbox
              id={`tag-${tag}`}
              checked={selectedTags.has(tag)}
              onCheckedChange={(checked) => {
                if (checked !== 'indeterminate') onTagToggle(tag)
              }}
              className="border-terminal-border data-[state=checked]:bg-terminal-green data-[state=checked]:border-terminal-green rounded-none"
            />
            <label
              htmlFor={`tag-${tag}`}
              className="font-mono text-xs text-terminal-green-dim cursor-pointer select-none"
            >
              #{tag}
              <span className="ml-1 text-terminal-muted">({dynamicCounts.get(tag) ?? 0})</span>
            </label>
          </div>
        ))}
        {!showAll && hiddenCount > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className="font-mono text-xs text-terminal-muted hover:text-terminal-green-dim cursor-pointer"
          >
            &gt; more ({hiddenCount})
          </button>
        )}
      </div>
    </div>
  )
}
