import { createServerFn } from "@tanstack/react-start"

import { createBuyerProCheckoutSession, createProCheckoutSession } from "./stripe.server"
import {
  createRfqInDb,
  listBidsForRfqService,
  listPayoutsService,
  listRfqsInDb,
  parseRfqSmart,
  payForDealService,
  placeBidInDb,
  submitVerificationService,
  verifyBuyerService,
} from "./backend.server"
import type { ParsedPart, RfqDetailsInput, RfqShape } from "./api.types"

/** Buyer posts an RFQ: real AI parse (with fallback) + persist to the database. */
export const createRfq = createServerFn({ method: "POST" })
  .validator(
    (d: { text: string; buyerName: string; fallback: ParsedPart; details?: RfqDetailsInput }) => {
      if (!d.text || !d.text.trim()) throw new Error("Request text is required")
      return {
        text: d.text.trim(),
        buyerName: d.buyerName || "Buyer",
        fallback: d.fallback,
        details: d.details,
      }
    },
  )
  .handler(async ({ data }) => {
    const parsed = await parseRfqSmart(data.text, data.fallback)
    const record = await createRfqInDb({
      buyerName: data.buyerName,
      rawText: data.text,
      parsed,
      details: data.details,
    })
    return { parsed, id: record.id, createdAt: record.createdAt }
  })

/** Supplier feed reads real RFQs from the database. */
export const listRfqs = createServerFn({ method: "GET" }).handler(async (): Promise<RfqShape[]> => {
  return listRfqsInDb()
})

/** Supplier submits a bid; persisted to the database when the RFQ exists. */
export const submitBid = createServerFn({ method: "POST" })
  .validator(
    (d: {
      rfqId: string
      supplierName: string
      brand: string
      price: number
      etaMinutes: number
      boosted: boolean
    }) => d,
  )
  .handler(async ({ data }) => {
    return placeBidInDb(data)
  })

/** Starts Stripe Checkout for the supplier Pro subscription. */
export const startProCheckout = createServerFn({ method: "POST" })
  .validator((d: { businessName: string; successUrl: string; cancelUrl: string }) => d)
  .handler(async ({ data }) => {
    return createProCheckoutSession({
      businessName: data.businessName,
      successUrl: data.successUrl,
      cancelUrl: data.cancelUrl,
    })
  })

/** Supplier uploads a trade license → verification moves to pending review. */
export const submitVerification = createServerFn({ method: "POST" })
  .validator((d: { businessName: string; licenseNumber: string }) => d)
  .handler(async ({ data }) => {
    return submitVerificationService(data)
  })

/** Buyer confirms a deal → records the transaction and attempts payment. */
export const payForDeal = createServerFn({ method: "POST" })
  .validator(
    (d: {
      rfqId?: string
      bidId: string
      supplierName: string
      brand: string
      price: number
    }) => d,
  )
  .handler(async ({ data }) => {
    return payForDealService(data)
  })

/** Supplier earnings snapshot. */
export const listPayouts = createServerFn({ method: "POST" })
  .validator((d: { supplierName: string }) => d)
  .handler(async ({ data }) => {
    return listPayoutsService(data.supplierName)
  })

/** Buyer verifies their business identity (name + email) to unlock posting. */
export const verifyBuyer = createServerFn({ method: "POST" })
  .validator((d: { businessName: string; businessEmail: string; phone: string }) => d)
  .handler(async ({ data }) => {
    return verifyBuyerService(data)
  })

/** Starts Stripe Checkout for the buyer Pro subscription (unlimited RFQs). */
export const startBuyerProCheckout = createServerFn({ method: "POST" })
  .validator((d: { email: string; successUrl: string; cancelUrl: string }) => d)
  .handler(async ({ data }) => {
    return createBuyerProCheckoutSession(data)
  })

/** Bids placed on one RFQ — streams the buyer's live feed from the database. */
export const listBidsForRfq = createServerFn({ method: "GET" })
  .validator((d: { rfqId: string }) => d)
  .handler(async ({ data }) => {
    return listBidsForRfqService(data.rfqId)
  })
