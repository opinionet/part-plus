import "@tanstack/react-start/server-only"
import { env } from "cloudflare:workers"
import type { ParsedPart } from "./api.types"

/**
 * Real AI part parsing via the HappySeeds LLM gateway (Anthropic protocol).
 * Returns null when the gateway binding is not configured or the call fails,
 * so callers can fall back to a deterministic local parse.
 */
export async function parseWithLLM(text: string): Promise<ParsedPart | null> {
  const base = env.BTY_LLM_SERVER_BASE_URL
  const key = env.BTY_LLM_SERVER_API_KEY
  if (!base || !key) return null

  try {
    const res = await fetch(`${base}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "x-bty-business": "ReActUs",
        "x-bty-workspace": "default",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4.6",
        max_tokens: 600,
        stream: false,
        system:
          'You extract structured auto-parts RFQ data from free text. Respond with ONLY a JSON object (no markdown) matching: {"vehicle":{"make":string,"model":string,"year":number,"engine":string},"part":{"name":string,"category":string},"budget":{"min":number,"max":number},"aiConfidence":number}. Category must be one of: Braking, Electrical, Ignition, Engine, Suspension, Cooling, Transmission. Budgets are AED estimates for that part category.',
        messages: [{ role: "user", content: text }],
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { content?: Array<{ text?: string }> }
    const out = data?.content?.[0]?.text
    if (!out) return null
    const cleaned = out.replace(/```json|```/g, "").trim()
    return normalizeParsed(JSON.parse(cleaned))
  } catch {
    return null
  }
}

function toInt(v: unknown, fallback: number): number {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function toStr(v: unknown, fallback: string): string {
  const s = typeof v === "string" ? v.trim() : ""
  return s || fallback
}

export function normalizeParsed(raw: unknown): ParsedPart | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const v = (r.vehicle ?? {}) as Record<string, unknown>
  const p = (r.part ?? {}) as Record<string, unknown>
  const b = (r.budget ?? {}) as Record<string, unknown>
  const make = toStr(v.make, "Toyota")
  const model = toStr(v.model, "Camry")
  const year = toInt(v.year, 2019)
  const partName = toStr(p.name, "Brake Pads")
  const category = toStr(p.category, "Braking")
  const min = toInt(b.min, 180)
  const max = toInt(b.max, Math.max(min, 340))
  return {
    vehicle: { make, model, year, engine: toStr(v.engine, `${(Math.abs(year % 5) + 2).toFixed(1)}L`) },
    part: { name: partName, category },
    budget: { min, max: Math.max(min, max) },
    aiConfidence: Number(r.aiConfidence) || 0.9,
  }
}
