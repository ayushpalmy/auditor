import { RetrievedRecord } from "./retrieval"

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
    "- When you reference specific records, cite them by their [#N] index so the user can verify.",
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

export function buildChatPrompt(question: string, records: RetrievedRecord[], history: ChatTurn[] = []): string {
  return [
    "CONVERSATION SO FAR:",
    formatHistory(history),
    "",
    "RETRIEVED RECORDS (only these may be used to answer):",
    formatRecordsForPrompt(records),
    "",
    "QUESTION:",
    question,
  ].join("\n")
}
