/**
 * Fase 12 — Tracking & analytics audit
 * Funil ingressos: page → cart → checkout → hold → pix → pedido → voucher
 */

export type AnalyticsEvent =
  | "tickets_page_view"
  | "ticket_filter_change"
  | "ticket_card_open"
  | "ticket_add_to_cart"
  | "ticket_remove_from_cart"
  | "ai_combo_accept"
  | "ai_combo_dismiss"
  | "related_hotel_click"
  | "related_offer_click"
  | "tickets_checkout_start"
  | "pix_checkout_view"
  | "pix_code_copy"
  | "pix_qr_visible"
  | "pix_payment_confirmed"
  | "pix_payment_expired"
  | "pix_payment_failed"
  | "pix_cancelled"
  | "tickets_success_view"
  | "ticket_download_click"
  | "support_whatsapp_click"
  | "wizard_confirm"
  | "date_selected"
  | "category_expand"
  | "checkout_view"
  | "checkout_step_email_done"
  | "checkout_step_dados_done"
  | "checkout_card_simulated"
  | "checkout_google_click"
  | "checkout_apple_click"
  | "apple_pay_click"
  | "cupom_apply_attempt"
  | "enterprise_expand"
  | "ticket_whatsapp_share_click"
  | "combo_dates_confirmed"
  | "ticket_hold_acquired"
  | "ticket_hold_failed"
  | "ticket_hold_released"
  | "ticket_hold_expired"
  | "voucher_pdf_download_click"
  | "voucher_pdf_download_success"
  | "voucher_pdf_download_error"
  | "order_status_view"
  | "order_bff_load"
  | "order_bff_error"

/** Catálogo auditado — estágio do funil para docs/admin */
export const ANALYTICS_FUNNEL: Record<
  AnalyticsEvent,
  { stage: string; critical: boolean }
> = {
  tickets_page_view: { stage: "catalog", critical: true },
  ticket_filter_change: { stage: "catalog", critical: false },
  ticket_card_open: { stage: "catalog", critical: false },
  ticket_add_to_cart: { stage: "cart", critical: true },
  ticket_remove_from_cart: { stage: "cart", critical: true },
  ai_combo_accept: { stage: "upsell", critical: true },
  ai_combo_dismiss: { stage: "upsell", critical: true },
  related_hotel_click: { stage: "cross_sell", critical: false },
  related_offer_click: { stage: "cross_sell", critical: false },
  tickets_checkout_start: { stage: "checkout", critical: true },
  checkout_view: { stage: "checkout", critical: true },
  checkout_step_email_done: { stage: "checkout", critical: true },
  checkout_step_dados_done: { stage: "checkout", critical: true },
  checkout_google_click: { stage: "checkout", critical: false },
  checkout_apple_click: { stage: "checkout", critical: false },
  checkout_card_simulated: { stage: "checkout", critical: false },
  apple_pay_click: { stage: "checkout", critical: false },
  cupom_apply_attempt: { stage: "checkout", critical: false },
  ticket_hold_acquired: { stage: "hold", critical: true },
  ticket_hold_failed: { stage: "hold", critical: true },
  ticket_hold_released: { stage: "hold", critical: false },
  ticket_hold_expired: { stage: "hold", critical: true },
  pix_checkout_view: { stage: "pix", critical: true },
  pix_qr_visible: { stage: "pix", critical: true },
  pix_code_copy: { stage: "pix", critical: true },
  pix_payment_confirmed: { stage: "pix", critical: true },
  pix_payment_expired: { stage: "pix", critical: true },
  pix_payment_failed: { stage: "pix", critical: true },
  pix_cancelled: { stage: "pix", critical: true },
  order_status_view: { stage: "order", critical: true },
  order_bff_load: { stage: "order", critical: false },
  order_bff_error: { stage: "order", critical: true },
  tickets_success_view: { stage: "success", critical: false },
  ticket_download_click: { stage: "voucher", critical: false },
  voucher_pdf_download_click: { stage: "voucher", critical: true },
  voucher_pdf_download_success: { stage: "voucher", critical: true },
  voucher_pdf_download_error: { stage: "voucher", critical: true },
  support_whatsapp_click: { stage: "support", critical: false },
  ticket_whatsapp_share_click: { stage: "support", critical: false },
  wizard_confirm: { stage: "catalog", critical: false },
  date_selected: { stage: "catalog", critical: false },
  category_expand: { stage: "catalog", critical: false },
  enterprise_expand: { stage: "catalog", critical: false },
  combo_dates_confirmed: { stage: "cart", critical: false },
}

const STORAGE_KEY = "rsv_analytics"
const SESSION_KEY = "rsv_analytics_sid"
const MAX_LOCAL = 200
const FLUSH_BATCH = 20

export interface AnalyticsEntry {
  event: AnalyticsEvent
  properties?: Record<string, unknown>
  timestamp: string
  sessionId: string
  stage: string
}

function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY)
    if (!sid) {
      sid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `sid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      sessionStorage.setItem(SESSION_KEY, sid)
    }
    return sid
  } catch {
    return "sid-unknown"
  }
}

let flushQueue: AnalyticsEntry[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function scheduleFlush(): void {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flushAnalytics()
  }, 1500)
}

/** Envia lote ao BFF analytics (fire-and-forget). */
export async function flushAnalytics(): Promise<void> {
  if (flushQueue.length === 0) return
  const batch = flushQueue.splice(0, FLUSH_BATCH)
  try {
    await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
      credentials: "include",
    })
  } catch {
    // re-enfileira no início se falhar (dev offline)
    flushQueue = batch.concat(flushQueue).slice(0, FLUSH_BATCH * 2)
  }
}

export function trackEvent(
  event: AnalyticsEvent,
  properties?: Record<string, unknown>
): void {
  try {
    const sessionId = getSessionId()
    const stage = ANALYTICS_FUNNEL[event]?.stage ?? "other"
    const entry: AnalyticsEntry = {
      event,
      properties: {
        ...properties,
        path:
          typeof window !== "undefined" ? window.location.pathname : undefined,
      },
      timestamp: new Date().toISOString(),
      sessionId,
      stage,
    }

    const existing = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]"
    ) as AnalyticsEntry[]
    existing.push(entry)
    if (existing.length > MAX_LOCAL) {
      existing.splice(0, existing.length - MAX_LOCAL)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))

    flushQueue.push(entry)
    if (flushQueue.length >= FLUSH_BATCH) {
      void flushAnalytics()
    } else {
      scheduleFlush()
    }

    if (import.meta.env.DEV) {
      console.log("[RSV Analytics]", event, { stage, sessionId, ...properties })
    }
  } catch {
    // never break UX
  }
}

/** Utilitário de auditoria — eventos críticos sem ocorrência no buffer local. */
export function getLocalAnalyticsGaps(
  required: AnalyticsEvent[] = Object.entries(ANALYTICS_FUNNEL)
    .filter(([, v]) => v.critical)
    .map(([k]) => k as AnalyticsEvent)
): AnalyticsEvent[] {
  try {
    const existing = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]"
    ) as AnalyticsEntry[]
    const seen = new Set(existing.map((e) => e.event))
    return required.filter((e) => !seen.has(e))
  } catch {
    return required
  }
}
