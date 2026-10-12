import { beforeEach, describe, expect, it, vi } from "vitest"

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }))
vi.mock("@/lib/db", () => ({
  prisma: { transaction: { findMany } },
}))

import { buildTransactionWhere, normalizeTransaction, retrieveTransactions } from "./retrieval"
import type { ParsedQuery } from "./query-parser"

const empty: ParsedQuery = { terms: [] }

describe("buildTransactionWhere", () => {
  it("always scopes to the given userId", () => {
    const where = buildTransactionWhere("user-1", empty)
    expect(where.userId).toBe("user-1")
  })

  it("keeps the userId even when the (untrusted) query carries search terms", () => {
    const where = buildTransactionWhere("user-1", {
      terms: ["userId", "user-2", "'; DROP"],
      type: "income",
    } as ParsedQuery)
    // The forged content only ever lands in AND/OR term filters, never on userId.
    expect(where.userId).toBe("user-1")
    expect(where.type).toBe("income")
  })

  it("produces different scopes for different users (cross-firm isolation)", () => {
    const a = buildTransactionWhere("firm-a", empty)
    const b = buildTransactionWhere("firm-b", empty)
    expect(a.userId).toBe("firm-a")
    expect(b.userId).toBe("firm-b")
    expect(a.userId).not.toBe(b.userId)
  })

  it("converts major-unit amount thresholds into cents", () => {
    const where = buildTransactionWhere("u", { terms: [], amountMin: 5000, amountMax: 10000 })
    expect(where.total).toEqual({ gte: 500000, lte: 1000000 })
  })

  it("builds an inclusive issuedAt range from date strings", () => {
    const where = buildTransactionWhere("u", { terms: [], dateFrom: "2026-03-01", dateTo: "2026-03-31" })
    const range = where.issuedAt as { gte: Date; lte: Date }
    expect(range.gte.toISOString()).toBe("2026-03-01T00:00:00.000Z")
    expect(range.lte.toISOString()).toBe("2026-03-31T23:59:59.999Z")
  })
})

describe("normalizeTransaction", () => {
  it("converts cents to major units and dates to YYYY-MM-DD", () => {
    const r = normalizeTransaction({
      id: "t1",
      type: "income",
      merchant: "Acme",
      name: "INV-1",
      description: null,
      total: 520050,
      currencyCode: "USD",
      issuedAt: new Date("2026-03-10T12:00:00.000Z"),
      categoryCode: null,
    } as never)
    expect(r.amount).toBe(5200.5)
    expect(r.date).toBe("2026-03-10")
  })
})

describe("retrieveTransactions", () => {
  beforeEach(() => findMany.mockReset())

  it("refuses to run without a server-resolved userId", async () => {
    await expect(retrieveTransactions("", empty)).rejects.toThrow(/userId/)
    expect(findMany).not.toHaveBeenCalled()
  })

  it("queries only the current user's records and normalizes them", async () => {
    findMany.mockResolvedValue([
      {
        id: "t1",
        type: "income",
        merchant: "Acme",
        name: "INV",
        description: null,
        total: 100000,
        currencyCode: "USD",
        issuedAt: new Date("2026-03-01T00:00:00.000Z"),
        categoryCode: null,
      },
    ])
    const out = await retrieveTransactions("user-1", empty)
    expect(findMany).toHaveBeenCalledTimes(1)
    const arg = findMany.mock.calls[0][0]
    expect(arg.where.userId).toBe("user-1")
    expect(out).toHaveLength(1)
    expect(out[0].amount).toBe(1000)
  })
})
