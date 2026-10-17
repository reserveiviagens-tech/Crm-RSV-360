import { useState, useEffect, useCallback, useRef } from "react"
import { Eye, Clock, TrendingUp, Star, Zap, Users, Heart, Sparkles, ChevronRight, X, Check, Briefcase, DollarSign, ShoppingCart, Activity } from "lucide-react"

const formatPrice = (p: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p)

export interface TravelerProfile {
  tripType: string
  budget: string
  companions: string
  interests: string[]
  profession?: string
  income?: string
}

export interface BehaviorData {
  pagesVisited: string[]
  categoriesViewed: string[]
  timeOnPages: Record<string, number>
  lastVisit: number
  clickedItems: string[]
}

export function getTravelerProfile(): TravelerProfile | null {
  if (typeof window === "undefined") return null
  try {
    const data = localStorage.getItem("rsv360_traveler_profile")
    return data ? JSON.parse(data) : null
  } catch { return null }
}

export function saveTravelerProfile(profile: TravelerProfile) {
  if (typeof window === "undefined") return
  localStorage.setItem("rsv360_traveler_profile", JSON.stringify(profile))
}

export function TravelerProfileModal({ onClose, onSave }: { onClose: () => void; onSave: (p: TravelerProfile) => void }) {
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState<TravelerProfile>({
    tripType: "", budget: "", companions: "", interests: [],
  })

  const steps = [
    {
      title: "Qual o tipo da sua viagem?",
      subtitle: "Isso nos ajuda a personalizar suas recomendações",
      options: [
        { value: "relaxamento", label: "Relaxamento", icon: "🧘" },
        { value: "aventura", label: "Aventura", icon: "🏄" },
        { value: "familia", label: "Em Família", icon: "👨‍👩‍👧‍👦" },
        { value: "romantico", label: "Romântico", icon: "💑" },
        { value: "amigos", label: "Com Amigos", icon: "🎉" },
        { value: "negocios", label: "Negócios + Lazer", icon: "💼" },
      ],
      field: "tripType" as const,
    },
    {
      title: "Qual seu orçamento?",
      subtitle: "Mostraremos opções que cabem no seu bolso",
      options: [
        { value: "economico", label: "Até R$ 500", icon: "💰" },
        { value: "moderado", label: "R$ 500 - R$ 1.500", icon: "💳" },
        { value: "confortavel", label: "R$ 1.500 - R$ 3.000", icon: "✨" },
        { value: "premium", label: "Acima de R$ 3.000", icon: "👑" },
      ],
      field: "budget" as const,
    },
    {
      title: "Quem vai com você?",
      subtitle: "Personalizamos a experiência para seu grupo",
      options: [
        { value: "sozinho", label: "Sozinho(a)", icon: "🧳" },
        { value: "casal", label: "Casal", icon: "💏" },
        { value: "familia_criancas", label: "Família c/ Crianças", icon: "👶" },
        { value: "grupo_amigos", label: "Grupo de Amigos", icon: "👯" },
        { value: "melhor_idade", label: "Melhor Idade", icon: "🌟" },
      ],
      field: "companions" as const,
    },
    {
      title: "O que te interessa?",
      subtitle: "Selecione quantos quiser",
      options: [
        { value: "parques", label: "Parques Aquáticos", icon: "🏊" },
        { value: "gastronomia", label: "Gastronomia", icon: "🍽️" },
        { value: "natureza", label: "Natureza", icon: "🌿" },
        { value: "spa", label: "Spa & Bem-estar", icon: "💆" },
        { value: "cultura", label: "Cultura & História", icon: "🏛️" },
        { value: "esportes", label: "Esportes", icon: "⚽" },
        { value: "compras", label: "Compras", icon: "🛍️" },
        { value: "vida_noturna", label: "Vida Noturna", icon: "🌙" },
      ],
      field: "interests" as const,
    },
  ]

  const currentStep = steps[step]
  const isLastStep = step === steps.length - 1
  const canProceed = isLastStep ? profile.interests.length > 0 : profile[currentStep.field] !== ""

  const handleSelect = (value: string) => {
    if (isLastStep) {
      setProfile((p) => ({
        ...p,
        interests: p.interests.includes(value)
          ? p.interests.filter((i) => i !== value)
          : [...p.interests, value],
      }))
    } else {
      setProfile((p) => ({ ...p, [currentStep.field]: value }))
    }
  }

  const handleNext = () => {
    if (isLastStep) {
      saveTravelerProfile(profile)
      onSave(profile)
      onClose()
    } else {
      setStep((s) => s + 1)
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 420,
        maxHeight: "90vh", overflow: "auto", position: "relative",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 12, right: 12, width: 32, height: 32,
          borderRadius: "50%", border: "none", background: "#F3F4F6",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <X style={{ width: 16, height: 16, color: "#6B7280" }} />
        </button>

        <div style={{ padding: "28px 24px 24px" }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
            {steps.map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: i <= step ? "#2563EB" : "#E5E7EB",
                transition: "background 0.3s",
              }} />
            ))}
          </div>

          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
          }}>
            <Sparkles style={{ width: 20, height: 20, color: "#F57C00" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#F57C00" }}>
              IA PERSONALIZANDO SUA EXPERIÊNCIA
            </span>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1F2937", margin: "0 0 4px" }}>
            {currentStep.title}
          </h2>
          <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 20px" }}>
            {currentStep.subtitle}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {currentStep.options.map((opt) => {
              const isSelected = isLastStep
                ? profile.interests.includes(opt.value)
                : profile[currentStep.field] === opt.value

              return (
                <button
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  style={{
                    padding: "14px 12px", borderRadius: 12,
                    border: isSelected ? "2px solid #2563EB" : "1px solid #E5E7EB",
                    background: isSelected ? "#EFF6FF" : "#fff",
                    cursor: "pointer", textAlign: "center",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{opt.icon}</div>
                  <div style={{
                    fontSize: 13, fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? "#2563EB" : "#374151",
                  }}>{opt.label}</div>
                  {isSelected && (
                    <Check style={{ width: 14, height: 14, color: "#2563EB", margin: "4px auto 0" }} />
                  )}
                </button>
              )
            })}
          </div>

          <button
            onClick={handleNext}
            disabled={!canProceed}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
              background: canProceed
                ? "linear-gradient(135deg, #2563EB, #1D4ED8)"
                : "#E5E7EB",
              color: canProceed ? "#fff" : "#9CA3AF",
              fontSize: 15, fontWeight: 700, cursor: canProceed ? "pointer" : "default",
              marginTop: 20, transition: "all 0.2s",
            }}
          >
            {isLastStep ? "Ver Minhas Recomendações" : "Continuar"}
            {!isLastStep && <ChevronRight style={{ width: 16, height: 16, display: "inline", verticalAlign: "middle", marginLeft: 4 }} />}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SocialProofBanner({ viewers, pageName }: { viewers?: number; pageName: string }) {
  const [count, setCount] = useState(0)
  const [recentBooking, setRecentBooking] = useState("")

  const NAMES = ["Ana", "Carlos", "Maria", "João", "Lucia", "Pedro", "Fernanda", "Bruno", "Camila", "Rafael"]
  const CITIES = ["São Paulo", "Goiânia", "Brasília", "BH", "Uberlândia", "Cuiabá", "Campo Grande", "Ribeirão Preto"]

  useEffect(() => {
    setCount(viewers || Math.floor(Math.random() * 15) + 8)
    const updateBooking = () => {
      const name = NAMES[Math.floor(Math.random() * NAMES.length)]
      const city = CITIES[Math.floor(Math.random() * CITIES.length)]
      const mins = Math.floor(Math.random() * 12) + 1
      setRecentBooking(`${name} de ${city} reservou há ${mins} min`)
    }
    updateBooking()
    const interval = setInterval(updateBooking, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 16px", background: "#FFFBEB", borderRadius: 12,
      border: "1px solid #FDE68A", margin: "16px 16px 0", flexWrap: "wrap", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Eye style={{ width: 14, height: 14, color: "#D97706" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>
          {count} pessoas vendo {pageName} agora
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", animation: "pulse 2s infinite" }} />
        <span style={{ fontSize: 11, color: "#6B7280" }}>{recentBooking}</span>
      </div>
    </div>
  )
}

export function AIRecommendedBadge({ matchPercent }: { matchPercent: number }) {
  const color = matchPercent >= 90 ? "#22C55E" : matchPercent >= 75 ? "#2563EB" : "#F57C00"
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: `${color}15`, border: `1px solid ${color}40`,
      borderRadius: 8, padding: "3px 8px",
    }}>
      <Sparkles style={{ width: 12, height: 12, color }} />
      <span style={{ fontSize: 11, fontWeight: 700, color }}>
        {matchPercent}% match
      </span>
    </div>
  )
}

export function UrgencyIndicator({ roomsLeft, soldPercent }: { roomsLeft?: number; soldPercent?: number }) {
  if (!roomsLeft && !soldPercent) return null
  const isUrgent = (roomsLeft && roomsLeft <= 3) || (soldPercent && soldPercent >= 80)

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "6px 10px", borderRadius: 8,
      background: isUrgent ? "#FEE2E2" : "#FEF3C7",
      border: `1px solid ${isUrgent ? "#FECACA" : "#FDE68A"}`,
    }}>
      <Zap style={{ width: 12, height: 12, color: isUrgent ? "#DC2626" : "#D97706" }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: isUrgent ? "#DC2626" : "#92400E" }}>
        {roomsLeft ? `Apenas ${roomsLeft} vagas!` : `${soldPercent}% vendido`}
      </span>
    </div>
  )
}

export function CrossSellSection({ title, items }: {
  title: string;
  items: { name: string; price: number; image?: string; link: string; badge?: string }[]
}) {
  const [slideIdx, setSlideIdx] = useState(0)
  const [slideTransition, setSlideTransition] = useState(true)
  const [slidePaused, setSlidePaused] = useState(false)

  useEffect(() => {
    if (slidePaused || items.length <= 1) return
    const interval = setInterval(() => setSlideIdx(p => p + 1), 5000)
    return () => clearInterval(interval)
  }, [slidePaused, items.length])

  useEffect(() => {
    if (slideIdx > 0 && slideIdx >= items.length) {
      const t = setTimeout(() => { setSlideTransition(false); setSlideIdx(0) }, 850)
      return () => clearTimeout(t)
    }
  }, [slideIdx, items.length])

  useEffect(() => {
    if (!slideTransition) {
      const t = setTimeout(() => setSlideTransition(true), 80)
      return () => clearTimeout(t)
    }
  }, [slideTransition])

  return (
    <div style={{
      margin: "0 16px 24px", padding: 20, borderRadius: 16,
      background: "linear-gradient(135deg, #EFF6FF, #F0FDF4)",
      border: "1px solid #BFDBFE",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <TrendingUp style={{ width: 18, height: 18, color: "#2563EB" }} />
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1F2937", margin: 0 }}>{title}</h3>
      </div>
      <div
        style={{ overflow: "hidden" }}
        onMouseEnter={() => setSlidePaused(true)}
        onMouseLeave={() => setSlidePaused(false)}
      >
        <div style={{
          display: "flex", gap: 12,
          transform: `translateX(-${slideIdx * 152}px)`,
          transition: slideTransition ? "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
        }}>
        {[...items, items[0]].filter(Boolean).map((item, i) => (
          <a
            key={i}
            href={item.link}
            onClick={() => {
              // Fase 12 — cross-sell tracking (hotel vs oferta genérica)
              const isHotel = item.link.includes("/hoteis")
              void import("@/lib/analytics").then(({ trackEvent }) => {
                trackEvent(isHotel ? "related_hotel_click" : "related_offer_click", {
                  name: item.name,
                  link: item.link,
                  price: item.price,
                })
              })
            }}
            style={{
            minWidth: 140, background: "#fff", borderRadius: 12,
            overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            textDecoration: "none", flexShrink: 0,
          }}>
            <div style={{
              height: 80, background: "linear-gradient(135deg, #1e3a5f, #2563EB)",
              display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
            }}>
              {item.image ? (
                <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <Star style={{ width: 20, height: 20, color: "rgba(255,255,255,0.3)" }} />
              )}
              {item.badge && (
                <span style={{
                  position: "absolute", top: 6, left: 6, fontSize: 9, fontWeight: 700,
                  background: "#DC2626", color: "#fff", padding: "2px 6px", borderRadius: 4,
                }}>{item.badge}</span>
              )}
            </div>
            <div style={{ padding: "8px 10px" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#1F2937", margin: "0 0 4px", lineHeight: 1.3 }}>{item.name}</p>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#22C55E" }}>{formatPrice(item.price)}</span>
            </div>
          </a>
        ))}
        </div>
      </div>
    </div>
  )
}

export function PersonalizedBanner({ profile }: { profile: TravelerProfile | null }) {
  if (!profile) return null

  const labels: Record<string, string> = {
    relaxamento: "Relaxamento", aventura: "Aventura", familia: "Família",
    romantico: "Romântico", amigos: "Amigos", negocios: "Negócios",
    economico: "Econômico", moderado: "Moderado", confortavel: "Confortável", premium: "Premium",
  }

  return (
    <div style={{
      margin: "16px 16px 0", padding: "12px 16px", borderRadius: 12,
      background: "linear-gradient(135deg, #EFF6FF, #FDF4FF)",
      border: "1px solid #C4B5FD",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <Sparkles style={{ width: 20, height: 20, color: "#7C3AED", flexShrink: 0 }} />
      <div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#7C3AED" }}>
          Personalizado para você
        </span>
        <p style={{ fontSize: 11, color: "#6B7280", margin: "2px 0 0" }}>
          {labels[profile.tripType] || profile.tripType} · {labels[profile.budget] || profile.budget} · {profile.interests.length} interesses
        </p>
      </div>
    </div>
  )
}

export function LiveCountdown({ hours, minutes, seconds, label }: {
  hours: number; minutes: number; seconds: number; label?: string
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: "rgba(220,38,38,0.08)", borderRadius: 10, padding: "8px 12px",
    }}>
      <Clock style={{ width: 14, height: 14, color: "#DC2626" }} />
      <span style={{
        fontSize: 15, fontWeight: 800, color: "#DC2626",
        fontVariantNumeric: "tabular-nums",
      }}>
        {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </span>
      {label && <span style={{ fontSize: 11, color: "#DC2626", fontWeight: 600 }}>{label}</span>}
    </div>
  )
}

export function calculateMatchScore(profile: TravelerProfile | null, item: {
  category?: string; price?: number; tags?: string[]; profession?: string
}): number {
  if (!profile) return Math.floor(Math.random() * 20) + 70

  let score = 60
  const budgetRanges: Record<string, [number, number]> = {
    economico: [0, 500], moderado: [500, 1500],
    confortavel: [1500, 3000], premium: [3000, 99999],
  }
  const range = budgetRanges[profile.budget]
  if (range && item.price && item.price >= range[0] && item.price <= range[1]) score += 15

  if (profile.tripType === "familia" && item.tags?.some(t => t.toLowerCase().includes("família"))) score += 10
  if (profile.tripType === "romantico" && item.tags?.some(t => t.toLowerCase().includes("casal"))) score += 10
  if (profile.interests.includes("parques") && item.category === "parques") score += 10
  if (profile.interests.includes("natureza") && item.category === "natureza") score += 10
  if (profile.interests.includes("spa") && item.tags?.some(t => t.toLowerCase().includes("spa"))) score += 10
  if (profile.interests.includes("gastronomia") && item.tags?.some(t => t.toLowerCase().includes("gastro"))) score += 8
  if (profile.interests.includes("cultura") && item.tags?.some(t => t.toLowerCase().includes("cultura"))) score += 8
  if (profile.interests.includes("esportes") && item.tags?.some(t => t.toLowerCase().includes("esporte"))) score += 8

  if (profile.profession) {
    const professionMap = getProfessionRecommendations(profile.profession)
    if (professionMap.categories.includes(item.category || "")) score += 12
    if (item.tags?.some(t => professionMap.tags.includes(t.toLowerCase()))) score += 8
  }

  if (profile.income) {
    const incomeRanges: Record<string, [number, number]> = {
      ate_3k: [0, 300], de_3k_a_7k: [200, 800],
      de_7k_a_15k: [500, 2000], acima_15k: [1000, 99999],
    }
    const incomeRange = incomeRanges[profile.income]
    if (incomeRange && item.price && item.price >= incomeRange[0] && item.price <= incomeRange[1]) score += 10
  }

  const behavior = getBehaviorData()
  if (behavior) {
    if (item.category && behavior.categoriesViewed.includes(item.category)) score += 5
    const totalPageViews = behavior.pagesVisited.length
    if (totalPageViews > 5) score += 3
    if (totalPageViews > 15) score += 3
  }

  return Math.min(score + Math.floor(Math.random() * 8), 99)
}

const BEHAVIOR_KEY = "rsv360_behavior_data"

export function getBehaviorData(): BehaviorData | null {
  if (typeof window === "undefined") return null
  try {
    const data = localStorage.getItem(BEHAVIOR_KEY)
    return data ? JSON.parse(data) : null
  } catch { return null }
}

function saveBehaviorData(data: BehaviorData) {
  if (typeof window === "undefined") return
  localStorage.setItem(BEHAVIOR_KEY, JSON.stringify(data))
}

function getOrCreateBehaviorData(): BehaviorData {
  const existing = getBehaviorData()
  if (existing) return existing
  const fresh: BehaviorData = {
    pagesVisited: [],
    categoriesViewed: [],
    timeOnPages: {},
    lastVisit: Date.now(),
    clickedItems: [],
  }
  saveBehaviorData(fresh)
  return fresh
}

export function trackPageVisit(pageName: string, category?: string) {
  const data = getOrCreateBehaviorData()
  if (!data.pagesVisited.includes(pageName)) {
    data.pagesVisited.push(pageName)
  }
  if (category && !data.categoriesViewed.includes(category)) {
    data.categoriesViewed.push(category)
  }
  data.lastVisit = Date.now()
  data.timeOnPages[pageName] = (data.timeOnPages[pageName] || 0) + 1
  saveBehaviorData(data)
}

export function trackItemClick(itemId: string) {
  const data = getOrCreateBehaviorData()
  if (!data.clickedItems.includes(itemId)) {
    data.clickedItems.push(itemId)
  }
  saveBehaviorData(data)
}

export function BehaviorTracker({ pageName, category }: { pageName: string; category?: string }) {
  const tracked = useRef(false)

  useEffect(() => {
    if (tracked.current) return
    tracked.current = true
    trackPageVisit(pageName, category)
  }, [pageName, category])

  return null
}

function getProfessionRecommendations(profession: string): { categories: string[]; tags: string[] } {
  const map: Record<string, { categories: string[]; tags: string[] }> = {
    medico: { categories: ["spa", "natureza", "bem-estar"], tags: ["spa", "relaxamento", "wellness", "saúde"] },
    engenheiro: { categories: ["aventura", "esportes", "natureza"], tags: ["aventura", "radical", "trilha"] },
    professor: { categories: ["cultura", "natureza", "parques"], tags: ["cultura", "história", "educativo", "família"] },
    empresario: { categories: ["premium", "spa", "gastronomia"], tags: ["premium", "exclusivo", "vip", "gourmet"] },
    advogado: { categories: ["spa", "gastronomia", "cultura"], tags: ["spa", "gourmet", "premium", "conforto"] },
    ti: { categories: ["aventura", "esportes", "parques"], tags: ["aventura", "radical", "parque", "tecnologia"] },
    saude: { categories: ["spa", "natureza", "bem-estar"], tags: ["spa", "wellness", "relaxamento", "saúde"] },
    comercio: { categories: ["parques", "familia", "gastronomia"], tags: ["família", "diversão", "lazer"] },
    aposentado: { categories: ["spa", "natureza", "cultura"], tags: ["tranquilo", "conforto", "natureza", "cultura"] },
    estudante: { categories: ["parques", "aventura", "esportes"], tags: ["econômico", "aventura", "diversão", "jovem"] },
  }
  return map[profession] || { categories: ["parques", "natureza"], tags: ["lazer", "diversão"] }
}

export function ProfessionBasedRecommender({ profession, items, onSelect }: {
  profession: string
  items: { id: string; name: string; category: string; price: number; image?: string; tags?: string[] }[]
  onSelect?: (id: string) => void
}) {
  const recs = getProfessionRecommendations(profession)

  const professionLabels: Record<string, string> = {
    medico: "Profissionais de Saúde", engenheiro: "Engenheiros",
    professor: "Professores", empresario: "Empresários",
    advogado: "Advogados", ti: "Profissionais de TI",
    saude: "Área da Saúde", comercio: "Comerciantes",
    aposentado: "Aposentados", estudante: "Estudantes",
  }

  const scored = items.map(item => {
    let s = 50
    if (recs.categories.includes(item.category)) s += 25
    if (item.tags?.some(t => recs.tags.includes(t.toLowerCase()))) s += 15
    s += Math.floor(Math.random() * 10)
    return { ...item, score: Math.min(s, 99) }
  }).sort((a, b) => b.score - a.score).slice(0, 6)

  return (
    <div data-testid="profession-recommender" style={{
      margin: "0 16px 20px", padding: 20, borderRadius: 16,
      background: "linear-gradient(135deg, #EFF6FF, #F5F3FF)",
      border: "1px solid #C4B5FD",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Briefcase style={{ width: 18, height: 18, color: "#7C3AED" }} />
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1F2937", margin: 0 }}>
          Popular entre {professionLabels[profession] || "seu perfil"}
        </h3>
      </div>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
        {scored.map((item) => (
          <button
            key={item.id}
            data-testid={`profession-rec-${item.id}`}
            onClick={() => onSelect?.(item.id)}
            style={{
              minWidth: 150, background: "#fff", borderRadius: 12,
              overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              border: "none", cursor: "pointer", textAlign: "left", flexShrink: 0,
            }}
          >
            <div style={{
              height: 80, background: "linear-gradient(135deg, #4C1D95, #7C3AED)",
              display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
            }}>
              {item.image ? (
                <img src={item.image} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <Briefcase style={{ width: 20, height: 20, color: "rgba(255,255,255,0.3)" }} />
              )}
              <span style={{
                position: "absolute", top: 6, right: 6, fontSize: 10, fontWeight: 700,
                background: "#7C3AED", color: "#fff", padding: "2px 6px", borderRadius: 6,
              }}>{item.score}%</span>
            </div>
            <div style={{ padding: "8px 10px" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#1F2937", margin: "0 0 4px", lineHeight: 1.3 }}>{item.name}</p>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#22C55E" }}>{formatPrice(item.price)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export function IncomeBasedFilter<T extends { price: number }>({
  items,
  income,
  children,
}: {
  items: T[]
  income: string
  children: (filtered: T[]) => JSX.Element
}) {
  const incomeRanges: Record<string, [number, number]> = {
    ate_3k: [0, 400],
    de_3k_a_7k: [0, 1000],
    de_7k_a_15k: [0, 2500],
    acima_15k: [0, 99999],
  }

  const range = incomeRanges[income]
  const filtered = range
    ? items.filter(i => i.price >= range[0] && i.price <= range[1])
    : items

  const sorted = [...filtered].sort((a, b) => a.price - b.price)

  return children(sorted.length > 0 ? sorted : items)
}

export function IncomeFilterBar({ income, onChange }: {
  income: string
  onChange: (value: string) => void
}) {
  const options = [
    { value: "todos", label: "Todos" },
    { value: "ate_3k", label: "Econômico" },
    { value: "de_3k_a_7k", label: "Moderado" },
    { value: "de_7k_a_15k", label: "Confortável" },
    { value: "acima_15k", label: "Premium" },
  ]

  return (
    <div data-testid="income-filter-bar" style={{
      display: "flex", gap: 8, overflowX: "auto", padding: "0 16px 12px",
    }}>
      {options.map(opt => (
        <button
          key={opt.value}
          data-testid={`income-filter-${opt.value}`}
          onClick={() => onChange(opt.value)}
          style={{
            padding: "6px 14px", borderRadius: 20, border: "none",
            background: income === opt.value ? "#2563EB" : "#F3F4F6",
            color: income === opt.value ? "#fff" : "#4B5563",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            whiteSpace: "nowrap", transition: "all 0.2s",
          }}
        >
          <DollarSign style={{ width: 11, height: 11, display: "inline", verticalAlign: "middle", marginRight: 3 }} />
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function SocialProofCounter({ count, label, actionLabel }: {
  count?: number
  label?: string
  actionLabel?: string
}) {
  const [displayCount, setDisplayCount] = useState(count || Math.floor(Math.random() * 80) + 30)

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.6) {
        setDisplayCount(prev => prev + Math.floor(Math.random() * 3) + 1)
      }
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div data-testid="social-proof-counter" style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "6px 12px", borderRadius: 8,
      background: "#F0FDF4", border: "1px solid #BBF7D0",
    }}>
      <ShoppingCart style={{ width: 13, height: 13, color: "#16A34A" }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: "#166534" }}>
        {displayCount} {label || "pessoas"} {actionLabel || "compraram nas últimas 24h"}
      </span>
    </div>
  )
}

export function ConfettiEffect({ active, onComplete }: {
  active: boolean
  onComplete?: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    if (!active || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const colors = ["#2563EB", "#22C55E", "#F57C00", "#DC2626", "#7C3AED", "#F59E0B", "#EC4899"]
    const particles: {
      x: number; y: number; vx: number; vy: number
      color: string; size: number; rotation: number; rotSpeed: number
      opacity: number; shape: "rect" | "circle"
    }[] = []

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height / 2 - 100,
        vx: (Math.random() - 0.5) * 12,
        vy: Math.random() * -14 - 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        opacity: 1,
        shape: Math.random() > 0.5 ? "rect" : "circle",
      })
    }

    let frame = 0
    const maxFrames = 120

    const animate = () => {
      frame++
      if (frame > maxFrames) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        onComplete?.()
        return
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach(p => {
        p.x += p.vx
        p.vy += 0.25
        p.y += p.vy
        p.rotation += p.rotSpeed
        p.opacity = Math.max(0, 1 - frame / maxFrames)
        p.vx *= 0.99

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.globalAlpha = p.opacity

        ctx.fillStyle = p.color
        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        } else {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.restore()
      })

      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animRef.current)
    }
  }, [active, onComplete])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      data-testid="confetti-canvas"
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        pointerEvents: "none",
      }}
    />
  )
}
