import { calculateCartComboTotal } from "./pricing-engine"
import { lookupTicketPrice } from "./ticket-catalog"
import { demoAutoConfirmCallbacks } from "./payments/demo-ticket-pix.provider.js"
import { getTicketPixProvider } from "./payments/ticket-pix.factory.js"
import type {
  TicketCustomer,
  TicketLineItem,
  TicketPaymentResult,
  TicketResolvedItem,
} from "./payments/ticket-pix.types.js"

export type {
  TicketCustomer,
  TicketLineItem,
  TicketPaymentResult,
  TicketResolvedItem,
} from "./payments/ticket-pix.types.js"

export { demoAutoConfirmCallbacks }

export class UnknownTicketError extends Error {
  constructor(public ticketId: string) {
    super(`Ingresso não encontrado no catálogo: ${ticketId}`)
    this.name = "UnknownTicketError"
  }
}

function resolveLineItems(lineItems: TicketLineItem[]): TicketResolvedItem[] {
  return lineItems.map((li) => {
    const catalogEntry = lookupTicketPrice(li.ticketId)
    if (!catalogEntry) throw new UnknownTicketError(li.ticketId)
    return {
      ticketId: li.ticketId,
      title: catalogEntry.name,
      quantity: li.quantity,
      unitPrice: catalogEntry.unitPrice,
      originalPrice: catalogEntry.originalPrice,
    }
  })
}

/**
 * Facade estável — pricing + Factory/Strategy do provider Pix.
 * Contratos HTTP (routes) não mudam.
 */
export async function createTicketPix(
  lineItems: TicketLineItem[],
  customer: TicketCustomer
): Promise<TicketPaymentResult> {
  const resolvedItems = resolveLineItems(lineItems)
  const isCombo = resolvedItems.length >= 2
  const comboTotals = calculateCartComboTotal({
    items: resolvedItems.map((i) => ({
      unitPrice: i.unitPrice,
      originalPrice: i.originalPrice,
      quantity: i.quantity,
    })),
    comboDiscountRate: isCombo ? 0.15 : 0,
  })

  const expirationDate = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const orderId = `tkt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const provider = getTicketPixProvider()

  return provider.createCharge({
    orderId,
    lineItems: resolvedItems,
    customer,
    totalAmount: comboTotals.comboTotal,
    originalTotal: comboTotals.originalTotal,
    totalSavings: comboTotals.totalSavings,
    isCombo,
    expirationDate,
  })
}

export async function checkTicketPaymentStatus(transactionId: string): Promise<{
  status: TicketPaymentResult["status"]
  paid: boolean
}> {
  if (transactionId.startsWith("demo-")) {
    return { status: "PENDING", paid: false }
  }
  return getTicketPixProvider().checkStatus(transactionId)
}

export async function cancelTicketPix(
  transactionId: string
): Promise<{ cancelled: boolean }> {
  if (transactionId.startsWith("demo-")) {
    return { cancelled: true }
  }
  return getTicketPixProvider().cancel(transactionId)
}
