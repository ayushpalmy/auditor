import { describe, expect, it } from "vitest"
import { splitCitations } from "./citations"

describe("splitCitations", () => {
  it("returns a single text segment when there are no citations", () => {
    const segs = splitCitations("No records were found.")
    expect(segs).toEqual([{ type: "text", value: "No records were found." }])
  })

  it("extracts [#N] citations with their numeric index", () => {
    const segs = splitCitations("See invoice [#1] and [#2].")
    expect(segs).toEqual([
      { type: "text", value: "See invoice " },
      { type: "citation", index: 1, label: "[#1]" },
      { type: "text", value: " and " },
      { type: "citation", index: 2, label: "[#2]" },
      { type: "text", value: "." },
    ])
  })

  it("handles a citation at the very start", () => {
    const segs = splitCitations("[#3] is the largest invoice")
    expect(segs[0]).toEqual({ type: "citation", index: 3, label: "[#3]" })
  })

  it("maps a citation index to the zero-based reference row (index - 1)", () => {
    const segs = splitCitations("Invoice [#2]")
    const cite = segs.find((s) => s.type === "citation") as { index: number }
    expect(cite.index - 1).toBe(1) // row data-testid chat-reference-row-1
  })

  it("preserves multi-digit indexes", () => {
    const segs = splitCitations("entry [#12]")
    expect(segs[1]).toEqual({ type: "citation", index: 12, label: "[#12]" })
  })

  it("expands grouped citations like [#1, #2] into separate segments", () => {
    const segs = splitCitations("Both [#1, #2] match.")
    const cites = segs.filter((s) => s.type === "citation") as Array<{ index: number }>
    expect(cites.map((c) => c.index)).toEqual([1, 2])
  })

  it("handles comma-joined without spaces [#1,#2]", () => {
    const cites = splitCitations("see [#1,#2]").filter((s) => s.type === "citation") as Array<{ index: number }>
    expect(cites.map((c) => c.index)).toEqual([1, 2])
  })

  it("expands ranges like [#1-#3]", () => {
    const cites = splitCitations("rows [#1-#3]").filter((s) => s.type === "citation") as Array<{ index: number }>
    expect(cites.map((c) => c.index)).toEqual([1, 2, 3])
  })
})
