import type { Article } from "@/types/nostr"

/**
 * Build the static facet list: tags sorted by article count desc, alphabetical tie-break.
 * Used for display order in FilterBar (D-06). Counts are over all articles (unfiltered).
 */
export function buildFacets(articles: Article[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const article of articles) {
    for (const tag of article.hashtags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/**
 * Compute dynamic faceted counts (D-08).
 * OR mode: count of all articles carrying each tag (independent of current selection).
 * AND mode: count of articles that carry the tag AND all other currently-selected tags.
 * A selected tag always shows count >= 1 (never misleading zero) under these semantics.
 */
export function computeDynamicCounts(
  articles: Article[],
  selectedTags: Set<string>,
  matchMode: 'OR' | 'AND',
): Map<string, number> {
  const counts = new Map<string, number>()
  const allTags = new Set(articles.flatMap(a => a.hashtags))

  for (const tag of allTags) {
    if (matchMode === 'OR') {
      // OR: count articles that carry this tag across all articles (independent of selection)
      counts.set(tag, articles.filter(a => a.hashtags.includes(tag)).length)
    } else {
      // AND: count articles that carry this tag AND all other currently-selected tags
      const otherSelected = new Set([...selectedTags].filter(t => t !== tag))
      const base = otherSelected.size > 0
        ? articles.filter(a => [...otherSelected].every(t => a.hashtags.includes(t)))
        : articles
      counts.set(tag, base.filter(a => a.hashtags.includes(tag)).length)
    }
  }
  return counts
}
