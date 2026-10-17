/**
 * Smoke test manual: npx tsx server/services/ticket-hold.service.test.ts
 */
import assert from "node:assert/strict"
import {
  __resetTicketHoldStoreForTests,
  acquireHold,
  attachHoldToTransaction,
  consumeHoldByTransaction,
  getAvailableQuantity,
  InsufficientInventoryError,
  releaseHoldByTransaction,
  TICKET_DEFAULT_STOCK,
} from "./ticket-hold.service.js"

__resetTicketHoldStoreForTests()

const items = [{ ticketId: "hot-park", quantity: 2 }]
const holdA = acquireHold("sess-a", items)
assert.equal(holdA.status, "ACTIVE")
assert.equal(getAvailableQuantity("hot-park"), TICKET_DEFAULT_STOCK - 2)

try {
  acquireHold("sess-b", [{ ticketId: "hot-park", quantity: TICKET_DEFAULT_STOCK }])
  assert.fail("deveria lançar InsufficientInventoryError")
} catch (err) {
  assert.ok(err instanceof InsufficientInventoryError)
}

attachHoldToTransaction(holdA.holdId, "tkt-1", new Date(Date.now() + 60_000).toISOString(), items)
consumeHoldByTransaction("tkt-1")
assert.equal(getAvailableQuantity("hot-park"), TICKET_DEFAULT_STOCK - 2)

__resetTicketHoldStoreForTests()
const holdC = acquireHold("sess-c", items)
attachHoldToTransaction(holdC.holdId, "tkt-2", new Date(Date.now() + 60_000).toISOString(), items)
releaseHoldByTransaction("tkt-2")
assert.equal(getAvailableQuantity("hot-park"), TICKET_DEFAULT_STOCK)

console.log("ticket-hold.service.test.ts OK")
