/**
 * Fase 12 — buffer in-memory de eventos de analytics (audit / debug).
 */

export interface ServerAnalyticsEvent {
  event: string
  properties?: Record<string, unknown>
  timestamp: string
  sessionId?: string
  stage?: string
  receivedAt: string
}

const MAX = 500
const ring: ServerAnalyticsEvent[] = []

export function ingestAnalyticsEvents(
  events: Array<{
    event?: string
    properties?: Record<string, unknown>
    timestamp?: string
    sessionId?: string
    stage?: string
  }>
): { accepted: number; rejected: number } {
  let accepted = 0
  let rejected = 0
  const now = new Date().toISOString()

  for (const raw of events) {
    if (!raw || typeof raw.event !== "string" || !raw.event.trim()) {
      rejected++
      continue
    }
    ring.push({
      event: raw.event.trim().slice(0, 80),
      properties: raw.properties && typeof raw.properties === "object" ? raw.properties : undefined,
      timestamp: typeof raw.timestamp === "string" ? raw.timestamp : now,
      sessionId: typeof raw.sessionId === "string" ? raw.sessionId.slice(0, 64) : undefined,
      stage: typeof raw.stage === "string" ? raw.stage.slice(0, 40) : undefined,
      receivedAt: now,
    })
    accepted++
  }

  while (ring.length > MAX) ring.shift()
  return { accepted, rejected }
}

export function listRecentAnalytics(limit = 50): ServerAnalyticsEvent[] {
  const n = Math.min(Math.max(limit, 1), 200)
  return ring.slice(-n).reverse()
}

export function analyticsStats(): {
  total: number
  byEvent: Record<string, number>
  byStage: Record<string, number>
} {
  const byEvent: Record<string, number> = {}
  const byStage: Record<string, number> = {}
  for (const e of ring) {
    byEvent[e.event] = (byEvent[e.event] ?? 0) + 1
    const st = e.stage ?? "other"
    byStage[st] = (byStage[st] ?? 0) + 1
  }
  return { total: ring.length, byEvent, byStage }
}

export function __resetAnalyticsForTests(): void {
  ring.length = 0
}
