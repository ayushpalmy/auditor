// Seeds the self-hosted user with defaults and synthetic demo records so the
// AI chat page can be tried live. SYNTHETIC DATA ONLY — no real financial data.
// Run: npx tsx scripts/seed-demo.mts   (DATABASE_URL must be set)

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../prisma/client/client"
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CURRENCIES,
  DEFAULT_FIELDS,
  DEFAULT_PROJECTS,
  DEFAULT_SETTINGS,
} from "../models/defaults-data"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const SELF_HOSTED_USER = {
  email: "taxhacker@localhost",
  name: "TaxHacker",
  membershipPlan: "unlimited",
}

function utc(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day))
}

// amounts here are in cents (TaxHacker stores `total` in cents).
const DEMO = [
  { merchant: "Acme Corp", name: "Invoice INV-1001", type: "income", total: 750000, issuedAt: utc(2026, 2, 5), description: "Consulting services, March" },
  { merchant: "Acme Corp", name: "Invoice INV-1002", type: "income", total: 520050, issuedAt: utc(2026, 2, 18), description: "Retainer, March" },
  { merchant: "Acme Corp", name: "Invoice INV-1003", type: "income", total: 320000, issuedAt: utc(2026, 2, 27), description: "Support hours, March" },
  { merchant: "Acme Corp", name: "Invoice INV-0990", type: "income", total: 600000, issuedAt: utc(2026, 1, 12), description: "Consulting, February" },
  { merchant: "Hooli", name: "Invoice HL-55", type: "income", total: 500000, issuedAt: utc(2026, 2, 9), description: "Platform fees, March" },
  { merchant: "Initech", name: "Invoice IT-204", type: "income", total: 980000, issuedAt: utc(2026, 2, 22), description: "Integration project" },
  { merchant: "Stark Industries", name: "Invoice SI-7", type: "income", total: 1500000, issuedAt: utc(2025, 11, 15), description: "Annual license, December" },
  { merchant: "Soylent Corp", name: "Invoice SC-31", type: "income", total: 420000, issuedAt: utc(2026, 3, 3), description: "April engagement" },
  { merchant: "Globex", name: "Receipt GX-889", type: "expense", total: 12000, issuedAt: utc(2026, 0, 20), description: "Office snacks, January" },
  { merchant: "Umbrella Supplies", name: "Receipt US-120", type: "expense", total: 45075, issuedAt: utc(2026, 2, 14), description: "Printer paper & toner" },
  { merchant: "Office Depot", name: "Receipt OD-77", type: "expense", total: 8999, issuedAt: utc(2026, 2, 28), description: "Stationery, March" },
  { merchant: "Wayne Enterprises", name: "Expense WE-12", type: "expense", total: 230000, issuedAt: utc(2025, 10, 8), description: "Contractor payment, November" },
]

async function upsertDefaults(userId: string) {
  for (const p of DEFAULT_PROJECTS) {
    await prisma.project.upsert({ where: { userId_code: { code: p.code, userId } }, update: { name: p.name, color: p.color, llm_prompt: p.llm_prompt }, create: { ...p, userId } })
  }
  for (const c of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({ where: { userId_code: { code: c.code, userId } }, update: { name: c.name, color: c.color, llm_prompt: c.llm_prompt }, create: { ...c, userId } })
  }
  for (const cur of DEFAULT_CURRENCIES) {
    await prisma.currency.upsert({ where: { userId_code: { code: cur.code, userId } }, update: { name: cur.name }, create: { ...cur, userId } })
  }
  for (const f of DEFAULT_FIELDS) {
    await prisma.field.upsert({ where: { userId_code: { code: f.code, userId } }, update: { name: f.name, type: f.type, llm_prompt: f.llm_prompt, isVisibleInList: f.isVisibleInList, isVisibleInAnalysis: f.isVisibleInAnalysis, isRequired: f.isRequired, isExtra: f.isExtra }, create: { ...f, userId } })
  }
  for (const s of DEFAULT_SETTINGS) {
    await prisma.setting.upsert({ where: { userId_code: { code: s.code, userId } }, update: { name: s.name, description: s.description, value: s.value }, create: { ...s, userId } })
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required")

  const user = await prisma.user.upsert({
    where: { email: SELF_HOSTED_USER.email },
    update: SELF_HOSTED_USER,
    create: SELF_HOSTED_USER,
  })

  await upsertDefaults(user.id)

  await prisma.transaction.deleteMany({ where: { userId: user.id } })
  for (const t of DEMO) {
    await prisma.transaction.create({
      data: { userId: user.id, currencyCode: "USD", ...t },
    })
  }

  const count = await prisma.transaction.count({ where: { userId: user.id } })
  console.log(`Seeded user ${user.email} with ${count} demo transactions.`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
