import { ShoppingCart, ArrowRight } from "lucide-react"
import { type CartItem } from "@/lib/cart-store"
import { trackEvent } from "@/lib/analytics"
import { GoalProgressBar } from "@/components/checkout/GoalProgressBar"

interface CartStickyBarProps {
  cart: CartItem[]
  total: number
  onCheckout: () => void
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price)
}

export function CartStickyBar({ cart, total, onCheckout }: CartStickyBarProps) {
  if (!cart || cart.length === 0) return null

  const itemsCount = cart.reduce((sum, it) => sum + it.quantity, 0)
  const summary = cart.map((it) => `${it.name} x${it.quantity}`).join(" • ")

  function handleCheckout() {
    trackEvent("tickets_checkout_start", { total, items: cart.length })
    onCheckout()
  }

  return (
    <div
      data-testid="cart-sticky"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 220,
        background: "linear-gradient(135deg, #0891B2, #2563EB)",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
        padding: "10px 16px 12px",
        paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div style={{ maxWidth: 960, width: "100%", margin: "0 auto 8px" }}>
        <GoalProgressBar
          stage="cart"
          tone="onDark"
          compact
          testId="cart-goal-progress"
        />
      </div>

      <div
        style={{
          maxWidth: 960,
          width: "100%",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            background: "rgba(255,255,255,0.2)",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <ShoppingCart style={{ width: 18, height: 18, color: "#fff" }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
            {itemsCount} {itemsCount === 1 ? "ingresso" : "ingressos"} · {formatPrice(total)}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.8)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontWeight: 600,
            }}
            data-testid="cart-zeigarnik-copy"
          >
            Reserva incompleta — finalize agora
          </div>
          <div
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.65)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {summary}
          </div>
        </div>

        <button
          data-testid="button-go-checkout"
          onClick={handleCheckout}
          style={{
            background: "#fff",
            color: "#0891B2",
            border: "none",
            borderRadius: 12,
            padding: "12px 16px",
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
            minHeight: 48,
            boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
            flexShrink: 0,
          }}
        >
          Continuar
          <ArrowRight style={{ width: 14, height: 14 }} />
        </button>
      </div>
    </div>
  )
}
