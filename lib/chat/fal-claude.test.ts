import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { subscribe, config } = vi.hoisted(() => ({ subscribe: vi.fn(), config: vi.fn() }))
vi.mock("@fal-ai/client", () => ({
  fal: { subscribe, config },
}))

import {
  askClaude,
  assertFalConfigured,
  DEFAULT_CLAUDE_MODEL,
  FalConfigError,
  FalProviderError,
  getFalConfig,
} from "./fal-claude"

describe("fal-claude config", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("defaults the model when CLAUDE_MODEL is unset", () => {
    vi.stubEnv("CLAUDE_MODEL", "")
    expect(getFalConfig().model).toBe(DEFAULT_CLAUDE_MODEL)
  })

  it("throws a typed config error when FAL_KEY is missing", () => {
    vi.stubEnv("FAL_KEY", "")
    expect(() => assertFalConfigured()).toThrow(FalConfigError)
  })

  it("accepts a configured key and model", () => {
    vi.stubEnv("FAL_KEY", "test-key")
    vi.stubEnv("CLAUDE_MODEL", "anthropic/claude-haiku-4.5")
    const cfg = assertFalConfigured()
    expect(cfg.falKey).toBe("test-key")
    expect(cfg.model).toBe("anthropic/claude-haiku-4.5")
  })
})

describe("askClaude", () => {
  beforeEach(() => {
    subscribe.mockReset()
    config.mockReset()
    vi.stubEnv("FAL_KEY", "test-key")
    vi.stubEnv("CLAUDE_MODEL", "anthropic/claude-sonnet-4.5")
  })
  afterEach(() => vi.unstubAllEnvs())

  it("returns the provider output on success", async () => {
    subscribe.mockResolvedValue({ data: { output: "Hello from Claude" } })
    const out = await askClaude({ prompt: "hi", system: "be brief" })
    expect(out).toBe("Hello from Claude")
    expect(config).toHaveBeenCalledWith({ credentials: "test-key" })
    const [endpoint, opts] = subscribe.mock.calls[0]
    expect(endpoint).toBe("fal-ai/any-llm")
    expect(opts.input.model).toBe("anthropic/claude-sonnet-4.5")
    expect(opts.input.system_prompt).toBe("be brief")
  })

  it("throws a provider error on an empty/malformed response", async () => {
    subscribe.mockResolvedValue({ data: {} })
    await expect(askClaude({ prompt: "hi" })).rejects.toThrow(FalProviderError)
  })

  it("wraps underlying provider failures as FalProviderError", async () => {
    subscribe.mockRejectedValue(new Error("network down"))
    await expect(askClaude({ prompt: "hi" })).rejects.toThrow(FalProviderError)
  })

  it("refuses to call the provider when FAL_KEY is missing", async () => {
    vi.stubEnv("FAL_KEY", "")
    await expect(askClaude({ prompt: "hi" })).rejects.toThrow(FalConfigError)
    expect(subscribe).not.toHaveBeenCalled()
  })
})
