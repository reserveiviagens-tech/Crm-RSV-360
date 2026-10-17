import { useState, useEffect, useMemo, useCallback } from "react"
import { Phone, ShoppingCart, Sparkles, BarChart3, X, Check, Timer, ChevronRight, Wand2, LayoutGrid, Trees, Leaf, Bus, Home, Star, Gift, Waves, AlertCircle, Loader2 } from "lucide-react"
import { useLocation, useSearch } from "wouter";
import { HotelCategoryNav } from "@/components/hotel/HotelCategoryNav"
import { buildSectionTypeNav, CATALOG_DIVIDER } from "@/lib/catalogNav"
import { HomeHeader } from "@/components/home/HomeHeader"
import {
  SocialProofBanner,
  calculateMatchScore,
  getTravelerProfile,
  PersonalizedBanner,
  CrossSellSection,
} from "@/components/ai-conversion-elements"
import { useTicketsCart } from "@/hooks/useTicketsCart"
import { trackEvent } from "@/lib/analytics"
import { saveSelectedDate, replaceCart, setCheckoutPrefill } from "@/lib/cart-store"
import { QuickDecisionSection } from "@/components/QuickDecisionSection"
import { MiniWizard } from "@/components/MiniWizard"
import { TicketsGrid, type TicketItem } from "@/components/TicketsGrid"
import { DateBanner, getPriceMultiplier, getDateAvailabilityForTicket } from "@/components/CalendarioIngressos"
import { EnterpriseAccordion } from "@/components/EnterpriseAccordion"
import { IngressosSidebar } from "@/components/IngressosSidebar"
import { CartAddModal } from "@/components/CartAddModal"
import { ComboDatesModal } from "@/components/ComboDatesModal"
import { CartStickyBar } from "@/components/CartStickyBar"
import { CompactContextBar } from "@/components/ingressos/CompactContextBar"
import { DESTINATION_CITIES, ENTERPRISE_CONFIG, type DestinationCity } from "@/lib/enterprises"
import { useUnifiedSearch } from "@/hooks/useUnifiedSearch"
import SearchResultsSummary from "@/components/search/SearchResultsSummary"
import SearchEmptyState from "@/components/search/SearchEmptyState"
import { clearPriceRange } from "@/lib/search-query"
import type { SearchFilters } from "@/types/search"
import { CatalogPageShell } from "@/components/layouts/CatalogPageShell"
import SearchFiltersDrawer from "@/components/search/SearchFiltersDrawer"
import { FilterPopover } from "@/components/search/FilterPopover"
import { LoadingSkeleton } from "@/components/shells"
import { ComboIAWizard } from "@/components/tickets/ComboIAWizard"
import { useComboTrigger } from "@/hooks/useComboTrigger"

type QuickPick = "custo" | "familia" | "popular" | "combo"

const ticketsBase: TicketItem[] = [
  {
    id: "hot-park",
    name: "Ingresso Hot Park — Adulto",
    categorySection: "ingresso-1-dia",
    enterprise: "hot-park", destinationCity: "rio-quente",
    description: "Aventura e relaxamento no maior parque de águas quentes da América do Sul! Toboáguas emocionantes e piscinas termais.",
    price: 189, originalPrice: 220, discount: 14,
    image: "/images/lagoa-termas-parque.jpeg",
    features: ["Toboáguas radicais", "Piscinas termais", "Rio lento", "Área infantil", "Restaurantes"],
    location: "Rio Quente - GO",
    duration: "Dia inteiro", ageGroup: "Adulto (13+)",
    popular: true, soldToday: 0, availableToday: 0,
    category: "parques", tags: ["família", "aventura", "águas termais"],
    alsoBoght: ["diroma-acqua-park", "lagoa-termas"],
  },
  {
    id: "hot-park-crianca",
    name: "Ingresso Hot Park — Criança",
    categorySection: "ingresso-1-dia",
    enterprise: "hot-park", destinationCity: "rio-quente",
    description: "Diversão garantida para as crianças de 4 a 12 anos no parque mais incrível da região!",
    price: 99, originalPrice: 130, discount: 24,
    image: "/images/hot-park.jpeg",
    features: ["Toboáguas kids", "Piscina infantil", "Rio lento", "Área baby", "Almoço incluso"],
    location: "Rio Quente - GO",
    duration: "Dia inteiro", ageGroup: "Criança (4-12 anos)",
    soldToday: 0, availableToday: 0,
    category: "parques", tags: ["criança", "família", "kids"],
    alsoBoght: ["hot-park", "diroma-acqua-park"],
  },
  {
    id: "ingresso-vip",
    name: "Ingresso VIP — Acesso Prioritário",
    categorySection: "especiais",
    enterprise: "hot-park", destinationCity: "rio-quente",
    description: "A experiência mais completa! Acesso VIP sem filas, área exclusiva e serviços premium.",
    price: 320, originalPrice: 380, discount: 16,
    image: "/images/hot-park.jpeg",
    features: ["Fast pass — sem filas", "Área VIP exclusiva", "Serviço de mordomo", "Bebidas inclusas", "Fotos profissionais"],
    location: "Rio Quente - GO",
    duration: "Dia inteiro", ageGroup: "Adultos",
    soldToday: 0, availableToday: 0,
    category: "parques", tags: ["vip", "premium", "exclusivo"],
    alsoBoght: ["cabana-premium", "ingresso-noturno"],
  },
  {
    id: "ingresso-noturno",
    name: "Ingresso Noturno — Sunset Edition",
    categorySection: "especiais",
    enterprise: "hot-park", destinationCity: "rio-quente",
    description: "Viva a magia do parque ao entardecer! Iluminação especial, música ao vivo e clima incrível.",
    price: 150, originalPrice: 190, discount: 21,
    image: "/images/lagoa-termas-parque.jpeg",
    features: ["Entrada a partir das 17h", "Show ao vivo", "Coquetel de boas-vindas", "Iluminação temática"],
    location: "Rio Quente - GO",
    duration: "Noturno (17h-23h)", ageGroup: "Adultos (18+)",
    soldToday: 0, availableToday: 0,
    category: "parques", tags: ["noturno", "casal", "adulto"],
    alsoBoght: ["ingresso-vip", "cabana-standard"],
  },
  {
    id: "morador-hot-park",
    name: "Hot Park — Ingresso Morador",
    categorySection: "ingresso-1-dia",
    ticketCategory: "morador",
    enterprise: "hot-park", destinationCity: "rio-quente",
    description: "Exclusivo para moradores de Caldas Novas e Rio Quente. 30% de desconto com apresentação de RG + comprovante de residência.",
    price: 132, originalPrice: 189, discount: 30,
    image: "/images/lagoa-termas-parque.jpeg",
    features: ["Acesso completo ao parque", "Toboáguas", "Piscinas termais", "Rio lento", "Área infantil"],
    location: "Rio Quente - GO",
    duration: "Dia inteiro", ageGroup: "Adulto (13+)",
    soldToday: 0, availableToday: 0,
    category: "parques", tags: ["morador", "desconto", "águas termais"],
    documentRequired: "RG com endereço local + comprovante de residência",
    alsoBoght: ["morador-diroma", "morador-lagoa"],
  },
  {
    id: "diroma-acqua-park",
    name: "Ingresso diRoma Acqua Park",
    categorySection: "ingresso-1-dia",
    enterprise: "diroma", destinationCity: "caldas-novas",
    description: "Diversão aquática para todas as idades com toboáguas emocionantes e piscinas de ondas incríveis.",
    price: 90, originalPrice: 110, discount: 18,
    image: "/images/diroma-acqua-park.jpeg",
    features: ["Toboáguas variados", "Piscina de ondas", "Área kids", "Bar molhado", "Espreguiçadeiras"],
    location: "Caldas Novas - GO",
    duration: "Dia inteiro", ageGroup: "Todas as idades",
    soldToday: 0, availableToday: 0,
    category: "parques", tags: ["família", "diversão", "ondas"],
    alsoBoght: ["hot-park", "kawana-park"],
  },
  {
    id: "morador-diroma",
    name: "diRoma Acqua Park — Ingresso Morador",
    categorySection: "ingresso-1-dia",
    ticketCategory: "morador",
    enterprise: "diroma", destinationCity: "caldas-novas",
    description: "Desconto especial para moradores de Caldas Novas. Apresente seu RG e comprovante de residência na bilheteria.",
    price: 63, originalPrice: 90, discount: 30,
    image: "/images/diroma-acqua-park.jpeg",
    features: ["Toboáguas variados", "Piscina de ondas", "Área kids", "Bar molhado"],
    location: "Caldas Novas - GO",
    duration: "Dia inteiro", ageGroup: "Todas as idades",
    soldToday: 0, availableToday: 0,
    category: "parques", tags: ["morador", "desconto", "diversão"],
    documentRequired: "RG com endereço local + comprovante de residência",
    alsoBoght: ["morador-hot-park", "morador-lagoa"],
  },
  {
    id: "lagoa-termas",
    name: "Ingresso Lagoa Termas Parque",
    categorySection: "ingresso-1-dia",
    enterprise: "lagoa-termas", destinationCity: "caldas-novas",
    description: "Relaxe nas águas termais da Lagoa Quente e aproveite a natureza exuberante em ambiente único.",
    price: 75, originalPrice: 95, discount: 21,
    image: "/images/kawana-park.jpeg",
    features: ["Águas termais naturais", "Trilhas ecológicas", "Área de descanso", "Lanchonete", "Estacionamento"],
    location: "Caldas Novas - GO",
    duration: "Meio dia", ageGroup: "Todas as idades",
    soldToday: 0, availableToday: 0,
    category: "natureza", tags: ["relaxamento", "natureza", "casal"],
    alsoBoght: ["hot-park", "diroma-acqua-park"],
  },
  {
    id: "morador-lagoa",
    name: "Lagoa Termas — Ingresso Morador",
    categorySection: "ingresso-1-dia",
    ticketCategory: "morador",
    enterprise: "lagoa-termas", destinationCity: "caldas-novas",
    description: "Benefício exclusivo para moradores. Relaxe nas termais com 30% de desconto especial.",
    price: 53, originalPrice: 75, discount: 30,
    image: "/images/kawana-park.jpeg",
    features: ["Águas termais naturais", "Área de descanso", "Lanchonete", "Estacionamento grátis"],
    location: "Caldas Novas - GO",
    duration: "Meio dia", ageGroup: "Todas as idades",
    soldToday: 0, availableToday: 0,
    category: "natureza", tags: ["morador", "relaxamento", "natureza"],
    documentRequired: "RG com endereço local + comprovante de residência",
    alsoBoght: ["morador-diroma", "morador-kawana"],
  },
  {
    id: "passaporte-kawana",
    name: "Passaporte Kawana (3 dias)",
    categorySection: "ingresso-1-dia",
    enterprise: "kawana", destinationCity: "caldas-novas",
    description: "Aproveite 3 dias de diversão com acesso ilimitado ao Kawana Park e suas atrações exclusivas.",
    price: 210, originalPrice: 265, discount: 21,
    image: "/images/water-park.jpeg",
    features: ["3 dias de acesso", "Piscinas termais", "Toboáguas familiares", "Estacionamento grátis", "Área kids"],
    location: "Caldas Novas - GO",
    duration: "Dia inteiro", ageGroup: "Todas as idades",
    soldToday: 0, availableToday: 0,
    category: "parques", tags: ["família", "multidia", "águas termais"],
    alsoBoght: ["lagoa-termas", "diroma-acqua-park"],
  },
  {
    id: "morador-kawana",
    name: "Kawana Park — Ingresso Morador",
    categorySection: "ingresso-1-dia",
    ticketCategory: "morador",
    enterprise: "kawana", destinationCity: "caldas-novas",
    description: "O parque mais radical do Centro-Oeste com desconto exclusivo para moradores da região.",
    price: 72, originalPrice: 105, discount: 32,
    image: "/images/water-park.jpeg",
    features: ["Piscinas termais", "Toboáguas gigantes", "Piscina de ondas", "Rio lento"],
    location: "Caldas Novas - GO",
    duration: "Dia inteiro", ageGroup: "Todas as idades",
    soldToday: 0, availableToday: 0,
    category: "parques", tags: ["morador", "desconto", "aventura"],
    documentRequired: "RG com endereço local + comprovante de residência",
    alsoBoght: ["morador-hot-park", "morador-diroma"],
  },
  {
    id: "water-park",
    name: "Combo Hot Park + diRoma Acqua",
    categorySection: "combos",
    enterprise: "combos", destinationCity: "multi-destino",
    description: "O combo mais pedido! Acesse dois dos melhores parques da região com um desconto imperdível.",
    price: 245, originalPrice: 299, discount: 18,
    image: "/images/water-park.jpeg",
    features: ["2 parques em dias separados", "Hot Park completo", "diRoma Acqua Park", "Entrada prioritária", "Guia-mapa incluso"],
    location: "Rio Quente + Caldas Novas",
    duration: "2 dias", ageGroup: "Todas as idades",
    popular: true, soldToday: 0, availableToday: 0,
    category: "parques", tags: ["combo", "família", "aventura"],
    alsoBoght: ["hot-park", "diroma-acqua-park"],
    parkSlots: [
      { id: "hot-park", name: "Hot Park", emoji: "🌊", city: "rio-quente", color: "#0891B2" },
      { id: "diroma", name: "diRoma Acqua Park", emoji: "🏊", city: "caldas-novas", color: "#7C3AED" },
    ],
  },
  {
    id: "kawana-park",
    name: "Combo Família (2 Adultos + 1 Criança)",
    categorySection: "combos",
    enterprise: "combos", destinationCity: "multi-destino",
    description: "Pacote especial para a família! Dois ingressos adulto e um ingresso criança com desconto exclusivo.",
    price: 380, originalPrice: 450, discount: 16,
    image: "/images/kawana-park.jpeg",
    features: ["2 adultos + 1 criança", "Hot Park incluído", "Área infantil VIP", "Almoço incluso", "Pulseira ID kids"],
    location: "Rio Quente - GO",
    duration: "Dia inteiro", ageGroup: "Família",
    soldToday: 0, availableToday: 0,
    category: "parques", tags: ["família", "combo", "crianças"],
    alsoBoght: ["hot-park", "transp-goiania"],
    parkSlots: [
      { id: "hot-park", name: "Hot Park", emoji: "🌊", city: "rio-quente", color: "#0891B2" },
    ],
  },
  {
    id: "combo-3-parques",
    name: "Combo 3 Parques — Semana Completa",
    categorySection: "combos",
    enterprise: "combos", destinationCity: "multi-destino",
    description: "A experiência definitiva! Acesse 3 dos melhores parques e aproveite 3 dias de pura diversão.",
    price: 320, originalPrice: 395, discount: 19,
    image: "/images/diroma-acqua-park.jpeg",
    features: ["Hot Park + diRoma + Lagoa Termas", "3 dias em parques diferentes", "Café da manhã incluso", "Transfer entre parques"],
    location: "Rio Quente + Caldas Novas",
    duration: "3 dias", ageGroup: "Todas as idades",
    popular: true, soldToday: 0, availableToday: 0,
    category: "parques", tags: ["combo", "família", "melhor valor"],
    alsoBoght: ["kawana-park", "transp-goiania"],
    parkSlots: [
      { id: "hot-park", name: "Hot Park", emoji: "🌊", city: "rio-quente", color: "#0891B2" },
      { id: "diroma", name: "diRoma Acqua Park", emoji: "🏊", city: "caldas-novas", color: "#7C3AED" },
      { id: "lagoa-termas", name: "Lagoa Termas", emoji: "🌿", city: "caldas-novas", color: "#16A34A" },
    ],
  },
  {
    id: "ingresso-open-hotel",
    name: "Open Parques + Hotel (1 Noite)",
    categorySection: "especiais",
    enterprise: "combos", destinationCity: "multi-destino",
    description: "A viagem completa! Ingresso open para todos os parques + 1 noite em hotel parceiro com café da manhã.",
    price: 540, originalPrice: 680, discount: 21,
    image: "/images/diroma-acqua-park.jpeg",
    features: ["Open ingressos (3 parques)", "1 noite em hotel 4★", "Café da manhã incluso", "Transfer aeroporto"],
    location: "Rio Quente + Caldas Novas",
    duration: "2 dias / 1 noite", ageGroup: "Todas as idades",
    soldToday: 0, availableToday: 0,
    category: "parques", tags: ["hotel", "completo", "premium"],
    alsoBoght: ["ingresso-vip", "transp-brasilia"],
  },
  {
    id: "transp-goiania",
    name: "Transporte Goiânia → Caldas Novas",
    categorySection: "transporte",
    enterprise: "transporte", destinationCity: "multi-destino",
    description: "Conforto e segurança na viagem. Ônibus executivo com ar-condicionado, saída pontual e retorno garantido.",
    price: 65, originalPrice: 90, discount: 28,
    image: "/images/hot-park.jpeg",
    features: ["Ônibus executivo", "Ar-condicionado", "Wi-Fi a bordo", "Saída garantida", "Seguro viagem"],
    location: "Goiânia → Caldas Novas",
    duration: "Translado (3h)", ageGroup: "Todas as idades",
    soldToday: 0, availableToday: 0,
    category: "transporte", tags: ["transporte", "conforto", "família"],
    alsoBoght: ["hot-park", "diroma-acqua-park"],
  },
  {
    id: "transp-brasilia",
    name: "Transporte Brasília → Caldas Novas",
    categorySection: "transporte",
    enterprise: "transporte", destinationCity: "multi-destino",
    description: "Saída de Brasília com horário fixo. Ônibus moderno com poltronas reclináveis e paradas programadas.",
    price: 85, originalPrice: 120, discount: 29,
    image: "/images/lagoa-termas-parque.jpeg",
    features: ["Ônibus moderno", "Poltronas reclináveis", "Wi-Fi a bordo", "Lanche incluso", "Seguro viagem"],
    location: "Brasília → Caldas Novas",
    duration: "Translado (4h)", ageGroup: "Todas as idades",
    soldToday: 0, availableToday: 0,
    category: "transporte", tags: ["transporte", "conforto", "família"],
    alsoBoght: ["hot-park", "passaporte-kawana"],
  },
  {
    id: "cabana-standard",
    name: "Cabana Standard — até 4 pessoas",
    categorySection: "cabanas",
    enterprise: "cabanas", destinationCity: "multi-destino",
    description: "Tenha sua área exclusiva no parque. Espreguiçadeiras, mesa, guarda-sol e serviço de praia incluso.",
    price: 280, originalPrice: 350, discount: 20,
    image: "/images/kawana-park.jpeg",
    features: ["4 espreguiçadeiras", "Mesa e cadeiras", "Guarda-sol premium", "Frigobar", "Serviço de garçom", "Toalhas"],
    location: "Aqua Park - GO",
    duration: "Dia inteiro", ageGroup: "Até 4 pessoas",
    soldToday: 0, availableToday: 0,
    category: "cabanas", tags: ["cabana", "família", "conforto"],
    alsoBoght: ["hot-park", "ingresso-noturno"],
  },
  {
    id: "cabana-premium",
    name: "Cabana Premium — até 6 pessoas",
    categorySection: "cabanas",
    enterprise: "cabanas", destinationCity: "multi-destino",
    description: "Mais espaço, mais conforto e experiência premium completa. Perfeita para grupos e aniversários.",
    price: 450, originalPrice: 560, discount: 20,
    image: "/images/water-park.jpeg",
    features: ["6 espreguiçadeiras", "Área gourmet", "Frigobar premium", "TV com streaming", "Serviço exclusivo"],
    location: "Aqua Park - GO",
    duration: "Dia inteiro", ageGroup: "Até 6 pessoas",
    popular: true, soldToday: 0, availableToday: 0,
    category: "cabanas", tags: ["cabana", "grupo", "premium"],
    alsoBoght: ["ingresso-vip", "combo-3-parques"],
  },
  {
    id: "cabana-exclusive",
    name: "Cabana Exclusive — até 10 pessoas",
    categorySection: "cabanas",
    enterprise: "cabanas", destinationCity: "multi-destino",
    description: "A experiência definitiva em grupo! Cabana privativa com vista privilegiada e serviço 5 estrelas.",
    price: 680, originalPrice: 850, discount: 20,
    image: "/images/hot-park.jpeg",
    features: ["10 espreguiçadeiras", "Piscina privativa", "Chef exclusivo", "Open bar", "Acesso VIP total"],
    location: "Aqua Park - GO",
    duration: "Dia inteiro", ageGroup: "Até 10 pessoas",
    soldToday: 0, availableToday: 0,
    category: "cabanas", tags: ["cabana", "luxury", "vip"],
    alsoBoght: ["ingresso-vip", "combo-3-parques"],
  },
  {
    id: "meia-idoso",
    name: "Meia-Entrada — Idoso (60+)",
    categorySection: "ingresso-1-dia",
    ticketCategory: "meia-entrada",
    enterprise: "hot-park", enterprises: ["hot-park", "diroma", "lagoa-termas", "kawana"],
    destinationCity: "rio-quente",
    description: "Direito garantido por lei federal para maiores de 60 anos. Válido em todos os parques conveniados.",
    price: 95, originalPrice: 189, discount: 50,
    image: "/images/lagoa-termas-parque.jpeg",
    features: ["Hot Park", "diRoma Acqua Park", "Lagoa Termas", "Kawana Park", "Todos os parques parceiros"],
    location: "Todos os parques - GO",
    duration: "Dia inteiro", ageGroup: "Idosos (60+)",
    soldToday: 0, availableToday: 0,
    category: "parques", tags: ["meia-entrada", "idoso", "legal"],
    documentRequired: "RG ou CNH com data de nascimento",
    alsoBoght: ["meia-pcd", "meia-estudante"],
  },
  {
    id: "meia-estudante",
    name: "Meia-Entrada — Estudante",
    categorySection: "ingresso-1-dia",
    ticketCategory: "meia-entrada",
    enterprise: "hot-park", enterprises: ["hot-park", "diroma", "lagoa-termas", "kawana"],
    destinationCity: "rio-quente",
    description: "Lei da Meia-Entrada para estudantes com carteirinha nacional válida (CIE/UNE/ANIPES).",
    price: 95, originalPrice: 189, discount: 50,
    image: "/images/hot-park.jpeg",
    features: ["Hot Park", "diRoma Acqua Park", "Lagoa Termas", "Kawana Park", "Todos os parques parceiros"],
    location: "Todos os parques - GO",
    duration: "Dia inteiro", ageGroup: "Estudantes",
    soldToday: 0, availableToday: 0,
    category: "parques", tags: ["meia-entrada", "estudante", "legal"],
    documentRequired: "Carteirinha estudantil nacional (CIE/UNE) válida + documento com foto",
    alsoBoght: ["meia-idoso", "meia-professor"],
  },
  {
    id: "meia-pcd",
    name: "Ingresso Especial — PCD",
    categorySection: "ingresso-1-dia",
    ticketCategory: "meia-entrada",
    enterprise: "hot-park", enterprises: ["hot-park", "diroma", "lagoa-termas", "kawana"],
    destinationCity: "rio-quente",
    description: "Ingresso especial para Pessoas com Deficiência (PCD). Alguns parques oferecem gratuidade total com laudo.",
    price: 50, originalPrice: 189, discount: 74,
    image: "/images/kawana-park.jpeg",
    features: ["Hot Park — Day Use PCD", "Vaga preferencial de estacionamento", "Acessibilidade especial", "Acompanhante pode ter desconto"],
    location: "Todos os parques - GO",
    duration: "Dia inteiro", ageGroup: "PCD (com laudo)",
    soldToday: 0, availableToday: 0,
    category: "parques", tags: ["meia-entrada", "pcd", "acessibilidade"],
    documentRequired: "Laudo médico com CID + documento de identidade",
    alsoBoght: ["meia-idoso", "meia-estudante"],
  },
  {
    id: "meia-professor",
    name: "Meia-Entrada — Professor",
    categorySection: "ingresso-1-dia",
    ticketCategory: "meia-entrada",
    enterprise: "diroma", enterprises: ["hot-park", "diroma", "lagoa-termas", "kawana"],
    destinationCity: "caldas-novas",
    description: "Desconto especial para professores no Water Park e Clube Privé. Apresentar contracheque na bilheteria.",
    price: 50, originalPrice: 100, discount: 50,
    image: "/images/water-park.jpeg",
    features: ["Water Park", "Clube Privé", "Acesso ao dia todo", "Desconto comprovado por lei"],
    location: "Caldas Novas - GO",
    duration: "Dia inteiro", ageGroup: "Professores",
    soldToday: 0, availableToday: 0,
    category: "parques", tags: ["meia-entrada", "professor", "desconto"],
    documentRequired: "Último contracheque + documento com foto",
    alsoBoght: ["meia-estudante", "meia-idoso"],
  },
]

function formatPrice(price: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price)
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" ? window.innerWidth >= 768 : true)
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener("resize", handler)
    return () => window.removeEventListener("resize", handler)
  }, [])
  return isDesktop
}

function applyDateAvailability(baseTickets: TicketItem[], date: Date | null): TicketItem[] {
  return baseTickets.map((t) => {
    const avail = getDateAvailabilityForTicket(date, t.id)
    return { ...t, soldToday: avail.soldToday, availableToday: avail.availableToday }
  })
}

function getBestValueId(list: TicketItem[]) {
  let bestId = list[0].id
  let bestRatio = 0
  list.forEach((t) => {
    const ratio = t.discount / t.price
    if (ratio > bestRatio) {
      bestRatio = ratio
      bestId = t.id
    }
  })
  return bestId
}

export default function IngressosPage() {
  const [, navigate] = useLocation()
  const search = useSearch()
  const retryParams = useMemo(() => {
    const params = new URLSearchParams(search);
    return {
      retry: params.get("retry"),
      fromOrder: params.get("fromOrder"),
      status: params.get("status"),
    };
  }, [search]);
  const isDesktop = useIsDesktop()
  const [activeFilter, setActiveFilter] = useState("Todos")
  const [activePick, setActivePick] = useState<QuickPick | null>(null)
  const [showWizard, setShowWizard] = useState(false)
  const [profile, setProfile] = useState(getTravelerProfile())
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [showCompare, setShowCompare] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [timer, setTimer] = useState({ minutes: 47, seconds: 23 })
  const [tickets, setTickets] = useState(ticketsBase)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [skeletonLoading, setSkeletonLoading] = useState(false)
  const [cartModalTicket, setCartModalTicket] = useState<TicketItem | null>(null)
  const [cartModalPrice, setCartModalPrice] = useState(0)
  const [comboDatesTicket, setComboDatesTicket] = useState<TicketItem | null>(null)
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [retryRestoreLoading, setRetryRestoreLoading] = useState(false)
  const [retryRestoreDone, setRetryRestoreDone] = useState(false)
  const [retryRestoreError, setRetryRestoreError] = useState("")

  const {
    filters: searchFilters,
    setFilter: setSearchFilter,
    setFilters: setSearchFilters,
    clearFilters: clearSearchFilters,
    clearAll: clearAllSearchFilters,
    hasActiveFilters: searchHasActiveFilters,
  } = useUnifiedSearch({ syncUrl: true, basePath: "/ingressos" })

  const activeCity: DestinationCity = useMemo(() => {
    const c = searchFilters.city
    if (c === "caldas-novas" || c === "rio-quente" || c === "multi-destino") return c
    return "rio-quente"
  }, [searchFilters.city])

  const handleRemoveSearchFilter = useCallback((key: keyof SearchFilters | "priceRange") => {
    if (key === "priceRange") {
      setSearchFilters(clearPriceRange(searchFilters))
    } else if (key === "city") {
      setSearchFilter("city", undefined)
    } else {
      setSearchFilter(key as keyof SearchFilters, undefined)
    }
  }, [searchFilters, setSearchFilter, setSearchFilters])

  const { cart, total: cartTotal, addTicket, addManyToCart, updateTicketQty, removeTicket } = useTicketsCart()

  const cartTotalQty = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart])

  const { isOpen: comboWizardOpen, dismiss: dismissComboWizard } = useComboTrigger({
    cartTotalQty,
    enabled: true,
  })

  const priceMultiplier = useMemo(() => getPriceMultiplier(selectedDate), [selectedDate])
  const bestValueId = useMemo(() => getBestValueId(tickets), [tickets])

  const comboTickets = useMemo(() => {
    const scored = tickets
      .filter(t => t.categorySection === "combos")
      .map(t => ({
        ...t,
        matchScore: profile
          ? calculateMatchScore(profile, { category: t.category, price: t.price, tags: t.tags })
          : 0,
      }))
    return profile
      ? [...scored].sort((a, b) => b.matchScore - a.matchScore).slice(0, 3)
      : [...scored].sort((a, b) => b.discount - a.discount).slice(0, 2)
  }, [tickets, profile])

  const comboOriginalPrice = comboTickets.reduce((sum, t) => sum + t.price, 0)
  const comboDiscountedPrice = Math.round(comboOriginalPrice * 0.85)

  useEffect(() => {
    setProfile(getTravelerProfile())
    setTickets(applyDateAvailability(ticketsBase, null))
    trackEvent("tickets_page_view")

    const params = new URLSearchParams(window.location.search)
    const perfil = params.get("perfil")
    const destino = params.get("destino") as DestinationCity | null

    if (perfil) {
      const pickMap: Record<string, QuickPick> = {
        familia: "familia",
        economy: "custo",
        economia: "custo",
        popular: "popular",
        combo: "combo",
        relaxar: "custo",
        aventura: "popular",
      }
      const pick = pickMap[perfil]
      if (pick) setActivePick(pick)
      if (perfil === "combo") setActiveFilter("Todos")
    }

    if (destino === "caldas-novas" || destino === "rio-quente") {
      setSearchFilter("city", destino)
    }
  }, [])

  // Handle retry restore: fetch order items and restore cart
  useEffect(() => {
    async function restoreCartFromOrder() {
      if (retryParams.retry !== "1" || retryParams.fromOrder === null || retryParams.status === null) {
        return
      }

      try {
        setRetryRestoreLoading(true)
        setRetryRestoreError("")

        const orderId = retryParams.fromOrder
        const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/tickets`)
        if (!response.ok) {
          throw new Error(`Falha ao buscar itens do pedido: ${response.statusText}`)
        }

        const data = (await response.json()) as { orderId: string; items: Array<{ ticketId: string; title: string; quantity: number; unitPrice: number; lineTotal: number }> }

        if (!data.items || data.items.length === 0) {
          throw new Error("Nenhum item encontrado no pedido anterior")
        }

        // Convert API response to CartItem format
        const cartItems = data.items.map((item) => ({
          ticketId: item.ticketId,
          name: item.title,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          originalPrice: item.unitPrice,
          discount: 0,
          image: "",
        }))

        // Replace cart with restored items
        replaceCart(cartItems)

        // Try to restore customer data (nome, email, telefone, cpf) for checkout
        try {
          const orderRes = await fetch(`/api/orders/${encodeURIComponent(orderId)}`)
          if (orderRes.ok) {
            const orderData = await orderRes.json() as {
              customer?: { name?: string; email?: string; phone?: string; cpf?: string }
            }
            if (orderData.customer?.name && orderData.customer?.email) {
              setCheckoutPrefill({
                name: orderData.customer.name,
                email: orderData.customer.email,
                phone: orderData.customer.phone,
                cpf: orderData.customer.cpf,
              })
            }
          }
        } catch {
          // não falhar a restauração do carrinho em caso de erro extra de łoad
        }

        setRetryRestoreDone(true)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erro ao restaurar o carrinho"
        setRetryRestoreError(message)
      } finally {
        setRetryRestoreLoading(false)
      }
    }

    restoreCartFromOrder()
  }, [retryParams.retry, retryParams.fromOrder, retryParams.status])

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 }
        if (prev.minutes > 0) return { minutes: prev.minutes - 1, seconds: 59 }
        return { minutes: 47, seconds: 23 }
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setTickets(prev => prev.map(t => ({
        ...t,
        soldToday: (t.soldToday ?? 0) + (Math.random() > 0.6 ? 1 : 0),
        availableToday: Math.max(1, (t.availableToday ?? 10) - (Math.random() > 0.7 ? 1 : 0)),
      })))
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  const FAMILY_TAGS = ["família", "familia", "kids", "infantil"]

  const filteredTickets = useMemo(() => {
    let base = (() => {
      switch (activeFilter) {
        case "Parques":    return tickets.filter((t) => t.category === "parques")
        case "Natureza":   return tickets.filter((t) => t.category === "natureza")
        case "Transporte": return tickets.filter((t) => t.categorySection === "transporte")
        case "Combos":     return tickets.filter((t) => t.categorySection === "combos")
        case "Cabanas":    return tickets.filter((t) => t.categorySection === "cabanas")
        case "Especiais":  return tickets.filter((t) => t.categorySection === "especiais")
        default:           return tickets
      }
    })()

    const searchQ = searchFilters.q?.trim().toLowerCase()
    if (searchQ) {
      base = base.filter(t =>
        t.name.toLowerCase().includes(searchQ) ||
        t.description.toLowerCase().includes(searchQ) ||
        t.tags.some(tag => tag.toLowerCase().includes(searchQ)) ||
        (t.enterprise && t.enterprise.toLowerCase().includes(searchQ))
      )
    }

    if (searchFilters.type && searchFilters.type !== "all") {
      const typeMap: Record<string, string[]> = {
        park: ["parques", "natureza"],
        combo: ["combos"],
        hotel: [],
        attraction: [],
        destination: [],
        excursion: [],
      }
      const allowedCategories = typeMap[searchFilters.type] ?? []
      if (allowedCategories.length > 0) {
        base = base.filter(t => allowedCategories.includes(t.category))
      } else if (searchFilters.type !== "park") {
        base = []
      }
    }

    if (searchFilters.profile) {
      const profileTagMap: Record<string, string[]> = {
        familia: FAMILY_TAGS,
        casal: ["casal", "noturno", "adulto", "romantico"],
        aventura: ["aventura", "radical", "adrenalina", "vip", "premium"],
        relaxar: ["relaxamento", "natureza", "spa"],
        premium: ["vip", "premium", "luxury", "exclusivo"],
        economia: ["morador", "meia-entrada", "desconto", "acessivel"],
      }
      const profileTags = profileTagMap[searchFilters.profile] ?? []
      if (profileTags.length > 0) {
        base = [...base].sort((a, b) => {
          const aMatch = a.tags.some(tag => profileTags.some(f => tag.toLowerCase().includes(f))) ? 1 : 0
          const bMatch = b.tags.some(tag => profileTags.some(f => tag.toLowerCase().includes(f))) ? 1 : 0
          return bMatch - aMatch
        })
      }
    }

    const sort = searchFilters.sort
    if (sort === "price_asc" || activePick === "custo") return [...base].sort((a, b) => a.price - b.price)
    if (sort === "popular" || activePick === "popular") return [...base].sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0))

    return base
  }, [tickets, activeFilter, activePick, searchFilters.q, searchFilters.sort, searchFilters.type, searchFilters.profile])

  const cityFilteredTickets = useMemo(() => {
    const cityEnterprises = ENTERPRISE_CONFIG
      .filter(e => e.city === activeCity)
      .map(e => e.id)
    return filteredTickets.filter(t => {
      if (t.destinationCity === activeCity) return true
      const ticketEnterprises = t.enterprises ?? (t.enterprise ? [t.enterprise] : [])
      return ticketEnterprises.some(eid => cityEnterprises.includes(eid as typeof cityEnterprises[number]))
    })
  }, [filteredTickets, activeCity])

  function handleCityChange(city: DestinationCity) {
    if (city === activeCity) return
    setSkeletonLoading(true)
    setSearchFilter("city", city)
    trackEvent("ticket_filter_change", { filter: "city", value: city })
    setTimeout(() => setSkeletonLoading(false), 450)
  }

  function handleDateSelect(date: Date) {
    setSelectedDate(date)
    setTickets(prev => applyDateAvailability(prev, date))
    saveSelectedDate(date)
    trackEvent("date_selected", { date: date.toISOString(), multiplier: getPriceMultiplier(date) })
  }

  function handleQuickPick(pick: QuickPick) {
    if (pick === "combo") {
      setActivePick("combo")
      setSearchFilters({ type: "combo" })
      setShowWizard(true)
      trackEvent("ticket_filter_change", { filter: "quick_pick", value: pick })
    } else if (activePick === pick) {
      setActivePick(null)
      setSearchFilters({ sort: "relevance", profile: undefined, type: undefined })
      trackEvent("ticket_filter_change", { filter: "quick_pick", value: "cleared" })
    } else {
      setActivePick(pick)
      const presetMap: Record<QuickPick, Partial<SearchFilters>> = {
        custo: { sort: "price_asc" },
        familia: { profile: "familia" },
        popular: { sort: "popular" },
        combo: { type: "combo" },
      }
      setSearchFilters(presetMap[pick])
      trackEvent("ticket_filter_change", { filter: "quick_pick", value: pick })
    }
  }

  function handleBuy(ticket: TicketItem) {
    if (ticket.categorySection === "combos") {
      setComboDatesTicket(ticket)
      return
    }
    const adjPrice = Math.round(ticket.price * priceMultiplier)
    addTicket({
      ticketId: ticket.id,
      name: ticket.name,
      unitPrice: adjPrice,
      originalPrice: Math.round(ticket.originalPrice * priceMultiplier),
      discount: ticket.discount,
      image: ticket.image,
    })
    setCartModalTicket(ticket)
    setCartModalPrice(adjPrice)
    trackEvent("ticket_add_to_cart", { ticketId: ticket.id, quantity: 1 })
  }

  function handleComboDatesConfirm(comboDates: Record<string, string>, finalPrice: number) {
    if (!comboDatesTicket) return
    addTicket({
      ticketId: comboDatesTicket.id,
      name: comboDatesTicket.name,
      unitPrice: finalPrice,
      originalPrice: comboDatesTicket.originalPrice,
      discount: comboDatesTicket.discount,
      image: comboDatesTicket.image,
      comboDates,
    })
    setComboDatesTicket(null)
    trackEvent("combo_dates_confirmed", { ticketId: comboDatesTicket.id, parks: Object.keys(comboDates) })
  }

  function handleIncrease(ticket: TicketItem, qty: number) {
    updateTicketQty(ticket.id, qty + 1)
    trackEvent("ticket_add_to_cart", { ticketId: ticket.id, quantity: qty + 1 })
  }

  function handleDecrease(ticket: TicketItem, qty: number) {
    if (qty <= 1) {
      handleRemove(ticket.id)
    } else {
      updateTicketQty(ticket.id, qty - 1)
    }
  }

  function handleRemove(ticketId: string) {
    removeTicket(ticketId)
    trackEvent("ticket_remove_from_cart", { ticketId })
  }

  function handleWizardConfirm(items: Parameters<typeof addManyToCart>[0]) {
    addManyToCart(items)
    setShowWizard(false)
    setActivePick(null)
    trackEvent("wizard_confirm", { items: items.length })
  }

  function handleSidebarNavigate(enterpriseId: string, city: string) {
    const dest = city as DestinationCity
    handleCityChange(dest)
    setTimeout(() => {
      const el = document.getElementById(`section-enterprise-${enterpriseId}`)
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 500)
  }

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    )
  }

  const compareTickets = tickets.filter((t) => compareIds.includes(t.id))

  const searchBarSlot = (
    <div
      className="rsv-filter-bar"
      data-testid="filter-bar-ingressos"
      style={{
        background: "#fff", borderBottom: "1px solid #E5E7EB",
        padding: "12px 16px", display: "flex", gap: 8, overflowX: "auto",
        position: "sticky", top: 64, zIndex: 30, alignItems: "center",
      }}
    >
      <div className="rsv-catalog-desktop-only">
        <FilterPopover
          filters={searchFilters}
          onFiltersChange={setSearchFilters}
          onClearAll={clearAllSearchFilters}
        />
      </div>
      <button
        className="rsv-catalog-mobile-only rsv-hit-44-inline"
        data-testid="button-open-filters"
        onClick={() => setFilterDrawerOpen(true)}
        style={{
          display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
          background: "#EFF6FF", border: "1.5px solid #BFDBFE",
          borderRadius: 999, padding: "10px 14px", color: "#2563EB",
          fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        ⚙ Filtros
      </button>
      <HotelCategoryNav
        categories={[
          ...buildSectionTypeNav("ingressos"),
          CATALOG_DIVIDER,
          { label: "Todos",   value: "Todos",   icon: LayoutGrid, filterUpdate: {}, testId: "button-filter-todos" },
          { label: "Parques", value: "Parques", icon: Waves,      filterUpdate: {}, testId: "button-filter-parques" },
          { label: "Combos",  value: "Combos",  icon: Gift,       filterUpdate: {}, testId: "button-filter-combos" },
          { label: "Especiais", value: "Especiais", icon: Star,   filterUpdate: {}, testId: "button-filter-especiais" },
        ]}
        activeFilter={activeFilter}
        onSelect={(f) => {
          if (f.href) { navigate(f.href); return }
          setActiveFilter(f.value)
          trackEvent("ticket_filter_change", { filter: "category_tab", value: f.value })
        }}
      />
      {/* Hick: categorias secundárias fora do caminho crítico */}
      <details data-testid="filter-more-categories" style={{ flexShrink: 0, position: "relative" }}>
        <summary
          className="rsv-hit-44-inline"
          style={{
          listStyle: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
          color: "#6B7280", padding: "10px 14px", borderRadius: 999,
          border: "1.5px solid #E5E7EB", background: "#F9FAFB", whiteSpace: "nowrap",
          display: "inline-flex", alignItems: "center",
        }}>
          Mais
        </summary>
        <div style={{
          position: "absolute", marginTop: 6, zIndex: 40, background: "#fff",
          border: "1px solid #E5E7EB", borderRadius: 12, padding: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column", gap: 4,
          minWidth: 160,
        }}>
          {[
            { label: "Natureza", value: "Natureza", testId: "button-filter-natureza" },
            { label: "Transporte", value: "Transporte", testId: "button-filter-transporte" },
            { label: "Cabanas", value: "Cabanas", testId: "button-filter-cabanas" },
          ].map((f) => (
            <button
              key={f.value}
              type="button"
              data-testid={f.testId}
              onClick={() => {
                setActiveFilter(f.value)
                trackEvent("ticket_filter_change", { filter: "category_tab", value: f.value })
              }}
              style={{
                textAlign: "left", border: "none", background: activeFilter === f.value ? "#EFF6FF" : "transparent",
                borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 600,
                color: activeFilter === f.value ? "#2563EB" : "#374151", cursor: "pointer", minHeight: 44,
                width: "100%",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </details>
      <button
        data-testid="button-help-choose"
        onClick={() => setShowWizard(true)}
        className="rsv-hit-44-inline"
        style={{
          display: "flex", alignItems: "center", gap: 5, flexShrink: 0, marginLeft: "auto",
          background: "#FFF7ED", border: "1.5px solid #FDE68A",
          borderRadius: 999, padding: "10px 14px", color: "#D97706",
          fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        <Wand2 style={{ width: 14, height: 14 }} />
        Me ajude a escolher
      </button>
    </div>
  )

  return (
    <CatalogPageShell
      header={<HomeHeader />}
      searchBar={searchBarSlot}
      mobileDrawer={
        <SearchFiltersDrawer
          open={filterDrawerOpen}
          filters={searchFilters}
          onClose={() => setFilterDrawerOpen(false)}
          onFiltersChange={setSearchFilters}
          onClearAll={() => { clearAllSearchFilters(); setFilterDrawerOpen(false) }}
        />
      }
    >
      {retryParams.retry === "1" && retryParams.fromOrder && retryParams.status && (
        <>
          {/* Error banner if restore failed */}
          {retryRestoreError && (
            <div style={{
              background: "#FEE2E2",
              border: "1px solid #FECACA",
              borderRadius: 8,
              padding: "12px 16px",
              margin: "16px",
              fontSize: 14,
              color: "#991B1B",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }} data-testid="banner-retry-restore-error">
              <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, fontWeight: 700 }}>Não foi possível restaurar o carrinho</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.9 }}>{retryRestoreError}</p>
              </div>
            </div>
          )}

          {/* Success banner if restore succeeded */}
          {retryRestoreDone && !retryRestoreError && (
            <div style={{
              background: "#DCFCE7",
              border: "1px solid #86EFAC",
              borderRadius: 8,
              padding: "12px 16px",
              margin: "16px",
              fontSize: 14,
              color: "#15803D",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }} data-testid="banner-retry-restore-success">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Check style={{ width: 16, height: 16, flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontWeight: 700 }}>
                    Carrinho restaurado do pedido {retryParams.status === "EXPIRED" ? "expirado" : "com falha"}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.9 }}>ID: {retryParams.fromOrder}</p>
                </div>
              </div>
              <button
                onClick={() => navigate("/ingressos/checkout")}
                style={{
                  background: "#15803D",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
                data-testid="button-retry-continue-checkout"
              >
                Continuar checkout
              </button>
            </div>
          )}

          {/* Loading banner if restore is in progress */}
          {retryRestoreLoading && (
            <div style={{
              background: "#EFF6FF",
              border: "1px solid #BFDBFE",
              borderRadius: 8,
              padding: "12px 16px",
              margin: "16px",
              fontSize: 14,
              color: "#1D4ED8",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }} data-testid="banner-retry-restore-loading">
              <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite", flexShrink: 0 }} />
              Restaurando carrinho do pedido anterior...
            </div>
          )}

          {/* Info banner if no restore was attempted yet */}
          {!retryRestoreLoading && !retryRestoreDone && !retryRestoreError && (
            <div style={{
              background: "#FFF7ED",
              border: "1px solid #FDE68A",
              borderRadius: 8,
              padding: "12px 16px",
              margin: "16px",
              fontSize: 14,
              color: "#92400E",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <Timer style={{ width: 16, height: 16 }} />
              Você está refazendo um pedido {retryParams.status === "EXPIRED" ? "expirado" : "com falha"} (ID: {retryParams.fromOrder}).
            </div>
          )}
        </>
      )}

      <div
        style={{
          background: "linear-gradient(135deg, #0F1F38 0%, #1E3A5F 100%)",
          color: "#fff",
          padding: "104px 20px 48px",
        }}
      >
        <div style={{ maxWidth: 780, margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(26px, 5vw, 38px)", fontWeight: 800, margin: "0 0 8px" }} data-testid="text-page-title">Ingressos para Parques</h1>
        <p style={{ fontSize: "clamp(14px, 2.5vw, 16px)", opacity: 0.9, margin: "0 0 8px" }}>Até 29% OFF + Entrada prioritária</p>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Timer style={{ width: 14, height: 14, color: "#FCA5A5" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#FCA5A5" }} data-testid="text-countdown-timer">
            Preço especial por mais {String(timer.minutes).padStart(2, "0")}:{String(timer.seconds).padStart(2, "0")}
          </span>
        </div>
        </div>

      </div>

      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>

      <div style={{ padding: "16px 16px 0" }}>
        <CompactContextBar
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          selectedCity={activeCity}
          onCityChange={handleCityChange}
          weatherLabel={
            activeCity === "caldas-novas"
              ? "Caldas Novas · 26°C (Ensolarado)"
              : "Rio Quente · 24°C (Parcialmente nublado)"
          }
        />
        {selectedDate && (
          <div style={{ marginTop: 10 }}>
            <DateBanner
              selectedDate={selectedDate}
              priceMultiplier={priceMultiplier}
              onClear={() => {
                setSelectedDate(null)
                saveSelectedDate(null)
                setTickets(applyDateAvailability(ticketsBase, null))
              }}
            />
          </div>
        )}
      </div>

      <SocialProofBanner pageName="ingressos" />
      <PersonalizedBanner profile={profile} />
      <QuickDecisionSection
        onPick={handleQuickPick}
        onClearPick={() => {
          setActivePick(null)
          setSearchFilters({ sort: "relevance", profile: undefined, type: undefined })
          trackEvent("ticket_filter_change", { filter: "quick_pick", value: "cleared" })
        }}
        activePick={activePick === "combo" ? null : activePick}
      />

      {compareIds.length >= 1 && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          zIndex: 100, background: "#1F2937", color: "#fff", borderRadius: 14,
          padding: "10px 20px", display: "flex", alignItems: "center", gap: 12,
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }} data-testid="bar-compare">
          <BarChart3 style={{ width: 18, height: 18, color: "#60A5FA" }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{compareIds.length}/3 selecionados</span>
          {compareIds.length >= 2 ? (
            <button
              onClick={() => setShowCompare(true)}
              data-testid="button-compare-open"
              style={{
                background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8,
                padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >
              Comparar Agora
            </button>
          ) : (
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>Selecione mais {2 - compareIds.length}</span>
          )}
          <button
            onClick={() => setCompareIds([])}
            data-testid="button-compare-clear"
            style={{
              background: "transparent", color: "#9CA3AF", border: "none",
              cursor: "pointer", padding: 4,
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
      )}

      {showCompare && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }} onClick={() => setShowCompare(false)} data-testid="modal-compare">
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 20, width: "100%", maxWidth: 600,
            maxHeight: "90vh", overflow: "auto", padding: 24,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <BarChart3 style={{ width: 22, height: 22, color: "#2563EB" }} />
                Comparar Ingressos
              </h2>
              <button onClick={() => setShowCompare(false)} data-testid="button-compare-close" className="rsv-hit-44" style={{
                width: 44, height: 44, borderRadius: "50%", border: "none",
                background: "#F3F4F6", cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}>
                <X style={{ width: 16, height: 16, color: "#6B7280" }} />
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #E5E7EB" }}>
                    <th style={{ textAlign: "left", padding: "8px 12px", color: "#6B7280", fontWeight: 600 }}>Característica</th>
                    {compareTickets.map((t) => (
                      <th key={t.id} style={{ textAlign: "center", padding: "8px 12px", fontWeight: 700, color: "#1F2937" }}>
                        {t.name.replace("Ingresso ", "")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#374151" }}>Preço</td>
                    {compareTickets.map((t) => (
                      <td key={t.id} style={{ textAlign: "center", padding: "10px 12px", fontWeight: 700, color: "#16A34A" }}>
                        {formatPrice(Math.round(t.price * priceMultiplier))}
                        {priceMultiplier > 1 && (
                          <div style={{ fontSize: 9, color: "#D97706", marginTop: 2 }}>
                            (base: {formatPrice(t.price)})
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#374151" }}>Desconto</td>
                    {compareTickets.map((t) => (
                      <td key={t.id} style={{ textAlign: "center", padding: "10px 12px", fontWeight: 700, color: "#EF4444" }}>
                        -{t.discount}%
                      </td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#374151" }}>Localização</td>
                    {compareTickets.map((t) => (
                      <td key={t.id} style={{ textAlign: "center", padding: "10px 12px", color: "#6B7280" }}>
                        {t.location}
                      </td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#374151" }}>Duração</td>
                    {compareTickets.map((t) => (
                      <td key={t.id} style={{ textAlign: "center", padding: "10px 12px", color: "#6B7280" }}>
                        {t.duration}
                      </td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#374151" }}>Vendidos Hoje</td>
                    {compareTickets.map((t) => (
                      <td key={t.id} style={{ textAlign: "center", padding: "10px 12px", fontWeight: 700, color: "#EF4444" }}>
                        {t.soldToday}
                      </td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#374151" }}>Restantes Hoje</td>
                    {compareTickets.map((t) => (
                      <td key={t.id} style={{
                        textAlign: "center", padding: "10px 12px", fontWeight: 700,
                        color: (t.availableToday ?? 99) <= 10 ? "#EF4444" : "#6B7280",
                      }}>
                        {t.availableToday}
                      </td>
                    ))}
                  </tr>
                  <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#374151" }}>Match IA</td>
                    {compareTickets.map((t) => {
                      const ms = calculateMatchScore(profile, { category: t.category, price: t.price, tags: t.tags })
                      const msColor = ms >= 85 ? "#22C55E" : ms >= 70 ? "#2563EB" : "#F57C00"
                      return (
                        <td key={t.id} style={{ textAlign: "center", padding: "10px 12px", fontWeight: 700, color: msColor }}>
                          {ms}%
                        </td>
                      )
                    })}
                  </tr>
                  <tr>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#374151" }}>Atrações</td>
                    {compareTickets.map((t) => (
                      <td key={t.id} style={{ textAlign: "center", padding: "10px 12px", color: "#6B7280", fontSize: 12 }}>
                        {t.features.join(", ")}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              {compareTickets.map((t) => (
                <button
                  key={t.id}
                  data-testid={`button-compare-buy-${t.id}`}
                  onClick={() => {
                    handleBuy(t)
                    setShowCompare(false)
                  }}
                  style={{
                    flex: 1, padding: "12px 0", border: "none", borderRadius: 10,
                    background: "linear-gradient(135deg, #22C55E, #16A34A)", color: "#fff",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  <ShoppingCart style={{ width: 14, height: 14 }} />
                  {formatPrice(Math.round(t.price * priceMultiplier))}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <div style={{
          display: "flex", alignItems: "stretch", gap: 0,
          padding: "0 16px", marginBottom: 12,
          borderBottom: "2px solid #F3F4F6",
          overflowX: "auto",
        }} data-testid="city-tabs">
          {DESTINATION_CITIES.map((city) => {
            const isActive = activeCity === city.id
            const cityEnterpriseIds = ENTERPRISE_CONFIG.filter(e => e.city === city.id).map(e => e.id)
            const cityCount = filteredTickets.filter(t => {
              if (t.destinationCity === city.id) return true
              const tEnterprises = t.enterprises ?? (t.enterprise ? [t.enterprise] : [])
              return tEnterprises.some(eid => cityEnterpriseIds.includes(eid as typeof cityEnterpriseIds[number]))
            }).length
            return (
              <button
                key={city.id}
                data-testid={`tab-city-${city.id}`}
                onClick={() => handleCityChange(city.id)}
                style={{
                  flex: "0 0 auto",
                  padding: "10px 14px 12px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  position: "relative",
                  borderBottom: isActive ? `2.5px solid ${city.color}` : "2.5px solid transparent",
                  marginBottom: -2,
                  transition: "all 0.2s",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  minWidth: 0,
                  whiteSpace: "nowrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 16 }}>{city.emoji}</span>
                  <span style={{
                    fontSize: 13, fontWeight: isActive ? 800 : 500,
                    color: isActive ? city.color : "#6B7280",
                    transition: "all 0.2s",
                  }}>
                    {city.label}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    background: isActive ? city.color : "#F3F4F6",
                    color: isActive ? "#fff" : "#6B7280",
                    borderRadius: 20, padding: "1px 6px",
                    transition: "all 0.2s",
                    lineHeight: 1.5,
                  }}>
                    {cityCount}
                  </span>
                </div>
                {isActive && (
                  <span style={{ fontSize: 9, color: city.color, fontWeight: 600, opacity: 0.8, maxWidth: 140, textAlign: "center", lineHeight: 1.3 }}>
                    {city.description}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {(searchHasActiveFilters || !!searchFilters.q) && (
          <div style={{ padding: "0 16px", marginBottom: 8 }} data-testid="ingressos-search-summary">
            <SearchResultsSummary
              total={cityFilteredTickets.length}
              query={searchFilters.q}
              filters={searchFilters}
              onRemoveFilter={handleRemoveSearchFilter}
              onClearAll={clearAllSearchFilters}
            />
          </div>
        )}

        {skeletonLoading ? (
          <div style={{ padding: "0 16px" }} data-testid="skeleton-loading">
            <LoadingSkeleton variant="card" rows={4} />
          </div>
        ) : cityFilteredTickets.length === 0 ? (
          <SearchEmptyState
            query={searchFilters.q}
            onClearFilters={() => { clearAllSearchFilters(); setActivePick(null); setActiveFilter("Todos") }}
          />
        ) : (
          <EnterpriseAccordion
            key={activeCity}
            tickets={cityFilteredTickets}
            cart={cart}
            onBuy={handleBuy}
            onInc={handleIncrease}
            onDec={handleDecrease}
            priceMultiplier={priceMultiplier}
            afterFirstEnterprise={
              <div style={{
                margin: "6px 0 4px", padding: 20, borderRadius: 16,
                background: "linear-gradient(135deg, #1E3A8A, #2563EB)",
                color: "#fff", position: "relative", overflow: "hidden",
              }} data-testid="section-combo-ia">
                <div style={{
                  position: "absolute", top: -20, right: -20, width: 100, height: 100,
                  borderRadius: "50%", background: "rgba(255,255,255,0.1)",
                }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Sparkles style={{ width: 20, height: 20, color: "#FDE68A" }} />
                  <span style={{ fontSize: 14, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Combo IA — Sugestão Inteligente
                  </span>
                </div>
                <p style={{ fontSize: 13, margin: "0 0 12px", opacity: 0.9 }}>
                  {profile
                    ? `Baseado no seu perfil, a IA selecionou ${comboTickets.length} combos ideais para você:`
                    : "A IA analisou os parques e sugere a melhor combinação para você:"}
                </p>
                <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                  {comboTickets.map((t) => (
                    <div key={t.id} style={{
                      flex: 1, minWidth: 100, background: "rgba(255,255,255,0.15)",
                      borderRadius: 10, padding: "10px 12px",
                    }}>
                      <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 4px" }}>{t.name}</p>
                      <span style={{ fontSize: 12, opacity: 0.8 }}>{formatPrice(t.price)}</span>
                      {profile && t.matchScore > 0 && (
                        <div style={{
                          marginTop: 4, fontSize: 10, fontWeight: 700,
                          background: "rgba(255,255,255,0.2)", borderRadius: 4,
                          padding: "2px 6px", display: "inline-block",
                        }}>
                          {t.matchScore}% match
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, textDecoration: "line-through", opacity: 0.6 }}>
                    {formatPrice(comboOriginalPrice)}
                  </span>
                  <span style={{ fontSize: 24, fontWeight: 800 }}>
                    {formatPrice(comboDiscountedPrice)}
                  </span>
                  <span style={{
                    background: "#FACC15", color: "#000", fontSize: 11, fontWeight: 800,
                    padding: "3px 8px", borderRadius: 6,
                  }}>
                    -15% IA
                  </span>
                  <span style={{
                    background: "rgba(255,255,255,0.2)", fontSize: 11, fontWeight: 600,
                    padding: "3px 8px", borderRadius: 6,
                  }}>
                    Economia de {formatPrice(comboOriginalPrice - comboDiscountedPrice)}
                  </span>
                </div>
                <button
                  data-testid="button-combo-ia-buy"
                  onClick={() =>
                    window.open(
                      `https://wa.me/5564993197555?text=Olá! Quero o Combo IA: ${comboTickets.map(t => t.name).join(" + ")} com 15% de desconto!`,
                      "_blank"
                    )
                  }
                  style={{
                    width: "100%", padding: "13px 0", border: "none", borderRadius: 10,
                    background: "#fff", color: "#1E3A8A", fontSize: 15, fontWeight: 800,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  <ShoppingCart style={{ width: 18, height: 18 }} />
                  Quero esse Combo!
                </button>
              </div>
            }
          />
        )}
      </div>

      <div style={{ padding: "0 16px 16px" }}>
        <CrossSellSection
          title="Quem comprou ingressos também reservou:"
          items={[
            { name: "Hotel diRoma Fiori", price: 320, link: "/hoteis", badge: "-20%", image: "/images/diroma-acqua-park.jpeg" },
            { name: "Lacqua DiRoma", price: 280, link: "/hoteis", badge: "TOP", image: "/images/hot-park.jpeg" },
            { name: "Pousada Recanto", price: 195, link: "/hoteis", badge: "Econômico" },
            { name: "Resort Náutico", price: 450, link: "/hoteis", badge: "Premium" },
          ]}
        />
      </div>

        </div>

        {isDesktop && (
          <div id="ingressos-sidebar" style={{ width: 340, flexShrink: 0, padding: "20px 16px 20px 0" }}>
            <IngressosSidebar
              cart={cart}
              total={cartTotal}
              selectedDate={selectedDate}
              onRemove={handleRemove}
              onNavigate={handleSidebarNavigate}
              onCheckout={() => {
                trackEvent("tickets_checkout_start", { total: cartTotal, items: cart.length })
                navigate("/ingressos/checkout")
              }}
            />
          </div>
        )}
      </div>

      <MiniWizard
        open={showWizard}
        tickets={tickets.map(t => ({
          id: t.id,
          name: t.name,
          price: t.price,
          originalPrice: t.originalPrice,
          discount: t.discount,
          duration: t.duration,
          popular: t.popular,
          category: t.category,
          tags: t.tags,
          image: t.image,
        }))}
        profile={profile}
        onClose={() => {
          setShowWizard(false)
          setActivePick(null)
        }}
        onConfirm={handleWizardConfirm}
      />

      {cart.length === 0 && (
        <a
          href="https://wa.me/5564993197555?text=Olá! Gostaria de informações sobre ingressos para parques."
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-whatsapp-float"
          onClick={() => trackEvent("ticket_whatsapp_share_click", { source: "float_empty_cart" })}
          style={{
            position: "fixed", bottom: 80, right: 16,
            width: 56, height: 56, background: "#22C55E", borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(0,0,0,0.2)", zIndex: 50,
          }}
        >
          <Phone style={{ width: 26, height: 26, color: "#fff" }} />
        </a>
      )}

      {!isDesktop && (
        <CartStickyBar
          cart={cart}
          total={cartTotal}
          onCheckout={() => navigate("/ingressos/checkout")}
        />
      )}


      <CartAddModal
        ticket={cartModalTicket}
        adjPrice={cartModalPrice}
        onClose={() => setCartModalTicket(null)}
        onGoToCart={() => {
          setCartModalTicket(null)
          const sidebarEl = document.getElementById("ingressos-sidebar")
          if (sidebarEl) {
            sidebarEl.scrollIntoView({ behavior: "smooth", block: "nearest" })
          } else {
            window.scrollTo({ top: 0, behavior: "smooth" })
          }
        }}
      />

      {comboDatesTicket && (
        <ComboDatesModal
          ticket={comboDatesTicket}
          onConfirm={handleComboDatesConfirm}
          onClose={() => setComboDatesTicket(null)}
        />
      )}

      <ComboIAWizard
        open={comboWizardOpen}
        onDismiss={dismissComboWizard}
        cartItems={cart}
        onAddSuggestion={(suggestion) => {
          addTicket({
            ticketId: suggestion.id,
            name: suggestion.name,
            unitPrice: suggestion.comboPrice,
            originalPrice: suggestion.originalPrice,
          })
        }}
      />
    </CatalogPageShell>
  )
}
