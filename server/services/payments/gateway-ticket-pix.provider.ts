import type {
  TicketPaymentResult,
  TicketPixChargeRequest,
  TicketPixProvider,
  TicketPaymentStatus,
} from "./ticket-pix.types.js"

export class GatewayTicketPixProvider implements TicketPixProvider {
  readonly name = "gateway"

  private get credentials(): { url: string; key: string } {
    const url = process.env.GATEWAY_API_URL
    const key = process.env.GATEWAY_API_KEY
    if (!url || !key) {
      throw new Error("Gateway de pagamento não configurado (GATEWAY_API_URL / GATEWAY_API_KEY).")
    }
    return { url, key }
  }

  async createCharge(req: TicketPixChargeRequest): Promise<TicketPaymentResult> {
    const { url, key } = this.credentials

    const payload = {
      items: req.lineItems.map((i) => ({
        id: i.ticketId,
        title: i.title,
        quantity: i.quantity,
        unit_price: i.unitPrice,
      })),
      customer: {
        name: req.customer.name,
        email: req.customer.email,
        document: req.customer.cpf,
        phone: req.customer.phone,
      },
      payment_method: "pix",
      metadata: { orderId: req.orderId, type: "ingresso" },
    }

    const res = await fetch(`${url}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error("Falha na comunicação com o Gateway de Pagamento.")

    const data = (await res.json()) as {
      id: string
      pix_qr_code: string
      pix_copy_paste: string
      status: string
    }

    return {
      success: true,
      demo: false,
      transactionId: data.id,
      qrCodeBase64: data.pix_qr_code,
      copyPasteCode: data.pix_copy_paste,
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
    const { url, key } = this.credentials
    const res = await fetch(`${url}/transactions/${transactionId}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    const data = (await res.json()) as { status: string }
    const paid = data.status === "paid" || data.status === "approved"
    return {
      status: paid
        ? "APPROVED"
        : data.status === "expired"
          ? "EXPIRED"
          : data.status === "failed"
            ? "FAILED"
            : data.status === "cancelled"
              ? "CANCELLED"
              : "PENDING",
      paid,
    }
  }

  async cancel(transactionId: string): Promise<{ cancelled: boolean }> {
    try {
      const { url, key } = this.credentials
      const res = await fetch(`${url}/transactions/${transactionId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
      })
      return { cancelled: res.ok }
    } catch {
      return { cancelled: false }
    }
  }
}
