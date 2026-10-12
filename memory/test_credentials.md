# Test Credentials — TaxHacker

## App runtime (preview)
- Next.js app served on port 3000 (supervisor program `nextjs`).
- A proxy (supervisor program `apiproxy`) forwards port 8001 -> 3000 so the
  Emergent ingress (`/api/*` -> 8001, everything else -> 3000) reaches the
  Next.js monolith correctly.
- Preview URL: https://c840c2e3-b8a8-4480-b89e-8f74dc2c2c88.preview.emergentagent.com

## Authentication
- `SELF_HOSTED_MODE=true` → NO login required. Every request is automatically
  resolved to the single self-hosted user `taxhacker@localhost`.
- There is no firm/organization model in TaxHacker; data isolation is per-user
  (userId). The authenticated user IS the firm boundary.

## AI provider (Claude via fal.ai)
- Env vars: `FAL_KEY` (CONFIGURED in /app/.env), `CLAUDE_MODEL=anthropic/claude-sonnet-4.5`.
- Live Claude via fal.ai (fal-ai/any-llm) is ACTIVE and verified: grounded
  answers with [#] citations + source records. If FAL_KEY is ever removed, the
  endpoint returns a safe 503 and still shows retrieved records.

## Database
- PostgreSQL 15 (local), DATABASE_URL in /app/.env. Seeded with 12 synthetic
  demo transactions for `taxhacker@localhost` via `npx tsx scripts/seed-demo.mts`.
