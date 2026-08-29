import { useMemo, useRef, useState } from "react"
import {
  Archive,
  Bot,
  Box,
  Check,
  Lock,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react"

import { formatAED } from "#/lib/store.tsx"
import type { SupplierProfile } from "#/lib/store.tsx"

export interface StockItem {
  id: string
  part: string
  ref: string
  category: string
  brand: string
  qty: number
  price: number
  condition: string
  location: string
  placement: string
}

let sc = 0
const sid = () => `stock_${Date.now()}_${sc++}`

const SEED_STOCK: StockItem[] = [
  { id: "k1", part: "Brake Pads", ref: "0 004 892 199", category: "Braking", brand: "Bosch", qty: 24, price: 150, condition: "New · OEM", location: "Dubai", placement: "A-12-3" },
  { id: "k2", part: "Alternator", ref: "104210-3540", category: "Electrical", brand: "Denso", qty: 8, price: 480, condition: "New · OEM", location: "Dubai", placement: "B-05-1" },
  { id: "k3", part: "Spark Plugs", ref: "ILTR6E11", category: "Ignition", brand: "NGK", qty: 60, price: 95, condition: "New · OEM", location: "Sharjah", placement: "A-08-2" },
  { id: "k4", part: "Air Filter", ref: "C 31 003/1", category: "Engine", brand: "Mann", qty: 30, price: 65, condition: "New · Aftermarket", location: "Abu Dhabi", placement: "C-02-4" },
  { id: "k5", part: "Shock Absorbers", ref: "34121713920", category: "Suspension", brand: "KYB", qty: 12, price: 260, condition: "New · OEM", location: "Dubai", placement: "B-11-2" },
]

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className={"relative h-6 w-11 shrink-0 rounded-full transition " + (on ? "bg-live" : "bg-border")}
    >
      <span
        className={
          "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all " +
          (on ? "left-[22px]" : "left-0.5")
        }
      />
    </button>
  )
}

export function StockTab({
  profile,
  onUpgrade,
}: {
  profile: SupplierProfile
  onUpgrade: () => void
}) {
  const [items, setItems] = useState<StockItem[]>(SEED_STOCK)
  const [query, setQuery] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [importState, setImportState] = useState<"idle" | "processing" | "done">("idle")
  const [importStep, setImportStep] = useState(0)
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null)
  const csvRef = useRef<HTMLInputElement>(null)
  const [config, setConfig] = useState({
    autoQuote: true,
    margin: 15,
    autoDecline: true,
    maxDistance: 50,
    verifiedOnly: true,
    dailyCap: 20,
    autoBoost: false,
    lowStockAlerts: true,
    restockAt: 10,
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => (i.part + " " + i.brand + " " + i.category + " " + i.ref + " " + i.placement).toLowerCase().includes(q))
  }, [items, query])

  const isPro = profile.plan !== "FREE"

  function handleCsvFile(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || "")
      setImportState("processing")
      setImportStep(0)
      setTimeout(() => setImportStep(1), 500)
      setTimeout(() => setImportStep(2), 1150)
      setTimeout(() => {
        const res = processCsv(text)
        if (res.added.length) {
          setItems((prev) => [...res.added.map((i) => ({ ...i, id: sid() })), ...prev])
        }
        setImportStep(3)
        setImportResult({ added: res.added.length, skipped: res.skipped })
        setImportState("done")
        setTimeout(() => {
          setImportState("idle")
          setImportResult(null)
        }, 6000)
      }, 1800)
    }
    reader.readAsText(file)
    if (csvRef.current) csvRef.current.value = ""
  }

  if (!isPro) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-ink/10 bg-card p-5 text-center">
        <div className="pointer-events-none absolute inset-0 select-none" aria-hidden>
          <div className="absolute -left-4 -top-6 rotate-[-8deg] space-y-3 opacity-[0.12]">
            {[120, 140, 110, 150, 130].map((w, i) => (
              <div key={i} className="h-4 rounded bg-ink" style={{ width: w }} />
            ))}
          </div>
          <div className="absolute -right-4 -bottom-6 rotate-[8deg] space-y-3 opacity-[0.12]">
            {[130, 100, 150, 120].map((w, i) => (
              <div key={i} className="h-4 rounded bg-ink" style={{ width: w }} />
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-signal/12 text-signal">
            <Bot className="size-7" />
          </div>
          <h2 className="font-display text-[17px] font-700 tracking-tight text-ink">AI Stock Manager</h2>
          <p className="mx-auto mt-1 max-w-[260px] text-[12.5px] leading-relaxed text-muted-foreground">
            Upload your stock once and let the AI quote matching requests, track inventory and close deals — all
            automatically.
          </p>

          <div className="mt-4 space-y-2 text-left">
            {[
              "Automated quotes for matching requests",
              "Live stock & inventory tracking",
              "Instant search across your catalogue",
              "Fully configurable rules",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-[12px] font-medium text-ink/75">
                <Check className="size-3.5 shrink-0 text-live" /> {f}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-signal/8 px-3 py-2 text-[11.5px] font-semibold text-signal">
            <Lock className="size-3.5" /> Pro &amp; Enterprise feature
          </div>

          <button
            onClick={onUpgrade}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-signal px-4 py-3 text-[14px] font-bold text-white shadow-lg shadow-signal/25 transition hover:opacity-90"
          >
            <Zap className="size-4" />
            Upgrade to unlock stock AI
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* AI assistant intro */}
      <div className="msg-in rounded-2xl border border-signal/25 bg-gradient-to-br from-signal/12 to-primary/6 p-3.5">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-signal text-white shadow-md shadow-signal/25">
            <Bot className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-ink">AI Stock Assistant</p>
            <p className="text-[11.5px] leading-snug text-muted-foreground">
              Your stock is live. Matching requests are quoted automatically within your rules.
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-live/12 px-2 py-0.5 text-[10px] font-bold text-live">
            <span className="relative inline-block size-1.5 rounded-full bg-live live-dot" /> ON
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-paper/70 px-3 py-2">
            <p className="font-display text-[20px] leading-none font-700 text-ink">{items.reduce((s, i) => s + i.qty, 0)}</p>
            <p className="mt-0.5 text-[10.5px] font-medium text-muted-foreground">Units in stock</p>
          </div>
          <div className="rounded-xl bg-paper/70 px-3 py-2">
            <p className="font-display text-[20px] leading-none font-700 text-live">{config.autoQuote ? "Auto" : "Manual"}</p>
            <p className="mt-0.5 text-[10.5px] font-medium text-muted-foreground">Quoting mode</p>
          </div>
        </div>
      </div>

      {/* Config */}
      <div className="msg-in rounded-2xl border border-border bg-card p-3.5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-signal" />
          <p className="text-[13px] font-bold text-ink">Automation rules</p>
        </div>

        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12.5px] font-semibold text-ink">Auto-quote matching requests</p>
              <p className="text-[11px] text-muted-foreground">AI prices and sends a bid when stock matches</p>
            </div>
            <Toggle on={config.autoQuote} onChange={(v) => setConfig((c) => ({ ...c, autoQuote: v }))} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12.5px] font-semibold text-ink">Auto-decline below margin</p>
              <p className="text-[11px] text-muted-foreground">Skip quotes that don't hit your minimum margin</p>
            </div>
            <Toggle on={config.autoDecline} onChange={(v) => setConfig((c) => ({ ...c, autoDecline: v }))} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12.5px] font-semibold text-ink">Verified buyers only</p>
              <p className="text-[11px] text-muted-foreground">Only quote requests from verified buyers</p>
            </div>
            <Toggle on={config.verifiedOnly} onChange={(v) => setConfig((c) => ({ ...c, verifiedOnly: v }))} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12.5px] font-semibold text-ink">Auto-boost top bid</p>
              <p className="text-[11px] text-muted-foreground">Pin your best quote first (+ AED 20)</p>
            </div>
            <Toggle on={config.autoBoost} onChange={(v) => setConfig((c) => ({ ...c, autoBoost: v }))} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12.5px] font-semibold text-ink">Low-stock alerts</p>
              <p className="text-[11px] text-muted-foreground">Warn me before an item runs out</p>
            </div>
            <Toggle on={config.lowStockAlerts} onChange={(v) => setConfig((c) => ({ ...c, lowStockAlerts: v }))} />
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-semibold text-ink">Target margin</p>
            <span className="rounded-md bg-signal/12 px-2 py-0.5 font-display text-[13px] font-700 text-signal">
              {config.margin}%
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={40}
            value={config.margin}
            onChange={(e) => setConfig((c) => ({ ...c, margin: Number(e.target.value) }))}
            className="mt-2 w-full accent-signal"
          />
          <p className="mt-1 text-[10.5px] text-muted-foreground">
            The AI quotes at this margin above your cost, within the buyer's budget.
          </p>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-semibold text-ink">Max delivery distance</p>
            <span className="rounded-md bg-signal/12 px-2 py-0.5 font-display text-[13px] font-700 text-signal">
              {config.maxDistance} km
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={150}
            step={5}
            value={config.maxDistance}
            onChange={(e) => setConfig((c) => ({ ...c, maxDistance: Number(e.target.value) }))}
            className="mt-2 w-full accent-signal"
          />
          <p className="mt-1 text-[10.5px] text-muted-foreground">
            Only auto-quote buyers within this distance of your location.
          </p>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-semibold text-ink">Daily auto-quote cap</p>
            <span className="rounded-md bg-signal/12 px-2 py-0.5 font-display text-[13px] font-700 text-signal">
              {config.dailyCap}
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={config.dailyCap}
            onChange={(e) => setConfig((c) => ({ ...c, dailyCap: Number(e.target.value) }))}
            className="mt-2 w-full accent-signal"
          />
          <p className="mt-1 text-[10.5px] text-muted-foreground">
            Stop auto-quoting once you hit your daily limit to protect your capacity.
          </p>
        </div>

        {config.lowStockAlerts && (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] font-semibold text-ink">Restock alert threshold</p>
              <span className="rounded-md bg-signal/12 px-2 py-0.5 font-display text-[13px] font-700 text-signal">
                ≤ {config.restockAt} units
              </span>
            </div>
            <input
              type="range"
              min={2}
              max={30}
              value={config.restockAt}
              onChange={(e) => setConfig((c) => ({ ...c, restockAt: Number(e.target.value) }))}
              className="mt-2 w-full accent-signal"
            />
            <p className="mt-1 text-[10.5px] text-muted-foreground">
              Alert you when any item's quantity drops to this level.
            </p>
          </div>
        )}
      </div>

      {/* CSV import */}
      <input
        ref={csvRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => handleCsvFile(e.target.files?.[0])}
      />

      {importState === "processing" && (
        <div className="msg-in rounded-2xl border border-signal/25 bg-signal/6 p-3.5">
          <div className="flex items-center gap-2 text-[12.5px] font-bold text-ink">
            <Bot className="size-4 text-signal" />
            AI is importing your stock
          </div>
          <div className="mt-2 space-y-1.5">
            {IMPORT_STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2 text-[12px]">
                <span
                  className={
                    "grid size-4 shrink-0 place-items-center rounded-full " +
                    (i < importStep ? "bg-live text-white" : i === importStep ? "bg-signal/20 text-signal" : "bg-muted text-muted-foreground")
                  }
                >
                  {i < importStep ? (
                    <Check className="size-3" />
                  ) : i === importStep ? (
                    <Bot className="size-2.5 animate-pulse" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-current" />
                  )}
                </span>
                <span className={i <= importStep ? "text-ink/80" : "text-muted-foreground"}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {importState === "done" && importResult && (
        <div className="msg-in flex items-center gap-3 rounded-2xl border border-live/30 bg-live/8 p-3.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-live text-white">
            <Check className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-ink">
              {importResult.added} item{importResult.added === 1 ? "" : "s"} added to stock
            </p>
            <p className="text-[11.5px] text-muted-foreground">
              AI auto-filled categories, conditions and placements.
              {importResult.skipped > 0 && ` Skipped ${importResult.skipped} row${importResult.skipped === 1 ? "" : "s"} (missing part or cost).`}
            </p>
          </div>
        </div>
      )}

      {/* Add + search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your stock…"
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-3 text-[13px] text-ink placeholder:text-muted-foreground focus:border-signal focus:outline-none"
          />
        </div>
        <button
          onClick={() => csvRef.current?.click()}
          aria-label="Import stock from CSV"
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-graphite text-white shadow-md transition hover:opacity-90"
        >
          <Upload className="size-5" />
        </button>
        <button
          onClick={() => setAddOpen(true)}
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-live text-white shadow-md shadow-live/25 transition hover:opacity-90"
          aria-label="Add stock item"
        >
          <Plus className="size-5" />
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
          <Archive className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-[13px] font-semibold text-ink">No stock matches</p>
          <p className="text-[12px] text-muted-foreground">Try a different search or add a new item.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((i) => (
            <div key={i.id} className="msg-in flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-graphite text-white">
                <Box className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-ink">
                  {i.part} <span className="font-medium text-muted-foreground">· {i.brand}</span>
                </p>
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[9.5px] font-bold text-ink/60">{i.category}</span>
                  {i.condition}
                </p>
                <p className="mt-0.5 flex items-center gap-2 text-[10.5px] text-muted-foreground">
                  <span className="font-mono text-ink/70">{i.ref}</span>
                  <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-px font-semibold text-primary">
                    <MapPin className="size-2.5" /> {i.placement}
                  </span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-display text-[15px] leading-none font-700 text-ink">AED {formatAED(i.price)}</p>
                <p className="mt-0.5 text-[10.5px] font-medium text-muted-foreground">
                  x{i.qty} · {i.location}
                </p>
              </div>
              <button
                onClick={() => setItems((prev) => prev.filter((x) => x.id !== i.id))}
                aria-label="Remove item"
                className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-ink"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <AddStockSheet
          onClose={() => setAddOpen(false)}
          onAdd={(item) => {
            setItems((prev) => [{ ...item, id: sid() }, ...prev])
            setAddOpen(false)
          }}
        />
      )}
    </div>
  )
}

const CONDITIONS = ["New · OEM", "New · Aftermarket", "Genuine", "Used / Refurbished"]

const IMPORT_STEPS = [
  "Reading your CSV file",
  "Detecting columns · Part, Brand, Qty, Cost…",
  "Mapping & cleaning your data",
  "Adding stock — you're all set",
]

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let cur = ""
  let inQuotes = false
  let row: string[] = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i++
        } else inQuotes = false
      } else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ",") {
      row.push(cur)
      cur = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++
      row.push(cur)
      cur = ""
      if (row.some((c) => c.trim())) rows.push(row)
      row = []
    } else cur += ch
  }
  row.push(cur)
  if (row.some((c) => c.trim())) rows.push(row)
  return rows
}

type CsvField = "part" | "brand" | "ref" | "category" | "qty" | "price" | "condition" | "location" | "placement"

function mapHeader(h: string): CsvField | null {
  const n = h.toLowerCase().replace(/[^a-z]/g, "")
  if ((n.includes("part") && n.includes("name")) || n === "part" || n === "item" || n === "product" || n === "description") return "part"
  if (n === "brand" || n === "manufacturer" || n === "make" || n === "oem") return "brand"
  if (n.includes("ref") || n === "partno" || n === "skunumber" || n === "sku") return "ref"
  if (n.includes("cat") || n === "type" || n === "group") return "category"
  if (n.includes("qty") || n.includes("quantity") || n === "stock" || n === "units") return "qty"
  if (n.includes("price") || n.includes("cost") || n === "rate") return "price"
  if (n === "condition" || n.includes("cond")) return "condition"
  if (n === "location" || n === "city" || n.includes("warehouse")) return "location"
  if (n.includes("placement") || n.includes("bin") || n.includes("rack") || n.includes("aisle")) return "placement"
  return null
}

function inferCategory(part: string): string {
  const p = part.toLowerCase()
  if (/brake|pad|rotor|disc|caliper|drum/.test(p)) return "Braking"
  if (/alternator|battery|starter|wiring|sensor|ignition|coil|plug|light/.test(p)) return "Electrical"
  if (/spark|plug|coil/.test(p)) return "Ignition"
  if (/filter|belt|gasket|pump|radiator|hose|valve|seal/.test(p)) return "Engine"
  if (/shock|strut|spring|suspension|arm|bushing|mount/.test(p)) return "Suspension"
  if (/clutch|transmission|gear|flywheel|differential/.test(p)) return "Transmission"
  if (/cooler|thermostat|fan|radiator/.test(p)) return "Cooling"
  return "Other"
}

function processCsv(text: string): { added: Omit<StockItem, "id">[]; skipped: number } {
  const rows = parseCSV(text)
  if (rows.length === 0) return { added: [], skipped: 0 }
  const headers = rows[0].map((h) => h.trim())
  const colIndex: Partial<Record<CsvField, number>> = {}
  headers.forEach((h, i) => {
    const f = mapHeader(h)
    if (f && colIndex[f] === undefined) colIndex[f] = i
  })
  const pick = (row: string[], f: CsvField) => (colIndex[f] !== undefined ? (row[colIndex[f]!] ?? "").trim() : "")

  const added: Omit<StockItem, "id">[] = []
  let skipped = 0
  rows.slice(1).forEach((row, i) => {
    const part = pick(row, "part")
    const priceRaw = pick(row, "price").replace(/[^0-9.]/g, "")
    const price = Number(priceRaw)
    if (!part || !Number.isFinite(price) || price <= 0) {
      skipped++
      return
    }
    const category = pick(row, "category") || inferCategory(part)
    added.push({
      part,
      ref: pick(row, "ref"),
      brand: pick(row, "brand"),
      category,
      qty: Math.max(1, parseInt(pick(row, "qty").replace(/\D/g, ""), 10) || 1),
      price,
      condition: pick(row, "condition") || "New · OEM",
      location: pick(row, "location") || "Dubai",
      placement: pick(row, "placement") || `R${Math.floor(i / 8) + 1}-B${(i % 8) + 1}`,
    })
  })
  return { added, skipped }
}

function AddStockSheet({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (item: Omit<StockItem, "id">) => void
}) {
  const [part, setPart] = useState("")
  const [ref, setRef] = useState("")
  const [brand, setBrand] = useState("")
  const [category, setCategory] = useState("Braking")
  const [qty, setQty] = useState("1")
  const [price, setPrice] = useState("")
  const [condition, setCondition] = useState(CONDITIONS[0])
  const [location, setLocation] = useState("Dubai")
  const [placement, setPlacement] = useState("")

  const valid = part.trim() && brand.trim() && Number(price) > 0

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" />
      <div className="sheet-up relative max-h-[92%] overflow-y-auto rounded-t-3xl bg-card px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <div className="mb-1 flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-live/12 text-live">
            <Box className="size-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-[16px] font-700 tracking-tight text-ink">Add to stock</h2>
            <p className="text-[12px] text-muted-foreground">The AI will match and quote this to buyers</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-lg text-ink/60 transition hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Part</span>
            <input value={part} onChange={(e) => setPart(e.target.value)} placeholder="e.g. Brake Pads"
              className="mt-1.5 w-full rounded-xl border border-border bg-paper px-3 py-2.5 text-[14px] text-ink placeholder:text-muted-foreground focus:border-signal focus:outline-none" />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Brand</span>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Bosch"
              className="mt-1.5 w-full rounded-xl border border-border bg-paper px-3 py-2.5 text-[14px] text-ink placeholder:text-muted-foreground focus:border-signal focus:outline-none" />
          </label>
        </div>

        <label className="mt-2.5 block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Part reference (OE / OEM no.)</span>
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. 0 004 892 199"
            className="mt-1.5 w-full rounded-xl border border-border bg-paper px-3 py-2.5 text-[14px] text-ink placeholder:text-muted-foreground focus:border-signal focus:outline-none" />
        </label>

        <div className="mt-2.5 grid grid-cols-3 gap-2.5">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-paper px-2.5 py-2.5 text-[13px] text-ink focus:border-signal focus:outline-none">
              {["Braking", "Electrical", "Ignition", "Engine", "Suspension", "Cooling", "Transmission"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Qty</span>
            <input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} inputMode="numeric"
              className="mt-1.5 w-full rounded-xl border border-border bg-paper px-3 py-2.5 text-[14px] text-ink focus:border-signal focus:outline-none" />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cost</span>
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="AED"
              className="mt-1.5 w-full rounded-xl border border-border bg-paper px-3 py-2.5 text-[14px] text-ink placeholder:text-muted-foreground focus:border-signal focus:outline-none" />
          </label>
        </div>

        <label className="mt-2.5 block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Condition</span>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {CONDITIONS.map((c) => (
              <button key={c} onClick={() => setCondition(c)}
                className={"rounded-xl border px-2 py-2 text-[12px] font-semibold transition " +
                  (condition === c ? "border-signal bg-signal/12 text-signal" : "border-border bg-paper text-ink/70")}>
                {c}
              </button>
            ))}
          </div>
        </label>

        <label className="mt-2.5 block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Location</span>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Dubai"
            className="mt-1.5 w-full rounded-xl border border-border bg-paper px-3 py-2.5 text-[14px] text-ink placeholder:text-muted-foreground focus:border-signal focus:outline-none" />
        </label>

        <label className="mt-2.5 block">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Placement (rack / bin)</span>
          <input value={placement} onChange={(e) => setPlacement(e.target.value)} placeholder="e.g. A-12-3"
            className="mt-1.5 w-full rounded-xl border border-border bg-paper px-3 py-2.5 text-[14px] text-ink placeholder:text-muted-foreground focus:border-signal focus:outline-none" />
        </label>

        <button
          onClick={() => onAdd({ part: part.trim(), ref: ref.trim(), brand: brand.trim(), category, qty: Math.max(1, parseInt(qty, 10) || 1), price: Number(price), condition, location: location.trim() || "Dubai", placement: placement.trim() })}
          disabled={!valid}
          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-live px-4 py-3 text-[14px] font-bold text-white shadow-lg shadow-live/25 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="size-4" /> Add to stock
        </button>
        <p className="mt-1.5 px-1 text-center text-[10.5px] text-muted-foreground">
          Cost = what you pay · the AI quotes at your target margin within buyer budgets.
        </p>
      </div>
    </div>
  )
}
