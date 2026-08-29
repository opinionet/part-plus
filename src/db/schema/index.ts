import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

/**
 * PartPulse relational schema. All identifiers are UUIDs generated server-side.
 * Money is stored as integer minor units where it represents a real currency
 * (not used here — RFQ budgets/bids are display-only AED integers for now).
 */

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  phone: varchar("phone", { length: 40 }).notNull(),
  countryCode: varchar("country_code", { length: 8 }).notNull().default("+971"),
  role: varchar("role", { length: 16 }).notNull().default("BUYER"),
  name: varchar("name", { length: 120 }),
  businessName: varchar("business_name", { length: 160 }),
  businessEmail: varchar("business_email", { length: 160 }),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  businessName: varchar("business_name", { length: 160 }).notNull(),
  brands: text("brands")
    .array()
    .notNull()
    .default([]),
  categories: text("categories")
    .array()
    .notNull()
    .default([]),
  verified: boolean("verified").notNull().default(false),
  verificationStatus: varchar("verification_status", { length: 20 }).notNull().default("pending"),
  tradeLicense: varchar("trade_license", { length: 160 }),
  location: varchar("location", { length: 120 }),
  rating: real("rating").notNull().default(0),
  responseHours: real("response_hours").notNull().default(0),
  // Monetization / subscription state
  plan: varchar("plan", { length: 20 }).notNull().default("FREE"),
  stripeCustomerId: varchar("stripe_customer_id", { length: 120 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 120 }),
  subscriptionStatus: varchar("subscription_status", { length: 40 }).notNull().default("inactive"),
  boostCredits: integer("boost_credits").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const rfqs = pgTable("rfqs", {
  id: uuid("id").defaultRandom().primaryKey(),
  buyerId: uuid("buyer_id").references(() => users.id),
  buyerName: varchar("buyer_name", { length: 120 }),
  rawInputText: text("raw_input_text").notNull(),
  vehicle: jsonb("vehicle").$type<{
    make: string
    model: string
    year: number
    engine: string
  }>().notNull(),
  part: jsonb("part").$type<{ name: string; category: string }>().notNull(),
  budgetMin: integer("budget_min").notNull(),
  budgetMax: integer("budget_max").notNull(),
  vin: varchar("vin", { length: 40 }),
  reference: varchar("reference", { length: 80 }),
  quantity: integer("quantity").notNull().default(1),
  condition: varchar("condition", { length: 30 }),
  location: varchar("location", { length: 120 }),
  preferredBrand: varchar("preferred_brand", { length: 80 }),
  aiConfidence: real("ai_confidence").notNull().default(0.9),
  status: varchar("status", { length: 20 }).notNull().default("OPEN"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const bids = pgTable("bids", {
  id: uuid("id").defaultRandom().primaryKey(),
  rfqId: uuid("rfq_id")
    .references(() => rfqs.id)
    .notNull(),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  supplierName: varchar("supplier_name", { length: 160 }).notNull(),
  brand: varchar("brand", { length: 80 }),
  price: integer("price").notNull(),
  etaMinutes: integer("eta_minutes").notNull().default(30),
  boosted: boolean("boosted").notNull().default(false),
  status: varchar("status", { length: 20 }).notNull().default("PENDING"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

/**
 * Monetary settlements. `price` is the full amount the buyer pays; `fee` is the
 * marketplace commission (default 7%); `payout` is what the supplier receives.
 * Amounts are integer AED.
 */
export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  rfqId: uuid("rfq_id").references(() => rfqs.id),
  bidId: varchar("bid_id", { length: 120 }),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  supplierName: varchar("supplier_name", { length: 160 }).notNull(),
  brand: varchar("brand", { length: 80 }),
  price: integer("price").notNull(),
  fee: integer("fee").notNull(),
  payout: integer("payout").notNull(),
  status: varchar("status", { length: 40 }).notNull().default("PENDING_PAYMENT"),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 120 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})
