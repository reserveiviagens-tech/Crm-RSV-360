import { randomUUID } from "crypto";
import { lookupTicketPrice } from "./ticket-catalog";

/** TTL padrão de retenção temporal (15 min) enquanto o comprador preenche o checkout. */
export const TICKET_HOLD_TTL_MS = Number(process.env.TICKET_HOLD_TTL_MS) || 15 * 60 * 1000;

/** Estoque soft por ingresso (demo / single-instance). */
export const TICKET_DEFAULT_STOCK = Number(process.env.TICKET_DEFAULT_STOCK) || 100;

export type HoldItem = {
  ticketId: string;
  quantity: number;
};

export type HoldStatus = "ACTIVE" | "ATTACHED" | "CONSUMED" | "RELEASED" | "EXPIRED";

export type TicketHold = {
  holdId: string;
  sessionId: string;
  items: HoldItem[];
  status: HoldStatus;
  createdAt: string;
  expiresAt: string;
  transactionId?: string;
};

export class InsufficientInventoryError extends Error {
  constructor(
    public ticketId: string,
    public requested: number,
    public available: number,
  ) {
    super(
      `Estoque insuficiente para ${ticketId}: pediu ${requested}, disponível ${available}`,
    );
    this.name = "InsufficientInventoryError";
  }
}

export class HoldNotFoundError extends Error {
  constructor(public holdId: string) {
    super(`Hold não encontrado: ${holdId}`);
    this.name = "HoldNotFoundError";
  }
}

export class HoldConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HoldConflictError";
  }
}

const holds = new Map<string, TicketHold>();
const soldQty = new Map<string, number>();

function nowMs() {
  return Date.now();
}

function normalizeItems(items: HoldItem[]): HoldItem[] {
  const map = new Map<string, number>();
  for (const it of items) {
    if (!it?.ticketId || typeof it.quantity !== "number" || it.quantity < 1) continue;
    if (!lookupTicketPrice(it.ticketId)) continue;
    map.set(it.ticketId, (map.get(it.ticketId) ?? 0) + Math.floor(it.quantity));
  }
  return Array.from(map.entries()).map(([ticketId, quantity]) => ({ ticketId, quantity }));
}

/** Expira holds vencidos de forma síncrona (lazy GC). */
export function purgeExpiredHolds(at = nowMs()): number {
  let n = 0;
  for (const hold of Array.from(holds.values())) {
    if (
      (hold.status === "ACTIVE" || hold.status === "ATTACHED") &&
      new Date(hold.expiresAt).getTime() <= at
    ) {
      hold.status = "EXPIRED";
      n += 1;
    }
  }
  return n;
}

function heldQty(ticketId: string, excludeHoldId?: string): number {
  let total = 0;
  for (const hold of Array.from(holds.values())) {
    if (hold.holdId === excludeHoldId) continue;
    if (hold.status !== "ACTIVE" && hold.status !== "ATTACHED") continue;
    if (new Date(hold.expiresAt).getTime() <= nowMs()) continue;
    const line = hold.items.find((i: HoldItem) => i.ticketId === ticketId);
    if (line) total += line.quantity;
  }
  return total;
}

export function getSoldQuantity(ticketId: string): number {
  return soldQty.get(ticketId) ?? 0;
}

export function getAvailableQuantity(ticketId: string, excludeHoldId?: string): number {
  purgeExpiredHolds();
  const stock = TICKET_DEFAULT_STOCK;
  const available = stock - getSoldQuantity(ticketId) - heldQty(ticketId, excludeHoldId);
  return Math.max(0, available);
}

export function getAvailabilitySnapshot(ticketIds?: string[]): Record<
  string,
  { stock: number; sold: number; held: number; available: number }
> {
  purgeExpiredHolds();
  const ids =
    ticketIds && ticketIds.length > 0
      ? ticketIds
      : Array.from(
          new Set([
            ...Array.from(soldQty.keys()),
            ...Array.from(holds.values()).flatMap((h) => h.items.map((i) => i.ticketId)),
          ]),
        );

  const out: Record<string, { stock: number; sold: number; held: number; available: number }> = {};
  for (const id of ids) {
    if (!lookupTicketPrice(id)) continue;
    const sold = getSoldQuantity(id);
    const held = heldQty(id);
    out[id] = {
      stock: TICKET_DEFAULT_STOCK,
      sold,
      held,
      available: Math.max(0, TICKET_DEFAULT_STOCK - sold - held),
    };
  }
  return out;
}

/**
 * Adquire (ou renova) um hold atômico para a sessão.
 * Em Node single-thread, check+set síncrono é atomicidade de processo.
 */
export function acquireHold(sessionId: string, rawItems: HoldItem[]): TicketHold {
  purgeExpiredHolds();

  const sid = String(sessionId || "").trim();
  if (!sid) throw new HoldConflictError("sessionId é obrigatório");

  const items = normalizeItems(rawItems);
  if (items.length === 0) {
    throw new HoldConflictError("Nenhum item válido para retenção");
  }

  // Renova hold ativo da mesma sessão (libera slots antigos antes do novo check).
  for (const hold of Array.from(holds.values())) {
    if (
      hold.sessionId === sid &&
      (hold.status === "ACTIVE" || hold.status === "ATTACHED") &&
      !hold.transactionId
    ) {
      hold.status = "RELEASED";
    }
  }

  for (const item of items) {
    const available = getAvailableQuantity(item.ticketId);
    if (item.quantity > available) {
      throw new InsufficientInventoryError(item.ticketId, item.quantity, available);
    }
  }

  const hold: TicketHold = {
    holdId: `hold-${randomUUID()}`,
    sessionId: sid,
    items,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(nowMs() + TICKET_HOLD_TTL_MS).toISOString(),
  };

  holds.set(hold.holdId, hold);
  return { ...hold, items: hold.items.map((i) => ({ ...i })) };
}

export function getHold(holdId: string): TicketHold | null {
  purgeExpiredHolds();
  const hold = holds.get(holdId);
  if (!hold) return null;
  return { ...hold, items: hold.items.map((i) => ({ ...i })) };
}

export function releaseHold(holdId: string): TicketHold {
  purgeExpiredHolds();
  const hold = holds.get(holdId);
  if (!hold) throw new HoldNotFoundError(holdId);
  if (hold.status === "CONSUMED") {
    throw new HoldConflictError("Hold já consumido (pago); não pode ser liberado");
  }
  if (hold.status === "ACTIVE" || hold.status === "ATTACHED") {
    hold.status = "RELEASED";
  }
  return { ...hold, items: hold.items.map((i) => ({ ...i })) };
}

/** Vincula hold ao Pix e estende TTL até a expiração do pagamento. */
export function attachHoldToTransaction(
  holdId: string,
  transactionId: string,
  expiresAtIso: string,
  expectedItems?: HoldItem[],
): TicketHold {
  purgeExpiredHolds();
  const hold = holds.get(holdId);
  if (!hold) throw new HoldNotFoundError(holdId);
  if (hold.status === "EXPIRED" || hold.status === "RELEASED") {
    throw new HoldConflictError("Hold expirado ou liberado");
  }
  if (hold.status === "CONSUMED") {
    throw new HoldConflictError("Hold já consumido");
  }
  if (hold.transactionId && hold.transactionId !== transactionId) {
    throw new HoldConflictError("Hold já vinculado a outra transação");
  }

  if (expectedItems && expectedItems.length > 0) {
    const normalized = normalizeItems(expectedItems);
    for (const exp of normalized) {
      const line = hold.items.find((i) => i.ticketId === exp.ticketId);
      if (!line || line.quantity < exp.quantity) {
        throw new HoldConflictError(
          `Hold não cobre o item ${exp.ticketId} (qtd ${exp.quantity})`,
        );
      }
    }
  }

  hold.status = "ATTACHED";
  hold.transactionId = transactionId;
  hold.expiresAt = expiresAtIso;
  return { ...hold, items: hold.items.map((i) => ({ ...i })) };
}

export function consumeHoldByTransaction(transactionId: string): TicketHold | null {
  purgeExpiredHolds();
  for (const hold of Array.from(holds.values())) {
    if (hold.transactionId !== transactionId) continue;
    if (hold.status === "CONSUMED") {
      return { ...hold, items: hold.items.map((i: HoldItem) => ({ ...i })) };
    }
    if (hold.status === "ACTIVE" || hold.status === "ATTACHED") {
      for (const item of hold.items) {
        soldQty.set(item.ticketId, getSoldQuantity(item.ticketId) + item.quantity);
      }
      hold.status = "CONSUMED";
      return { ...hold, items: hold.items.map((i: HoldItem) => ({ ...i })) };
    }
  }
  return null;
}

export function releaseHoldByTransaction(transactionId: string): TicketHold | null {
  purgeExpiredHolds();
  for (const hold of Array.from(holds.values())) {
    if (hold.transactionId !== transactionId) continue;
    if (hold.status === "CONSUMED") {
      return { ...hold, items: hold.items.map((i: HoldItem) => ({ ...i })) };
    }
    if (hold.status === "ACTIVE" || hold.status === "ATTACHED") {
      hold.status = "RELEASED";
      return { ...hold, items: hold.items.map((i: HoldItem) => ({ ...i })) };
    }
  }
  return null;
}

/** Extensão de TTL (heartbeat) enquanto o checkout está aberto. */
export function refreshHold(holdId: string): TicketHold {
  purgeExpiredHolds();
  const hold = holds.get(holdId);
  if (!hold) throw new HoldNotFoundError(holdId);
  if (hold.status !== "ACTIVE") {
    throw new HoldConflictError(`Não é possível renovar hold com status ${hold.status}`);
  }
  hold.expiresAt = new Date(nowMs() + TICKET_HOLD_TTL_MS).toISOString();
  return { ...hold, items: hold.items.map((i) => ({ ...i })) };
}

/** Apenas para testes / smoke. */
export function __resetTicketHoldStoreForTests(): void {
  holds.clear();
  soldQty.clear();
}
