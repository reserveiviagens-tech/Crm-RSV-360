import { useState, useMemo } from "react"
import { ChevronDown, ChevronUp, ShoppingCart, Minus, Plus, Trash2, Info, ChevronRight, MapPin, Clock, Users, Flame, AlertTriangle, Zap, FileText, CheckCircle2, ShoppingBag, XCircle } from "lucide-react"
import { type CartItem, getCartItemQty } from "@/lib/cart-store"
import { type TicketItem } from "@/components/TicketsGrid"
import { trackEvent } from "@/lib/analytics"
import { PARK_DETAILS } from "@/lib/park-details"

interface CategorySectionDef {
  id: string
  title: string
  subtitle: string
  icon: string
  color: string
  bgColor: string
  cabana?: boolean
  grid?: boolean
}

export const CATEGORY_SECTIONS: CategorySectionDef[] = [
  {
    id: "ingresso-1-dia",
    title: "Ingresso 1 Dia",
    subtitle: "Acesso completo por um dia inteiro",
    icon: "🎟️",
    color: "#0891B2",
    bgColor: "#F0F9FF",
  },
  {
    id: "transporte",
    title: "Transporte Promocional",
    subtitle: "Ida e volta com conforto garantido",
    icon: "🚌",
    color: "#7C3AED",
    bgColor: "#F5F3FF",
  },
  {
    id: "combos",
    title: "Combos",
    subtitle: "Combine parques e economize até 25%",
    icon: "✨",
    color: "#D97706",
    bgColor: "#FFFBEB",
  },
  {
    id: "especiais",
    title: "Ingressos Especiais",
    subtitle: "Experiências exclusivas e premium",
    icon: "⭐",
    color: "#DC2626",
    bgColor: "#FEF2F2",
    grid: true,
  },
  {
    id: "cabanas",
    title: "Espaço Cabanas no Aqua Park",
    subtitle: "Reserve sua área exclusiva com conforto total",
    icon: "🏕️",
    color: "#16A34A",
    bgColor: "#F0FDF4",
    cabana: true,
    grid: true,
  },
]

function formatPrice(price: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price)
}

export function TicketDetailsPanel({ ticketId, ticketCategory }: { ticketId: string; ticketCategory?: string }) {
  const details = PARK_DETAILS[ticketId]
  if (!details) return null
  const isMeiaOrMorador = ticketCategory === "meia-entrada" || ticketCategory === "morador"
  return (
    <div style={{
      background: "#F8FAFC", border: "1px solid #E2E8F0",
      borderRadius: 10, padding: "12px 14px", marginBottom: 10,
    }} data-testid={`panel-details-${ticketId}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, borderBottom: "1px solid #E5E7EB", paddingBottom: 8 }}>
        <Clock style={{ width: 12, height: 12, color: "#2563EB" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#1E40AF" }}>Horário:</span>
        <span style={{ fontSize: 11, color: "#374151" }}>{details.horario}</span>
      </div>

      {isMeiaOrMorador && details.meiaEntrada.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
            <AlertTriangle style={{ width: 11, height: 11, color: "#D97706" }} />
            Documentos obrigatórios
          </div>
          <ul style={{ margin: 0, padding: "0 0 0 14px" }}>
            {details.meiaEntrada.map((d) => (
              <li key={d} style={{ fontSize: 10, color: "#78350F", marginBottom: 2, lineHeight: 1.4 }}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {!isMeiaOrMorador && details.meiaEntrada.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#4338CA", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
            <Users style={{ width: 11, height: 11, color: "#6366F1" }} />
            Meia-entrada válida para
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {details.meiaEntrada.map((d) => (
              <span key={d} style={{
                background: "#EEF2FF", border: "1px solid #C7D2FE",
                borderRadius: 5, padding: "2px 7px",
                fontSize: 9, color: "#3730A3", fontWeight: 600,
              }}>{d}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#15803D", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
          <CheckCircle2 style={{ width: 11, height: 11, color: "#22C55E" }} />
          Incluso
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {details.inclui.map((item) => (
            <span key={item} style={{
              background: "#F0FDF4", border: "1px solid #BBF7D0",
              borderRadius: 5, padding: "2px 6px",
              fontSize: 9, color: "#15803D", fontWeight: 600,
            }}>
              ✓ {item}
            </span>
          ))}
        </div>
      </div>

      {details.naInclui.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
            <XCircle style={{ width: 11, height: 11, color: "#EF4444" }} />
            Não incluso
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {details.naInclui.map((item) => (
              <span key={item} style={{
                background: "#FEF2F2", border: "1px solid #FECACA",
                borderRadius: 5, padding: "2px 6px",
                fontSize: 9, color: "#DC2626", fontWeight: 600,
              }}>
                ✗ {item}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
          <ShoppingBag style={{ width: 11, height: 11, color: "#6366F1" }} />
          O que levar
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {details.oQueTrazer.map((item) => (
            <span key={item} style={{
              background: "#EEF2FF", border: "1px solid #C7D2FE",
              borderRadius: 5, padding: "2px 6px",
              fontSize: 9, color: "#4338CA", fontWeight: 600,
            }}>
              {item}
            </span>
          ))}
        </div>
      </div>

      <div style={{
        background: "#FFF7ED", borderRadius: 7, padding: "8px 10px",
        border: "1px solid #FED7AA", marginBottom: 8,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#92400E", marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
          <Info style={{ width: 10, height: 10, color: "#D97706" }} />
          Alimentação
        </div>
        <p style={{ margin: 0, fontSize: 10, color: "#78350F", lineHeight: 1.4 }}>{details.alimentacao}</p>
      </div>

      <div style={{
        background: "#F5F3FF", borderRadius: 7, padding: "8px 10px",
        border: "1px solid #DDD6FE", marginBottom: details.observacoes ? 8 : 0,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#5B21B6", marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
          <MapPin style={{ width: 10, height: 10, color: "#7C3AED" }} />
          Estacionamento
        </div>
        <p style={{ margin: 0, fontSize: 10, color: "#4C1D95", lineHeight: 1.4 }}>{details.estacionamento}</p>
      </div>

      {details.observacoes && (
        <div style={{
          background: "#EFF6FF", borderRadius: 7, padding: "8px 10px",
          border: "1px solid #BFDBFE", marginTop: 0,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#1E40AF", marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
            <FileText style={{ width: 10, height: 10, color: "#2563EB" }} />
            Informação importante
          </div>
          <p style={{ margin: 0, fontSize: 10, color: "#1E3A8A", lineHeight: 1.4 }}>{details.observacoes}</p>
        </div>
      )}
    </div>
  )
}

export function TicketRowCard({
  ticket,
  cart,
  onBuy,
  onInc,
  onDec,
  cabana,
  priceMultiplier,
}: {
  ticket: TicketItem
  cart: CartItem[]
  onBuy: (t: TicketItem) => void
  onInc: (t: TicketItem, qty: number) => void
  onDec: (t: TicketItem, qty: number) => void
  cabana?: boolean
  priceMultiplier: number
}) {
  const [expanded, setExpanded] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const qty = getCartItemQty(cart, ticket.id)
  const adjPrice = Math.round(ticket.price * priceMultiplier)
  const adjOriginal = Math.round(ticket.originalPrice * priceMultiplier)
  const isLowStock = (ticket.availableToday ?? 0) > 0 && (ticket.availableToday ?? 99) <= 10

  return (
    <div
      data-testid={`card-ticket-${ticket.id}`}
      style={{
        background: cabana ? "linear-gradient(135deg, #ECFDF5, #F0FDF4)" : "#fff",
        border: cabana ? "1.5px solid #BBF7D0" : "1px solid #F3F4F6",
        borderRadius: 14,
        overflow: "hidden",
        transition: "box-shadow 0.2s",
        boxShadow: qty > 0 ? "0 0 0 2px #22C55E" : "0 1px 6px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ display: "flex", gap: 0 }}>
        {ticket.image && (
          <img
            src={ticket.image}
            alt={ticket.name}
            style={{
              width: 88, minHeight: 100, objectFit: "cover", flexShrink: 0,
              borderRadius: "14px 0 0 0",
            }}
          />
        )}
        <div style={{ flex: 1, padding: "12px 14px", minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {ticket.popular && (
                <span style={{
                  display: "inline-block", fontSize: 9, fontWeight: 800,
                  background: "#FACC15", color: "#000",
                  padding: "1px 6px", borderRadius: 4, marginBottom: 4,
                  textTransform: "uppercase",
                }}>
                  Mais popular
                </span>
              )}
              <h3
                style={{ fontSize: 14, fontWeight: 700, margin: "0 0 3px", color: "#111827", lineHeight: 1.3 }}
                data-testid={`text-ticket-name-${ticket.id}`}
              >
                {ticket.name}
              </h3>
              <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 6px", lineHeight: 1.4 }}>
                {ticket.description}
              </p>
            </div>
          </div>

          {(ticket.soldToday ?? 0) > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
              <Flame style={{ width: 11, height: 11, color: "#EF4444" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444" }} data-testid={`text-sold-today-${ticket.id}`}>
                {ticket.soldToday} vendidos hoje
              </span>
            </div>
          )}

          {isLowStock && (
            <div style={{
              display: "flex", alignItems: "center", gap: 4, marginBottom: 6,
              background: "#FEF2F2", borderRadius: 6, padding: "4px 8px",
              border: "1px solid #FECACA",
            }} data-testid={`urgency-low-stock-${ticket.id}`}>
              <AlertTriangle style={{ width: 11, height: 11, color: "#DC2626" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#DC2626" }}>
                Apenas {ticket.availableToday} restantes!
              </span>
            </div>
          )}

          {!isLowStock && (ticket.availableToday ?? 0) > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 4, marginBottom: 6,
            }} data-testid={`urgency-available-${ticket.id}`}>
              <Zap style={{ width: 11, height: 11, color: "#D97706" }} />
              <span style={{ fontSize: 11, color: "#92400E" }}>
                {ticket.availableToday} disponíveis hoje
              </span>
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 11, color: "#6B7280", marginBottom: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <MapPin style={{ width: 11, height: 11, color: "#3B82F6" }} />
              {ticket.location}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Clock style={{ width: 11, height: 11, color: "#22C55E" }} />
              {ticket.duration}
            </span>
            {ticket.ageGroup && (
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <Users style={{ width: 11, height: 11, color: "#A855F7" }} />
                {ticket.ageGroup}
              </span>
            )}
          </div>

          {expanded && ticket.features.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {ticket.features.map((f) => (
                <span key={f} style={{
                  background: "#F3F4F6", borderRadius: 5,
                  padding: "3px 8px", fontSize: 10, color: "#374151",
                }}>
                  {f}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <button
              type="button"
              className="rsv-hit-44-inline"
              data-testid={`button-saiba-mais-${ticket.id}`}
              onClick={() => setExpanded(e => !e)}
              style={{
                background: "none", border: "none", padding: "10px 8px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 3,
                fontSize: 12, fontWeight: 600, color: "#0891B2",
              }}
            >
              <Info style={{ width: 14, height: 14 }} />
              {expanded ? "Ver menos" : "Saiba mais"}
              {expanded
                ? <ChevronUp style={{ width: 14, height: 14 }} />
                : <ChevronRight style={{ width: 14, height: 14 }} />}
            </button>
            {PARK_DETAILS[ticket.id] && (
              <button
                type="button"
                className="rsv-hit-44-inline"
                data-testid={`button-detalhes-${ticket.id}`}
                onClick={() => setShowDetails(d => !d)}
                style={{
                  background: showDetails ? "#EFF6FF" : "none",
                  border: `1px solid ${showDetails ? "#BFDBFE" : "#E5E7EB"}`,
                  padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 3,
                  fontSize: 12, fontWeight: 600, color: showDetails ? "#1D4ED8" : "#6B7280",
                  transition: "all 0.15s",
                }}
              >
                <FileText style={{ width: 11, height: 11 }} />
                {showDetails ? "− Fechar" : "+ Detalhes"}
              </button>
            )}
          </div>

          {showDetails && (
            <TicketDetailsPanel ticketId={ticket.id} ticketCategory={ticket.ticketCategory} />
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                {adjOriginal !== adjPrice && (
                  <span style={{ fontSize: 12, color: "#9CA3AF", textDecoration: "line-through" }}>
                    {formatPrice(adjOriginal)}
                  </span>
                )}
                <span
                  style={{ fontSize: 20, fontWeight: 800, color: "#16A34A" }}
                  data-testid={`text-price-${ticket.id}`}
                >
                  {formatPrice(adjPrice)}
                </span>
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>por pessoa</span>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#EF4444",
                background: "#FEE2E2", padding: "2px 6px", borderRadius: 4,
              }}>
                -{ticket.discount}% OFF
              </span>
            </div>

            <div>
              {qty === 0 ? (
                <button
                  type="button"
                  className="rsv-hit-44-inline"
                  data-testid={`button-buy-${ticket.id}`}
                  onClick={() => onBuy(ticket)}
                  style={{
                    padding: "12px 18px", border: "none", borderRadius: 10,
                    minHeight: 44,
                    background: cabana
                      ? "linear-gradient(135deg, #16A34A, #15803D)"
                      : ticket.popular
                      ? "linear-gradient(135deg, #22C55E, #16A34A)"
                      : "linear-gradient(135deg, #0891B2, #2563EB)",
                    color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                    boxShadow: "0 3px 10px rgba(0,0,0,0.15)",
                  }}
                >
                  <ShoppingCart style={{ width: 14, height: 14 }} />
                  Adicionar
                </button>
              ) : (
                <div
                  data-testid={`stepper-${ticket.id}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    border: "2px solid #22C55E", borderRadius: 10,
                    background: "#F0FDF4", padding: "4px 8px",
                    minHeight: 44,
                  }}
                >
                  <button
                    type="button"
                    className="rsv-stepper-btn"
                    data-testid={`button-decrease-${ticket.id}`}
                    onClick={() => onDec(ticket, qty)}
                    style={{
                      borderRadius: 8,
                      background: qty === 1 ? "#FEE2E2" : "#DCFCE7",
                      color: qty === 1 ? "#EF4444" : "#16A34A",
                    }}
                  >
                    {qty === 1 ? <Trash2 style={{ width: 15, height: 15 }} /> : <Minus style={{ width: 15, height: 15 }} />}
                  </button>
                  <span
                    style={{ fontSize: 13, fontWeight: 800, color: "#16A34A", minWidth: 40, textAlign: "center" }}
                    data-testid={`text-qty-${ticket.id}`}
                  >
                    {qty}x
                  </span>
                  <button
                    type="button"
                    className="rsv-stepper-btn"
                    data-testid={`button-increase-${ticket.id}`}
                    onClick={() => onInc(ticket, qty)}
                    style={{
                      borderRadius: 8,
                      background: "#DCFCE7", color: "#16A34A",
                    }}
                  >
                    <Plus style={{ width: 15, height: 15 }} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function TicketGridCard({
  ticket,
  cart,
  onBuy,
  onInc,
  onDec,
  cabana,
  priceMultiplier,
}: {
  ticket: TicketItem
  cart: CartItem[]
  onBuy: (t: TicketItem) => void
  onInc: (t: TicketItem, qty: number) => void
  onDec: (t: TicketItem, qty: number) => void
  cabana?: boolean
  priceMultiplier: number
}) {
  const [showDetails, setShowDetails] = useState(false)
  const qty = getCartItemQty(cart, ticket.id)
  const adjPrice = Math.round(ticket.price * priceMultiplier)
  const adjOriginal = Math.round(ticket.originalPrice * priceMultiplier)
  const details = PARK_DETAILS[ticket.id]

  return (
    <div
      data-testid={`card-ticket-${ticket.id}`}
      style={{
        background: cabana ? "linear-gradient(135deg, #ECFDF5, #F0FDF4)" : "#fff",
        border: cabana ? "1.5px solid #BBF7D0" : "1px solid #F3F4F6",
        borderRadius: 14,
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        boxShadow: qty > 0 ? "0 0 0 2px #22C55E" : "0 1px 6px rgba(0,0,0,0.06)",
        transition: "box-shadow 0.2s",
      }}
    >
      <div
        className="relative h-[120px] bg-gradient-to-br from-blue-900 to-slate-800 overflow-hidden flex items-center justify-center"
        style={{ width: "100%" }}
      >
        {ticket.image ? (
          <img
            src={ticket.image}
            alt={ticket.name}
            style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }}
            onError={(e) => {
              e.currentTarget.style.display = "none"
            }}
          />
        ) : null}
        <span className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shadow z-[1]">
          {ticket.popular ? "Popular" : `-${ticket.discount}%`}
        </span>
      </div>
      <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
        {ticket.popular && (
          <span style={{
            display: "inline-block", fontSize: 9, fontWeight: 800,
            background: "#FACC15", color: "#000",
            padding: "1px 6px", borderRadius: 4, marginBottom: 4,
            textTransform: "uppercase",
          }}>
            Mais popular
          </span>
        )}
        <h3
          style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px", color: "#111827", lineHeight: 1.3 }}
          data-testid={`text-ticket-name-${ticket.id}`}
        >
          {ticket.name}
        </h3>
        <p style={{ fontSize: 11, color: "#6B7280", margin: "0 0 6px", lineHeight: 1.4, flex: 1 }}>
          {ticket.description}
        </p>

        {details && (
          <>
            <button
              data-testid={`button-detalhes-${ticket.id}`}
              onClick={() => setShowDetails(d => !d)}
              style={{
                background: showDetails ? "#EFF6FF" : "#F9FAFB",
                border: `1px solid ${showDetails ? "#BFDBFE" : "#E5E7EB"}`,
                borderRadius: 6, padding: "4px 8px",
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 10, fontWeight: 600,
                color: showDetails ? "#1D4ED8" : "#6B7280",
                marginBottom: 8, transition: "all 0.15s", width: "fit-content",
              }}
            >
              <FileText style={{ width: 10, height: 10 }} />
              {showDetails ? "− Fechar detalhes" : "+ Ver detalhes"}
            </button>

            {showDetails && (
              <div style={{
                background: "#F8FAFC", border: "1px solid #E2E8F0",
                borderRadius: 8, padding: "10px 12px", marginBottom: 8,
              }} data-testid={`panel-details-${ticket.id}`}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7, borderBottom: "1px solid #E5E7EB", paddingBottom: 6 }}>
                  <Clock style={{ width: 10, height: 10, color: "#2563EB" }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#1E40AF" }}>Horário:</span>
                  <span style={{ fontSize: 10, color: "#374151" }}>{details.horario}</span>
                </div>
                {(ticket.ticketCategory === "meia-entrada" || ticket.ticketCategory === "morador") && details.meiaEntrada.length > 0 && (
                  <div style={{ marginBottom: 7 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#92400E", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <AlertTriangle style={{ width: 10, height: 10, color: "#D97706" }} />
                      Documentação obrigatória
                    </div>
                    <ul style={{ margin: 0, padding: "0 0 0 12px" }}>
                      {details.meiaEntrada.map((d) => (
                        <li key={d} style={{ fontSize: 9, color: "#78350F", marginBottom: 2, lineHeight: 1.4 }}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#15803D", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                    <CheckCircle2 style={{ width: 10, height: 10, color: "#22C55E" }} />
                    Incluso
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {details.inclui.slice(0, 4).map((item) => (
                      <span key={item} style={{
                        background: "#F0FDF4", border: "1px solid #BBF7D0",
                        borderRadius: 4, padding: "1px 5px",
                        fontSize: 9, color: "#15803D", fontWeight: 600,
                      }}>✓ {item}</span>
                    ))}
                    {details.naInclui.length > 0 && details.naInclui.slice(0, 2).map((item) => (
                      <span key={item} style={{
                        background: "#FEF2F2", border: "1px solid #FECACA",
                        borderRadius: 4, padding: "1px 5px",
                        fontSize: 9, color: "#DC2626", fontWeight: 600,
                      }}>✗ {item}</span>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#374151", marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}>
                    <ShoppingBag style={{ width: 9, height: 9, color: "#6366F1" }} />
                    O que levar
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {details.oQueTrazer.slice(0, 4).map((item) => (
                      <span key={item} style={{
                        background: "#EEF2FF", border: "1px solid #C7D2FE",
                        borderRadius: 4, padding: "1px 5px",
                        fontSize: 9, color: "#4338CA", fontWeight: 600,
                      }}>{item}</span>
                    ))}
                  </div>
                </div>
                <div style={{ background: "#FFF7ED", borderRadius: 6, padding: "5px 8px", border: "1px solid #FED7AA", marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#92400E" }}>🍽 Alimentação: </span>
                  <span style={{ fontSize: 9, color: "#78350F" }}>{details.alimentacao}</span>
                </div>
                <div style={{ background: "#F5F3FF", borderRadius: 6, padding: "5px 8px", border: "1px solid #DDD6FE" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#5B21B6" }}>🅿 Estacionamento: </span>
                  <span style={{ fontSize: 9, color: "#4C1D95" }}>{details.estacionamento}</span>
                </div>
              </div>
            )}
          </>
        )}

        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
            {adjOriginal !== adjPrice && (
              <span style={{ fontSize: 11, color: "#9CA3AF", textDecoration: "line-through" }}>
                {formatPrice(adjOriginal)}
              </span>
            )}
            <span
              style={{ fontSize: 18, fontWeight: 800, color: "#16A34A" }}
              data-testid={`text-price-${ticket.id}`}
            >
              {formatPrice(adjPrice)}
            </span>
          </div>
          <span style={{ fontSize: 9, color: "#9CA3AF" }}>por pessoa</span>

          <div style={{ marginTop: 10 }}>
            {qty === 0 ? (
              <button
                data-testid={`button-buy-${ticket.id}`}
                onClick={() => onBuy(ticket)}
                style={{
                  width: "100%", padding: "12px 0", border: "none", borderRadius: 9,
                  minHeight: 44,
                  background: cabana
                    ? "linear-gradient(135deg, #16A34A, #15803D)"
                    : "linear-gradient(135deg, #0891B2, #2563EB)",
                  color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                }}
              >
                <ShoppingCart style={{ width: 15, height: 15 }} />
                Reservar
              </button>
            ) : (
              <div
                data-testid={`stepper-${ticket.id}`}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  border: "2px solid #22C55E", borderRadius: 9, background: "#F0FDF4", padding: "4px 6px",
                  minHeight: 44,
                }}
              >
                <button
                  type="button"
                  className="rsv-stepper-btn"
                  data-testid={`button-decrease-${ticket.id}`}
                  onClick={() => onDec(ticket, qty)}
                  style={{
                    borderRadius: 8,
                    background: qty === 1 ? "#FEE2E2" : "#DCFCE7",
                    color: qty === 1 ? "#EF4444" : "#16A34A",
                  }}
                >
                  {qty === 1 ? <Trash2 style={{ width: 15, height: 15 }} /> : <Minus style={{ width: 15, height: 15 }} />}
                </button>
                <span
                  style={{ fontSize: 13, fontWeight: 800, color: "#16A34A" }}
                  data-testid={`text-qty-${ticket.id}`}
                >
                  {qty}x
                </span>
                <button
                  type="button"
                  className="rsv-stepper-btn"
                  data-testid={`button-increase-${ticket.id}`}
                  onClick={() => onInc(ticket, qty)}
                  style={{
                    borderRadius: 8,
                    background: "#DCFCE7", color: "#16A34A",
                  }}
                >
                  <Plus style={{ width: 15, height: 15 }} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface CategoryAccordionProps {
  tickets: TicketItem[]
  cart: CartItem[]
  onBuy: (t: TicketItem) => void
  onInc: (t: TicketItem, qty: number) => void
  onDec: (t: TicketItem, qty: number) => void
  priceMultiplier: number
}

export function CategoryAccordion({
  tickets,
  cart,
  onBuy,
  onInc,
  onDec,
  priceMultiplier,
}: CategoryAccordionProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["ingresso-1-dia"])
  )

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev)
      const expanded = !next.has(id)
      if (!expanded) next.delete(id)
      else next.add(id)
      trackEvent("category_expand", { sectionId: id, expanded })
      return next
    })
  }

  const ticketsBySection = useMemo(() => {
    const map = new Map<string, TicketItem[]>()
    for (const s of CATEGORY_SECTIONS) map.set(s.id, [])
    for (const t of tickets) {
      const key = (t as TicketItem & { categorySection?: string }).categorySection ?? "ingresso-1-dia"
      if (map.has(key)) map.get(key)!.push(t)
      else if (map.has("ingresso-1-dia")) map.get("ingresso-1-dia")!.push(t)
    }
    return map
  }, [tickets])

  function getCartCountForSection(sectionId: string): number {
    const sectionTickets = ticketsBySection.get(sectionId) ?? []
    return sectionTickets.reduce((sum, t) => sum + getCartItemQty(cart, t.id), 0)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px 100px" }}>
      {CATEGORY_SECTIONS.map((section) => {
        const sectionTickets = ticketsBySection.get(section.id) ?? []
        if (sectionTickets.length === 0) return null
        const isOpen = openSections.has(section.id)
        const cartCount = getCartCountForSection(section.id)

        return (
          <div
            key={section.id}
            id={`section-${section.id}`}
            data-testid={`section-category-${section.id}`}
            style={{
              background: isOpen ? section.bgColor : "#fff",
              borderRadius: 14,
              border: `1.5px solid ${isOpen ? section.color + "40" : "#E5E7EB"}`,
              overflow: "hidden",
              transition: "all 0.2s",
            }}
          >
            <button
              data-testid={`button-accordion-${section.id}`}
              onClick={() => toggleSection(section.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px", background: "transparent",
                border: "none", cursor: "pointer", textAlign: "left",
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>{section.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>
                  {section.title}
                </div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}>
                  {section.subtitle}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {cartCount > 0 && (
                  <span
                    data-testid={`badge-cart-count-${section.id}`}
                    style={{
                      background: "#22C55E", color: "#fff",
                      fontSize: 11, fontWeight: 800,
                      padding: "3px 8px", borderRadius: 10,
                      minWidth: 22, textAlign: "center",
                    }}
                  >
                    {cartCount}
                  </span>
                )}
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: isOpen ? section.color : "#F3F4F6",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {isOpen
                    ? <ChevronUp style={{ width: 15, height: 15, color: "#fff" }} />
                    : <ChevronDown style={{ width: 15, height: 15, color: "#6B7280" }} />}
                </div>
              </div>
            </button>

            {isOpen && (
              <div style={{ padding: "0 12px 14px" }}>
                {section.grid ? (
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 16,
                  }}>
                    {sectionTickets.map((ticket) => (
                      <TicketGridCard
                        key={ticket.id}
                        ticket={ticket}
                        cart={cart}
                        onBuy={onBuy}
                        onInc={onInc}
                        onDec={onDec}
                        cabana={section.cabana}
                        priceMultiplier={priceMultiplier}
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {sectionTickets.map((ticket) => (
                      <TicketRowCard
                        key={ticket.id}
                        ticket={ticket}
                        cart={cart}
                        onBuy={onBuy}
                        onInc={onInc}
                        onDec={onDec}
                        cabana={section.cabana}
                        priceMultiplier={priceMultiplier}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
