"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertTriangle, Eraser, Info, Loader2, Send } from "lucide-react"
import { useEffect, useRef, useState } from "react"

type Reference = {
  id: string
  type: string
  merchant: string | null
  name: string | null
  amount: number | null
  currencyCode: string | null
  date: string | null
}

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  references?: Reference[]
  noResults?: boolean
  isError?: boolean
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function formatAmount(amount: number | null, currency: string | null) {
  if (amount == null) return "—"
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency ?? ""} ${amount}`.trim()
  }
}

function ReferenceTable({ references }: { references: Reference[] }) {
  return (
    <div className="mt-3 rounded-md border bg-muted/30" data-testid="chat-references-block">
      <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
        Source records ({references.length})
      </div>
      <Table data-testid="chat-references-table">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[90px]">Date</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="w-[70px]">Type</TableHead>
            <TableHead className="w-[120px] text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {references.map((r, i) => (
            <TableRow key={r.id} data-testid={`chat-reference-row-${i}`}>
              <TableCell className="text-xs text-muted-foreground">{r.date ?? "—"}</TableCell>
              <TableCell className="text-sm">{r.merchant ?? "—"}</TableCell>
              <TableCell className="text-sm">{r.name ?? "—"}</TableCell>
              <TableCell className="text-xs capitalize">{r.type}</TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {formatAmount(r.amount, r.currencyCode)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, loading])

  async function sendMessage() {
    const question = input.trim()
    if (!question || loading) return

    const userMessage: ChatMessage = { id: uid(), role: "user", content: question }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content: data.answer || "",
            references: data.references || [],
            noResults: data.noResults,
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content: data.error || "Something went wrong. Please try again.",
            references: data.references || [],
            isError: true,
          },
        ])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: "Could not reach the server. Please check your connection and try again.",
          isError: true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-full flex-col p-4 md:p-6" data-testid="chat-page">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">AI Assistant</h1>
          <p className="text-sm text-muted-foreground">Ask questions about your own records.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMessages([])}
          disabled={loading || messages.length === 0}
          data-testid="chat-clear-button"
        >
          <Eraser className="mr-1 h-4 w-4" />
          Clear
        </Button>
      </div>

      <Alert className="mb-4" data-testid="chat-disclaimer">
        <Info className="h-4 w-4" />
        <AlertTitle>Grounded in your records</AlertTitle>
        <AlertDescription>
          Answers are generated from your own TaxHacker records only and may be incomplete. This is
          not tax, legal, or accounting advice.
        </AlertDescription>
      </Alert>

      <div
        ref={scrollRef}
        className="mb-4 flex-1 space-y-4 overflow-y-auto rounded-lg border bg-background p-4"
        data-testid="chat-messages"
      >
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            <div data-testid="chat-empty-state">
              Try: <span className="font-medium">&ldquo;Show me Acme invoices from March over 5,000&rdquo;</span>
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end" data-testid="chat-message-user">
              <div className="max-w-[80%] whitespace-pre-wrap rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex justify-start" data-testid="chat-message-assistant">
              <div className="w-full max-w-[90%]">
                {m.isError ? (
                  <Alert variant="destructive" data-testid="chat-error">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Unable to answer</AlertTitle>
                    <AlertDescription>{m.content}</AlertDescription>
                  </Alert>
                ) : (
                  <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    {m.noResults && (
                      <div
                        className="mt-3 flex items-center gap-2 rounded-md bg-amber-100 px-3 py-2 text-xs text-amber-900"
                        data-testid="chat-no-results"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        No matching records were found for this question.
                      </div>
                    )}
                  </div>
                )}
                {m.references && m.references.length > 0 && (
                  <ReferenceTable references={m.references} />
                )}
              </div>
            </div>
          )
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="chat-loading">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching your records and thinking…
          </div>
        )}
      </div>

      <div className="flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about invoices, receipts or transactions…"
          rows={2}
          className="resize-none"
          disabled={loading}
          data-testid="chat-message-input"
        />
        <Button
          onClick={sendMessage}
          disabled={loading || input.trim().length === 0}
          data-testid="chat-send-button"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="ml-1 hidden md:inline">Send</span>
        </Button>
      </div>
    </div>
  )
}
