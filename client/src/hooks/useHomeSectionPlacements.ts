import { useEffect, useState } from "react"
import {
  fetchHomeSection,
  type HomeSectionId,
  type HomeSectionPlacement,
} from "@/lib/home-sections-api"

export function useHomeSectionPlacements(section: HomeSectionId) {
  const [placements, setPlacements] = useState<HomeSectionPlacement[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    let alive = true
    fetchHomeSection(section, ctrl.signal).then((rows) => {
      if (!alive) return
      setPlacements(rows)
      setLoaded(true)
    })
    return () => {
      alive = false
      ctrl.abort()
    }
  }, [section])

  return { placements, loaded }
}
