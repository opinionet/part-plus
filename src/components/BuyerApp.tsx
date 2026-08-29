import { useEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  BellRing,
  Box,
  Camera,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Crown,
  Loader2,
  Lock,
  MapPin,
  Mic,
  Plus,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Star,
  Trash2,
  Truck,
  Wrench,
  X,
  Zap,
} from "lucide-react"

import { feeOn, MARKET_FEE } from "#/components/PricingModal.tsx"
import { createRfq, listBidsForRfq, payForDeal, startBuyerProCheckout } from "#/lib/backend.functions.ts"
import {
  formatAED,
  FREE_RFQ_LIMIT,
  matchedSuppliers,
  parseRFQ,
  useApp,
} from "#/lib/store.tsx"
import type { Bid, ChatMessage, RFQ } from "#/lib/store.tsx"
import type { ParsedPart, RfqDetailsInput } from "#/lib/api.types"

const PRESETS = [
  "Brake pads for a 2019 Toyota Camry",
  "Alternator for a Nissan Patrol 2021",
  "Spark plugs for a Mercedes G63 AMG",
]

let idCounter = 0
const uid = (p: string) => `${p}_${Date.now()}_${idCounter++}`

type Phase = "idle" | "parsing" | "collecting" | "negotiating" | "closed"

type HistoryEntry = {
  rfq: RFQ
  bids: Bid[]
  accepted?: Bid
  createdAt: number
}

type GuideStep =
  | "verifyName"
  | "verifyEmail"
  | "vin"
  | "quantity"
  | "condition"
  | "location"
  | "brand"
  | "limit"
  | null

type GarageVehicle = {
  id: string
  make: string
  model: string
  year: number
  plate: string
  note?: string
}

type PriceAlert = {
  id: string
  part: string
  ref: string
  category: string
  target: number
  current: number
  brand?: string
}

const SEED_VEHICLES: GarageVehicle[] = [
  { id: "v1", make: "Toyota", model: "Camry", year: 2019, plate: "D 78234", note: "Brake pads due" },
  { id: "v2", make: "Nissan", model: "Patrol", year: 2021, plate: "AB 1203", note: "Needs alternator" },
]

type Diagnosis = {
  symptom: string
  parts: { part: string; confidence: number; hint: string; fix: string }[]
}

const DIAGNOSES: Diagnosis[] = [
  {
    symptom: "Squealing when braking",
    parts: [
      { part: "Brake Pads", confidence: 0.92, hint: "Worn friction material — typical wear indicator sound", fix: "Replace the pads and bed them in gently — most brake squeals stop with a fresh set." },
      { part: "Brake Discs / Rotors", confidence: 0.78, hint: "Scored or warped rotors can squeal", fix: "Have the rotors measured; if scored or warped, resurface or replace them together with the pads." },
    ],
  },
  {
    symptom: "Battery dying or slow crank",
    parts: [
      { part: "Battery", confidence: 0.85, hint: "Weak cell at low voltage", fix: "Get the battery load-tested. If it holds under load, the problem is likely elsewhere." },
      { part: "Alternator", confidence: 0.74, hint: "Not charging while running", fix: "Measure charging voltage at the battery — roughly 14V while running means the alternator is fine." },
    ],
  },
  {
    symptom: "Check engine light on",
    parts: [
      { part: "O2 / Lambda Sensor", confidence: 0.68, hint: "Common P013x fault", fix: "Read the fault code first — a P013x code confirms the sensor before you buy anything." },
      { part: "Spark Plugs", confidence: 0.55, hint: "Misfire can trip the light", fix: "Pull the plugs and check for wear; if worn, replace them as a full set." },
    ],
  },
  {
    symptom: "Overheating",
    parts: [
      { part: "Coolant / Radiator", confidence: 0.82, hint: "Blocked or leaking cooling system", fix: "Check for leaks and flush the cooling system if it's blocked or sludgy." },
      { part: "Thermostat", confidence: 0.7, hint: "Stuck closed restricts flow", fix: "Test the thermostat in hot water — if it stays closed, replace it." },
    ],
  },
]

const SYMPTOM_MAP: { kws: string[]; parts: { part: string; confidence: number; hint: string; fix: string }[] }[] = [
  {
    kws: ["squeal", "brak", "pad", "grind", "rotor", "disc", "noise when i stop", "stopping"],
    parts: [
      { part: "Brake Pads", confidence: 0.92, hint: "Worn friction material triggers a squeal as a wear indicator", fix: "Replace the pads and bed them in gently — most brake squeals stop with a fresh set." },
      { part: "Brake Discs / Rotors", confidence: 0.78, hint: "Scored or warped rotors can squeal or pulse on braking", fix: "Have the rotors measured; if scored or warped, resurface or replace them together with the pads." },
    ],
  },
  {
    kws: ["battery", "crank", "won't start", "wont start", "no start", "jump", "drain", "alternator", "charge", "dead"],
    parts: [
      { part: "Battery", confidence: 0.86, hint: "Weak cell shows as slow crank or repeated jump-starts", fix: "Get the battery load-tested. If it holds under load, the problem is likely elsewhere." },
      { part: "Alternator", confidence: 0.74, hint: "If it dies while running, charging may be failing", fix: "Measure charging voltage at the battery — roughly 14V while running means the alternator is fine." },
      { part: "Starter Motor", confidence: 0.6, hint: "Single click with no crank points to the starter", fix: "Tap the starter while someone turns the key — if the engine fires, the starter or its solenoid is suspect." },
    ],
  },
  {
    kws: ["check engine", "engine light", "misfire", "idle", "stall", "stalling", "emission"],
    parts: [
      { part: "O2 / Lambda Sensor", confidence: 0.68, hint: "Common fault code P013x — check before buying", fix: "Read the fault code first — a P013x code confirms the sensor before you buy anything." },
      { part: "Spark Plugs", confidence: 0.56, hint: "Worn plugs cause misfires that trip the light", fix: "Pull the plugs and check for wear; if worn, replace them as a full set." },
      { part: "Ignition Coil", confidence: 0.5, hint: "Single-cylinder misfire often traces to a coil", fix: "Swap the coil with the next cylinder — if the misfire moves, that coil is the culprit." },
    ],
  },
  {
    kws: ["overheat", "hot", "temperature", "temp", "coolant", "radiator", "boil", "steam", "thermostat"],
    parts: [
      { part: "Coolant / Radiator", confidence: 0.82, hint: "Blocked or leaking cooling system raises temperature", fix: "Check for leaks and flush the cooling system if it's blocked or sludgy." },
      { part: "Thermostat", confidence: 0.7, hint: "Stuck closed restricts coolant flow", fix: "Test the thermostat in hot water — if it stays closed, replace it." },
      { part: "Cooling Fan", confidence: 0.55, hint: "Fan not engaging overheats the car at idle", fix: "Check the fan kicks in as the engine warms; a stuck relay is a common cause." },
    ],
  },
  {
    kws: ["shake", "wobble", "vibrat", "suspension", "bump", "knock", "noise over", "strut", "spring", "control arm"],
    parts: [
      { part: "Shock Absorbers / Struts", confidence: 0.8, hint: "Worn dampers cause bouncing and knocks", fix: "Push down each corner — if the car bounces more than twice, the damper is worn." },
      { part: "Control Arm / Bushing", confidence: 0.6, hint: "Clunks over bumps often come from worn bushings", fix: "Inspect the bushings for cracks; a torn bushing usually explains the clunk." },
      { part: "Wheel Bearing", confidence: 0.55, hint: "Hum or rumble that changes with speed", fix: "Jack up the wheel and rock it at 12 and 6 o'clock — play means a worn bearing." },
    ],
  },
  {
    kws: ["smoke", "oil", "leak", "burning smell", "exhaust", "dipstick"],
    parts: [
      { part: "Oil Filter", confidence: 0.6, hint: "Old or clogged filters drop oil pressure", fix: "Service with a fresh filter and oil — oil pressure usually recovers." },
      { part: "Valve Cover Gasket", confidence: 0.55, hint: "Oil on the outside is a common leak source", fix: "Clean the area and watch for fresh oil; replace the gasket if it keeps weeping." },
      { part: "Engine Oil", confidence: 0.5, hint: "Low or overdue oil explains smoke and smell", fix: "Top up or change the oil if it's overdue — light smoke often stops." },
    ],
  },
  {
    kws: ["air conditioning", "ac ", "a/c", "not cold", "no cold", "blower", "warm air", "aircon"],
    parts: [
      { part: "AC Compressor", confidence: 0.7, hint: "No cold air with engine running often means the compressor", fix: "Check the compressor clutch engages and the system holds a charge before replacing." },
      { part: "Blower Motor", confidence: 0.6, hint: "No airflow at all points to the blower", fix: "If no speed works, test the blower motor and its resistor." },
      { part: "AC Condenser", confidence: 0.5, hint: "Poor cooling after a leak could be a blocked condenser", fix: "Check for a blocked or leaking condenser after recharging the system." },
    ],
  },
  {
    kws: ["belt", "squeak", "whine", "fan belt", "serpentine", "power steering"],
    parts: [
      { part: "Drive / Serpentine Belt", confidence: 0.75, hint: "Squeak on startup or when turning is often the belt", fix: "Inspect for cracks or glazing; replace it if worn and the squeak usually goes away." },
      { part: "Belt Tensioner", confidence: 0.6, hint: "A worn tensioner lets the belt slip and squeal", fix: "Check the tensioner moves smoothly; replace it if it wobbles or seizes." },
    ],
  },
  {
    kws: ["gear", "transmission", "shift", "clutch", "slip", "hard to engage", "grinding when shifting"],
    parts: [
      { part: "Transmission Fluid", confidence: 0.66, hint: "Low or old fluid makes shifts hard or slow", fix: "Check the fluid level and condition; a service often smooths the shifts." },
      { part: "Clutch Kit", confidence: 0.6, hint: "Slip under load is a classic worn-clutch sign", fix: "Test the bite point and free-play; slipping under load means a clutch kit." },
      { part: "Transmission Mount", confidence: 0.5, hint: "Hard jolts on shift can be a broken mount", fix: "Inspect the mounts for tears — a broken mount causes the jolt on shift." },
    ],
  },
]

function diagnoseText(raw: string): Diagnosis {
  const t = raw.toLowerCase()
  const scored = new Map<string, { part: string; confidence: number; hint: string; fix: string }>()
  SYMPTOM_MAP.forEach((group) => {
    const hits = group.kws.filter((k) => k.length > 2 && t.includes(k)).length
    if (hits === 0) return
    group.parts.forEach((p) => {
      const boost = Math.min(0.03 * hits, 0.08)
      const conf = Math.min(0.97, p.confidence + boost)
      const cur = scored.get(p.part)
      if (!cur || cur.confidence < conf) scored.set(p.part, { part: p.part, confidence: conf, hint: p.hint, fix: p.fix })
    })
  })
  const parts = Array.from(scored.values()).sort((a, b) => b.confidence - a.confidence).slice(0, 3)
  return { symptom: raw.trim() || "Your symptom", parts }
}

const PRO_FEATURES: { icon: "garage" | "diag" | "save" | "unlimited" | "priority" | "alerts"; title: string; desc: string }[] = [
  { icon: "garage", title: "My Garage", desc: "Save all your vehicles & tap to re-order parts instantly" },
  { icon: "diag", title: "AI Diagnostics", desc: "Describe a symptom — get likely causes & parts with confidence" },
  { icon: "save", title: "Save chats forever", desc: "Your requests & conversations never expire" },
  { icon: "unlimited", title: "Unlimited RFQs", desc: "Post as many requests as you need" },
  { icon: "priority", title: "Priority suppliers", desc: "Verified suppliers answer you first" },
  { icon: "alerts", title: "Smart price alerts", desc: "Get pinged when a part drops to your target price" },
]

const PARSE_STEPS = ["Understanding your request", "Identifying vehicle & part", "Checking live supplier pricing"]

const SKIP = /^(skip|skip it|no|none|n\/a|na|nah|dont|don't|not sure|i don't have|not sure)$/i

function extractVinOrRef(text: string): { vin?: string; reference?: string } {
  const upper = text.toUpperCase()
  const tokens = upper.split(/[^A-Z0-9]/).filter(Boolean)
  for (const t of tokens) {
    if (/^[A-Z0-9]{17}$/.test(t)) return { vin: t }
  }
  const ref = upper.match(/\b[A-Z0-9][A-Z0-9-]{4,15}\b/)
  if (ref && !SKIP.test(text)) return { reference: ref[0].replace(/-/g, "").trim() || undefined }
  return {}
}

function extractCondition(text: string): string | undefined {
  const t = text.toLowerCase()
  if (/used|second.?hand|refurb/.test(t)) return "Used / Refurbished"
  if (/after.?market/.test(t)) return "New · Aftermarket"
  if (/genuine/.test(t)) return "Genuine"
  if (/new|oem/.test(t)) return "New · OEM"
  return undefined
}

function suggestionsFor(step: GuideStep): string[] {
  switch (step) {
    case "vin":
      return ["I don't have it", "04465-33160"]
    case "quantity":
      return ["1", "2", "4", "10"]
    case "condition":
      return ["New OEM", "Aftermarket", "Genuine", "Used"]
    case "location":
      return ["Dubai", "Abu Dhabi", "Sharjah"]
    case "brand":
      return ["Skip", "Bosch", "Denso", "NGK"]
    default:
      return []
  }
}

export function BuyerApp({ onExit }: { onExit: () => void }) {
  const { openPricing, buyer, buyerRfqsLeft, verifyBuyer, consumeRfqCredit, upgradeBuyerToPro, notify } = useApp()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [rfq, setRfq] = useState<RFQ | null>(null)
  const [bids, setBids] = useState<Bid[]>([])
  const [phase, setPhase] = useState<Phase>("idle")
  const [stepIdx, setStepIdx] = useState(0)
  const [draft, setDraft] = useState("")
  const [recording, setRecording] = useState(false)
  const [acceptBid, setAcceptBid] = useState<Bid | null>(null)
  const [guide, setGuide] = useState<GuideStep>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [screen, setScreen] = useState<"chat" | "orders">("chat")
  const [openOrder, setOpenOrder] = useState<HistoryEntry | null>(null)
  const [garageOpen, setGarageOpen] = useState(false)
  const [vehicles, setVehicles] = useState<GarageVehicle[]>(SEED_VEHICLES)
  const [diagOpen, setDiagOpen] = useState(false)
  const [proHubOpen, setProHubOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [alerts, setAlerts] = useState<PriceAlert[]>([])

  const timers = useRef<number[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const startRef = useRef<number>(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const rfqRef = useRef<RFQ | null>(null)
  const guideRef = useRef<GuideStep>(null)
  const pendingRef = useRef<{ text: string; fallback: ParsedPart } | null>(null)
  const collectedRef = useRef<RfqDetailsInput>({})
  const tempNameRef = useRef("")
  const rfqDbIdRef = useRef<string | null>(null)
  const streamedRef = useRef<string | null>(null)

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }
  const later = (ms: number, fn: () => void) => {
    const t = window.setTimeout(fn, ms)
    timers.current.push(t)
  }

  const pushMessage = (m: ChatMessage) => setMessages((prev) => [...prev, m])
  const setGuideBoth = (g: GuideStep) => {
    guideRef.current = g
    setGuide(g)
  }

  useEffect(() => () => clearTimers(), [])

  useEffect(() => {
    rfqRef.current = rfq
  }, [rfq])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, phase, guide])

  // Parsing step animation
  useEffect(() => {
    if (phase !== "parsing") return
    setStepIdx(0)
    ;[1, 2, 3].forEach((s, i) => later(380 + i * 520, () => setStepIdx(s)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Stream live bids once a posted RFQ reaches the negotiating phase
  useEffect(() => {
    if (phase !== "negotiating" || !rfq || streamedRef.current === rfq.id) return
    streamedRef.current = rfq.id
    const pool = matchedSuppliers(rfq.part.category).filter((s) => s.verified)
    pool.slice(0, 3).forEach((s, i) => {
      later(900 + i * 1900, () => addBid(s.id, s.businessName, s.brands[0] ?? "OEM"))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, rfq])

  // Poll the database for real supplier bids on this RFQ
  useEffect(() => {
    if (phase !== "negotiating" || !rfqDbIdRef.current) return
    const interval = window.setInterval(() => {
      listBidsForRfq({ data: { rfqId: rfqDbIdRef.current! } })
        .then((rows) => {
          rows.forEach((b) => {
            setBids((prev) => {
              if (prev.some((x) => x.id === b.id)) return prev
              return [
                ...prev,
                {
                  id: b.id,
                  rfqId: b.rfqId,
                  supplierId: `db-${b.id}`,
                  supplierName: b.supplierName,
                  brand: b.brand,
                  price: b.price,
                  etaMinutes: b.etaMinutes,
                  status: "PENDING",
                  createdAt: b.createdAt,
                },
              ]
            })
          })
        })
        .catch(() => {})
    }, 4000)
    return () => window.clearInterval(interval)
  }, [phase])

  function addBid(supplierId: string, supplierName: string, brand: string, overPrice?: number) {
    const r = rfqRef.current
    if (!r) return
    const factor = 1 + (Math.abs(supplierId.charCodeAt(1) - 97) % 4) * 0.045
    const price = Math.round((overPrice ?? r.budget.max * factor) / 5) * 5
    const eta = 25 + supplierId.length * 18
    const bid: Bid = {
      id: uid("bid"),
      rfqId: r.id,
      supplierId,
      supplierName,
      brand,
      price,
      etaMinutes: eta,
      status: "PENDING",
      createdAt: Date.now(),
    }
    setBids((prev) => [...prev, bid])
    pushMessage({ id: uid("m"), kind: "bid", bidId: bid.id })
    setHistory((prev) => prev.map((h) => (h.rfq.id === r.id ? { ...h, bids: [...h.bids, bid] } : h)))
  }

  // ----- Agent conversation -----

  function beginAgent() {
    const p = pendingRef.current
    if (!p) return
    setPhase("collecting")
    const { vehicle, part, budget } = p.fallback
    pushMessage({
      id: uid("m"),
      kind: "ai",
      text: `Great — I read it as **${part.name}** for a **${vehicle.make} ${vehicle.model} ${vehicle.year}** (${part.category}), with a budget around **AED ${formatAED(budget.max)}**.`,
    })

    if (!buyer.verified) {
      later(600, () => {
        pushMessage({
          id: uid("m"),
          kind: "ai",
          text: `Before I send this to suppliers, I need to verify your business so we keep fake requests out. What's your **business name**?`,
        })
        setGuideBoth("verifyName")
      })
      return
    }
    later(700, () => nextDetail("vin"))
  }

  function nextDetail(next: GuideStep) {
    setGuideBoth(next)
    const text =
      next === "vin"
        ? `To get the exact right part, can you share the **VIN or the OE/reference part number**? It helps suppliers match precisely. (No problem if you don't have it — just say "skip".)`
        : next === "quantity"
          ? `Perfect. And **how many** do you need?`
          : next === "condition"
            ? `What **condition** — New OEM, Aftermarket, Genuine, or Used?`
            : next === "location"
              ? `Which **city** should the part be delivered to?`
              : `Any **preferred brand**? (Optional — type "skip" if not.)`
    pushMessage({ id: uid("m"), kind: "ai", text })
  }

  function handleGuideReply(text: string) {
    const step = guideRef.current
    pushMessage({ id: uid("m"), kind: "user", text })

    if (step === "verifyName") {
      tempNameRef.current = text.trim()
      setGuideBoth("verifyEmail")
      later(500, () =>
        pushMessage({
          id: uid("m"),
          kind: "ai",
          text: `Thanks, ${text.trim()}. And the **business email** you use for purchases?`,
        }),
      )
      return
    }

    if (step === "verifyEmail") {
      setGuideBoth(null)
      const email = text.trim()
      verifyBuyer(tempNameRef.current || buyer.businessName || "Your business", email).finally(() => {
        pushMessage({
          id: uid("m"),
          kind: "ai",
          text: `You're verified as **${tempNameRef.current || "your business"}** ✓ — your request will carry your badge and suppliers can see you're a real buyer.`,
        })
        if (buyer.plan === "FREE" && buyerRfqsLeft <= 0) {
          later(700, () => {
            pushMessage({
              id: uid("m"),
              kind: "ai",
              text: `You've used all **${FREE_RFQ_LIMIT} free requests**. Upgrade to Pro for unlimited RFQs and priority responses.`,
            })
            setGuideBoth("limit")
          })
          return
        }
        later(700, () => nextDetail("vin"))
      })
      return
    }

    if (step === "vin") {
      const { vin, reference } = extractVinOrRef(text)
      if (vin) collectedRef.current.vin = vin
      if (reference) collectedRef.current.reference = reference
      later(400, () => nextDetail("quantity"))
      return
    }
    if (step === "quantity") {
      const q = parseInt((text.match(/\d+/) || ["1"])[0], 10)
      collectedRef.current.quantity = Math.max(1, q)
      later(400, () => nextDetail("condition"))
      return
    }
    if (step === "condition") {
      const c = extractCondition(text)
      if (c) collectedRef.current.condition = c
      later(400, () => nextDetail("location"))
      return
    }
    if (step === "location") {
      if (!SKIP.test(text)) collectedRef.current.location = text.trim()
      later(400, () => nextDetail("brand"))
      return
    }
    if (step === "brand") {
      if (!SKIP.test(text)) collectedRef.current.preferredBrand = text.trim()
      later(500, () => postRequest())
    }
  }

  async function postRequest() {
    const p = pendingRef.current
    if (!p) return
    setGuideBoth(null)
    pushMessage({
      id: uid("m"),
      kind: "ai",
      text: `Perfect — posting **${p.fallback.part.name}** to matching suppliers now. Bids should start streaming in any moment.`,
    })

    const fallback = p.fallback
    let parsed = fallback
    let dbId: string | null = null
    try {
      const res = await createRfq({
        data: { text: p.text, buyerName: buyer.businessName || "You", fallback, details: collectedRef.current },
      })
      parsed = res.parsed
      dbId = res.id
    } catch {
      parsed = fallback
    }
    rfqDbIdRef.current = dbId
    consumeRfqCredit()
    const created: RFQ = {
      id: uid("rfq"),
      buyerId: "me",
      buyerName: buyer.businessName || "You",
      rawInputText: p.text,
      vehicle: parsed.vehicle,
      part: parsed.part,
      budget: parsed.budget,
      details: { ...collectedRef.current },
      status: "OPEN",
      createdAt: Date.now(),
    }
    setRfq(created)
    setHistory((prev) => [{ rfq: created, bids: [], createdAt: created.createdAt }, ...prev])
    setPhase("negotiating")
  }

  // ----- Entry points -----

  async function submit(text: string) {
    const value = text.trim()
    if (!value || phase !== "idle") return
    pushMessage({ id: uid("m"), kind: "user", text: value })
    setDraft("")
    setPhase("parsing")
    const fallback = { ...parseRFQ(value), aiConfidence: 0.9 }
    pendingRef.current = { text: value, fallback }
    later(2600, beginAgent)
  }

  function attachPhoto(file: File | undefined) {
    if (!file || phase !== "idle") return
    pushMessage({ id: uid("m"), kind: "user", text: "Photo of the part attached", media: "photo" })
    setPhase("parsing")
    const parsed = parseRFQ("Brake pads for a 2019 Toyota Camry")
    pendingRef.current = { text: "Photo of the part attached", fallback: { ...parsed, aiConfidence: 0.9 } }
    later(1400, beginAgent)
  }

  function handleVoiceEnd() {
    const held = Date.now() - startRef.current
    if (held < 600 || phase !== "idle") return
    pushMessage({ id: uid("m"), kind: "user", text: "Voice note — \"front brake pads, good quality\"", media: "voice" })
    setPhase("parsing")
    const parsed = parseRFQ("Brake pads for a 2019 Toyota Camry")
    pendingRef.current = { text: "Voice note", fallback: { ...parsed, aiConfidence: 0.9 } }
    later(1400, beginAgent)
  }

  function onSend(text: string) {
    if (!text.trim()) return
    if (phase === "idle") {
      submit(text)
    } else if (phase === "collecting") {
      handleGuideReply(text)
    }
    setDraft("")
  }

  // ----- Bidding -----

  function requestForGarage(v: GarageVehicle) {
    setGarageOpen(false)
    submit(`Need brake pads for my ${v.make} ${v.model} ${v.year}`)
  }

  function requestForDiag(part: string) {
    setDiagOpen(false)
    const v = vehicles[0]
    submit(v ? `Need ${part} for my ${v.make} ${v.model} ${v.year}` : `Need ${part}`)
  }

  function negotiate(bid: Bid) {
    setBids((prev) => prev.map((b) => (b.id === bid.id ? { ...b, status: "COUNTERED" } : b)))
    pushMessage({
      id: uid("m"),
      kind: "system",
      text: `Asking ${bid.supplierName} for a better price on the ${bid.brand}…`,
    })
    later(1500, () => {
      addBid(bid.supplierId, bid.supplierName, bid.brand, Math.round(bid.price * 0.84))
      pushMessage({ id: uid("m"), kind: "ai", text: "Counter-offer received. How does this land for you?" })
    })
  }

  function accept(bid: Bid) {
    setBids((prev) => prev.map((b) => (b.id === bid.id ? { ...b, status: "ACCEPTED" } : b)))
    const cur = rfqRef.current
    if (cur) {
      setHistory((prev) => prev.map((h) => (h.rfq.id === cur.id ? { ...h, rfq: { ...h.rfq, status: "CLOSED" }, accepted: bid } : h)))
    }
    setRfq((r) => (r ? { ...r, status: "CLOSED" } : r))
    setPhase("closed")
    clearTimers()
    pushMessage({
      id: uid("m"),
      kind: "system",
      text: `Deal closed — ${bid.brand} @ AED ${formatAED(bid.price)}. ${bid.supplierName} will ship in ~${bid.etaMinutes} min.`,
    })
  }

  function reset() {
    clearTimers()
    setMessages([])
    setBids([])
    setRfq(null)
    setPhase("idle")
    setStepIdx(0)
    pendingRef.current = null
    collectedRef.current = {}
    guideRef.current = null
    tempNameRef.current = ""
    rfqDbIdRef.current = null
    streamedRef.current = null
    setGuide(null)
  }

  async function upgradeToPro() {
    const email = buyer.businessEmail || "buyer@example.com"
    try {
      const res = await startBuyerProCheckout({
        data: { email, successUrl: window.location.origin, cancelUrl: window.location.origin },
      })
      if (!res.needsKey && res.url) {
        window.location.assign(res.url)
        return
      }
    } catch {
      /* fall through */
    }
    upgradeBuyerToPro()
    setGuideBoth(null)
    pushMessage({
      id: uid("m"),
      kind: "system",
      text: "PartPulse Pro activated — unlimited RFQs. (Connect Stripe keys to charge the AED 99/mo subscription.)",
    })
    later(600, () => nextDetail("vin"))
  }

  const liveBids = bids.filter((b) => b.status !== "COUNTERED")
  const composerActive = phase === "idle" || phase === "collecting"

  return (
    <div className="relative flex h-full flex-col">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => attachPhoto(e.target.files?.[0])}
      />

      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-paper/90 px-3 py-3 backdrop-blur">
        <button
          onClick={onExit}
          aria-label="Back"
          className="grid size-9 place-items-center rounded-xl text-ink/70 transition hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[15px] font-700 tracking-tight text-ink">PartPulse</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-live/12 px-2 py-0.5 text-[11px] font-semibold text-live">
              <span className="relative inline-block size-1.5 rounded-full bg-live live-dot" />
              Live
            </span>
          </div>
          <p className="truncate text-[11px] text-muted-foreground">
            {phase === "closed" ? "Deal closed" : "AI parts assistant · live supplier bids"}
          </p>
        </div>
        <button
          onClick={() => setProHubOpen(true)}
          aria-label="Pro features"
          className={
            "relative grid size-9 place-items-center rounded-xl transition hover:bg-muted " +
            (buyer.plan === "PRO" ? "text-amber" : "text-ink/60")
          }
        >
          <Crown className="size-[18px]" />
          {buyer.plan === "FREE" && (
            <span className="absolute -right-0.5 -top-0.5 grid size-3.5 place-items-center rounded-full bg-amber text-[7px] font-bold text-white">
              ★
            </span>
          )}
        </button>
        <button
          onClick={openPricing}
          aria-label="How PartPulse makes money"
          className="grid size-9 place-items-center rounded-xl text-signal transition hover:bg-muted"
        >
          <BadgeCheck className="size-[18px]" />
        </button>
        <button
          onClick={() => setScreen(screen === "orders" ? "chat" : "orders")}
          aria-label="My requests"
          className={
            "relative grid size-9 place-items-center rounded-xl transition hover:bg-muted " +
            (screen === "orders" ? "bg-muted text-signal" : "text-ink/60")
          }
        >
          <ClipboardList className="size-[18px]" />
          {history.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-signal px-1 text-[9px] font-bold text-white">
              {history.length}
            </span>
          )}
        </button>
        <button
          onClick={reset}
          aria-label="Start over"
          className="grid size-9 place-items-center rounded-xl text-ink/60 transition hover:bg-muted"
        >
          <RotateCcw className="size-[18px]" />
        </button>
      </header>

      {/* Free-plan retention banner */}
      {buyer.plan === "FREE" && (
        <div className="flex items-center gap-2 border-b border-amber/20 bg-amber/8 px-3 py-2">
          <Clock className="size-3.5 shrink-0 text-amber" />
          <p className="flex-1 text-[11px] leading-snug text-ink/75">
            <span className="font-bold text-ink">Free plan</span> · chats auto-clear after 24h.
          </p>
          <button
            onClick={() => setProHubOpen(true)}
            className="shrink-0 rounded-lg bg-amber px-2.5 py-1 text-[10.5px] font-bold text-white transition hover:opacity-90"
          >
            Save forever · Pro
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {messages.length === 0 && phase === "idle" && (
          <div className="msg-in pt-6 text-center">
            <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <Sparkles className="size-7" />
            </div>
            <h2 className="font-display text-lg font-700 text-ink">What part do you need?</h2>
            <p className="mx-auto mt-1 max-w-[260px] text-[13px] leading-relaxed text-muted-foreground">
              Describe the part in a message, hold to speak, or snap a photo — I'll guide you and get live quotes.
            </p>
            <div
              className={
                "mt-4 mx-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold " +
                (buyer.verified
                  ? "bg-live/12 text-live"
                  : buyer.plan === "PRO"
                    ? "bg-amber/12 text-amber"
                    : "bg-muted text-muted-foreground")
              }
            >
              <BadgeCheck className="size-3.5" />
              {buyer.verified
                ? `${buyer.businessName} · verified buyer`
                : buyer.plan === "PRO"
                  ? "PartPulse Pro · unlimited RFQs"
                  : `Free plan · ${buyerRfqsLeft} of ${FREE_RFQ_LIMIT} RFQs left`}
            </div>
            <div className="mt-5 space-y-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => submit(p)}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-left text-[13px] font-medium text-ink/80 transition hover:border-signal/50 hover:bg-muted"
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                onClick={() => (buyer.plan === "PRO" ? setGarageOpen(true) : setProHubOpen(true))}
                className="msg-in rounded-2xl border border-border bg-card p-3 text-left shadow-sm transition hover:border-signal/40"
              >
                <div className="flex items-center gap-1.5">
                  <Car className="size-4 text-signal" />
                  {buyer.plan === "FREE" && <Lock className="size-3 text-amber" />}
                  <span className="rounded-full bg-amber/12 px-1.5 py-0.5 text-[9px] font-bold text-amber">PRO</span>
                </div>
                <p className="mt-1.5 text-[12.5px] font-bold text-ink">My Garage</p>
                <p className="text-[10.5px] leading-snug text-muted-foreground">Save vehicles & re-order in one tap</p>
              </button>
              <button
                onClick={() => (buyer.plan === "PRO" ? setDiagOpen(true) : setProHubOpen(true))}
                className="msg-in rounded-2xl border border-border bg-card p-3 text-left shadow-sm transition hover:border-signal/40"
              >
                <div className="flex items-center gap-1.5">
                  <Wrench className="size-4 text-signal" />
                  {buyer.plan === "FREE" && <Lock className="size-3 text-amber" />}
                  <span className="rounded-full bg-amber/12 px-1.5 py-0.5 text-[9px] font-bold text-amber">PRO</span>
                </div>
                <p className="mt-1.5 text-[12.5px] font-bold text-ink">AI Diagnostics</p>
                <p className="text-[10.5px] leading-snug text-muted-foreground">Describe a symptom, get likely causes</p>
              </button>
              <button
                onClick={() => (buyer.plan === "PRO" ? setAlertsOpen(true) : setProHubOpen(true))}
                className="msg-in rounded-2xl border border-border bg-card p-3 text-left shadow-sm transition hover:border-signal/40"
              >
                <div className="flex items-center gap-1.5">
                  <Bell className="size-4 text-signal" />
                  {buyer.plan === "FREE" && <Lock className="size-3 text-amber" />}
                  <span className="rounded-full bg-amber/12 px-1.5 py-0.5 text-[9px] font-bold text-amber">PRO</span>
                </div>
                <p className="mt-1.5 text-[12.5px] font-bold text-ink">Price alerts</p>
                <p className="text-[10.5px] leading-snug text-muted-foreground">Get pinged when a part drops to your price</p>
              </button>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <Message key={m.id} m={m} bids={bids} onNegotiate={negotiate} onAccept={(b) => setAcceptBid(b)} />
        ))}

        {phase === "parsing" && (
          <div className="msg-in space-y-2 rounded-2xl rounded-tl-sm bg-card px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-ink/80">
              <Loader2 className="size-4 animate-spin text-signal" />
              Parsing your RFQ
            </div>
            {PARSE_STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2 text-[12px]">
                <span
                  className={
                    "grid size-4 place-items-center rounded-full " +
                    (i < stepIdx ? "bg-live text-white" : "bg-muted text-muted-foreground")
                  }
                >
                  {i < stepIdx ? <Check className="size-3" /> : <span className="size-1.5 rounded-full bg-current" />}
                </span>
                <span className={i <= stepIdx ? "text-ink/80" : "text-muted-foreground"}>{s}</span>
              </div>
            ))}
          </div>
        )}

        {guide === "limit" && (
          <div className="msg-in max-w-[84%] rounded-2xl rounded-tl-sm border border-amber/30 bg-amber/8 p-3.5">
            <div className="flex items-center gap-2">
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber text-white">
                <Zap className="size-4" />
              </div>
              <p className="text-[13px] font-bold text-ink">PartPulse Pro · AED 99/mo</p>
            </div>
            <ul className="mt-2 space-y-1 text-[12px] text-ink/70">
              <li className="flex items-center gap-1.5"><Check className="size-3.5 text-live" /> Unlimited RFQs</li>
              <li className="flex items-center gap-1.5"><Check className="size-3.5 text-live" /> Priority supplier responses</li>
              <li className="flex items-center gap-1.5"><Check className="size-3.5 text-live" /> Priority support</li>
            </ul>
            <button
              onClick={upgradeToPro}
              className="mt-3 w-full rounded-xl bg-amber px-3 py-2.5 text-[13px] font-bold text-white shadow-md shadow-amber/25 transition hover:opacity-90"
            >
              Upgrade to Pro
            </button>
          </div>
        )}

        {phase !== "idle" && rfq && messages.length > 0 && liveBids.length > 0 && phase === "negotiating" && (
          <div className="flex items-center gap-2 px-1 pt-1 text-[11px] font-medium text-live">
            <span className="relative inline-block size-2 rounded-full bg-live live-dot" />
            New bids are streaming in
          </div>
        )}
      </div>

      {screen === "orders" && <OrdersView history={history} onClose={() => setScreen("chat")} onOpen={setOpenOrder} />}

      {/* Composer */}
      <div className="border-t border-border bg-paper px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]">
        {phase !== "idle" && rfq && phase !== "closed" && phase !== "collecting" && (
          <div className="mb-2 flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-ink">{rfq.part.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {rfq.vehicle.make} {rfq.vehicle.model} · {rfq.vehicle.year} · {rfq.part.category}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-[12px] font-700 text-ink">
                {liveBids.length} bid{liveBids.length === 1 ? "" : "s"}
              </p>
              <p className="text-[11px] text-muted-foreground">budget ≤ AED {formatAED(rfq.budget.max)}</p>
            </div>
          </div>
        )}

        {phase === "collecting" && suggestionsFor(guide).length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5 px-1">
            {suggestionsFor(guide).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setDraft("")
                  onSend(s)
                }}
                className="msg-in rounded-full border border-border bg-card px-3.5 py-2 text-[12.5px] font-semibold text-ink/80 shadow-sm transition hover:border-signal/50 hover:bg-signal/6 active:scale-95"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={!composerActive}
            aria-label="Take photo of the part"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-graphite text-white transition hover:opacity-90 disabled:opacity-40"
          >
            <Camera className="size-5" />
          </button>

          <div className="min-h-11 flex-1 rounded-2xl border border-border bg-card px-3.5 py-2.5">
            {recording ? (
              <div className="flex h-6 items-center gap-2 text-[13px] font-semibold text-signal">
                <span className="relative inline-block size-2.5 rounded-full bg-signal live-dot" />
                Listening — release to send
              </div>
            ) : (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    onSend(draft)
                  }
                }}
                disabled={!composerActive}
                rows={1}
                placeholder={phase === "collecting" ? "Reply to the assistant…" : "Describe the part…"}
                className="no-scrollbar max-h-24 w-full resize-none bg-transparent text-[14px] text-ink placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
              />
            )}
          </div>

          {draft.trim() ? (
            <button
              onClick={() => onSend(draft)}
              aria-label="Send"
              disabled={!composerActive}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-signal text-white shadow-lg shadow-signal/30 transition hover:opacity-90 disabled:opacity-40"
            >
              <Send className="size-5" />
            </button>
          ) : (
            <button
              onPointerDown={() => {
                if (!composerActive) return
                startRef.current = Date.now()
                setRecording(true)
              }}
              onPointerUp={() => {
                setRecording(false)
                handleVoiceEnd()
              }}
              onPointerLeave={() => setRecording(false)}
              aria-label="Hold to speak"
              className={
                "grid size-11 shrink-0 place-items-center rounded-full text-white shadow-lg transition " +
                (recording
                  ? "scale-110 bg-signal shadow-signal/40"
                  : "bg-primary shadow-primary/30 hover:opacity-90") +
                (!composerActive ? " opacity-40" : "")
              }
            >
              <Mic className="size-5" />
            </button>
          )}
        </div>
      </div>

      {acceptBid && (
        <AcceptModal
          bid={acceptBid}
          onClose={() => setAcceptBid(null)}
          onConfirm={async () => {
            const pay = await payForDeal({
              data: {
                rfqId: acceptBid.rfqId,
                bidId: acceptBid.id,
                supplierName: acceptBid.supplierName,
                brand: acceptBid.brand,
                price: acceptBid.price,
              },
            }).catch(() => null)
            accept(acceptBid)
            setAcceptBid(null)
            notify("Deal confirmed", `${acceptBid.brand} for AED ${formatAED(acceptBid.price)} — placed with ${acceptBid.supplierName}.`, "success")
            if (pay) {
              pushMessage({
                id: uid("m"),
                kind: "system",
                text: pay.needsKey
                  ? `Settlement recorded — AED ${formatAED(pay.price)} paid · AED ${formatAED(pay.fee)} marketplace fee · AED ${formatAED(pay.payout)} to ${acceptBid.supplierName}. (Connect Stripe keys to capture payment live.)`
                  : `Payment AED ${formatAED(pay.price)} captured · AED ${formatAED(pay.fee)} fee · AED ${formatAED(pay.payout)} to ${acceptBid.supplierName}.`,
              })
            }
          }}
        />
      )}

      {openOrder && <OrderDetail entry={openOrder} onClose={() => setOpenOrder(null)} />}

      {proHubOpen && (
        <ProHub
          isPro={buyer.plan === "PRO"}
          onUpgrade={upgradeToPro}
          onClose={() => setProHubOpen(false)}
          onGarage={() => {
            setProHubOpen(false)
            setGarageOpen(true)
          }}
          onDiag={() => {
            setProHubOpen(false)
            setDiagOpen(true)
          }}
          onAlerts={() => {
            setProHubOpen(false)
            setAlertsOpen(true)
          }}
        />
      )}

      {alertsOpen && (
        <PriceAlertsOverlay
          isPro={buyer.plan === "PRO"}
          alerts={alerts}
          onAdd={(a) => {
            setAlerts((p) => [a, ...p])
            notify("Alert created", `We'll ping you when ${a.part} drops to AED ${formatAED(a.target)}.`, "info")
          }}
          onRemove={(id) => setAlerts((p) => p.filter((x) => x.id !== id))}
          onDrop={(id) => {
            const a = alerts.find((x) => x.id === id)
            if (!a) return
            const dropped = Math.max(1, Math.round(a.current * 0.82))
            setAlerts((p) => p.map((x) => (x.id === id ? { ...x, current: dropped } : x)))
            notify("Price alert!", `${a.part} is now AED ${formatAED(dropped)} — below your target.`, "alert")
          }}
          onUpgrade={upgradeToPro}
          onClose={() => setAlertsOpen(false)}
        />
      )}

      {garageOpen && (
        <GarageOverlay
          isPro={buyer.plan === "PRO"}
          vehicles={vehicles}
          onAdd={(v) => setVehicles((p) => [v, ...p])}
          onPick={requestForGarage}
          onUpgrade={upgradeToPro}
          onClose={() => setGarageOpen(false)}
        />
      )}

      {diagOpen && (
        <DiagnosticsOverlay
          isPro={buyer.plan === "PRO"}
          onQuote={requestForDiag}
          onUpgrade={upgradeToPro}
          onClose={() => setDiagOpen(false)}
        />
      )}
    </div>
  )
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function orderStatus(entry: HistoryEntry): { label: string; cls: string } {
  if (entry.accepted) return { label: "Deal closed", cls: "bg-live/12 text-live" }
  const open = entry.bids.some((b) => b.status === "PENDING" || b.status === "COUNTERED")
  if (entry.bids.length > 0 && open) return { label: "Negotiating", cls: "bg-amber/12 text-amber" }
  if (entry.bids.length > 0) return { label: "Closed", cls: "bg-muted text-muted-foreground" }
  return { label: "Open", cls: "bg-signal/12 text-signal" }
}

function OrdersView({
  history,
  onClose,
  onOpen,
}: {
  history: HistoryEntry[]
  onClose: () => void
  onOpen: (h: HistoryEntry) => void
}) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-paper">
      <header className="flex items-center gap-3 border-b border-border bg-paper/90 px-3 py-3 backdrop-blur">
        <button
          onClick={onClose}
          aria-label="Back to chat"
          className="grid size-9 place-items-center rounded-xl text-ink/70 transition hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-display text-[15px] font-700 tracking-tight text-ink">My requests</h1>
          <p className="text-[11px] text-muted-foreground">
            {history.length} request{history.length === 1 ? "" : "s"} · tap one for details
          </p>
        </div>
      </header>

      <div className="no-scrollbar flex-1 overflow-y-auto px-3 py-3">
        {history.length === 0 ? (
          <div className="mt-16 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-muted">
              <ClipboardList className="size-7 text-muted-foreground" />
            </div>
            <p className="mt-3 text-[14px] font-semibold text-ink">No requests yet</p>
            <p className="mx-auto mt-1 max-w-[240px] text-[12.5px] text-muted-foreground">
              Post your first part request and it will appear here with live bids and order details.
            </p>
            <button
              onClick={onClose}
              className="mt-4 rounded-xl bg-signal px-4 py-2.5 text-[13px] font-bold text-white shadow-md shadow-signal/25 transition hover:opacity-90"
            >
              Start a request
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {history.map((h) => {
              const st = orderStatus(h)
              const live = h.bids.filter((b) => b.status !== "COUNTERED")
              const best = h.accepted
                ? h.accepted.price
                : live.length
                  ? Math.min(...live.map((b) => b.price))
                  : null
              return (
                <button
                  key={h.rfq.id}
                  onClick={() => onOpen(h)}
                  className="msg-in w-full rounded-2xl border border-border bg-card p-3.5 text-left shadow-sm transition hover:border-signal/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-bold text-ink">
                        {h.rfq.part.name}
                        <span className="font-medium text-muted-foreground"> · {h.rfq.part.category}</span>
                      </p>
                      <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                        {h.rfq.vehicle.make} {h.rfq.vehicle.model} {h.rfq.vehicle.year}
                        {h.rfq.details?.quantity ? ` · Qty ${h.rfq.details.quantity}` : ""}
                      </p>
                    </div>
                    <span className={"shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold " + st.cls}>{st.label}</span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock className="size-3" /> {timeAgo(h.createdAt)}
                      {h.bids.length > 0 && <span className="text-ink/50">·</span>}
                      {h.bids.length > 0 && (
                        <span className="font-medium text-ink/70">
                          {h.bids.length} bid{h.bids.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    {best ? (
                      <div className="text-right">
                        <p className="font-display text-[15px] leading-none font-700 text-ink">
                          AED {formatAED(best)}
                          <span className="ml-0.5 text-[10px] font-600 text-muted-foreground">best</span>
                        </p>
                        <p className="text-[10.5px] text-muted-foreground">budget ≤ AED {formatAED(h.rfq.budget.max)}</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] font-medium text-signal">
                        Awaiting bids <ChevronRight className="size-3.5" />
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function OrderDetail({ entry, onClose }: { entry: HistoryEntry; onClose: () => void }) {
  const { rfq, bids, accepted } = entry
  const st = orderStatus(entry)
  const live = bids.filter((b) => b.status !== "COUNTERED")
  const fee = feeOn((accepted ?? live[0])?.price ?? 0)

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-ink/45 backdrop-blur-[2px]">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0" />
      <div className="sheet-up relative flex max-h-[92%] flex-col overflow-hidden rounded-t-3xl bg-card shadow-2xl">
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-border" />

        <div className="flex items-start gap-3 border-b border-border px-4 py-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-signal/12 text-signal">
            <Box className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="truncate font-display text-[16px] font-700 tracking-tight text-ink">{rfq.part.name}</h2>
              <span className={"shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold " + st.cls}>{st.label}</span>
            </div>
            <p className="truncate text-[12px] text-muted-foreground">
              {rfq.part.category} · {timeAgo(entry.createdAt)}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-lg text-ink/60 transition hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto px-4 py-3">
          {/* Vehicle & budget */}
          <div className="rounded-xl border border-border bg-paper p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Vehicle</p>
                <p className="text-[13px] font-semibold text-ink">
                  {rfq.vehicle.make} {rfq.vehicle.model} {rfq.vehicle.year}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Budget</p>
                <p className="font-display text-[14px] font-700 text-ink">≤ AED {formatAED(rfq.budget.max)}</p>
              </div>
            </div>
          </div>

          {/* Part specs */}
          {(rfq.details?.vin || rfq.details?.reference || rfq.details?.quantity || rfq.details?.condition || rfq.details?.location || rfq.details?.preferredBrand) && (
            <div className="mt-2 rounded-xl border border-border bg-paper p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Part details</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px] text-ink/80">
                {rfq.details!.reference && (
                  <p><span className="text-muted-foreground">Ref:</span> <span className="font-mono font-semibold">{rfq.details!.reference}</span></p>
                )}
                {rfq.details!.vin && (
                  <p className="truncate"><span className="text-muted-foreground">VIN:</span> <span className="font-mono font-semibold">{rfq.details!.vin}</span></p>
                )}
                {rfq.details!.quantity && (
                  <p><span className="text-muted-foreground">Qty:</span> <span className="font-semibold">{rfq.details!.quantity}</span></p>
                )}
                {rfq.details!.condition && (
                  <p><span className="text-muted-foreground">Condition:</span> <span className="font-semibold">{rfq.details!.condition}</span></p>
                )}
                {rfq.details!.location && (
                  <p className="flex items-center gap-1"><MapPin className="size-3 text-muted-foreground" /> <span className="font-semibold">{rfq.details!.location}</span></p>
                )}
                {rfq.details!.preferredBrand && (
                  <p><span className="text-muted-foreground">Pref. brand:</span> <span className="font-semibold">{rfq.details!.preferredBrand}</span></p>
                )}
              </div>
            </div>
          )}

          {/* Accepted deal */}
          {accepted ? (
            <div className="mt-2 rounded-xl border border-live/30 bg-live/8 p-3">
              <div className="flex items-center gap-2">
                <Check className="size-4 text-live" />
                <p className="text-[12px] font-bold text-ink">Deal accepted with {accepted.supplierName}</p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded-lg bg-paper/70 p-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bid</p>
                  <p className="font-display text-[15px] font-700 text-ink">AED {formatAED(accepted.price)}</p>
                </div>
                <div className="rounded-lg bg-paper/70 p-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ships in</p>
                  <p className="flex items-center gap-1 text-[13px] font-semibold text-ink">
                    <Truck className="size-3.5 text-signal" /> ~{accepted.etaMinutes} min
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between rounded-lg bg-paper/70 px-2.5 py-2 text-[11.5px]">
                <span className="text-muted-foreground">Brand</span>
                <span className="font-semibold text-ink">{accepted.brand}</span>
              </div>
              <div className="mt-1.5 rounded-lg bg-paper/70 px-2.5 py-2 text-[11.5px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">You paid</span>
                  <span className="font-semibold text-ink">AED {formatAED(accepted.price)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-muted-foreground">Marketplace fee</span>
                  <span className="font-semibold text-signal">− AED {formatAED(fee)}</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Supplier bids {live.length === 0 ? "(none yet)" : ""}
              </p>
              <div className="mt-1.5 space-y-2">
                {live.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border bg-paper p-4 text-center text-[12px] text-muted-foreground">
                    No bids received yet — suppliers are being notified.
                  </div>
                )}
                {live.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-xl border border-border bg-paper p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="grid size-8 place-items-center rounded-lg bg-graphite font-display text-[12px] font-700 text-white">
                        {b.supplierName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-[12.5px] font-bold text-ink">{b.supplierName}</p>
                        <p className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                          <span className="rounded bg-muted px-1.5 py-px text-[9.5px] font-bold text-ink/60">{b.brand}</span>
                          <Truck className="size-3 text-signal" /> ~{b.etaMinutes} min
                        </p>
                      </div>
                    </div>
                    <p className="font-display text-[15px] font-700 text-ink">AED {formatAED(b.price)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-border px-4 pt-2 pb-[max(env(safe-area-inset-bottom),14px)]">
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-ink/15 bg-paper px-3 py-3 text-[13px] font-semibold text-ink transition hover:border-ink/30"
          >
            Back to requests
          </button>
        </div>
      </div>
    </div>
  )
}

function FeatureIcon({ name, className }: { name: string; className: string }) {
  const cls = "size-4 " + (className || "text-signal")
  switch (name) {
    case "garage":
      return <Car className={cls} />
    case "diag":
      return <Wrench className={cls} />
    case "save":
      return <Save className={cls} />
    case "unlimited":
      return <Zap className={cls} />
    case "priority":
      return <BadgeCheck className={cls} />
    case "alerts":
      return <Star className={cls} />
    default:
      return <Crown className={cls} />
  }
}

function ProHub({
  isPro,
  onUpgrade,
  onClose,
  onGarage,
  onDiag,
  onAlerts,
}: {
  isPro: boolean
  onUpgrade: () => void
  onClose: () => void
  onGarage: () => void
  onDiag: () => void
  onAlerts: () => void
}) {
  const actions: Record<string, () => void> = { garage: onGarage, diag: onDiag, alerts: onAlerts }
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-ink/45 backdrop-blur-[2px]">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0" />
      <div className="sheet-up relative max-h-[90%] overflow-y-auto rounded-t-3xl bg-card px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

        <div className="flex items-center gap-2.5">
          <div className="grid size-10 place-items-center rounded-xl bg-amber/12 text-amber">
            <Crown className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-[17px] font-700 tracking-tight text-ink">PartPulse Pro</h2>
            <p className="text-[12px] text-muted-foreground">
              {isPro ? "All features unlocked ✓" : "AED 99/mo · everything unlocked"}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {PRO_FEATURES.map((f) => {
            const clickable = isPro && actions[f.icon]
            return (
              <button
                key={f.icon}
                onClick={clickable ? actions[f.icon] : undefined}
                disabled={!clickable}
                className={
                  "rounded-2xl border p-3 text-left transition " +
                  (isPro
                    ? "border-border bg-paper hover:border-signal/40"
                    : "border-border bg-paper/50 opacity-80") +
                  (!clickable ? " cursor-default" : "")
                }
              >
                <div className="flex items-center justify-between">
                  <div className={"grid size-8 place-items-center rounded-lg " + (isPro ? "bg-signal/12 text-signal" : "bg-muted text-ink/50")}>
                    <FeatureIcon name={f.icon} className={isPro ? "text-signal" : "text-muted-foreground"} />
                  </div>
                  {isPro ? (
                    <Check className="size-4 text-live" />
                  ) : (
                    <Lock className="size-3.5 text-amber" />
                  )}
                </div>
                <p className="mt-2 text-[12.5px] font-bold text-ink">{f.title}</p>
                <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{f.desc}</p>
              </button>
            )
          })}
        </div>

        {!isPro && (
          <button
            onClick={onUpgrade}
            className="mt-4 w-full rounded-xl bg-amber px-4 py-3 text-[14px] font-bold text-white shadow-md shadow-amber/25 transition hover:opacity-90"
          >
            Upgrade to Pro · AED 99/mo
          </button>
        )}
      </div>
    </div>
  )
}

const ALERT_PRESETS = ["Brake Pads", "Alternator", "Spark Plugs", "Shock Absorbers", "Drive Belt"]

function PriceAlertsOverlay({
  isPro,
  alerts,
  onAdd,
  onRemove,
  onDrop,
  onUpgrade,
  onClose,
}: {
  isPro: boolean
  alerts: PriceAlert[]
  onAdd: (a: PriceAlert) => void
  onRemove: (id: string) => void
  onDrop: (id: string) => void
  onUpgrade: () => void
  onClose: () => void
}) {
  const [part, setPart] = useState("")
  const [target, setTarget] = useState("")
  const [market, setMarket] = useState<Record<string, number>>({})

  const create = () => {
    const name = part.trim()
    const price = Number(target)
    if (!name || !price || price <= 0) return
    const marketPrice = market[name] ?? Math.round(price * 1.25)
    onAdd({ id: uid("a"), part: name, ref: "", category: "Custom", target: price, current: marketPrice })
    setPart("")
    setTarget("")
  }

  if (!isPro) {
    return (
      <div className="absolute inset-0 z-30 flex flex-col justify-end bg-ink/45 backdrop-blur-[2px]">
        <button aria-label="Close" onClick={onClose} className="absolute inset-0" />
        <div className="sheet-up relative rounded-t-3xl bg-card px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] shadow-2xl">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
          <div className="flex items-center gap-2.5">
            <div className="grid size-10 place-items-center rounded-xl bg-amber/12 text-amber">
              <Bell className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-[17px] font-700 tracking-tight text-ink">Smart price alerts</h2>
              <p className="text-[12px] text-muted-foreground">Get pinged the moment a part hits your price</p>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber/30 bg-amber/10 p-3.5">
            <Lock className="mt-0.5 size-4 shrink-0 text-amber" />
            <p className="text-[12.5px] leading-relaxed text-ink">
              Price alerts are a <span className="font-bold text-amber">Pro</span> feature. Upgrade to watch as many parts as you need
              and get notified in real time when prices drop.
            </p>
          </div>
          <button
            onClick={onUpgrade}
            className="mt-4 w-full rounded-xl bg-amber px-4 py-3 text-[14px] font-bold text-white shadow-md shadow-amber/25 transition hover:opacity-90"
          >
            Unlock with Pro · AED 99/mo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-ink/45 backdrop-blur-[2px]">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0" />
      <div className="sheet-up relative max-h-[90%] overflow-y-auto rounded-t-3xl bg-card px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-center gap-2.5">
          <div className="grid size-10 place-items-center rounded-xl bg-signal/12 text-signal">
            <Bell className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[17px] font-700 tracking-tight text-ink">Smart price alerts</h2>
            <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <span className="relative inline-block size-1.5 rounded-full bg-live live-dot" />
              Watching {alerts.length} part{alerts.length === 1 ? "" : "s"}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-lg text-ink/60 transition hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        {/* Create alert */}
        <div className="mt-3 rounded-2xl border border-border bg-paper p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">New alert</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ALERT_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPart(p)
                  setMarket((m) => (m[p] ? m : { ...m, [p]: Math.round(240 + Math.random() * 460) }))
                }}
                className={
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition " +
                  (part === p ? "border-signal bg-signal/10 text-signal" : "border-border bg-card text-muted-foreground hover:border-signal/40")
                }
              >
                {p}
              </button>
            ))}
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Part</span>
              <input
                value={part}
                onChange={(e) => setPart(e.target.value)}
                placeholder="e.g. Brake Pads"
                className="rounded-xl border border-border bg-card px-3 py-2 text-[13px] text-ink placeholder:text-muted-foreground focus:border-signal focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Target AED</span>
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                placeholder="e.g. 220"
                className="rounded-xl border border-border bg-card px-3 py-2 text-[13px] text-ink placeholder:text-muted-foreground focus:border-signal focus:outline-none"
              />
            </label>
          </div>
          <button
            onClick={create}
            disabled={!part.trim() || !Number(target)}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-live px-4 py-2.5 text-[13px] font-bold text-white shadow-md shadow-live/25 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <BellRing className="size-4" /> Watch this part
          </button>
        </div>

        {/* Alert list */}
        <div className="mt-3 space-y-2">
          {alerts.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-paper/60 px-4 py-6 text-center">
              <Bell className="size-6 text-muted-foreground" />
              <p className="text-[12px] text-muted-foreground">
                No alerts yet. Add one above and we'll ping you when the price drops to your target.
              </p>
            </div>
          )}
          {alerts.map((a) => {
            const hit = a.current <= a.target
            return (
              <div key={a.id} className={"rounded-2xl border p-3 " + (hit ? "border-live/40 bg-live/8" : "border-border bg-paper")}>
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">{a.part}</p>
                  <div className="flex items-center gap-1.5">
                    {hit ? (
                      <span className="flex items-center gap-1 rounded-full bg-live/15 px-2 py-0.5 text-[10px] font-bold text-live">
                        <Check className="size-3" /> Target hit
                      </span>
                    ) : (
                      <button
                        onClick={() => onDrop(a.id)}
                        className="flex items-center gap-1 rounded-full bg-signal/12 px-2.5 py-1 text-[10.5px] font-bold text-signal transition hover:bg-signal/20"
                      >
                        <Zap className="size-3" /> Simulate price drop
                      </button>
                    )}
                    <button
                      onClick={() => onRemove(a.id)}
                      aria-label="Remove alert"
                      className="grid size-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Market now</span>
                  <span className={"font-display text-[14px] font-700 " + (hit ? "text-live" : "text-ink")}>AED {formatAED(a.current)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Your target</span>
                  <span className="text-[12px] font-semibold text-ink">≤ AED {formatAED(a.target)}</span>
                </div>
                {!hit && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-signal transition-all"
                      style={{ width: `${Math.min(100, Math.round((a.target / a.current) * 100))}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function GarageOverlay({
  isPro,
  vehicles,
  onAdd,
  onPick,
  onUpgrade,
  onClose,
}: {
  isPro: boolean
  vehicles: GarageVehicle[]
  onAdd: (v: GarageVehicle) => void
  onPick: (v: GarageVehicle) => void
  onUpgrade: () => void
  onClose: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [mk, setMk] = useState("")
  const [md, setMd] = useState("")
  const [yr, setYr] = useState("")
  const [pl, setPl] = useState("")

  if (!isPro) {
    return (
      <div className="absolute inset-0 z-30 flex flex-col justify-end bg-ink/45 backdrop-blur-[2px]">
        <button aria-label="Close" onClick={onClose} className="absolute inset-0" />
        <div className="sheet-up relative rounded-t-3xl bg-card px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] shadow-2xl">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
          <div className="flex items-center gap-2.5">
            <div className="grid size-10 place-items-center rounded-xl bg-signal/12 text-signal">
              <Car className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-[17px] font-700 tracking-tight text-ink">My Garage</h2>
              <p className="text-[12px] text-muted-foreground">Save your vehicles & re-order in one tap</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber/25 bg-amber/8 p-3">
            <Lock className="size-4 shrink-0 text-amber" />
            <p className="text-[12px] text-ink/75">
              <span className="font-bold text-ink">My Garage is a Pro feature.</span> Save unlimited vehicles, pick a car and order parts instantly.
            </p>
          </div>
          <button
            onClick={onUpgrade}
            className="mt-4 w-full rounded-xl bg-amber px-4 py-3 text-[14px] font-bold text-white shadow-md shadow-amber/25 transition hover:opacity-90"
          >
            Upgrade to Pro · AED 99/mo
          </button>
        </div>
      </div>
    )
  }

  const valid = mk.trim() && md.trim() && yr.trim()
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-ink/45 backdrop-blur-[2px]">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0" />
      <div className="sheet-up relative flex max-h-[92%] flex-col overflow-hidden rounded-t-3xl bg-card shadow-2xl">
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-border" />

        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <div className="grid size-10 place-items-center rounded-xl bg-signal/12 text-signal">
            <Car className="size-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-[16px] font-700 tracking-tight text-ink">My Garage</h2>
            <p className="text-[11.5px] text-muted-foreground">Tap a vehicle to order parts</p>
          </div>
          <button
            onClick={() => setAdding((a) => !a)}
            aria-label="Add vehicle"
            className="grid size-9 place-items-center rounded-xl bg-live text-white transition hover:opacity-90"
          >
            <Plus className="size-5" />
          </button>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto px-4 py-3">
          {adding && (
            <div className="mb-3 rounded-2xl border border-border bg-paper p-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Make</span>
                  <input value={mk} onChange={(e) => setMk(e.target.value)} placeholder="Toyota"
                    className="mt-1 w-full rounded-lg border border-border bg-card px-2.5 py-2 text-[13px] text-ink placeholder:text-muted-foreground focus:border-signal focus:outline-none" />
                </label>
                <label className="block">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Model</span>
                  <input value={md} onChange={(e) => setMd(e.target.value)} placeholder="Camry"
                    className="mt-1 w-full rounded-lg border border-border bg-card px-2.5 py-2 text-[13px] text-ink placeholder:text-muted-foreground focus:border-signal focus:outline-none" />
                </label>
                <label className="block">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Year</span>
                  <input value={yr} onChange={(e) => setYr(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2019"
                    className="mt-1 w-full rounded-lg border border-border bg-card px-2.5 py-2 text-[13px] text-ink placeholder:text-muted-foreground focus:border-signal focus:outline-none" />
                </label>
                <label className="block">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Plate (optional)</span>
                  <input value={pl} onChange={(e) => setPl(e.target.value)} placeholder="D 78234"
                    className="mt-1 w-full rounded-lg border border-border bg-card px-2.5 py-2 text-[13px] text-ink placeholder:text-muted-foreground focus:border-signal focus:outline-none" />
                </label>
              </div>
              <button
                onClick={() => {
                  if (!valid) return
                  onAdd({
                    id: uid("v"),
                    make: mk.trim(),
                    model: md.trim(),
                    year: Number(yr),
                    plate: pl.trim() || "—",
                  })
                  setMk("")
                  setMd("")
                  setYr("")
                  setPl("")
                  setAdding(false)
                }}
                disabled={!valid}
                className="mt-3 w-full rounded-xl bg-live px-3 py-2.5 text-[13px] font-bold text-white shadow-md shadow-live/25 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save vehicle
              </button>
            </div>
          )}

          {vehicles.length === 0 ? (
            <div className="mt-14 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted">
                <Car className="size-6 text-muted-foreground" />
              </div>
              <p className="mt-3 text-[13.5px] font-semibold text-ink">No vehicles yet</p>
              <p className="mx-auto mt-1 max-w-[230px] text-[12px] text-muted-foreground">
                Add your cars and order parts for them in one tap.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {vehicles.map((v) => (
                <button
                  key={v.id}
                  onClick={() => onPick(v)}
                  className="msg-in flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left shadow-sm transition hover:border-signal/40"
                >
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-graphite font-display text-[12px] font-700 text-white">
                    {v.make.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-ink">
                      {v.make} {v.model} <span className="font-medium text-muted-foreground">· {v.year}</span>
                    </p>
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin className="size-3" /> {v.plate}
                      {v.note && <span className="text-ink/50">· {v.note}</span>}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-signal">
                    Order <ChevronRight className="size-3.5" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DiagnosticsOverlay({
  isPro,
  onQuote,
  onUpgrade,
  onClose,
}: {
  isPro: boolean
  onQuote: (part: string) => void
  onUpgrade: () => void
  onClose: () => void
}) {
  const [convo, setConvo] = useState<{ id: string; role: "ai" | "user"; text?: string; diag?: Diagnosis }[]>([])
  const [wanted, setWanted] = useState<Set<string>>(new Set())
  const [draft, setDraft] = useState("")
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const booted = useRef(false)

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    setConvo([
      {
        id: uid("d"),
        role: "ai",
        text: "Hi, I'm your AI mechanic. Describe any symptom and I'll walk you through the likely causes and how to fix each one — then if you want a part, just tell me and I'll pull live quotes.",
      },
    ])
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [convo, thinking])

  function send(text: string) {
    const value = text.trim()
    if (!value || thinking) return
    setDraft("")
    setConvo((prev) => [...prev, { id: uid("d"), role: "user", text: value }])
    setThinking(true)
    window.setTimeout(() => {
      const diag = diagnoseText(value)
      setConvo((prev) => [
        ...prev,
        { id: uid("d"), role: "ai", diag },
        ...(diag.parts.length > 0
          ? [
              {
                id: uid("d"),
                role: "ai" as const,
                text: "Want me to sort it out? Tell me which part you'd like (or tap \"I want this part\") and I'll pull live quotes for you.",
              },
            ]
          : []),
      ])
      setThinking(false)
    }, 950)
  }

  if (!isPro) {
    return (
      <div className="absolute inset-0 z-30 flex flex-col justify-end bg-ink/45 backdrop-blur-[2px]">
        <button aria-label="Close" onClick={onClose} className="absolute inset-0" />
        <div className="sheet-up relative rounded-t-3xl bg-card px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] shadow-2xl">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
          <div className="flex items-center gap-2.5">
            <div className="grid size-10 place-items-center rounded-xl bg-signal/12 text-signal">
              <Wrench className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-[17px] font-700 tracking-tight text-ink">AI Diagnostics</h2>
              <p className="text-[12px] text-muted-foreground">Describe a symptom, get likely causes & parts</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber/25 bg-amber/8 p-3">
            <Lock className="size-4 shrink-0 text-amber" />
            <p className="text-[12px] text-ink/75">
              <span className="font-bold text-ink">AI Diagnostics is a Pro feature.</span> Chat with the AI about any symptom and it returns likely parts with confidence scores.
            </p>
          </div>
          <button
            onClick={onUpgrade}
            className="mt-4 w-full rounded-xl bg-amber px-4 py-3 text-[14px] font-bold text-white shadow-md shadow-amber/25 transition hover:opacity-90"
          >
            Upgrade to Pro · AED 99/mo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-ink/45 backdrop-blur-[2px]">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0" />
      <div className="sheet-up relative flex h-full max-h-[94%] flex-col overflow-hidden rounded-t-3xl bg-card shadow-2xl">
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-border" />

        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <div className="grid size-9 place-items-center rounded-xl bg-signal/12 text-signal">
            <Wrench className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[15px] font-700 tracking-tight text-ink">AI Diagnostics</h2>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="relative inline-block size-1.5 rounded-full bg-live live-dot" />
              <span className="truncate">Your AI mechanic · always online</span>
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-lg text-ink/60 transition hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        <div ref={scrollRef} className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {convo.map((c) =>
            c.role === "user" ? (
              <div key={c.id} className="msg-in flex justify-end">
                <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-[14px] leading-relaxed text-primary-foreground shadow-md shadow-primary/15">
                  {c.text}
                </div>
              </div>
            ) : c.diag ? (
              <div key={c.id} className="msg-in flex justify-start">
                <div className="max-w-[94%]">
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-[13px] font-semibold text-ink shadow-sm">
                    <Wrench className="size-4 text-signal" />
                    Here's what I'd look at first for "{c.diag.symptom}"
                  </div>
                  {c.diag.parts.length === 0 ? (
                    <div className="mt-2 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 text-[12.5px] leading-relaxed text-ink/75 shadow-sm">
                      I couldn't pinpoint that yet. Could you add a little more detail — when it happens, any sound, or smell? Then I'll narrow it down.
                    </div>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {c.diag.parts.map((p, idx) => {
                        const isWanted = wanted.has(p.part)
                        return (
                          <div key={p.part} className="rounded-2xl rounded-tl-sm border border-border bg-paper p-3 shadow-sm">
                            <div className="flex items-center justify-between">
                              <p className="text-[13px] font-bold text-ink">
                                <span className="mr-1.5 text-muted-foreground">#{idx + 1}</span>
                                {p.part}
                              </p>
                              <span className="rounded-full bg-signal/12 px-2 py-0.5 text-[10.5px] font-bold text-signal">
                                {Math.round(p.confidence * 100)}% likely
                              </span>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-signal" style={{ width: `${p.confidence * 100}%` }} />
                            </div>
                            <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">{p.hint}</p>

                            <div className="mt-2.5 rounded-xl border border-signal/15 bg-signal/6 p-2.5">
                              <p className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-signal">
                                <Wrench className="size-3" /> How to fix it
                              </p>
                              <p className="mt-1 text-[11.5px] leading-snug text-ink/80">{p.fix}</p>
                            </div>

                            {isWanted ? (
                              <button
                                onClick={() => onQuote(p.part)}
                                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-live px-3 py-2.5 text-[12.5px] font-bold text-white shadow-md shadow-live/25 transition hover:opacity-90"
                              >
                                <Zap className="size-3.5" /> Get live quotes for {p.part}
                              </button>
                            ) : (
                              <button
                                onClick={() => setWanted((prev) => new Set(prev).add(p.part))}
                                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-ink/10 bg-card px-3 py-2.5 text-[12.5px] font-bold text-ink/80 transition hover:border-signal/50 hover:bg-signal/6 hover:text-ink"
                              >
                                I want this part
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div key={c.id} className="msg-in flex justify-start">
                <div className="max-w-[86%] rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-[13.5px] leading-relaxed text-ink/85 shadow-sm">
                  {c.text}
                </div>
              </div>
            ),
          )}

          {thinking && (
            <div className="msg-in flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 shadow-sm">
                <Loader2 className="size-4 animate-spin text-signal" />
                <span className="text-[12.5px] text-muted-foreground">Reading your symptom…</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick starters */}
        {convo.length <= 1 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-2">
            {DIAGNOSES.map((d) => (
              <button
                key={d.symptom}
                onClick={() => send(d.symptom)}
                className="shrink-0 rounded-full border border-border bg-paper px-3.5 py-2 text-[12px] font-semibold text-ink/80 transition hover:border-signal/50 hover:bg-signal/6 active:scale-95"
              >
                {d.symptom}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 border-t border-border px-3 pt-2 pb-[max(env(safe-area-inset-bottom),14px)]">
          <div className="min-h-11 flex-1 rounded-2xl border border-border bg-card px-3.5 py-2.5">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  send(draft)
                }
              }}
              rows={1}
              placeholder="Describe a symptom… e.g. squealing when I brake"
              className="no-scrollbar max-h-24 w-full resize-none bg-transparent text-[14px] text-ink placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <button
            onClick={() => send(draft)}
            aria-label="Send symptom"
            disabled={!draft.trim() || thinking}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-signal text-white shadow-lg shadow-signal/30 transition hover:opacity-90 disabled:opacity-40"
          >
            <Send className="size-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function Message({
  m,
  bids,
  onNegotiate,
  onAccept,
}: {
  m: ChatMessage
  bids: Bid[]
  onNegotiate: (b: Bid) => void
  onAccept: (b: Bid) => void
}) {
  if (m.kind === "user") {
    return (
      <div className="msg-in flex justify-end">
        <div className="max-w-[82%]">
          <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-[14px] leading-relaxed text-primary-foreground shadow-md shadow-primary/15">
            {m.text}
          </div>
          {m.media && (
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[12px] font-medium text-ink/70">
              {m.media === "photo" ? <Camera className="size-4 text-signal" /> : <Mic className="size-4 text-signal" />}
              {m.media === "photo" ? "Part photo attached" : "Voice note recorded"}
              <span className="ml-auto rounded bg-signal/12 px-1.5 py-0.5 text-[10px] font-bold text-signal">AI READY</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (m.kind === "ai") {
    return (
      <div className="msg-in flex justify-start">
        <div className="max-w-[84%] rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-2.5 text-[13.5px] leading-relaxed text-ink/85 shadow-sm">
          {m.text.split("**").map((seg, i) =>
            i % 2 === 1 ? (
              <strong key={i} className="font-bold text-ink">
                {seg}
              </strong>
            ) : (
              <span key={i}>{seg}</span>
            ),
          )}
        </div>
      </div>
    )
  }

  if (m.kind === "system") {
    return (
      <div className="msg-in flex justify-center">
        <div className="max-w-[90%] rounded-full bg-muted px-4 py-1.5 text-center text-[12px] font-medium text-ink/70">
          {m.text}
        </div>
      </div>
    )
  }

  const bid = bids.find((b) => b.id === m.bidId)
  if (!bid) return null
  return (
    <div className="msg-in flex justify-start">
      <BidCard bid={bid} onNegotiate={() => onNegotiate(bid)} onAccept={() => onAccept(bid)} />
    </div>
  )
}

function BidCard({ bid, onNegotiate, onAccept }: { bid: Bid; onNegotiate: () => void; onAccept: () => void }) {
  return (
    <div
      className={
        "w-[min(82vw,320px)] rounded-2xl border p-3.5 shadow-sm " +
        (bid.status === "ACCEPTED"
          ? "border-live/40 bg-live/8"
          : bid.status === "COUNTERED"
            ? "border-border bg-card opacity-60"
            : "border-border bg-card")
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-graphite font-display text-[13px] font-700 text-white">
            {bid.supplierName.charAt(0)}
          </div>
          <div>
            <p className="text-[12px] font-bold leading-tight text-ink">{bid.supplierName}</p>
            <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
              <BadgeCheck className="size-3 text-live" />
              <span className="flex items-center">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={"size-2.5 " + (i < 5 ? "fill-amber text-amber" : "text-muted")} />
                ))}
              </span>
              <span className="font-semibold text-amber">4.8</span>
            </div>
          </div>
        </div>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-ink/70">{bid.brand}</span>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="font-display text-[22px] leading-none font-700 tracking-tight text-ink">
            {formatAED(bid.price)}
            <span className="ml-1 text-[12px] font-600 text-muted-foreground">AED</span>
          </p>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Zap className="size-3 text-signal" />
            ships in ~{bid.etaMinutes} min
          </p>
        </div>
        {bid.status === "COUNTERED" && (
          <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">WITHDRAWN</span>
        )}
      </div>

      {bid.status !== "COUNTERED" && bid.status !== "ACCEPTED" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={onNegotiate}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-ink/15 bg-paper px-3 py-2 text-[12px] font-semibold text-ink transition hover:border-ink/30"
          >
            <ChevronDown className="size-4" />
            Negotiate
          </button>
          <button
            onClick={onAccept}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-live px-3 py-2 text-[12px] font-semibold text-white shadow-md shadow-live/25 transition hover:opacity-90"
          >
            <Check className="size-4" />
            Accept
          </button>
        </div>
      )}
      {bid.status === "ACCEPTED" && (
        <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-live/12 px-3 py-2 text-[12px] font-bold text-live">
          <Check className="size-4" /> Deal accepted
        </div>
      )}
    </div>
  )
}

function AcceptModal({
  bid,
  onClose,
  onConfirm,
}: {
  bid: Bid
  onClose: () => void
  onConfirm: () => void
}) {
  const fee = feeOn(bid.price)
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-ink/45 backdrop-blur-[2px]">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0" />
      <div className="sheet-up relative rounded-t-3xl bg-card px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

        <div className="mb-1 flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-signal/12 text-signal">
            <Check className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-[16px] font-700 tracking-tight text-ink">Confirm this deal</h2>
            <p className="text-[12px] text-muted-foreground">
              {bid.supplierName} · {bid.brand} · ships ~{bid.etaMinutes} min
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-xl bg-muted px-3 py-1">
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[13px] text-muted-foreground">Bid price</span>
            <span className="font-display text-[15px] font-700 text-ink">AED {formatAED(bid.price)}</span>
          </div>
          <div className="border-t border-border/60" />
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[13px] text-muted-foreground">
              Marketplace fee ({Math.round(MARKET_FEE * 100)}%)
            </span>
            <span className="font-display text-[14px] font-700 text-signal">− AED {formatAED(fee)}</span>
          </div>
          <div className="border-t border-border/60" />
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[13px] font-semibold text-ink">Supplier receives</span>
            <span className="font-display text-[15px] font-700 text-ink">AED {formatAED(bid.price - fee)}</span>
          </div>
        </div>

        <p className="mt-2 px-1 text-[11px] leading-relaxed text-muted-foreground">
          The marketplace fee funds live matching, AI part parsing and secure settlement. You pay the full bid price;
          the supplier is paid after the fee.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-ink/15 bg-paper px-3 py-3 text-[13px] font-semibold text-ink transition hover:border-ink/30"
          >
            Keep comparing
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl bg-live px-3 py-3 text-[13px] font-bold text-white shadow-md shadow-live/25 transition hover:opacity-90"
          >
            Confirm deal · AED {formatAED(bid.price)}
          </button>
        </div>
      </div>
    </div>
  )
}
