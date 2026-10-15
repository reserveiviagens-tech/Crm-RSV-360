import { Link } from "wouter"
import { CheckCircle, Phone } from "lucide-react"
import { CardMedia, homeMediaAlt } from "@/components/home/CardMedia"
import { useHomeSectionPlacements } from "@/hooks/useHomeSectionPlacements"

const WA_URL = "https://wa.me/5564993197555?text=Olá! Preciso de uma sugestão de parque para minha viagem."

const DEFAULT_BADGE = "🔥 INGRESSOS COM ATÉ 48% OFF"
const DEFAULT_TITLE =
  "Ingressos com desconto para os melhores parques de Caldas Novas e Rio Quente"
const DEFAULT_SUBTITLE =
  "Compare parques, encontre a melhor opção para sua viagem e reserve com suporte rápido no WhatsApp."
const DEFAULT_CTA_HREF = "/ingressos"
const DEFAULT_CTA_LABEL = "🎟️ Ver ingressos com desconto"
const DEFAULT_FLOAT_LABEL = "Destinos mais procurados"
const DEFAULT_FLOAT_VALUE = "Caldas Novas & Rio Quente"

export function HeroSection() {
  const { placements, loaded } = useHomeSectionPlacements("hero")
  const hero = placements[0]

  const badge = hero?.badgeText?.trim() || DEFAULT_BADGE
  const title = hero?.titleOverride?.trim() || DEFAULT_TITLE
  const subtitle = hero?.subtitleOverride?.trim() || DEFAULT_SUBTITLE
  const ctaHref = hero?.ctaHref?.trim() || DEFAULT_CTA_HREF
  const mediaUrl = hero?.imageUrl?.trim() || null
  const mediaAlt = homeMediaAlt(
    hero?.titleOverride?.trim() || "Parques aquáticos",
    hero?.subtitleOverride || "Caldas Novas e Rio Quente",
  )
  const floatLabel = hero?.badgeText?.trim() ? "Destaque" : DEFAULT_FLOAT_LABEL
  const floatValue = hero?.titleOverride?.trim() || DEFAULT_FLOAT_VALUE

  // Headline with branded city names when using the default copy
  const renderTitle = () => {
    if (hero?.titleOverride?.trim()) {
      return title
    }
    return (
      <>
        Ingressos com desconto para os melhores parques de{" "}
        <span style={{ color: "#FBBF24" }}>Caldas Novas</span> e{" "}
        <span style={{ color: "#FBBF24" }}>Rio Quente</span>
      </>
    )
  }

  return (
    <section
      data-testid="landing-hero"
      style={{
        background: "linear-gradient(135deg, #0F2744 0%, #1E3A5F 50%, #1D4ED8 100%)",
        padding: "60px 20px 70px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "rgba(245,124,0,0.08)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -80,
          left: -40,
          width: 250,
          height: 250,
          borderRadius: "50%",
          background: "rgba(37,99,235,0.12)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 48,
          alignItems: "center",
        }}
        className="hero-grid"
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(245,124,0,0.15)",
              border: "1px solid rgba(245,124,0,0.3)",
              borderRadius: 20,
              padding: "5px 12px",
              marginBottom: 20,
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: "#FDBA74",
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              {badge}
            </span>
          </div>

          <h1
            data-testid="hero-headline"
            style={{
              fontSize: 40,
              fontWeight: 900,
              color: "#fff",
              lineHeight: 1.15,
              marginBottom: 18,
              letterSpacing: -1,
            }}
            className="hero-headline"
          >
            {renderTitle()}
          </h1>

          <p
            data-testid="hero-subtitle"
            style={{
              fontSize: 17,
              color: "rgba(255,255,255,0.80)",
              lineHeight: 1.65,
              marginBottom: 32,
            }}
            className="hero-subtitle"
          >
            {subtitle}
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
            <Link href={ctaHref.startsWith("/") ? ctaHref : DEFAULT_CTA_HREF}>
              <button
                data-testid="hero-cta-primary"
                style={{
                  padding: "15px 28px",
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #F57C00, #EA580C)",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 15,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 4px 24px rgba(245,124,0,0.40)",
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)"
                  e.currentTarget.style.boxShadow = "0 8px 30px rgba(245,124,0,0.50)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = ""
                  e.currentTarget.style.boxShadow = "0 4px 24px rgba(245,124,0,0.40)"
                }}
              >
                {DEFAULT_CTA_LABEL}
              </button>
            </Link>
            <a
              href={WA_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="hero-cta-whatsapp"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "15px 24px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.12)",
                border: "1.5px solid rgba(255,255,255,0.25)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 15,
                textDecoration: "none",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.18)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            >
              <Phone style={{ width: 16, height: 16 }} />
              Falar com especialista
            </a>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {["Compra simples e segura", "Atendimento rápido", "Ofertas e combos exclusivos"].map(
              (item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle
                    style={{ width: 15, height: 15, color: "#4ADE80", flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.80)", fontWeight: 600 }}>
                    {item}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>

        <div
          data-testid="hero-image-container"
          style={{
            position: "relative",
            borderRadius: 20,
            overflow: "hidden",
            minHeight: 420,
            background: mediaUrl
              ? "#0F2744"
              : "linear-gradient(145deg, #1E3A5F 0%, #1D4ED8 55%, #0F2744 100%)",
          }}
          className="hero-image-col"
        >
          {mediaUrl ? (
            <CardMedia
              src={mediaUrl}
              alt={mediaAlt}
              width={1600}
              height={900}
              style={{ width: "100%", height: 420, borderRadius: 20 }}
            />
          ) : (
            <div
              data-testid="hero-image-fallback"
              aria-hidden={!loaded}
              style={{
                width: "100%",
                height: 420,
                display: "flex",
                alignItems: "flex-end",
                padding: 24,
                color: "rgba(255,255,255,0.85)",
                fontWeight: 700,
                fontSize: 18,
              }}
            >
              Caldas Novas & Rio Quente
            </div>
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 20,
              background: "linear-gradient(180deg, transparent 50%, rgba(15,39,68,0.6) 100%)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 20,
              left: 20,
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "rgba(255,255,255,0.95)",
              borderRadius: 12,
              padding: "10px 14px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.20)",
            }}
          >
            <span style={{ fontSize: 22 }}>🏊</span>
            <div>
              <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>{floatLabel}</div>
              <div style={{ fontSize: 13, color: "#111827", fontWeight: 800 }}>{floatValue}</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          .hero-image-col { display: none !important; }
          .hero-headline { font-size: 28px !important; }
          .hero-subtitle { font-size: 15px !important; }
        }
      `}</style>
    </section>
  )
}
