import { useMemo } from "react"
import { useLocation } from "wouter"
import { Users, Calendar, Building } from "lucide-react"
import { useHomeSectionPlacements } from "@/hooks/useHomeSectionPlacements"
import { CardMedia, homeMediaAlt } from "@/components/home/CardMedia"

const COMBOS = [
  {
    id: "familia",
    icon: Users,
    title: "Combo Família",
    description: "Ideal para quem vai com crianças e quer praticidade. 2 adultos + 1 criança com acesso completo.",
    economy: "Economize até 16%",
    badge: "Mais escolhido",
    badgeColor: "#2563EB",
    highlight: false,
  },
  {
    id: "destaque",
    icon: Calendar,
    title: "Combo Semana Completa",
    description: "Mais economia para quem vai aproveitar vários dias. 3 parques em dias diferentes.",
    economy: "Economize até 19%",
    badge: "Melhor valor",
    badgeColor: "#F57C00",
    highlight: true,
  },
  {
    id: "para-voce",
    icon: Building,
    title: "Combo Parque + Hotel",
    description: "Perfeito para quem quer resolver tudo em um só lugar. Parque + 1 noite em hotel 4★.",
    economy: "Economize até 21%",
    badge: "Experiência completa",
    badgeColor: "#16A34A",
    highlight: false,
  },
]

export function CombosSection() {
  const [, navigate] = useLocation()
  const { placements } = useHomeSectionPlacements("ofertas")

  const cards = useMemo(() => {
    if (!placements.length) {
      return COMBOS.map((combo) => ({
        ...combo,
        imageUrl: null as string | null,
        href: `/ofertas?combo=${combo.id}`,
      }))
    }
    return placements.map((row, index) => {
      const base = COMBOS.find((c) => c.id === row.entityId) ?? COMBOS[index % COMBOS.length]
      return {
        ...base,
        id: row.entityId,
        title: row.titleOverride || base.title,
        description: row.subtitleOverride || base.description,
        badge: row.badgeText || base.badge,
        imageUrl: row.imageUrl || null,
        href: row.ctaHref || `/ofertas?combo=${encodeURIComponent(row.entityId)}`,
      }
    })
  }, [placements])

  return (
    <section
      id="combos"
      data-testid="landing-combos"
      style={{ background: "#F9FAFB", padding: "64px 20px" }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{
            display: "inline-block",
            background: "#F5F3FF", color: "#7C3AED",
            fontWeight: 700, fontSize: 12, letterSpacing: 1,
            padding: "5px 14px", borderRadius: 20, marginBottom: 12,
            textTransform: "uppercase",
          }}>
            Ofertas estratégicas
          </span>
          <h2
            data-testid="combos-section-title"
            style={{ fontSize: 32, fontWeight: 900, color: "#111827", marginBottom: 10, letterSpacing: -0.5 }}
          >
            Economize mais com combos inteligentes
          </h2>
          <p style={{ fontSize: 16, color: "#6B7280" }}>
            Combine parques e aproveite melhor sua viagem pagando menos.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 20,
        }}
          className="combos-grid"
        >
          {cards.map(combo => (
            <div
              key={combo.id}
              data-testid={`combo-card-${combo.id}`}
              style={{
                background: combo.highlight
                  ? "linear-gradient(135deg, #7C3AED, #DB2777)"
                  : "#fff",
                border: combo.highlight ? "none" : "1.5px solid #F3F4F6",
                borderRadius: 20,
                padding: "28px 24px",
                display: "flex", flexDirection: "column", gap: 12,
                boxShadow: combo.highlight
                  ? "0 8px 32px rgba(124,58,237,0.35)"
                  : "0 2px 12px rgba(0,0,0,0.05)",
                position: "relative",
                overflow: "hidden",
                transition: "transform 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)" }}
              onMouseLeave={e => { e.currentTarget.style.transform = "" }}
            >
              {combo.highlight && (
                <div style={{
                  position: "absolute", top: -20, right: -20,
                  width: 100, height: 100, borderRadius: "50%",
                  background: "rgba(255,255,255,0.08)", pointerEvents: "none",
                }} />
              )}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: combo.highlight ? "rgba(255,255,255,0.2)" : `${combo.badgeColor}15`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                }}>
                  {combo.imageUrl ? (
                    <CardMedia
                      src={combo.imageUrl}
                      alt={homeMediaAlt(combo.title, combo.description)}
                      width={88}
                      height={88}
                    />
                  ) : (
                    <combo.icon style={{
                      width: 20, height: 20,
                      color: combo.highlight ? "#fff" : combo.badgeColor,
                    }} />
                  )}
                </div>
                <span style={{
                  background: combo.highlight ? "rgba(255,255,255,0.20)" : `${combo.badgeColor}15`,
                  color: combo.highlight ? "#fff" : combo.badgeColor,
                  fontSize: 11, fontWeight: 800, letterSpacing: 0.3,
                  padding: "4px 10px", borderRadius: 20,
                }}>
                  {combo.badge}
                </span>
              </div>
              <h3 style={{
                fontSize: 18, fontWeight: 900,
                color: combo.highlight ? "#fff" : "#111827",
                margin: 0,
              }}>
                {combo.title}
              </h3>
              <p style={{
                fontSize: 13, lineHeight: 1.6, margin: 0,
                color: combo.highlight ? "rgba(255,255,255,0.85)" : "#6B7280",
              }}>
                {combo.description}
              </p>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: combo.highlight ? "rgba(255,255,255,0.15)" : "#F0FDF4",
                borderRadius: 8, padding: "6px 12px", width: "fit-content",
              }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: combo.highlight ? "#fff" : "#16A34A" }}>
                  ✅ {combo.economy}
                </span>
              </div>
              <button
                data-testid={`combo-card-cta-${combo.id}`}
                onClick={() => navigate(combo.href)}
                style={{
                  marginTop: 4,
                  width: "100%", padding: "13px 0",
                  border: combo.highlight ? "2px solid rgba(255,255,255,0.4)" : "none",
                  borderRadius: 12,
                  background: combo.highlight ? "rgba(255,255,255,0.15)" : "linear-gradient(135deg, #7C3AED, #DB2777)",
                  color: "#fff",
                  fontWeight: 800, fontSize: 14,
                  cursor: "pointer",
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                Quero ver combos
              </button>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .combos-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
