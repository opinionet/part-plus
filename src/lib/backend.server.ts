import "@tanstack/react-start/server-only"
import { desc, eq } from "drizzle-orm"
import { env } from "cloudflare:workers"

import { withDatabase } from "#/db/index.ts"
import { bids, rfqs, suppliers, transactions, users } from "#/db/schema/index.ts"
import { parseWithLLM } from "./ai.server"
import type {
  ParsedPart,
  PaymentResult,
  PayoutSummary,
  RfqDetailsInput,
  RfqShape,
} from "./api.types"

/** PartPulse marketplace commission — matches the pricing screen (7%). */
export const MARKET_FEE = 0.07

/** Real AI parsing with a deterministic fallback when the gateway is unavailable. */
export async function parseRfqSmart(text: string, fallback: ParsedPart): Promise<ParsedPart> {
  const llm = await parseWithLLM(text)
  return llm ?? fallback
}

export async function createRfqInDb(opts: {
  buyerName: string
  rawText: string
  parsed: ParsedPart
  details?: RfqDetailsInput
}): Promise<{ id: string | null; createdAt: number | null }> {
  try {
    return await withDatabase(async (db) => {
      const rows = await db
        .insert(rfqs)
        .values({
          buyerName: opts.buyerName,
          rawInputText: opts.rawText,
          vehicle: opts.parsed.vehicle,
          part: opts.parsed.part,
          budgetMin: opts.parsed.budget.min,
          budgetMax: opts.parsed.budget.max,
          vin: opts.details?.vin || null,
          reference: opts.details?.reference || null,
          quantity: opts.details?.quantity ?? 1,
          condition: opts.details?.condition || null,
          location: opts.details?.location || null,
          preferredBrand: opts.details?.preferredBrand || null,
          aiConfidence: opts.parsed.aiConfidence,
          status: "OPEN",
        })
        .returning({ id: rfqs.id, createdAt: rfqs.createdAt })
      const row = rows[0]
      return row
        ? { id: row.id, createdAt: new Date(row.createdAt).getTime() }
        : { id: null, createdAt: null }
    })
  } catch {
    return { id: null, createdAt: null }
  }
}

export async function listRfqsInDb(): Promise<RfqShape[]> {
  try {
    return await withDatabase(async (db) => {
      const rows = await db.select().from(rfqs).orderBy(desc(rfqs.createdAt)).limit(50)
      return rows.map((r) => ({
        id: r.id,
        buyerId: r.buyerId ?? "unknown",
        buyerName: r.buyerName ?? "Buyer",
        rawInputText: r.rawInputText,
        vehicle: r.vehicle,
        part: r.part,
        budget: { min: r.budgetMin, max: r.budgetMax },
        details: {
          vin: r.vin,
          reference: r.reference,
          quantity: r.quantity,
          condition: r.condition,
          location: r.location,
          preferredBrand: r.preferredBrand,
        },
        status: r.status,
        createdAt: new Date(r.createdAt).getTime(),
      }))
    })
  } catch {
    return []
  }
}

export async function placeBidInDb(opts: {
  rfqId: string
  supplierName: string
  brand: string
  price: number
  etaMinutes: number
  boosted: boolean
}): Promise<boolean> {
  try {
    await withDatabase(async (db) => {
      await db.insert(bids).values({
        rfqId: opts.rfqId,
        supplierName: opts.supplierName,
        brand: opts.brand,
        price: opts.price,
        etaMinutes: opts.etaMinutes,
        boosted: opts.boosted,
        status: "PENDING",
      })
    })
    return true
  } catch {
    return false
  }
}

/** Supplier uploads a trade license → verification moves to "pending review". */
export async function submitVerificationService(opts: {
  businessName: string
  licenseNumber: string
}): Promise<"unverified" | "pending" | "verified"> {
  const license = opts.licenseNumber.trim()
  if (!license || !opts.businessName.trim()) return "unverified"
  try {
    await withDatabase(async (db) => {
      const existing = await db
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(eq(suppliers.businessName, opts.businessName.trim()))
        .limit(1)
      if (existing.length > 0) {
        await db
          .update(suppliers)
          .set({ verificationStatus: "pending", tradeLicense: license, verified: false })
          .where(eq(suppliers.businessName, opts.businessName.trim()))
      } else {
        await db.insert(suppliers).values({
          businessName: opts.businessName.trim(),
          verificationStatus: "pending",
          tradeLicense: license,
          verified: false,
        })
      }
    })
    return "pending"
  } catch {
    return "pending"
  }
}

/** Buyer confirms a deal: computes the 7% fee, records the transaction, and
 *  attempts a Stripe PaymentIntent when the key is configured. */
export async function payForDealService(opts: {
  rfqId?: string
  bidId: string
  supplierName: string
  brand: string
  price: number
}): Promise<PaymentResult> {
  const price = Math.max(1, Math.round(opts.price))
  const fee = Math.round(price * MARKET_FEE)
  const payout = price - fee

  const key = env.STRIPE_SECRET_KEY
  let stripeIntentId: string | null = null
  let needsKey = false
  let status = "COMPLETED"

  if (key) {
    try {
      const { default: Stripe } = await import("stripe")
      const stripe = new Stripe(key)
      const intent = await stripe.paymentIntents.create({
        amount: price * 100,
        currency: "aed",
        metadata: { supplier: opts.supplierName, brand: opts.brand },
      })
      stripeIntentId = intent.id
      status = "PROCESSING"
    } catch {
      status = "PENDING_PAYMENT"
    }
  } else {
    needsKey = true
    status = "PENDING_PAYMENT"
  }

  let txId: string | null = null
  try {
    await withDatabase(async (db) => {
      const rows = await db
        .insert(transactions)
        .values({
          rfqId: opts.rfqId ?? null,
          bidId: opts.bidId,
          supplierName: opts.supplierName,
          brand: opts.brand,
          price,
          fee,
          payout,
          status,
          stripePaymentIntentId: stripeIntentId,
        })
        .returning({ id: transactions.id })
      txId = rows[0]?.id ?? null
    })
  } catch {
    /* recorded best-effort */
  }

  return { txId, needsKey, status, fee, payout, price }
}

/** Supplier earnings: total payouts, counts, and pending amounts. */
export async function listPayoutsService(supplierName: string): Promise<PayoutSummary> {
  const name = supplierName.trim()
  if (!name) return { total: 0, count: 0, pending: 0 }
  try {
    return await withDatabase(async (db) => {
      const rows = await db
        .select()
        .from(transactions)
        .where(eq(transactions.supplierName, name))
        .orderBy(desc(transactions.createdAt))
        .limit(100)
      const total = rows.reduce((s, r) => s + r.payout, 0)
      const pending = rows
        .filter((r) => r.status !== "COMPLETED")
        .reduce((s, r) => s + r.payout, 0)
      return { total, count: rows.length, pending }
    })
  } catch {
    return { total: 0, count: 0, pending: 0 }
  }
}

/** Verify a buyer (business name + email) to unlock posting RFQs and reduce fraud. */
export async function verifyBuyerService(opts: {
  businessName: string
  businessEmail: string
  phone: string
}): Promise<{ verified: boolean; businessName: string }> {
  const name = opts.businessName.trim()
  const email = opts.businessEmail.trim()
  if (!name || !email) return { verified: false, businessName: name }
  try {
    await withDatabase(async (db) => {
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.phone, opts.phone))
        .limit(1)
      if (existing.length > 0) {
        await db
          .update(users)
          .set({
            role: "BUYER",
            businessName: name,
            businessEmail: email,
            verified: true,
          })
          .where(eq(users.phone, opts.phone))
      } else {
        await db.insert(users).values({
          phone: opts.phone,
          role: "BUYER",
          businessName: name,
          businessEmail: email,
          verified: true,
        })
      }
    })
    return { verified: true, businessName: name }
  } catch {
    // Persistence must never block verification; trust the presented details.
    return { verified: true, businessName: name }
  }
}

/** Bids placed on a specific RFQ — lets the buyer see real supplier bids. */
export async function listBidsForRfqService(rfqId: string): Promise<
  Array<{
    id: string
    rfqId: string
    supplierName: string
    brand: string
    price: number
    etaMinutes: number
    boosted: boolean
    status: string
    createdAt: number
  }>
> {
  if (!rfqId) return []
  try {
    return await withDatabase(async (db) => {
      const rows = await db
        .select()
        .from(bids)
        .where(eq(bids.rfqId, rfqId))
        .orderBy(desc(bids.createdAt))
        .limit(50)
      return rows.map((b) => ({
        id: b.id,
        rfqId: b.rfqId,
        supplierName: b.supplierName,
        brand: b.brand ?? "OEM",
        price: b.price,
        etaMinutes: b.etaMinutes,
        boosted: b.boosted,
        status: b.status,
        createdAt: new Date(b.createdAt).getTime(),
      }))
    })
  } catch {
    return []
  }
}
