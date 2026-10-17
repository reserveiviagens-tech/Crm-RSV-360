import { useCallback, useEffect, useRef, useState } from "react"
import { apiRequest } from "@/lib/queryClient"
import { trackEvent } from "@/lib/analytics"
import type { CartItem } from "@/lib/cart-store"

const SESSION_KEY = "rsv_ticket_hold_session"
const HOLD_ID_KEY = "rsv_ticket_hold_id"

export type TicketHoldState = {
  holdId: string
  sessionId: string
  status: "ACTIVE" | "ATTACHED" | "CONSUMED" | "RELEASED" | "EXPIRED"
  expiresAt: string
  items: Array<{ ticketId: string; quantity: number }>
}

function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    sessionStorage.setItem(SESSION_KEY, id)
    return id
  } catch {
    return `sess-${Date.now()}`
  }
}

function persistHoldId(holdId: string | null) {
  try {
    if (holdId) sessionStorage.setItem(HOLD_ID_KEY, holdId)
    else sessionStorage.removeItem(HOLD_ID_KEY)
  } catch {
    /* ignore */
  }
}

export function useTicketHold(cart: CartItem[]) {
  const [hold, setHold] = useState<TicketHoldState | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isAcquiring, setIsAcquiring] = useState(false)
  const sessionIdRef = useRef(getOrCreateSessionId())
  const acquiringRef = useRef(false)
  const cartKey = cart.map((c) => `${c.ticketId}:${c.quantity}`).join("|")

  const acquire = useCallback(async () => {
    if (cart.length === 0 || acquiringRef.current) return null
    acquiringRef.current = true
    setIsAcquiring(true)
    setError(null)
    try {
      const res = await apiRequest("POST", "/api/tickets/holds", {
        sessionId: sessionIdRef.current,
        items: cart.map((c) => ({ ticketId: c.ticketId, quantity: c.quantity })),
      })
      const data = (await res.json()) as TicketHoldState
      setHold(data)
      persistHoldId(data.holdId)
      const expMs = new Date(data.expiresAt).getTime()
      setSecondsLeft(Math.max(0, Math.floor((expMs - Date.now()) / 1000)))
      trackEvent("ticket_hold_acquired", {
        holdId: data.holdId,
        items: data.items.length,
        expiresAt: data.expiresAt,
      })
      return data
    } catch (err) {
      let message = "Não foi possível reservar os ingressos temporariamente"
      if (err instanceof Error) {
        const raw = err.message
        const jsonStart = raw.indexOf("{")
        if (jsonStart >= 0) {
          try {
            const parsed = JSON.parse(raw.slice(jsonStart)) as { message?: string }
            if (parsed.message) message = parsed.message
          } catch {
            message = raw
          }
        } else {
          message = raw
        }
      }
      setError(message)
      setHold(null)
      persistHoldId(null)
      trackEvent("ticket_hold_failed", { message })
      return null
    } finally {
      acquiringRef.current = false
      setIsAcquiring(false)
    }
  }, [cart])

  const release = useCallback(async () => {
    if (!hold?.holdId) return
    if (hold.status !== "ACTIVE") return
    try {
      await apiRequest("DELETE", `/api/tickets/holds/${hold.holdId}`)
      trackEvent("ticket_hold_released", { holdId: hold.holdId })
    } catch {
      /* best-effort */
    } finally {
      setHold(null)
      setSecondsLeft(0)
      persistHoldId(null)
    }
  }, [hold])

  useEffect(() => {
    void acquire()
  }, [cartKey]) // eslint-disable-line react-hooks/exhaustive-deps -- re-hold when cart lines change

  useEffect(() => {
    if (!hold?.expiresAt || hold.status !== "ACTIVE") return
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(hold.expiresAt).getTime() - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left <= 0) {
        setHold((prev) => (prev ? { ...prev, status: "EXPIRED" } : prev))
        trackEvent("ticket_hold_expired", { holdId: hold.holdId })
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [hold?.holdId, hold?.expiresAt, hold?.status])

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0")
  const seconds = String(secondsLeft % 60).padStart(2, "0")
  const isExpired = hold != null && (hold.status === "EXPIRED" || secondsLeft <= 0)

  return {
    hold,
    holdId: hold?.holdId ?? null,
    sessionId: sessionIdRef.current,
    secondsLeft,
    minutes,
    seconds,
    isExpired,
    error,
    isAcquiring,
    acquire,
    release,
  }
}
