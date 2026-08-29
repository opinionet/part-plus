/** Shared client-safe shapes for the PartPulse API layer. */

export interface ParsedPart {
  vehicle: { make: string; model: string; year: number; engine: string }
  part: { name: string; category: string }
  budget: { min: number; max: number }
  aiConfidence: number
}

export interface RfqShape {
  id: string
  buyerId: string
  buyerName: string
  rawInputText: string
  vehicle: { make: string; model: string; year: number; engine: string }
  part: { name: string; category: string }
  budget: { min: number; max: number }
  details?: {
    vin?: string | null
    reference?: string | null
    quantity?: number
    condition?: string | null
    location?: string | null
    preferredBrand?: string | null
  }
  status: string
  createdAt: number
}

export interface RfqDetailsInput {
  vin?: string
  reference?: string
  quantity?: number
  condition?: string
  location?: string
  preferredBrand?: string
}

export type CreateRfqResult = {
  parsed: ParsedPart
  id: string | null
  createdAt: number | null
}

export type PaymentResult = {
  txId: string | null
  needsKey: boolean
  status: string
  fee: number
  payout: number
  price: number
}

export type PayoutSummary = {
  total: number
  count: number
  pending: number
}
