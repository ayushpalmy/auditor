// Deterministic monthly spending / income summaries computed from the user's
// OWN already-retrieved (userId-scoped) records. All arithmetic is done in
// integer cents to avoid floating-point drift; records are de-duplicated by id
// so a record can never be counted twice. No AI math is involved.

import type { RetrievedRecord } from "./retrieval"

export type SupplierTotal = {
  merchant: string
  totalCents: number
  total: number // major units, for display
  count: number
}

export type MonthlySummary = {
  month: string // YYYY-MM
  currency: string
  totalCents: number
  total: number // major units, for display
  count: number
  suppliers: SupplierTotal[]
}

export type SummaryOptions = {
  // Which record type to summarize. "spending" -> expense by default.
  type?: "expense" | "income"
}

export function computeMonthlySummaries(
  records: RetrievedRecord[],
  options: SummaryOptions = {}
): MonthlySummary[] {
  const typeFilter = options.type ?? "expense"
  const seenIds = new Set<string>()

  // key = `${month}|${currency}`
  const monthMap = new Map<
    string,
    { month: string; currency: string; totalCents: number; count: number; suppliers: Map<string, SupplierTotal> }
  >()

  for (const r of records) {
    if (r.type !== typeFilter) continue
    if (r.amountCents == null || !r.date) continue // cannot attribute without amount or date
    if (seenIds.has(r.id)) continue // guard against duplicate counting
    seenIds.add(r.id)

    const month = r.date.slice(0, 7)
    const currency = r.currencyCode || "UNKNOWN"
    const key = `${month}|${currency}`

    let bucket = monthMap.get(key)
    if (!bucket) {
      bucket = { month, currency, totalCents: 0, count: 0, suppliers: new Map() }
      monthMap.set(key, bucket)
    }

    bucket.totalCents += r.amountCents
    bucket.count += 1

    const supplierName = r.merchant || "Unknown"
    const supplier = bucket.suppliers.get(supplierName)
    if (supplier) {
      supplier.totalCents += r.amountCents
      supplier.total = supplier.totalCents / 100
      supplier.count += 1
    } else {
      bucket.suppliers.set(supplierName, {
        merchant: supplierName,
        totalCents: r.amountCents,
        total: r.amountCents / 100,
        count: 1,
      })
    }
  }

  return Array.from(monthMap.values())
    .map((b) => ({
      month: b.month,
      currency: b.currency,
      totalCents: b.totalCents,
      total: b.totalCents / 100,
      count: b.count,
      suppliers: Array.from(b.suppliers.values()).sort((a, c) => c.totalCents - a.totalCents),
    }))
    .sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : a.currency.localeCompare(b.currency)))
}
