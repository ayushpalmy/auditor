// Deterministic, read-only parser that turns a natural-language accountant
// question into minimal structured filters for firm (user)-scoped retrieval.
// No AI call here — keeps retrieval cheap, predictable and testable.

export type ParsedQuery = {
  terms: string[]
  amountMin?: number // major units (e.g. dollars), not cents
  amountMax?: number
  dateFrom?: string // YYYY-MM-DD
  dateTo?: string // YYYY-MM-DD
  type?: "income" | "expense"
}

const MONTHS: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
}

// Words that are query scaffolding or map to structured filters — never merchant terms.
const NOISE_WORDS = new Set([
  "show", "me", "give", "find", "get", "list", "all", "the", "a", "an", "any", "some",
  "from", "over", "above", "under", "below", "between", "and", "or", "more", "less",
  "than", "greater", "lower", "in", "of", "with", "for", "my", "our", "us", "to", "at",
  "on", "by", "that", "are", "is", "was", "were", "worth", "around", "about", "please",
  "transactions", "transaction", "invoices", "invoice", "receipts", "receipt", "bills",
  "bill", "amount", "amounts", "total", "totals", "dated", "date", "dates", "spent",
  "paid", "cost", "costs", "value", "how", "much", "many", "what", "which", "who",
  "when", "where", "did", "do", "does", "have", "has", "had", "this", "last", "year",
  "month", "week", "day", "expense", "expenses", "income", "revenue", "revenues",
  "sales", "sale", "purchase", "purchases", "than", "money", "dollars", "dollar",
  "we", "they", "it", "i",
])

function toNumber(raw: string): number | undefined {
  const cleaned = raw.replace(/[$,€£\s]/g, "")
  const kMatch = cleaned.match(/^([\d.]+)k$/i)
  if (kMatch) return parseFloat(kMatch[1]) * 1000
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : undefined
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function monthRange(year: number, month: number): { dateFrom: string; dateTo: string } {
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return { dateFrom: `${year}-${pad(month + 1)}-01`, dateTo: `${year}-${pad(month + 1)}-${pad(last)}` }
}

function parseDates(q: string, now: Date): { dateFrom?: string; dateTo?: string } {
  // 1) Explicit ISO dates take priority.
  const isoDates = q.match(/\d{4}-\d{2}-\d{2}/g)
  if (isoDates && isoDates.length >= 2) return { dateFrom: isoDates[0], dateTo: isoDates[1] }
  if (isoDates && isoDates.length === 1) return { dateFrom: isoDates[0], dateTo: isoDates[0] }

  const currentYear = now.getUTCFullYear()

  // 2) "this year" / "last year"
  if (/\blast year\b/.test(q)) return { dateFrom: `${currentYear - 1}-01-01`, dateTo: `${currentYear - 1}-12-31` }
  if (/\bthis year\b/.test(q)) return { dateFrom: `${currentYear}-01-01`, dateTo: `${currentYear}-12-31` }

  // 3) "this month" / "last month"
  if (/\blast month\b/.test(q)) {
    const d = new Date(Date.UTC(currentYear, now.getUTCMonth() - 1, 1))
    return monthRange(d.getUTCFullYear(), d.getUTCMonth())
  }
  if (/\bthis month\b/.test(q)) return monthRange(currentYear, now.getUTCMonth())

  // 4) Month name, optionally followed by a year.
  for (const [name, month] of Object.entries(MONTHS)) {
    const re = new RegExp(`\\b${name}\\b(?:\\s+(\\d{4}))?`)
    const m = q.match(re)
    if (m) {
      const year = m[1] ? parseInt(m[1], 10) : currentYear
      return monthRange(year, month)
    }
  }

  // 5) Bare 4-digit year.
  const yearOnly = q.match(/\b(19|20)\d{2}\b/)
  if (yearOnly) {
    const y = parseInt(yearOnly[0], 10)
    return { dateFrom: `${y}-01-01`, dateTo: `${y}-12-31` }
  }

  return {}
}

function parseAmounts(q: string): { amountMin?: number; amountMax?: number } {
  const between = q.match(/between\s+\$?([\d,.]+k?)\s+and\s+\$?([\d,.]+k?)/i)
  if (between) {
    const a = toNumber(between[1])
    const b = toNumber(between[2])
    if (a !== undefined && b !== undefined) {
      return { amountMin: Math.min(a, b), amountMax: Math.max(a, b) }
    }
  }

  const result: { amountMin?: number; amountMax?: number } = {}
  const min = q.match(/(?:over|above|more than|greater than|at least|>=?|>)\s*\$?([\d,.]+k?)/i)
  if (min) {
    const v = toNumber(min[1])
    if (v !== undefined) result.amountMin = v
  }
  const max = q.match(/(?:under|below|less than|at most|<=?|<)\s*\$?([\d,.]+k?)/i)
  if (max) {
    const v = toNumber(max[1])
    if (v !== undefined) result.amountMax = v
  }
  return result
}

function parseType(q: string): "income" | "expense" | undefined {
  if (/\b(income|revenue|revenues|sales|earnings|invoiced)\b/.test(q)) return "income"
  if (/\b(expense|expenses|spending|spend|spends|spent|purchase|purchases|cost|costs|paid|bills?)\b/.test(q)) return "expense"
  return undefined
}

function parseTerms(original: string): string[] {
  const terms: string[] = []
  const seen = new Set<string>()
  // Keep original casing tokens so merchant names like "Acme" survive, but match
  // against a lowercased noise list.
  for (const token of original.split(/[^A-Za-z0-9&]+/)) {
    if (!token) continue
    const lower = token.toLowerCase()
    if (lower.length < 2) continue
    if (NOISE_WORDS.has(lower)) continue
    if (lower in MONTHS) continue
    if (/^\d+k?$/i.test(lower)) continue // pure numbers / amounts
    if (seen.has(lower)) continue
    seen.add(lower)
    terms.push(token)
    if (terms.length >= 6) break
  }
  return terms
}

export function parseQuery(question: string, now: Date = new Date()): ParsedQuery {
  const q = (question || "").toLowerCase()
  const { dateFrom, dateTo } = parseDates(q, now)
  const { amountMin, amountMax } = parseAmounts(q)
  return {
    terms: parseTerms(question || ""),
    amountMin,
    amountMax,
    dateFrom,
    dateTo,
    type: parseType(q),
  }
}
