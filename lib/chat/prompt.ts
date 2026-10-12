import type { RetrievedRecord } from "./retrieval"
import type { MonthlySummary } from "./summary"

export type ChatTurn = { role: "user" | "assistant"; content: string }

export const NO_RECORDS_TOKEN = "NO_RECORDS_FOUND"

export function buildSystemPrompt(): string {
  return [
    "You are TaxHacker's accounting assistant.",
    "You answer strictly using the RETRIEVED RECORDS supplied by the system. These records belong only to the current authenticated user.",
    "",
    "Rules:",
    "- Use ONLY the retrieved records. Never invent transactions, amounts, dates, suppliers, totals, or identifiers.",
    `- If the records section is "${NO_RECORDS_TOKEN}" or none of the records match the question, clearly say that no matching records were found. Do not guess.`,
    "- When you reference specific records, cite them by their [#N] index so the user can verify. Use one bracket per record, e.g. [#1][#2] — never group them as [#1, #2].",
    "- If a PRECOMPUTED TOTALS section is present, use those exact figures for any sums, totals, or per-supplier breakdowns. Never recompute or estimate totals yourself.",
    "- Clearly separate figures taken from records from any assumption you make.",
    "- Amounts are already in each record's own currency. Do not convert between currencies.",
    "- Be concise and factual. Prefer short answers and small tables.",
    "- You do not provide definitive tax, legal, or accounting advice; if asked for such advice, add a brief caution to verify with a professional.",
    "Respond in plain text.",
  ].join("\n")
}

export function formatRecordsForPrompt(records: RetrievedRecord[]): string {
  if (!records.length) return NO_RECORDS_TOKEN
  return records
    .map((r, i) => {
      const amount = r.amount != null ? `${r.amount} ${r.currencyCode ?? ""}`.trim() : "n/a"
      return (
        `[#${i + 1}] type=${r.type} | date=${r.date ?? "n/a"} | ` +
        `supplier=${r.merchant ?? "n/a"} | name=${r.name ?? "n/a"} | ` +
        `amount=${amount} | category=${r.categoryCode ?? "n/a"}`
      )
    })
    .join("\n")
}

function formatHistory(history: ChatTurn[]): string {
  if (!history.length) return "(no prior messages)"
  return history
    .slice(-6)
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`)
    .join("\n")
}

export function formatSummariesForPrompt(summaries: MonthlySummary[]): string {
  if (!summaries.length) return ""
  const lines = summaries.map((s) => {
    const suppliers = s.suppliers
      .map((sup) => `${sup.merchant}: ${sup.total.toFixed(2)} ${s.currency} (${sup.count})`)
      .join("; ")
    return `- ${s.month} [${s.currency}] total=${s.total.toFixed(2)} across ${s.count} record(s) | by supplier: ${suppliers}`
  })
  return ["PRECOMPUTED TOTALS (authoritative — use these exact figures; never recompute):", ...lines].join("\n")
}

export function buildChatPrompt(
  question: string,
  records: RetrievedRecord[],
  history: ChatTurn[] = [],
  summaries: MonthlySummary[] = []
): string {
  const parts = [
    "CONVERSATION SO FAR:",
    formatHistory(history),
    "",
    "RETRIEVED RECORDS (only these may be used to answer):",
    formatRecordsForPrompt(records),
  ]
  const summaryBlock = formatSummariesForPrompt(summaries)
  if (summaryBlock) {
    parts.push("", summaryBlock)
  }
  parts.push("", "QUESTION:", question)
  return parts.join("\n")
}
