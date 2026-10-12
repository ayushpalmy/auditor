// Pure, client-safe helper to split an answer into text and [#N] citation tokens
// so the UI can render citations as clickable links to source-record rows.
//
// Resilient to how LLMs actually emit citations: single ("[#1]"), grouped
// ("[#1, #2]" / "[#1,#2]") and ranges ("[#1-#3]"). Each index becomes its own
// citation segment so every one is individually clickable.

export type CitationSegment =
  | { type: "text"; value: string }
  | { type: "citation"; index: number; label: string }

function expandIndices(raw: string): number[] {
  const out: number[] = []
  for (const part of raw.split(",")) {
    const cleaned = part.replace(/#/g, "").trim()
    if (!cleaned) continue
    if (cleaned.includes("-")) {
      const [a, b] = cleaned.split("-").map((s) => parseInt(s.trim(), 10))
      if (Number.isFinite(a) && Number.isFinite(b) && b >= a && b - a < 100) {
        for (let n = a; n <= b; n++) out.push(n)
      } else if (Number.isFinite(a)) {
        out.push(a)
      }
    } else {
      const n = parseInt(cleaned, 10)
      if (Number.isFinite(n)) out.push(n)
    }
  }
  return out
}

export function splitCitations(text: string): CitationSegment[] {
  const segments: CitationSegment[] = []
  const re = /\[#\s*(\d+(?:\s*[,\-]\s*#?\s*\d+)*)\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) })
    }
    for (const index of expandIndices(match[1])) {
      segments.push({ type: "citation", index, label: `[#${index}]` })
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) })
  }

  return segments
}
