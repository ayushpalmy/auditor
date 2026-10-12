// Thin, server-only adapter for calling Claude through fal.ai (fal-ai/any-llm).
// Reads FAL_KEY and CLAUDE_MODEL from the environment. No provider fallback.
// Never logs the key or raw financial payloads.

import { fal } from "@fal-ai/client"

export const DEFAULT_CLAUDE_MODEL = "anthropic/claude-sonnet-4.5"
export const FAL_ANY_LLM_ENDPOINT = "fal-ai/any-llm"

export class FalConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FalConfigError"
  }
}

export class FalProviderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FalProviderError"
  }
}

export function getFalConfig(): { falKey?: string; model: string } {
  const falKey = process.env.FAL_KEY?.trim() || undefined
  const model = process.env.CLAUDE_MODEL?.trim() || DEFAULT_CLAUDE_MODEL
  return { falKey, model }
}

export function assertFalConfigured(): { falKey: string; model: string } {
  const { falKey, model } = getFalConfig()
  if (!falKey) {
    throw new FalConfigError("The AI provider is not configured. Set FAL_KEY to enable chat.")
  }
  if (!model) {
    throw new FalConfigError("No Claude model is configured. Set CLAUDE_MODEL.")
  }
  return { falKey, model }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new FalProviderError("The AI provider timed out. Please try again.")), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

export type AskClaudeArgs = {
  system?: string
  prompt: string
  timeoutMs?: number
}

export async function askClaude({ system, prompt, timeoutMs = 45000 }: AskClaudeArgs): Promise<string> {
  const { falKey, model } = assertFalConfigured()

  fal.config({ credentials: falKey })

  const input: Record<string, unknown> = { model, prompt }
  if (system) {
    input.system_prompt = system
  }

  let result: unknown
  try {
    result = await withTimeout(fal.subscribe(FAL_ANY_LLM_ENDPOINT, { input }), timeoutMs)
  } catch (err) {
    if (err instanceof FalProviderError) throw err
    // Deliberately generic — never surface credentials or raw provider internals.
    const message = err instanceof Error ? err.message : "Unknown AI provider error"
    throw new FalProviderError(`The AI provider failed to respond: ${message}`)
  }

  const data = (result as { data?: Record<string, unknown> })?.data ?? (result as Record<string, unknown>)
  const output = data?.output

  if (typeof output !== "string" || output.trim().length === 0) {
    if (data?.error) {
      throw new FalProviderError(`The AI provider returned an error: ${String(data.error)}`)
    }
    throw new FalProviderError("The AI provider returned an empty or malformed response.")
  }

  return output.trim()
}
