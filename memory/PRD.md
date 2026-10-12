# TaxHacker — AI Chat MVP (PRD / Working Log)

## Original problem statement
Add a minimal, secure AI chat inside the existing TaxHacker app that answers an
accountant's questions using ONLY firm-scoped records already stored in the
system. Claude is reached through fal.ai. Read-only, session-only history,
strict server-side firm/user scoping. Do not deploy. Keep budget < 100 credits.

## Architecture (as inspected — reused, NOT migrated)
- **Framework:** Next.js 16 (App Router) + TypeScript (NOT React/FastAPI/Mongo).
- **DB:** PostgreSQL 15 + Prisma 7. **Auth:** better-auth (+ self-hosted single-user mode).
- **AI (existing):** LangChain providers for OpenAI/Google/Mistral (invoice parsing). No fal.ai/Claude before this MVP.
- **Firm model:** NONE. Data isolation is per `userId`. Per user decision, the
  authenticated user IS the firm boundary. All record queries are unconditionally
  scoped by the server-resolved `userId`; client-sent ids are ignored.
- **Records:** single `Transaction` model holds invoices/receipts/transactions
  (by `type`). Filterable: merchant(=supplier), total(cents), issuedAt(date),
  name, description, text, type.

## Preview runtime wiring
- Ingress routes `/api/*` → :8001 and everything else → :3000, but TaxHacker is a
  single Next.js server. Supervisor `nextjs` runs `next dev` on :3000; supervisor
  `apiproxy` (/app/scripts/proxy-8001.cjs) forwards :8001 → :3000.
- `next.config.ts` gained `allowedDevOrigins` for the preview hosts.
- PostgreSQL provisioned locally; `prisma migrate deploy` applied; 12 synthetic
  demo transactions seeded via `scripts/seed-demo.mts`.

## What's implemented (2026-06, verified)
- **fal.ai Claude adapter** `lib/chat/fal-claude.ts` — fal-ai/any-llm, model from
  `CLAUDE_MODEL` (default anthropic/claude-sonnet-4.5), key from `FAL_KEY`.
  Typed FalConfigError / FalProviderError, timeout, no secret logging. No fallback.
- **Query parser** `lib/chat/query-parser.ts` — deterministic NL → filters
  (supplier terms, amount over/under/between, month/year/relative dates, income/expense).
- **Retrieval** `lib/chat/retrieval.ts` — read-only, always userId-scoped; refuses
  to run without a server userId; normalizes cents→major units.
- **Prompt** `lib/chat/prompt.ts` — strict grounding, [#N] citations, no-records handling.
- **Endpoint** `app/api/chat/route.ts` — auth (getSession+getUserById) → retrieve →
  Claude → {answer, references, noResults, safe errors (401/400/503/502/500)}.
- **UI** `app/(app)/chat/page.tsx` + `components/chat/chat-view.tsx` — composer,
  session history, loading, error alert, clear, disclaimer, source-records table
  (renders on both success and error). Sidebar link "AI Assistant".
- **Tests** `lib/chat/*.test.ts` — 23 unit tests (parser, retrieval scoping /
  cross-user isolation / no-unscoped-query, fal config & failure handling). Full
  suite 64/64 pass. Frontend e2e verified by testing agent (iteration_2: 6/6).

## Security posture
- User resolved server-side every request; any body userId/firmId ignored.
- Every retrieval filtered by userId (unit-tested, incl. forged-input case).
- Read-only (no create/update/delete on records). No secret / raw-payload logging.
- Missing FAL_KEY → safe 503, no crash, records still shown.

## Known limitations / pending
- **FAL_KEY not yet provided** → live Claude answers paused by design; the
  provider-not-configured path is what is currently exercised. Set FAL_KEY in
  /app/.env and `supervisorctl restart nextjs` to enable live answers.
- Self-hosted mode = single user, so live cross-firm denial is covered by unit
  tests rather than two live logins.
- No persistent chat history (session-only, per spec).

## Backlog / next
- Enable live Claude once FAL_KEY is supplied; verify grounded answer + citations.
- Optional: amount/date chips in UI; richer multi-type result grouping.
