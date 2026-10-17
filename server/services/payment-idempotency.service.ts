/**
 * Fase 10 — Idempotency-Key para POST /api/payments/tickets/create
 * Mesma chave + mesmo fingerprint → retorna resposta cacheada.
 * Mesma chave + body diferente → 409 IDEMPOTENCY_KEY_REUSE.
 */

import { createHash } from "crypto"

export interface IdempotentPaymentRecord {
  key: string
  fingerprint: string
  statusCode: number
  body: unknown
  createdAt: string
  transactionId?: string
}

const store = new Map<string, IdempotentPaymentRecord>()
const MAX_ENTRIES = 2_000
const TTL_MS = 24 * 60 * 60 * 1000

function prune(now = Date.now()): void {
  if (store.size < MAX_ENTRIES) return
  const entries = Array.from(store.entries())
  for (let i = 0; i < entries.length; i++) {
    const [key, rec] = entries[i]
    if (now - new Date(rec.createdAt).getTime() > TTL_MS) store.delete(key)
  }
  if (store.size >= MAX_ENTRIES) {
    const oldest = Array.from(store.entries())
      .sort((a, b) => a[1].createdAt.localeCompare(b[1].createdAt))
      .slice(0, Math.floor(MAX_ENTRIES / 5))
    for (let i = 0; i < oldest.length; i++) {
      store.delete(oldest[i][0])
    }
  }
}

export function normalizeIdempotencyKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const key = raw.trim()
  if (!key || key.length > 128) return null
  if (!/^[A-Za-z0-9._:-]+$/.test(key)) return null
  return key
}

/** Fingerprint estável do payload de create (itens + cliente). */
export function fingerprintTicketCreatePayload(payload: {
  items: Array<{ ticketId: string; quantity: number }>
  customer: { name: string; email: string; cpf: string; phone: string }
}): string {
  const items = [...payload.items]
    .map((i) => ({ ticketId: i.ticketId, quantity: i.quantity }))
    .sort((a, b) => a.ticketId.localeCompare(b.ticketId))
  const canonical = JSON.stringify({
    items,
    customer: {
      name: payload.customer.name.trim().toLowerCase(),
      email: payload.customer.email.trim().toLowerCase(),
      cpf: payload.customer.cpf.replace(/\D/g, ""),
      phone: payload.customer.phone.replace(/\D/g, ""),
    },
  })
  return createHash("sha256").update(canonical).digest("hex")
}

export type IdempotencyLookup =
  | { kind: "miss" }
  | { kind: "hit"; record: IdempotentPaymentRecord }
  | { kind: "conflict"; record: IdempotentPaymentRecord }

export function lookupIdempotentPayment(
  key: string,
  fingerprint: string
): IdempotencyLookup {
  prune()
  const existing = store.get(key)
  if (!existing) return { kind: "miss" }
  if (existing.fingerprint !== fingerprint) {
    return { kind: "conflict", record: existing }
  }
  return { kind: "hit", record: existing }
}

export function storeIdempotentPayment(
  key: string,
  fingerprint: string,
  statusCode: number,
  body: unknown,
  transactionId?: string
): IdempotentPaymentRecord {
  prune()
  const record: IdempotentPaymentRecord = {
    key,
    fingerprint,
    statusCode,
    body,
    createdAt: new Date().toISOString(),
    transactionId,
  }
  store.set(key, record)
  return record
}

/** Apenas testes. */
export function __resetPaymentIdempotencyForTests(): void {
  store.clear()
}
