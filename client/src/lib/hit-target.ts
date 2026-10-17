import type { CSSProperties } from "react"

/** Fase 8 — Fitts / HIG: alvo mínimo de toque 44×44px */
export const HIT_TARGET_PX = 44

export const hitTargetStyle: CSSProperties = {
  minWidth: HIT_TARGET_PX,
  minHeight: HIT_TARGET_PX,
}

export function hitTargetSquare(size = HIT_TARGET_PX): CSSProperties {
  return {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  }
}
