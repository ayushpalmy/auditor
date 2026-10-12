// Pure, client-safe helper to split an answer into text and [#N] citation tokens
// so the UI can render citations as clickable links to source-record rows.

export type CitationSegment =
  | { type: "text"; value: string }
  | { type: "citation"; index: number; label: string }

export function splitCitations(text: string): CitationSegment[] {
  const segments: CitationSegment[] = []
  const re = /\[#(\d+)\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) })
    }
    segments.push({ type: "citation", index: parseInt(match[1], 10), label: match[0] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) })
  }

  return segments
}
