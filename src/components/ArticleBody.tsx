// SECURITY NOTE:
// rehype-sanitize (default schema) strips <script>, event-handler attributes, and
// javascript: hrefs from the rendered output. The raw HTML rehype plugin is NOT
// used — it is explicitly forbidden by CLAUDE.md because it would allow HTML from
// untrusted article authors to reach the DOM. The components.a override adds
// target="_blank" via React props AFTER sanitization, not via schema extension —
// this satisfies D-05 (new-tab links) without loosening the sanitization policy.

import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { cn } from "@/lib/utils"

interface ArticleBodyProps {
  content: string
}

export function ArticleBody({ content }: ArticleBodyProps) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        // Headings — terminal green, monospace, with CRT glow on h1
        h1: ({ children }) => (
          <h1 className="crt-glow text-terminal-green font-mono text-lg font-bold mt-6 mb-3">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-terminal-green font-mono text-base font-semibold mt-5 mb-2">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-terminal-green-dim font-mono text-sm font-semibold mt-4 mb-1">{children}</h3>
        ),
        // Paragraphs — green-dim, relaxed line-height for readability
        p: ({ children }) => (
          <p className="font-mono text-sm text-terminal-green-dim mb-3 leading-relaxed">{children}</p>
        ),
        // Code: inline uses terminal-amber for contrast; pre wraps in terminal-surface
        code: ({ children, className }) => (
          <code className={cn("font-mono text-terminal-amber bg-terminal-surface px-1 text-xs", className ?? '')}>
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="bg-terminal-surface border border-terminal-border p-3 overflow-x-auto text-xs mb-3">
            {children}
          </pre>
        ),
        // Links: target="_blank" is added via React props (Pitfall 1 — after sanitization,
        // not via schema). This satisfies D-05 without extending the sanitize schema.
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-terminal-green underline hover:text-terminal-amber"
          >
            {children}
          </a>
        ),
        // Images: inline per D-05, constrained width, terminal border
        img: ({ src, alt }) => (
          <img
            src={src}
            alt={alt ?? ''}
            className="max-w-full h-auto my-3 border border-terminal-border"
          />
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-terminal-border pl-4 text-terminal-muted italic mb-3">
            {children}
          </blockquote>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside text-terminal-green-dim text-sm mb-3 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside text-terminal-green-dim text-sm mb-3 space-y-1">{children}</ol>
        ),
        li: ({ children }) => <li className="font-mono">{children}</li>,
        hr: () => <hr className="border-terminal-border my-4" />,
        strong: ({ children }) => <strong className="text-terminal-green font-bold">{children}</strong>,
        em: ({ children }) => <em className="text-terminal-amber not-italic">{children}</em>,
        // Tables (remark-gfm extension)
        table: ({ children }) => (
          <div className="overflow-x-auto mb-3">
            <table className="font-mono text-xs border-collapse border border-terminal-border w-full">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-terminal-border px-2 py-1 text-terminal-green text-left">{children}</th>
        ),
        td: ({ children }) => (
          <td className="border border-terminal-border px-2 py-1 text-terminal-green-dim">{children}</td>
        ),
      }}
    >
      {content}
    </Markdown>
  )
}
