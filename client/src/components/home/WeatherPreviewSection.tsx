import { Link } from "wouter"
import { WeatherCard } from "@/components/WeatherCard"
import { useHomeSectionPlacements } from "@/hooks/useHomeSectionPlacements"
import { CardMedia, homeMediaAlt, isVideoUrl } from "@/components/home/CardMedia"

export function WeatherPreviewSection() {
  const { placements } = useHomeSectionPlacements("tempo")
  const placement = placements[0]
  const ctaHref = placement?.ctaHref || "/previsao"
  const ctaLabel = placement?.titleOverride || "Escolher minha data"
  const bannerTitle =
    placement?.subtitleOverride ||
    "🗓️ Semana com bom tempo previsto para parques ao ar livre"
  const bannerBadge = placement?.badgeText || null
  const bannerImage = placement?.imageUrl || null
  const bannerIsVideo = isVideoUrl(bannerImage)

  return (
    <section
      data-testid="landing-weather-preview"
      style={{ background: "#fff", padding: "64px 20px" }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <span style={{
            display: "inline-block",
            background: "#EFF6FF", color: "#2563EB",
            fontWeight: 700, fontSize: 12, letterSpacing: 1,
            padding: "5px 14px", borderRadius: 20, marginBottom: 12,
            textTransform: "uppercase",
          }}>
            Previsão do tempo
          </span>
          <h2
            data-testid="weather-section-title"
            style={{ fontSize: 32, fontWeight: 900, color: "#111827", marginBottom: 12, letterSpacing: -0.5 }}
          >
            Escolha o melhor dia para aproveitar seu passeio
          </h2>
          <p style={{ fontSize: 16, color: "#6B7280", maxWidth: 560, margin: "0 auto" }}>
            Veja a previsão do tempo e planeje sua visita para aproveitar melhor os parques aquáticos, águas quentes e atrações ao ar livre.
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginBottom: 32,
        }}
          className="weather-cards-grid"
        >
          <div>
            <div style={{
              fontSize: 13, fontWeight: 700, color: "#6B7280",
              marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5,
            }}>
              📍 Caldas Novas
            </div>
            <WeatherCard
              options={{ mode: "coords", lat: -17.7392, lon: -48.6231 }}
              compact={false}
            />
          </div>
          <div>
            <div style={{
              fontSize: 13, fontWeight: 700, color: "#6B7280",
              marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5,
            }}>
              📍 Rio Quente
            </div>
            <WeatherCard
              options={{ mode: "coords", lat: -17.7748, lon: -48.7667 }}
              compact={false}
            />
          </div>
        </div>

        <div style={{
          position: "relative",
          overflow: "hidden",
          background: bannerImage && !bannerIsVideo
            ? `linear-gradient(135deg, rgba(239,246,255,0.92), rgba(240,249,255,0.92)), url(${bannerImage}) center/cover`
            : "linear-gradient(135deg, #EFF6FF, #F0F9FF)",
          border: "1.5px solid #BFDBFE",
          borderRadius: 16,
          padding: "20px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 16,
        }}>
          {bannerIsVideo && bannerImage ? (
            <CardMedia
              src={bannerImage}
              alt={homeMediaAlt(ctaLabel, bannerTitle)}
              width={1600}
              height={900}
              fill
              opacity={0.18}
            />
          ) : null}
          <div style={{ position: "relative", zIndex: 1 }}>
            {bannerBadge ? (
              <span style={{
                display: "inline-block",
                background: "#DBEAFE", color: "#1E40AF",
                fontSize: 11, fontWeight: 800, padding: "3px 10px",
                borderRadius: 12, marginBottom: 8,
              }}>
                {bannerBadge}
              </span>
            ) : null}
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1E3A5F", marginBottom: 4 }}>
              {bannerTitle}
            </div>
            <div style={{ fontSize: 13, color: "#4B5563" }}>
              Aproveite para planejar sua visita e garantir seu ingresso com desconto.
            </div>
          </div>
          <Link href={ctaHref}>
            <button
              data-testid="weather-cta-btn"
              style={{
                position: "relative",
                zIndex: 1,
                padding: "12px 24px", borderRadius: 10,
                background: "linear-gradient(135deg, #2563EB, #1E40AF)",
                color: "#fff", fontWeight: 700, fontSize: 14,
                border: "none", cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              {ctaLabel}
            </button>
          </Link>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .weather-cards-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
