/**
 * Fase 11 — BFF & payload optimization
 * Agrega pedido + status + Pix num contrato estável e enxuto para a UI.
 */

export type OrderBffView = "full" | "lite"

export interface TicketTxnLike {
  transactionId: string
  status: "PENDING" | "APPROVED" | "EXPIRED" | "FAILED" | "CANCELLED"
  totalAmount: number
  originalTotal: number
  totalSavings: number
  isCombo: boolean
  items: Array<{
    ticketId: string
    title: string
    quantity: number
    unitPrice: number
    originalPrice?: number
  }>
  customer: { name: string; email: string; cpf: string; phone: string }
  qrCodeBase64: string
  copyPasteCode: string
  expirationDate: string
  createdAt: string
  demo: boolean
  voucherId?: string
  voucherToken?: string
}

export function maskCpf(cpf: string | undefined): string {
  const digits = String(cpf ?? "").replace(/\D/g, "")
  if (digits.length < 2) return "***"
  return `***.***.***-${digits.slice(-2)}`
}

export function computeSecondsLeft(expirationDate: string, now = Date.now()): number {
  const exp = new Date(expirationDate).getTime()
  if (Number.isNaN(exp)) return 0
  return Math.max(0, Math.floor((exp - now) / 1000))
}

/** Resposta mínima para polling (sem QR / sem PII sensível). */
export function buildOrderBffLite(txn: TicketTxnLike) {
  const paid = txn.status === "APPROVED"
  return {
    orderId: txn.transactionId,
    status: txn.status,
    paid,
    secondsLeft: computeSecondsLeft(txn.expirationDate),
    expirationDate: txn.expirationDate,
    demo: txn.demo,
    meta: { view: "lite" as const, v: 1 },
  }
}

/**
 * Vista completa otimizada:
 * - CPF mascarado
 * - QR só se PENDING e includeQr
 * - items sem originalPrice
 */
export function buildOrderBffFull(
  txn: TicketTxnLike,
  opts: { includeQr?: boolean } = {}
) {
  const includeQr = opts.includeQr !== false && txn.status === "PENDING"
  const paid = txn.status === "APPROVED"

  return {
    orderId: txn.transactionId,
    status: txn.status,
    paid,
    totalAmount: txn.totalAmount,
    originalTotal: txn.originalTotal,
    totalSavings: txn.totalSavings,
    isCombo: txn.isCombo,
    items: txn.items.map((i) => ({
      ticketId: i.ticketId,
      title: i.title,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.unitPrice * i.quantity,
    })),
    customer: {
      name: txn.customer.name,
      email: txn.customer.email,
      phone: txn.customer.phone,
      cpfMasked: maskCpf(txn.customer.cpf),
    },
    createdAt: txn.createdAt,
    expirationDate: txn.expirationDate,
    secondsLeft: computeSecondsLeft(txn.expirationDate),
    demo: txn.demo,
    voucherId: txn.voucherId,
    // token só se já existir no store (UI usa ?token= da URL)
    hasVoucherToken: Boolean(txn.voucherToken),
    pix:
      txn.status === "PENDING"
        ? {
            copyPasteCode: txn.copyPasteCode,
            ...(includeQr ? { qrCodeBase64: txn.qrCodeBase64 } : {}),
            hasQr: Boolean(txn.qrCodeBase64),
          }
        : null,
    meta: {
      view: "full" as const,
      v: 1,
      includeQr,
      approxBytesSaved: includeQr ? 0 : Math.max(0, (txn.qrCodeBase64?.length ?? 0)),
    },
  }
}

export function slimPaymentDetails(
  txn: TicketTxnLike,
  opts: { includeQr?: boolean } = {}
) {
  const includeQr = opts.includeQr === true
  return {
    transactionId: txn.transactionId,
    status: txn.status,
    copyPasteCode: txn.copyPasteCode,
    expirationDate: txn.expirationDate,
    totalAmount: txn.totalAmount,
    originalTotal: txn.originalTotal,
    totalSavings: txn.totalSavings,
    isCombo: txn.isCombo,
    items: txn.items.map((i) => ({
      ticketId: i.ticketId,
      title: i.title,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
    demo: txn.demo,
    voucherId: txn.voucherId,
    voucherToken: txn.voucherToken,
    ...(includeQr ? { qrCodeBase64: txn.qrCodeBase64 } : {}),
    hasQr: Boolean(txn.qrCodeBase64),
  }
}
