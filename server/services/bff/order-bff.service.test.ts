/**
 * Smoke: npx tsx server/services/bff/order-bff.service.test.ts
 */
import assert from "node:assert/strict"
import {
  buildOrderBffFull,
  buildOrderBffLite,
  maskCpf,
  slimPaymentDetails,
  type TicketTxnLike,
} from "./order-bff.service.js"

assert.equal(maskCpf("000.000.000-99"), "***.***.***-99")
assert.equal(maskCpf("12"), "***.***.***-12")

const txn: TicketTxnLike = {
  transactionId: "demo-tkt-1",
  status: "PENDING",
  totalAmount: 189,
  originalTotal: 220,
  totalSavings: 31,
  isCombo: false,
  items: [
    {
      ticketId: "hot-park",
      title: "Hot Park",
      quantity: 1,
      unitPrice: 189,
      originalPrice: 220,
    },
  ],
  customer: {
    name: "Maria",
    email: "m@t.com",
    cpf: "12345678901",
    phone: "62999999999",
  },
  qrCodeBase64: "data:image/png;base64," + "A".repeat(800),
  copyPasteCode: "00020126...",
  expirationDate: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
  demo: true,
  voucherId: "v1",
  voucherToken: "tok",
}

const lite = buildOrderBffLite(txn)
assert.equal(lite.meta.view, "lite")
assert.equal(lite.paid, false)
assert.ok(lite.secondsLeft > 0)
assert.equal("pix" in lite, false)

const full = buildOrderBffFull(txn, { includeQr: true })
assert.equal(full.customer.cpfMasked, "***.***.***-01")
assert.ok(full.pix?.qrCodeBase64)
assert.equal(full.items[0].lineTotal, 189)

const fullNoQr = buildOrderBffFull(txn, { includeQr: false })
assert.equal(fullNoQr.pix?.qrCodeBase64, undefined)
assert.equal(fullNoQr.pix?.hasQr, true)
assert.ok((fullNoQr.meta.approxBytesSaved ?? 0) >= 800)

const slim = slimPaymentDetails(txn, { includeQr: false })
assert.equal("qrCodeBase64" in slim, false)
assert.equal(slim.hasQr, true)

const slimQr = slimPaymentDetails(txn, { includeQr: true })
assert.ok(slimQr.qrCodeBase64)

console.log("order-bff.service.test.ts OK")
