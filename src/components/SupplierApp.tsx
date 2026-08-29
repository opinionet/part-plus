import { useEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Check,
  ChevronRight,
  Clock,
  Inbox,
  Loader2,
  Lock,
  MapPin,
  Package,
  Scan,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Star,
  Wallet,
  X,
  Zap,
} from "lucide-react"

import { BOOST_FEE, PRO_PRICE } from "#/components/PricingModal.tsx"
import { StockTab } from "#/components/StockTab.tsx"
import { listPayouts, listRfqs, startProCheckout, submitBid, submitVerification } from "#/lib/backend.functions.ts"
import { formatAED, SEED_RFQS, SEED_SUPPLIERS, useApp } from "#/lib/store.tsx"
import type { RFQ, SupplierProfile } from "#/lib/store.tsx"

const EXTRACT_STEPS = ["Reading your business card", "Recognising name & brands", "Creating your storefront"]

let idCounter = 0
const uid = (p: string) => `${p}_${Date.now()}_${idCounter++}`

function timeAgo(ts: number) {
  const mins = Math.max(1, Math.round((Date.now() - ts) / 60000))
  if (mins < 60) return `${mins} min ago`
  return `${Math.round(mins / 60)}h ago`
}

export function SupplierApp({ onExit }: { onExit: () => void }) {
  const { openPricing, notify } = useApp()
  const [profile, setProfile] = useState<SupplierProfile | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [rfqs, setRfqs] = useState<RFQ[]>(SEED_RFQS)
  const [feedQuery, setFeedQuery] = useState("")
  const [myBids, setMyBids] = useState<Record<string, { price: number; brand: string; boosted?: boolean }>>({})
  const [respondRfq, setRespondRfq] = useState<RFQ | null>(null)
  const [upgradeNote, setUpgradeNote] = useState("")
  const [licenseOpen, setLicenseOpen] = useState(false)
  const [licenseNo, setLicenseNo] = useState("")
  const [tab, setTab] = useState<"requests" | "stock">("requests")
  const [payouts, setPayouts] = useState<{ total: number; count: number; pending: number }>({
    total: 0,
    count: 0,
    pending: 0,
  })
  const fileRef = useRef<HTMLInputElement>(null)
  const timers = useRef<number[]>([])

  // Load real RFQs posted by buyers into the feed (merges on top of demo data).
  useEffect(() => {
    let active = true
    listRfqs()
      .then((rows) => {
        if (!active || rows.length === 0) return
        setRfqs((prev) => [...(rows as RFQ[]), ...prev])
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => {
      setRfqs((prev) => [
        {
          id: uid("rfq"),
          buyerId: "b5",
          buyerName: "Alia Auto Clinic",
          rawInputText: "New clutch kit for BMW X5 2020",
          vehicle: { make: "BMW", model: "X5", year: 2020, engine: "3.0L" },
          part: { name: "Clutch Kit", category: "Transmission" },
          budget: { min: 480, max: 720 },
          status: "OPEN",
          createdAt: Date.now(),
        },
        ...prev,
      ])
    }, 9000)
    timers.current.push(t)
    return () => timers.current.forEach((x) => window.clearTimeout(x))
  }, [])

  function handleCard(file: File | undefined) {
    if (!file) return
    setExtracting(true)
    setStepIdx(0)
    ;[1, 2, 3].forEach((s, i) => timers.current.push(window.setTimeout(() => setStepIdx(s), 420 + i * 560)))
    timers.current.push(
      window.setTimeout(() => {
        setProfile({ ...SEED_SUPPLIERS[0], verification: "unverified", verified: false, plan: "FREE" })
        setExtracting(false)
      }, 2300),
    )
  }

  // Load real earnings for this supplier once the profile is set up.
  useEffect(() => {
    if (!profile?.businessName) return
    listPayouts({ data: { supplierName: profile.businessName } })
      .then((p) => setPayouts(p))
      .catch(() => {})
  }, [profile?.businessName])

  async function submitLicense() {
    if (!profile || !licenseNo.trim()) return
    const st = await submitVerification({
      data: { businessName: profile.businessName, licenseNumber: licenseNo },
    }).catch(() => "pending" as const)
    setProfile((p) => (p ? { ...p, verification: st, verified: st === "verified" } : p))
    setLicenseOpen(false)
    setLicenseNo("")
    if (st === "verified") notify("You're verified", "Your green badge is now shown to buyers on every bid.", "success")
  }

  function sendBid(price: number, brand: string, boosted: boolean) {
    if (!respondRfq || price <= 0) return
    setMyBids((prev) => ({ ...prev, [respondRfq.id]: { price, brand, boosted } }))
    setRfqs((prev) => prev.map((r) => (r.id === respondRfq.id ? { ...r, status: "NEGOTIATING" } : r)))
    setRespondRfq(null)
    notify("Bid sent", `AED ${formatAED(price)} ${brand ? "· " + brand : ""} for ${respondRfq.part.name}.`, "success")
    submitBid({
      data: {
        rfqId: respondRfq.id,
        supplierName: profile?.businessName ?? "Supplier",
        brand,
        price,
        etaMinutes: 20 + (respondRfq.id.length % 6) * 6,
        boosted,
      },
    }).catch(() => {})
  }

  async function upgradeToPro() {
    setUpgradeNote("")
    try {
      const res = await startProCheckout({
        data: {
          businessName: profile?.businessName ?? "My Shop",
          successUrl: window.location.origin + "/",
          cancelUrl: window.location.origin + "/",
        },
      })
      if (res.needsKey) {
        setUpgradeNote(res.message)
        setProfile((p) => (p ? { ...p, plan: "PRO" } : p))
        notify("Pro unlocked", "Unlimited RFQs & priority feed placement are now active.", "success")
      } else {
        setProfile((p) => (p ? { ...p, plan: "PRO" } : p))
        notify("Pro unlocked", "Unlimited RFQs & priority feed placement are now active.", "success")
        window.location.href = res.url
      }
    } catch {
      setUpgradeNote("Couldn't start checkout — please try again.")
    }
  }

  /* ---------------- Onboarding ---------------- */
  if (!profile) {
    return (
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-paper/90 px-3 py-3 backdrop-blur">
          <button onClick={onExit} aria-label="Back" className="grid size-9 place-items-center rounded-xl text-ink/70 transition hover:bg-muted">
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h1 className="font-display text-[15px] font-700 tracking-tight text-ink">Supplier onboarding</h1>
            <p className="text-[11px] text-muted-foreground">Set up your storefront with AI</p>
          </div>
        </header>

        <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-3 py-4">
          <div className="msg-in flex justify-end">
            <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-[14px] leading-relaxed text-primary-foreground shadow-md shadow-primary/15">
              Ready to start selling parts?
            </div>
          </div>
          <div className="msg-in flex justify-start">
            <div className="max-w-[84%] rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <Scan className="size-4 text-signal" />
                Show us your business card
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                Take a photo of your card and GPT-4o Vision reads your business name, brand specialities and
                categories automatically.
              </p>
            </div>
          </div>

          {extracting ? (
            <div className="msg-in space-y-2 rounded-2xl rounded-tl-sm bg-card px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-ink/80">
                <Loader2 className="size-4 animate-spin text-signal" />
                Extracting your business card
              </div>
              {EXTRACT_STEPS.map((s, i) => (
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
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="msg-in group flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card px-4 py-8 transition hover:border-signal/50 hover:bg-muted"
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleCard(e.target.files?.[0])}
              />
              <div className="grid size-14 place-items-center rounded-2xl bg-graphite text-white shadow-lg shadow-graphite/25 transition group-hover:bg-signal">
                <Camera className="size-7" />
              </div>
              <div className="text-center">
                <p className="text-[14px] font-semibold text-ink">Take a photo of your business card</p>
                <p className="mt-1 text-[12px] text-muted-foreground">Camera opens on your phone · PNG / JPG</p>
              </div>
            </button>
          )}
        </div>
      </div>
    )
  }

  /* ---------------- Dashboard ---------------- */
  const open = rfqs.filter((r) => r.status === "OPEN").length
  const negotiating = rfqs.filter((r) => r.status === "NEGOTIATING").length
  const myBidCount = Object.keys(myBids).length

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-paper/90 px-3 py-3 backdrop-blur">
        <button onClick={onExit} aria-label="Back" className="grid size-9 place-items-center rounded-xl text-ink/70 transition hover:bg-muted">
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-display text-[15px] font-700 tracking-tight text-ink">{profile.businessName}</h1>
            {profile.verified && <BadgeCheck className="size-4 shrink-0 text-live" />}
          </div>
          <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            <MapPin className="size-3" /> {profile.location} · <span className="flex items-center gap-0.5 text-amber"><Star className="size-2.5 fill-amber" />{profile.rating.toFixed(1)}</span>
          </p>
        </div>
        <button
          onClick={openPricing}
          aria-label="How PartPulse makes money"
          className="grid size-9 place-items-center rounded-xl text-signal transition hover:bg-muted"
        >
          <BadgeCheck className="size-[18px]" />
        </button>
        <span className="inline-flex items-center gap-1 rounded-full bg-live/12 px-2 py-0.5 text-[11px] font-semibold text-live">
          <span className="relative inline-block size-1.5 rounded-full bg-live live-dot" />
          Live
        </span>
      </header>

      {tab === "requests" ? (
      <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {/* Pro upsell */}
        <div className="msg-in rounded-2xl border border-signal/30 bg-signal/8 p-3.5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-signal text-white shadow-md shadow-signal/25">
              <Zap className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-ink">Upgrade to Pro · AED {PRO_PRICE}/mo</p>
              <p className="text-[11.5px] leading-snug text-muted-foreground">
                Unlimited RFQs, priority feed placement & win-rate analytics.
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={upgradeToPro}
              className="flex-1 rounded-xl bg-signal px-3 py-2 text-[12.5px] font-bold text-white shadow-md shadow-signal/25 transition hover:opacity-90"
            >
              Upgrade now
            </button>
            <button
              onClick={openPricing}
              className="rounded-xl border border-ink/15 bg-paper px-3 py-2 text-[12.5px] font-semibold text-ink transition hover:border-ink/30"
            >
              How pricing works
            </button>
          </div>
          {upgradeNote && (
            <p className="mt-2 text-[11px] font-semibold text-signal">{upgradeNote}</p>
          )}
        </div>

        {/* Earnings */}
        <div className="msg-in rounded-2xl border border-border bg-card p-3.5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <Wallet className="size-3.5 text-signal" /> Earnings
            </p>
            <span className="text-[10px] font-medium text-muted-foreground">{payouts.count} deal(s)</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-display text-[24px] leading-none font-700 tracking-tight text-ink">
              AED {formatAED(payouts.total)}
            </span>
            <span className="text-[12px] font-medium text-muted-foreground">payout</span>
          </div>
          {payouts.pending > 0 && (
            <p className="mt-1 text-[11px] font-semibold text-amber">
              {formatAED(payouts.pending)} pending settlement
            </p>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">Net of the 7% marketplace fee</p>
        </div>

        {/* Verification */}
        {profile.verification === "unverified" && (
          <div className="msg-in rounded-2xl border border-amber/30 bg-amber/8 p-3.5">
            <div className="flex items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber text-white shadow-md shadow-amber/25">
                <Shield className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-ink">Get verified</p>
                <p className="text-[11.5px] leading-snug text-muted-foreground">
                  Upload your trade license to win more buyer trust and unlock a green badge.
                </p>
              </div>
            </div>
            <button
              onClick={() => setLicenseOpen(true)}
              className="mt-3 w-full rounded-xl bg-amber px-3 py-2.5 text-[12.5px] font-bold text-white shadow-md shadow-amber/25 transition hover:opacity-90"
            >
              Upload trade license
            </button>
          </div>
        )}
        {profile.verification === "pending" && (
          <div className="msg-in flex items-center gap-3 rounded-2xl border border-amber/30 bg-amber/8 p-3.5">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber/20 text-amber">
              <ShieldCheck className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-ink">Verification pending</p>
              <p className="text-[11.5px] leading-snug text-muted-foreground">
                Our team is reviewing your trade license — usually within 24 hours.
              </p>
            </div>
          </div>
        )}
        {profile.verification === "verified" && (
          <div className="msg-in flex items-center gap-3 rounded-2xl border border-live/30 bg-live/8 p-3.5">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-live text-white shadow-md shadow-live/25">
              <ShieldCheck className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-ink">Verified supplier</p>
              <p className="text-[11.5px] leading-snug text-muted-foreground">
                Your green badge is shown to buyers on every one of your bids.
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Live RFQs" value={String(open)} tone="text-ink" />
          <Stat label="In negotiation" value={String(negotiating)} tone="text-signal" />
          <Stat label="My bids" value={String(myBidCount)} tone="text-live" />
        </div>

        {/* Brands */}
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Your specialities</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.brands.map((b) => (
              <span key={b} className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-ink/80">
                {b}
              </span>
            ))}
          </div>
        </div>

        {/* Live feed */}
        <div className="flex items-center gap-2 pt-1">
          <p className="font-display text-[15px] font-700 tracking-tight text-ink">Inbound requests</p>
          <span className="relative inline-block size-2 rounded-full bg-live live-dot" />
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={feedQuery}
            onChange={(e) => setFeedQuery(e.target.value)}
            placeholder="Search parts, brands or vehicles…"
            className="w-full rounded-xl border border-border bg-card py-2.5 pr-3 pl-9 text-[13px] text-ink placeholder:text-muted-foreground focus:border-signal focus:outline-none"
          />
          {feedQuery && (
            <button
              onClick={() => setFeedQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-3 grid size-5 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition hover:bg-muted"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {(() => {
          const q = feedQuery.trim().toLowerCase()
          const filtered = q
            ? rfqs.filter((r) =>
                [r.part.name, r.part.category, r.rawInputText, r.vehicle.make, r.vehicle.model]
                  .filter(Boolean)
                  .some((t) => t.toLowerCase().includes(q)),
              )
            : rfqs

          if (filtered.length === 0) {
            return (
              <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
                <p className="text-[13px] font-semibold text-ink">No matches for "{feedQuery}"</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {rfqs.length === 0 ? "You'll see live RFQs here as buyers post them." : "Try a different part, brand or vehicle."}
                </p>
              </div>
            )
          }

          return (
            <div className="space-y-3">
              {filtered.map((r) => (
                <RfqCard
                  key={r.id}
                  r={r}
                  isPro={profile.plan !== "FREE"}
                  onUpgrade={upgradeToPro}
                  myBid={myBids[r.id]}
                  query={q}
                  onRespond={() => setRespondRfq(r)}
                />
              ))}
            </div>
          )
        })()}
      </div>
      ) : (
      <div className="no-scrollbar flex-1 overflow-y-auto px-3 py-4">
        <StockTab profile={profile} onUpgrade={upgradeToPro} />
      </div>
      )}

      {/* Bottom nav */}
      <nav className="flex border-t border-border bg-paper px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]">
        {(
          [
            { key: "requests", label: "Requests", icon: Inbox },
            { key: "stock", label: "Stock AI", icon: Package },
          ] as const
        ).map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                "flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 transition " +
                (active ? "text-signal" : "text-muted-foreground")
              }
            >
              <t.icon className={"size-5 " + (active ? "text-signal" : "")} />
              <span className={"text-[10.5px] font-semibold " + (active ? "text-signal" : "text-muted-foreground")}>
                {t.label}
              </span>
              {t.key === "stock" && profile.plan === "FREE" && (
                <span className="-mt-0.5 inline-flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wide text-amber">
                  <Lock className="size-2.5" /> Pro
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <RespondSheet
        rfq={respondRfq}
        supplier={profile}
        onClose={() => setRespondRfq(null)}
        onSend={sendBid}
      />

      {licenseOpen && (
        <LicenseSheet
          onClose={() => setLicenseOpen(false)}
          value={licenseNo}
          setValue={setLicenseNo}
          onSubmit={submitLicense}
        />
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <p className={"font-display text-[22px] leading-none font-700 " + tone}>{value}</p>
      <p className="mt-1 text-[10.5px] font-medium text-muted-foreground">{label}</p>
    </div>
  )
}

function Hi({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-signal/20 px-0.5 text-signal">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

function RfqCard({
  r,
  myBid,
  isPro,
  onUpgrade,
  onRespond,
  query,
}: {
  r: RFQ
  myBid?: { price: number; brand: string; boosted?: boolean }
  isPro: boolean
  onUpgrade: () => void
  onRespond: () => void
  query?: string
}) {
  const q = query?.trim() ?? ""
  const isOpen = r.status === "OPEN"
  const statusTone = r.status === "OPEN" ? "bg-signal/12 text-signal" : r.status === "NEGOTIATING" ? "bg-amber/12 text-amber" : "bg-muted text-muted-foreground"
  const hasDetails = r.details && (r.details.vin || r.details.reference || r.details.quantity || r.details.condition || r.details.location || r.details.preferredBrand)
  return (
    <div className="msg-in rounded-2xl border border-border bg-card p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-bold text-ink"><Hi text={r.part.name} q={q} /></p>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-ink/60"><Hi text={r.part.category} q={q} /></span>
          </div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            <Hi text={`${r.vehicle.make} ${r.vehicle.model}`} q={q} /> · {r.vehicle.year} · {r.vehicle.engine}
          </p>
        </div>
        <span className={"shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold " + statusTone}>
          {r.status}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-[12px] text-muted-foreground">
          <p className="font-medium">Buyer: {r.buyerName}</p>
          <p className="mt-0.5 flex items-center gap-1">
            <Clock className="size-3" /> {timeAgo(r.createdAt)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-[16px] font-700 text-ink">
            AED {formatAED(r.budget.min)}–{formatAED(r.budget.max)}
          </p>
          {myBid && (
            <p className="flex items-center justify-end gap-1 text-[11px] font-semibold text-live">
              My bid: {myBid.brand} · AED {formatAED(myBid.price)}
              {myBid.boosted && (
                <span className="rounded bg-amber/15 px-1.5 py-0.5 text-[9px] font-bold text-amber">BOOSTED</span>
              )}
            </p>
          )}
        </div>
      </div>

      {hasDetails && (
        <div className="mt-3">
          {isPro ? (
            <div className="rounded-xl border border-border bg-paper p-2.5">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Part specs
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px] text-ink/80">
                {r.details!.reference && (
                  <p><span className="text-muted-foreground">Ref:</span> <span className="font-semibold">{r.details!.reference}</span></p>
                )}
                {r.details!.quantity && (
                  <p><span className="text-muted-foreground">Qty:</span> <span className="font-semibold">{r.details!.quantity}</span></p>
                )}
                {r.details!.condition && (
                  <p><span className="text-muted-foreground">Condition:</span> <span className="font-semibold">{r.details!.condition}</span></p>
                )}
                {r.details!.location && (
                  <p><span className="text-muted-foreground">Deliver to:</span> <span className="font-semibold">{r.details!.location}</span></p>
                )}
                {r.details!.vin && (
                  <p className="col-span-2 truncate"><span className="text-muted-foreground">VIN:</span> <span className="font-mono font-semibold">{r.details!.vin}</span></p>
                )}
                {r.details!.preferredBrand && (
                  <p><span className="text-muted-foreground">Pref. brand:</span> <span className="font-semibold">{r.details!.preferredBrand}</span></p>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={onUpgrade}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-amber/40 bg-amber/6 px-3 py-2 text-left transition hover:border-amber/60 hover:bg-amber/10"
            >
              <Lock className="size-3.5 shrink-0 text-amber" />
              <span className="flex-1">
                <span className="block text-[11.5px] font-semibold text-ink">Full part specs (VIN &amp; reference) are Pro</span>
                <span className="block text-[10.5px] text-muted-foreground">Tap to unlock exact matching</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-amber" />
            </button>
          )}
        </div>
      )}

      {isOpen && (
        <button
          onClick={onRespond}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-md shadow-primary/15 transition hover:opacity-90"
        >
          <Zap className="size-4" />
          Place a bid
          <ChevronRight className="size-4" />
        </button>
      )}
      {!isOpen && myBid && (
        <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-live/12 px-3 py-2 text-[12px] font-bold text-live">
          <Check className="size-4" /> Bid submitted
        </div>
      )}
    </div>
  )
}

/* ---------------- Bottom sheet ---------------- */
function RespondSheet({
  rfq,
  supplier,
  onClose,
  onSend,
}: {
  rfq: RFQ | null
  supplier: SupplierProfile
  onClose: () => void
  onSend: (price: number, brand: string, boosted: boolean) => void
}) {
  const [amount, setAmount] = useState("")
  const [brand, setBrand] = useState(supplier.brands[0] ?? "OEM")
  const [boosted, setBoosted] = useState(false)

  if (!rfq) return null

  const mid = Math.round(((rfq.budget.min + rfq.budget.max) / 2) / 5) * 5
  const presets = [
    { brand: supplier.brands[0] ?? "OEM", price: Math.round(rfq.budget.min / 5) * 5 },
    { brand: supplier.brands[1] ?? supplier.brands[0] ?? "OEM", price: mid },
    { brand: supplier.brands[2] ?? supplier.brands[0] ?? "OEM", price: Math.round(rfq.budget.max / 5) * 5 },
  ]
  const number = Number(amount)

  const press = (d: string) => setAmount((a) => (a + d).slice(0, 6))

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" />
      <div className="sheet-up relative max-h-[86%] overflow-y-auto rounded-t-3xl bg-card px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="font-display text-[16px] font-700 tracking-tight text-ink">Place a bid</h2>
            <p className="text-[12px] text-muted-foreground">
              {rfq.part.name} · {rfq.vehicle.make} {rfq.vehicle.model} · budget ≤ AED {formatAED(rfq.budget.max)}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg text-ink/60 transition hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        {/* Brand select */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {supplier.brands.map((b) => (
            <button
              key={b}
              onClick={() => setBrand(b)}
              className={
                "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition " +
                (brand === b ? "border-ink bg-ink text-white" : "border-border bg-paper text-ink/70 hover:bg-muted")
              }
            >
              {b}
            </button>
          ))}
        </div>

        {/* Presets */}
        <div className="mb-3 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">1-tap presets</p>
          {presets.map((p, i) => (
            <button
              key={p.brand + i}
              onClick={() => setAmount(String(p.price))}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-paper px-3.5 py-2.5 text-left transition hover:border-signal/50 hover:bg-muted"
            >
              <span className="text-[13px] font-semibold text-ink">{p.brand}</span>
              <span className="font-display text-[15px] font-700 text-ink">AED {formatAED(p.price)}</span>
            </button>
          ))}
        </div>

        {/* Custom numpad */}
        <div className="rounded-xl border border-border bg-paper p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Custom price</p>
            <span className="text-[11px] text-muted-foreground">{brand}</span>
          </div>
          <div className="mb-3 flex h-12 items-center justify-center rounded-lg bg-muted font-display text-[26px] font-700 tracking-tight text-ink">
            <span className="mr-1 text-base text-muted-foreground">AED</span>
            {amount || "—"}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                onClick={() => press(d)}
                className="h-12 rounded-xl bg-card text-[17px] font-semibold text-ink shadow-sm transition active:scale-95 hover:bg-muted"
              >
                {d}
              </button>
            ))}
            <button
              onClick={() => setAmount("")}
              className="h-12 rounded-xl bg-card text-[12px] font-bold text-muted-foreground shadow-sm transition active:scale-95 hover:bg-muted"
            >
              CLEAR
            </button>
            <button
              onClick={() => press("0")}
              className="h-12 rounded-xl bg-card text-[17px] font-semibold text-ink shadow-sm transition active:scale-95 hover:bg-muted"
            >
              0
            </button>
            <button
              onClick={() => setAmount((a) => a.slice(0, -1))}
              aria-label="Delete"
              className="h-12 rounded-xl bg-card text-ink/70 shadow-sm transition active:scale-95 hover:bg-muted"
            >
              ⌫
            </button>
          </div>
        </div>

        {/* Boost */}
        <button
          onClick={() => setBoosted((b) => !b)}
          className={
            "mt-3 flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 transition " +
            (boosted ? "border-signal/50 bg-signal/6" : "border-border bg-paper hover:bg-muted")
          }
        >
          <div className="flex items-center gap-2">
            <span className={"grid size-6 place-items-center rounded-md border " + (boosted ? "border-signal bg-signal text-white" : "border-border bg-card")}>
              {boosted && <Check className="size-4" />}
            </span>
            <span className="text-left">
              <span className="block text-[13px] font-semibold text-ink">Boost this bid</span>
              <span className="block text-[11px] text-muted-foreground">Pin first in the buyer's feed</span>
            </span>
          </div>
          <span className="font-display text-[13px] font-700 text-signal">+ AED {BOOST_FEE}</span>
        </button>

        <button
          onClick={() => onSend(number, brand, boosted)}
          disabled={!number}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-signal px-4 py-3 text-[14px] font-bold text-white shadow-lg shadow-signal/30 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="size-4" />
          Send bid · AED {number ? formatAED(number) : "—"}
        </button>
      </div>
    </div>
  )
}

function LicenseSheet({
  onClose,
  value,
  setValue,
  onSubmit,
}: {
  onClose: () => void
  value: string
  setValue: (v: string) => void
  onSubmit: () => void
}) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" />
      <div className="sheet-up relative rounded-t-3xl bg-card px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

        <div className="mb-1 flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-amber/15 text-amber">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-[16px] font-700 tracking-tight text-ink">Verify your business</h2>
            <p className="text-[12px] text-muted-foreground">Trade license required for the green badge</p>
          </div>
        </div>

        <div className="mt-3 rounded-xl border-2 border-dashed border-border bg-paper p-5 text-center">
          <Camera className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-2 text-[13px] font-semibold text-ink">Trade license / business registration</p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">Photo or PDF · PNG / JPG accepted</p>
          <button className="mt-3 w-full rounded-xl border border-ink/15 bg-card px-3 py-2.5 text-[12.5px] font-semibold text-ink transition hover:border-ink/30">
            Choose file
          </button>
        </div>

        <label className="mt-3 block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">License number</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. TR-881234"
            className="mt-1.5 w-full rounded-xl border border-border bg-paper px-3.5 py-3 text-[14px] text-ink placeholder:text-muted-foreground focus:border-signal focus:outline-none"
          />
        </label>

        <button
          onClick={onSubmit}
          disabled={!value.trim()}
          className="mt-3 w-full rounded-xl bg-amber px-4 py-3 text-[14px] font-bold text-white shadow-lg shadow-amber/25 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Submit for verification
        </button>
        <p className="mt-2 px-1 text-center text-[11px] text-muted-foreground">
          Our team reviews documents within 24 hours.
        </p>
      </div>
    </div>
  )
}
