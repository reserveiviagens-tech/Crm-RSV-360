/**
 * Smoke: npx tsx server/services/payments/ticket-pix.factory.test.ts
 */
import assert from "node:assert/strict"
import {
  __resetTicketPixProviderForTests,
  createTicketPixProvider,
  resolveTicketPixProviderName,
} from "./ticket-pix.factory.js"

__resetTicketPixProviderForTests()

assert.equal(
  resolveTicketPixProviderName({ PAYMENT_PROVIDER: "demo" } as NodeJS.ProcessEnv),
  "demo"
)
assert.equal(
  resolveTicketPixProviderName({ PAYMENT_PROVIDER: "gateway" } as NodeJS.ProcessEnv),
  "gateway"
)
assert.equal(
  resolveTicketPixProviderName({
    GATEWAY_API_URL: "https://api.pagamentos.real.br",
    GATEWAY_API_KEY: "sk_live_abc123",
  } as NodeJS.ProcessEnv),
  "gateway"
)
assert.equal(
  resolveTicketPixProviderName({
    GATEWAY_API_URL: "https://api.seugateway.com.br",
    GATEWAY_API_KEY: "demo-key",
  } as NodeJS.ProcessEnv),
  "demo"
)
assert.equal(resolveTicketPixProviderName({} as NodeJS.ProcessEnv), "demo")

const demo = createTicketPixProvider("demo")
assert.equal(demo.name, "demo")

const charge = await demo.createCharge({
  orderId: "tkt-test-1",
  lineItems: [
    {
      ticketId: "hot-park",
      title: "Hot Park",
      quantity: 1,
      unitPrice: 100,
      originalPrice: 120,
    },
  ],
  customer: {
    name: "Maria Teste",
    email: "maria@test.com",
    cpf: "000.000.000-00",
    phone: "(62) 99999-9999",
  },
  totalAmount: 100,
  originalTotal: 120,
  totalSavings: 20,
  isCombo: false,
  expirationDate: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
})

assert.equal(charge.demo, true)
assert.ok(charge.transactionId.startsWith("demo-"))
assert.equal(charge.provider, "demo")
assert.equal(charge.status, "PENDING")

const cancel = await demo.cancel(charge.transactionId)
assert.equal(cancel.cancelled, true)

console.log("ticket-pix.factory.test.ts OK")
