export type HomeSectionId = "escolhas" | "destinos" | "ofertas" | "tempo"

export type HomeSectionPlacement = {
  id: number
  section: string
  entityType: string
  entityId: string
  titleOverride: string | null
  subtitleOverride?: string | null
  badgeText?: string | null
  imageUrl?: string | null
  ctaHref: string | null
  orderIndex: number
  isActive: boolean
}

const DEFAULT_API_BASE = "https://api.reserveiviagens.com.br"

function apiBase(): string {
  const raw =
    import.meta.env.VITE_RSV360_BACKEND_URL ||
    import.meta.env.VITE_API_URL ||
    DEFAULT_API_BASE
  return String(raw).replace(/\/$/, "")
}

/**
 * Busca placements públicos de uma seção da home.
 * Em falha de rede/API retorna [] para o caller aplicar fallback estático.
 */
export async function fetchHomeSection(
  section: HomeSectionId,
  signal?: AbortSignal,
): Promise<HomeSectionPlacement[]> {
  try {
    const url = `${apiBase()}/api/v1/home/sections/${section}`
    const res = await fetch(url, {
      method: "GET",
      signal,
      headers: { Accept: "application/json" },
    })
    if (!res.ok) return []
    const body = (await res.json()) as { success?: boolean; data?: HomeSectionPlacement[] }
    if (!body?.success || !Array.isArray(body.data)) return []
    return body.data.filter((row) => row && row.isActive !== false)
  } catch {
    return []
  }
}
