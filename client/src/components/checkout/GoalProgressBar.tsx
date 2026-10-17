/**
 * Fase 7 — Goal Gradient + Zeigarnik
 * Barra de progresso que acelera visualmente perto da meta + copy de tarefa incompleta.
 */

export type GoalStage = "cart" | "email" | "dados" | "pagamento" | "pago"

const STAGE_META: Record<
  GoalStage,
  { percent: number; label: string; remaining: string }
> = {
  cart: {
    percent: 28,
    label: "Ingressos no carrinho",
    remaining: "Faltam 2 passos para garantir sua reserva",
  },
  email: {
    percent: 45,
    label: "Identificação",
    remaining: "Faltam 2 passos — complete seus dados",
  },
  dados: {
    percent: 72,
    label: "Dados preenchidos",
    remaining: "Falta 1 passo — só o pagamento",
  },
  pagamento: {
    percent: 92,
    label: "Quase lá!",
    remaining: "Último passo: gerar o Pix e confirmar",
  },
  pago: {
    percent: 100,
    label: "Reserva garantida",
    remaining: "Tudo certo — ingresso confirmado",
  },
}

interface GoalProgressBarProps {
  stage: GoalStage
  /** light = fundo azul do hero · dark = sticky bar / cards claros */
  tone?: "onDark" | "onLight"
  compact?: boolean
  testId?: string
}

export function GoalProgressBar({
  stage,
  tone = "onDark",
  compact = false,
  testId = "goal-progress-bar",
}: GoalProgressBarProps) {
  const meta = STAGE_META[stage]
  const onDark = tone === "onDark"
  const trackBg = onDark ? "rgba(255,255,255,0.22)" : "#E5E7EB"
  const labelColor = onDark ? "rgba(255,255,255,0.95)" : "#0F172A"
  const subColor = onDark ? "rgba(255,255,255,0.75)" : "#64748B"
  // Goal gradient: mais laranja/verde perto do fim (Von Restorff + aceleração)
  const fill =
    meta.percent >= 90
      ? "linear-gradient(90deg, #FBBF24, #F97316, #22C55E)"
      : meta.percent >= 60
        ? "linear-gradient(90deg, #38BDF8, #22C55E)"
        : "linear-gradient(90deg, #60A5FA, #38BDF8)"

  return (
    <div data-testid={testId} style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 8,
          marginBottom: compact ? 4 : 6,
        }}
      >
        <span
          data-testid={`${testId}-label`}
          style={{
            fontSize: compact ? 11 : 12,
            fontWeight: 800,
            color: labelColor,
            letterSpacing: 0.2,
          }}
        >
          {meta.label}
        </span>
        <span
          data-testid={`${testId}-percent`}
          style={{
            fontSize: compact ? 11 : 12,
            fontWeight: 800,
            color: onDark ? "#FDE68A" : "#EA580C",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {meta.percent}%
        </span>
      </div>

      <div
        data-testid={`${testId}-track`}
        style={{
          height: compact ? 6 : 8,
          borderRadius: 999,
          background: trackBg,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          data-testid={`${testId}-fill`}
          style={{
            height: "100%",
            width: `${meta.percent}%`,
            borderRadius: 999,
            background: fill,
            boxShadow: meta.percent >= 90 ? "0 0 12px rgba(249, 115, 22, 0.55)" : "none",
            transition: "width 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>

      {!compact && (
        <p
          data-testid={`${testId}-zeigarnik`}
          style={{
            margin: "6px 0 0",
            fontSize: 11,
            fontWeight: 600,
            color: subColor,
            lineHeight: 1.35,
          }}
        >
          {meta.remaining}
        </p>
      )}
    </div>
  )
}

export function stageFromCheckoutStep(step: "email" | "dados" | "pagamento"): GoalStage {
  if (step === "email") return "email"
  if (step === "dados") return "dados"
  return "pagamento"
}
