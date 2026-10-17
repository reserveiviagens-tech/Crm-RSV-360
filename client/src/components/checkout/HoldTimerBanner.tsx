import { Clock, AlertTriangle, Loader2 } from "lucide-react"

interface HoldTimerBannerProps {
  minutes: string
  seconds: string
  isExpired: boolean
  isAcquiring?: boolean
  error?: string | null
  onRetry?: () => void
  /** full = formulário/mobile sticky · compact = sidebar de resumo (urgência Von Restorff) */
  variant?: "full" | "compact"
}

export function HoldTimerBanner({
  minutes,
  seconds,
  isExpired,
  isAcquiring,
  error,
  onRetry,
  variant = "full",
}: HoldTimerBannerProps) {
  const compact = variant === "compact"
  const pad = compact ? "8px 10px" : "10px 14px"
  const radius = compact ? 10 : 12
  const mb = compact ? 12 : 16

  if (isAcquiring) {
    return (
      <div
        style={{
          background: "#EFF6FF",
          border: "1px solid #BFDBFE",
          borderRadius: radius,
          padding: pad,
          marginBottom: mb,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
        data-testid={compact ? "banner-hold-acquiring-sidebar" : "banner-hold-acquiring"}
      >
        <Loader2
          style={{
            width: compact ? 16 : 18,
            height: compact ? 16 : 18,
            color: "#2563EB",
            flexShrink: 0,
            animation: "spin 1s linear infinite",
          }}
        />
        <span style={{ fontSize: compact ? 11 : 13, fontWeight: 600, color: "#1E40AF" }}>
          Reservando ingressos…
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          background: "#FEF2F2",
          border: "1px solid #FECACA",
          borderRadius: radius,
          padding: pad,
          marginBottom: mb,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
        data-testid={compact ? "banner-hold-error-sidebar" : "banner-hold-error"}
      >
        <AlertTriangle style={{ width: 16, height: 16, color: "#DC2626", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: compact ? 11 : 13, fontWeight: 600, color: "#991B1B" }}>
            {compact ? "Falha na reserva temporária" : error}
          </span>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            data-testid={compact ? "btn-hold-retry-sidebar" : "btn-hold-retry"}
            style={{
              border: "none",
              background: "#DC2626",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
              minHeight: 40,
              flexShrink: 0,
            }}
          >
            Renovar
          </button>
        )}
      </div>
    )
  }

  if (isExpired) {
    return (
      <div
        style={{
          background: "#FEF2F2",
          border: "1px solid #FECACA",
          borderRadius: radius,
          padding: pad,
          marginBottom: mb,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
        data-testid={compact ? "banner-hold-expired-sidebar" : "banner-hold-expired"}
      >
        <AlertTriangle style={{ width: 16, height: 16, color: "#DC2626", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: compact ? 11 : 13, fontWeight: 600, color: "#991B1B" }}>
            {compact ? "Tempo esgotado — renove a reserva" : "Tempo de retenção esgotado. Os ingressos foram liberados."}
          </span>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            data-testid={compact ? "btn-hold-retry-sidebar" : "btn-hold-retry"}
            style={{
              border: "none",
              background: "#DC2626",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
              minHeight: 40,
              flexShrink: 0,
            }}
          >
            Renovar
          </button>
        )}
      </div>
    )
  }

  if (compact) {
    return (
      <div
        style={{
          background: "linear-gradient(135deg, #FFF7ED, #FFEDD5)",
          border: "1.5px solid #FB923C",
          borderRadius: radius,
          padding: pad,
          marginBottom: mb,
          display: "flex",
          alignItems: "center",
          gap: 8,
          boxShadow: "0 2px 8px rgba(234, 88, 12, 0.12)",
        }}
        data-testid="banner-hold-timer-sidebar"
      >
        <Clock style={{ width: 16, height: 16, color: "#EA580C", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#C2410C", letterSpacing: 0.4, textTransform: "uppercase" }}>
            Reserva temporária
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#EA580C", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }} data-testid="text-hold-countdown-sidebar">
            {minutes}:{seconds}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        background: "#FFF7ED",
        border: "1px solid #FED7AA",
        borderRadius: radius,
        padding: pad,
        marginBottom: mb,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
      data-testid="banner-hold-timer"
    >
      <Clock style={{ width: 18, height: 18, color: "#EA580C", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#9A3412" }}>
          Ingressos reservados para você —{" "}
          <span style={{ fontWeight: 800, color: "#EA580C" }} data-testid="text-hold-countdown">
            {minutes}:{seconds}
          </span>
        </span>
        <div style={{ fontSize: 11, color: "#C2410C", marginTop: 2 }}>
          Finalize o pagamento antes do tempo acabar para não perder a vaga.
        </div>
      </div>
    </div>
  )
}
