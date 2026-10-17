import { useState, useEffect, useRef, useMemo } from "react"
import { ShoppingCart, Minus, Plus, Trash2, MapPin, Clock, TrendingUp, Zap, Users, BarChart3, Check, Flame, AlertTriangle, Ticket } from "lucide-react"
import { type CartItem, getCartItemQty } from "@/lib/cart-store"
import { type TravelerProfile, AIRecommendedBadge, calculateMatchScore } from "@/components/ai-conversion-elements"
import { EmptyState, LoadingSkeleton } from "@/components/shells"

export interface TicketItem {
  id: string
  name: string
  description: string
  price: number
  originalPrice: number
  discount: number
  image?: string
  features: string[]
  location: string
  duration: string
  ageGroup?: string
  popular?: boolean
  soldToday?: number
  availableToday?: number
  category: string
  categorySection?: string
  ticketCategory?: "ingressos" | "morador" | "meia-entrada"
  tags: string[]
  alsoBoght?: string[]
  documentRequired?: string
  enterprise?: string
  enterprises?: string[]
  destinationCity?: string
  parkSlots?: { id: string; name: string; emoji: string; city: string; color: string }[]
}

interface TicketsGridProps {
  tickets: TicketItem[]
  cart: CartItem[]
  bestValueId?: string
  profile?: TravelerProfile | null
  hoveredId?: string | null
  compareIds?: string[]
  loading?: boolean
  onHover?: (id: string | null) => void
  onToggleCompare?: (id: string) => void
  onBuy: (ticket: TicketItem) => void
  onInc: (ticket: TicketItem, qty: number) => void
  onDec: (ticket: TicketItem, qty: number) => void
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price)
}

function AnimatedCounter({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const prevTarget = useRef(0)

  useEffect(() => {
    if (target <= 0) return
    const start = prevTarget.current
    prevTarget.current = target
    let current = start
    const diff = target - start
    if (diff <= 0) {
      setCount(target)
      return
    }
    const step = Math.max(1, Math.floor(diff / 20))
    const interval = setInterval(() => {
      current += step
      if (current >= target) {
        current = target
        clearInterval(interval)
      }
      setCount(current)
    }, 80)
    return () => clearInterval(interval)
  }, [target])

  return (
    <span ref={ref} style={{ fontVariantNumeric: "tabular-nums" }}>
      {count} {suffix}
    </span>
  )
}

function AlsoBoughtMini({ ticket, allTickets, onQuickAdd, cart }: {
  ticket: TicketItem
  allTickets: TicketItem[]
  cart: CartItem[]
  onQuickAdd: (t: TicketItem) => void
}) {
  if (!ticket.alsoBoght || ticket.alsoBoght.length === 0) return null
  const related = ticket.alsoBoght
    .map((id) => allTickets.find((t) => t.id === id))
    .filter(Boolean) as TicketItem[]
  if (related.length === 0) return null

  return (
    <div style={{
      marginTop: 10,
      padding: "10px 12px",
      borderRadius: 10,
      background: "linear-gradient(135deg, #EFF6FF, #F0FDF4)",
      border: "1px solid #BFDBFE",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <TrendingUp style={{ width: 13, height: 13, color: "#2563EB" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#1F2937" }}>
          Quem comprou este, também comprou:
        </span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {related.map((r) => {
          const rQty = getCartItemQty(cart, r.id)
          return (
            <div key={r.id} style={{
              flex: 1,
              background: "#fff",
              borderRadius: 8,
              padding: "8px 10px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#374151", margin: "0 0 4px", lineHeight: 1.3 }}>
                {r.name.replace("Ingresso ", "")}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#16A34A" }}>{formatPrice(r.price)}</span>
                <span style={{
                  fontSize: 9, fontWeight: 700, color: "#EF4444",
                  background: "#FEE2E2", padding: "1px 5px", borderRadius: 4,
                }}>-{r.discount}%</span>
              </div>
              <button
                data-testid={`button-quick-add-${r.id}`}
                onClick={() => onQuickAdd(r)}
                style={{
                  width: "100%",
                  padding: "5px 0",
                  border: "none",
                  borderRadius: 6,
                  background: rQty > 0
                    ? "linear-gradient(135deg, #16A34A, #15803D)"
                    : "linear-gradient(135deg, #0891B2, #2563EB)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                {rQty > 0 ? (
                  <><Users style={{ width: 10, height: 10 }} /> {rQty} no carrinho</>
                ) : (
                  <><ShoppingCart style={{ width: 10, height: 10 }} /> + Adicionar</>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TicketsGrid({
  tickets,
  cart,
  bestValueId,
  profile,
  hoveredId,
  compareIds = [],
  loading = false,
  onHover,
  onToggleCompare,
  onBuy,
  onInc,
  onDec,
}: TicketsGridProps) {
  const qtyById = useMemo(() => {
    const m = new Map<string, number>()
    for (const it of cart) m.set(it.ticketId, it.quantity)
    return m
  }, [cart])

  if (loading) {
    return (
      <div style={{ padding: "20px 16px 100px" }} data-testid="tickets-grid-loading">
        <LoadingSkeleton variant="card" rows={4} />
      </div>
    )
  }

  if (tickets.length === 0) {
    return (
      <EmptyState
        data-testid="tickets-grid-empty"
        icon={<Ticket className="w-6 h-6" />}
        title="Nenhum ingresso encontrado"
        description="Tente ajustar os filtros ou selecionar outra cidade para ver os ingressos disponíveis."
      />
    )
  }

  return (
    <div className="v13-tickets-grid" style={{ padding: "20px 16px 100px" }}>
      {tickets.map((ticket) => {
        const qty = qtyById.get(ticket.id) ?? 0
        const isBestValue = ticket.id === bestValueId
        const isHovered = hoveredId === ticket.id
        const isComparing = compareIds.includes(ticket.id)
        const isLowStock = (ticket.availableToday ?? 0) > 0 && (ticket.availableToday ?? 99) <= 10

        const matchScore = profile
          ? calculateMatchScore(profile, {
              category: ticket.category,
              price: ticket.price,
              tags: ticket.tags,
            })
          : 0

        return (
          <div
            key={ticket.id}
            data-testid={`card-ticket-${ticket.id}`}
            onMouseEnter={() => onHover?.(ticket.id)}
            onMouseLeave={() => onHover?.(null)}
            style={{
              background: "#fff",
              borderRadius: 16,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: isHovered
                ? "0 8px 30px rgba(0,0,0,0.15)"
                : "0 2px 12px rgba(0,0,0,0.08)",
              transform: isHovered ? "scale(1.02)" : "scale(1)",
              transition: "all 0.3s ease",
              border: isComparing ? "2px solid #3B82F6" : ticket.popular ? "2px solid #FACC15" : "none",
              position: "relative",
            }}
          >
            <div style={{ position: "relative" }}>
              {ticket.popular && (
                <div
                  data-testid={`badge-popular-${ticket.id}`}
                  style={{
                    position: "absolute", top: 0, left: 0, right: 0,
                    background: "#FACC15", color: "#000", textAlign: "center",
                    padding: "4px 0", fontSize: 12, fontWeight: 700, zIndex: 2,
                  }}
                >
                  MAIS POPULAR
                </div>
              )}
              {isBestValue && (
                <div
                  data-testid={`badge-best-value-${ticket.id}`}
                  style={{
                    position: "absolute", top: ticket.popular ? 28 : 0, left: 0, right: 0,
                    background: "linear-gradient(135deg, #22C55E, #16A34A)", color: "#fff",
                    textAlign: "center", padding: "4px 0", fontSize: 12, fontWeight: 700, zIndex: 2,
                  }}
                >
                  MELHOR CUSTO-BENEFICIO
                </div>
              )}
              <div style={{
                position: "absolute",
                top: (ticket.popular ? 28 : 0) + (isBestValue ? 28 : 0) + 10,
                left: 10, background: "#EF4444", color: "#fff",
                fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 8, zIndex: 2,
              }}>
                -{ticket.discount}% OFF
              </div>
              <div style={{
                position: "absolute",
                top: (ticket.popular ? 28 : 0) + (isBestValue ? 28 : 0) + 10,
                right: 10, zIndex: 2,
              }}>
                <AIRecommendedBadge matchPercent={matchScore} />
              </div>
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: 200,
                  background: "linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {ticket.image ? (
                  <img
                    src={ticket.image}
                    alt={ticket.name}
                    style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                    }}
                  />
                ) : (
                  <span
                    style={{
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      opacity: 0.9,
                    }}
                  >
                    Imperdível
                  </span>
                )}
              </div>
            </div>

            <div style={{ padding: 16, display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <h3
                  style={{ fontSize: 18, fontWeight: 700, margin: 0 }}
                  data-testid={`text-ticket-name-${ticket.id}`}
                >
                  {ticket.name}
                </h3>
                {onToggleCompare && (
                  <button
                    onClick={() => onToggleCompare(ticket.id)}
                    data-testid={`button-compare-${ticket.id}`}
                    style={{
                      background: isComparing ? "#3B82F6" : "#F3F4F6",
                      border: "none", borderRadius: 6, padding: "4px 8px",
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                      fontSize: 11, fontWeight: 600,
                      color: isComparing ? "#fff" : "#6B7280",
                      transition: "all 0.2s",
                    }}
                  >
                    {isComparing ? <Check style={{ width: 12, height: 12 }} /> : <BarChart3 style={{ width: 12, height: 12 }} />}
                    {isComparing ? "Selecionado" : "Comparar"}
                  </button>
                )}
              </div>

              <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 10px", lineHeight: 1.5 }}>
                {ticket.description}
              </p>

              {(ticket.soldToday ?? 0) > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <Flame style={{ width: 13, height: 13, color: "#EF4444" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#EF4444" }} data-testid={`text-sold-today-${ticket.id}`}>
                    <AnimatedCounter target={ticket.soldToday ?? 0} suffix="ingressos vendidos hoje" />
                  </span>
                </div>
              )}

              {ticket.availableToday !== undefined && ticket.availableToday > 0 && isLowStock && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6, marginBottom: 10,
                  background: "#FEF2F2", borderRadius: 8, padding: "6px 10px",
                  border: "1px solid #FECACA",
                  animation: "pulse 2s infinite",
                }} data-testid={`urgency-low-stock-${ticket.id}`}>
                  <AlertTriangle style={{ width: 13, height: 13, color: "#DC2626" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#DC2626" }}>
                    Apenas {ticket.availableToday} ingressos restantes hoje!
                  </span>
                </div>
              )}

              {ticket.availableToday !== undefined && ticket.availableToday > 0 && !isLowStock && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6, marginBottom: 10,
                  background: "#FEF3C7", borderRadius: 8, padding: "6px 10px",
                  border: "1px solid #FDE68A",
                }} data-testid={`urgency-available-${ticket.id}`}>
                  <Zap style={{ width: 13, height: 13, color: "#D97706" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>
                    {ticket.availableToday} ingressos restantes hoje
                  </span>
                </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 12, color: "#6B7280", marginBottom: 10 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <MapPin style={{ width: 14, height: 14, color: "#3B82F6" }} />
                  {ticket.location}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock style={{ width: 14, height: 14, color: "#22C55E" }} />
                  {ticket.duration}
                </span>
                {ticket.ageGroup && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Users style={{ width: 14, height: 14, color: "#A855F7" }} />
                    {ticket.ageGroup}
                  </span>
                )}
              </div>

              {ticket.features && ticket.features.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {ticket.features.map((f) => (
                    <span
                      key={f}
                      style={{
                        background: "#F3F4F6", borderRadius: 6,
                        padding: "4px 10px", fontSize: 11, color: "#374151",
                      }}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              )}

              <AlsoBoughtMini
                ticket={ticket}
                allTickets={tickets}
                cart={cart}
                onQuickAdd={(t) => onBuy(t)}
              />

              <div style={{ marginTop: "auto", paddingTop: 10 }}>
                <div style={{ marginBottom: 12 }}>
                  {ticket.originalPrice && (
                    <span style={{ fontSize: 14, color: "#9CA3AF", textDecoration: "line-through", marginRight: 8 }}>
                      {formatPrice(ticket.originalPrice)}
                    </span>
                  )}
                  <span
                    style={{ fontSize: 26, fontWeight: 700, color: "#16A34A" }}
                    data-testid={`text-price-${ticket.id}`}
                  >
                    {formatPrice(ticket.price)}
                  </span>
                  <span style={{ fontSize: 12, color: "#9CA3AF", marginLeft: 4 }}>por pessoa</span>
                </div>

                <div style={{ minHeight: 44 }}>
                  {qty === 0 ? (
                    <button
                      data-testid={`button-buy-${ticket.id}`}
                      onClick={() => onBuy(ticket)}
                      style={{
                        width: "100%", padding: "14px 0", border: "none", borderRadius: 12,
                        minHeight: 44,
                        color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer",
                        background: ticket.popular
                          ? "linear-gradient(135deg, #22C55E, #16A34A)"
                          : "linear-gradient(135deg, #0891B2, #06B6D4)",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                        transition: "all 0.2s",
                      }}
                    >
                      <ShoppingCart style={{ width: 18, height: 18 }} />
                      Comprar Agora
                    </button>
                  ) : (
                    <div
                      data-testid={`stepper-${ticket.id}`}
                      style={{
                        width: "100%", display: "flex", alignItems: "center",
                        justifyContent: "space-between", borderRadius: 12,
                        border: "2px solid #22C55E", padding: "9px 12px",
                        background: "#F0FDF4",
                      }}
                    >
                      <button
                        type="button"
                        className="rsv-stepper-btn"
                        data-testid={`button-decrease-${ticket.id}`}
                        onClick={() => onDec(ticket, qty)}
                        style={{
                          borderRadius: 10,
                          background: qty === 1 ? "#FEE2E2" : "#DCFCE7",
                          color: qty === 1 ? "#EF4444" : "#16A34A",
                        }}
                      >
                        {qty === 1 ? <Trash2 style={{ width: 16, height: 16 }} /> : <Minus style={{ width: 16, height: 16 }} />}
                      </button>
                      <span
                        style={{ fontSize: 16, fontWeight: 800, color: "#16A34A" }}
                        data-testid={`text-qty-${ticket.id}`}
                      >
                        {qty}x — {formatPrice(ticket.price * qty)}
                      </span>
                      <button
                        type="button"
                        className="rsv-stepper-btn"
                        data-testid={`button-increase-${ticket.id}`}
                        onClick={() => onInc(ticket, qty)}
                        style={{
                          borderRadius: 10,
                          background: "#DCFCE7", color: "#16A34A",
                        }}
                      >
                        <Plus style={{ width: 16, height: 16 }} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
