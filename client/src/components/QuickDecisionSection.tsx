import { TrendingUp, Users, Star, Sparkles } from "lucide-react"

type QuickPick = "custo" | "familia" | "popular" | "combo"

interface QuickDecisionSectionProps {
  onPick: (pick: QuickPick) => void
  /** Limpa a escolha rápida (Hick: reabre o grid de 4) */
  onClearPick?: () => void
  activePick?: QuickPick | null
}

const OPTIONS: {
  key: QuickPick
  label: string
  desc: string
  icon: typeof TrendingUp
  testId: string
  color: string
  bg: string
}[] = [
  {
    key: "custo",
    label: "Melhor custo-benefício",
    desc: "Mais desconto pelo preço",
    icon: TrendingUp,
    testId: "quick-custo",
    color: "#16A34A",
    bg: "#F0FDF4",
  },
  {
    key: "familia",
    label: "Vou com crianças",
    desc: "Ideal para família",
    icon: Users,
    testId: "quick-familia",
    color: "#2563EB",
    bg: "#EFF6FF",
  },
  {
    key: "popular",
    label: "Mais popular",
    desc: "O favorito dos viajantes",
    icon: Star,
    testId: "quick-popular",
    color: "#D97706",
    bg: "#FFFBEB",
  },
  {
    key: "combo",
    label: "Quero combo",
    desc: "Economize combinando",
    icon: Sparkles,
    testId: "quick-combo",
    color: "#0891B2",
    bg: "#F0F9FF",
  },
]

/** Fase 6 / Hick: após escolha, colapsa para 1 chip ativo + “Trocar” (reduz 4→1 decisão). */
export function QuickDecisionSection({ onPick, onClearPick, activePick }: QuickDecisionSectionProps) {
  const active = OPTIONS.find((o) => o.key === activePick) ?? null

  if (active) {
    const Icon = active.icon
    return (
      <div style={{ padding: "0 16px 4px" }} data-testid="quick-decision-collapsed">
        <p style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#6B7280",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 8,
        }}>
          Sua escolha rápida
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            data-testid={active.testId}
            style={{
              flex: 1,
              background: active.color,
              border: `1.5px solid ${active.color}`,
              borderRadius: 12,
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              minHeight: 44,
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "rgba(255,255,255,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Icon style={{ width: 16, height: 16, color: "#fff" }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{active.label}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", marginTop: 1 }}>{active.desc}</div>
            </div>
          </div>
          <button
            type="button"
            data-testid="quick-change-pick"
            onClick={() => {
              if (onClearPick) onClearPick()
              else onPick(active.key)
            }}
            style={{
              flexShrink: 0,
              border: "1.5px solid #E5E7EB",
              background: "#fff",
              borderRadius: 12,
              padding: "10px 12px",
              fontSize: 12,
              fontWeight: 700,
              color: "#374151",
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            Trocar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: "0 16px 4px" }} data-testid="quick-decision-expanded">
      <p style={{
        fontSize: 11,
        fontWeight: 700,
        color: "#6B7280",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginBottom: 8,
      }}>
        Escolha rápida
      </p>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 8,
      }}>
        {OPTIONS.map(({ key, label, desc, icon: Icon, testId, color, bg }) => (
          <button
            key={key}
            data-testid={testId}
            onClick={() => onPick(key)}
            style={{
              background: bg,
              border: "1.5px solid transparent",
              borderRadius: 12,
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
              minHeight: 44,
            }}
          >
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `${color}20`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}>
              <Icon style={{ width: 16, height: 16, color }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1F2937", lineHeight: 1.2 }}>
                {label}
              </div>
              <div style={{ fontSize: 10, color: "#6B7280", marginTop: 1 }}>
                {desc}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
