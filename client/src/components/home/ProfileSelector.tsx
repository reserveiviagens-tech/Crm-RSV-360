import { useMemo } from "react"
import { useLocation } from "wouter"
import { useHomeSectionPlacements } from "@/hooks/useHomeSectionPlacements"
import { CardMedia, homeMediaAlt } from "@/components/home/CardMedia"

const PROFILES = [
  {
    id: "economia",
    emoji: "💰",
    title: "Melhor custo-benefício",
    description: "Ideal para quem quer economizar sem perder a diversão.",
    color: "#16A34A",
    bg: "#F0FDF4",
    border: "#BBF7D0",
  },
  {
    id: "familia",
    emoji: "👨‍👩‍👧‍👦",
    title: "Vou com crianças",
    description: "Parques e opções mais procuradas por famílias.",
    color: "#2563EB",
    bg: "#EFF6FF",
    border: "#BFDBFE",
  },
  {
    id: "popular",
    emoji: "🔥",
    title: "Mais popular",
    description: "Os ingressos mais reservados por viajantes.",
    color: "#EA580C",
    bg: "#FFF7ED",
    border: "#FED7AA",
  },
  {
    id: "combo",
    emoji: "🎯",
    title: "Quero combo",
    description: "Combine parques e economize mais.",
    color: "#7C3AED",
    bg: "#F5F3FF",
    border: "#DDD6FE",
  },
  {
    id: "relaxar",
    emoji: "🧘",
    title: "Quero relaxar",
    description: "Águas quentes, lazer e menos correria.",
    color: "#0891B2",
    bg: "#ECFEFF",
    border: "#A5F3FC",
  },
  {
    id: "aventura",
    emoji: "🏄",
    title: "Quero aventura",
    description: "Opções para quem busca mais emoção.",
    color: "#DC2626",
    bg: "#FEF2F2",
    border: "#FECACA",
  },
]

export function ProfileSelector() {
  const [, navigate] = useLocation()
  const { placements } = useHomeSectionPlacements("escolhas")

  const cards = useMemo(() => {
    if (!placements.length) {
      return PROFILES.map((p) => ({
        ...p,
        badge: null as string | null,
        image: null as string | null,
        href: `/experiencias?perfil=${p.id}`,
      }))
    }
    return placements.map((row, index) => {
      const base = PROFILES.find((p) => p.id === row.entityId) ?? PROFILES[index % PROFILES.length]
      return {
        ...base,
        id: row.entityId,
        title: row.titleOverride || base.title,
        description: row.subtitleOverride || base.description,
        badge: row.badgeText || null,
        image: row.imageUrl || null,
        href: row.ctaHref || `/experiencias?perfil=${encodeURIComponent(row.entityId)}`,
      }
    })
  }, [placements])

  return (
    <section
      id="perfil"
      data-testid="landing-profile-selector"
      style={{ background: "#fff", padding: "64px 20px" }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <span style={{
            display: "inline-block",
            background: "#EFF6FF", color: "#2563EB",
            fontWeight: 700, fontSize: 12, letterSpacing: 1,
            padding: "5px 14px", borderRadius: 20, marginBottom: 12,
            textTransform: "uppercase",
          }}>
            Escolha personalizada
          </span>
          <h2
            data-testid="profile-section-title"
            style={{ fontSize: 32, fontWeight: 900, color: "#111827", marginBottom: 12, letterSpacing: -0.5 }}
          >
            Qual experiência combina mais com sua viagem?
          </h2>
          <p style={{ fontSize: 16, color: "#6B7280", maxWidth: 520, margin: "0 auto" }}>
            Escolha a forma mais fácil de encontrar os ingressos ideais para seu passeio.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}
          className="profile-grid"
        >
          {cards.map(p => (
            <button
              key={p.id}
              data-testid={`profile-card-${p.id}`}
              onClick={() => navigate(p.href)}
              style={{
                background: p.bg,
                border: `1.5px solid ${p.border}`,
                borderRadius: 16,
                padding: "22px 20px",
                textAlign: "left",
                cursor: "pointer",
                transition: "transform 0.18s, box-shadow 0.18s",
                display: "flex", flexDirection: "column", gap: 8,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-4px)"
                e.currentTarget.style.boxShadow = `0 8px 28px ${p.color}22`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = ""
                e.currentTarget.style.boxShadow = ""
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                {p.image ? (
                  <div style={{ width: 40, height: 40, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
                    <CardMedia
                      src={p.image}
                      alt={homeMediaAlt(p.title, p.description)}
                      width={80}
                      height={80}
                    />
                  </div>
                ) : (
                  <span style={{ fontSize: 32 }}>{p.emoji}</span>
                )}
                {p.badge ? (
                  <span style={{
                    background: `${p.color}18`, color: p.color,
                    fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 12,
                  }}>
                    {p.badge}
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: p.color }}>{p.title}</div>
              <div style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.5 }}>{p.description}</div>
              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 12, fontWeight: 700, color: p.color, marginTop: 4,
              }}>
                Ver opções →
              </div>
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .profile-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .profile-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
