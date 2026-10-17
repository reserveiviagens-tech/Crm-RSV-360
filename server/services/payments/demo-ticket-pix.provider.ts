import type {
  TicketPaymentResult,
  TicketPixChargeRequest,
  TicketPixProvider,
  TicketPaymentStatus,
} from "./ticket-pix.types.js"

const DEMO_PIX_QR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAMAAAD04JH5AAAABlBMVEX///8AAABVwtN+AAAB+klEQVR4nO2ayw7DIAxE6f9/uqcrQQiPweNJpZ6VKmxmjI0BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgc4wxHiml9NznvPe01lprH+e9/17vvfc457z3nPe+5z3nfe9573vfe9573vee/73vfe9573vee9773vfe9573vfe9773vfe9573vfe9773vfe9573vfe+573vfe9773vfe9573vfe9773vfe977nvfe9573vfe9773vfe9573vfe9773vfe9573vfe977nvfe9573vfe9773vfe9573vfe9773vfe977"

const DEMO_CONFIRM_DELAY_MS = process.env.DEMO_CONFIRM_DELAY_MS
  ? parseInt(process.env.DEMO_CONFIRM_DELAY_MS, 10)
  : null

/** Callbacks de auto-confirmação demo (TTL opcional via env). */
export const demoAutoConfirmCallbacks = new Map<string, () => void>()

export class DemoTicketPixProvider implements TicketPixProvider {
  readonly name = "demo"

  async createCharge(req: TicketPixChargeRequest): Promise<TicketPaymentResult> {
    const transactionId = `demo-${req.orderId}`

    if (DEMO_CONFIRM_DELAY_MS && DEMO_CONFIRM_DELAY_MS > 0) {
      setTimeout(() => {
        demoAutoConfirmCallbacks.get(transactionId)?.()
        demoAutoConfirmCallbacks.delete(transactionId)
      }, DEMO_CONFIRM_DELAY_MS)
    }

    return {
      success: true,
      demo: true,
      transactionId,
      qrCodeBase64: DEMO_PIX_QR,
      copyPasteCode: `00020126580014br.gov.bcb.pix0136reservei-ingressos-${req.orderId}5204000053039865802BR5925${req.customer.name.slice(0, 25).toUpperCase()}6009CALDAS NOV62070503***6304ABCD`,
      status: "PENDING",
      totalAmount: req.totalAmount,
      originalTotal: req.originalTotal,
      totalSavings: req.totalSavings,
      isCombo: req.isCombo,
      expirationDate: req.expirationDate,
      items: req.lineItems,
      customer: req.customer,
      provider: this.name,
    }
  }

  async checkStatus(transactionId: string): Promise<{
    status: TicketPaymentStatus
    paid: boolean
  }> {
    void transactionId
    return { status: "PENDING", paid: false }
  }

  async cancel(_transactionId: string): Promise<{ cancelled: boolean }> {
    return { cancelled: true }
  }
}
