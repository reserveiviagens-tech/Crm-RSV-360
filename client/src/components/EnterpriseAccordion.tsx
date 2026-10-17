import { useState, useMemo, type ReactNode } from "react"
import { ChevronDown, ChevronUp, Ticket } from "lucide-react"
import { type CartItem, getCartItemQty } from "@/lib/cart-store"
import { type TicketItem } from "@/components/TicketsGrid"
import { ENTERPRISE_CONFIG, type EnterpriseId } from "@/lib/enterprises"
import { TicketRowCard, TicketGridCard } from "@/components/CategoryAccordion"
import { trackEvent } from "@/lib/analytics"
import { EmptyState } from "@/components/shells"

interface SubGroupConfig {
  label: string
  useGrid: boolean
  cabana: boolean
  order: number
}

const SUB_GROUP_CONFIG: Record<string, SubGroupConfig> = {
  individual: { label: "🎟️ Individual / Padrão", useGrid: true, cabana: false, order: 0 },
  especiais: { label: "⭐ Especiais & VIP", useGrid: true, cabana: false, order: 1 },
  combos: { label: "✨ Combos Multi-Parque", useGrid: true, cabana: false, order: 2 },
  transporte: { label: "🚌 Transporte", useGrid: true, cabana: false, order: 3 },
  cabanas: { label: "🏕️ Cabanas Exclusivas", useGrid: true, cabana: true, order: 4 },
  morador: { label: "🏠 Desconto Morador", useGrid: true, cabana: false, order: 5 },
  meia: { label: "🆔 Meia-Entrada Legal", useGrid: true, cabana: false, order: 6 },
}

function getSubGroupKey(t: TicketItem): string {
  if (t.ticketCategory === "morador") return "morador"
  if (t.ticketCategory === "meia-entrada") return "meia"
  if (t.categorySection === "especiais") return "especiais"
  if (t.categorySection === "cabanas") return "cabanas"
  if (t.categorySection === "combos") return "combos"
  if (t.categorySection === "transporte") return "transporte"
  return "individual"
}

interface EnterpriseAccordionProps {
  tickets: TicketItem[]
  cart: CartItem[]
  onBuy: (t: TicketItem) => void
  onInc: (t: TicketItem, qty: number) => void
  onDec: (t: TicketItem, qty: number) => void
  priceMultiplier: number
  /** Master Plan PHASE_2: render after the first park accordion (e.g. Combo IA) */
  afterFirstEnterprise?: ReactNode
}

export function EnterpriseAccordion({
  tickets,
  cart,
  onBuy,
  onInc,
  onDec,
  priceMultiplier,
  afterFirstEnterprise,
}: EnterpriseAccordionProps) {
  const ticketsByEnterprise = useMemo(() => {
    const map = new Map<EnterpriseId, TicketItem[]>()
    for (const e of ENTERPRISE_CONFIG) map.set(e.id, [])
    for (const t of tickets) {
      const eids: string[] = t.enterprises ?? (t.enterprise ? [t.enterprise] : [])
      for (const eid of eids) {
        if (map.has(eid as EnterpriseId)) {
          map.get(eid as EnterpriseId)!.push(t)
        }
      }
    }
    return map
  }, [tickets])

  const activeEnterprises = useMemo(() =>
    ENTERPRISE_CONFIG.filter(e => (ticketsByEnterprise.get(e.id) ?? []).length > 0),
    [ticketsByEnterprise]
  )

  const [openEnterprises, setOpenEnterprises] = useState<Set<string>>(() => {
    const first = ENTERPRISE_CONFIG.find(e =>
      tickets.some(t => t.enterprise === e.id)
    )
    return new Set(first ? [first.id] : [])
  })

  /** Fase 6 / Hick: um parque aberto por vez (acordeão exclusivo) */
  function toggleEnterprise(id: string) {
    setOpenEnterprises(prev => {
      const isOpen = prev.has(id)
      const next = isOpen ? new Set<string>() : new Set([id])
      trackEvent("enterprise_expand", { enterpriseId: id, expanded: !isOpen })
      return next
    })
  }

  if (activeEnterprises.length === 0) {
    return (
      <EmptyState
        data-testid="empty-state-tickets"
        icon={<Ticket className="w-6 h-6" />}
        title="Nenhum ingresso encontrado"
        description="Tente ajustar os filtros ou selecionar outra cidade para ver os ingressos disponíveis."
        className="py-16 px-4"
      />
    )
  }

  function renderTicketGrid(subTickets: TicketItem[], cabana: boolean) {
    return (
      <div className="v13-tickets-grid">
        {subTickets.map((ticket: TicketItem) => (
          <TicketGridCard
            key={ticket.id}
            ticket={ticket}
            cart={cart}
            onBuy={onBuy}
            onInc={onInc}
            onDec={onDec}
            cabana={cabana}
            priceMultiplier={priceMultiplier}
          />
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 16px 100px" }}>
      {activeEnterprises.map((enterprise, enterpriseIndex) => {
        const enterpriseTickets = ticketsByEnterprise.get(enterprise.id) ?? []
        const isOpen = openEnterprises.has(enterprise.id)
        const cartCount = enterpriseTickets.reduce((s, t) => s + getCartItemQty(cart, t.id), 0)
        const maxDiscount = enterpriseTickets.length > 0
          ? Math.max(...enterpriseTickets.map(t => t.discount))
          : 0

        const subGroupMap = new Map<string, TicketItem[]>()
        for (const t of enterpriseTickets) {
          const key = getSubGroupKey(t)
          if (!subGroupMap.has(key)) subGroupMap.set(key, [])
          subGroupMap.get(key)!.push(t)
        }
        const sortedSubGroups = Array.from(subGroupMap.entries()).sort(
          ([a], [b]) => (SUB_GROUP_CONFIG[a]?.order ?? 99) - (SUB_GROUP_CONFIG[b]?.order ?? 99)
        )
        const hasMultipleSubGroups = sortedSubGroups.length > 1

        return (
          <div key={enterprise.id}>
            <div
              id={`section-enterprise-${enterprise.id}`}
              data-testid={`section-enterprise-${enterprise.id}`}
              style={{
                background: isOpen ? enterprise.bgColor : "#fff",
                borderRadius: 16,
                border: `1.5px solid ${isOpen ? enterprise.color + "40" : "#E5E7EB"}`,
                overflow: "hidden",
                transition: "all 0.2s",
              }}
            >
              <button
                data-testid={`button-enterprise-${enterprise.id}`}
                onClick={() => toggleEnterprise(enterprise.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "16px 16px",
                  minHeight: 56,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: isOpen ? enterprise.color : "#F3F4F6",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, transition: "background 0.2s",
                }}>
                  {enterprise.emoji}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 15, fontWeight: 800, color: "#111827",
                    lineHeight: 1.2, marginBottom: 3,
                  }}>
                    {enterprise.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.3 }}>
                    {enterprise.description}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: "#EF4444",
                      background: "#FEE2E2", padding: "2px 7px", borderRadius: 5,
                    }}>
                      até -{maxDiscount}% OFF
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: "#6B7280",
                      background: "#F3F4F6", padding: "2px 7px", borderRadius: 5,
                    }}>
                      {enterpriseTickets.length} {enterpriseTickets.length === 1 ? "opção" : "opções"}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {cartCount > 0 && (
                    <span
                      data-testid={`badge-cart-count-enterprise-${enterprise.id}`}
                      style={{
                        background: "#22C55E", color: "#fff",
                        fontSize: 11, fontWeight: 800,
                        padding: "3px 9px", borderRadius: 10,
                        minWidth: 22, textAlign: "center",
                      }}
                    >
                      {cartCount}
                    </span>
                  )}
                  <div style={{
                    width: 30, height: 30, borderRadius: 9,
                    background: isOpen ? enterprise.color : "#F3F4F6",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.2s",
                  }}>
                    {isOpen
                      ? <ChevronUp style={{ width: 15, height: 15, color: "#fff" }} />
                      : <ChevronDown style={{ width: 15, height: 15, color: "#6B7280" }} />
                    }
                  </div>
                </div>
              </button>

              {isOpen && (
                <div style={{ padding: "0 12px 16px" }}>
                  {sortedSubGroups.map(([subGroupKey, subTickets]) => {
                    const config = SUB_GROUP_CONFIG[subGroupKey] ?? {
                      label: subGroupKey, useGrid: true, cabana: false, order: 99,
                    }
                    const isMeia = subGroupKey === "meia"

                    const cards = config.useGrid
                      ? renderTicketGrid(subTickets, config.cabana)
                      : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {subTickets.map((ticket: TicketItem) => (
                            <TicketRowCard
                              key={ticket.id}
                              ticket={ticket}
                              cart={cart}
                              onBuy={onBuy}
                              onInc={onInc}
                              onDec={onDec}
                              cabana={config.cabana}
                              priceMultiplier={priceMultiplier}
                            />
                          ))}
                        </div>
                      )

                    if (isMeia) {
                      return (
                        <details
                          key={subGroupKey}
                          className="mt-2 border border-slate-200 rounded-xl p-3 bg-slate-50/80"
                          data-testid={`details-meia-entrada-${enterprise.id}`}
                          style={{ marginBottom: hasMultipleSubGroups ? 14 : 0 }}
                        >
                          <summary className="text-xs font-semibold text-blue-600 cursor-pointer select-none hover:underline">
                            Ver {subTickets.length} opções de Meia-Entrada Legal (Idoso, Estudante, PCD, Professor) ▾
                          </summary>
                          <div className="mt-3">{cards}</div>
                        </details>
                      )
                    }

                    return (
                      <div key={subGroupKey} style={{ marginBottom: hasMultipleSubGroups ? 14 : 0 }}>
                        {hasMultipleSubGroups && (
                          <div style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "8px 4px", marginBottom: 8,
                          }}>
                            <div style={{ flex: 1, height: 1, background: enterprise.color + "30" }} />
                            <span style={{
                              fontSize: 10, fontWeight: 700,
                              color: enterprise.color,
                              letterSpacing: 0.5, whiteSpace: "nowrap",
                              textTransform: "uppercase",
                            }}>
                              {config.label}
                            </span>
                            <div style={{ flex: 1, height: 1, background: enterprise.color + "30" }} />
                          </div>
                        )}
                        {cards}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            {enterpriseIndex === 0 && afterFirstEnterprise}
          </div>
        )
      })}
    </div>
  )
}
