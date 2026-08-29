import { BadgeCheck, Check, Rocket, X, Zap } from "lucide-react"

import { formatAED } from "#/lib/store.tsx"

export const MARKET_FEE = 0.07
export const BOOST_FEE = 20
export const PRO_PRICE = 99
export const ENTERPRISE_PRICE = 499

export function feeOn(price: number) {
  return Math.round(price * MARKET_FEE)
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className={"font-display text-[14px] font-700 " + (highlight ? "text-signal" : "text-ink")}>{value}</span>
    </div>
  )
}

export function PricingModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-paper">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-paper/90 px-4 py-3 backdrop-blur">
        <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-xl text-ink/70 transition hover:bg-muted">
          <X className="size-5" />
        </button>
        <div>
          <h1 className="font-display text-[16px] font-700 tracking-tight text-ink">How PartPulse makes money</h1>
          <p className="text-[11px] text-muted-foreground">Simple, transparent marketplace economics</p>
        </div>
      </header>

      <div className="no-scrollbar flex-1 space-y-5 overflow-y-auto px-4 py-5 pb-[max(env(safe-area-inset-bottom),24px)]">
        {/* Commission */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl bg-signal/12 text-signal">
              <Zap className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-[15px] font-700 text-ink">7% on every completed deal</h2>
              <p className="text-[12px] text-muted-foreground">Our core engine</p>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-ink/80">
            When a buyer accepts a supplier's bid, a small marketplace fee is collected. The supplier is paid the
            rest. It funds live matching, AI part parsing and secure settlement.
          </p>
          <div className="mt-3 rounded-xl bg-muted px-3 py-1">
            <Row label="Bid price" value="AED 320" />
            <Row label="Marketplace fee (7%)" value={`− AED ${formatAED(feeOn(320))}`} highlight />
            <Row label="Supplier receives" value={`AED ${formatAED(320 - feeOn(320))}`} />
          </div>
        </section>

        {/* Supplier tiers */}
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 font-display text-[15px] font-700 text-ink">
            <Rocket className="size-4 text-signal" /> Supplier plans
          </h2>
          <div className="space-y-2">
            <Tier
              name="Free"
              price="0"
              per="mo"
              features={["Up to 10 RFQs / day", "Standard feed placement", "1-tap presets"]}
              highlighted={false}
            />
            <Tier
              name="Pro"
              price={String(PRO_PRICE)}
              per="mo"
              features={[
                "Unlimited RFQs",
                "Priority placement in feeds",
                "Boost up to 25 bids / month",
                "Win-rate analytics",
              ]}
              highlighted
              badge="Most popular"
            />
            <Tier
              name="Enterprise"
              price={String(ENTERPRISE_PRICE)}
              per="mo"
              features={[
                "Guaranteed monthly volume",
                "Unlimited boosted bids",
                "Dedicated account manager",
                "Multi-branch team seats",
              ]}
              highlighted={false}
            />
          </div>
        </section>

        {/* Boost */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl bg-amber/15 text-amber">
              <BadgeCheck className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-[15px] font-700 text-ink">Boosted bids</h2>
              <p className="text-[12px] text-muted-foreground">Pay per bid to win faster</p>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-ink/80">
            Suppliers can boost a bid for <span className="font-bold text-ink">AED {BOOST_FEE}</span> to pin it first
            in the buyer's live feed. Boosted bids close measurably more deals.
          </p>
        </section>

        {/* Buyer enterprise */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl bg-live/12 text-live">
              <Check className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-[15px] font-700 text-ink">Buyer enterprise</h2>
              <p className="text-[12px] text-muted-foreground">For garages & fleets sourcing at volume</p>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-ink/80">
            Teams get unlimited RFQs, priority supplier matching, consolidated invoicing and a purchasing dashboard.
          </p>
        </section>

        <p className="px-1 text-center text-[11px] leading-relaxed text-muted-foreground">
          No hidden fees. You only pay for what creates value — a completed deal or a won bid.
        </p>
      </div>
    </div>
  )
}

function Tier({
  name,
  price,
  per,
  features,
  highlighted,
  badge,
}: {
  name: string
  price: string
  per: string
  features: string[]
  highlighted: boolean
  badge?: string
}) {
  return (
    <div
      className={
        "rounded-2xl border p-4 shadow-sm " +
        (highlighted ? "border-signal/50 bg-signal/6 shadow-signal/10" : "border-border bg-card")
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-display text-[15px] font-700 text-ink">{name}</span>
          {badge && (
            <span className="rounded-full bg-signal/12 px-2 py-0.5 text-[10px] font-bold text-signal">{badge}</span>
          )}
        </div>
        <div className="text-right">
          <span className="font-display text-[20px] leading-none font-700 text-ink">
            AED {price}
            <span className="ml-0.5 text-[11px] font-600 text-muted-foreground">/{per}</span>
          </span>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-[12.5px] text-ink/80">
            <Check className={"size-3.5 shrink-0 " + (highlighted ? "text-signal" : "text-live")} />
            {f}
          </li>
        ))}
      </ul>
    </div>
  )
}
