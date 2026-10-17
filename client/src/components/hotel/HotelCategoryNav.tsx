import type { LucideIcon } from "lucide-react"
import type { SearchFilters } from "@/types/search"

export interface HotelCategory {
  label: string
  value: string
  icon?: LucideIcon
  filterUpdate: Partial<SearchFilters>
  badge?: string
  badgeColor?: "orange" | "blue"
  href?: string
  forceActive?: boolean
  isDivider?: boolean
  testId?: string
  animClass?: string
}

interface HotelCategoryNavProps {
  categories: HotelCategory[]
  activeFilter: string
  onSelect: (category: HotelCategory) => void
}

function getAnimClass(value: string, label: string, explicit?: string): string {
  if (explicit) return explicit
  if (value.startsWith("__nav_parques")) return "rsv-cat-wave"
  if (value.startsWith("__nav_hoteis")) return "rsv-cat-float"
  if (value.startsWith("__nav_ingressos")) return "rsv-cat-bounce"
  if (value.startsWith("__nav_excursoes")) return "rsv-cat-slide"
  if (value.startsWith("__nav_atracoes")) return "rsv-cat-wiggle"
  if (value.startsWith("__nav_combos")) return "rsv-cat-star"
  if (value.startsWith("__nav_destinos")) return "rsv-cat-float"
  if (label === "Casal") return "rsv-cat-heartbeat"
  if (label === "Família") return "rsv-cat-bounce"
  if (label === "Resort") return "rsv-cat-wave"
  if (label.includes("Estrelas") || label === "Premium") return "rsv-cat-star"
  if (label === "Econômico") return "rsv-cat-wiggle"
  if (value.startsWith("ent:")) return "rsv-cat-slide"
  // Ingressos local categories
  if (label === "Transporte") return "rsv-cat-slide"
  if (label === "Natureza") return "rsv-cat-float"
  if (label === "Cabanas") return "rsv-cat-wiggle"
  if (label === "Especiais") return "rsv-cat-star"
  // Atracoes local categories
  if (label === "Relaxamento") return "rsv-cat-heartbeat"
  if (label === "Aventura") return "rsv-cat-bounce"
  if (label === "Romântico") return "rsv-cat-heartbeat"
  if (label === "Cultura") return "rsv-cat-float"
  // Excursoes local categories
  if (label === "Grupo") return "rsv-cat-float"
  // Shared/Promocoes/Flash-deals categories
  if (label === "Parque" || label === "Parques") return "rsv-cat-wave"
  if (label === "Ingresso") return "rsv-cat-bounce"
  if (label === "IA Recomenda") return "rsv-cat-star"
  if (label === "Maior Desconto") return "rsv-cat-bounce"
  if (label === "Acabando") return "rsv-cat-heartbeat"
  if (label === "Menor Preço") return "rsv-cat-wiggle"
  if (label === "Combos") return "rsv-cat-star"
  if (label.includes("OFF")) return label.includes("50") ? "rsv-cat-star" : "rsv-cat-wiggle"
  return "rsv-cat-float"
}

export function HotelCategoryNav({ categories, activeFilter, onSelect }: HotelCategoryNavProps) {
  function handleClick(cat: HotelCategory) {
    onSelect(cat)
  }

  return (
    <>
      <style>{`
        @keyframes rsv-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes rsv-bounce-cat {
          0%, 100% { transform: translateY(0) scale(1); }
          35% { transform: translateY(-7px) scale(1.08); }
          65% { transform: translateY(-3px) scale(1.03); }
        }
        @keyframes rsv-heartbeat {
          0%, 100% { transform: scale(1); }
          20% { transform: scale(1.18); }
          40% { transform: scale(1); }
          60% { transform: scale(1.10); }
          80% { transform: scale(1); }
        }
        @keyframes rsv-wave {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-4px) rotate(-4deg); }
          75% { transform: translateY(-2px) rotate(4deg); }
        }
        @keyframes rsv-star-spin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.15); }
          100% { transform: rotate(360deg) scale(1); }
        }
        @keyframes rsv-wiggle {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-10deg); }
          40% { transform: rotate(8deg); }
          60% { transform: rotate(-6deg); }
          80% { transform: rotate(4deg); }
        }
        @keyframes rsv-slide-up {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes rsv-pop-click {
          0% { transform: scale(1); }
          40% { transform: scale(1.35); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }

        .rsv-hotel-cat-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 10px 14px 8px;
          background: transparent;
          border: none;
          cursor: pointer;
          flex-shrink: 0;
          position: relative;
          min-width: 68px;
          min-height: 44px;
          transition: opacity 0.15s;
        }
        .rsv-hotel-cat-btn:active { opacity: 0.75; }

        .rsv-hotel-cat-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          border-radius: 14px;
          transition: color 0.2s, background 0.2s, transform 0.15s;
          color: #9CA3AF;
          background: #F3F4F6;
          position: relative;
        }
        .rsv-hotel-cat-btn--active .rsv-hotel-cat-icon {
          color: #2563EB;
          background: #EFF6FF;
        }
        .rsv-hotel-cat-btn:hover .rsv-hotel-cat-icon {
          color: #2563EB;
          background: #EFF6FF;
          transform: translateY(-3px);
        }
        .rsv-hotel-cat-btn--active:hover .rsv-hotel-cat-icon {
          transform: translateY(-2px);
        }

        .rsv-hotel-cat-btn:hover .rsv-hotel-cat-icon.rsv-cat-float {
          animation: rsv-float 0.9s ease-in-out infinite;
        }
        .rsv-hotel-cat-btn:hover .rsv-hotel-cat-icon.rsv-cat-bounce {
          animation: rsv-bounce-cat 0.7s ease-in-out infinite;
        }
        .rsv-hotel-cat-btn:hover .rsv-hotel-cat-icon.rsv-cat-heartbeat {
          animation: rsv-heartbeat 0.8s ease-in-out infinite;
        }
        .rsv-hotel-cat-btn:hover .rsv-hotel-cat-icon.rsv-cat-wave {
          animation: rsv-wave 0.85s ease-in-out infinite;
        }
        .rsv-hotel-cat-btn:hover .rsv-hotel-cat-icon.rsv-cat-star {
          animation: rsv-star-spin 1s ease-in-out infinite;
        }
        .rsv-hotel-cat-btn:hover .rsv-hotel-cat-icon.rsv-cat-wiggle {
          animation: rsv-wiggle 0.6s ease-in-out infinite;
        }
        .rsv-hotel-cat-btn:hover .rsv-hotel-cat-icon.rsv-cat-slide {
          animation: rsv-slide-up 0.8s ease-in-out infinite;
        }

        .rsv-hotel-cat-label {
          font-size: 11px;
          font-weight: 600;
          color: #9CA3AF;
          white-space: nowrap;
          transition: color 0.2s;
          letter-spacing: 0.01em;
        }
        .rsv-hotel-cat-btn--active .rsv-hotel-cat-label {
          color: #2563EB;
          font-weight: 700;
        }
        .rsv-hotel-cat-btn:hover .rsv-hotel-cat-label {
          color: #2563EB;
        }

        .rsv-hotel-cat-underline {
          height: 2.5px;
          width: 0;
          background: #2563EB;
          border-radius: 2px;
          transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          margin-top: 2px;
          align-self: stretch;
        }
        .rsv-hotel-cat-btn--active .rsv-hotel-cat-underline {
          width: 100%;
        }

        .rsv-hotel-cat-badge {
          position: absolute;
          top: -6px;
          right: -6px;
          font-size: 9px;
          font-weight: 800;
          line-height: 1;
          padding: 2px 5px;
          border-radius: 999px;
          white-space: nowrap;
          letter-spacing: 0.04em;
          border: 1.5px solid #fff;
          pointer-events: none;
        }
        .rsv-hotel-cat-badge--orange {
          background: #F97316;
          color: #fff;
        }
        .rsv-hotel-cat-badge--blue {
          background: #2563EB;
          color: #fff;
        }

        .rsv-hotel-cat-divider {
          width: 1px;
          background: #E5E7EB;
          align-self: stretch;
          margin: 8px 4px;
          flex-shrink: 0;
        }
      `}</style>

      <div
        style={{
          overflowX: "auto",
          scrollbarWidth: "none",
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-evenly",
            width: "100%",
          }}
        >
          {categories.map((cat, idx) => {
            if (cat.isDivider) {
              return <div key={`divider-${idx}`} className="rsv-hotel-cat-divider" />
            }

            const Icon = cat.icon!
            const isActive = cat.forceActive || activeFilter === cat.value
            const animClass = getAnimClass(cat.value, cat.label, cat.animClass)
            const badgeColorClass = cat.badgeColor === "blue"
              ? "rsv-hotel-cat-badge--blue"
              : "rsv-hotel-cat-badge--orange"

            return (
              <button
                key={cat.value}
                data-testid={cat.testId ?? `button-filter-${cat.value}`}
                className={`rsv-hotel-cat-btn${isActive ? " rsv-hotel-cat-btn--active" : ""}`}
                onClick={() => handleClick(cat)}
              >
                <div className={`rsv-hotel-cat-icon ${animClass}`}>
                  <Icon size={28} strokeWidth={isActive ? 2.2 : 1.8} />
                  {cat.badge && (
                    <span className={`rsv-hotel-cat-badge ${badgeColorClass}`}>
                      {cat.badge}
                    </span>
                  )}
                </div>
                <span className="rsv-hotel-cat-label">{cat.label}</span>
                <div className="rsv-hotel-cat-underline" />
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
