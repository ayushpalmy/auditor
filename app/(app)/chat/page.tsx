import { ChatView } from "@/components/chat/chat-view"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "AI Assistant",
}

export const dynamic = "force-dynamic"

export default function ChatPage() {
  return <ChatView />
}
