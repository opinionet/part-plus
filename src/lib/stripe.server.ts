import "@tanstack/react-start/server-only"
import { env } from "cloudflare:workers"

export type CheckoutResult =
  | { needsKey: true; message: string }
  | { needsKey: false; url: string }

/**
 * Server-only Stripe helper. Returns `needsKey` (not an error) when the secret
 * isn't configured, so the UI can show a clear setup prompt instead of failing.
 */
export async function createProCheckoutSession(opts: {
  businessName: string
  successUrl: string
  cancelUrl: string
}): Promise<CheckoutResult> {
  const key = env.STRIPE_SECRET_KEY
  const priceId = env.STRIPE_PRO_PRICE_ID
  if (!key) {
    return { needsKey: true, message: "STRIPE_SECRET_KEY is not configured" }
  }
  if (!priceId) {
    return { needsKey: true, message: "STRIPE_PRO_PRICE_ID is not configured" }
  }

  const { default: Stripe } = await import("stripe")
  const stripe = new Stripe(key)

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    customer_email: undefined,
    metadata: { business: opts.businessName, plan: "PRO" },
    subscription_data: { metadata: { business: opts.businessName, plan: "PRO" } },
  })

  if (!session.url) return { needsKey: false, url: opts.cancelUrl }
  return { needsKey: false, url: session.url }
}

/** Buyer Pro subscription checkout (unlimited RFQs). */
export async function createBuyerProCheckoutSession(opts: {
  email: string
  successUrl: string
  cancelUrl: string
}): Promise<CheckoutResult> {
  const key = env.STRIPE_SECRET_KEY
  const priceId = env.BUYER_PRO_PRICE_ID
  if (!key) {
    return { needsKey: true, message: "STRIPE_SECRET_KEY is not configured" }
  }
  if (!priceId) {
    return { needsKey: true, message: "BUYER_PRO_PRICE_ID is not configured" }
  }

  const { default: Stripe } = await import("stripe")
  const stripe = new Stripe(key)

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    customer_email: opts.email,
    metadata: { buyer: opts.email, plan: "BUYER_PRO" },
    subscription_data: { metadata: { buyer: opts.email, plan: "BUYER_PRO" } },
  })

  if (!session.url) return { needsKey: false, url: opts.cancelUrl }
  return { needsKey: false, url: session.url }
}
