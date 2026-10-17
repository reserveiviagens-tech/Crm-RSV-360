import { DemoTicketPixProvider } from "./demo-ticket-pix.provider.js"
import { GatewayTicketPixProvider } from "./gateway-ticket-pix.provider.js"
import type { TicketPixProvider } from "./ticket-pix.types.js"

export type TicketPixProviderName = "demo" | "gateway"

/** Credenciais placeholder no .env não contam como gateway real. */
export function hasUsableGatewayCredentials(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const url = (env.GATEWAY_API_URL || "").trim()
  const key = (env.GATEWAY_API_KEY || "").trim()
  if (!url || !key) return false
  const placeholderUrl =
    /seugateway|example\.com|placeholder|your-gateway|localhost/i.test(url)
  const placeholderKey = /^(demo|test|changeme|xxx|your[-_]?key)/i.test(key)
  return !placeholderUrl && !placeholderKey
}

/**
 * Factory — escolhe a Strategy de Pix de ingressos.
 * PAYMENT_PROVIDER=demo|gateway força a escolha; senão usa credenciais reais do gateway.
 */
export function resolveTicketPixProviderName(
  env: NodeJS.ProcessEnv = process.env
): TicketPixProviderName {
  const forced = (env.PAYMENT_PROVIDER || env.TICKET_PIX_PROVIDER || "").toLowerCase()
  if (forced === "demo") return "demo"
  if (forced === "gateway") return "gateway"
  if (hasUsableGatewayCredentials(env)) return "gateway"
  return "demo"
}

export function createTicketPixProvider(
  name: TicketPixProviderName = resolveTicketPixProviderName()
): TicketPixProvider {
  switch (name) {
    case "gateway":
      return new GatewayTicketPixProvider()
    case "demo":
    default:
      return new DemoTicketPixProvider()
  }
}

/** Singleton lazy — rotas usam a mesma instância por processo. */
let cached: TicketPixProvider | null = null

export function getTicketPixProvider(): TicketPixProvider {
  if (!cached) cached = createTicketPixProvider()
  return cached
}

/** Apenas testes. */
export function __resetTicketPixProviderForTests(): void {
  cached = null
}
