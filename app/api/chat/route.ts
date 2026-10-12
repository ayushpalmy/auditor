import { getSession } from "@/lib/auth"
import { askClaude, FalConfigError, FalProviderError } from "@/lib/chat/fal-claude"
import { buildChatPrompt, buildSystemPrompt, ChatTurn } from "@/lib/chat/prompt"
import { parseQuery } from "@/lib/chat/query-parser"
import { RetrievedRecord, retrieveTransactions } from "@/lib/chat/retrieval"
import { getUserById } from "@/models/users"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type ChatResponse = {
  success: boolean
  answer?: string
  references?: RetrievedRecord[]
  noResults?: boolean
  error?: string
}

function sanitizeMessages(raw: unknown): ChatTurn[] | null {
  if (!Array.isArray(raw)) return null
  const out: ChatTurn[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") return null
    const role = (item as { role?: unknown }).role
    const content = (item as { content?: unknown }).content
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null
    const trimmed = content.trim()
    if (!trimmed) continue
    // Bound size to keep prompts small and avoid abuse.
    out.push({ role, content: trimmed.slice(0, 4000) })
  }
  return out
}

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  // 1) Authenticate and resolve the user server-side. Never trust client identity.
  const session = await getSession()
  if (!session || !session.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const user = await getUserById(session.user.id)
  if (!user) {
    return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
  }

  // 2) Validate input. Firm/user context is derived from the session only — any
  // userId/firmId in the body is ignored entirely.
  let messages: ChatTurn[] | null
  try {
    const body = await request.json()
    messages = sanitizeMessages(body?.messages)
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
  }

  if (!messages || messages.length === 0) {
    return NextResponse.json({ success: false, error: "No messages provided" }, { status: 400 })
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user")
  if (!lastUser) {
    return NextResponse.json({ success: false, error: "No question found in messages" }, { status: 400 })
  }

  // 3) Firm (user)-scoped, read-only retrieval.
  let records: RetrievedRecord[]
  try {
    const parsed = parseQuery(lastUser.content)
    records = await retrieveTransactions(user.id, parsed)
  } catch (err) {
    console.error("[chat] retrieval failed:", err instanceof Error ? err.name : "unknown")
    return NextResponse.json({ success: false, error: "Failed to search your records" }, { status: 500 })
  }

  // 4) Call Claude via fal.ai with strictly grounded context.
  const history = messages.slice(0, messages.lastIndexOf(lastUser))
  const prompt = buildChatPrompt(lastUser.content, records, history)

  try {
    const answer = await askClaude({ system: buildSystemPrompt(), prompt })
    return NextResponse.json({
      success: true,
      answer,
      references: records,
      noResults: records.length === 0,
    })
  } catch (err) {
    if (err instanceof FalConfigError) {
      return NextResponse.json({ success: false, error: err.message, references: records }, { status: 503 })
    }
    if (err instanceof FalProviderError) {
      console.error("[chat] provider error:", err.message)
      return NextResponse.json({ success: false, error: err.message, references: records }, { status: 502 })
    }
    console.error("[chat] unexpected error")
    return NextResponse.json({ success: false, error: "Something went wrong. Please try again." }, { status: 500 })
  }
}
