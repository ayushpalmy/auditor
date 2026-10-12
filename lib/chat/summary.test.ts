import { describe, expect, it } from "vitest"
import { computeMonthlySummaries } from "./summary"
import type { RetrievedRecord } from "./retrieval"

function rec(partial: Partial<RetrievedRecord> & { id: string }): RetrievedRecord {
  return {
    id: partial.id,
    type: partial.type ?? "expense",
    merchant: partial.merchant ?? "Acme",
    name: partial.name ?? null,
    description: null,
    amount: partial.amountCents != null ? partial.amountCents / 100 : null,
    amountCents: partial.amountCents ?? null,
    currencyCode: partial.currencyCode ?? "USD",
    date: "date" in partial ? (partial.date ?? null) : "2026-03-10",
    categoryCode: null,
  }
}

describe("computeMonthlySummaries", () => {
  it("sums amounts exactly in integer cents and groups by month", () => {
    const out = computeMonthlySummaries([
      rec({ id: "1", merchant: "Globex", amountCents: 12034, date: "2026-03-01" }),
      rec({ id: "2", merchant: "Globex", amountCents: 999, date: "2026-03-20" }),
      rec({ id: "3", merchant: "Umbrella", amountCents: 45075, date: "2026-03-05" }),
    ])
    expect(out).toHaveLength(1)
    const march = out[0]
    expect(march.month).toBe("2026-03")
    expect(march.totalCents).toBe(12034 + 999 + 45075)
    expect(march.total).toBe(581.08)
    expect(march.count).toBe(3)
  })

  it("breaks down per supplier, sorted by amount descending", () => {
    const [march] = computeMonthlySummaries([
      rec({ id: "1", merchant: "Globex", amountCents: 12034 }),
      rec({ id: "2", merchant: "Globex", amountCents: 999 }),
      rec({ id: "3", merchant: "Umbrella", amountCents: 45075 }),
    ])
    expect(march.suppliers.map((s) => s.merchant)).toEqual(["Umbrella", "Globex"])
    expect(march.suppliers[0].totalCents).toBe(45075)
    expect(march.suppliers[1].totalCents).toBe(13033)
    expect(march.suppliers[1].count).toBe(2)
  })

  it("never counts the same record id twice", () => {
    const [march] = computeMonthlySummaries([
      rec({ id: "dup", amountCents: 5000 }),
      rec({ id: "dup", amountCents: 5000 }),
    ])
    expect(march.totalCents).toBe(5000)
    expect(march.count).toBe(1)
  })

  it("ignores records with missing amount or missing date", () => {
    const out = computeMonthlySummaries([
      rec({ id: "1", amountCents: null }),
      rec({ id: "2", amountCents: 5000, date: null }),
      rec({ id: "3", amountCents: 7000, date: "2026-02-01" }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].month).toBe("2026-02")
    expect(out[0].totalCents).toBe(7000)
  })

  it("keeps different currencies in separate buckets", () => {
    const out = computeMonthlySummaries([
      rec({ id: "1", amountCents: 1000, currencyCode: "USD", date: "2026-03-01" }),
      rec({ id: "2", amountCents: 2000, currencyCode: "EUR", date: "2026-03-01" }),
    ])
    expect(out).toHaveLength(2)
    const usd = out.find((m) => m.currency === "USD")!
    const eur = out.find((m) => m.currency === "EUR")!
    expect(usd.totalCents).toBe(1000)
    expect(eur.totalCents).toBe(2000)
  })

  it("filters by type (default expense) so income is excluded", () => {
    const records = [
      rec({ id: "1", type: "expense", amountCents: 1000 }),
      rec({ id: "2", type: "income", amountCents: 9999 }),
    ]
    const expenses = computeMonthlySummaries(records)
    expect(expenses[0].totalCents).toBe(1000)

    const income = computeMonthlySummaries(records, { type: "income" })
    expect(income[0].totalCents).toBe(9999)
  })

  it("sorts months most-recent first", () => {
    const out = computeMonthlySummaries([
      rec({ id: "1", amountCents: 100, date: "2026-01-10" }),
      rec({ id: "2", amountCents: 100, date: "2026-03-10" }),
      rec({ id: "3", amountCents: 100, date: "2026-02-10" }),
    ])
    expect(out.map((m) => m.month)).toEqual(["2026-03", "2026-02", "2026-01"])
  })
})
