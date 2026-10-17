/**
 * Idempotência de webhooks (Fase 9) — evita reprocessar o mesmo evento.
 * Chave: eventId do gateway OU fingerprint transactionId:status.
 */

export interface WebhookClaimResult {
  isNew: boolean
  key: string
  firstSeenAt: string
}

const processed = new Map<string, string>()
const MAX_ENTRIES = 5_000
const TTL_MS = 24 * 60 * 60 * 1000

function prune(now = Date.now()): void {
  if (processed.size < MAX_ENTRIES) return
  const entries = Array.from(processed.entries())
  for (let i = 0; i < entries.length; i++) {
    const [key, iso] = entries[i]
    if (now - new Date(iso).getTime() > TTL_MS) processed.delete(key)
  }
  if (processed.size >= MAX_ENTRIES) {
    const oldest = Array.from(processed.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .slice(0, Math.floor(MAX_ENTRIES / 5))
    for (let i = 0; i < oldest.length; i++) {
      processed.delete(oldest[i][0])
    }
  }
}

export function buildWebhookEventKey(input: {
  eventId?: string | null
  transactionId: string
  status: string
}): string {
  if (input.eventId && String(input.eventId).trim()) {
    return `evt:${String(input.eventId).trim()}`
  }
  return `txn:${input.transactionId}:${input.status.toLowerCase()}`
}

/** Retorna isNew=false se o evento já foi claimado (replay). */
export function claimWebhookEvent(key: string): WebhookClaimResult {
  prune()
  const existing = processed.get(key)
  if (existing) {
    return { isNew: false, key, firstSeenAt: existing }
  }
  const firstSeenAt = new Date().toISOString()
  processed.set(key, firstSeenAt)
  return { isNew: true, key, firstSeenAt }
}

export function wasWebhookProcessed(key: string): boolean {
  return processed.has(key)
}

/** Apenas testes. */
export function __resetWebhookIdempotencyForTests(): void {
  processed.clear()
}
