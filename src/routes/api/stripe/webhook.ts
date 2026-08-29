import { createFileRoute } from "@tanstack/react-router"
import "@tanstack/react-start"
import { eq } from "drizzle-orm"
import { env } from "cloudflare:workers"

import { withDatabase } from "#/db/index.ts"
import { suppliers } from "#/db/schema/index.ts"

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("stripe-signature")
        const secret = env.STRIPE_WEBHOOK_SECRET
        if (!signature || !secret) {
          return Response.json(
            { error: "Stripe webhook is not configured" },
            { status: 400 },
          )
        }

        const rawBody = await request.text()

        const { default: Stripe } = await import("stripe")
        const key = env.STRIPE_SECRET_KEY
        if (!key) {
          return Response.json({ error: "Stripe key not configured" }, { status: 400 })
        }
        const stripe = new Stripe(key)

        let event: Awaited<ReturnType<typeof stripe.webhooks.constructEventAsync>>
        try {
          event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret)
        } catch {
          return Response.json({ error: "Signature verification failed" }, { status: 400 })
        }

        // Activate the Pro plan for the supplier attached via subscription metadata.
        if (event.type === "checkout.session.completed") {
          const session = event.data.object
          const business = (session.metadata?.business ?? "").trim()
          if (business) {
            await withDatabase(async (db) => {
              await db
                .update(suppliers)
                .set({
                  plan: "PRO",
                  subscriptionStatus: "active",
                  stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
                  stripeSubscriptionId:
                    typeof session.subscription === "string" ? session.subscription : undefined,
                })
                .where(eq(suppliers.businessName, business))
            })
          }
        }

        return Response.json({ received: true })
      },
    },
  },
})
