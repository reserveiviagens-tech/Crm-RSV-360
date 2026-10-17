/**
 * Smoke: npx tsx server/services/payment-idempotency.service.test.ts
 */
import assert from "node:assert/strict"
import {
  __resetPaymentIdempotencyForTests,
  fingerprintTicketCreatePayload,
  lookupIdempotentPayment,
  normalizeIdempotencyKey,
  storeIdempotentPayment,
} from "./payment-idempotency.service.js"

__resetPaymentIdempotencyForTests()

assert.equal(normalizeIdempotencyKey("  abc-123  "), "abc-123")
assert.equal(normalizeIdempotencyKey("bad key!"), null)
assert.equal(normalizeIdempotencyKey(""), null)

const fp1 = fingerprintTicketCreatePayload({
  items: [
    { ticketId: "b", quantity: 1 },
    { ticketId: "a", quantity: 2 },
  ],
  customer: {
    name: " Maria ",
    email: "Maria@Test.com",
    cpf: "000.000.000-00",
    phone: "(62) 99999-9999",
  },
})
const fp2 = fingerprintTicketCreatePayload({
  items: [
    { ticketId: "a", quantity: 2 },
    { ticketId: "b", quantity: 1 },
  ],
  customer: {
    name: "maria",
    email: "maria@test.com",
    cpf: "00000000000",
    phone: "62999999999",
  },
})
assert.equal(fp1, fp2)

const key = "idem-smoke-1"
assert.equal(lookupIdempotentPayment(key, fp1).kind, "miss")

storeIdempotentPayment(key, fp1, 201, { transactionId: "tkt-1" }, "tkt-1")
const hit = lookupIdempotentPayment(key, fp1)
assert.equal(hit.kind, "hit")
if (hit.kind === "hit") {
  assert.equal(hit.record.transactionId, "tkt-1")
}

const otherFp = fingerprintTicketCreatePayload({
  items: [{ ticketId: "a", quantity: 9 }],
  customer: {
    name: "maria",
    email: "maria@test.com",
    cpf: "00000000000",
    phone: "62999999999",
  },
})
assert.equal(lookupIdempotentPayment(key, otherFp).kind, "conflict")

console.log("payment-idempotency.service.test.ts OK")
