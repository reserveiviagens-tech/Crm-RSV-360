import { useMemo } from "react"
import { useLocation } from "wouter"
import { useHomeSectionPlacements } from "@/hooks/useHomeSectionPlacements"
import { CardMedia, homeMediaAlt } from "@/components/home/CardMedia"

const PARKS = [
  {
    id: "hot-park",
    name: "Hot Park",
    description: "O parque mais famoso da região, ideal para famílias e quem quer experiência premium.",
    image: "/images/hot-park.jpeg",
    seal: "Mais procurado",
    sealColor: "#DC2626",
    priceFrom: "R$ 99",
    forWho: "Famílias e aventureiros",
    destino: "rio-quente",
  },
  {
    id: "diroma",
    name: "diRoma Acqua Park",
    description: "Ótima opção para quem busca diversão com bom custo-benefício em Caldas Novas.",
    image: "/images/diroma-acqua-park.jpeg",
    seal: "Bom custo-benefício",
    sealColor: "#16A34A",
    priceFrom: "R$ 63",
    forWho: "Para toda a família",
    destino: "caldas-novas",
  },
  {
    id: "lagoa-termas",
    name: "Lagoa Termas Parques",
    description: "Águas termais e ambiente mais tranquilo para relaxar em meio à natureza.",
    image: "/images/lagoa-termas-parque.jpeg",
    seal: "Relaxar e curtir",
    sealColor: "#0891B2",
    priceFrom: "R$ 53",
    forWho: "Casais e famílias",
    destino: "caldas-novas",
  },
  {
    id: "kawana",
    name: "Kawana Park",
    description: "Perfil mais aventureiro com atrações radicais e muita energia para curtir o dia.",
    image: "/images/kawana-park.jpeg",
    seal: "Para aventureiros",
    sealColor: "#7C3AED",
    priceFrom: "R$ 72",
    forWho: "Quem gosta de emoção",
    destino: "caldas-novas",
  },
]

export function ParksSection() {
  const [, navigate] = useLocation()
  const { placements } = useHomeSectionPlacements("destinos")

  const cards = useMemo(() => {
    if (!placements.length) {
      return PARKS.map((park) => ({
        ...park,
        href: `/parques?parque=${park.id}&destino=${park.destino}`,
      }))
    }
    return placements.map((row, index) => {
      const base = PARKS.find((p) => p.id === row.entityId) ?? PARKS[index % PARKS.length]
      return {
        ...base,
        id: row.entityId,
        name: row.titleOverride || base.name,
        description: row.subtitleOverride || base.description,
        seal: row.badgeText || base.seal,
        image: row.imageUrl || base.image,
        href:
          row.ctaHref ||
          `/parques?parque=${encodeURIComponent(row.entityId)}&destino=${base.destino}`,
      }
    })
  }, [placements])

  return (
    <section
      id="parques"
      data-testid="landing-parks"
      style={{ background: "#F9FAFB", padding: "64px 20px" }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <span style={{
            display: "inline-block",
            background: "#FFF7ED", color: "#F57C00",
            fontWeight: 700, fontSize: 12, letterSpacing: 1,
            padding: "5px 14px", borderRadius: 20, marginBottom: 12,
            textTransform: "uppercase",
          }}>
            Destinos em destaque
          </span>
          <h2
            data-testid="parks-section-title"
            style={{ fontSize: 32, fontWeight: 900, color: "#111827", letterSpacing: -0.5 }}
          >
            Conheça os parques mais procurados da região
          </h2>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 20,
        }}
          className="parks-grid"
        >
          {cards.map(park => (
            <div
              key={park.id}
              data-testid={`park-card-${park.id}`}
              style={{
                background: "#fff",
                borderRadius: 20,
                overflow: "hidden",
                boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
                border: "1px solid #F3F4F6",
                transition: "transform 0.2s, box-shadow 0.2s",
                display: "flex", flexDirection: "column",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-6px)"
                e.currentTarget.style.boxShadow = "0 16px 40px rgba(0,0,0,0.13)"
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = ""
                e.currentTarget.style.boxShadow = "0 2px 16px rgba(0,0,0,0.07)"
              }}
            >
              <div style={{ position: "relative", height: 180, overflow: "hidden" }}>
                <CardMedia
                  src={park.image}
                  alt={homeMediaAlt(park.name, park.description)}
                  width={1200}
                  height={675}
                />
                <div style={{
                  position: "absolute", top: 12, left: 12,
                  background: park.sealColor, color: "#fff",
                  fontSize: 11, fontWeight: 800, letterSpacing: 0.3,
                  padding: "4px 10px", borderRadius: 20,
                }}>
                  {park.seal}
                </div>
              </div>

              <div style={{ padding: "16px 16px 20px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: 0 }}>{park.name}</h3>
                <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.55, margin: 0, flex: 1 }}>{park.description}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                    ✅ {park.forWho}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#6B7280" }}>a partir de</span>
                    <span style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>{park.priceFrom}</span>
                  </div>
                </div>
                <button
                  data-testid={`park-card-cta-${park.id}`}
                  onClick={() => navigate(park.href)}
                  style={{
                    marginTop: 8,
                    width: "100%", padding: "11px 0",
                    border: "none", borderRadius: 10,
                    background: "linear-gradient(135deg, #2563EB, #1E40AF)",
                    color: "#fff", fontWeight: 700, fontSize: 13,
                    cursor: "pointer", transition: "opacity 0.2s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.90")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                >
                  Ver ingressos
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .parks-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 560px) {
          .parks-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
