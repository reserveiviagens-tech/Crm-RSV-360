/**
 * Smoke: npx tsx server/services/webhook-idempotency.service.test.ts
 */
import assert from "node:assert/strict"
import {
  __resetWebhookIdempotencyForTests,
  buildWebhookEventKey,
  claimWebhookEvent,
  wasWebhookProcessed,
} from "./webhook-idempotency.service.js"

__resetWebhookIdempotencyForTests()

const keyA = buildWebhookEventKey({
  transactionId: "txn-1",
  status: "paid",
})
assert.equal(keyA, "txn:txn-1:paid")

const keyB = buildWebhookEventKey({
  eventId: "evt-99",
  transactionId: "txn-1",
  status: "paid",
})
assert.equal(keyB, "evt:evt-99")

const first = claimWebhookEvent(keyA)
assert.equal(first.isNew, true)
assert.equal(wasWebhookProcessed(keyA), true)

const replay = claimWebhookEvent(keyA)
assert.equal(replay.isNew, false)
assert.equal(replay.firstSeenAt, first.firstSeenAt)

const other = claimWebhookEvent(
  buildWebhookEventKey({ transactionId: "txn-1", status: "expired" })
)
assert.equal(other.isNew, true)

console.log("webhook-idempotency.service.test.ts OK")
