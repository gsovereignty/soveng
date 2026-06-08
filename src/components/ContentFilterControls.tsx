import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

interface ContentFilterControlsProps {
  filterEnabled: boolean
  onFilterEnabledChange: (enabled: boolean) => void
  spamThreshold: number
  onSpamThresholdChange: (threshold: number) => void
  filteredCount: number
  downloadProgress: number | null
  modelFailed: boolean
}

export function ContentFilterControls({
  filterEnabled,
  onFilterEnabledChange,
  spamThreshold,
  onSpamThresholdChange,
  filteredCount,
  downloadProgress,
  modelFailed,
}: ContentFilterControlsProps) {
  // Map 0–1 float to integer 50–99 for slider display and back via /100 (D-02: range 0.50–0.99)
  const sliderValue = Math.round(spamThreshold * 100)

  return (
    <div className="flex flex-col gap-2 border-b border-terminal-border py-2 mb-2">

      {/* Row 1: on/off toggle + filtered-count badge (CTRL-04, CTRL-03) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch
            checked={filterEnabled}
            onCheckedChange={onFilterEnabledChange}
            size="sm"
            className="data-[state=checked]:bg-terminal-green data-[state=unchecked]:bg-terminal-border"
          />
          <span className="font-mono text-xs text-terminal-green-dim">content filter</span>
        </div>
        {filterEnabled && filteredCount > 0 && (
          <Badge
            variant="outline"
            className="font-mono text-xs rounded-none border-terminal-border text-terminal-muted"
          >
            {filteredCount} hidden
          </Badge>
        )}
      </div>

      {/* Row 2: spam confidence slider (CTRL-05, D-02) — only when filter is on */}
      {filterEnabled && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-terminal-muted w-20 shrink-0">spam gate</span>
            <Slider
              min={50}
              max={99}
              step={1}
              value={[sliderValue]}
              onValueChange={([v]) => onSpamThresholdChange(v / 100)}
              className="flex-1"
            />
            <span className="font-mono text-xs text-terminal-muted w-10 text-right shrink-0">
              {sliderValue}%
            </span>
          </div>
          {sliderValue >= 99 && (
            <p className="font-mono text-xs text-terminal-muted pl-23">
              &gt; max disables spam filter — use to recover false positives (D-07)
            </p>
          )}
        </div>
      )}

      {/* Row 3: model download progress indicator (CTRL-02) */}
      {downloadProgress !== null && (
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-terminal-muted w-20 shrink-0">loading model</span>
          <Progress value={downloadProgress} className="flex-1 h-1 rounded-none" />
          <span className="font-mono text-xs text-terminal-muted w-10 text-right shrink-0">
            {downloadProgress}%
          </span>
        </div>
      )}

      {/* Row 4: non-blocking model failure notice */}
      {modelFailed && (
        <p className="font-mono text-xs text-terminal-amber">
          [WARN] content filter unavailable — all articles shown
        </p>
      )}

    </div>
  )
}
