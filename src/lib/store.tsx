import { createContext, useContext, useState } from "react"
import type { ReactNode } from "react"

import { verifyBuyer as verifyBuyerFn } from "#/lib/backend.functions.ts"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Role = "BUYER" | "SUPPLIER"
export type Screen = "login" | "otp" | "role" | "buyer" | "supplier"
export type RfqStatus = "OPEN" | "NEGOTIATING" | "CLOSED"
export type BidStatus = "PENDING" | "ACCEPTED" | "COUNTERED"
export type BuyerPlan = "FREE" | "PRO"

export type ToastTone = "success" | "info" | "alert"
export interface Toast {
  id: number
  title: string
  message?: string
  tone: ToastTone
}

/** Free buyers can post this many RFQs before the upgrade path kicks in. */
export const FREE_RFQ_LIMIT = 3

export interface BuyerProfile {
  businessName: string
  businessEmail: string
  verified: boolean
  plan: BuyerPlan
  rfqsUsed: number
}

export interface SupplierProfile {
  id: string
  businessName: string
  brands: string[]
  categories: string[]
  verified: boolean
  verification: "unverified" | "pending" | "verified"
  location: string
  rating: number
  responseHours: number
  plan: "FREE" | "PRO" | "ENTERPRISE"
}

export interface VehicleDetails {
  make: string
  model: string
  year: number
  engine: string
}

export interface PartDetails {
  name: string
  category: string
}

export interface RfqDetails {
  vin?: string
  reference?: string
  quantity?: number
  condition?: string
  location?: string
  preferredBrand?: string
}

export interface RFQ {
  id: string
  buyerId: string
  buyerName: string
  rawInputText: string
  vehicle: VehicleDetails
  part: PartDetails
  budget: { min: number; max: number }
  details?: RfqDetails
  status: RfqStatus
  createdAt: number
}

export interface Bid {
  id: string
  rfqId: string
  supplierId: string
  supplierName: string
  brand: string
  price: number
  etaMinutes: number
  status: BidStatus
  createdAt: number
}

export type ChatMessage =
  | { id: string; kind: "user"; text: string; media?: "photo" | "voice" }
  | { id: string; kind: "ai"; text: string }
  | { id: string; kind: "bid"; bidId: string }
  | { id: string; kind: "system"; text: string }

/* ------------------------------------------------------------------ */
/* Seed data                                                           */
/* ------------------------------------------------------------------ */

export const SEED_SUPPLIERS: SupplierProfile[] = [
  {
    id: "s1",
    businessName: "Al Noor Auto Trading",
    brands: ["Bosch", "NGK", "Febi"],
    categories: ["Braking", "Electrical", "Ignition"],
    verified: true,
    verification: "verified",
    location: "Dubai, UAE",
    rating: 4.8,
    responseHours: 0.4,
    plan: "PRO",
  },
  {
    id: "s2",
    businessName: "Gulf Auto Parts Co.",
    brands: ["Denso", "Aisin", "Hitachi"],
    categories: ["Braking", "Electrical", "Engine", "Cooling"],
    verified: true,
    verification: "verified",
    location: "Abu Dhabi, UAE",
    rating: 4.6,
    responseHours: 0.9,
    plan: "FREE",
  },
  {
    id: "s3",
    businessName: "Premium OEM ME",
    brands: ["Bosch", "Continental", "Brembo"],
    categories: ["Braking", "Suspension", "Ignition"],
    verified: true,
    verification: "verified",
    location: "Sharjah, UAE",
    rating: 4.9,
    responseHours: 0.2,
    plan: "PRO",
  },
  {
    id: "s4",
    businessName: "Summit Auto Supply",
    brands: ["ACDelco", "Valeo", "Mann"],
    categories: ["Electrical", "Engine", "Cooling"],
    verified: false,
    verification: "unverified",
    location: "Riyadh, KSA",
    rating: 4.5,
    responseHours: 1.6,
    plan: "FREE",
  },
]

export const SEED_RFQS: RFQ[] = [
  {
    id: "r1",
    buyerId: "b1",
    buyerName: "FastFix Garage",
    rawInputText: "Front brake pads for a 2019 Toyota Land Cruiser, need OEM quality",
    vehicle: { make: "Toyota", model: "Land Cruiser", year: 2019, engine: "4.0L V6" },
    part: { name: "Brake Pads", category: "Braking" },
    budget: { min: 240, max: 320 },
    details: {
      vin: "JTEBU5JR0L5139124",
      reference: "04466-60210",
      quantity: 1,
      condition: "New · OEM",
      location: "Dubai",
      preferredBrand: "Bosch",
    },
    status: "OPEN",
    createdAt: Date.now() - 1000 * 60 * 4,
  },
  {
    id: "r2",
    buyerId: "b2",
    buyerName: "Desert Motorsport",
    rawInputText: "Alternator for Nissan Patrol 2021 diesel",
    vehicle: { make: "Nissan", model: "Patrol", year: 2021, engine: "4.8L V8" },
    part: { name: "Alternator", category: "Electrical" },
    budget: { min: 520, max: 680 },
    details: {
      reference: "23100-1KB0B",
      quantity: 1,
      condition: "New · Aftermarket",
      location: "Abu Dhabi",
    },
    status: "OPEN",
    createdAt: Date.now() - 1000 * 60 * 11,
  },
  {
    id: "r3",
    buyerId: "b3",
    buyerName: "G3 Performance",
    rawInputText: "Spark plugs for Mercedes G63 AMG 2019",
    vehicle: { make: "Mercedes", model: "G63 AMG", year: 2019, engine: "4.0L V8" },
    part: { name: "Spark Plugs", category: "Ignition" },
    budget: { min: 180, max: 260 },
    status: "NEGOTIATING",
    createdAt: Date.now() - 1000 * 60 * 32,
  },
  {
    id: "r4",
    buyerId: "b4",
    buyerName: "Al Safa Workshop",
    rawInputText: "Shock absorbers rear for Hyundai Tucson 2018",
    vehicle: { make: "Hyundai", model: "Tucson", year: 2018, engine: "2.0L" },
    part: { name: "Shock Absorbers", category: "Suspension" },
    budget: { min: 300, max: 420 },
    status: "CLOSED",
    createdAt: Date.now() - 1000 * 60 * 90,
  },
]

export const BUDGET_BY_CATEGORY: Record<string, { min: number; max: number }> = {
  Braking: { min: 180, max: 340 },
  Electrical: { min: 420, max: 680 },
  Ignition: { min: 140, max: 260 },
  Engine: { min: 380, max: 620 },
  Suspension: { min: 300, max: 480 },
  Cooling: { min: 260, max: 460 },
  Transmission: { min: 420, max: 900 },
  Default: { min: 200, max: 360 },
}

/* ------------------------------------------------------------------ */
/* Deterministic "AI" parse (sample data — real LLM in backend round)  */
/* ------------------------------------------------------------------ */

const MAKES = [
  "Toyota",
  "Nissan",
  "Mercedes",
  "BMW",
  "Ford",
  "Hyundai",
  "Kia",
  "Chevrolet",
  "Honda",
  "Land Rover",
  "Audi",
]

const MODELS: Record<string, string[]> = {
  Toyota: ["Land Cruiser", "Camry", "Corolla", "Hilux", "Prado", "Yaris"],
  Nissan: ["Patrol", "Altima", "Sunny", "X-Trail", "Navara"],
  Mercedes: ["G63 AMG", "C300", "E200", "GLE", "A250"],
  BMW: ["X5", "320i", "520", "X3"],
  Ford: ["Explorer", "F150", "Ranger", "Taurus"],
  Hyundai: ["Tucson", "Sonata", "Santa Fe", "Elantra"],
  Kia: ["Sportage", "Sorento", "Carnival"],
  Chevrolet: ["Tahoe", "Silverado", "Cruze"],
  Honda: ["Accord", "Civic", "CR-V"],
  "Land Rover": ["Range Rover", "Defender", "Discovery"],
  Audi: ["A4", "Q5", "A6"],
}

const PART_HINTS: Array<{ words: string[]; name: string; category: string }> = [
  { words: ["brake", "pad"], name: "Brake Pads", category: "Braking" },
  { words: ["alternator"], name: "Alternator", category: "Electrical" },
  { words: ["battery"], name: "Battery", category: "Electrical" },
  { words: ["spark", "plug"], name: "Spark Plugs", category: "Ignition" },
  { words: ["filter"], name: "Air Filter", category: "Engine" },
  { words: ["belt"], name: "Timing Belt", category: "Engine" },
  { words: ["shock", "absorber", "suspension", "strut"], name: "Shock Absorbers", category: "Suspension" },
  { words: ["radiator"], name: "Radiator", category: "Cooling" },
  { words: ["clutch"], name: "Clutch Kit", category: "Transmission" },
  { words: ["sensor"], name: "O2 Sensor", category: "Electrical" },
  { words: ["pump"], name: "Fuel Pump", category: "Engine" },
]

export function parseRFQ(input: string): Pick<RFQ, "vehicle" | "part" | "budget"> {
  const text = input.trim()
  const lower = text.toLowerCase()
  const make = MAKES.find((m) => lower.includes(m.toLowerCase())) ?? "Toyota"
  const models = MODELS[make] ?? []
  const model = models.find((mo) => lower.includes(mo.toLowerCase())) ?? models[0] ?? "Camry"
  const yearMatch = text.match(/\b(19|20)\d{2}\b/)
  const year = yearMatch ? Number(yearMatch[0]) : 2019

  let part = PART_HINTS[0]
  for (const hint of PART_HINTS) {
    if (hint.words.some((w) => lower.includes(w))) {
      part = hint
      break
    }
  }

  const budget = BUDGET_BY_CATEGORY[part.category] ?? BUDGET_BY_CATEGORY.Default

  return {
    vehicle: { make, model, year, engine: `${(Math.abs(year % 5) + 2).toFixed(1)}L` },
    part: { name: part.name, category: part.category },
    budget,
  }
}

export function matchedSuppliers(category: string): SupplierProfile[] {
  return SEED_SUPPLIERS.filter(
    (s) => s.categories.includes(category) || s.categories.includes("Electrical"),
  )
}

export function formatAED(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 })
}

/* ------------------------------------------------------------------ */
/* App state                                                           */
/* ------------------------------------------------------------------ */

interface AppCtx {
  screen: Screen
  phone: string
  role: Role | null
  pricingOpen: boolean
  buyer: BuyerProfile
  buyerRfqsLeft: number
  toasts: Toast[]
  notify: (title: string, message?: string, tone?: ToastTone) => void
  dismissToast: (id: number) => void
  verifyBuyer: (businessName: string, businessEmail: string) => Promise<void>
  consumeRfqCredit: () => void
  upgradeBuyerToPro: () => void
  toOtp: (phone: string) => void
  toRole: () => void
  setRole: (r: Role) => void
  goHome: () => void
  openPricing: () => void
  closePricing: () => void
}

const Ctx = createContext<AppCtx | null>(null)

let toastSeq = 0

const BUYER_KEY = "partpulse.buyer"
const emptyBuyer: BuyerProfile = {
  businessName: "",
  businessEmail: "",
  verified: false,
  plan: "FREE",
  rfqsUsed: 0,
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>("login")
  const [phone, setPhone] = useState("")
  const [role, setRoleState] = useState<Role | null>(null)
  const [pricingOpen, setPricingOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [buyer, setBuyer] = useState<BuyerProfile>(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(BUYER_KEY) : null
      return raw ? { ...emptyBuyer, ...JSON.parse(raw) } : emptyBuyer
    } catch {
      return emptyBuyer
    }
  })

  const updateBuyer = (next: BuyerProfile) => {
    setBuyer(next)
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(BUYER_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const dismissToast = (id: number) => setToasts((t) => t.filter((x) => x.id !== id))

  const notify = (title: string, message?: string, tone: ToastTone = "info") => {
    const id = ++toastSeq
    setToasts((t) => [...t.slice(-2), { id, title, message, tone }])
    if (typeof window !== "undefined") {
      window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
    }
  }

  const value: AppCtx = {
    screen,
    phone,
    role,
    pricingOpen,
    toasts,
    notify,
    dismissToast,
    buyer,
    buyerRfqsLeft: Math.max(0, FREE_RFQ_LIMIT - buyer.rfqsUsed),
    verifyBuyer: async (businessName, businessEmail) => {
      await verifyBuyerFn({ data: { businessName, businessEmail, phone } })
      updateBuyer({ ...buyer, businessName, businessEmail, verified: true })
    },
    consumeRfqCredit: () => updateBuyer({ ...buyer, rfqsUsed: buyer.rfqsUsed + 1 }),
    upgradeBuyerToPro: () => updateBuyer({ ...buyer, plan: "PRO" }),
    toOtp: (p) => {
      setPhone(p)
      setScreen("otp")
    },
    toRole: () => setScreen("role"),
    setRole: (r) => {
      setRoleState(r)
      setScreen(r === "BUYER" ? "buyer" : "supplier")
    },
    goHome: () => setScreen("login"),
    openPricing: () => setPricingOpen(true),
    closePricing: () => setPricingOpen(false),
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
