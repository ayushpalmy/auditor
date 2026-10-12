// Read-only, firm (user)-scoped retrieval over existing TaxHacker records.
// TaxHacker stores invoices / receipts / transactions in the single Transaction
// model (differentiated by `type`), so we retrieve from there only. Every query
// is unconditionally scoped by the server-resolved userId.

import { prisma } from "@/lib/db"
import type { Prisma, Transaction } from "@/prisma/client"
import type { ParsedQuery } from "./query-parser"

export type RetrievedRecord = {
  id: string
  type: string
  merchant: string | null
  name: string | null
  description: string | null
  amount: number | null // major units (total is stored in cents)
  currencyCode: string | null
  date: string | null // YYYY-MM-DD
  categoryCode: string | null
}

export const RETRIEVAL_LIMIT = 25

// Pure, unit-testable builder. userId is ALWAYS applied and can never be
// overridden by anything parsed from the (untrusted) question.
export function buildTransactionWhere(userId: string, q: ParsedQuery): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId }
  const and: Prisma.TransactionWhereInput[] = []

  if (q.terms.length > 0) {
    and.push({
      OR: q.terms.flatMap((term) => [
        { merchant: { contains: term, mode: "insensitive" as const } },
        { name: { contains: term, mode: "insensitive" as const } },
        { description: { contains: term, mode: "insensitive" as const } },
        { text: { contains: term, mode: "insensitive" as const } },
      ]),
    })
  }

  if (q.amountMin !== undefined || q.amountMax !== undefined) {
    where.total = {
      gte: q.amountMin !== undefined ? Math.round(q.amountMin * 100) : undefined,
      lte: q.amountMax !== undefined ? Math.round(q.amountMax * 100) : undefined,
    }
  }

  if (q.dateFrom || q.dateTo) {
    where.issuedAt = {
      gte: q.dateFrom ? new Date(`${q.dateFrom}T00:00:00.000Z`) : undefined,
      lte: q.dateTo ? new Date(`${q.dateTo}T23:59:59.999Z`) : undefined,
    }
  }

  if (q.type) {
    where.type = q.type
  }

  if (and.length > 0) {
    where.AND = and
  }

  return where
}

export function normalizeTransaction(t: Transaction): RetrievedRecord {
  return {
    id: t.id,
    type: t.type || "transaction",
    merchant: t.merchant ?? null,
    name: t.name ?? null,
    description: t.description ?? null,
    amount: t.total != null ? t.total / 100 : null,
    currencyCode: t.currencyCode ?? null,
    date: t.issuedAt ? t.issuedAt.toISOString().slice(0, 10) : null,
    categoryCode: t.categoryCode ?? null,
  }
}

export async function retrieveTransactions(
  userId: string,
  q: ParsedQuery,
  limit: number = RETRIEVAL_LIMIT
): Promise<RetrievedRecord[]> {
  // Hard guard: never run an unscoped query.
  if (!userId || typeof userId !== "string") {
    throw new Error("retrieveTransactions requires a server-resolved userId")
  }

  const where = buildTransactionWhere(userId, q)
  const rows = await prisma.transaction.findMany({
    where,
    orderBy: { issuedAt: "desc" },
    take: limit,
  })

  return rows.map(normalizeTransaction)
}
