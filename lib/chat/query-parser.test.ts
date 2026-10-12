import { describe, expect, it } from "vitest"
import { parseQuery } from "./query-parser"

const NOW = new Date("2026-06-15T00:00:00.000Z")

describe("parseQuery", () => {
  it("extracts supplier terms while dropping scaffolding words", () => {
    const q = parseQuery("Show me Acme invoices", NOW)
    expect(q.terms).toContain("Acme")
    expect(q.terms).not.toContain("Show")
    expect(q.terms).not.toContain("invoices")
  })

  it("parses an 'over' amount threshold in major units", () => {
    const q = parseQuery("invoices over 5,000", NOW)
    expect(q.amountMin).toBe(5000)
    expect(q.amountMax).toBeUndefined()
  })

  it("parses 'under' and 'between' thresholds", () => {
    expect(parseQuery("receipts under 100", NOW).amountMax).toBe(100)
    const between = parseQuery("transactions between 1000 and 2000", NOW)
    expect(between.amountMin).toBe(1000)
    expect(between.amountMax).toBe(2000)
  })

  it("supports the k shorthand for thousands", () => {
    expect(parseQuery("invoices over 5k", NOW).amountMin).toBe(5000)
  })

  it("resolves a month name to a full-month date range using the current year", () => {
    const q = parseQuery("Acme invoices from March", NOW)
    expect(q.dateFrom).toBe("2026-03-01")
    expect(q.dateTo).toBe("2026-03-31")
  })

  it("respects an explicit year after the month", () => {
    const q = parseQuery("spending in February 2025", NOW)
    expect(q.dateFrom).toBe("2025-02-01")
    expect(q.dateTo).toBe("2025-02-28")
  })

  it("detects income vs expense intent", () => {
    expect(parseQuery("total income this year", NOW).type).toBe("income")
    expect(parseQuery("how much did we spend on supplies", NOW).type).toBe("expense")
  })

  it("combines supplier, month and amount in a realistic question", () => {
    const q = parseQuery("Show me Acme invoices from March over 5,000", NOW)
    expect(q.terms).toContain("Acme")
    expect(q.amountMin).toBe(5000)
    expect(q.dateFrom).toBe("2026-03-01")
    expect(q.dateTo).toBe("2026-03-31")
  })
})
