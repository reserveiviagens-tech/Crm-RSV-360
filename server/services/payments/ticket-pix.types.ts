export type TicketPaymentStatus =
  | "PENDING"
  | "APPROVED"
  | "EXPIRED"
  | "FAILED"
  | "CANCELLED"

export interface TicketLineItem {
  ticketId: string
  quantity: number
}

export interface TicketResolvedItem {
  ticketId: string
  title: string
  quantity: number
  unitPrice: number
  originalPrice: number
}

export interface TicketCustomer {
  name: string
  email: string
  cpf: string
  phone: string
}

export interface TicketPixChargeRequest {
  orderId: string
  lineItems: TicketResolvedItem[]
  customer: TicketCustomer
  totalAmount: number
  originalTotal: number
  totalSavings: number
  isCombo: boolean
  expirationDate: string
}

export interface TicketPaymentResult {
  success: boolean
  demo: boolean
  transactionId: string
  qrCodeBase64: string
  copyPasteCode: string
  status: TicketPaymentStatus
  totalAmount: number
  originalTotal: number
  totalSavings: number
  isCombo: boolean
  expirationDate: string
  items: TicketResolvedItem[]
  customer: TicketCustomer
  provider: string
}

export interface TicketPixProvider {
  readonly name: string
  createCharge(req: TicketPixChargeRequest): Promise<TicketPaymentResult>
  checkStatus(transactionId: string): Promise<{
    status: TicketPaymentStatus
    paid: boolean
  }>
  cancel(transactionId: string): Promise<{ cancelled: boolean }>
}
