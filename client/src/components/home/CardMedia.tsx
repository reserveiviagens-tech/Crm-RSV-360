import type { CSSProperties } from "react"

type CardMediaProps = {
  src?: string | null
  alt: string
  width?: number
  height?: number
  className?: string
  style?: CSSProperties
  /** Absolute fill for banner backgrounds (Weather). */
  fill?: boolean
  opacity?: number
}

export function isVideoUrl(url?: string | null): boolean {
  return Boolean(url && /\.(mp4|webm)(\?.*)?$/i.test(url))
}

export function homeMediaAlt(title: string, subtitle?: string | null): string {
  const base = subtitle?.trim()
    ? `${title} - ${subtitle.trim()} em Caldas Novas e Rio Quente | Reservei Viagens`
    : `${title} em Caldas Novas e Rio Quente | Reservei Viagens`
  return base.slice(0, 180)
}

/**
 * Renders image or muted loop video for home section cards.
 * Dimensions help CLS / PageSpeed; alt is SEO/AI friendly.
 */
export function CardMedia({
  src,
  alt,
  width = 1200,
  height = 675,
  className,
  style,
  fill = false,
  opacity = 1,
}: CardMediaProps) {
  if (!src) return null

  const commonStyle: CSSProperties = fill
    ? {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
        pointerEvents: "none",
        opacity,
        zIndex: 0,
        ...style,
      }
    : {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
        opacity,
        ...style,
      }

  if (isVideoUrl(src)) {
    return (
      <video
        src={src}
        className={className}
        style={commonStyle}
        width={width}
        height={height}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-label={alt}
      />
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={commonStyle}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
    />
  )
}
