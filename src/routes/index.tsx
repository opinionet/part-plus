import { createFileRoute } from "@tanstack/react-router"
import { useRef, useState } from "react"
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  Briefcase,
  Check,
  ChevronLeft,
  Gauge,
  Info,
  Wrench,
  X,
} from "lucide-react"

import { BuyerApp } from "#/components/BuyerApp.tsx"
import { PricingModal } from "#/components/PricingModal.tsx"
import { SupplierApp } from "#/components/SupplierApp.tsx"
import { AppProvider, useApp } from "#/lib/store.tsx"
import type { Role } from "#/lib/store.tsx"

export const Route = createFileRoute("/")({ component: App })

function App() {
  return (
    <AppProvider>
      <div className="flex min-h-dvh justify-center bg-[#e4dfd5]">
        <div className="relative flex h-dvh w-full max-w-[440px] flex-col overflow-hidden bg-background shadow-2xl">
          <div className="flex min-h-0 flex-1 flex-col">
            <Shell />
          </div>
          <PricingHost />
          <ToastHost />
        </div>
      </div>
    </AppProvider>
  )
}

function PricingHost() {
  const { pricingOpen, closePricing } = useApp()
  return pricingOpen ? <PricingModal onClose={closePricing} /> : null
}

function ToastHost() {
  const { toasts, dismissToast } = useApp()
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className="toast-in pointer-events-auto flex w-full max-w-[380px] items-center gap-2.5 rounded-2xl border border-border bg-card/95 px-3.5 py-2.5 text-left shadow-2xl backdrop-blur"
        >
          <span
            className={
              "grid size-8 shrink-0 place-items-center rounded-lg " +
              (t.tone === "success"
                ? "bg-live/15 text-live"
                : t.tone === "alert"
                  ? "bg-amber/15 text-amber"
                  : "bg-signal/15 text-signal")
            }
          >
            {t.tone === "success" ? <Check className="size-4" /> : t.tone === "alert" ? <Bell className="size-4" /> : <Info className="size-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-bold text-ink">{t.title}</span>
            {t.message && <span className="block text-[11px] leading-snug text-muted-foreground">{t.message}</span>}
          </span>
          <X className="size-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  )
}

function Shell() {
  const { screen, toRole } = useApp()
  if (screen === "buyer") return <BuyerApp onExit={() => toRole()} />
  if (screen === "supplier") return <SupplierApp onExit={() => toRole()} />
  if (screen === "otp") return <OtpScreen />
  if (screen === "role") return <RoleScreen />
  return <LoginScreen />
}

/* ------------------------------- Login ------------------------------ */
const COUNTRIES = [
  { code: "+971", flag: "🇦🇪", label: "UAE" },
  { code: "+213", flag: "🇩🇿", label: "Algeria" },
]

function LoginScreen() {
  const { toOtp } = useApp()
  const [country, setCountry] = useState(COUNTRIES[0])
  const [phone, setPhone] = useState("")
  const [showList, setShowList] = useState(false)

  const complete = phone.length >= 7

  return (
    <div className="flex h-full flex-col px-5 pb-6">
      {/* Brand */}
      <div className="flex items-center gap-2.5 pt-8">
        <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
          <Gauge className="size-6" />
        </div>
        <div>
          <h1 className="font-display text-xl font-700 tracking-tight text-ink">PartPulse</h1>
          <p className="text-[11px] text-muted-foreground">AI auto-parts procurement</p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-[22px] font-700 tracking-tight text-ink">Let's get you in</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Sign in with your phone number. No password needed.
        </p>
      </div>

      {/* Phone */}
      <div className="mt-7">
        <label className="mb-1.5 block text-[12px] font-semibold text-ink/80">Phone number</label>
        <div className="flex gap-2">
          <div className="relative">
            <button
              onClick={() => setShowList((s) => !s)}
              className="flex h-13 items-center gap-1 rounded-xl border border-border bg-card px-3 text-[14px] font-semibold text-ink transition hover:bg-muted"
            >
              <span className="text-base">{country.flag}</span>
              <span>{country.code}</span>
            </button>
            {showList && (
              <div className="absolute top-full z-20 mt-1 w-40 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl">
                {COUNTRIES.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => {
                      setCountry(c)
                      setShowList(false)
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink transition hover:bg-muted"
                  >
                    <span>{c.flag}</span>
                    <span className="font-medium">{c.label}</span>
                    <span className="ml-auto text-muted-foreground">{c.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            autoFocus
            placeholder="5X XXX XXXX"
            className="h-13 w-full flex-1 rounded-xl border border-border bg-card px-4 text-[16px] tracking-wide text-ink placeholder:text-muted-foreground/60 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
          />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">You'll receive a 6-digit code by SMS.</p>
      </div>

      <div className="mt-auto pt-8">
        <button
          onClick={() => complete && toOtp(country.code + phone)}
          disabled={!complete}
          className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-signal text-[15px] font-bold text-white shadow-lg shadow-signal/30 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

/* -------------------------------- OTP ------------------------------- */
function OtpScreen() {
  const { phone, toRole, goHome } = useApp()
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""))
  const refs = useRef<Array<HTMLInputElement | null>>([])

  const complete = digits.every((d) => d !== "")

  function handleChange(i: number, v: string) {
    const d = v.replace(/\D/g, "").slice(-1)
    const next = [...digits]
    next[i] = d
    setDigits(next)
    if (d && i < 5) refs.current[i + 1]?.focus()
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus()
  }

  return (
    <div className="flex h-full flex-col px-5 pb-6">
      <button
        onClick={goHome}
        aria-label="Back"
        className="mt-4 grid size-10 place-items-center rounded-xl text-ink/70 transition hover:bg-muted"
      >
        <ChevronLeft className="size-6" />
      </button>

      <div className="mt-6">
        <h2 className="font-display text-[22px] font-700 tracking-tight text-ink">Enter your code</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          We sent a 6-digit code to <span className="font-semibold text-ink">{phone}</span>
        </p>
      </div>

      <div className="mt-7 flex justify-between gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el
            }}
            value={d}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            inputMode="numeric"
            maxLength={1}
            className="h-14 w-full rounded-xl border border-border bg-card text-center font-display text-[20px] font-700 text-ink focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/30"
          />
        ))}
      </div>
      <p className="mt-3 text-center text-[12px] text-muted-foreground">
        Demo code: <span className="font-semibold text-ink">123456</span>
      </p>

      <div className="mt-auto pt-8">
        <button
          onClick={() => complete && toRole()}
          disabled={!complete}
          className="flex h-13 w-full items-center justify-center rounded-xl bg-signal text-[15px] font-bold text-white shadow-lg shadow-signal/30 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Verify & continue
        </button>
      </div>
    </div>
  )
}

/* ------------------------------- Role ------------------------------- */
function RoleScreen() {
  const { phone, setRole, goHome, openPricing } = useApp()

  return (
    <div className="flex h-full flex-col px-5 pb-6">
      <div className="flex items-center gap-2.5 pt-8">
        <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
          <Gauge className="size-6" />
        </div>
        <h1 className="font-display text-xl font-700 tracking-tight text-ink">PartPulse</h1>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-[22px] font-700 tracking-tight text-ink">How will you use PartPulse?</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Signed in as <span className="font-semibold text-ink">{phone}</span>. You can switch roles anytime.
        </p>
      </div>

      <div className="mt-7 space-y-3">
        <RoleCard
          icon={<Wrench className="size-6" />}
          title="I need parts"
          desc="Describe or show a part, get live bids from suppliers, negotiate in real time."
          tag="BUYER"
          tone="signal"
          onClick={() => setRole("BUYER")}
        />
        <RoleCard
          icon={<Briefcase className="size-6" />}
          title="I supply parts"
          desc="Get live inbound RFQs matched to your brands and reply with 1-tap bids."
          tag="SUPPLIER"
          tone="graphite"
          onClick={() => setRole("SUPPLIER")}
        />
      </div>

      <button
        onClick={openPricing}
        className="mt-auto flex items-center justify-center gap-1.5 pt-6 text-[13px] font-semibold text-signal transition hover:opacity-80"
      >
        <BadgeCheck className="size-4" /> How PartPulse makes money
      </button>
      <button
        onClick={goHome}
        className="flex items-center justify-center gap-1 pt-2 pb-1 text-[13px] font-semibold text-muted-foreground transition hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Use a different number
      </button>
    </div>
  )
}

function RoleCard({
  icon,
  title,
  desc,
  tag,
  tone,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  tag: Role
  tone: "signal" | "graphite"
  onClick: () => void
}) {
  const toneCls =
    tone === "signal" ? "bg-signal/12 text-signal" : "bg-graphite text-white"
  return (
    <button
      onClick={onClick}
      className="msg-in group flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-signal/40 hover:shadow-md"
    >
      <div className={`grid size-12 shrink-0 place-items-center rounded-xl ${toneCls}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[15px] font-bold text-ink">{title}</p>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-ink/60">{tag}</span>
        </div>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{desc}</p>
      </div>
      <ChevronLeft className="size-5 -rotate-90 text-muted-foreground transition group-hover:text-ink" />
    </button>
  )
}
